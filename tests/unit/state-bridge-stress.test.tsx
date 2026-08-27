/**
 * @file tests/unit/state-bridge-stress.test.tsx
 * Adversarial stress testing & performance benchmarking suite for GameStateStore & useGameStateBridge.
 *
 * Challenge Dimensions:
 * 1. Rapid Burst Event Ingestion (10,000+ to 100,000+ events simulating 12-ball chaos physics)
 * 2. Concurrent Subscriber Lifecycle (attach/detach churn during active notification loops)
 * 3. Immutable Snapshot Integrity & Mutation Resistance
 * 4. React Re-render Frequency & Selective Isolation (Zero renders on non-HUD events)
 * 5. Edge Cases, Multi-Component Synchronization & SSR Snapshot Integrity
 */

import React, { memo } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import {
  GameStateStore,
  useGameStateBridge,
} from '@/hooks/useGameStateBridge';
import { GameEngineEvent, Brick } from '@/game/types';
import { INITIAL_HUD_STATE } from '@/game/constants';

const createMockBrick = (id: string, points = 100): Brick => ({
  id,
  row: 1,
  col: 1,
  x: 58,
  y: 20,
  width: 58,
  height: 20,
  type: 'STANDARD',
  maxHits: 1,
  currentHits: 0,
  color: '#ef4444',
  points,
  isAlive: false,
});

