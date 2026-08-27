/**
 * @file game/systems/ScreenShake.ts
 * High-precision quadratic trauma screen shake system (Intensity = Trauma^2)
 * with exponential decay (1.8 s^-1), harmonic sinusoidal noise tremor synthesis,
 * bounded translation (<= 12 px) and rotation (<= 2 deg / 0.0349 rad) around canvas center.
 */

import { IScreenShake } from '../types';
import {
  TRAUMA_MAX,
  TRAUMA_DECAY_RATE,
  MAX_SHAKE_TRANSLATE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../constants';

export const MAX_SHAKE_ROTATION_RAD = (2 * Math.PI) / 180; // 2 degrees in radians (~0.0349066 rad)

export class ScreenShake implements IScreenShake {
  private trauma: number = 0;
  private timeAccumulator: number = 0;

  private offsetX: number = 0;
  private offsetY: number = 0;
  private offsetAngle: number = 0;

  private maxTranslate: number;
  private maxRotation: number;
  private decayRate: number;
  private centerX: number;
  private centerY: number;

  constructor(
    maxTranslate: number = MAX_SHAKE_TRANSLATE,
    maxRotation: number = MAX_SHAKE_ROTATION_RAD,
    decayRate: number = TRAUMA_DECAY_RATE,
    centerX: number = CANVAS_WIDTH / 2,
    centerY: number = CANVAS_HEIGHT / 2
  ) {
    this.maxTranslate = maxTranslate;
    this.maxRotation = maxRotation;
    this.decayRate = decayRate;
    this.centerX = centerX;
    this.centerY = centerY;
  }

  /**
   * Adds trauma to the camera, clamped in [0.0, 1.0].
   */
  public addTrauma(amount: number): void {
    if (amount <= 0 || !Number.isFinite(amount)) return;
    this.trauma = Math.min(TRAUMA_MAX, this.trauma + amount);
  }

  /**
   * Updates trauma decay and calculates multi-harmonic jitter offsets.
   */
  public update(dt: number): void {
    if (this.trauma <= 0) {
      this.trauma = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.offsetAngle = 0;
      return;
    }

    // 1. Exponential / linear step decay: dTrauma = -1.8 * dt
    this.trauma = Math.max(0, this.trauma - this.decayRate * dt);

    if (this.trauma <= 0.0001) {
      this.trauma = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.offsetAngle = 0;
      return;
    }

    // 2. Quadratic trauma intensity curve
    const intensity = this.trauma * this.trauma;

    // 3. Increment noise time accumulator (40 Hz frequency)
    this.timeAccumulator += dt * 40;
    const t = this.timeAccumulator;

    // 4. Incommensurate harmonic sinusoidal noise coordinates
    const nx =
      0.6 * Math.sin(t * 1.0) +
      0.3 * Math.sin(t * 2.37 + 1.2) +
      0.1 * Math.sin(t * 5.71 + 2.8);

    const ny =
      0.6 * Math.cos(t * 1.13 + 0.4) +
      0.3 * Math.sin(t * 2.71 + 0.9) +
      0.1 * Math.cos(t * 6.19 + 1.7);

    const nAngle =
      0.7 * Math.sin(t * 0.89 + 2.1) +
      0.3 * Math.sin(t * 3.14 + 4.5);

    // 5. Scaled bounded displacements
    this.offsetX = this.maxTranslate * intensity * nx;
    this.offsetY = this.maxTranslate * intensity * ny;
    this.offsetAngle = this.maxRotation * intensity * nAngle;
  }

  /**
   * Applies the shake translation and rotation matrix around canvas center.
   */
  public applyTransform(ctx: CanvasRenderingContext2D): void {
    if (this.trauma <= 0.0001) return;

    ctx.save();
    // Center-pivot translation & rotation
    ctx.translate(this.centerX + this.offsetX, this.centerY + this.offsetY);
    ctx.rotate(this.offsetAngle);
    ctx.translate(-this.centerX, -this.centerY);
  }

  /**
   * Restores the canvas transformation matrix.
   */
  public restoreTransform(ctx: CanvasRenderingContext2D): void {
    if (this.trauma <= 0.0001) return;
    ctx.restore();
  }

  /**
   * Resets trauma and offsets to absolute zero.
   */
  public reset(): void {
    this.trauma = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetAngle = 0;
    this.timeAccumulator = 0;
  }

  // Getters for inspection & unit testing
  public getTrauma(): number {
    return this.trauma;
  }

  public getIntensity(): number {
    return this.trauma * this.trauma;
  }

  public getOffsets(): { x: number; y: number; angle: number } {
    return {
      x: this.offsetX,
      y: this.offsetY,
      angle: this.offsetAngle,
    };
  }
}
