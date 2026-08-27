/**
 * @file game/audio/SoundManager.ts
 * Master audio controller implementing ISoundManager.
 * Manages Web Audio context lifecycle, user-gesture unlock, master gain ramping,
 * dynamics compression, sound concurrency throttling, and procedural synth dispatch.
 */

import { ISoundManager, SoundType, PowerupType } from '../types';
import { SoundSynth } from './SoundSynth';

export class SoundManager implements ISoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private synth: SoundSynth | null = null;

  private isMuted: boolean = false;
  private volume: number = 0.8;
  private isUnlocked: boolean = false;
  private activeVoices: number = 0;
  private readonly MAX_CONCURRENT_VOICES = 24;

  // Rate-limiting debounce map per sound type (in milliseconds)
  private lastPlayTimestamp: Map<SoundType, number> = new Map();
  private readonly SOUND_DEBOUNCE_MS: Partial<Record<SoundType, number>> = {
    BOUNCE: 30,
    BRICK_HIT: 25,
    ARMORED_HIT: 30,
    BRICK_SHATTER: 30,
    EXPLOSION: 60,
    LASER_FIRE: 50,
    PADDLE_HIT: 40,
    POWERUP_SPAWN: 50,
    POWERUP_COLLECT: 50,
  };

  private unlockListenersAttached: boolean = false;
  private boundUnlockHandler: (() => void) | null = null;

  constructor(initialVolume: number = 0.8, initialMuted: boolean = false) {
    this.volume = Math.max(0, Math.min(1, initialVolume));
    this.isMuted = initialMuted;

    if (typeof window !== 'undefined') {
      this.attachUnlockListeners();
    }
  }

  /**
   * Initializes the AudioContext and signal chain.
   */
  public async init(): Promise<void> {
    if (this.ctx) return;
    if (typeof window === 'undefined') return;

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtxClass) {
        console.warn('[SoundManager] Web Audio API is not supported in this environment.');
        return;
      }

      this.ctx = new AudioCtxClass();

      // Create Master Dynamics Compressor (prevents clipping during dense cascades)
      if (typeof this.ctx.createDynamicsCompressor === 'function') {
        try {
          this.compressor = this.ctx.createDynamicsCompressor();
          this.compressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
          this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
          this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
          this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
          this.compressor.release.setValueAtTime(0.05, this.ctx.currentTime);
          this.compressor.connect(this.ctx.destination);
        } catch {
          this.compressor = null;
        }
      }

      // Create Master Gain Node
      if (typeof this.ctx.createGain === 'function') {
        this.masterGain = this.ctx.createGain();
        const effectiveVol = this.isMuted ? 0 : this.volume;
        this.masterGain.gain.setValueAtTime(effectiveVol, this.ctx.currentTime);

        if (this.compressor) {
          this.masterGain.connect(this.compressor);
        } else {
          this.masterGain.connect(this.ctx.destination);
        }
      }

      // Instantiate Procedural Synthesizer
      this.synth = new SoundSynth(this.ctx);

      if (this.ctx.state === 'running') {
        this.isUnlocked = true;
      }
    } catch (err) {
      console.warn('[SoundManager] Failed to initialize Web Audio context:', err);
    }
  }

  /**
   * Attaches one-time window interaction listeners to unlock AudioContext.
   */
  private attachUnlockListeners(): void {
    if (this.unlockListenersAttached || typeof window === 'undefined') return;

    this.boundUnlockHandler = () => {
      this.unlock();
    };

    const events = ['click', 'pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((evt) => {
      window.addEventListener(evt, this.boundUnlockHandler!, { once: true, passive: true });
    });
    this.unlockListenersAttached = true;
  }

  /**
   * Unlocks suspended AudioContext on user gesture.
   */
  public async unlock(): Promise<void> {
    if (!this.ctx) {
      await this.init();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        this.isUnlocked = true;
      } catch (err) {
        console.warn('[SoundManager] AudioContext resume failed:', err);
      }
    } else if (this.ctx && this.ctx.state === 'running') {
      this.isUnlocked = true;
    }
  }

  /**
   * Checks if sound can be played (verifies context, mute state, debouncing, voice limit).
   */
  private canPlay(type: SoundType): boolean {
    if (this.isMuted || this.volume <= 0) return false;
    if (!this.ctx || !this.masterGain || !this.synth) return false;

    // Check AudioContext state
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Voice pool limit check
    if (this.activeVoices >= this.MAX_CONCURRENT_VOICES) {
      return false;
    }

    // Debounce check
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const minInterval = this.SOUND_DEBOUNCE_MS[type] ?? 0;
    const lastTime = this.lastPlayTimestamp.get(type) ?? 0;

    if (now - lastTime < minInterval) {
      return false;
    }

    this.lastPlayTimestamp.set(type, now);
    return true;
  }

  /**
   * Tracks active voice allocation and cleanup.
   */
  private runVoice(synthFn: (dest: AudioNode, time: number) => void): void {
    if (!this.ctx || !this.masterGain) return;

    this.activeVoices++;
    try {
      synthFn(this.masterGain, this.ctx.currentTime);
    } catch (err) {
      console.warn('[SoundManager] Error synthesizing sound:', err);
    } finally {
      // Release voice count after nominal transient duration
      setTimeout(() => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      }, 100);
    }
  }

  // ==========================================
  // ISoundManager Implementation Methods
  // ==========================================

  public playSound(type: SoundType, params?: { combo?: number; offsetRatio?: number; type?: PowerupType }): void {
    switch (type) {
      case 'BOUNCE':
        this.playBounce();
        break;
      case 'PADDLE_HIT':
        this.playPaddleHit(params?.offsetRatio ?? 0);
        break;
      case 'BRICK_HIT':
        this.playBrickHit(params?.combo ?? 0);
        break;
      case 'ARMORED_HIT':
        this.playArmoredHit();
        break;
      case 'BRICK_SHATTER':
        this.playBrickShatter();
        break;
      case 'EXPLOSION':
        this.playExplosion();
        break;
      case 'LASER_FIRE':
        this.playLaserFire();
        break;
      case 'POWERUP_SPAWN':
        this.playPowerupSpawn();
        break;
      case 'POWERUP_COLLECT':
        this.playPowerupCollect(params?.type ?? 'MULTI_BALL');
        break;
      case 'BALL_LOST':
        this.playBallLost();
        break;
      case 'STAGE_CLEAR':
        this.playStageClear();
        break;
      case 'GAME_OVER':
        this.playGameOver();
        break;
      case 'VICTORY':
        this.playVictory();
        break;
    }
  }

  public playBounce(): void {
    if (!this.canPlay('BOUNCE')) return;
    this.runVoice((dest, t) => this.synth?.playBounce(dest, t));
  }

  public playPaddleHit(offsetRatio: number = 0): void {
    if (!this.canPlay('PADDLE_HIT')) return;
    this.runVoice((dest, t) => this.synth?.playPaddleHit(dest, t, offsetRatio));
  }

  public playBrickHit(combo: number = 0): void {
    if (!this.canPlay('BRICK_HIT')) return;
    this.runVoice((dest, t) => this.synth?.playBrickHit(dest, t, combo));
  }

  public playArmoredHit(): void {
    if (!this.canPlay('ARMORED_HIT')) return;
    this.runVoice((dest, t) => this.synth?.playArmoredHit(dest, t));
  }

  public playBrickShatter(): void {
    if (!this.canPlay('BRICK_SHATTER')) return;
    this.runVoice((dest, t) => this.synth?.playBrickShatter(dest, t));
  }

  public playExplosion(): void {
    if (!this.canPlay('EXPLOSION')) return;
    this.runVoice((dest, t) => this.synth?.playExplosion(dest, t));
  }

  public playLaserFire(): void {
    if (!this.canPlay('LASER_FIRE')) return;
    this.runVoice((dest, t) => this.synth?.playLaserFire(dest, t));
  }

  public playPowerupSpawn(): void {
    if (!this.canPlay('POWERUP_SPAWN')) return;
    this.runVoice((dest, t) => this.synth?.playPowerupSpawn(dest, t));
  }

  public playPowerupCollect(type: PowerupType = 'MULTI_BALL'): void {
    if (!this.canPlay('POWERUP_COLLECT')) return;
    this.runVoice((dest, t) => this.synth?.playPowerupCollect(dest, t, type));
  }

  public playBallLost(): void {
    if (!this.canPlay('BALL_LOST')) return;
    this.runVoice((dest, t) => this.synth?.playBallLost(dest, t));
  }

  public playStageClear(): void {
    if (!this.canPlay('STAGE_CLEAR')) return;
    this.runVoice((dest, t) => this.synth?.playStageClear(dest, t));
  }

  public playGameOver(): void {
    if (!this.canPlay('GAME_OVER')) return;
    this.runVoice((dest, t) => this.synth?.playGameOver(dest, t));
  }

  public playVictory(): void {
    if (!this.canPlay('VICTORY')) return;
    this.runVoice((dest, t) => this.synth?.playVictory(dest, t));
  }

  // ==========================================
  // Volume & Mute Controls (Anti-Click Ramping)
  // ==========================================

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const target = muted ? 0.0 : this.volume;
      if (typeof this.masterGain.gain.setTargetAtTime === 'function') {
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.015);
      } else if (typeof this.masterGain.gain.setValueAtTime === 'function') {
        this.masterGain.gain.setValueAtTime(target, this.ctx.currentTime);
      } else {
        this.masterGain.gain.value = target;
      }
    }
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volume = clamped;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0.0 : clamped;
      if (typeof this.masterGain.gain.setTargetAtTime === 'function') {
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.015);
      } else if (typeof this.masterGain.gain.setValueAtTime === 'function') {
        this.masterGain.gain.setValueAtTime(target, this.ctx.currentTime);
      } else {
        this.masterGain.gain.value = target;
      }
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  public getActiveVoices(): number {
    return this.activeVoices;
  }

  public destroy(): void {
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // Ignore close errors
      }
      this.ctx = null;
    }
    this.masterGain = null;
    this.compressor = null;
    this.synth = null;
    this.lastPlayTimestamp.clear();
  }
}

// Global Singleton Instance
let soundManagerInstance: SoundManager | null = null;

export function getSoundManager(): SoundManager {
  if (!soundManagerInstance) {
    soundManagerInstance = new SoundManager();
  }
  return soundManagerInstance;
}