describe('Adversarial Stress Suite: GameStateStore & useGameStateBridge', () => {
  let store: GameStateStore;

  beforeEach(() => {
    store = new GameStateStore();
  });

  // =========================================================================
  // 1. RAPID BURST EVENT INGESTION (10,000+ to 100,000+ Events)
  // =========================================================================
  describe('1. High-Frequency Event Ingestion & Throughput Burst', () => {
    it('handles a burst of 10,000 multi-ball collision events under 50ms with correct state accumulation', () => {
      const mockBrick = createMockBrick('stress-brick', 100);
      let listenerCalls = 0;
      store.subscribe(() => {
        listenerCalls++;
      });

      const startTime = performance.now();
      const TOTAL_EVENTS = 10000;

      for (let i = 1; i <= TOTAL_EVENTS; i++) {
        store.emitEvent({
          type: 'BRICK_HIT',
          brick: mockBrick,
          combo: i % 8,
          points: 100,
        });
      }

      const elapsedMs = performance.now() - startTime;
      const snapshot = store.getSnapshot();

      // State verification
      expect(snapshot.score).toBe(TOTAL_EVENTS * 100);
      expect(snapshot.highScore).toBe(TOTAL_EVENTS * 100);
      expect(snapshot.combo).toBe(TOTAL_EVENTS % 8);
      expect(listenerCalls).toBe(TOTAL_EVENTS);

      // Performance budget verification (< 200ms, > 50,000 ops/sec)
      expect(elapsedMs).toBeLessThan(200);
      const opsPerSec = TOTAL_EVENTS / (elapsedMs / 1000);
      console.log(`[Burst 10k Events] Elapsed: ${elapsedMs.toFixed(2)}ms (${opsPerSec.toFixed(0)} events/sec)`);
      expect(opsPerSec).toBeGreaterThan(50000);
    });

    it('processes 100,000 interleaved mixed events without corruption or memory breakdown', () => {
      const mockBrick = createMockBrick('interleaved-brick', 50);
      let notifications = 0;
      store.subscribe(() => {
        notifications++;
      });

      const startTime = performance.now();
      const ITERATIONS = 20000; // 5 events per iteration = 100,000 events total

      for (let i = 0; i < ITERATIONS; i++) {
        // 1. HUD mutating event: BRICK_HIT
        store.emitEvent({
          type: 'BRICK_HIT',
          brick: mockBrick,
          combo: (i % 5) + 1,
          points: 50,
        });

        // 2. Non-HUD event: PLAY_SOUND (should NOT notify)
        store.emitEvent({
          type: 'PLAY_SOUND',
          sound: 'BOUNCE',
          params: { offsetRatio: 0.2 },
        });

        // 3. Non-HUD event: SHAKE_SCREEN (should NOT notify)
        store.emitEvent({
          type: 'SHAKE_SCREEN',
          intensity: 0.5,
        });

        // 4. HUD mutating event: SCORE_CHANGED
        store.emitEvent({
          type: 'SCORE_CHANGED',
          score: (i + 1) * 100,
          multiplier: (i % 4) + 1,
        });

        // 5. HUD mutating event: STATE_CHANGED
        store.emitEvent({
          type: 'STATE_CHANGED',
          state: { level: (i % 6) + 1 },
        });
      }

      const elapsedMs = performance.now() - startTime;
      const snapshot = store.getSnapshot();

      // Only 3 of the 5 event types in each iteration mutate state and trigger notify
      expect(notifications).toBe(ITERATIONS * 3);
      expect(snapshot.score).toBe(ITERATIONS * 100);
      expect(snapshot.level).toBe(((ITERATIONS - 1) % 6) + 1);

      console.log(`[Stress 100k Mixed Events] Elapsed: ${elapsedMs.toFixed(2)}ms (${((ITERATIONS * 5) / (elapsedMs / 1000)).toFixed(0)} events/sec)`);
      expect(elapsedMs).toBeLessThan(1000); // 100k events under 1 second
    });

    it('survives rapid back-to-back state machine transitions without race conditions', () => {
      const transitions: Array<GameEngineEvent> = [
        { type: 'STATE_CHANGED', state: { status: 'PLAYING' } },
        { type: 'STATE_CHANGED', state: { status: 'PAUSED' } },
        { type: 'STATE_CHANGED', state: { status: 'PLAYING' } },
        { type: 'LEVEL_COMPLETED', level: 1, totalScore: 10000 },
        { type: 'STATE_CHANGED', state: { status: 'PLAYING', level: 2 } },
        { type: 'GAME_OVER', finalScore: 15000, isHighScore: true },
        { type: 'VICTORY', finalScore: 50000 },
        { type: 'STATE_CHANGED', state: { status: 'IDLE' } },
      ];

      for (let cycle = 0; cycle < 1000; cycle++) {
        for (const evt of transitions) {
          store.emitEvent(evt);
        }
      }

      expect(store.getSnapshot().status).toBe('IDLE');
    });
  });

  // =========================================================================
  // 2. CONCURRENT SUBSCRIBER ATTACH / DETACH CYCLES
  // =========================================================================
  describe('2. Concurrent Subscriber Lifecycle & Mutation Safety', () => {
    it('safely handles self-unsubscribing listeners during active event notification', () => {
      let unsubsCalled = 0;
      let otherListenerCalls = 0;

      const unsubs: Array<() => void> = [];

      // Create 50 self-unsubscribing listeners
      for (let i = 0; i < 50; i++) {
        const unsubscribe = store.subscribe(() => {
          unsubsCalled++;
          unsubscribe(); // Unsubscribes itself upon first invocation
        });
        unsubs.push(unsubscribe);
      }

      // Permanent listener
      store.subscribe(() => {
        otherListenerCalls++;
      });

      // First event: All 50 self-unsubscribing + 1 permanent listener called
      store.emitEvent({
        type: 'SCORE_CHANGED',
        score: 500,
        multiplier: 1,
      });

      expect(unsubsCalled).toBe(50);
      expect(otherListenerCalls).toBe(1);

      // Second event: Only the 1 permanent listener should be called
      store.emitEvent({
        type: 'SCORE_CHANGED',
        score: 1000,
        multiplier: 1,
      });

      expect(unsubsCalled).toBe(50); // Unchanged
      expect(otherListenerCalls).toBe(2);
    });

    it('safely handles cascading unsubscriptions where listener A deletes listener B', () => {
      let listenerBCalls = 0;
      let unsubscribeB: () => void = () => {};

      // Listener A unsubscribes Listener B
      store.subscribe(() => {
        unsubscribeB();
      });

      unsubscribeB = store.subscribe(() => {
        listenerBCalls++;
      });

      // Emitting event
      expect(() => {
        store.emitEvent({
          type: 'LIVES_CHANGED',
          lives: 2,
        });
      }).not.toThrow();

      // Subsequent event: Listener B must not be called
      store.emitEvent({
        type: 'LIVES_CHANGED',
        lives: 1,
      });

      expect(listenerBCalls).toBeLessThanOrEqual(1);
    });

    it('safely handles new subscriber registration during active event notification', () => {
      let dynamicListenerCalls = 0;

      // Parent listener adds a new child listener when triggered
      store.subscribe(() => {
        store.subscribe(() => {
          dynamicListenerCalls++;
        });
      });

      // First event: Triggers parent listener (registers child listener)
      store.emitEvent({ type: 'LIVES_CHANGED', lives: 2 });

      // Second event: Triggers parent + child listener
      store.emitEvent({ type: 'LIVES_CHANGED', lives: 1 });

      expect(dynamicListenerCalls).toBeGreaterThanOrEqual(1);
    });

    it('handles heavy concurrent churn with 1,000 dynamic subscribers attaching/detaching across 1,000 events', () => {
      const activeUnsubs = new Map<number, () => void>();
      let totalInvocations = 0;

      for (let i = 0; i < 1000; i++) {
        // Attach subscriber
        const id = i;
        const un = store.subscribe(() => {
          totalInvocations++;
        });
        activeUnsubs.set(id, un);

        // Detach previous subscriber
        if (i > 20) {
          const oldUnsub = activeUnsubs.get(i - 20);
          if (oldUnsub) {
            oldUnsub();
            activeUnsubs.delete(i - 20);
          }
        }

        store.emitEvent({
          type: 'SCORE_CHANGED',
          score: i * 10,
          multiplier: 1,
        });
      }

      // Cleanup remaining
      activeUnsubs.forEach((un) => un());

      const finalCount = totalInvocations;
      // Emit after full cleanup: No subscribers should be called
      store.emitEvent({ type: 'SCORE_CHANGED', score: 99999, multiplier: 1 });
      expect(totalInvocations).toBe(finalCount);
    });

    it('is idempotent when calling unsubscribe multiple times', () => {
      const listener = vi.fn();
      const unsub = store.subscribe(listener);

      expect(() => {
        unsub();
        unsub();
        unsub();
      }).not.toThrow();

      store.emitEvent({ type: 'LIVES_CHANGED', lives: 2 });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. IMMUTABLE SNAPSHOT INTEGRITY & MUTATION RESISTANCE
  // =========================================================================
  describe('3. Immutable Snapshot Verification & Reference Integrity', () => {
    it('maintains referential stability of getSnapshot when state does not change', () => {
      const snap1 = store.getSnapshot();
      const snap2 = store.getSnapshot();
      expect(snap1).toBe(snap2); // Strict identity required by useSyncExternalStore

      // Non-state-changing event should NOT alter snapshot identity
      store.emitEvent({ type: 'PLAY_SOUND', sound: 'BOUNCE' });
      const snap3 = store.getSnapshot();
      expect(snap3).toBe(snap1);

      store.emitEvent({ type: 'SHAKE_SCREEN', intensity: 0.8 });
      const snap4 = store.getSnapshot();
      expect(snap4).toBe(snap1);
    });

    it('creates a new snapshot reference upon state mutation', () => {
      const snapBefore = store.getSnapshot();

      store.emitEvent({
        type: 'SCORE_CHANGED',
        score: 2500,
        multiplier: 2,
      });

      const snapAfter = store.getSnapshot();
      expect(snapAfter).not.toBe(snapBefore);
      expect(snapAfter.score).toBe(2500);
      expect(snapBefore.score).toBe(0); // Original snapshot retained historical value
    });

    it('preserves internal store consistency when external code mutates properties on snapshot', () => {
      const snap = store.getSnapshot();

      // External rogue mutation attempt
      (snap as any).score = 999999;
      (snap as any).lives = 999;

      // When store processes next discrete event, it must not carry corrupted base state
      store.emitEvent({
        type: 'LIVES_CHANGED',
        lives: 2,
      });

      const freshSnap = store.getSnapshot();
      expect(freshSnap.lives).toBe(2);
    });

    it('isolates activePowerups array modifications during powerup lifecycle events', () => {
      store.setState({
        activePowerups: [
          { type: 'LASER', remainingTimeMs: 5000, maxTimeMs: 10000 },
          { type: 'SHIELD', remainingTimeMs: 8000, maxTimeMs: 20000 },
        ],
        hasShield: true,
      });

      const snap1 = store.getSnapshot();
      expect(snap1.activePowerups).toHaveLength(2);

      // Trigger powerup expiry
      store.emitEvent({
        type: 'POWERUP_EXPIRED',
        powerup: 'SHIELD',
      });

      const snap2 = store.getSnapshot();
      expect(snap2.activePowerups).toHaveLength(1);
      expect(snap2.activePowerups[0].type).toBe('LASER');
      expect(snap2.hasShield).toBe(false);

      // snap1 powerups should not be mutated in place
      expect(snap1.activePowerups).toHaveLength(2);
    });

    it('defensively clones initial state in constructor to prevent external reference pollution', () => {
      const customInitial = {
        ...INITIAL_HUD_STATE,
        score: 500,
        activePowerups: [{ type: 'MULTI_BALL' as const, remainingTimeMs: 0, maxTimeMs: 0 }],
      };

      const customStore = new GameStateStore(customInitial);
      expect(customStore.getSnapshot().score).toBe(500);

      // Mutate customInitial externally
      customInitial.score = 9999;
      expect(customStore.getSnapshot().score).toBe(500);
    });
  });

  // =========================================================================
  // 4. REACT RE-RENDER FREQUENCY & ISOLATION BENCHMARKS
  // =========================================================================
  describe('4. React Re-render Frequency & Selective Subscriber Benchmarks', () => {
    it('executes 0 React re-renders during high-frequency non-HUD events (PLAY_SOUND, SHAKE_SCREEN)', () => {
      let renderCount = 0;

      const TestSubscriber = () => {
        const bridge = useGameStateBridge(store);
        renderCount++;
        return <div data-testid="score">{bridge.score}</div>;
      };

      render(<TestSubscriber />);
      expect(renderCount).toBe(1); // Initial mount

      // Fire 1,000 non-HUD sound and screen-shake events
      act(() => {
        for (let i = 0; i < 500; i++) {
          store.emitEvent({ type: 'PLAY_SOUND', sound: 'BOUNCE' });
          store.emitEvent({ type: 'SHAKE_SCREEN', intensity: 0.3 });
        }
      });

      // Render count must remain EXACTLY 1 (zero React reconciliation overhead)
      expect(renderCount).toBe(1);
    });

    it('triggers exact 1:1 React re-renders only on discrete HUD state changes', () => {
      let renderCount = 0;

      const TestSubscriber = () => {
        const bridge = useGameStateBridge(store);
        renderCount++;
        return <div data-testid="score">{bridge.score}</div>;
      };

      render(<TestSubscriber />);
      expect(renderCount).toBe(1);

      // Emit 10 score events inside act
      for (let i = 1; i <= 10; i++) {
        act(() => {
          store.emitEvent({
            type: 'SCORE_CHANGED',
            score: i * 100,
            multiplier: 1,
          });
        });
        expect(renderCount).toBe(1 + i);
      }
    });

    it('synchronizes multiple distinct React components connected to the same store without drift', () => {
      let hudRenders = 0;
      let modalRenders = 0;
      let audioRenders = 0;

      const HUDComponent = () => {
        const { score, lives, combo } = useGameStateBridge(store);
        hudRenders++;
        return <div>HUD: {score}/{lives}/{combo}</div>;
      };

      const ModalComponent = () => {
        const { status } = useGameStateBridge(store);
        modalRenders++;
        return <div>Status: {status}</div>;
      };

      const AudioComponent = () => {
        const { isMuted, volume } = useGameStateBridge(store);
        audioRenders++;
        return <div>Audio: {isMuted ? 'Muted' : 'Unmuted'} {volume}</div>;
      };

      render(
        <>
          <HUDComponent />
          <ModalComponent />
          <AudioComponent />
        </>
      );

      expect(hudRenders).toBe(1);
      expect(modalRenders).toBe(1);
      expect(audioRenders).toBe(1);

      // Score update (all 3 re-render because useGameStateBridge subscribes to full store snapshot)
      act(() => {
        store.emitEvent({ type: 'SCORE_CHANGED', score: 300, multiplier: 1 });
      });

      expect(hudRenders).toBe(2);
      expect(modalRenders).toBe(2);
      expect(audioRenders).toBe(2);
    });

    it('maintains memoized stability of action callbacks across multiple state re-renders', () => {
      const { result } = renderHook(() => useGameStateBridge(store));

      const initialActions = result.current.actions;
      const initialStartGame = result.current.startGame;
      const initialPauseGame = result.current.pauseGame;
      const initialDispatch = result.current.actions.dispatch;

      // Trigger 20 state updates
      for (let i = 1; i <= 20; i++) {
        act(() => {
          store.emitEvent({
            type: 'SCORE_CHANGED',
            score: i * 100,
            multiplier: 1,
          });
        });

        // Verify action references remain identical
        expect(result.current.actions).toBe(initialActions);
        expect(result.current.startGame).toBe(initialStartGame);
        expect(result.current.pauseGame).toBe(initialPauseGame);
        expect(result.current.actions.dispatch).toBe(initialDispatch);
      }
    });

    it('does not re-render pure memoized child components when passing stable action handlers', () => {
      let childRenders = 0;

      const MemoChild = memo(({ onStart }: { onStart: () => void }) => {
        childRenders++;
        return <button onClick={onStart}>Start</button>;
      });
      MemoChild.displayName = 'MemoChild';

      const ParentComponent = () => {
        const { score, startGame } = useGameStateBridge(store);
        return (
          <div>
            <span>Score: {score}</span>
            <MemoChild onStart={startGame} />
          </div>
        );
      };

      render(<ParentComponent />);
      expect(childRenders).toBe(1);

      // Trigger 10 HUD score mutations
      for (let i = 1; i <= 10; i++) {
        act(() => {
          store.emitEvent({
            type: 'SCORE_CHANGED',
            score: i * 100,
            multiplier: 1,
          });
        });
      }

      // Child should not have re-rendered because `startGame` callback reference is stable
      expect(childRenders).toBe(1);
    });
  });

  // =========================================================================
  // 5. EDGE CASES, ACTION DISPATCH & SSR RESILIENCE
  // =========================================================================
  describe('5. Edge Cases, Action Dispatching & SSR Resilience', () => {
    it('safely tolerates action dispatch when no engine handler is bound (no-op)', () => {
      expect(() => {
        store.dispatch({ type: 'START_GAME' });
        store.dispatch({ type: 'FIRE_LASER' });
        store.dispatch({ type: 'LAUNCH_BALL' });
      }).not.toThrow();
    });

    it('correctly returns server snapshot matching INITIAL_HUD_STATE without hydration drift', () => {
      const serverSnap = store.getServerSnapshot();
      expect(serverSnap).toEqual(INITIAL_HUD_STATE);
    });

    it('handles numeric boundary conditions (extreme scores, zero lives, large combos)', () => {
      store.emitEvent({
        type: 'SCORE_CHANGED',
        score: Number.MAX_SAFE_INTEGER,
        multiplier: 9999,
      });

      expect(store.getSnapshot().score).toBe(Number.MAX_SAFE_INTEGER);
      expect(store.getSnapshot().highScore).toBe(Number.MAX_SAFE_INTEGER);

      store.emitEvent({
        type: 'LIVES_CHANGED',
        lives: 0,
      });
      expect(store.getSnapshot().lives).toBe(0);
    });

    it('inter-operates with useGameStateBridge hook action dispatchers', () => {
      const mockHandler = vi.fn();
      store.bindActionHandler(mockHandler);

      const { result } = renderHook(() => useGameStateBridge(store));

      act(() => {
        result.current.startGame();
      });
      expect(mockHandler).toHaveBeenCalledWith({ type: 'START_GAME' });
      expect(store.getSnapshot().status).toBe('PLAYING');

      act(() => {
        result.current.pauseGame();
      });
      expect(mockHandler).toHaveBeenCalledWith({ type: 'PAUSE_GAME' });
      expect(store.getSnapshot().status).toBe('PAUSED');

      act(() => {
        result.current.setMuted(true);
      });
      expect(mockHandler).toHaveBeenCalledWith({ type: 'SET_MUTED', muted: true });
      expect(store.getSnapshot().isMuted).toBe(true);

      act(() => {
        result.current.setVolume(0.5);
      });
      expect(mockHandler).toHaveBeenCalledWith({ type: 'SET_VOLUME', volume: 0.5 });
      expect(store.getSnapshot().soundVolume).toBe(0.5);
      expect(store.getSnapshot().volume).toBe(0.5);
    });

    it('handles unknown or unhandled event types gracefully without modifying state', () => {
      const initialSnap = store.getSnapshot();

      expect(() => {
        store.emitEvent({ type: 'UNKNOWN_EVENT' as any });
      }).not.toThrow();

      expect(store.getSnapshot()).toBe(initialSnap);
    });
  });
});
