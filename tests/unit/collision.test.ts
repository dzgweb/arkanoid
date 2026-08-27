/**
 * @file tests/unit/collision.test.ts
 * Vitest unit test suite for Continuous Collision Detection, substepping,
 * contact normals, penetration resolution, and boundary clamping.
 */

import { describe, it, expect } from 'vitest';
import { CollisionSystem } from '@/game/physics/CollisionSystem';
import { circleAABBOverlap, lineCircleIntersection, reflectVector } from '@/game/physics/MathUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SHIELD_Y } from '@/game/constants';

describe('CollisionSystem & Geometric Physics Math', () => {
  describe('Continuous Sub-stepping Calculation', () => {
    it('calculates 1 sub-step for low displacement', () => {
      const steps = CollisionSystem.calculateSubsteps(2, 2, 7);
      expect(steps).toBe(1);
    });

    it('calculates 2-4 sub-steps for high velocity displacement without exceeding clamp of 4', () => {
      // 700 px/s over 1/60s = ~11.66 px displacement; with radius 7 (threshold = 5.25), ceil(11.66/5.25) = 3
      const stepsHigh = CollisionSystem.calculateSubsteps(0, 12, 7);
      expect(stepsHigh).toBe(3);

      // Extreme velocity (2000 px/s = 33.3 px displacement) clamped to 4
      const stepsExtreme = CollisionSystem.calculateSubsteps(0, 35, 7);
      expect(stepsExtreme).toBe(4);
    });
  });

  describe('Circle vs AABB Contact Normal & Penetration', () => {
    const box = { x: 100, y: 100, width: 60, height: 20 };

    it('detects top contact normal (0, -1)', () => {
      const circle = { x: 130, y: 95, radius: 7 }; // center 5px above top edge y=100
      const result = CollisionSystem.testCircleAABB(circle, box);

      expect(result.hasCollision).toBe(true);
      expect(result.contactSide).toBe('top');
      expect(result.normal.x).toBeCloseTo(0, 4);
      expect(result.normal.y).toBeCloseTo(-1, 4);
      expect(result.penetration).toBeCloseTo(2, 4); // 7 - 5 = 2px
    });

    it('detects bottom contact normal (0, 1)', () => {
      const circle = { x: 130, y: 124, radius: 7 }; // center 4px below bottom edge y=120
      const result = CollisionSystem.testCircleAABB(circle, box);

      expect(result.hasCollision).toBe(true);
      expect(result.contactSide).toBe('bottom');
      expect(result.normal.x).toBeCloseTo(0, 4);
      expect(result.normal.y).toBeCloseTo(1, 4);
      expect(result.penetration).toBeCloseTo(3, 4);
    });

    it('detects left contact normal (-1, 0)', () => {
      const circle = { x: 96, y: 110, radius: 7 }; // center 4px left of x=100
      const result = CollisionSystem.testCircleAABB(circle, box);

      expect(result.hasCollision).toBe(true);
      expect(result.contactSide).toBe('left');
      expect(result.normal.x).toBeCloseTo(-1, 4);
      expect(result.normal.y).toBeCloseTo(0, 4);
      expect(result.penetration).toBeCloseTo(3, 4);
    });

    it('detects right contact normal (1, 0)', () => {
      const circle = { x: 164, y: 110, radius: 7 }; // center 4px right of x=160
      const result = CollisionSystem.testCircleAABB(circle, box);

      expect(result.hasCollision).toBe(true);
      expect(result.contactSide).toBe('right');
      expect(result.normal.x).toBeCloseTo(1, 4);
      expect(result.normal.y).toBeCloseTo(0, 4);
      expect(result.penetration).toBeCloseTo(3, 4);
    });

    it('returns hasCollision: false when circle does not touch AABB', () => {
      const circle = { x: 50, y: 50, radius: 7 };
      const result = CollisionSystem.testCircleAABB(circle, box);
      expect(result.hasCollision).toBe(false);
      expect(result.penetration).toBe(0);
    });
  });

  describe('Penetration Resolution & Velocity Reflection', () => {
    it('displaces ball out of collision along normal and reflects velocity', () => {
      const ball = { x: 130, y: 95, vx: 100, vy: 300, radius: 7 };
      const box = { x: 100, y: 100, width: 60, height: 20 };
      const collision = CollisionSystem.testCircleAABB(ball, box);

      CollisionSystem.resolveCircleCollision(ball, collision);

      expect(ball.y).toBeCloseTo(93, 2); // 95 + (-1 * 2) = 93
      expect(ball.vy).toBeCloseTo(-300, 2); // Inverted vertical velocity
      expect(ball.vx).toBeCloseTo(100, 2);  // Horizontal velocity preserved
    });
  });

  describe('Boundary Collisions [0, 800] x [0, 700]', () => {
    it('reflects ball on left boundary at x = 0', () => {
      const ball = { x: 4, y: 200, vx: -300, vy: 100, radius: 7 };
      const res = CollisionSystem.checkBoundaryCollision(ball, false);

      expect(res.hitBoundary).toBe('left');
      expect(ball.x).toBe(7);
      expect(ball.vx).toBe(300);
    });

    it('reflects ball on right boundary at x = 800', () => {
      const ball = { x: 798, y: 200, vx: 300, vy: 100, radius: 7 };
      const res = CollisionSystem.checkBoundaryCollision(ball, false);

      expect(res.hitBoundary).toBe('right');
      expect(ball.x).toBe(800 - 7);
      expect(ball.vx).toBe(-300);
    });

    it('reflects ball on top ceiling at y = 0', () => {
      const ball = { x: 400, y: 4, vx: 100, vy: -300, radius: 7 };
      const res = CollisionSystem.checkBoundaryCollision(ball, false);

      expect(res.hitBoundary).toBe('top');
      expect(ball.y).toBe(7);
      expect(ball.vy).toBe(300);
    });

    it('bounces ball off shield barrier when active at y = 692', () => {
      const ball = { x: 400, y: 690, vx: 100, vy: 300, radius: 7 };
      const res = CollisionSystem.checkBoundaryCollision(ball, true);

      expect(res.hitBoundary).toBe('shield');
      expect(ball.y).toBe(SHIELD_Y - 7);
      expect(ball.vy).toBe(-300);
    });

    it('flags lost ball when falling below y = 700 without shield', () => {
      const ball = { x: 400, y: 710, vx: 100, vy: 300, radius: 7 };
      const res = CollisionSystem.checkBoundaryCollision(ball, false);

      expect(res.hitBoundary).toBe('bottom');
      expect(res.lost).toBe(true);
    });
  });
});
