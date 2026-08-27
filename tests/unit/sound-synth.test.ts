/**
 * @file tests/unit/sound-synth.test.ts
 * Comprehensive unit test suite for procedural SoundSynth and SoundManager.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SoundSynth } from '@/game/audio/SoundSynth';
import { SoundManager, getSoundManager } from '@/game/audio/SoundManager';
import { SoundType, PowerupType } from '@/game/types';

// Mock Web Audio Context implementation for detailed inspection
class MockParam {
  public value: number;
  public setValueAtTime = vi.fn((val: number, _t: number) => { this.value = val; });
  public linearRampToValueAtTime = vi.fn((val: number, _t: number) => { this.value = val; });
  public exponentialRampToValueAtTime = vi.fn((val: number, _t: number) => { this.value = val; });
  public setTargetAtTime = vi.fn((val: number, _t: number, _tc: number) => { this.value = val; });

  constructor(val: number = 0) {
    this.value = val;
  }
}

class TestAudioNode {
  public connect = vi.fn().mockReturnThis();
  public disconnect = vi.fn();
}

class TestGainNode extends TestAudioNode {
  public gain = new MockParam(1);
}

class TestOscillatorNode extends TestAudioNode {
  public type: OscillatorType = 'sine';
  public frequency = new MockParam(440);
  public start = vi.fn();
  public stop = vi.fn();
  public onended: (() => void) | null = null;
}

class TestBiquadFilterNode extends TestAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency = new MockParam(1000);
  public Q = new MockParam(1);
}

class TestBufferSourceNode extends TestAudioNode {
  public buffer: AudioBuffer | null = null;
  public start = vi.fn();
  public stop = vi.fn();
  public onended: (() => void) | null = null;
}

class TestDynamicsCompressorNode extends TestAudioNode {
  public threshold = new MockParam(-6);
  public knee = new MockParam(10);
  public ratio = new MockParam(4);
  public attack = new MockParam(0.003);
  public release = new MockParam(0.05);
}

class TestAudioContext {
  public state: AudioContextState = 'running';
  public currentTime: number = 10.0;
  public sampleRate: number = 44100;
  public destination = new TestAudioNode();

  public createdOscillators: TestOscillatorNode[] = [];
  public createdGains: TestGainNode[] = [];
  public createdFilters: TestBiquadFilterNode[] = [];
  public createdBufferSources: TestBufferSourceNode[] = [];

  public createGain(): GainNode {
    const gain = new TestGainNode();
    this.createdGains.push(gain);
    return gain as unknown as GainNode;
  }

  public createOscillator(): OscillatorNode {
    const osc = new TestOscillatorNode();
    this.createdOscillators.push(osc);
    return osc as unknown as OscillatorNode;
  }

  public createBiquadFilter(): BiquadFilterNode {
    const filter = new TestBiquadFilterNode();
    this.createdFilters.push(filter);
    return filter as unknown as BiquadFilterNode;
  }

  public createBufferSource(): AudioBufferSourceNode {
    const source = new TestBufferSourceNode();
    this.createdBufferSources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  public createDynamicsCompressor(): DynamicsCompressorNode {
    return new TestDynamicsCompressorNode() as unknown as DynamicsCompressorNode;
  }

  public createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    const channelData = [new Float32Array(length)];
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (ch: number) => channelData[ch] || new Float32Array(length),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer;
  }

  public resume = vi.fn().mockResolvedValue(undefined);
  public close = vi.fn().mockResolvedValue(undefined);
}

describe('SoundSynth: Zero-Dependency Procedural Audio Synthesizer', () => {
  let mockCtx: TestAudioContext;
  let synth: SoundSynth;
  let mockDest: AudioNode;

  beforeEach(() => {
    mockCtx = new TestAudioContext();
    synth = new SoundSynth(mockCtx as unknown as AudioContext);
    mockDest = mockCtx.destination as unknown as AudioNode;
  });

  it('1. Initializes noise buffer on construction', () => {
    expect(synth).toBeDefined();
  });

  it('2. Synthesizes BOUNCE with triangle wave and 480->220Hz exponential sweep', () => {
    synth.playBounce(mockDest, 10.0);
    expect(mockCtx.createdOscillators.length).toBe(1);
    const osc = mockCtx.createdOscillators[0];
    expect(osc.type).toBe('triangle');
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(480, 10.0);
    expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(220, 10.06);
    expect(osc.start).toHaveBeenCalledWith(10.0);
    expect(osc.stop).toHaveBeenCalledWith(10.07);
  });

  it('3. Synthesizes PADDLE_HIT with dynamic offset pitch modulation and mechanical transient click', () => {
    // Center hit: offset 0
    synth.playPaddleHit(mockDest, 10.0, 0);
    expect(mockCtx.createdOscillators.length).toBe(2); // tonal body + click
    const bodyOsc = mockCtx.createdOscillators[0];
    const clickOsc = mockCtx.createdOscillators[1];

    expect(bodyOsc.type).toBe('triangle');
    expect(clickOsc.type).toBe('square');

    // Base freq for offset 0: 260 Hz -> 260 * 1.25 = 325 Hz
    expect(bodyOsc.frequency.setValueAtTime).toHaveBeenCalledWith(325, 10.0);

    // Edge hit: offset 1.0 -> base freq 260 + 160 + 30 = 450 Hz -> 450 * 1.25 = 562.5 Hz
    mockCtx.createdOscillators = [];
    synth.playPaddleHit(mockDest, 12.0, 1.0);
    const edgeOsc = mockCtx.createdOscillators[0];
    expect(edgeOsc.frequency.setValueAtTime).toHaveBeenCalledWith(450 * 1.25, 12.0);
  });

  it('4. Synthesizes BRICK_HIT with chromatic ascending frequency scaling based on combo', () => {
    // Combo 0 (C4 = 261.63Hz)
    synth.playBrickHit(mockDest, 10.0, 0);
    const osc0 = mockCtx.createdOscillators[0];
    expect(osc0.type).toBe('square');
    expect(osc0.frequency.setValueAtTime).toHaveBeenCalledWith(261.63, 10.0);

    // Combo 12 (1 octave up = C5 = 523.26Hz)
    mockCtx.createdOscillators = [];
    synth.playBrickHit(mockDest, 10.0, 12);
    const osc12 = mockCtx.createdOscillators[0];
    expect(osc12.frequency.setValueAtTime).toHaveBeenCalledWith(261.63 * 2, 10.0);

    // Combo capped at 16 (E5 ~ 659.25Hz)
    mockCtx.createdOscillators = [];
    synth.playBrickHit(mockDest, 10.0, 20);
    const oscCap = mockCtx.createdOscillators[0];
    const expectedFreq = 261.63 * Math.pow(2, 16 / 12);
    expect(oscCap.frequency.setValueAtTime).toHaveBeenCalledWith(expectedFreq, 10.0);
  });

  it('5. Synthesizes ARMORED_HIT with dual inharmonic clang oscillators (880Hz & 1340Hz) and bandpass filter', () => {
    synth.playArmoredHit(mockDest, 10.0);
    expect(mockCtx.createdOscillators.length).toBe(2);
    expect(mockCtx.createdFilters.length).toBe(1);

    const osc1 = mockCtx.createdOscillators[0];
    const osc2 = mockCtx.createdOscillators[1];
    const filter = mockCtx.createdFilters[0];

    expect(osc1.type).toBe('square');
    expect(osc1.frequency.setValueAtTime).toHaveBeenCalledWith(880, 10.0);
    expect(osc2.type).toBe('triangle');
    expect(osc2.frequency.setValueAtTime).toHaveBeenCalledWith(1340, 10.0);
    expect(filter.type).toBe('bandpass');
  });

  it('6. Synthesizes BRICK_SHATTER with dual sawtooth down-sweeps and noise buffer burst', () => {
    synth.playBrickShatter(mockDest, 10.0);
    expect(mockCtx.createdOscillators.length).toBe(2);
    expect(mockCtx.createdBufferSources.length).toBe(1);

    const saw1 = mockCtx.createdOscillators[0];
    const saw2 = mockCtx.createdOscillators[1];
    const noise = mockCtx.createdBufferSources[0];

    expect(saw1.type).toBe('sawtooth');
    expect(saw1.frequency.setValueAtTime).toHaveBeenCalledWith(720, 10.0);
    expect(saw2.type).toBe('sawtooth');
    expect(saw2.frequency.setValueAtTime).toHaveBeenCalledWith(1100, 10.0);
    expect(noise.start).toHaveBeenCalledWith(10.0);
  });

  it('7. Synthesizes EXPLOSION with swept low-pass noise blast and sub-bass sine thud', () => {
    synth.playExplosion(mockDest, 10.0);
    expect(mockCtx.createdBufferSources.length).toBe(1);
    expect(mockCtx.createdOscillators.length).toBe(1);

    const noiseFilter = mockCtx.createdFilters[0];
    expect(noiseFilter.type).toBe('lowpass');
    expect(noiseFilter.frequency.setValueAtTime).toHaveBeenCalledWith(1200, 10.0);
    expect(noiseFilter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(50, 10.38);

    const subBass = mockCtx.createdOscillators[0];
    expect(subBass.type).toBe('sine');
    expect(subBass.frequency.setValueAtTime).toHaveBeenCalledWith(140, 10.0);
    expect(subBass.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(32, 10.30);
  });

  it('8. Synthesizes LASER_FIRE with dual staggered sawtooth sweeps (t and t+35ms)', () => {
    synth.playLaserFire(mockDest, 10.0);
    expect(mockCtx.createdOscillators.length).toBe(2);

    const barrel1 = mockCtx.createdOscillators[0];
    const barrel2 = mockCtx.createdOscillators[1];

    expect(barrel1.type).toBe('sawtooth');
    expect(barrel1.start).toHaveBeenCalledWith(10.0);
    expect(barrel2.type).toBe('sawtooth');
    expect(barrel2.start).toHaveBeenCalledWith(10.035);
  });

  it('9. Synthesizes POWERUP_SPAWN with upward glissando (440 -> 1320 Hz)', () => {
    synth.playPowerupSpawn(mockDest, 10.0);
    expect(mockCtx.createdOscillators.length).toBe(1);
    const osc = mockCtx.createdOscillators[0];
    expect(osc.type).toBe('sine');
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 10.0);
    expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(1320, 10.18);
  });

  it('10. Synthesizes POWERUP_COLLECT with 4-note ascending major arpeggio', () => {
    synth.playPowerupCollect(mockDest, 10.0, 'MULTI_BALL');
    expect(mockCtx.createdOscillators.length).toBe(4);
    const freqs = [523.25, 659.25, 783.99, 1046.50];

    mockCtx.createdOscillators.forEach((osc, idx) => {
      expect(osc.type).toBe('triangle');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(freqs[idx], 10.0 + idx * 0.05);
    });
  });

  it('11. Synthesizes BALL_LOST with descending slide (360 -> 75 Hz) and lowpass filter', () => {
    synth.playBallLost(mockDest, 10.0);
    expect(mockCtx.createdOscillators.length).toBe(1);
    const osc = mockCtx.createdOscillators[0];
    expect(osc.type).toBe('sawtooth');
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(360, 10.0);
    expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(75, 10.48);
  });

  it('12. Synthesizes STAGE_CLEAR with 6-note fanfare and sustained chord', () => {
    synth.playStageClear(mockDest, 10.0);
    // 6 fanfare notes + 3 chord notes = 9 oscillators
    expect(mockCtx.createdOscillators.length).toBe(9);
  });

  it('13. Synthesizes GAME_OVER with descending notes and sub bass drone', () => {
    synth.playGameOver(mockDest, 10.0);
    // 4 descent notes + 1 sub bass drone = 5 oscillators
    expect(mockCtx.createdOscillators.length).toBe(5);
  });

  it('14. Synthesizes VICTORY with 9-note melody and 4-note climax harmony', () => {
    synth.playVictory(mockDest, 10.0);
    // 9 melody notes + 4 harmony notes = 13 oscillators
    expect(mockCtx.createdOscillators.length).toBe(13);
  });
});

describe('SoundManager: Audio Lifecycle, Throttling & Voice Pooling', () => {
  let sm: SoundManager;

  beforeEach(() => {
    sm = new SoundManager(0.8, false);
  });

  afterEach(() => {
    sm.destroy();
  });

  it('1. Initializes context and gain nodes on init()', async () => {
    await sm.init();
    expect(sm.getVolume()).toBe(0.8);
    expect(sm.getIsMuted()).toBe(false);
  });

  it('2. Smoothly ramps volume and mute changes with anti-click protection', async () => {
    await sm.init();
    sm.setVolume(0.5);
    expect(sm.getVolume()).toBe(0.5);

    sm.setMuted(true);
    expect(sm.getIsMuted()).toBe(true);

    sm.setMuted(false);
    expect(sm.getIsMuted()).toBe(false);
  });

  it('3. Suppresses sound output when muted or volume is zero', async () => {
    await sm.init();
    sm.setMuted(true);
    sm.playBounce();
    expect(sm.getActiveVoices()).toBe(0);

    sm.setMuted(false);
    sm.setVolume(0);
    sm.playBounce();
    expect(sm.getActiveVoices()).toBe(0);
  });

  it('4. Limits concurrent voices and debounces rapid burst calls', async () => {
    await sm.init();
    sm.setVolume(0.8);

    // Rapid burst of 50 bounces within 1 millisecond
    for (let i = 0; i < 50; i++) {
      sm.playBounce();
    }

    // Debouncing ensures only the first allowed bounce executes in that immediate tick
    expect(sm.getActiveVoices()).toBeLessThanOrEqual(24);
  });

  it('5. Correctly routes all 13 sound types through playSound() dispatcher', async () => {
    await sm.init();
    const soundTypes: SoundType[] = [
      'BOUNCE',
      'PADDLE_HIT',
      'BRICK_HIT',
      'ARMORED_HIT',
      'BRICK_SHATTER',
      'EXPLOSION',
      'LASER_FIRE',
      'POWERUP_SPAWN',
      'POWERUP_COLLECT',
      'BALL_LOST',
      'STAGE_CLEAR',
      'GAME_OVER',
      'VICTORY',
    ];

    soundTypes.forEach((type) => {
      expect(() => sm.playSound(type, { combo: 2, offsetRatio: 0.5, type: 'MULTI_BALL' })).not.toThrow();
    });
  });

  it('6. Returns singleton instance from getSoundManager()', () => {
    const s1 = getSoundManager();
    const s2 = getSoundManager();
    expect(s1).toBe(s2);
  });
});
