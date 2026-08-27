/**
 * @file game/engine/GameLoop.ts
 * Deterministic fixed-timestep accumulator game loop with sub-frame alpha interpolation.
 */

import { FIXED_DT, MAX_FRAME_TIME } from '../constants';

export type UpdateCallback = (fixedDt: number) => void;
export type RenderCallback = (alpha: number) => void;

export interface GameLoopOptions {
  fixedDt?: number;
  maxFrameTime?: number;
  onUpdate: UpdateCallback;
  onRender: RenderCallback;
}

export class GameLoop {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private readonly fixedDt: number;
  private readonly maxFrameTime: number;
  private readonly onUpdate: UpdateCallback;
  private readonly onRender: RenderCallback;

  private accumulator: number = 0;
  private lastTime: number = 0;
  private rafId: number | null = null;

  private tickCount: number = 0;
  private frameCount: number = 0;
  private fps: number = 60;
  private fpsTimer: number = 0;
  private fpsFrameCount: number = 0;

  constructor(options: GameLoopOptions) {
    this.fixedDt = options.fixedDt ?? FIXED_DT;
    this.maxFrameTime = options.maxFrameTime ?? MAX_FRAME_TIME;
    this.onUpdate = options.onUpdate;
    this.onRender = options.onRender;
  }

  /**
   * Starts the requestAnimationFrame loop. Idempotent if already running.
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.accumulator = 0;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000;
    this.fpsTimer = this.lastTime;
    this.fpsFrameCount = 0;

    this.scheduleNextFrame();
  }

  /**
   * Stops the game loop and cancels active animation frames.
   */
  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.rafId !== null) {
      if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId);
      }
      this.rafId = null;
    }
  }

  /**
   * Pauses physics simulation updates while keeping the loop alive for static renders.
   */
  public pause(): void {
    this.isPaused = true;
  }

  /**
   * Resumes physics simulation updates, resetting the delta accumulator to avoid jump spikes.
   */
  public resume(): void {
    if (!this.isRunning) {
      this.start();
      return;
    }
    this.isPaused = false;
    this.accumulator = 0;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getFPS(): number {
    return this.fps;
  }

  public getTickCount(): number {
    return this.tickCount;
  }

  public getFrameCount(): number {
    return this.frameCount;
  }

  private scheduleNextFrame(): void {
    if (!this.isRunning) return;

    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      this.rafId = window.requestAnimationFrame(this.loop);
    } else {
      this.rafId = setTimeout(() => {
        this.loop(typeof performance !== 'undefined' ? performance.now() : Date.now());
      }, 1000 / 60) as unknown as number;
    }
  }

  private loop = (currentTimeMs: number): void => {
    if (!this.isRunning) return;

    const currentTime = currentTimeMs / 1000;
    let frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Clamp maximum frame time to prevent spiral-of-death
    if (frameTime > this.maxFrameTime) {
      frameTime = this.maxFrameTime;
    }

    // Calculate rolling FPS
    this.fpsFrameCount++;
    if (currentTime - this.fpsTimer >= 1.0) {
      this.fps = this.fpsFrameCount;
      this.fpsFrameCount = 0;
      this.fpsTimer = currentTime;
    }

    if (!this.isPaused) {
      this.accumulator += frameTime;

      // Fixed timestep physics update step
      while (this.accumulator >= this.fixedDt) {
        this.onUpdate(this.fixedDt);
        this.accumulator -= this.fixedDt;
        this.tickCount++;
      }
    }

    // Calculate sub-frame interpolation factor
    const alpha = this.isPaused ? 1.0 : this.accumulator / this.fixedDt;

    // Render step
    this.onRender(alpha);
    this.frameCount++;

    this.scheduleNextFrame();
  };
}
