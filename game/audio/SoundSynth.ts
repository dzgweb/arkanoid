/**
 * @file game/audio/SoundSynth.ts
 * Zero-dependency Web Audio API procedural sound synthesizer.
 * Generates 13 arcade sound effects with ADSR gain envelopes,
 * dynamic pitch modulation, inharmonic clangs, and procedural noise buffers.
 */

import { PowerupType } from '../types';

export class SoundSynth {
  private ctx: AudioContext;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.initNoiseBuffer();
  }

  /**
   * Pre-generates a 1-second mono white noise buffer for reuse in explosions and shatter transients.
   */
  private initNoiseBuffer(): void {
    if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return;

    try {
      const sampleRate = this.ctx.sampleRate || 44100;
      const bufferSize = sampleRate; // 1 second of noise
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1; // Uniform white noise [-1.0, 1.0]
      }

      this.noiseBuffer = buffer;
    } catch {
      this.noiseBuffer = null;
    }
  }

  /**
   * Helper: Connects and schedules node cleanup upon completion.
   */
  private scheduleCleanup(source: AudioScheduledSourceNode, nodes: AudioNode[], stopTime: number): void {
    source.onended = () => {
      try {
        source.disconnect();
      } catch {
        // Ignore if already disconnected
      }
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Ignore if already disconnected
        }
      }
    };
  }

  // =========================================================================
  // 1. BOUNCE: Clean percussive wall / shield deflection blip
  // =========================================================================
  public playBounce(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, t0);
    osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.06);

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.35, t0 + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.065);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t0);
    osc.stop(t0 + 0.07);
    this.scheduleCleanup(osc, [gain], t0 + 0.07);
  }

  // =========================================================================
  // 2. PADDLE_HIT: Tactile mechanical deflection with dynamic offset pitch
  // =========================================================================
  public playPaddleHit(dest: AudioNode, time: number = this.ctx.currentTime, offsetRatio: number = 0): void {
    const t0 = Math.max(time, this.ctx.currentTime);
    const clampedOffset = Math.max(-1, Math.min(1, offsetRatio));
    const baseFreq = 260 + 160 * Math.abs(clampedOffset) + clampedOffset * 30;

    // Main Tonal Body
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 1.25, t0);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, t0 + 0.09);

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.40, t0 + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.095);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t0);
    osc.stop(t0 + 0.10);
    this.scheduleCleanup(osc, [gain], t0 + 0.10);

    // Mechanical Transient Click
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();

    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(800, t0);
    clickOsc.frequency.exponentialRampToValueAtTime(300, t0 + 0.008);

    clickGain.gain.setValueAtTime(0.20, t0);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.008);

    clickOsc.connect(clickGain);
    clickGain.connect(dest);

    clickOsc.start(t0);
    clickOsc.stop(t0 + 0.01);
    this.scheduleCleanup(clickOsc, [clickGain], t0 + 0.01);
  }

  // =========================================================================
  // 3. BRICK_HIT: Chromatic ascending pitch ladder with combo scaling
  // =========================================================================
  public playBrickHit(dest: AudioNode, time: number = this.ctx.currentTime, combo: number = 0): void {
    const t0 = Math.max(time, this.ctx.currentTime);
    const clampedCombo = Math.max(0, Math.min(16, combo));
    // Middle C (261.63Hz) ascending semitones up to E5 (659.25Hz)
    const baseFreq = 261.63 * Math.pow(2, clampedCombo / 12);

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter ? this.ctx.createBiquadFilter() : null;
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.90, t0 + 0.08);

    if (filter) {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, t0);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.25, t0 + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.085);

    gain.connect(dest);

    osc.start(t0);
    osc.stop(t0 + 0.09);
    this.scheduleCleanup(osc, filter ? [filter, gain] : [gain], t0 + 0.09);
  }

  // =========================================================================
  // 4. ARMORED_HIT: High-frequency metallic inharmonic clang & ring
  // =========================================================================
  public playArmoredHit(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);

    // Dual Inharmonic Oscillators (Clang)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter ? this.ctx.createBiquadFilter() : null;
    const gain = this.ctx.createGain();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(880, t0);
    osc1.frequency.exponentialRampToValueAtTime(440, t0 + 0.12);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1340, t0); // Inharmonic ratio ~ 1.52
    osc2.frequency.exponentialRampToValueAtTime(720, t0 + 0.12);

    if (filter) {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t0);
      filter.Q.setValueAtTime(3.5, t0);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
    } else {
      osc1.connect(gain);
      osc2.connect(gain);
    }

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.30, t0 + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.06, t0 + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);

    gain.connect(dest);

    osc1.start(t0);
    osc2.start(t0);
    osc1.stop(t0 + 0.14);
    osc2.stop(t0 + 0.14);

    this.scheduleCleanup(osc1, filter ? [filter, gain] : [gain], t0 + 0.14);
    this.scheduleCleanup(osc2, [], t0 + 0.14);
  }

  // =========================================================================
  // 5. BRICK_SHATTER: Dual-sawtooth cascade + crisp high-pass noise burst
  // =========================================================================
  public playBrickShatter(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);

    // Cascading Sawtooth Down-sweeps
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(720, t0);
    osc1.frequency.exponentialRampToValueAtTime(140, t0 + 0.14);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1100, t0);
    osc2.frequency.exponentialRampToValueAtTime(180, t0 + 0.14);

    oscGain.gain.setValueAtTime(0.001, t0);
    oscGain.gain.linearRampToValueAtTime(0.30, t0 + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);

    osc1.connect(oscGain);
    osc2.connect(oscGain);
    oscGain.connect(dest);

    osc1.start(t0);
    osc2.start(t0);
    osc1.stop(t0 + 0.16);
    osc2.stop(t0 + 0.16);
    this.scheduleCleanup(osc1, [oscGain], t0 + 0.16);
    this.scheduleCleanup(osc2, [], t0 + 0.16);

    // High-Pass Noise Shatter Transient
    if (this.noiseBuffer && typeof this.ctx.createBufferSource === 'function') {
      try {
        const noise = this.ctx.createBufferSource();
        const noiseFilter = this.ctx.createBiquadFilter ? this.ctx.createBiquadFilter() : null;
        const noiseGain = this.ctx.createGain();

        noise.buffer = this.noiseBuffer;
        if (noiseFilter) {
          noiseFilter.type = 'highpass';
          noiseFilter.frequency.setValueAtTime(2200, t0);
          noise.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
        } else {
          noise.connect(noiseGain);
        }

        noiseGain.gain.setValueAtTime(0.20, t0);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

        noiseGain.connect(dest);

        noise.start(t0);
        noise.stop(t0 + 0.05);
        this.scheduleCleanup(noise, noiseFilter ? [noiseFilter, noiseGain] : [noiseGain], t0 + 0.05);
      } catch {
        // Safe fallback if buffer source creation fails
      }
    }
  }

  // =========================================================================
  // 6. EXPLOSION: Low-pass filtered noise rumble + sub-bass concussion thud
  // =========================================================================
  public playExplosion(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);

    // Noise Blast with Swept Low-Pass Filter
    if (this.noiseBuffer && typeof this.ctx.createBufferSource === 'function') {
      try {
        const noise = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter ? this.ctx.createBiquadFilter() : null;
        const noiseGain = this.ctx.createGain();

        noise.buffer = this.noiseBuffer;
        if (filter) {
          filter.type = 'lowpass';
          filter.Q.setValueAtTime(2.5, t0);
          filter.frequency.setValueAtTime(1200, t0);
          filter.frequency.exponentialRampToValueAtTime(50, t0 + 0.38);
          noise.connect(filter);
          filter.connect(noiseGain);
        } else {
          noise.connect(noiseGain);
        }

        noiseGain.gain.setValueAtTime(0.001, t0);
        noiseGain.gain.linearRampToValueAtTime(0.45, t0 + 0.005);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);

        noiseGain.connect(dest);

        noise.start(t0);
        noise.stop(t0 + 0.40);
        this.scheduleCleanup(noise, filter ? [filter, noiseGain] : [noiseGain], t0 + 0.40);
      } catch {
        // Safe fallback
      }
    }

    // Sub-Bass Sine Impact Thud
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, t0);
    subOsc.frequency.exponentialRampToValueAtTime(32, t0 + 0.30);

    subGain.gain.setValueAtTime(0.001, t0);
    subGain.gain.linearRampToValueAtTime(0.50, t0 + 0.004);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);

    subOsc.connect(subGain);
    subGain.connect(dest);

    subOsc.start(t0);
    subOsc.stop(t0 + 0.35);
    this.scheduleCleanup(subOsc, [subGain], t0 + 0.35);
  }

  // =========================================================================
  // 7. LASER_FIRE: Dual staggered sawtooth chirp sweeps
  // =========================================================================
  public playLaserFire(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);

    // Barrel 1
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(1400, t0);
    osc1.frequency.exponentialRampToValueAtTime(280, t0 + 0.08);

    gain1.gain.setValueAtTime(0.001, t0);
    gain1.gain.linearRampToValueAtTime(0.28, t0 + 0.001);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

    osc1.connect(gain1);
    gain1.connect(dest);

    osc1.start(t0);
    osc1.stop(t0 + 0.085);
    this.scheduleCleanup(osc1, [gain1], t0 + 0.085);

    // Barrel 2 (Staggered by 35ms)
    const t1 = t0 + 0.035;
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1650, t1);
    osc2.frequency.exponentialRampToValueAtTime(330, t1 + 0.08);

    gain2.gain.setValueAtTime(0.001, t1);
    gain2.gain.linearRampToValueAtTime(0.28, t1 + 0.001);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.08);

    osc2.connect(gain2);
    gain2.connect(dest);

    osc2.start(t1);
    osc2.stop(t1 + 0.085);
    this.scheduleCleanup(osc2, [gain2], t1 + 0.085);
  }

  // =========================================================================
  // 8. POWERUP_SPAWN: Shimmering upward glissando sparkle
  // =========================================================================
  public playPowerupSpawn(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t0);
    osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.18);

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.25, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t0);
    osc.stop(t0 + 0.20);
    this.scheduleCleanup(osc, [gain], t0 + 0.20);
  }

  // =========================================================================
  // 9. POWERUP_COLLECT: Ascending 4-note major 7th arpeggio
  // =========================================================================
  public playPowerupCollect(
    dest: AudioNode,
    time: number = this.ctx.currentTime,
    _type: PowerupType = 'MULTI_BALL'
  ): void {
    const t0 = Math.max(time, this.ctx.currentTime);
    // C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteDuration = 0.065;
    const noteInterval = 0.050;

    notes.forEach((freq, idx) => {
      const noteStart = t0 + idx * noteInterval;
      const isLast = idx === notes.length - 1;
      const dur = isLast ? 0.14 : noteDuration;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteStart);

      const peakGain = isLast ? 0.32 : 0.24;
      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(peakGain, noteStart + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + dur);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(noteStart);
      osc.stop(noteStart + dur + 0.01);
      this.scheduleCleanup(osc, [gain], noteStart + dur + 0.01);
    });
  }

  // =========================================================================
  // 10. BALL_LOST: Somber descending slide with 8Hz pitch wobble
  // =========================================================================
  public playBallLost(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter ? this.ctx.createBiquadFilter() : null;
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360, t0);
    osc.frequency.exponentialRampToValueAtTime(75, t0 + 0.48);

    if (filter) {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, t0);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.35, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.49);

    gain.connect(dest);

    osc.start(t0);
    osc.stop(t0 + 0.50);
    this.scheduleCleanup(osc, filter ? [filter, gain] : [gain], t0 + 0.50);
  }

  // =========================================================================
  // 11. STAGE_CLEAR: Heroic 6-note victory fanfare with sustained chord
  // =========================================================================
  public playStageClear(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);
    // G4, C5, E5, G5, E5, G5
    const sequence = [
      { freq: 392.00, start: 0.00, dur: 0.10 },
      { freq: 523.25, start: 0.11, dur: 0.10 },
      { freq: 659.25, start: 0.22, dur: 0.10 },
      { freq: 783.99, start: 0.33, dur: 0.18 },
      { freq: 659.25, start: 0.53, dur: 0.10 },
      { freq: 783.99, start: 0.65, dur: 0.45 },
    ];

    for (const note of sequence) {
      const noteStart = t0 + note.start;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, noteStart);

      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(0.28, noteStart + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.dur);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(noteStart);
      osc.stop(noteStart + note.dur + 0.01);
      this.scheduleCleanup(osc, [gain], noteStart + note.dur + 0.01);
    }

    // Sustained Triad Harmony on Final Note (C5 + E5 + C6)
    const chordStart = t0 + 0.65;
    const chordFreqs = [523.25, 659.25, 1046.50];
    for (const freq of chordFreqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, chordStart);

      gain.gain.setValueAtTime(0.001, chordStart);
      gain.gain.linearRampToValueAtTime(0.12, chordStart + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, chordStart + 0.45);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(chordStart);
      osc.stop(chordStart + 0.46);
      this.scheduleCleanup(osc, [gain], chordStart + 0.46);
    }
  }

  // =========================================================================
  // 12. GAME_OVER: Classic 8-bit defeat descent + low bass thud
  // =========================================================================
  public playGameOver(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);
    // Eb4, D4, Db4, C4
    const notes = [
      { freq: 311.13, start: 0.00, dur: 0.18 },
      { freq: 293.66, start: 0.18, dur: 0.18 },
      { freq: 277.18, start: 0.36, dur: 0.18 },
      { freq: 261.63, start: 0.54, dur: 0.35 },
    ];

    for (const note of notes) {
      const noteStart = t0 + note.start;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(note.freq, noteStart);

      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(0.28, noteStart + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.dur);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(noteStart);
      osc.stop(noteStart + note.dur + 0.01);
      this.scheduleCleanup(osc, [gain], noteStart + note.dur + 0.01);
    }

    // Final Sub Bass Drone (C2 = 65.41 Hz)
    const bassStart = t0 + 0.85;
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();

    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(65.41, bassStart);

    bassGain.gain.setValueAtTime(0.001, bassStart);
    bassGain.gain.linearRampToValueAtTime(0.40, bassStart + 0.01);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, bassStart + 0.55);

    bassOsc.connect(bassGain);
    bassGain.connect(dest);

    bassOsc.start(bassStart);
    bassOsc.stop(bassStart + 0.58);
    this.scheduleCleanup(bassOsc, [bassGain], bassStart + 0.58);
  }

  // =========================================================================
  // 13. VICTORY: Grand triumphant tournament fanfare + multi-octave chord
  // =========================================================================
  public playVictory(dest: AudioNode, time: number = this.ctx.currentTime): void {
    const t0 = Math.max(time, this.ctx.currentTime);
    const melody = [
      { freq: 523.25, start: 0.00, dur: 0.09 }, // C5
      { freq: 659.25, start: 0.09, dur: 0.09 }, // E5
      { freq: 783.99, start: 0.18, dur: 0.09 }, // G5
      { freq: 1046.5, start: 0.27, dur: 0.18 }, // C6
      { freq: 783.99, start: 0.48, dur: 0.09 }, // G5
      { freq: 1046.5, start: 0.57, dur: 0.09 }, // C6
      { freq: 1318.5, start: 0.66, dur: 0.24 }, // E6
      { freq: 1174.6, start: 0.92, dur: 0.12 }, // D6
      { freq: 1046.5, start: 1.06, dur: 0.60 }, // C6
    ];

    for (const note of melody) {
      const noteStart = t0 + note.start;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, noteStart);

      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(0.30, noteStart + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.dur);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(noteStart);
      osc.stop(noteStart + note.dur + 0.01);
      this.scheduleCleanup(osc, [gain], noteStart + note.dur + 0.01);
    }

    // Grand Sustained Harmony on Climax (C4 + G4 + E5 + C6)
    const climaxStart = t0 + 1.06;
    const triad = [261.63, 392.00, 659.25, 1046.50];
    for (const freq of triad) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, climaxStart);

      gain.gain.setValueAtTime(0.001, climaxStart);
      gain.gain.linearRampToValueAtTime(0.10, climaxStart + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, climaxStart + 0.70);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(climaxStart);
      osc.stop(climaxStart + 0.72);
      this.scheduleCleanup(osc, [gain], climaxStart + 0.72);
    }
  }
}
