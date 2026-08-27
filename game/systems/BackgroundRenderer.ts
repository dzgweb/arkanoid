/**
 * @file game/systems/BackgroundRenderer.ts
 * High-performance, zero-GC animated retro synthwave background renderer
 * featuring a 3D perspective scrolling floor grid, multi-tier parallax starfield,
 * and reactive impact glow pulses.
 */

import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';
import { clamp } from '../physics/MathUtils';

export interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  color: string;
  baseAlpha: number;
  twinkleAmp: number;
  twinkleFreq: number;
  twinklePhase: number;
  hasGlimmer: boolean;
}

export class BackgroundRenderer {
  private stars: Star[] = [];
  private gridOffset: number = 0;
  private gridSpeed: number = 0.45; // cycles per second
  private pulseTrauma: number = 0;
  private time: number = 0;

  // Horizon & 3D Perspective Configuration
  private readonly horizonY: number = 500;
  private readonly numGridHorizontals: number = 10;
  private readonly numGridVerticals: number = 18;

  constructor(numStars: number = 75) {
    this.initStars(numStars);
  }

  private initStars(count: number): void {
    this.stars = [];
    const colors = ['#ffffff', '#38bdf8', '#c084fc', '#fde047', '#94a3b8'];

    for (let i = 0; i < count; i++) {
      const layer = i < count * 0.5 ? 0 : i < count * 0.8 ? 1 : 2;
      let speed = 8;
      let size = 1.0;
      let baseAlpha = 0.3;
      let color = colors[4];
      let hasGlimmer = false;

      if (layer === 1) {
        speed = 18;
        size = 1.5;
        baseAlpha = 0.55;
        color = colors[i % 2 === 0 ? 1 : 2];
      } else if (layer === 2) {
        speed = 32;
        size = 2.2;
        baseAlpha = 0.8;
        color = colors[i % 2 === 0 ? 0 : 3];
        hasGlimmer = i % 3 === 0;
      }

      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed,
        size,
        color,
        baseAlpha,
        twinkleAmp: 0.2 + Math.random() * 0.3,
        twinkleFreq: 2.0 + Math.random() * 4.0,
        twinklePhase: Math.random() * Math.PI * 2,
        hasGlimmer,
      });
    }
  }

  /**
   * Triggers a reactive background pulse when an explosion or combo happens.
   */
  public triggerPulse(intensity: number = 0.6): void {
    this.pulseTrauma = clamp(this.pulseTrauma + intensity, 0, 1.0);
  }

  /**
   * Updates star positions, grid scrolling offset, and pulse decay.
   */
  public update(dt: number): void {
    this.time += dt;

    // 1. Update starfield parallax drift
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      star.y += star.speed * dt;
      if (star.y > CANVAS_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CANVAS_WIDTH;
      }
    }

    // 2. Update 3D perspective grid scrolling
    this.gridOffset = (this.gridOffset + this.gridSpeed * dt) % 1.0;

    // 3. Decay reactive pulse trauma
    if (this.pulseTrauma > 0) {
      this.pulseTrauma = Math.max(0, this.pulseTrauma - dt * 3.0);
    }
  }

  /**
   * Renders the entire cosmic synthwave background to Canvas 2D context.
   */
  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Deep Cosmic Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#030014');
    bgGradient.addColorStop(0.6, '#080821');
    bgGradient.addColorStop(1, '#020617');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Render Parallax Twinkling Starfield
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      const alpha = clamp(
        star.baseAlpha + star.twinkleAmp * Math.sin(this.time * star.twinkleFreq + star.twinklePhase),
        0.05,
        1.0
      );

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();

      // Foreground star cross-glimmer
      if (star.hasGlimmer && alpha > 0.7) {
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 0.75;
        const gLen = star.size * 2.5;
        ctx.beginPath();
        ctx.moveTo(star.x - gLen, star.y);
        ctx.lineTo(star.x + gLen, star.y);
        ctx.moveTo(star.x, star.y - gLen);
        ctx.lineTo(star.x + gLen, star.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Reactive Horizon Glow & Sun Arc
    if (this.pulseTrauma > 0.01) {
      const glowGrad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2,
        this.horizonY,
        10,
        CANVAS_WIDTH / 2,
        this.horizonY,
        CANVAS_WIDTH * 0.7
      );
      glowGrad.addColorStop(0, `rgba(236, 72, 153, ${this.pulseTrauma * 0.35})`);
      glowGrad.addColorStop(0.5, `rgba(6, 182, 212, ${this.pulseTrauma * 0.15})`);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, this.horizonY - 150, CANVAS_WIDTH, 350);
    }

    // 4. Render 3D Perspective Synthwave Grid Floor (y >= horizonY)
    const gridHeight = CANVAS_HEIGHT - this.horizonY;
    const vpX = CANVAS_WIDTH / 2;
    const vpY = this.horizonY;

    // Horizon line
    ctx.save();
    ctx.strokeStyle = `rgba(6, 182, 212, ${0.3 + this.pulseTrauma * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(0, this.horizonY);
    ctx.lineTo(CANVAS_WIDTH, this.horizonY);
    ctx.stroke();
    ctx.restore();

    // Perspective Radial Lines
    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
    ctx.lineWidth = 1.0;
    const xSpread = 1600;
    const step = xSpread / this.numGridVerticals;
    const startX = vpX - xSpread / 2;

    for (let i = 0; i <= this.numGridVerticals; i++) {
      const bottomX = startX + i * step;
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(bottomX, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Exponential Horizontal Lines (Moving forward)
    for (let i = 0; i < this.numGridHorizontals; i++) {
      const progress = (i + this.gridOffset) / this.numGridHorizontals;
      const normalizedY = Math.pow(progress, 2.2); // Quadratic perspective depth
      const curY = this.horizonY + normalizedY * gridHeight;
      const alpha = Math.min(0.5, normalizedY * 0.7);

      ctx.strokeStyle = `rgba(217, 70, 239, ${alpha + this.pulseTrauma * 0.2})`;
      ctx.lineWidth = 1.0 + normalizedY * 1.0;
      ctx.beginPath();
      ctx.moveTo(0, curY);
      ctx.lineTo(CANVAS_WIDTH, curY);
      ctx.stroke();
    }
    ctx.restore();

    // Upper Playfield Subtle Matrix Dots/Grid
    ctx.save();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.03)';
    for (let x = 40; x < CANVAS_WIDTH; x += 60) {
      for (let y = 40; y < this.horizonY; y += 60) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.restore();
  }

  public getPulseTrauma(): number {
    return this.pulseTrauma;
  }
}
