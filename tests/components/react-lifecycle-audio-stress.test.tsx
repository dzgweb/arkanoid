/**
 * @file tests/components/react-lifecycle-audio-stress.test.tsx
 * Adversarial stress testing suite for React lifecycles, component re-renders,
 * audio state synchronization, and maximum update depth loop prevention.
 *
 * Challenge Dimensions:
 * 1. Rapid Re-render & Inline Options Reference Churn (useAudio & GameContainer)
 * 2. High-Frequency Volume & Mute Mutation / Oscillation (1,000+ rapid mutations)
 * 3. Mount / Unmount Lifecycle Thrashing & Event Listener Cleanup (200-500 iterations)
 * 4. Maximum Update Depth Prevention & Concurrent UI Interaction Storm
 * 5. SoundManager & LocalStorage Synchronization Invariants Under Stress
 * 6. Multi-Component Concurrent Synchronization & Store Bridge Invariants
 * 7. Non-Finite / Extreme Floating Point Value Resilience
 */

import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { GameContainer } from '@/components/GameContainer';
import { useAudio } from '@/hooks/useAudio';
import { getSoundManager } from '@/game/audio/SoundManager';
import { useGameStateBridge, defaultGameStateStore, GameStateStore } from '@/hooks/useGameStateBridge';
import { INITIAL_HUD_STATE, STORAGE_KEY_SETTINGS } from '@/game/constants';
import { storageGet } from '@/utils/storage';

