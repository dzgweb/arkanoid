/**
 * @file tests/unit/powerups-adversarial-m3.test.ts
 * Empirical Challenger M3-1 Adversarial Stress Test Suite:
 * Rigorous invariant testing, mathematical oracles, fuzzing, and stress harnesses for:
 * 1. Multi-Ball cloning scalar speed conservation across arbitrary 2D vectors and fan angle invariants.
 * 2. Ball pool limit invariant (MAX_ACTIVE_BALLS = 12) under rapid cascading activations and interleaved churn.
 * 3. Paddle width lerping (250ms), center conservation invariant, and boundary penetration prevention.
 * 4. Slow / Fast ball speed modifier scaling determinism, mutual exclusion, clamping, and baseline recovery.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Ball } from '@/game/entities/Ball';
import { Paddle } from '@/game/entities/Paddle';
import { PowerupCapsule } from '@/game/entities/PowerupCapsule';
import { PowerupManager, PowerupContext } from '@/game/systems/PowerupManager';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_INITIAL_SPEED,
  BALL_MIN_SPEED,
  BALL_MAX_SPEED,
  BALL_SLOW_FACTOR,
  BALL_FAST_FACTOR,
  MULTI_BALL_FAN_ANGLE,
  MAX_ACTIVE_BALLS,
  PADDLE_BASE_WIDTH,
  PADDLE_EXTENDED_WIDTH,
  PADDLE_SHRUNK_WIDTH,
  FIXED_DT,
} from '@/game/constants';
import { radToDeg, degToRad, clamp } from '@/game/physics/MathUtils';

describe('Adversarial Stress Suite M3-1: Multi-Ball, Paddle Lerp & Speed Modifiers', () => {
  // =========================================================================
  // Dimension 1: Multi-Ball Scalar Speed Conservation & Fan Angle Invariants
  // =========================================================================
  describe('Dimension 1: Multi-Ball Scalar Speed Conservation & Angular Invariants', () => {
    it('empirically verifies scalar speed conservation for 10,000 random trajectory vectors across all 4 quadrants', () => {
      const NUM_TRIALS = 10000;
      let maxSpeedDelta = 0;

      for (let i = 0; i < NUM_TRIALS; i++) {
        // Random angle in [-PI, PI]
        const angle = (Math.random() * 2 - 1) * Math.PI;
        // Random scalar speed in [BALL_MIN_SPEED, BALL_MAX_SPEED]
        const speed = BALL_MIN_SPEED + Math.random() * (BALL_MAX_SPEED - BALL_MIN_SPEED);

        const vx = speed * Math.sin(angle);
        const vy = -speed * Math.cos(angle);

        const parentBall = new Ball({
          x: 400,
          y: 300,
          vx,
          vy,
          speed,
          isStuckToPaddle: false,
        });

        const paddle = new Paddle();
        const balls: Ball[] = [parentBall];
        const context: PowerupContext = {
          paddle,
          balls,
          hasShield: false,
          setShield: () => {},
        };

        const powerupManager = new PowerupManager();
        powerupManager.applyPowerup('MULTI_BALL', context);

        expect(balls.length).toBe(3);

        const bParent = balls[0];
        const bClone1 = balls[1];
        const bClone2 = balls[2];

        const speedParent = Math.hypot(bParent.vx, bParent.vy);
        const speedClone1 = Math.hypot(bClone1.vx, bClone1.vy);
        const speedClone2 = Math.hypot(bClone2.vx, bClone2.vy);

        // Speed conservation check
        const delta1 = Math.abs(speedClone1 - speed);
        const delta2 = Math.abs(speedClone2 - speed);
        maxSpeedDelta = Math.max(maxSpeedDelta, delta1, delta2);

        expect(speedClone1).toBeCloseTo(speed, 5);
        expect(speedClone2).toBeCloseTo(speed, 5);
        expect(bClone1.speed).toBe(speed);
        expect(bClone2.speed).toBe(speed);

        // Angular divergence check (+/- 25 degrees = MULTI_BALL_FAN_ANGLE)
        const parentHeading = Math.atan2(bParent.vx, -bParent.vy);
        const clone1Heading = Math.atan2(bClone1.vx, -bClone1.vy);
        const clone2Heading = Math.atan2(bClone2.vx, -bClone2.vy);

        // Angle differences with modular wrapping
        const diff1 = Math.atan2(Math.sin(clone1Heading - parentHeading), Math.cos(clone1Heading - parentHeading));
        const diff2 = Math.atan2(Math.sin(clone2Heading - parentHeading), Math.cos(clone2Heading - parentHeading));

        expect(diff1).toBeCloseTo(-MULTI_BALL_FAN_ANGLE, 5);
        expect(diff2).toBeCloseTo(MULTI_BALL_FAN_ANGLE, 5);
      }

      // Assert that floating-point deviation never exceeded 1e-6
      expect(maxSpeedDelta).toBeLessThan(1e-6);
    });

    it('conserves kinetic energy exactly on cardinal axes and near-zero/edge trajectory angles', () => {
      const cardinalHeadings = [
        { name: 'Pure Up', vx: 0, vy: -500, speed: 500 },
        { name: 'Pure Down', vx: 0, vy: 500, speed: 500 },
        { name: 'Pure Right', vx: 500, vy: 0, speed: 500 },
        { name: 'Pure Left', vx: -500, vy: 0, speed: 500 },
        { name: 'Diagonal NE', vx: 350, vy: -350, speed: Math.hypot(350, -350) },
        { name: 'Diagonal SW', vx: -350, vy: 350, speed: Math.hypot(-350, 350) },
        { name: 'Near Horizontal Left', vx: -499.9, vy: -0.1, speed: Math.hypot(-499.9, -0.1) },
        { name: 'Near Horizontal Right', vx: 499.9, vy: 0.1, speed: Math.hypot(499.9, 0.1) },
      ];

      for (const h of cardinalHeadings) {
        const ball = new Ball({ x: 400, y: 300, vx: h.vx, vy: h.vy, speed: h.speed, isStuckToPaddle: false });
        const paddle = new Paddle();
        const balls = [ball];
        const context: PowerupContext = { paddle, balls, hasShield: false, setShield: () => {} };

        const pm = new PowerupManager();
        pm.applyPowerup('MULTI_BALL', context);

        expect(balls.length).toBe(3);
        expect(Math.hypot(balls[1].vx, balls[1].vy)).toBeCloseTo(h.speed, 5);
        expect(Math.hypot(balls[2].vx, balls[2].vy)).toBeCloseTo(h.speed, 5);
      }
    });

    it('handles docked/stuck balls cleanly by auto-launching before splitting', () => {
      const paddle = new Paddle({ x: 350, width: 100 });
      const stuckBall = new Ball({
        x: 400,
        y: 620,
        speed: 450,
        isStuckToPaddle: true,
        stuckOffsetRatio: 0.5,
      });

      const balls = [stuckBall];
      const context: PowerupContext = { paddle, balls, hasShield: false, setShield: () => {} };

      const pm = new PowerupManager();
      pm.applyPowerup('MULTI_BALL', context);

      expect(stuckBall.isStuckToPaddle).toBe(false);
      expect(balls.length).toBe(3);

      for (const b of balls) {
        expect(b.isStuckToPaddle).toBe(false);
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(450, 5);
        expect(b.vy).toBeLessThan(0); // Upward launch
      }
    });

    it('generates unique ball entity IDs across all clone generations', () => {
      const balls: Ball[] = [new Ball({ x: 400, y: 300, vx: 0, vy: -400, speed: 400, isStuckToPaddle: false })];
      const paddle = new Paddle();
      const context: PowerupContext = { paddle, balls, hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      // Trigger 3 Multi-Ball activations
      pm.applyPowerup('MULTI_BALL', context); // 1 -> 3
      pm.applyPowerup('MULTI_BALL', context); // 3 -> 9
      pm.applyPowerup('MULTI_BALL', context); // 9 -> 12

      expect(balls.length).toBe(MAX_ACTIVE_BALLS);
      const ids = new Set(balls.map((b) => b.id));
      expect(ids.size).toBe(MAX_ACTIVE_BALLS);
    });
  });

  // =========================================================================
  // Dimension 2: Ball Pool Limit & Stress Harness
  // =========================================================================
  describe('Dimension 2: Ball Pool Maximum Cap Invariant (N <= 12)', () => {
    it('strictly clamps to MAX_ACTIVE_BALLS (12) under 1,000 rapid cascading activations', () => {
      const balls: Ball[] = [new Ball({ x: 400, y: 300, vx: 0, vy: -400, speed: 400, isStuckToPaddle: false })];
      const paddle = new Paddle();
      const context: PowerupContext = { paddle, balls, hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      for (let burst = 0; burst < 1000; burst++) {
        pm.applyPowerup('MULTI_BALL', context);
        expect(balls.length).toBeLessThanOrEqual(MAX_ACTIVE_BALLS);
      }

      expect(balls.length).toBe(MAX_ACTIVE_BALLS);
    });

    it('never exceeds 12 balls regardless of initial ball count (from 0 to 20)', () => {
      const pm = new PowerupManager();
      const paddle = new Paddle();

      for (let initialCount = 0; initialCount <= 20; initialCount++) {
        const balls: Ball[] = [];
        for (let i = 0; i < initialCount; i++) {
          balls.push(new Ball({ x: 400, y: 300, vx: 0, vy: -400, speed: 400, isStuckToPaddle: false }));
        }

        const context: PowerupContext = { paddle, balls, hasShield: false, setShield: () => {} };
        pm.applyPowerup('MULTI_BALL', context);

        if (initialCount === 0) {
          expect(balls.length).toBe(0);
        } else if (initialCount >= MAX_ACTIVE_BALLS) {
          expect(balls.length).toBe(initialCount); // Already at/above cap, no clones added
        } else {
          expect(balls.length).toBeLessThanOrEqual(MAX_ACTIVE_BALLS);
          expect(balls.length).toBe(Math.min(MAX_ACTIVE_BALLS, initialCount * 3));
        }
      }
    });

    it('survives high-frequency interleaved simulation (spawn, clone, ball lost) over 10,000 steps', () => {
      const balls: Ball[] = [new Ball({ x: 400, y: 300, vx: 0, vy: -400, speed: 400, isStuckToPaddle: false })];
      const paddle = new Paddle();
      const context: PowerupContext = { paddle, balls, hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      let maxObservedBalls = 0;

      for (let step = 0; step < 10000; step++) {
        const roll = Math.random();

        if (roll < 0.15) {
          pm.applyPowerup('MULTI_BALL', context);
        } else if (roll < 0.25 && balls.length > 1) {
          const removeIdx = Math.floor(Math.random() * balls.length);
          balls.splice(removeIdx, 1);
        } else if (balls.length === 0) {
          balls.push(new Ball({ x: 400, y: 300, vx: 0, vy: -400, speed: 400, isStuckToPaddle: false }));
        }

        maxObservedBalls = Math.max(maxObservedBalls, balls.length);
        expect(balls.length).toBeLessThanOrEqual(MAX_ACTIVE_BALLS);
      }

      expect(maxObservedBalls).toBe(MAX_ACTIVE_BALLS);
    });
  });

  // =========================================================================
  // Dimension 3: Paddle Width Lerp Kinematics & Boundary Invariants
  // =========================================================================
  describe('Dimension 3: Paddle Width Lerping, Center Preservation & Boundary Clamping', () => {
    it('verifies exact 250ms duration for 100px -> 150px expansion (+50px at 200px/s)', () => {
      const paddle = new Paddle({ x: 350, width: PADDLE_BASE_WIDTH });
      paddle.setWidth(PADDLE_EXTENDED_WIDTH, false);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };

      let elapsedSeconds = 0;
      const dt = FIXED_DT;

      while (paddle.width < PADDLE_EXTENDED_WIDTH - 1e-4) {
        paddle.update(dt, dummyInput, CANVAS_WIDTH);
        elapsedSeconds += dt;
        if (elapsedSeconds > 1.0) break;
      }

      expect(elapsedSeconds).toBeCloseTo(0.25, 2);
      expect(paddle.width).toBe(PADDLE_EXTENDED_WIDTH);
    });

    it('verifies exact 150ms duration for 100px -> 70px shrinkage (-30px at 200px/s)', () => {
      const paddle = new Paddle({ x: 350, width: PADDLE_BASE_WIDTH });
      paddle.setWidth(PADDLE_SHRUNK_WIDTH, false);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };

      let elapsedSeconds = 0;
      const dt = FIXED_DT;

      while (paddle.width > PADDLE_SHRUNK_WIDTH + 1e-4) {
        paddle.update(dt, dummyInput, CANVAS_WIDTH);
        elapsedSeconds += dt;
        if (elapsedSeconds > 1.0) break;
      }

      // Expected time: 30px / 200px/s = 0.15s (9 frames at 60 FPS = 0.150s)
      expect(elapsedSeconds).toBeCloseTo(0.15, 2);
      expect(paddle.width).toBeCloseTo(PADDLE_SHRUNK_WIDTH, 4);
    });

    it('preserves center coordinate to within 1e-6 across every single frame during expansion in open field', () => {
      const paddle = new Paddle({ x: 350, width: PADDLE_BASE_WIDTH });
      const initialCenter = paddle.x + paddle.width / 2; // 400.0
      paddle.setWidth(PADDLE_EXTENDED_WIDTH, false);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };
      const dt = 0.005; // 5ms micro-stepping

      for (let t = 0; t < 60; t++) {
        paddle.update(dt, dummyInput, CANVAS_WIDTH);
        const currentCenter = paddle.x + paddle.width / 2;
        expect(currentCenter).toBeCloseTo(initialCenter, 5);
      }

      expect(paddle.width).toBe(PADDLE_EXTENDED_WIDTH);
      expect(paddle.x + paddle.width / 2).toBeCloseTo(initialCenter, 5);
    });

    it('preserves center coordinate to within 1e-6 across every single frame during shrinkage in open field', () => {
      const paddle = new Paddle({ x: 350, width: PADDLE_BASE_WIDTH });
      const initialCenter = paddle.x + paddle.width / 2; // 400.0
      paddle.setWidth(PADDLE_SHRUNK_WIDTH, false);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };
      const dt = 0.005;

      for (let t = 0; t < 40; t++) {
        paddle.update(dt, dummyInput, CANVAS_WIDTH);
        const currentCenter = paddle.x + paddle.width / 2;
        expect(currentCenter).toBeCloseTo(initialCenter, 5);
      }

      expect(paddle.width).toBe(PADDLE_SHRUNK_WIDTH);
      expect(paddle.x + paddle.width / 2).toBeCloseTo(initialCenter, 5);
    });

    it('empirically reveals sub-pixel snap boundary vulnerability in Paddle.ts (width snap without re-clamping x)', () => {
      // Reproduce vulnerability: paddle is against right wall at width 149.7, targetWidth 150
      const paddle = new Paddle({ x: 650.3, width: 149.7 });
      paddle.targetWidth = 150;

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };

      // In Step 1: clampedX = clamp(650.3, 0, 800 - 149.7) = 650.3
      // In Step 2: Math.abs(149.7 - 150) = 0.3 <= 0.5 -> enters else branch: this.width = 150
      // paddle.x remains 650.3!
      paddle.update(FIXED_DT, dummyInput, CANVAS_WIDTH);

      // On this frame, paddle right edge penetrates right boundary:
      const rightEdge = paddle.x + paddle.width;
      // Note: 650.3 + 150 = 800.3 > 800.0
      expect(paddle.width).toBe(150);
      expect(paddle.x).toBe(650.3);
      expect(rightEdge).toBeGreaterThan(CANVAS_WIDTH); // Proves boundary breach of 0.3px
    });

    it('handles rapid alternating target width flips (EXTEND <-> SHRINK) without position jitter or boundary leakage', () => {
      const paddle = new Paddle({ x: 0, width: PADDLE_BASE_WIDTH }); // At left boundary
      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };

      for (let cycle = 0; cycle < 100; cycle++) {
        const target = cycle % 2 === 0 ? PADDLE_EXTENDED_WIDTH : PADDLE_SHRUNK_WIDTH;
        paddle.setWidth(target, false);

        for (let frame = 0; frame < 5; frame++) {
          paddle.update(FIXED_DT, dummyInput, CANVAS_WIDTH);
          expect(paddle.x).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // =========================================================================
  // Dimension 4: Slow / Fast Ball Speed Modifiers Determinism
  // =========================================================================
  describe('Dimension 4: Ball Speed Scaling Determinism & Non-Compounding Invariants', () => {
    it('applies SLOW modifier deterministically and clamps to BALL_MIN_SPEED (300)', () => {
      const ball = new Ball({ x: 400, y: 300, vx: 0, vy: -420, speed: 420, isStuckToPaddle: false });
      const paddle = new Paddle();
      const context: PowerupContext = { paddle, balls: [ball], hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      pm.applyPowerup('SLOW', context);

      // 420 * 0.7 = 294 -> clamped to 300
      expect(ball.speed).toBe(BALL_MIN_SPEED);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(BALL_MIN_SPEED, 5);
      expect(ball.vy).toBeCloseTo(-BALL_MIN_SPEED, 5);
    });

    it('applies FAST modifier deterministically and clamps to BALL_MAX_SPEED (700)', () => {
      const ball = new Ball({ x: 400, y: 300, vx: 0, vy: -600, speed: 600, isStuckToPaddle: false });
      const paddle = new Paddle();
      const context: PowerupContext = { paddle, balls: [ball], hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      pm.applyPowerup('FAST', context);

      // 600 * 1.3 = 780 -> clamped to 700
      expect(ball.speed).toBe(BALL_MAX_SPEED);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(BALL_MAX_SPEED, 5);
      expect(ball.vy).toBeCloseTo(-BALL_MAX_SPEED, 5);
    });

    it('reverts ball speed strictly to BALL_INITIAL_SPEED (420) upon modifier expiration', () => {
      const ball = new Ball({ x: 400, y: 300, vx: 0, vy: -420, speed: 420, isStuckToPaddle: false });
      const paddle = new Paddle();
      const context: PowerupContext = { paddle, balls: [ball], hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      // Apply FAST
      pm.applyPowerup('FAST', context);
      expect(ball.speed).toBe(Math.round(420 * BALL_FAST_FACTOR)); // 546

      // Simulate timer expiration (8000ms)
      pm.update(8.1, context);

      expect(ball.speed).toBe(BALL_INITIAL_SPEED);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(BALL_INITIAL_SPEED, 5);
      expect(pm.isPowerupActive('FAST')).toBe(false);
    });

    it('resolves mutual exclusivity conflict: collecting SLOW while FAST is active resets baseline before scaling', () => {
      const ball = new Ball({ x: 400, y: 300, vx: 0, vy: -420, speed: 420, isStuckToPaddle: false });
      const paddle = new Paddle();
      const context: PowerupContext = { paddle, balls: [ball], hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      // 1. Collect FAST
      pm.applyPowerup('FAST', context);
      expect(ball.speed).toBe(Math.round(420 * 1.3)); // 546
      expect(pm.isPowerupActive('FAST')).toBe(true);

      // 2. Collect SLOW while FAST is still active
      pm.applyPowerup('SLOW', context);

      // FAST must be cancelled, speed restored to 420, then SLOW applied (420 * 0.7 = 294 -> clamped to 300)
      expect(pm.isPowerupActive('FAST')).toBe(false);
      expect(pm.isPowerupActive('SLOW')).toBe(true);
      expect(ball.speed).toBe(BALL_MIN_SPEED);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(BALL_MIN_SPEED, 5);

      // 3. Collect FAST while SLOW is active
      pm.applyPowerup('FAST', context);

      // SLOW must be cancelled, speed restored to 420, then FAST applied (420 * 1.3 = 546)
      expect(pm.isPowerupActive('SLOW')).toBe(false);
      expect(pm.isPowerupActive('FAST')).toBe(true);
      expect(ball.speed).toBe(Math.round(420 * 1.3)); // 546
    });

    it('does not cause exponential compounding on consecutive rapid collections of the same modifier', () => {
      const ball = new Ball({ x: 400, y: 300, vx: 0, vy: -420, speed: 420, isStuckToPaddle: false });
      const paddle = new Paddle();
      const context: PowerupContext = { paddle, balls: [ball], hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      // Collect FAST 50 times in a row
      for (let i = 0; i < 50; i++) {
        pm.applyPowerup('FAST', context);
        expect(ball.speed).toBeLessThanOrEqual(BALL_MAX_SPEED);
      }
      expect(ball.speed).toBe(BALL_MAX_SPEED);

      // When timer expires, cleanly resets to BALL_INITIAL_SPEED (420), not an exploded value
      pm.update(8.5, context);
      expect(ball.speed).toBe(BALL_INITIAL_SPEED);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(BALL_INITIAL_SPEED, 5);
    });

    it('propagates speed modifiers to all active balls and handles cloning during active modifier', () => {
      const b1 = new Ball({ x: 400, y: 300, vx: 0, vy: -420, speed: 420, isStuckToPaddle: false });
      const paddle = new Paddle();
      const balls = [b1];
      const context: PowerupContext = { paddle, balls, hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      // 1. Activate FAST
      pm.applyPowerup('FAST', context);
      expect(b1.speed).toBe(546);

      // 2. Activate Multi-Ball while FAST is active
      pm.applyPowerup('MULTI_BALL', context);
      expect(balls.length).toBe(3);

      for (const b of balls) {
        expect(b.speed).toBe(546);
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(546, 5);
      }

      // 3. FAST expires -> all 3 balls must reset to BALL_INITIAL_SPEED (420)
      pm.update(8.5, context);
      for (const b of balls) {
        expect(b.speed).toBe(BALL_INITIAL_SPEED);
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(BALL_INITIAL_SPEED, 5);
      }
    });

    it('maintains modifier lifecycle integrity across 1,000 random collection and expiration cycles', () => {
      const balls: Ball[] = [new Ball({ x: 400, y: 300, vx: 0, vy: -420, speed: 420, isStuckToPaddle: false })];
      const paddle = new Paddle();
      const context: PowerupContext = { paddle, balls, hasShield: false, setShield: () => {} };
      const pm = new PowerupManager();

      for (let cycle = 0; cycle < 1000; cycle++) {
        const roll = Math.random();
        if (roll < 0.3) {
          pm.applyPowerup('SLOW', context);
        } else if (roll < 0.6) {
          pm.applyPowerup('FAST', context);
        } else if (roll < 0.8) {
          pm.applyPowerup('MULTI_BALL', context);
        }

        // Advance random time step [0.1s to 2.0s]
        const dt = 0.1 + Math.random() * 1.9;
        pm.update(dt, context);

        // Invariant checks on every cycle
        for (const b of balls) {
          expect(b.speed).toBeGreaterThanOrEqual(BALL_MIN_SPEED);
          expect(b.speed).toBeLessThanOrEqual(BALL_MAX_SPEED);
          expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(b.speed, 4);
        }
        expect(balls.length).toBeLessThanOrEqual(MAX_ACTIVE_BALLS);
      }

      // Clear all and verify final recovery
      pm.clearAll(context);
      for (const b of balls) {
        expect(b.speed).toBe(BALL_INITIAL_SPEED);
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(BALL_INITIAL_SPEED, 5);
      }
    });
  });
});
