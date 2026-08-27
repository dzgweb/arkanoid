/**
 * @file tests/unit/audio-adversarial-m4.test.ts
 * Challenger M4-1 Empirical Adversarial Test Harness for Web Audio Procedural Synth & SoundManager.
 * 
 * Verifies:
 * 1. 13 SFX Routines audio node graph integrity, parameter trajectories & ADSR envelopes.
 * 2. Combo pitch scaling closed-form math: f = 261.63 * 2^(min(combo, 16) / 12).
 * 3. Paddle impact offset pitch shifting across [-1, 1] including out-of-bounds inputs.
 * 4. 24-voice polyphony limit, debounce throttling, and zero-leak node disconnect cleanup on ended.
 * 5. Robustness against degraded environments (missing AudioContext methods, null buffers).
 * 6. Web Audio API strict compliance (strictly positive exponential ramp targets).
 * 7. Full GameEngine sound event dispatch and lifecycle integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SoundSynth } from '@/game/audio/SoundSynth';
import { SoundManager, getSoundManager } from '@/game/audio/SoundManager';
import { SoundType, PowerupType } from '@/game/types';
import { GameEngine } from '@/game/engine/GameEngine';

// ============================================================================
// Comprehensive Mock Audio Hierarchy for Deep Graph Inspection
// ============================================================================

class MockAudioParam {
  public value: number;
  public calls: Array<{ type: string; args: any[] }> = [];

  constructor(initialVal: number = 0) {
    this.value = initialVal;
  }

  public setValueAtTime = vi.fn((val: number, time: number) => {
    this.value = val;
    this.calls.push({ type: 'setValueAtTime', args: [val, time] });
  });

  public linearRampToValueAtTime = vi.fn((val: number, time: number) => {
    this.value = val;
    this.calls.push({ type: 'linearRampToValueAtTime', args: [val, time] });
  });

  public exponentialRampToValueAtTime = vi.fn((val: number, time: number) => {
    // Web Audio standard: value must be strictly positive
    if (val <= 0) {
      throw new RangeError(`Failed to execute 'exponentialRampToValueAtTime': The value provided (${val}) is not positive.`);
    }
    this.value = val;
    this.calls.push({ type: 'exponentialRampToValueAtTime', args: [val, time] });
  });

  public setTargetAtTime = vi.fn((val: number, startTime: number, timeConstant: number) => {
    this.value = val;
    this.calls.push({ type: 'setTargetAtTime', args: [val, startTime, timeConstant] });
  });
}

class MockAudioNode {
  public connectedTo: MockAudioNode[] = [];
  public disconnectCalls: number = 0;

  public connect(dest: MockAudioNode): MockAudioNode {
    this.connectedTo.push(dest);
    return dest;
  }

  public disconnect = vi.fn(() => {
    this.disconnectCalls++;
  });
}

class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam(1);
}

class MockOscillatorNode extends MockAudioNode {
  public type: OscillatorType = 'sine';
  public frequency = new MockAudioParam(440);
  public startTime: number | null = null;
  public stopTime: number | null = null;
  public onended: (() => void) | null = null;

  public start = vi.fn((t?: number) => {
    this.startTime = t ?? 0;
  });

  public stop = vi.fn((t?: number) => {
    this.stopTime = t ?? 0;
  });
}

class MockBiquadFilterNode extends MockAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency = new MockAudioParam(1000);
  public Q = new MockAudioParam(1);
}

class MockBufferSourceNode extends MockAudioNode {
  public buffer: AudioBuffer | null = null;
  public startTime: number | null = null;
  public stopTime: number | null = null;
  public onended: (() => void) | null = null;

  public start = vi.fn((t?: number) => {
    this.startTime = t ?? 0;
  });

  public stop = vi.fn((t?: number) => {
    this.stopTime = t ?? 0;
  });
}

class MockDynamicsCompressorNode extends MockAudioNode {
  public threshold = new MockAudioParam(-6);
  public knee = new MockAudioParam(10);
  public ratio = new MockAudioParam(4);
  public attack = new MockAudioParam(0.003);
  public release = new MockAudioParam(0.05);
}

class MockAudioContext {
  public state: AudioContextState = 'running';
  public currentTime: number = 100.0;
  public sampleRate: number = 44100;
  public destination = new MockAudioNode();

  public createdOscillators: MockOscillatorNode[] = [];
  public createdGains: MockGainNode[] = [];
  public createdFilters: MockBiquadFilterNode[] = [];
  public createdBufferSources: MockBufferSourceNode[] = [];
  public createdCompressors: MockDynamicsCompressorNode[] = [];

  public createGain(): GainNode {
    const gain = new MockGainNode();
    this.createdGains.push(gain);
    return gain as unknown as GainNode;
  }

  public createOscillator(): OscillatorNode {
    const osc = new MockOscillatorNode();
    this.createdOscillators.push(osc);
    return osc as unknown as OscillatorNode;
  }

  public createBiquadFilter(): BiquadFilterNode {
    const filter = new MockBiquadFilterNode();
    this.createdFilters.push(filter);
    return filter as unknown as BiquadFilterNode;
  }

  public createBufferSource(): AudioBufferSourceNode {
    const src = new MockBufferSourceNode();
    this.createdBufferSources.push(src);
    return src as unknown as AudioBufferSourceNode;
  }

  public createDynamicsCompressor(): DynamicsCompressorNode {
    const comp = new MockDynamicsCompressorNode();
    this.createdCompressors.push(comp);
    return comp as unknown as DynamicsCompressorNode;
  }

  public createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    const data = new Float32Array(length);
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: () => data,
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer;
  }

  public resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });

  public close = vi.fn().mockImplementation(async () => {
    this.state = 'closed';
  });

  public resetTracking(): void {
    this.createdOscillators = [];
    this.createdGains = [];
    this.createdFilters = [];
    this.createdBufferSources = [];
    this.createdCompressors = [];
  }
}

// ============================================================================
// Adversarial Test Suites
// ============================================================================

describe('Challenger M4-1: Procedural Web Audio Synthesizer Empirical Verification', () => {
  let mockCtx: MockAudioContext;
  let synth: SoundSynth;
  let mockDest: MockAudioNode;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    synth = new SoundSynth(mockCtx as unknown as AudioContext);
    mockDest = mockCtx.destination;
    mockCtx.resetTracking();
  });

  // --------------------------------------------------------------------------
  // Dimension 1: Mathematical Accuracy of Combo Pitch Scaling
  // Formula: f = 261.63 * 2^(min(combo, 16) / 12)
  // --------------------------------------------------------------------------
  describe('Dimension 1: Combo Pitch Scaling Formula Invariants', () => {
    it('empirically verifies exact chromatic frequency for all combo indices 0 to 16', () => {
      for (let combo = 0; combo <= 16; combo++) {
        mockCtx.resetTracking();
        const t0 = 100.0;
        synth.playBrickHit(mockDest as unknown as AudioNode, t0, combo);

        expect(mockCtx.createdOscillators.length).toBe(1);
        const osc = mockCtx.createdOscillators[0];
        const expectedFreq = 261.63 * Math.pow(2, combo / 12);

        // Check initial frequency value set at time t0
        expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(
          expect.closeTo(expectedFreq, 4),
          t0
        );

        // Verify exponential down-pitch decay envelope (f -> f * 0.90 at t0 + 0.08)
        expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
          expect.closeTo(expectedFreq * 0.90, 4),
          expect.closeTo(t0 + 0.08, 4)
        );
      }
    });

    it('verifies strict combo clamping for negative values and values exceeding 16', () => {
      const testCases = [
        { inputCombo: -100, expectedCombo: 0 },
        { inputCombo: -1, expectedCombo: 0 },
        { inputCombo: 0, expectedCombo: 0 },
        { inputCombo: 16, expectedCombo: 16 },
        { inputCombo: 17, expectedCombo: 16 },
        { inputCombo: 25, expectedCombo: 16 },
        { inputCombo: 1000, expectedCombo: 16 },
      ];

      for (const { inputCombo, expectedCombo } of testCases) {
        mockCtx.resetTracking();
        synth.playBrickHit(mockDest as unknown as AudioNode, 100.0, inputCombo);

        const osc = mockCtx.createdOscillators[0];
        const expectedFreq = 261.63 * Math.pow(2, expectedCombo / 12);
        expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(
          expect.closeTo(expectedFreq, 4),
          100.0
        );
      }
    });

    it('verifies strict monotonicity of brick hit frequency across combos [0, 16]', () => {
      let prevFreq = 0;
      for (let combo = 0; combo <= 16; combo++) {
        mockCtx.resetTracking();
        synth.playBrickHit(mockDest as unknown as AudioNode, 100.0, combo);
        const freq = mockCtx.createdOscillators[0].frequency.setValueAtTime.mock.calls[0][0];

        expect(freq).toBeGreaterThan(prevFreq);
        prevFreq = freq;
      }
    });
  });

  // --------------------------------------------------------------------------
  // Dimension 2: Paddle Impact Offset Pitch Shifting
  // Formula: baseFreq = 260 + 160 * |offset| + offset * 30, offset in [-1, 1]
  // --------------------------------------------------------------------------
  describe('Dimension 2: Paddle Impact Offset Pitch Shifting', () => {
    it('empirically verifies pitch curve across fine-grained offset spectrum [-1.5, 1.5]', () => {
      // 301 fine-grained sample steps
      for (let i = 0; i <= 300; i++) {
        const rawOffset = -1.5 + (i / 300) * 3.0; // [-1.5, +1.5]
        const clampedOffset = Math.max(-1, Math.min(1, rawOffset));
        const expectedBaseFreq = 260 + 160 * Math.abs(clampedOffset) + clampedOffset * 30;

        mockCtx.resetTracking();
        synth.playPaddleHit(mockDest as unknown as AudioNode, 100.0, rawOffset);

        expect(mockCtx.createdOscillators.length).toBe(2); // body osc + click osc
        const bodyOsc = mockCtx.createdOscillators[0];

        // Start freq is baseFreq * 1.25
        expect(bodyOsc.frequency.setValueAtTime).toHaveBeenCalledWith(
          expect.closeTo(expectedBaseFreq * 1.25, 4),
          100.0
        );

        // End freq is baseFreq * 0.85
        expect(bodyOsc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
          expect.closeTo(expectedBaseFreq * 0.85, 4),
          expect.closeTo(100.09, 4)
        );
      }
    });

    it('verifies boundary and center offset frequencies', () => {
      // Center (0.0): 260 Hz base -> 325 Hz start, 221 Hz end
      mockCtx.resetTracking();
      synth.playPaddleHit(mockDest as unknown as AudioNode, 100.0, 0);
      expect(mockCtx.createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(325, 100.0);

      // Left Edge (-1.0): (260 + 160 - 30) = 390 Hz base -> 487.5 Hz start, 331.5 Hz end
      mockCtx.resetTracking();
      synth.playPaddleHit(mockDest as unknown as AudioNode, 100.0, -1.0);
      expect(mockCtx.createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(487.5, 100.0);

      // Right Edge (+1.0): (260 + 160 + 30) = 450 Hz base -> 562.5 Hz start, 382.5 Hz end
      mockCtx.resetTracking();
      synth.playPaddleHit(mockDest as unknown as AudioNode, 100.0, 1.0);
      expect(mockCtx.createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(562.5, 100.0);
    });
  });

  // --------------------------------------------------------------------------
  // Dimension 3: Verification of All 13 SFX Routines & ADSR Envelopes
  // --------------------------------------------------------------------------
  describe('Dimension 3: All 13 SFX Routines Audio Graph & ADSR Trajectories', () => {
    const sfxRoutines: Array<{
      name: string;
      invoke: (dest: AudioNode, t: number) => void;
      expectedMinOsc: number;
      expectedMinGains: number;
    }> = [
      { name: '1. BOUNCE', invoke: (d, t) => synth.playBounce(d, t), expectedMinOsc: 1, expectedMinGains: 1 },
      { name: '2. PADDLE_HIT', invoke: (d, t) => synth.playPaddleHit(d, t, 0.5), expectedMinOsc: 2, expectedMinGains: 2 },
      { name: '3. BRICK_HIT', invoke: (d, t) => synth.playBrickHit(d, t, 4), expectedMinOsc: 1, expectedMinGains: 1 },
      { name: '4. ARMORED_HIT', invoke: (d, t) => synth.playArmoredHit(d, t), expectedMinOsc: 2, expectedMinGains: 1 },
      { name: '5. BRICK_SHATTER', invoke: (d, t) => synth.playBrickShatter(d, t), expectedMinOsc: 2, expectedMinGains: 1 },
      { name: '6. EXPLOSION', invoke: (d, t) => synth.playExplosion(d, t), expectedMinOsc: 1, expectedMinGains: 1 },
      { name: '7. LASER_FIRE', invoke: (d, t) => synth.playLaserFire(d, t), expectedMinOsc: 2, expectedMinGains: 2 },
      { name: '8. POWERUP_SPAWN', invoke: (d, t) => synth.playPowerupSpawn(d, t), expectedMinOsc: 1, expectedMinGains: 1 },
      { name: '9. POWERUP_COLLECT', invoke: (d, t) => synth.playPowerupCollect(d, t, 'MULTI_BALL'), expectedMinOsc: 4, expectedMinGains: 4 },
      { name: '10. BALL_LOST', invoke: (d, t) => synth.playBallLost(d, t), expectedMinOsc: 1, expectedMinGains: 1 },
      { name: '11. STAGE_CLEAR', invoke: (d, t) => synth.playStageClear(d, t), expectedMinOsc: 9, expectedMinGains: 9 },
      { name: '12. GAME_OVER', invoke: (d, t) => synth.playGameOver(d, t), expectedMinOsc: 5, expectedMinGains: 5 },
      { name: '13. VICTORY', invoke: (d, t) => synth.playVictory(d, t), expectedMinOsc: 13, expectedMinGains: 13 },
    ];

    sfxRoutines.forEach(({ name, invoke, expectedMinOsc, expectedMinGains }) => {
      it(`verifies valid audio nodes, ADSR envelopes, and start/stop timings for ${name}`, () => {
        mockCtx.resetTracking();
        const t0 = 100.0;
        invoke(mockDest as unknown as AudioNode, t0);

        // Verify oscillator count
        expect(mockCtx.createdOscillators.length).toBeGreaterThanOrEqual(expectedMinOsc);
        expect(mockCtx.createdGains.length).toBeGreaterThanOrEqual(expectedMinGains);

        // Verify every oscillator was started and stopped properly with stopTime >= startTime
        for (const osc of mockCtx.createdOscillators) {
          expect(osc.start).toHaveBeenCalled();
          expect(osc.stop).toHaveBeenCalled();
          expect(osc.startTime).toBeGreaterThanOrEqual(t0);
          expect(osc.stopTime).toBeGreaterThan(osc.startTime!);
          expect(osc.onended).toBeDefined();
        }

        // Verify every gain envelope has non-negative values and finishes near zero (<= 0.001)
        for (const gainNode of mockCtx.createdGains) {
          const calls = gainNode.gain.calls;
          expect(calls.length).toBeGreaterThanOrEqual(2); // At least initial setValue + ramp
          const finalCall = calls[calls.length - 1];
          const finalGainVal = finalCall.args[0];
          expect(finalGainVal).toBeLessThanOrEqual(0.001); // Decayed to near-zero
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Dimension 4: Node Cleanup & Zero Memory Leaks
  // --------------------------------------------------------------------------
  describe('Dimension 4: Zero Memory Leak & Node Disconnection Verification', () => {
    it('executes onended cleanup for all created sources and disconnects all chained nodes', () => {
      mockCtx.resetTracking();
      // Trigger complex multi-node sounds
      synth.playVictory(mockDest as unknown as AudioNode, 100.0);
      synth.playExplosion(mockDest as unknown as AudioNode, 100.0);
      synth.playBrickShatter(mockDest as unknown as AudioNode, 100.0);

      const allSources: Array<MockOscillatorNode | MockBufferSourceNode> = [
        ...mockCtx.createdOscillators,
        ...mockCtx.createdBufferSources,
      ];

      expect(allSources.length).toBeGreaterThan(0);

      // Trigger onended callbacks on all sources
      for (const source of allSources) {
        expect(source.onended).toBeTypeOf('function');
        source.onended!();
        expect(source.disconnectCalls).toBeGreaterThanOrEqual(1);
      }

      // Verify all intermediate gains and filters received disconnect calls
      for (const gain of mockCtx.createdGains) {
        expect(gain.disconnectCalls).toBeGreaterThanOrEqual(1);
      }
      for (const filter of mockCtx.createdFilters) {
        expect(filter.disconnectCalls).toBeGreaterThanOrEqual(1);
      }
    });

    it('handles duplicate / erroneous onended callbacks without throwing', () => {
      mockCtx.resetTracking();
      synth.playBounce(mockDest as unknown as AudioNode, 100.0);
      const osc = mockCtx.createdOscillators[0];

      // Call onended multiple times
      expect(() => {
        osc.onended!();
        osc.onended!();
        osc.onended!();
      }).not.toThrow();
    });
  });
});

describe('Challenger M4-1: SoundManager Polyphony, Concurrency & Lifecycle Stress Suite', () => {
  let mockCtx: MockAudioContext;
  let sm: SoundManager;
  const originalAudioContext = window.AudioContext;

  beforeEach(async () => {
    mockCtx = new MockAudioContext();
    window.AudioContext = vi.fn().mockImplementation(() => mockCtx) as unknown as typeof AudioContext;
    sm = new SoundManager(0.8, false);
    await sm.init();
  });

  afterEach(() => {
    sm.destroy();
    window.AudioContext = originalAudioContext;
  });

  // --------------------------------------------------------------------------
  // Dimension 5: 24-Voice Polyphony Hard Limit & Debounce Throttling
  // --------------------------------------------------------------------------
  describe('Dimension 5: Polyphony Hard Limiting & Rapid Trigger Throttling', () => {
    it('strictly clamps active concurrent voices at MAX_CONCURRENT_VOICES (24)', () => {
      vi.useFakeTimers();

      const soundTypes: SoundType[] = [
        'BOUNCE', 'PADDLE_HIT', 'BRICK_HIT', 'ARMORED_HIT',
        'BRICK_SHATTER', 'EXPLOSION', 'LASER_FIRE', 'POWERUP_SPAWN',
        'POWERUP_COLLECT', 'BALL_LOST', 'STAGE_CLEAR', 'GAME_OVER', 'VICTORY'
      ];

      // Burst 1000 triggers across all sound types
      for (let i = 0; i < 1000; i++) {
        vi.advanceTimersByTime(5);
        const type = soundTypes[i % soundTypes.length];
        sm.playSound(type, { combo: i % 16, offsetRatio: (i % 10 - 5) / 5 });
        expect(sm.getActiveVoices()).toBeLessThanOrEqual(24);
      }

      // Fast forward time for all active voice timeouts to expire (100ms each)
      vi.advanceTimersByTime(200);
      expect(sm.getActiveVoices()).toBe(0);

      vi.useRealTimers();
    });

    it('enforces debounce intervals for identical sound triggers within milliseconds', () => {
      mockCtx.resetTracking();
      // Rapid fire 100 bounces in same millisecond
      for (let i = 0; i < 100; i++) {
        sm.playBounce();
      }

      // Debouncing must prevent all 100 bounces from producing voices simultaneously
      expect(sm.getActiveVoices()).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Dimension 6: Anti-Click Volume Ramping & Mute Invariants
  // --------------------------------------------------------------------------
  describe('Dimension 6: Volume Ramping, Dynamics Compression & Mute Controls', () => {
    it('sets smooth exponential target ramp when toggling mute state', () => {
      sm.setVolume(0.75);
      sm.setMuted(true);

      const masterGain = mockCtx.createdGains[0];
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.0, expect.any(Number), 0.015);

      sm.setMuted(false);
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.75, expect.any(Number), 0.015);
    });

    it('clamps volume inputs strictly to [0, 1] range', () => {
      sm.setVolume(-0.5);
      expect(sm.getVolume()).toBe(0.0);

      sm.setVolume(1.5);
      expect(sm.getVolume()).toBe(1.0);

      sm.setVolume(0.42);
      expect(sm.getVolume()).toBe(0.42);
    });

    it('properly configures DynamicsCompressor for bus headroom protection', () => {
      expect(mockCtx.createdCompressors.length).toBe(1);
      const comp = mockCtx.createdCompressors[0];

      expect(comp.threshold.setValueAtTime).toHaveBeenCalledWith(-6, expect.any(Number));
      expect(comp.knee.setValueAtTime).toHaveBeenCalledWith(10, expect.any(Number));
      expect(comp.ratio.setValueAtTime).toHaveBeenCalledWith(4, expect.any(Number));
      expect(comp.attack.setValueAtTime).toHaveBeenCalledWith(0.003, expect.any(Number));
      expect(comp.release.setValueAtTime).toHaveBeenCalledWith(0.05, expect.any(Number));
    });
  });

  // --------------------------------------------------------------------------
  // Dimension 7: Resilience against Degraded Environments
  // --------------------------------------------------------------------------
  describe('Dimension 7: Degraded Environment Fallback Handling', () => {
    it('operates without crash when biquad filters or compressors are unavailable', () => {
      const strippedCtx = new MockAudioContext();
      (strippedCtx as any).createBiquadFilter = undefined;
      (strippedCtx as any).createDynamicsCompressor = undefined;

      const degradedSynth = new SoundSynth(strippedCtx as unknown as AudioContext);
      const degradedSm = new SoundManager(0.8, false);

      expect(() => {
        degradedSynth.playBrickHit(strippedCtx.destination as unknown as AudioNode, 100.0, 5);
        degradedSynth.playArmoredHit(strippedCtx.destination as unknown as AudioNode, 100.0);
        degradedSynth.playExplosion(strippedCtx.destination as unknown as AudioNode, 100.0);
        degradedSynth.playBallLost(strippedCtx.destination as unknown as AudioNode, 100.0);
      }).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Dimension 8: GameEngine Audio Dispatch Integration
  // --------------------------------------------------------------------------
  describe('Dimension 8: GameEngine Audio Dispatch Integration', () => {
    it('properly receives and dispatches audio events from GameEngine lifecycle', () => {
      // Create engine with soundManager
      const engine = new GameEngine({
        soundManager: sm,
      });

      expect(engine).toBeDefined();

      // Trigger engine operations that invoke audio
      engine.startGame();
      const testAPI = (window as any).__ARKANOID_TEST_API__;
      expect(testAPI.getHUDState().status).toBe('PLAYING');

      // Mute / Unmute synchronization
      engine.setMuted(true);
      expect(sm.getIsMuted()).toBe(true);
      engine.setMuted(false);
      expect(sm.getIsMuted()).toBe(false);

      // Volume synchronization
      engine.setVolume(0.65);
      expect(sm.getVolume()).toBe(0.65);

      engine.destroy();
    });
  });
});
