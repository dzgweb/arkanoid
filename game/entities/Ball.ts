/**
 * @file game/entities/Ball.ts
 * Ball entity implementation with continuous sub-stepping physics,
 * paddle sticky/launch mechanics, neon trail rendering, and speed modifiers.
 */

import { Ball as IBall } from '../types';
import {
  BALL_DEFAULT_RADIUS,
  BALL_INITIAL_SPEED,
  BALL_MIN_SPEED,
  BALL_MAX_SPEED,
  BALL_SPEED_STEP_PER_HIT,
  BALL_COLOR,
  BALL_GLOW_COLOR,
  BALL_TRAIL_LENGTH,
  MAX_PADDLE_BOUNCE_ANGLE,
} from '../constants';
import { clamp, lerp } from '../physics/MathUtils';
import { CollisionSystem } from '../physics/CollisionSystem';
import { PaddlePhysics, PaddleDeflectionResult } from '../physics/PaddlePhysics';
import { Paddle } from './Paddle';

export interface BallTrailNode {
  x: number;
  y: number;
  alpha: number;
}

export interface BallUpdateEvents {
  boundaryHit?: 'left' | 'right' | 'top' | 'bottom' | 'shield';
  paddleHit?: PaddleDeflectionResult;
  lost?: boolean;
}

export class Ball implements IBall {
  public id: string;
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public radius: number;
  public speed: number;
  public isStuckToPaddle: boolean;
  public stuckOffsetRatio: number;
  public color: string;
  public glowColor: string;
  public trail: BallTrailNode[];

  public prevX: number;
  public prevY: number;

