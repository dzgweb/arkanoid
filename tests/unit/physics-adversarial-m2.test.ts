/**
 * @file tests/unit/physics-adversarial-m2.test.ts
 * Empirical Stress Test & Property Test Suite for Milestone 2 Physics Engine:
 * 1. Continuous Collision Detection (CCD) & anti-tunneling across velocities 100 to 2000 px/s.
 * 2. Dynamic Paddle Deflection angle bounding within [-75 deg, +75 deg] for all offsets in [-1, 1] and outside [-1, 1].
 * 3. Vertical speed safeguard (|vy| >= min_vy) and horizontal trapping prevention.
 * 4. Multi-level full physics simulation across all 6 levels.
 */

import { describe, it, expect } from 'vitest';
import { CollisionSystem } from '@/game/physics/CollisionSystem';
import { PaddlePhysics } from '@/game/physics/PaddlePhysics';
import { Ball } from '@/game/entities/Ball';
import { Paddle } from '@/game/entities/Paddle';
import { BrickGridManager } from '@/game/systems/BrickGridManager';
import { ALL_LEVELS } from '@/game/levels';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MAX_PADDLE_BOUNCE_ANGLE,
  BALL_MIN_VY,
  BALL_DEFAULT_RADIUS,
  FIXED_DT,
  BRICK_WIDTH,
  BRICK_HEIGHT,
} from '@/game/constants';
import { degToRad, radToDeg } from '@/game/physics/MathUtils';

