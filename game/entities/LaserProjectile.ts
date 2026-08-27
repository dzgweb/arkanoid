/**
 * @file game/entities/LaserProjectile.ts
 * High-speed neon laser projectile entity fired by twin paddle blasters.
 */

import { LaserProjectile as ILaserProjectile, BoundingBox } from '../types';
import {
  LASER_WIDTH,
  LASER_HEIGHT,
  LASER_SPEED_Y,
  LASER_DAMAGE,
  LASER_COLOR,
  LASER_GLOW_COLOR,
} from '../constants';
import { lerp } from '../physics/MathUtils';

export interface LaserProjectileConfig {
  id?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  vy?: number;
  damage?: number;
  color?: string;
  glowColor?: string;
  isAlive?: boolean;
}

export class LaserProjectile implements ILaserProjectile {
  public id: string;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public vy: number;
  public damage: number;
  public color: string;
  public glowColor: string;
  public isAlive: boolean;

  public prevY: number;

  constructor(config: LaserProjectileConfig) {
    this.id = config.id || `laser_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.x = config.x;
    this.y = config.y;
    this.width = config.width ?? LASER_WIDTH;
    this.height = config.height ?? LASER_HEIGHT;
    this.vy = config.vy ?? LASER_SPEED_Y;
    this.damage = config.damage ?? LASER_DAMAGE;
    this.color = config.color || LASER_COLOR;
    this.glowColor = config.glowColor || LASER_GLOW_COLOR;
    this.isAlive = config.isAlive ?? true;

    this.prevY = this.y;
  }

  /**
   * Advances projectile position by vertical velocity and checks ceiling boundary.
   */
  public update(dt: number): void {
    this.prevY = this.y;
    if (!this.isAlive) return;

    this.y += this.vy * dt;

    if (this.y + this.height < 0) {
      this.isAlive = false;
    }
  }

  /**
   * Returns Axis-Aligned Bounding Box for spatial grid collision detection.
   */
  public getBounds(): BoundingBox {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Deactivates projectile upon brick impact or out-of-bounds exit.
   */
  public destroy(): void {
    this.isAlive = false;
  }

  /**
   * Renders high-energy neon beam with dual-layer glow and specular white filament core.
   */
  public render(ctx: CanvasRenderingContext2D, alpha: number = 1.0): void {
    if (!this.isAlive) return;

    const renderY = lerp(this.prevY, this.y, alpha);
    const renderX = this.x;
    const r = Math.min(this.width / 2, 2);

    ctx.save();

    // 1. Neon Bloom Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.glowColor;

    // 2. Outer Beam Body (Crimson Neon)
    ctx.fillStyle = this.color;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(renderX, renderY, this.width, this.height, r);
    } else {
      ctx.rect(renderX, renderY, this.width, this.height);
    }
    ctx.fill();

    // 3. Inner High-Intensity White Plasma Core
    ctx.shadowBlur = 0;
    const coreWidth = Math.max(1, this.width - 2);
    const coreHeight = Math.max(2, this.height - 4);
    const coreX = renderX + (this.width - coreWidth) / 2;
    const coreY = renderY + 2;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(coreX, coreY, coreWidth, coreHeight, coreWidth / 2);
    } else {
      ctx.rect(coreX, coreY, coreWidth, coreHeight);
    }
    ctx.fill();

    // 4. Leading Plasma Tip Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(renderX + this.width / 2, renderY + 2, this.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
