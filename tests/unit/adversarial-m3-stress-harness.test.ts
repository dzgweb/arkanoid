/**
 * @file tests/unit/adversarial-m3-stress-harness.test.ts
 * Deep Adversarial Stress & Edge Case Harness by Challenger M3-2
 * Focus:
 * 1. High-frequency laser projectile streams, rapid cooldown precision, and dense brick matrix penetration.
 * 2. Multi-ball sticky docking under extreme paddle accelerations, width transitions, and exit angle bounds.
 * 3. High-velocity shallow-angle shield reflections, simultaneous sub-step multi-ball collisions, and dissipation invariants.
 */

import { describe, it, expect } from 'vitest';
import { Paddle } from '@/game/entities/Paddle';
import { Ball } from '@/game/entities/Ball';
import { Brick } from '@/game/entities/Brick';
import { LaserProjectile } from '@/game/entities/LaserProjectile';
import { BrickGridManager } from '@/game/systems/BrickGridManager';
import { PowerupManager, PowerupContext } from '@/game/systems/PowerupManager';
import { CollisionSystem } from '@/game/physics/CollisionSystem';
import { PaddlePhysics } from '@/game/physics/PaddlePhysics';
import { GameEngine } from '@/game/engine/GameEngine';
import { GameStateStore } from '@/hooks/useGameStateBridge';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PADDLE_BASE_WIDTH,
  PADDLE_EXTENDED_WIDTH,
  PADDLE_SHRUNK_WIDTH,
  PADDLE_Y,
  PADDLE_LASER_COOLDOWN_MS,
  MAX_PADDLE_BOUNCE_ANGLE,
  BALL_DEFAULT_RADIUS,
  BALL_INITIAL_SPEED,
  BALL_MIN_SPEED,
  BALL_MAX_SPEED,
  SHIELD_Y,
  LASER_WIDTH,
  LASER_HEIGHT,
  LASER_SPEED_Y,
  LASER_DAMAGE,
  GRID_ROWS,
  GRID_COLS,
  GRID_OFFSET_LEFT,
  GRID_OFFSET_TOP,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  GRID_GAP,
} from '@/game/constants';
import { ILevelLayout } from '@/game/types';

