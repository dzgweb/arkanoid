/**
 * @file game/entities/PowerupCapsule.ts
 * Collectible power-up capsule entity with kinematic downward descent,
 * sinusoidal horizontal wobble animation, sub-frame interpolation, and neon pill rendering.
 */

import {
  PowerupCapsule as IPowerupCapsule,
  PowerupType,
  BoundingBox,
  Vector2D,
} from '../types';
import {
  CAPSULE_WIDTH,
  CAPSULE_HEIGHT,
  CAPSULE_RADIUS,
  CAPSULE_SPEED_Y,
  CAPSULE_WOBBLE_FREQ,
  CAPSULE_WOBBLE_AMP,
  POWERUP_CONFIGS,
  CANVAS_HEIGHT,
} from '../constants';
import { lerp, aabbOverlap } from '../physics/MathUtils';

export interface PowerupCapsuleConfig {
  id?: string;
  type: PowerupType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  vy?: number;
  spawnTime?: number;
  color?: string;
  glowColor?: string;
  letter?: string;
  label?: string;
}

export class PowerupCapsule implements IPowerupCapsule {
  public readonly id: string;
  public readonly type: PowerupType;
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;
  public readonly width: number;
  public readonly height: number;
  public vy: number;
  public readonly spawnTime: number;
  public elapsedTime: number;
  public readonly color: string;
  public readonly glowColor: string;
  public readonly letter: string;
  public readonly label: string;
  public isAlive: boolean;

  constructor(config: PowerupCapsuleConfig) {
    const baseConfig = POWERUP_CONFIGS[config.type] || {
      type: config.type,
      letter: '?',
      label: 'Power-up',
      color: '#38bdf8',
      glowColor: 'rgba(56, 189, 248, 0.7)',
      weight: 10,
    };

    this.id = config.id || `capsule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.type = config.type;
    this.width = config.width ?? CAPSULE_WIDTH;
    this.height = config.height ?? CAPSULE_HEIGHT;
    this.x = config.x;
    this.y = config.y;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vy = config.vy ?? CAPSULE_SPEED_Y;
    this.spawnTime = config.spawnTime ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.elapsedTime = 0;
    this.color = config.color || baseConfig.color;
    this.glowColor = config.glowColor || baseConfig.glowColor;
    this.letter = config.letter || baseConfig.letter;
    this.label = config.label || baseConfig.label;
    this.isAlive = true;
  }

  /**
   * Updates capsule position along downward velocity vector,
   * advances wobble timer, and detects canvas boundary exit.
   */
  public update(dt: number, canvasHeight: number = CANVAS_HEIGHT): { outOfBounds: boolean } {
    if (!this.isAlive) {
      return { outOfBounds: true };
    }

    this.prevX = this.x;
    this.prevY = this.y;
    this.elapsedTime += dt;
    this.y += this.vy * dt;

    if (this.y > canvasHeight + 10) {
      this.isAlive = false;
      return { outOfBounds: true };
    }

    return { outOfBounds: false };
  }

  /**
   * Calculates the current horizontal sinusoidal wobble offset in pixels.
   */
  public getWobbleOffset(timeOverrideSeconds?: number): number {
    const t = timeOverrideSeconds ?? this.elapsedTime;
    return Math.sin(t * CAPSULE_WOBBLE_FREQ) * CAPSULE_WOBBLE_AMP;
  }

  /**
   * Returns current bounding box, optionally incorporating dynamic wobble displacement.
   */
  public getBounds(includeWobble: boolean = true): BoundingBox {
    const offsetX = includeWobble ? this.getWobbleOffset() : 0;
    return {
      x: this.x + offsetX,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Returns center coordinates of the capsule.
   */
  public getCenter(includeWobble: boolean = true): Vector2D {
    const bounds = this.getBounds(includeWobble);
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  /**
   * Tests AABB intersection against paddle bounding box.
   */
  public checkCollision(paddleBounds: BoundingBox): boolean {
    if (!this.isAlive) return false;
    const capsuleBounds = this.getBounds(true);
    return aabbOverlap(capsuleBounds, paddleBounds);
  }

  /**
   * Renders the capsule pill with smooth sub-frame interpolation and neon glow.
   */
  public render(ctx: CanvasRenderingContext2D, alpha: number = 1.0): void {
    if (!this.isAlive) return;

    const renderY = lerp(this.prevY, this.y, alpha);
    const wobble = this.getWobbleOffset();
    const renderX = lerp(this.prevX, this.x, alpha) + wobble;
    const halfH = this.height / 2;
    const radius = Math.min(CAPSULE_RADIUS, halfH);

    ctx.save();

    // 1. Neon Glow Shadow
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.glowColor;

    // 2. Pill Shape Gradient Body
    const gradient = ctx.createLinearGradient(renderX, renderY, renderX, renderY + this.height);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.25, this.color);
    gradient.addColorStop(1, '#0f172a');

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(renderX, renderY, this.width, this.height, radius);
    } else {
      ctx.moveTo(renderX + radius, renderY);
      ctx.lineTo(renderX + this.width - radius, renderY);
      ctx.arcTo(renderX + this.width, renderY, renderX + this.width, renderY + radius, radius);
      ctx.lineTo(renderX + this.width, renderY + this.height - radius);
      ctx.arcTo(renderX + this.width, renderY + this.height, renderX + this.width - radius, renderY + this.height, radius);
      ctx.lineTo(renderX + radius, renderY + this.height);
      ctx.arcTo(renderX, renderY + this.height, renderX, renderY + this.height - radius, radius);
      ctx.lineTo(renderX, renderY + radius);
      ctx.arcTo(renderX, renderY, renderX + radius, renderY, radius);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. Crisp Inner Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Upper Specular Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(
      renderX + this.width / 2,
      renderY + 3.5,
      this.width * 0.35,
      2,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // 5. Letter Identifier Badge
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 3;
    ctx.fillText(
      this.letter,
      renderX + this.width / 2,
      renderY + this.height / 2 + 0.5
    );

    ctx.restore();
  }
}