describe('Adversarial Physics Stress Suite (Milestone 2)', () => {
  // =========================================================================
  // 1. Continuous Collision Detection (CCD) & Anti-Tunneling (100 - 2000 px/s)
  // =========================================================================
  describe('1. Continuous Collision Detection (CCD) & Anti-Tunneling', () => {
    it('calculates expected sub-step count across entire speed continuum (100 to 2000 px/s)', () => {
      const radius = BALL_DEFAULT_RADIUS; // 7px
      const dt = FIXED_DT; // 1/60s

      const testSpeeds = [
        100, 200, 300, 420, 500, 600, 700, 800, 1000, 1200, 1500, 1800, 2000,
      ];

      for (const speed of testSpeeds) {
        const displacement = speed * dt;
        const substeps = CollisionSystem.calculateSubsteps(0, displacement, radius);

        // Verification: substeps must be between 1 and 4
        expect(substeps).toBeGreaterThanOrEqual(1);
        expect(substeps).toBeLessThanOrEqual(4);

        // Substep displacement should not exceed stepThreshold if substeps < 4
        const subDisplacement = displacement / substeps;
        if (substeps < 4) {
          expect(subDisplacement).toBeLessThanOrEqual(radius * 0.75 + 0.001);
        }
      }
    });

    it('empirically prevents tunneling through paddle top surface across 10,000 geometric hit trajectories at speeds 100 to 2000 px/s', () => {
      const paddle = new Paddle();
      paddle.x = 350;
      paddle.y = 640;
      paddle.width = 100;
      paddle.height = 16;
      paddle.vx = 0;

      let tunnelingCount = 0;
      let evaluatedHits = 0;
      const totalTrials = 10000;

      for (let i = 0; i < totalTrials; i++) {
        // Sweep speed from 100 to 2000 px/s
        const speed = 100 + (i / totalTrials) * 1900;
        // Sweep angle from -45 deg to +45 deg (downward motion)
        const angle = degToRad(-45 + ((i * 37) % 90));
        const vx = speed * Math.sin(angle);
        const vy = speed * Math.cos(angle); // vy > 0

        // Choose target impact point directly ON the paddle top surface: xTarget in [paddle.x + 5, paddle.x + paddle.width - 5]
        const xTarget = paddle.x + 5 + ((i * 19) % (paddle.width - 10));
        const yTarget = paddle.y - BALL_DEFAULT_RADIUS; // 633px

        // Backtrack to an initial position 1 to 5 frames earlier
        const framesBack = 0.5 + ((i * 7) % 35) / 10; // 0.5 to 4.0 frames before hit
        const initialX = xTarget - vx * (framesBack * FIXED_DT);
        const initialY = yTarget - vy * (framesBack * FIXED_DT);

        // Only evaluate if initial position is strictly above the paddle
        if (initialY >= paddle.y - BALL_DEFAULT_RADIUS) continue;

        evaluatedHits++;

        const ball = new Ball({
          x: initialX,
          y: initialY,
          vx,
          vy,
          speed,
          radius: BALL_DEFAULT_RADIUS,
          isStuckToPaddle: false,
        });

        // Run simulation for enough frames to cross the target
        let hitPaddle = false;
        const maxFrames = Math.ceil(framesBack) + 4;
        for (let frame = 0; frame < maxFrames; frame++) {
          const events = ball.update(FIXED_DT, paddle, false);
          if (events.paddleHit) {
            hitPaddle = true;
            break;
          }
          if (events.lost) {
            break;
          }
        }

        if (!hitPaddle) {
          tunnelingCount++;
        }
      }

      expect(evaluatedHits).toBeGreaterThan(9000);
      expect(tunnelingCount).toBe(0);
    });

    it('empirically prevents tunneling through canvas boundaries (left, right, top) across 10,000 randomized trajectory vectors at speeds 100 to 2000 px/s', () => {
      let boundaryTunnelingCount = 0;
      const totalTrials = 10000;

      for (let i = 0; i < totalTrials; i++) {
        const speed = 100 + (i / totalTrials) * 1900;
        // Angles pointing into left/right/top walls
        const angle = degToRad((i * 19) % 360);
        const vx = speed * Math.cos(angle);
        const vy = speed * Math.sin(angle);

        // Place ball 5px away from a boundary
        const boundaryChoice = i % 3;
        let startX = 400;
        let startY = 300;

        if (boundaryChoice === 0) {
          // Near left wall
          startX = 10;
        } else if (boundaryChoice === 1) {
          // Near right wall
          startX = CANVAS_WIDTH - 10;
        } else {
          // Near top ceiling
          startY = 10;
        }

        const ball = new Ball({
          x: startX,
          y: startY,
          vx,
          vy,
          speed,
          radius: BALL_DEFAULT_RADIUS,
          isStuckToPaddle: false,
        });

        // Run 3 physics steps
        for (let frame = 0; frame < 3; frame++) {
          ball.update(FIXED_DT);
        }

        // Ball must never breach the physical canvas boundaries (x in [radius, CANVAS_WIDTH - radius], y >= radius if not lost)
        if (ball.x < ball.radius - 0.001 || ball.x > CANVAS_WIDTH - ball.radius + 0.001) {
          boundaryTunnelingCount++;
        }
        if (ball.vy < 0 && ball.y < ball.radius - 0.001) {
          boundaryTunnelingCount++;
        }
      }

      expect(boundaryTunnelingCount).toBe(0);
    });

    it('tests substepping vs single-brick collision resolution at standard and maximum game velocities', () => {
      const speeds = [300, 420, 500, 700, 1000, 1500, 2000];

      for (const speed of speeds) {
        const brickGrid = new BrickGridManager();
        brickGrid.loadLevel({
          levelNumber: 1,
          name: 'Test Level',
          themeColor: '#06b6d4',
          matrix: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], // Single brick at row 1, col 5
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          ],
        });

        const brick = brickGrid.getActiveBricks()[0];
        expect(brick).toBeDefined();

        // Position ball directly beneath the brick moving vertically upward
        const startX = brick.x + brick.width / 2;
        const startY = brick.y + brick.height + 15; // 15px below brick bottom

        const ball = new Ball({
          x: startX,
          y: startY,
          vx: 0,
          vy: -speed,
          speed,
          radius: BALL_DEFAULT_RADIUS,
          isStuckToPaddle: false,
        });

        let hit = false;
        for (let frame = 0; frame < 15; frame++) {
          ball.update(FIXED_DT);
          const collision = brickGrid.checkBallCollisions(ball);
          if (collision.hit) {
            hit = true;
            break;
          }
        }

        expect(hit).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. Paddle Deflection Angle Bounding ([-75 deg, +75 deg])
  // =========================================================================
  describe('2. Paddle Deflection Angle Bounding ([-75 deg, +75 deg])', () => {
    const paddle = {
      x: 350,
      y: 640,
      width: 100,
      height: 16,
      vx: 0,
    };

    it('rigorously bounds reflection angle in [-75 deg, +75 deg] for 20,000 fine-grained impact offsets in [-1, 1]', () => {
      const maxAllowedRad = MAX_PADDLE_BOUNCE_ANGLE + 1e-6; // 75 deg in rad
      const steps = 20000;

      for (let i = 0; i <= steps; i++) {
        const u = -1.0 + (i / steps) * 2.0; // [-1.0, +1.0]
        const ballX = paddle.x + paddle.width / 2 + u * (paddle.width / 2);
        const ball = { x: ballX, y: 633, speed: 420 };

        const res = PaddlePhysics.calculateReflection(ball, paddle);

        // Compute exit angle theta relative to straight upward vector (0, -1)
        // theta = atan2(vx, -vy)
        const angleRad = Math.atan2(res.vx, -res.vy);
        const angleDeg = radToDeg(angleRad);

        expect(angleRad).toBeGreaterThanOrEqual(-maxAllowedRad);
        expect(angleRad).toBeLessThanOrEqual(maxAllowedRad);
        expect(angleDeg).toBeGreaterThanOrEqual(-75.0001);
        expect(angleDeg).toBeLessThanOrEqual(75.0001);

        // Speed conservation check: hypot(vx, vy) must equal ball speed
        expect(Math.hypot(res.vx, res.vy)).toBeCloseTo(420, 2);
      }
    });

    it('strictly clamps out-of-bounds impact offsets outside [-1, 1] to [-75 deg, +75 deg]', () => {
      const maxAllowedRad = MAX_PADDLE_BOUNCE_ANGLE + 1e-6;
      const extremeOffsets = [
        -1.0001, -1.05, -1.2, -1.5, -2.0, -5.0, -10.0, -100.0, -10000.0,
        1.0001, 1.05, 1.2, 1.5, 2.0, 5.0, 10.0, 100.0, 10000.0,
      ];

      for (const u of extremeOffsets) {
        const ballX = paddle.x + paddle.width / 2 + u * (paddle.width / 2);
        const ball = { x: ballX, y: 633, speed: 450 };

        const res = PaddlePhysics.calculateReflection(ball, paddle);
        const angleRad = Math.atan2(res.vx, -res.vy);
        const angleDeg = radToDeg(angleRad);

        // The offsetRatio returned must be clamped to [-1, 1]
        expect(res.offsetRatio).toBeGreaterThanOrEqual(-1.0);
        expect(res.offsetRatio).toBeLessThanOrEqual(1.0);

        // Angle must be strictly within [-75 deg, +75 deg]
        expect(angleRad).toBeGreaterThanOrEqual(-maxAllowedRad);
        expect(angleRad).toBeLessThanOrEqual(maxAllowedRad);
        expect(angleDeg).toBeGreaterThanOrEqual(-75.0001);
        expect(angleDeg).toBeLessThanOrEqual(75.0001);

        // If offset was far left (u <= -1), exit angle must be exactly -75 deg
        if (u <= -1) {
          expect(angleDeg).toBeCloseTo(-75, 2);
        }
        // If offset was far right (u >= 1), exit angle must be exactly +75 deg
        if (u >= 1) {
          expect(angleDeg).toBeCloseTo(75, 2);
        }
      }
    });

    it('preserves angle bound [-75 deg, +75 deg] under extreme tangential paddle velocity (-2000 to +2000 px/s)', () => {
      const maxAllowedRad = MAX_PADDLE_BOUNCE_ANGLE + 1e-6;
      const paddleVelocities = [-2000, -1000, -650, -300, 0, 300, 650, 1000, 2000];
      const ballSpeeds = [100, 300, 420, 700, 1500, 2000];
      const testOffsets = [-2.0, -1.0, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1.0, 2.0];

      let testCombinations = 0;

      for (const pVx of paddleVelocities) {
        for (const speed of ballSpeeds) {
          for (const u of testOffsets) {
            testCombinations++;
            const movingPaddle = { ...paddle, vx: pVx };
            const ballX = paddle.x + paddle.width / 2 + u * (paddle.width / 2);
            const ball = { x: ballX, y: 633, speed };

            const res = PaddlePhysics.calculateReflection(ball, movingPaddle);
            const angleRad = Math.atan2(res.vx, -res.vy);
            const angleDeg = radToDeg(angleRad);

            // Exit angle must remain strictly within [-75 deg, +75 deg]
            expect(angleRad).toBeGreaterThanOrEqual(-maxAllowedRad);
            expect(angleRad).toBeLessThanOrEqual(maxAllowedRad);
            expect(angleDeg).toBeGreaterThanOrEqual(-75.0001);
            expect(angleDeg).toBeLessThanOrEqual(75.0001);

            // Scalar speed must be preserved
            expect(Math.hypot(res.vx, res.vy)).toBeCloseTo(speed, 1);

            // vy must always be strictly negative (upward)
            expect(res.vy).toBeLessThan(0);
          }
        }
      }

      expect(testCombinations).toBe(paddleVelocities.length * ballSpeeds.length * testOffsets.length);
    });

    it('preserves continuity and monotonic angle progression across paddle surface', () => {
      const samplePoints = 100;
      let prevAngle = -999;

      for (let i = 0; i <= samplePoints; i++) {
        const u = -1.0 + (i / samplePoints) * 2.0; // from -1.0 to +1.0
        const ballX = paddle.x + paddle.width / 2 + u * (paddle.width / 2);
        const ball = { x: ballX, y: 633, speed: 400 };

        const res = PaddlePhysics.calculateReflection(ball, paddle);
        const angleDeg = radToDeg(Math.atan2(res.vx, -res.vy));

        if (prevAngle !== -999) {
          // Angle must strictly increase with u
          expect(angleDeg).toBeGreaterThanOrEqual(prevAngle - 1e-4);
        }
        prevAngle = angleDeg;
      }
    });
  });

  // =========================================================================
  // 3. Vertical Speed Safeguard & Horizontal Trapping Prevention
  // =========================================================================
  describe('3. Vertical Speed Safeguard (|vy| >= min_vy)', () => {
    it('verifies |vy| >= min_vy across 10,000 randomized paddle reflection conditions', () => {
      const paddle = {
        x: 350,
        y: 640,
        width: 100,
        height: 16,
        vx: 0,
      };

      const trials = 10000;
      for (let i = 0; i < trials; i++) {
        const speed = 100 + (i / trials) * 1900;
        const u = -1.5 + (i / trials) * 3.0; // [-1.5, +1.5]
        const pVx = -1000 + ((i * 17) % 2000);

        const movingPaddle = { ...paddle, vx: pVx };
        const ballX = paddle.x + paddle.width / 2 + u * (paddle.width / 2);
        const ball = { x: ballX, y: 633, speed };

        const res = PaddlePhysics.calculateReflection(ball, movingPaddle);

        // Theoretical minimum vertical escape velocity:
        // minVy = max(BALL_MIN_VY, speed * sin(15 deg))
        const expectedMinVy = Math.max(BALL_MIN_VY, speed * Math.sin(degToRad(15)));

        expect(Math.abs(res.vy)).toBeGreaterThanOrEqual(expectedMinVy - 1e-4);
        expect(res.vy).toBeLessThan(0); // Upward direction
      }
    });

    it('verifies that paddle deflection never results in horizontal trapping (vy = 0 or |vy| < BALL_MIN_VY)', () => {
      const paddle = { x: 350, y: 640, width: 100, height: 16, vx: 0 };
      const speeds = [50, 100, 200, 300, 420, 700, 1500, 2000];

      for (const speed of speeds) {
        // Test edge angles and extreme paddle velocities
        const pVxs = [-3000, -650, 0, 650, 3000];
        const offsets = [-1.0, -0.99, -0.5, 0, 0.5, 0.99, 1.0];

        for (const pVx of pVxs) {
          for (const u of offsets) {
            const ballX = paddle.x + paddle.width / 2 + u * (paddle.width / 2);
            const ball = { x: ballX, y: 633, speed };
            const res = PaddlePhysics.calculateReflection(ball, { ...paddle, vx: pVx });

            expect(Math.abs(res.vy)).toBeGreaterThanOrEqual(BALL_MIN_VY - 1e-4);
            expect(res.vy).toBeLessThan(0);
          }
        }
      }
    });

    it('simulates 5,000 ticks of continuous multi-surface bounces and confirms |vy| never degenerates to zero', () => {
      const paddle = new Paddle();
      paddle.x = 350;
      paddle.y = 640;
      paddle.width = 100;
      paddle.height = 16;
      paddle.vx = 0;

      const ball = new Ball({
        x: 400,
        y: 600,
        vx: 300,
        vy: -300,
        speed: 420,
        radius: BALL_DEFAULT_RADIUS,
        isStuckToPaddle: false,
      });

      let minObservedVy = Infinity;

      for (let tick = 0; tick < 5000; tick++) {
        // Oscillate paddle back and forth
        paddle.x = 350 + Math.sin(tick * 0.05) * 200;
        paddle.vx = Math.cos(tick * 0.05) * 200;

        // If ball falls below paddle, bounce it back up via shield to keep simulation active
        ball.update(FIXED_DT, paddle, true);

        const absVy = Math.abs(ball.vy);
        if (absVy > 0 && absVy < minObservedVy) {
          minObservedVy = absVy;
        }

        // Horizontal velocity check: ball must not get stuck with vy === 0
        expect(absVy).toBeGreaterThan(0);
      }

      expect(minObservedVy).toBeGreaterThanOrEqual(BALL_MIN_VY - 1e-4);
    });
  });

  // =========================================================================
  // 4. Multi-Level Physics Trajectory & Grid Stress Testing
  // =========================================================================
  describe('4. Multi-Level Physics Trajectory & Grid Stress Testing', () => {
    it('simulates high-speed ball gameplay across all 6 level layouts without physical anomalies', () => {
      for (const layout of ALL_LEVELS) {
        const grid = new BrickGridManager();
        grid.loadLevel(layout);

        const paddle = new Paddle();
        paddle.x = 350;
        paddle.y = 640;

        const ball = new Ball({
          x: 400,
          y: 600,
          vx: 350,
          vy: -350,
          speed: 500,
          radius: BALL_DEFAULT_RADIUS,
          isStuckToPaddle: false,
        });

        let totalHits = 0;

        // Simulate 2000 physics steps per level layout
        for (let step = 0; step < 2000; step++) {
          // AI paddle tracks ball x
          paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - paddle.width, ball.x - paddle.width / 2));

          ball.update(FIXED_DT, paddle, true);
          const hitRes = grid.checkBallCollisions(ball);
          if (hitRes.hit) {
            totalHits++;
          }
          grid.update(FIXED_DT);

          // Physical integrity invariants
          expect(Number.isFinite(ball.x)).toBe(true);
          expect(Number.isFinite(ball.y)).toBe(true);
          expect(Number.isFinite(ball.vx)).toBe(true);
          expect(Number.isFinite(ball.vy)).toBe(true);
          expect(ball.x).toBeGreaterThanOrEqual(0);
          expect(ball.x).toBeLessThanOrEqual(CANVAS_WIDTH);
        }

        expect(totalHits).toBeGreaterThan(0);
      }
    });
  });
});
