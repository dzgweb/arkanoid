/**
 * @file game/physics/PaddlePhysics.ts
 * Dynamic angle paddle deflection, tangential velocity transfer,
 * and minimum vertical velocity safeguards.
 */

import { Vector2D } from '../types';
import { MAX_PADDLE_BOUNCE_ANGLE, BALL_MIN_VY } from '../constants';
import { clamp, degToRad } from './MathUtils';

export interface PaddleDeflectionResult {
  hit: boolean;
  offsetRatio: number; // u in [-1, 1]
  vx: number;
  vy: number;
  contactPoint: Vector2D;
}

export class PaddlePhysics {
  /** Minimum vertical escape angle (15 degrees) */
  private static readonly MIN_VERTICAL_ANGLE = degToRad(15);
  /** Tangential velocity transfer bias (20%) */
  private static readonly TANGENTIAL_BIAS = 0.20;

  /**
   * Computes normalized impact offset ratio u in [-1, 1].
   * u = (x_ball - x_paddle_center) / (w_paddle / 2)
   */
  public static calculateImpactOffset(ballX: number, paddleX: number, paddleWidth: number): number {
    const paddleCenter = paddleX + paddleWidth / 2;
    const halfWidth = paddleWidth / 2;
    if (halfWidth === 0) return 0;
    return clamp((ballX - paddleCenter) / halfWidth, -1, 1);
  }

  /**
   * Calculates dynamic reflection velocity vector when ball hits paddle:
   * 1. Maps u in [-1, 1] to exit angle theta in [-75 deg, +75 deg] relative to (0, -1).
   * 2. Adds 20% tangential paddle velocity bias.
   * 3. Re-normalizes to preserve ball speed.
   * 4. Enforces minimum vertical speed safeguard |vy| >= speed * sin(15 deg).
   */
  public static calculateReflection(
    ball: { x: number; y: number; speed: number },
    paddle: { x: number; y: number; width: number; height: number; vx: number }
  ): PaddleDeflectionResult {
    const u = this.calculateImpactOffset(ball.x, paddle.x, paddle.width);
    const maxAngle = MAX_PADDLE_BOUNCE_ANGLE; // 75 deg in rad (~1.309)
    const bounceAngle = u * maxAngle;

    const currentSpeed = Math.max(100, ball.speed);

    // Step 1: Base exit velocity relative to (0, -1) [straight up]
    let vx = currentSpeed * Math.sin(bounceAngle);
    let vy = -currentSpeed * Math.cos(bounceAngle);

    // Step 2: Tangential paddle velocity transfer (20% bias)
    vx += paddle.vx * this.TANGENTIAL_BIAS;

    // Step 3: Re-normalize to maintain original scalar speed
    const newMag = Math.hypot(vx, vy);
    if (newMag > 0) {
      vx = (vx / newMag) * currentSpeed;
      vy = (vy / newMag) * currentSpeed;
    }

    // Step 4: Enforce minimum upward vertical speed (|vy| >= speed * sin(15 deg) and BALL_MIN_VY)
    const minVy = Math.max(BALL_MIN_VY, currentSpeed * Math.sin(this.MIN_VERTICAL_ANGLE));
    if (Math.abs(vy) < minVy || vy > 0) {
      vy = -minVy;
      const remainingVxSq = Math.max(0, currentSpeed * currentSpeed - vy * vy);
      vx = (vx < 0 ? -1 : 1) * Math.sqrt(remainingVxSq);
    }

    return {
      hit: true,
      offsetRatio: u,
      vx,
      vy,
      contactPoint: {
        x: ball.x,
        y: paddle.y,
      },
    };
  }

  /**
   * Tests and resolves ball collision with the paddle.
   * Repositions ball above paddle to prevent multi-hit sticking.
   */
  public static testAndResolvePaddleHit(
    ball: { x: number; y: number; vx: number; vy: number; radius: number; speed: number },
    paddle: { x: number; y: number; width: number; height: number; vx: number }
  ): PaddleDeflectionResult | null {
    // Only collide if ball is moving downwards towards the paddle
    if (ball.vy <= 0) {
      return null;
    }

    // Broadphase / narrowphase check for top surface of paddle
    const paddleTop = paddle.y;
    const paddleBottom = paddle.y + paddle.height;
    const paddleLeft = paddle.x;
    const paddleRight = paddle.x + paddle.width;

    // Check if circle intersects top half of paddle
    const closestX = clamp(ball.x, paddleLeft, paddleRight);
    const closestY = clamp(ball.y, paddleTop, paddleBottom);
    const distSq = (ball.x - closestX) ** 2 + (ball.y - closestY) ** 2;

    if (distSq <= ball.radius * ball.radius && ball.y <= paddleTop + paddle.height * 0.75) {
      // Reposition ball directly on top of paddle
      ball.y = paddleTop - ball.radius - 0.5;

      // Compute dynamic reflection
      const reflection = this.calculateReflection(ball, paddle);
      ball.vx = reflection.vx;
      ball.vy = reflection.vy;

      return reflection;
    }

    return null;
  }
}
