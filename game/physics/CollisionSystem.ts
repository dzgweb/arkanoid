/**
 * @file game/physics/CollisionSystem.ts
 * Continuous Circle-to-AABB collision detection, normal calculation,
 * penetration resolution, and boundary clamping.
 */

import { Vector2D, BoundingBox, Circle } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SHIELD_Y } from '../constants';
import { clamp, reflectVector } from './MathUtils';

export type ContactSide = 'top' | 'bottom' | 'left' | 'right' | 'corner';

export interface CollisionResult {
  hasCollision: boolean;
  contactPoint: Vector2D;
  normal: Vector2D;
  penetration: number;
  contactSide: ContactSide;
}

export interface BoundaryCollisionResult {
  hitBoundary?: 'left' | 'right' | 'top' | 'bottom' | 'shield';
  lost?: boolean;
}

export class CollisionSystem {
  /**
   * Calculates sub-step count N to prevent tunneling:
   * N = clamp(ceil(displacement / (radius * 0.75)), 1, 4)
   */
  public static calculateSubsteps(dx: number, dy: number, radius: number): number {
    const displacement = Math.hypot(dx, dy);
    const stepThreshold = Math.max(1, radius * 0.75);
    const n = Math.ceil(displacement / stepThreshold);
    return clamp(n, 1, 4);
  }

  /**
   * Performs static Circle vs AABB collision detection.
   * Calculates contact normal, penetration depth, and contact side.
   */
  public static testCircleAABB(circle: Circle, box: BoundingBox): CollisionResult {
    const minX = box.x;
    const maxX = box.x + box.width;
    const minY = box.y;
    const maxY = box.y + box.height;

    // Find closest point on AABB to circle center
    const closestX = clamp(circle.x, minX, maxX);
    const closestY = clamp(circle.y, minY, maxY);

    const diffX = circle.x - closestX;
    const diffY = circle.y - closestY;
    const distSq = diffX * diffX + diffY * diffY;

    // No overlap
    if (distSq > circle.radius * circle.radius) {
      return {
        hasCollision: false,
        contactPoint: { x: closestX, y: closestY },
        normal: { x: 0, y: 0 },
        penetration: 0,
        contactSide: 'top',
      };
    }

    const dist = Math.sqrt(distSq);

    // Case 1: Circle center is outside or exactly on boundary of AABB
    if (dist > 0.0001) {
      const normalX = diffX / dist;
      const normalY = diffY / dist;
      const penetration = circle.radius - dist;

      // Determine contact side based on closest point location
      let contactSide: ContactSide = 'corner';
      const isHorizontalEdge = closestX > minX && closestX < maxX;
      const isVerticalEdge = closestY > minY && closestY < maxY;

      if (isHorizontalEdge) {
        contactSide = normalY < 0 ? 'top' : 'bottom';
      } else if (isVerticalEdge) {
        contactSide = normalX < 0 ? 'left' : 'right';
      } else {
        contactSide = 'corner';
      }

      return {
        hasCollision: true,
        contactPoint: { x: closestX, y: closestY },
        normal: { x: normalX, y: normalY },
        penetration,
        contactSide,
      };
    }

    // Case 2: Circle center is strictly inside AABB (deep penetration)
    const dLeft = circle.x - minX;
    const dRight = maxX - circle.x;
    const dTop = circle.y - minY;
    const dBottom = maxY - circle.y;

    const minPen = Math.min(dLeft, dRight, dTop, dBottom);

    if (minPen === dTop) {
      return {
        hasCollision: true,
        contactPoint: { x: circle.x, y: minY },
        normal: { x: 0, y: -1 },
        penetration: circle.radius + dTop,
        contactSide: 'top',
      };
    } else if (minPen === dBottom) {
      return {
        hasCollision: true,
        contactPoint: { x: circle.x, y: maxY },
        normal: { x: 0, y: 1 },
        penetration: circle.radius + dBottom,
        contactSide: 'bottom',
      };
    } else if (minPen === dLeft) {
      return {
        hasCollision: true,
        contactPoint: { x: minX, y: circle.y },
        normal: { x: -1, y: 0 },
        penetration: circle.radius + dLeft,
        contactSide: 'left',
      };
    } else {
      return {
        hasCollision: true,
        contactPoint: { x: maxX, y: circle.y },
        normal: { x: 1, y: 0 },
        penetration: circle.radius + dRight,
        contactSide: 'right',
      };
    }
  }

  /**
   * Resolves collision for a circle entity by pushing it out along the normal
   * and reflecting its velocity vector (if moving towards the surface).
   */
  public static resolveCircleCollision(
    ball: { x: number; y: number; vx: number; vy: number; radius: number },
    collision: CollisionResult
  ): { vx: number; vy: number } {
    if (!collision.hasCollision) {
      return { vx: ball.vx, vy: ball.vy };
    }

    // Positional correction to eliminate overlap
    ball.x += collision.normal.x * collision.penetration;
    ball.y += collision.normal.y * collision.penetration;

    // Only reflect velocity if ball is moving into surface (dot product < 0)
    const dot = ball.vx * collision.normal.x + ball.vy * collision.normal.y;
    if (dot < 0) {
      const newV = reflectVector({ x: ball.vx, y: ball.vy }, collision.normal);
      ball.vx = newV.x;
      ball.vy = newV.y;
    }

    return { vx: ball.vx, vy: ball.vy };
  }

  /**
   * Checks and resolves ball collisions against canvas boundaries [0, 800] x [0, 700].
   */
  public static checkBoundaryCollision(
    ball: { x: number; y: number; vx: number; vy: number; radius: number },
    hasShield: boolean = false,
    bounds: { width: number; height: number } = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
  ): BoundaryCollisionResult {
    const result: BoundaryCollisionResult = {};

    // Left wall collision
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      if (ball.vx < 0) {
        ball.vx = Math.abs(ball.vx);
      }
      result.hitBoundary = 'left';
    }

    // Right wall collision
    if (ball.x + ball.radius > bounds.width) {
      ball.x = bounds.width - ball.radius;
      if (ball.vx > 0) {
        ball.vx = -Math.abs(ball.vx);
      }
      result.hitBoundary = 'right';
    }

    // Top ceiling collision
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      if (ball.vy < 0) {
        ball.vy = Math.abs(ball.vy);
      }
      result.hitBoundary = 'top';
    }

    // Shield Floor barrier collision
    if (hasShield && ball.y + ball.radius >= SHIELD_Y && ball.vy > 0) {
      ball.y = SHIELD_Y - ball.radius;
      ball.vy = -Math.abs(ball.vy);
      result.hitBoundary = 'shield';
      return result;
    }

    // Bottom loss line collision
    if (ball.y - ball.radius > bounds.height) {
      result.hitBoundary = 'bottom';
      result.lost = true;
    }

    return result;
  }
}