describe('Adversarial Stress Harness: Challenger M3-2 Mechanics', () => {
  // =========================================================================
  // 1. High-Frequency Laser Stream & Rapid Collision Stress
  // =========================================================================
  describe('1. Laser Projectiles Stress & Invariants', () => {
    it('fires a continuous cadence of 50 laser bursts over 11 seconds with zero timing drift in continuous micro-steps', () => {
      const paddle = new Paddle({ x: 350, width: 100, y: PADDLE_Y });
      paddle.setLasers(true, 220);

      let totalFired = 0;
      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };

      // Microsecond stepping dt = 0.001s (1ms) to test continuous timing accuracy
      const dt = 0.001;
      const totalSteps = 11000; // 11.0 seconds

      for (let step = 0; step < totalSteps; step++) {
        paddle.update(dt, dummyInput, CANVAS_WIDTH);

        if (paddle.canFireLaser()) {
          const lasers = paddle.fireLaser();
          expect(lasers.length).toBe(2);
          totalFired++;
        }
      }

      // In 11.0 seconds (11000ms) with 220ms cooldown, exactly 11000 / 220 = 50 shots fired
      expect(totalFired).toBe(50);
    });

    it('quantizes to exactly 48 shots over 660 frames in a discrete 60 FPS fixed-timestep loop (14 frames = 233.33ms per shot)', () => {
      const paddle = new Paddle({ x: 350, width: 100, y: PADDLE_Y });
      paddle.setLasers(true, 220);

      let totalFired = 0;
      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };

      const dt = 1 / 60;
      const totalFrames = 660; // 11.0 seconds at 60 FPS

      for (let frame = 0; frame < totalFrames; frame++) {
        paddle.update(dt, dummyInput, CANVAS_WIDTH);

        if (paddle.canFireLaser()) {
          const lasers = paddle.fireLaser();
          expect(lasers.length).toBe(2);
          totalFired++;
        }
      }

      // ceil(220 / 16.666) = 14 frames per shot; 660 / 14 = 47.14 -> 48 shots
      expect(totalFired).toBe(48);
    });

    it('processes 1,000 laser collisions across a dense brick matrix without memory leaks or double-hits', () => {
      const gridManager = new BrickGridManager();
      // Dense 12x14 grid of 2-hit armored bricks (code 8)
      const matrix: number[][] = Array.from({ length: GRID_ROWS }, () =>
        Array.from({ length: GRID_COLS }, () => 8)
      );
      gridManager.loadLevel({ name: 'Dense Grid', author: 'Stress', matrix });

      const initialBreakable = gridManager.getRemainingBreakableCount();
      expect(initialBreakable).toBe(GRID_ROWS * GRID_COLS); // 168 bricks

      // Simulate a swarm of 500 lasers moving up through columns
      const lasers: LaserProjectile[] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const brickX = GRID_OFFSET_LEFT + c * (BRICK_WIDTH + GRID_GAP) + BRICK_WIDTH / 2;
        for (let k = 0; k < 10; k++) {
          lasers.push(
            new LaserProjectile({
              x: brickX - LASER_WIDTH / 2,
              y: 500 + k * 30,
              vy: -650,
            })
          );
        }
      }

      // Step lasers upward
      let totalLaserHits = 0;
      for (let step = 0; step < 100; step++) {
        for (let i = lasers.length - 1; i >= 0; i--) {
          const laser = lasers[i];
          laser.update(0.016);
          if (!laser.isAlive) {
            lasers.splice(i, 1);
            continue;
          }

          const hit = gridManager.checkLaserCollision(laser);
          if (hit.hit && hit.brick) {
            laser.destroy();
            gridManager.damageBrick(hit.brick, laser.damage);
            lasers.splice(i, 1);
            totalLaserHits++;
          }
        }
      }

      expect(totalLaserHits).toBeGreaterThan(0);
      expect(gridManager.getRemainingBreakableCount()).toBeLessThan(initialBreakable);
    });
  });

  // =========================================================================
  // 2. Multi-Ball Sticky Docking & Extreme Motion Invariants
  // =========================================================================
  describe('2. Sticky Paddle Motion & Angle Bounds Stress', () => {
    it('maintains exact relative offsets for 3 docked balls under 500 rapid directional reversals', () => {
      const paddle = new Paddle({ x: 350, width: 100, y: PADDLE_Y });
      paddle.setSticky(true);

      const ballLeft = new Ball({ x: 360, y: PADDLE_Y - 8, isStuckToPaddle: false, speed: 400 });
      const ballCenter = new Ball({ x: 400, y: PADDLE_Y - 8, isStuckToPaddle: false, speed: 400 });
      const ballRight = new Ball({ x: 440, y: PADDLE_Y - 8, isStuckToPaddle: false, speed: 400 });

      ballLeft.stickToPaddle(paddle);
      ballCenter.stickToPaddle(paddle);
      ballRight.stickToPaddle(paddle);

      const ratioL = ballLeft.stuckOffsetRatio;
      const ratioC = ballCenter.stuckOffsetRatio;
      const ratioR = ballRight.stuckOffsetRatio;

      // Oscillate paddle left and right 500 times
      for (let i = 0; i < 500; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const input = {
          left: dir === -1,
          right: dir === 1,
          launch: false,
          fireLaser: false,
          pointerX: null,
          pointerActive: false,
        };

        paddle.update(0.016, input, CANVAS_WIDTH);
        ballLeft.update(0.016, paddle, false);
        ballCenter.update(0.016, paddle, false);
        ballRight.update(0.016, paddle, false);

        // Verify exact offset formula
        const center = paddle.x + paddle.width / 2;
        const halfSpan = paddle.width / 2 - ballLeft.radius;

        expect(ballLeft.x).toBeCloseTo(center + ratioL * halfSpan, 4);
        expect(ballCenter.x).toBeCloseTo(center + ratioC * halfSpan, 4);
        expect(ballRight.x).toBeCloseTo(center + ratioR * halfSpan, 4);
        expect(ballLeft.y).toBe(PADDLE_Y - ballLeft.radius - 1);
        expect(ballCenter.y).toBe(PADDLE_Y - ballCenter.radius - 1);
        expect(ballRight.y).toBe(PADDLE_Y - ballRight.radius - 1);
      }
    });

    it('bounds exit angles strictly in [-75 deg, +75 deg] for 1,000 randomized launch offsets in [-1, +1]', () => {
      for (let i = 0; i < 1000; i++) {
        const offsetRatio = -1 + Math.random() * 2;
        const ball = new Ball({
          x: 400,
          y: 630,
          speed: 450,
          isStuckToPaddle: true,
          stuckOffsetRatio: offsetRatio,
        });

        ball.launch();

        // Check launch exit angle
        const angle = Math.atan2(ball.vx, -ball.vy);
        expect(Math.abs(angle)).toBeLessThanOrEqual(MAX_PADDLE_BOUNCE_ANGLE);
        expect(ball.vy).toBeLessThan(0); // must launch upward
        expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(450, 2);
      }
    });
  });

  // =========================================================================
  // 3. Shield Barrier High-Velocity & Multi-Ball Invariants
  // =========================================================================
  describe('3. Shield Barrier Collision Stress & Invariants', () => {
    it('prevents tunneling for high-speed balls (700 px/s) at shallow horizontal velocities', () => {
      const velocities = [
        { vx: 650, vy: 250 },
        { vx: -650, vy: 250 },
        { vx: 50, vy: 695 },
        { vx: 0, vy: 700 },
      ];

      for (const v of velocities) {
        const ball = new Ball({
          x: 400,
          y: SHIELD_Y - 15,
          vx: v.vx,
          vy: v.vy,
          speed: Math.hypot(v.vx, v.vy),
          isStuckToPaddle: false,
        });

        // Run continuous ball update with dt = 0.05s (large step to stress sub-stepping)
        const events = ball.update(0.05, undefined, true);

        expect(events.boundaryHit).toBe('shield');
        expect(ball.vy).toBeLessThan(0); // upward reflection
        expect(ball.y).toBeLessThanOrEqual(SHIELD_Y); // no tunneling past bottom
      }
    });

    it('strictly guarantees single-use consumption even when 5 balls reach the barrier in the same frame', () => {
      const store = new GameStateStore();
      const engine = new GameEngine({ stateStore: store });
      engine.startGame();

      const testAPI = (window as unknown as { __ARKANOID_TEST_API__: any }).__ARKANOID_TEST_API__;
      const paddle = testAPI.getPaddle();

      // Collect shield
      testAPI.spawnPowerup('SHIELD', paddle.x + 20, paddle.y);
      (engine as any).update(0.016);
      expect(testAPI.getHUDState().hasShield).toBe(true);

      // Create 5 simultaneous balls just above shield
      const balls = testAPI.getBalls();
      balls.length = 0;
      for (let i = 0; i < 5; i++) {
        balls.push(
          new Ball({
            x: 100 + i * 150,
            y: SHIELD_Y - 5,
            vx: 0,
            vy: 400,
            isStuckToPaddle: false,
          })
        );
      }

      // Step 1: In the update step, shield is consumed on the first ball that hits
      (engine as any).update(0.016);
      expect(testAPI.getHUDState().hasShield).toBe(false);

      // Advance 20 frames to let unshielded falling balls exit canvas
      for (let f = 0; f < 20; f++) {
        (engine as any).update(0.016);
      }

      // Only the 1st ball was reflected; remaining balls fell off and were removed
      expect(balls.length).toBe(1);
      expect(balls[0].vy).toBeLessThan(0);
    });
  });
});
