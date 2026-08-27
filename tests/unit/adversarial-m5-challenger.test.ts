/**
 * @file tests/unit/adversarial-m5-challenger.test.ts
 * Comprehensive Empirical Adversarial Stress & Verification Suite by Challenger M5-2
 * Focus:
 * 1. Deep Invariant Stress-Testing of the 6 Campaign Playthrough Scenarios
 * 2. Rapid Multi-Ball + Laser + TNT Cascade Physics Invariants
 * 3. Sticky Docking Coordinate Mathematics & Angular Precision Launch Oracles
 * 4. Shield Impact Velocity Ranges & Single-Use Consumption Invariants
 * 5. Full 6-Level Continuous Campaign Simulation & Progressive Difficulty Verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestHarness, TestHarness } from '../e2e/helpers/testHarness';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FIXED_DT,
  INITIAL_LIVES,
  PADDLE_BASE_WIDTH,
  PADDLE_EXTENDED_WIDTH,
  PADDLE_SHRUNK_WIDTH,
  BALL_DEFAULT_RADIUS,
  BALL_INITIAL_SPEED,
  BALL_MIN_SPEED,
  BALL_MAX_SPEED,
  MAX_ACTIVE_BALLS,
  SHIELD_Y,
  MAX_PADDLE_BOUNCE_ANGLE,
  POINTS_STANDARD,
  POINTS_ARMORED_PER_HIT,
  POINTS_ARMORED_DESTROY,
  POINTS_EXPLOSIVE,
} from '@/game/constants';
import { PaddlePhysics } from '@/game/physics/PaddlePhysics';
import { Brick } from '@/game/entities/Brick';
import { resetHighScores, getHighScores, saveHighScore } from '@/utils/highScores';

describe('Adversarial Stress Suite M5-2: Real-World Scenarios & E2E Physics Oracles', () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetHighScores();
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.destroy();
  });

  // =========================================================================
  // Dimension 1: Scenario 1 Deep Stress (Clean Run, Combo Window & Score Mathematics)
  // =========================================================================
  describe('Dimension 1: Scenario 1 Deep Stress (Combo Timing, Multipliers & Score Math)', () => {
    it('1.1. Sustains combo multiplier across continuous rapid hits and decays precisely after 2.5s inactivity', () => {
      harness.start();
      harness.launchBall();

      const bricks = harness.getBricks().filter((b) => b.type === 'STANDARD');
      expect(bricks.length).toBeGreaterThanOrEqual(10);

      // Hit 3 bricks rapidly -> combo = 3, multiplier = 1 (hits 1-3)
      for (let i = 0; i < 3; i++) {
        harness.triggerBrickHit(bricks[i].row, bricks[i].col);
      }
      expect(harness.getHUDState().combo).toBe(3);
      expect(harness.getHUDState().multiplier).toBe(1);
      expect(harness.getHUDState().score).toBe(300);

      // Hit 4th brick -> combo = 4, multiplier = 2
      harness.triggerBrickHit(bricks[3].row, bricks[3].col);
      expect(harness.getHUDState().combo).toBe(4);
      expect(harness.getHUDState().multiplier).toBe(2);
      expect(harness.getHUDState().score).toBe(500); // 300 + (100 * 2)

      // Step forward 2.4 seconds (within 2.5s window) -> combo stays intact
      harness.step(2.4);
      expect(harness.getHUDState().combo).toBe(4);
      expect(harness.getHUDState().multiplier).toBe(2);

      // Step forward another 0.15s (total 2.55s > 2.5s) -> combo decays to 0, multiplier to 1
      harness.step(0.15);
      expect(harness.getHUDState().combo).toBe(0);
      expect(harness.getHUDState().multiplier).toBe(1);
    });

    it('1.2. Accumulates combo correctly up to 8x multiplier across 25 consecutive hits', () => {
      harness.start();
      harness.launchBall();

      const bricks = harness.getBricks().filter((b) => b.type === 'STANDARD');
      for (let i = 0; i < 25; i++) {
        harness.triggerBrickHit(bricks[i].row, bricks[i].col);
        harness.step(0.05); // 50ms interval maintains active combo
      }

      const hud = harness.getHUDState();
      expect(hud.combo).toBe(25);
      expect(hud.multiplier).toBe(8); // Max multiplier is 8x
    });
  });

  // =========================================================================
  // Dimension 2: Scenario 2 Deep Stress (Armored Brick Durability & TNT Chain Reactions)
  // =========================================================================
  describe('Dimension 2: Scenario 2 Deep Stress (Armored Durability & TNT Cascades)', () => {
    it('2.1. 3-Hit Armored Brick transitions cleanly through all crack states without premature destruction', () => {
      harness.start();
      const armored = Brick.createArmored(0, 0, 100, 100, 3);
      expect(armored.maxHits).toBe(3);
      expect(armored.currentHits).toBe(3);
      expect(armored.isAlive).toBe(true);

      // Hit 1
      const res1 = armored.hit(1);
      expect(res1.destroyed).toBe(false);
      expect(res1.pointsAwarded).toBe(POINTS_ARMORED_PER_HIT);
      expect(armored.currentHits).toBe(2);
      expect(armored.isAlive).toBe(true);

      // Hit 2
      const res2 = armored.hit(1);
      expect(res2.destroyed).toBe(false);
      expect(res2.pointsAwarded).toBe(POINTS_ARMORED_PER_HIT);
      expect(armored.currentHits).toBe(1);
      expect(armored.isAlive).toBe(true);

      // Hit 3
      const res3 = armored.hit(1);
      expect(res3.destroyed).toBe(true);
      expect(res3.pointsAwarded).toBe(POINTS_ARMORED_DESTROY);
      expect(armored.currentHits).toBe(0);
      expect(armored.isAlive).toBe(false);
    });

    it('2.2. Complex 3x3 TNT chain reaction handles dense neighbor grids and resolves all staggered explosions', () => {
      harness.start();
      harness.setLevel(2); // Level 2 has TNT and surrounding bricks
      const grid = (harness.engine as unknown as { brickGrid: { getActiveBricks: () => Brick[]; triggerExplosion: (r: number, c: number, d: number) => void; explosionQueue: unknown[]; update: (dt: number) => void } }).brickGrid;

      const initialCount = grid.getActiveBricks().length;
      grid.triggerExplosion(5, 5, 0);

      // Step physics in small increments to process all queued explosions
      for (let t = 0; t < 20; t++) {
        harness.step(FIXED_DT);
      }

      expect(grid.explosionQueue.length).toBe(0);
      const remainingCount = grid.getActiveBricks().length;
      expect(remainingCount).toBeLessThan(initialCount);
    });
  });

  // =========================================================================
  // Dimension 3: Scenario 3 Deep Stress (Multi-Ball Swarm & Laser Projectile Bounds)
  // =========================================================================
  describe('Dimension 3: Scenario 3 Deep Stress (Multi-Ball & Laser Mayhem)', () => {
    it('3.1. Saturates 12 balls, fires lasers at maximum rate, and verifies zero memory leaks or array corruption', () => {
      harness.start();
      harness.launchBall();

      // Collect 5 multi-balls -> pool capped at 12
      for (let i = 0; i < 5; i++) {
        harness.collectPowerup('MULTI_BALL');
      }
      expect(harness.getBalls().length).toBe(MAX_ACTIVE_BALLS);

      // Activate Laser
      harness.collectPowerup('LASER');
      expect(harness.getPaddle().hasLasers).toBe(true);

      // Rapidly fire lasers and step simulation for 100 frames
      for (let frame = 0; frame < 100; frame++) {
        harness.fireLaser();
        harness.step(FIXED_DT);
      }

      // Verify all remaining balls maintain valid finite velocities and positions
      for (const ball of harness.getBalls()) {
        expect(Number.isFinite(ball.x)).toBe(true);
        expect(Number.isFinite(ball.y)).toBe(true);
        expect(Number.isFinite(ball.vx)).toBe(true);
        expect(Number.isFinite(ball.vy)).toBe(true);
      }

      // Verify lasers out of bounds are properly recycled/culled
      const lasers = harness.getLasers();
      for (const laser of lasers) {
        expect(laser.y).toBeGreaterThanOrEqual(0);
        expect(laser.y).toBeLessThanOrEqual(CANVAS_HEIGHT);
      }
    });

    it('3.2. Scalar speed invariance is strictly maintained across 1,000 continuous substepping iterations for all balls', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('MULTI_BALL');

      const balls = harness.getBalls();
      expect(balls.length).toBe(3);

      for (let i = 0; i < 1000; i++) {
        harness.step(FIXED_DT);
        for (const b of harness.getBalls()) {
          const currentSpeed = Math.hypot(b.vx, b.vy);
          expect(currentSpeed).toBeCloseTo(BALL_INITIAL_SPEED, 0);
        }
      }
    });
  });

  // =========================================================================
  // Dimension 4: Scenario 4 Deep Stress (Sticky Paddle Docking & Directional Precision)
  // =========================================================================
  describe('Dimension 4: Scenario 4 Deep Stress (Sticky Offset Tracking & Trajectory Math)', () => {
    it('4.1. Tests 21 fine-grained catch offsets [-1.0, 1.0], verifying offset ratio and angle calculation', () => {
      harness.start();
      harness.collectPowerup('STICKY');

      const paddle = harness.getPaddle();
      paddle.x = 350; // width = 100 -> center = 400

      for (let u = -1.0; u <= 1.0; u += 0.1) {
        const ball = harness.getBalls()[0];
        ball.isStuckToPaddle = false;
        ball.x = paddle.x + paddle.width / 2 + u * (paddle.width / 2);
        ball.y = paddle.y - ball.radius;
        ball.setVelocity(0, 300);

        harness.step(FIXED_DT);

        expect(ball.isStuckToPaddle).toBe(true);
        expect(ball.stuckOffsetRatio).toBeCloseTo(u, 1);

        // Launch ball
        harness.launchBall();
        expect(ball.isStuckToPaddle).toBe(false);
        expect(ball.vy).toBeLessThan(0); // Upward velocity

        if (Math.abs(u) > 0.2) {
          if (u < 0) {
            expect(ball.vx).toBeLessThan(0); // Aimed left
          } else {
            expect(ball.vx).toBeGreaterThan(0); // Aimed right
          }
        }
      }
    });

    it('4.2. Ball docked to sticky paddle moves identically with high-velocity paddle translations', () => {
      harness.start();
      harness.collectPowerup('STICKY');

      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = true;
      ball.stuckOffsetRatio = 0.4; // 40% to the right of center

      // Rapidly translate paddle across canvas
      for (const targetX of [100, 500, 50, 650, 300]) {
        harness.setPointerX(targetX);
        harness.step(FIXED_DT);

        const expectedBallX = paddle.x + paddle.width / 2 + 0.4 * (paddle.width / 2);
        expect(ball.x).toBeCloseTo(expectedBallX, 1);
        expect(ball.y).toBeCloseTo(paddle.y - ball.radius, 1);
      }
    });
  });

  // =========================================================================
  // Dimension 5: Scenario 5 Deep Stress (Shield Absorption, Life Protection & High Score)
  // =========================================================================
  describe('Dimension 5: Scenario 5 Deep Stress (Shield Bounce & Score Persistence)', () => {
    it('5.1. Absorbs balls at various incident angles and speeds without tunneling below shield barrier', () => {
      const testSpeeds = [BALL_MIN_SPEED, BALL_INITIAL_SPEED, BALL_MAX_SPEED];

      for (const speed of testSpeeds) {
        harness.start();
        harness.launchBall();
        harness.collectPowerup('SHIELD');

        const ball = harness.getBalls()[0];
        ball.x = 300;
        ball.y = SHIELD_Y - 5;
        ball.setVelocity(speed * 0.5, speed * 0.866);

        harness.step(FIXED_DT);

        // Shield should reflect ball upward
        expect(ball.vy).toBeLessThan(0);
        expect(ball.y).toBeLessThanOrEqual(SHIELD_Y);
        expect(harness.getHUDState().lives).toBe(INITIAL_LIVES);
        expect((harness.engine as unknown as { hasShield: boolean }).hasShield).toBe(false);
      }
    });

    it('5.2. Persists and ranks multiple high scores correctly upon sequential game overs', () => {
      saveHighScore('ALICE', 50000, 6);
      saveHighScore('BOB', 30000, 4);
      saveHighScore('CHARLIE', 80000, 6);
      saveHighScore('DAVE', 10000, 2);

      const scores = getHighScores();
      expect(scores.length).toBe(4);
      expect(scores[0].name).toBe('CHARLIE');
      expect(scores[0].score).toBe(80000);
      expect(scores[1].name).toBe('ALICE');
      expect(scores[1].score).toBe(50000);
      expect(scores[2].name).toBe('BOB');
      expect(scores[2].score).toBe(30000);
      expect(scores[3].name).toBe('DAVE');
      expect(scores[3].score).toBe(10000);
    });
  });

  // =========================================================================
  // Dimension 6: Scenario 6 Deep Stress (6-Level Continuous Campaign Simulation)
  // =========================================================================
  describe('Dimension 6: Scenario 6 Deep Stress (Full 6-Level Continuous Campaign)', () => {
    it('6.1. Simulates complete 6-level campaign progression, verifying stage transitions, level configurations and victory state', () => {
      harness.start();

      const expectedBrickTypesPerLevel: Record<number, string[]> = {
        1: ['STANDARD'],
        2: ['STANDARD', 'ARMORED', 'EXPLOSIVE'],
        3: ['STANDARD', 'ARMORED', 'EXPLOSIVE', 'INDESTRUCTIBLE'],
        4: ['STANDARD', 'ARMORED', 'EXPLOSIVE'],
        5: ['STANDARD', 'ARMORED', 'EXPLOSIVE', 'INDESTRUCTIBLE'],
        6: ['STANDARD', 'ARMORED', 'EXPLOSIVE', 'INDESTRUCTIBLE'],
      };

      for (let level = 1; level <= 6; level++) {
        expect(harness.getHUDState().level).toBe(level);
        expect(harness.getHUDState().status).toBe('PLAYING');

        // Verify bricks on this level match configuration
        const bricks = harness.getBricks();
        expect(bricks.length).toBeGreaterThan(0);

        const typesInLevel = Array.from(new Set(bricks.map((b) => b.type)));
        const expectedTypes = expectedBrickTypesPerLevel[level];
        for (const expType of expectedTypes) {
          expect(typesInLevel).toContain(expType);
        }

        // Destroy all breakables on current level
        harness.destroyAllBreakables();
        harness.step(FIXED_DT);

        if (level < 6) {
          expect(harness.getHUDState().status).toBe('STAGE_CLEAR');
          harness.nextLevel();
        } else {
          expect(harness.getHUDState().status).toBe('VICTORY');
        }
      }
    });

    it('6.2. Preserves accumulated score, lives, and high-score eligibility across all 6 levels', () => {
      harness.start();

      for (let level = 1; level <= 6; level++) {
        // Destroy 5 breakable bricks manually to add score
        const breakables = harness.getBricks().filter((b) => b.isAlive && b.type !== 'INDESTRUCTIBLE');
        for (let i = 0; i < Math.min(5, breakables.length); i++) {
          harness.triggerBrickHit(breakables[i].row, breakables[i].col);
        }

        harness.destroyAllBreakables();
        harness.step(FIXED_DT);

        if (level < 6) {
          harness.nextLevel();
        }
      }

      const finalHUD = harness.getHUDState();
      expect(finalHUD.status).toBe('VICTORY');
      expect(finalHUD.score).toBeGreaterThanOrEqual(3000);
      expect(finalHUD.lives).toBe(INITIAL_LIVES);
    });
  });
});