  constructor(config: Partial<IBall> = {}) {
    this.id = config.id || `ball_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.x = config.x ?? 400;
    this.y = config.y ?? 620;
    this.vx = config.vx ?? 0;
    this.vy = config.vy ?? 0;
    this.radius = config.radius ?? BALL_DEFAULT_RADIUS;
    this.speed = config.speed ?? BALL_INITIAL_SPEED;
    this.isStuckToPaddle = config.isStuckToPaddle ?? true;
    this.stuckOffsetRatio = config.stuckOffsetRatio ?? 0;
    this.color = config.color || BALL_COLOR;
    this.glowColor = config.glowColor || BALL_GLOW_COLOR;
    this.trail = config.trail ? [...config.trail] : [];

    this.prevX = this.x;
    this.prevY = this.y;

    if (!this.isStuckToPaddle && this.vx === 0 && this.vy === 0) {
      this.vy = -this.speed;
    }
  }

  /**
   * Updates ball position, handles stuck state, sub-stepping,
   * boundary collisions, and paddle collisions.
   */
  public update(
    dt: number,
    paddle?: Paddle,
    shieldActive: boolean = false
  ): BallUpdateEvents {
    this.prevX = this.x;
    this.prevY = this.y;
    const events: BallUpdateEvents = {};

    // 1. If ball is stuck to paddle, track paddle motion
    if (this.isStuckToPaddle && paddle) {
      const paddleCenter = paddle.x + paddle.width / 2;
      const halfWidth = paddle.width / 2;
      this.x = paddleCenter + this.stuckOffsetRatio * (halfWidth - this.radius);
      this.y = paddle.y - this.radius - 1;
      this.vx = 0;
      this.vy = 0;
      this.updateTrail();
      return events;
    }

    // 2. Compute sub-steps for continuous collision detection
    const totalDx = this.vx * dt;
    const totalDy = this.vy * dt;
    const substeps = CollisionSystem.calculateSubsteps(totalDx, totalDy, this.radius);
    const subDt = dt / substeps;

    for (let step = 0; step < substeps; step++) {
      this.x += this.vx * subDt;
      this.y += this.vy * subDt;

      // Check boundary collisions
      const boundRes = CollisionSystem.checkBoundaryCollision(this, shieldActive);
      if (boundRes.hitBoundary) {
        events.boundaryHit = boundRes.hitBoundary;
      }
      if (boundRes.lost) {
        events.lost = true;
        break;
      }

      // Check paddle collision if paddle provided
      if (paddle && this.vy > 0) {
        const paddleHit = PaddlePhysics.testAndResolvePaddleHit(this, paddle);
        if (paddleHit) {
          events.paddleHit = paddleHit;
          if (paddle.isSticky) {
            this.stickToPaddle(paddle);
            paddle.catchBall(this);
            break;
          }
        }
      }
    }

    // 3. Update trail positions
    this.updateTrail();

    return events;
  }

  /**
   * Appends current position to trail and truncates to max trail length.
   */
  private updateTrail(): void {
    if (!this.isStuckToPaddle) {
      this.trail.unshift({ x: this.x, y: this.y, alpha: 1.0 });
    }
    if (this.trail.length > BALL_TRAIL_LENGTH) {
      this.trail.length = BALL_TRAIL_LENGTH;
    }
    for (let i = 0; i < this.trail.length; i++) {
      this.trail[i].alpha = 1.0 - i / BALL_TRAIL_LENGTH;
    }
  }

  /**
   * Launches ball from paddle. Exit angle can be explicitly supplied
   * or computed from stuckOffsetRatio mapped to [-75 deg, +75 deg].
   */
  public launch(exitAngleRad?: number): void {
    if (!this.isStuckToPaddle) return;

    this.isStuckToPaddle = false;
    let angle: number;

    if (exitAngleRad !== undefined) {
      angle = exitAngleRad;
    } else {
      angle = this.stuckOffsetRatio * MAX_PADDLE_BOUNCE_ANGLE * 0.8;
    }

    this.vx = this.speed * Math.sin(angle);
    this.vy = -this.speed * Math.cos(angle);
  }

  /**
   * Sticks ball to paddle and records relative offset ratio.
   */
  public stickToPaddle(paddle: Paddle): void {
    this.isStuckToPaddle = true;
    this.stuckOffsetRatio = PaddlePhysics.calculateImpactOffset(this.x, paddle.x, paddle.width);
    this.vx = 0;
    this.vy = 0;
  }

  /**
   * Applies speed scaling factor (e.g. 0.7 for SLOW, 1.3 for FAST).
   */
  public applySpeedModifier(factor: number): void {
    this.setSpeed(this.speed * factor);
  }

  /**
   * Sets absolute ball speed, clamping between BALL_MIN_SPEED and BALL_MAX_SPEED,
   * and scales current velocity vector to match.
   */
  public setSpeed(newSpeed: number): void {
    this.speed = clamp(newSpeed, BALL_MIN_SPEED, BALL_MAX_SPEED);
    const mag = Math.hypot(this.vx, this.vy);
    if (mag > 0) {
      this.vx = (this.vx / mag) * this.speed;
      this.vy = (this.vy / mag) * this.speed;
    }
  }

  /**
   * Increments ball speed upon brick destruction.
   */
  public incrementSpeed(step: number = BALL_SPEED_STEP_PER_HIT): void {
    this.setSpeed(this.speed + step);
  }

  /**
   * Directly sets velocity vector and updates speed magnitude.
   */
  public setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
    this.speed = Math.hypot(vx, vy);
  }

  /**
   * Resets ball to starting state attached to paddle.
   */
  public reset(paddleX: number, paddleY: number, paddleWidth: number): void {
    this.radius = BALL_DEFAULT_RADIUS;
    this.speed = BALL_INITIAL_SPEED;
    this.isStuckToPaddle = true;
    this.stuckOffsetRatio = 0;
    this.x = paddleX + paddleWidth / 2;
    this.y = paddleY - this.radius - 1;
    this.vx = 0;
    this.vy = 0;
    this.trail = [];
    this.prevX = this.x;
    this.prevY = this.y;
  }

  /**
   * Renders ball and its neon trail to canvas 2D context.
   */
  public render(ctx: CanvasRenderingContext2D, alpha: number = 1.0): void {
    const renderX = lerp(this.prevX, this.x, alpha);
    const renderY = lerp(this.prevY, this.y, alpha);

    ctx.save();

    // 1. Render motion trail
    if (!this.isStuckToPaddle && this.trail.length > 0) {
      for (let i = 0; i < this.trail.length; i++) {
        const node = this.trail[i];
        const nodeRadius = this.radius * (1 - (i / this.trail.length) * 0.5);
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${node.alpha * 0.35})`;
        ctx.fill();
      }
    }

    // 2. Render neon glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.glowColor;

    // 3. Render main ball body
    ctx.beginPath();
    ctx.arc(renderX, renderY, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // 4. Render specular highlight
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(renderX - this.radius * 0.3, renderY - this.radius * 0.3, this.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();

    ctx.restore();
  }
}
