/**
 * @file game/entities/Paddle.ts
 * Paddle entity implementation with keyboard/pointer tracking,
 * smooth width animation transitions, twin laser cannons, and sticky catch mechanics.
 */

import { Paddle as IPaddle, InputState, ActivePowerup, BoundingBox } from '../types';
import {
  PADDLE_BASE_WIDTH,
  PADDLE_EXTENDED_WIDTH,
  PADDLE_SHRUNK_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  PADDLE_KEYBOARD_SPEED,
  PADDLE_COLOR,
  PADDLE_GLOW_COLOR,
  PADDLE_LASER_COOLDOWN_MS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  LASER_WIDTH,
  LASER_HEIGHT,
  LASER_SPEED_Y,
  LASER_DAMAGE,
  LASER_COLOR,
  LASER_GLOW_COLOR,
} from '../constants';
import { clamp, lerp } from '../physics/MathUtils';
import { LaserProjectile } from './LaserProjectile';
import type { Ball } from './Ball';

export class Paddle implements IPaddle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public baseWidth: number;
  public targetWidth: number;
  public vx: number;
  public speed: number;
  public hasLasers: boolean;
  public laserCooldownMs: number;
  public laserTimerMs: number;
  public isSticky: boolean;
  public color: string;
  public glowColor: string;
  public targetX?: number;

  public heldBalls: Ball[];
  public prevX: number;

  constructor(config: Partial<IPaddle> = {}) {
    this.baseWidth = config.baseWidth ?? PADDLE_BASE_WIDTH;
    this.width = config.width ?? this.baseWidth;
    this.targetWidth = this.width;
    this.height = config.height ?? PADDLE_HEIGHT;
    this.x = config.x ?? (CANVAS_WIDTH - this.width) / 2;
    this.y = config.y ?? PADDLE_Y;
    this.vx = config.vx ?? 0;
    this.speed = config.speed ?? PADDLE_KEYBOARD_SPEED;
    this.hasLasers = config.hasLasers ?? false;
    this.laserCooldownMs = config.laserCooldownMs ?? PADDLE_LASER_COOLDOWN_MS;
    this.laserTimerMs = config.laserTimerMs ?? 0;
    this.isSticky = config.isSticky ?? false;
    this.color = config.color || PADDLE_COLOR;
    this.glowColor = config.glowColor || PADDLE_GLOW_COLOR;
    this.targetX = config.targetX;

    this.heldBalls = [];
    this.prevX = this.x;
  }

  /**
   * Updates paddle position based on keyboard or pointer input,
   * animates width transitions, decrements laser cooldowns, and clamps within bounds.
   */
  public update(dt: number, inputState: InputState, canvasWidth: number = CANVAS_WIDTH): void {
    this.prevX = this.x;

    // 1. Update horizontal position
    if (inputState.pointerActive && inputState.pointerX !== null) {
      const desiredX = inputState.pointerX - this.width / 2;
      const clampedX = clamp(desiredX, 0, canvasWidth - this.width);
      this.vx = dt > 0 ? (clampedX - this.x) / dt : 0;
      this.x = clampedX;
    } else {
      let moveDir = 0;
      if (inputState.left) moveDir -= 1;
      if (inputState.right) moveDir += 1;

      this.vx = moveDir * this.speed;
      this.x += this.vx * dt;

      const clampedX = clamp(this.x, 0, canvasWidth - this.width);
      if (clampedX !== this.x) {
        this.x = clampedX;
        this.vx = 0;
      }
    }

    // 2. Smooth width animation transition (250ms lerp for 50px delta = 200px/s)
    if (Math.abs(this.width - this.targetWidth) > 0.5) {
      const oldWidth = this.width;
      const widthStep = 200 * dt;
      if (this.width < this.targetWidth) {
        this.width = Math.min(this.targetWidth, this.width + widthStep);
      } else {
        this.width = Math.max(this.targetWidth, this.width - widthStep);
      }
      const deltaW = this.width - oldWidth;
      this.x = clamp(this.x - deltaW / 2, 0, canvasWidth - this.width);
    } else {
      this.width = this.targetWidth;
    }

    // 3. Laser cooldown countdown
    if (this.laserTimerMs > 0) {
      this.laserTimerMs = Math.max(0, this.laserTimerMs - dt * 1000);
    }
  }

  /**
   * Synchronizes active power-up modifiers with paddle state.
   */
  public setPowerupState(powerups: ActivePowerup[]): void {
    let hasLaserPowerup = false;
    let hasStickyPowerup = false;
    let widthTarget = this.baseWidth;

    for (const p of powerups) {
      if (p.type === 'LASER' || p.type === 'LASER_PADDLE') {
        hasLaserPowerup = true;
      }
      if (p.type === 'STICKY' || p.type === 'STICKY_PADDLE') {
        hasStickyPowerup = true;
      }
      if (p.type === 'EXTEND' || p.type === 'EXTEND_PADDLE') {
        widthTarget = PADDLE_EXTENDED_WIDTH;
      }
      if (p.type === 'SHRINK' || p.type === 'SHRINK_PADDLE') {
        widthTarget = PADDLE_SHRUNK_WIDTH;
      }
    }

    this.hasLasers = hasLaserPowerup;
    this.isSticky = hasStickyPowerup;
    this.targetWidth = widthTarget;
  }

  /**
   * Sets laser firing state directly.
   */
  public setLasers(enabled: boolean, cooldownMs?: number): void {
    this.hasLasers = enabled;
    if (cooldownMs !== undefined) {
      this.laserCooldownMs = cooldownMs;
    }
    if (!enabled) {
      this.laserTimerMs = 0;
    }
  }

  /**
   * Sets sticky catch paddle state directly.
   */
  public setSticky(enabled: boolean): void {
    this.isSticky = enabled;
  }

  /**
   * Sets target paddle width.
   */
  public setWidth(newWidth: number, instant: boolean = false): void {
    this.targetWidth = newWidth;
    if (instant) {
      this.width = newWidth;
      this.x = clamp(this.x, 0, CANVAS_WIDTH - this.width);
    }
  }

  /**
   * Checks if laser cannon is ready to fire.
   */
  public canFireLaser(): boolean {
    return this.hasLasers && this.laserTimerMs <= 0;
  }

  /**
   * Fires dual laser projectiles from left and right cannon ports.
   */
  public fireLaser(): LaserProjectile[] {
    if (!this.canFireLaser()) {
      return [];
    }

    this.laserTimerMs = this.laserCooldownMs;
    const leftCannonX = this.x + 6;
    const rightCannonX = this.x + this.width - 6 - LASER_WIDTH;
    const spawnY = this.y - LASER_HEIGHT;

    const leftProjectile = new LaserProjectile({
      id: `laser_${Date.now()}_l_${Math.random().toString(36).slice(2, 6)}`,
      x: leftCannonX,
      y: spawnY,
      width: LASER_WIDTH,
      height: LASER_HEIGHT,
      vy: LASER_SPEED_Y,
      damage: LASER_DAMAGE,
      color: LASER_COLOR,
      glowColor: LASER_GLOW_COLOR,
      isAlive: true,
    });

    const rightProjectile = new LaserProjectile({
      id: `laser_${Date.now()}_r_${Math.random().toString(36).slice(2, 6)}`,
      x: rightCannonX,
      y: spawnY,
      width: LASER_WIDTH,
      height: LASER_HEIGHT,
      vy: LASER_SPEED_Y,
      damage: LASER_DAMAGE,
      color: LASER_COLOR,
      glowColor: LASER_GLOW_COLOR,
      isAlive: true,
    });

    return [leftProjectile, rightProjectile];
  }

  public fireLasers(): LaserProjectile[] {
    return this.fireLaser();
  }

  /**
   * Attaches a caught ball to the paddle.
   */
  public catchBall(ball: Ball): void {
    if (!this.heldBalls.includes(ball)) {
      this.heldBalls.push(ball);
      ball.stickToPaddle(this);
    }
  }

  /**
   * Releases all currently held balls.
   */
  public releaseHeldBalls(): void {
    for (const ball of this.heldBalls) {
      if (ball.isStuckToPaddle) {
        ball.launch();
      }
    }
    this.heldBalls = [];
  }

  public releaseBall(): void {
    this.releaseHeldBalls();
  }

  /**
   * Returns current bounding box.
   */
  public getBoundingBox(): BoundingBox {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Resets paddle to initial state.
   */
  public reset(canvasWidth: number = CANVAS_WIDTH, canvasHeight: number = CANVAS_HEIGHT): void {
    this.width = this.baseWidth;
    this.targetWidth = this.baseWidth;
    this.x = (canvasWidth - this.width) / 2;
    this.y = PADDLE_Y;
    this.vx = 0;
    this.hasLasers = false;
    this.isSticky = false;
    this.laserTimerMs = 0;
    this.heldBalls = [];
    this.prevX = this.x;
  }

  /**
   * Renders the paddle with neon styling, end caps, and power-up adornments.
   */
  public render(ctx: CanvasRenderingContext2D, alpha: number = 1.0): void {
    const renderX = lerp(this.prevX, this.x, alpha);
    const renderY = this.y;
    const r = 4;

    ctx.save();

    // 1. Neon Glow Shadow
    ctx.shadowBlur = 14;
    ctx.shadowColor = this.isSticky ? 'rgba(245, 158, 11, 0.7)' : this.glowColor;

    // 2. Main Paddle Body (Rounded Rect)
    const gradient = ctx.createLinearGradient(renderX, renderY, renderX, renderY + this.height);
    if (this.hasLasers) {
      gradient.addColorStop(0, '#fda4af');
      gradient.addColorStop(0.5, '#f43f5e');
      gradient.addColorStop(1, '#9f1239');
    } else if (this.isSticky) {
      gradient.addColorStop(0, '#fef08a');
      gradient.addColorStop(0.5, '#f59e0b');
      gradient.addColorStop(1, '#b45309');
    } else {
      gradient.addColorStop(0, '#67e8f9');
      gradient.addColorStop(0.5, '#06b6d4');
      gradient.addColorStop(1, '#0e7490');
    }

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(renderX, renderY, this.width, this.height, r);
    } else {
      ctx.rect(renderX, renderY, this.width, this.height);
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. Top Specular Highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(renderX + 4, renderY + 2, this.width - 8, 3);

    // 4. End Bumper Caps
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(renderX, renderY + 3, 3, this.height - 6);
    ctx.fillRect(renderX + this.width - 3, renderY + 3, 3, this.height - 6);

    // 5. Twin Blaster Cannons rendering
    if (this.hasLasers) {
      ctx.fillStyle = '#f43f5e';
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(244, 63, 94, 0.9)';

      // Left cannon barrel (protruding to y - 8)
      ctx.fillRect(renderX + 6, renderY - 8, 4, 8);
      // Right cannon barrel (protruding to y - 8)
      ctx.fillRect(renderX + this.width - 10, renderY - 8, 4, 8);

      // Glowing emitter diode tips
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(renderX + 8, renderY - 8, 1.5, 0, Math.PI * 2);
      ctx.arc(renderX + this.width - 8, renderY - 8, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Sticky Catch Energy Field
    if (this.isSticky) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      ctx.lineDashOffset = -now / 40;
      ctx.beginPath();
      ctx.moveTo(renderX + 4, renderY - 2);
      ctx.lineTo(renderX + this.width - 4, renderY - 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}