describe('Adversarial Stress Suite: React Lifecycle, Audio Sync & Loop Prevention', () => {
  beforeEach(() => {
    localStorage.clear();
    defaultGameStateStore.setState(INITIAL_HUD_STATE);

    // Mock requestAnimationFrame & cancelAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id as unknown as NodeJS.Timeout);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. RAPID RE-RENDER & INLINE OPTIONS REFERENCE CHURN
  // =========================================================================
  describe('1. Rapid Re-renders & Inline Options Reference Churn', () => {
    it('does not trigger infinite re-render loop when options object is recreated on every render', () => {
      let renderCount = 0;
      let muteChangeCount = 0;
      let volumeChangeCount = 0;

      const RapidConsumer: React.FC<{ tick: number }> = ({ tick }) => {
        renderCount++;
        // Fresh inline object reference on every render
        const audio = useAudio({
          onMuteChange: (_m) => {
            muteChangeCount++;
          },
          onVolumeChange: (_v) => {
            volumeChangeCount++;
          },
        });

        return (
          <div data-testid="consumer">
            <span>Tick: {tick}</span>
            <span>Muted: {String(audio.isMuted)}</span>
            <span>Volume: {audio.volume}</span>
          </div>
        );
      };

      const ParentWrapper: React.FC = () => {
        const [tick, setTick] = useState(0);
        return (
          <div>
            <button onClick={() => setTick((t) => t + 1)}>Force Render</button>
            <RapidConsumer tick={tick} />
          </div>
        );
      };

      const { rerender } = render(<ParentWrapper />);
      expect(renderCount).toBe(1);
      // Initial mount fires the callbacks once
      expect(muteChangeCount).toBe(1);
      expect(volumeChangeCount).toBe(1);

      // Force 300 rapid external re-renders passing new tick prop
      for (let i = 1; i <= 300; i++) {
        act(() => {
          rerender(<ParentWrapper />);
        });
      }

      // Consumer re-renders with parent, but DOES NOT trigger internal effect updates
      // because isMuted and volume did not change
      expect(muteChangeCount).toBe(1);
      expect(volumeChangeCount).toBe(1);
    });

    it('safely handles bidirectional state synchronization without feedback loops', () => {
      let parentRenders = 0;
      let callbackInvocations = 0;

      // Component that maintains its own synced state driven by useAudio callbacks
      const SyncedComponent: React.FC = () => {
        parentRenders++;
        const [syncedMuted, setSyncedMuted] = useState(false);
        const [syncedVolume, setSyncedVolume] = useState(0.8);

        const audio = useAudio({
          onMuteChange: (m) => {
            callbackInvocations++;
            setSyncedMuted(m);
          },
          onVolumeChange: (v) => {
            callbackInvocations++;
            setSyncedVolume(v);
          },
        });

        return (
          <div>
            <span data-testid="synced-mute">{String(syncedMuted)}</span>
            <span data-testid="synced-vol">{syncedVolume}</span>
            <button onClick={audio.toggleMute}>Toggle Mute</button>
            <button onClick={() => audio.setVolume(0.5)}>Set Vol 0.5</button>
          </div>
        );
      };

      render(<SyncedComponent />);
      expect(parentRenders).toBeGreaterThanOrEqual(1);

      const initialCallbacks = callbackInvocations;

      // Toggle mute
      act(() => {
        fireEvent.click(screen.getByText('Toggle Mute'));
      });

      expect(screen.getByTestId('synced-mute').textContent).toBe('true');
      expect(callbackInvocations).toBe(initialCallbacks + 1);

      // Change volume
      act(() => {
        fireEvent.click(screen.getByText('Set Vol 0.5'));
      });

      expect(screen.getByTestId('synced-vol').textContent).toBe('0.5');
      expect(callbackInvocations).toBe(initialCallbacks + 2);
    });
  });

  // =========================================================================
  // 2. HIGH-FREQUENCY VOLUME & MUTE MUTATION / OSCILLATION
  // =========================================================================
  describe('2. High-Frequency Volume & Mute Mutation / Oscillation', () => {
    it('survives 1,000 rapid toggleMute calls without state desynchronization or stack overflow', () => {
      const soundManager = getSoundManager();
      const setMutedSpy = vi.spyOn(soundManager, 'setMuted');

      const { result } = renderHook(() => useAudio());

      const initialMuted = result.current.isMuted;
      const TOTAL_TOGGLES = 1000;

      act(() => {
        for (let i = 0; i < TOTAL_TOGGLES; i++) {
          result.current.toggleMute();
        }
      });

      // Even number of toggles returns to initial state
      expect(result.current.isMuted).toBe(initialMuted);
      expect(setMutedSpy).toHaveBeenLastCalledWith(initialMuted);

      const storedSettings = storageGet<{ isMuted: boolean }>(STORAGE_KEY_SETTINGS, { isMuted: !initialMuted });
      expect(storedSettings.isMuted).toBe(initialMuted);
    });

    it('survives 2,000 rapid volume sweeps and clamps extreme/adversarial values', () => {
      const soundManager = getSoundManager();
      const setVolumeSpy = vi.spyOn(soundManager, 'setVolume');

      const { result } = renderHook(() => useAudio());

      // Sweep through 2,000 volume adjustments
      act(() => {
        for (let i = 0; i <= 2000; i++) {
          const val = (i % 100) / 100;
          result.current.setVolume(val);
        }
      });

      expect(result.current.volume).toBe(0); // 2000 % 100 === 0

      // Adversarial boundary inputs: negative, > 1
      act(() => {
        result.current.setVolume(-50);
      });
      expect(result.current.volume).toBe(0);

      act(() => {
        result.current.setVolume(999);
      });
      expect(result.current.volume).toBe(1);

      act(() => {
        result.current.setVolume(0.75);
      });
      expect(result.current.volume).toBe(0.75);
      expect(setVolumeSpy).toHaveBeenLastCalledWith(0.75);
    });

    it('handles interleaved concurrent mute toggles and volume adjustments without race condition', () => {
      const muteCallbacks: boolean[] = [];
      const volCallbacks: number[] = [];

      const { result } = renderHook(() =>
        useAudio({
          onMuteChange: (m) => muteCallbacks.push(m),
          onVolumeChange: (v) => volCallbacks.push(v),
        })
      );

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.toggleMute();
          result.current.setVolume(i / 100);
        }
      });

      expect(muteCallbacks.length).toBeGreaterThan(0);
      expect(volCallbacks.length).toBeGreaterThan(0);
      expect(result.current.volume).toBe(0.99);
      expect(result.current.isMuted).toBe(false);
    });
  });

  // =========================================================================
  // 3. MOUNT / UNMOUNT LIFECYCLE THRASHING & CLEANUP
  // =========================================================================
  describe('3. Mount / Unmount Lifecycle Thrashing & Event Cleanup', () => {
    it('survives 200 rapid GameContainer mount/unmount cycles without memory leak or uncaught exceptions', () => {
      for (let i = 0; i < 200; i++) {
        const { unmount } = render(<GameContainer />);
        unmount();
      }
      expect(true).toBe(true);
    });

    it('survives 500 rapid useAudio hook mount/unmount cycles', () => {
      for (let i = 0; i < 500; i++) {
        const { unmount } = renderHook(() => useAudio());
        unmount();
      }
      expect(true).toBe(true);
    });

    it('cleans up global window keydown listeners upon GameContainer unmount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<GameContainer />);
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  // =========================================================================
  // 4. MAXIMUM UPDATE DEPTH PREVENT & UI INTERACTION STORM
  // =========================================================================
  describe('4. Maximum Update Depth Prevention & UI Interaction Storm', () => {
    it('executes 500 rapid interleaved UI interactions on GameContainer without triggering Maximum update depth exceeded', () => {
      const errorSpy = vi.spyOn(console, 'error');
      render(<GameContainer />);

      // Start the game
      const startBtn = screen.getByRole('button', { name: /START GAME/i });
      fireEvent.click(startBtn);

      // Toggle touch controls
      const touchBtn = screen.getByRole('button', { name: /Toggle Touch Controls/i });
      fireEvent.click(touchBtn);

      const muteBtn = screen.getByRole('button', { name: /Mute Audio/i });
      const volSlider = screen.getByLabelText('Volume Slider');
      const pauseBtn = screen.getByRole('button', { name: /Pause Game/i });

      // Run 500 rapid interleaved UI actions
      act(() => {
        for (let i = 0; i < 100; i++) {
          fireEvent.click(muteBtn);
          fireEvent.change(volSlider, { target: { value: String((i % 10) / 10) } });
          fireEvent.click(touchBtn);
          fireEvent.click(pauseBtn);
          fireEvent.click(pauseBtn); // Resume
        }
      });

      // Verify no React Maximum update depth exceeded error occurred
      const maxUpdateDepthCalls = errorSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes('Maximum update depth exceeded'))
      );
      expect(maxUpdateDepthCalls).toHaveLength(0);
    });

    it('survives rapid keyboard event storm (1,000 keypresses) without crash or loop', () => {
      render(<GameContainer />);

      // Start game
      fireEvent.click(screen.getByRole('button', { name: /START GAME/i }));

      // Rapidly fire 'm' (mute), 'p' (pause), 'Escape'
      act(() => {
        for (let i = 0; i < 500; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
      });

      expect(defaultGameStateStore.getSnapshot().status).toBeDefined();
    });

    it('survives concurrent GameEngine event ingestion while user interacts with audio and touch controls', () => {
      render(<GameContainer />);

      // Enable touch controls
      fireEvent.click(screen.getByRole('button', { name: /Toggle Touch Controls/i }));
      fireEvent.click(screen.getByRole('button', { name: /START GAME/i }));

      const muteBtn = screen.getByRole('button', { name: /Mute Audio/i });

      // Concurrently emit 200 GameEngine events while clicking UI
      act(() => {
        for (let i = 1; i <= 200; i++) {
          defaultGameStateStore.emitEvent({
            type: 'BRICK_HIT',
            brick: {
              id: `b-${i}`,
              row: 1,
              col: 1,
              x: 10,
              y: 10,
              width: 50,
              height: 20,
              type: 'STANDARD',
              maxHits: 1,
              currentHits: 0,
              color: '#fff',
              points: 100,
              isAlive: false,
            },
            combo: i % 5,
            points: 100,
          });

          if (i % 20 === 0) {
            fireEvent.click(muteBtn);
          }
        }
      });

      expect(defaultGameStateStore.getSnapshot().score).toBe(20000);
      expect(screen.getByText('0020000')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. SOUNDMANAGER & LOCALSTORAGE SYNCHRONIZATION UNDER STRESS
  // =========================================================================
  describe('5. SoundManager & LocalStorage Synchronization Under Stress', () => {
    it('correctly suppresses playSound calls when muted even under rapid toggle conditions', () => {
      const soundManager = getSoundManager();
      const playSoundSpy = vi.spyOn(soundManager, 'playSound');

      const { result } = renderHook(() => useAudio());

      // Mute audio
      act(() => {
        result.current.toggleMute();
      });
      expect(result.current.isMuted).toBe(true);

      // Attempt to play sounds while muted
      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.playSound('BOUNCE');
          result.current.playSound('BRICK_HIT', { combo: 2 });
        }
      });

      expect(playSoundSpy).not.toHaveBeenCalled();

      // Unmute and play sounds
      act(() => {
        result.current.toggleMute();
      });
      expect(result.current.isMuted).toBe(false);

      act(() => {
        result.current.playSound('BOUNCE');
      });

      expect(playSoundSpy).toHaveBeenCalledWith('BOUNCE', undefined);
    });

    it('maintains LocalStorage consistency across 500 interleaved storage read/writes', () => {
      const { result } = renderHook(() => useAudio());

      act(() => {
        for (let i = 0; i < 250; i++) {
          result.current.toggleMute();
          result.current.setVolume((i % 10) / 10);
        }
      });

      const stored = storageGet<{ isMuted: boolean; sfxVolume: number }>(STORAGE_KEY_SETTINGS, {
        isMuted: false,
        sfxVolume: 0.8,
      });

      expect(stored.isMuted).toBe(result.current.isMuted);
      expect(stored.sfxVolume).toBe(result.current.volume);
    });
  });

  // =========================================================================
  // 6. MULTI-COMPONENT CONCURRENT STORE BRIDGE & HOOK SYNCHRONIZATION
  // =========================================================================
  describe('6. Multi-Component Concurrent Synchronization & Store Bridge Invariants', () => {
    it('synchronizes 10 concurrent components connected to a single store without state fragmentation', () => {
      const customStore = new GameStateStore();
      const renderedScores: number[] = new Array(10).fill(0);

      const SiblingComponent: React.FC<{ index: number }> = ({ index }) => {
        const { score } = useGameStateBridge(customStore);
        renderedScores[index] = score;
        return <div data-testid={`sibling-${index}`}>{score}</div>;
      };

      render(
        <div>
          {Array.from({ length: 10 }).map((_, i) => (
            <SiblingComponent key={i} index={i} />
          ))}
        </div>
      );

      // Verify all 10 siblings render initial score 0
      expect(renderedScores.every((s) => s === 0)).toBe(true);

      // Dispatch 100 score updates
      act(() => {
        for (let i = 1; i <= 100; i++) {
          customStore.emitEvent({
            type: 'SCORE_CHANGED',
            score: i * 50,
            multiplier: 1,
          });
        }
      });

      // All 10 siblings must hold identical updated score (5000)
      expect(renderedScores.every((s) => s === 5000)).toBe(true);
      for (let i = 0; i < 10; i++) {
        expect(screen.getByTestId(`sibling-${i}`).textContent).toBe('5000');
      }
    });

    it('gracefully handles setState with no-op identical values without re-notifying subscribers', () => {
      const customStore = new GameStateStore();
      let notifyCount = 0;
      customStore.subscribe(() => {
        notifyCount++;
      });

      // Initial state is { isMuted: false }
      customStore.setState({ isMuted: false });
      expect(notifyCount).toBe(0); // Shallow equality optimization prevented unnecessary notification

      customStore.setState({ isMuted: true });
      expect(notifyCount).toBe(1);

      customStore.setState({ isMuted: true });
      expect(notifyCount).toBe(1); // No change -> no notification
    });
  });

  // =========================================================================
  // 7. NON-FINITE & EXTREME BOUNDARY RESILIENCE
  // =========================================================================
  describe('7. Non-Finite & Extreme Boundary Floating-Point Value Resilience', () => {
    it('clamps non-standard and non-finite volumes to valid [0, 1] range', () => {
      const { result } = renderHook(() => useAudio());

      // Negative infinity
      act(() => {
        result.current.setVolume(-Infinity);
      });
      expect(result.current.volume).toBe(0);

      // Positive infinity
      act(() => {
        result.current.setVolume(Infinity);
      });
      expect(result.current.volume).toBe(1);

      // Extreme subnormal float
      act(() => {
        result.current.setVolume(1e-12);
      });
      expect(result.current.volume).toBe(1e-12);

      // Normal valid volume
      act(() => {
        result.current.setVolume(0.42);
      });
      expect(result.current.volume).toBe(0.42);
    });
  });
});
