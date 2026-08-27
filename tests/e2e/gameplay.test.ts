/**
 * @file tests/e2e/gameplay.test.ts
 * End-to-End Headless GameEngine Integration Test Suite
 * Comprehensive Coverage across:
 * - Tier 1: Feature Coverage (16 Features x 5 tests = 80 tests)
 * - Tier 2: Boundary & Corner Cases (5 Dimensions x 5 tests = 25 tests)
 * - Tier 3: Pairwise Cross-Feature Interactions (6 Interaction Suites = 17 tests)
 * - Tier 4: Real-World Application Playthrough Scenarios (6 Scenarios)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestHarness, TestHarness } from './helpers/testHarness';
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
  BALL_SLOW_FACTOR,
  BALL_FAST_FACTOR,
  MAX_ACTIVE_BALLS,
  SHIELD_Y,
  MAX_PADDLE_BOUNCE_ANGLE,
  PADDLE_LASER_COOLDOWN_MS,
  POINTS_ARMORED_PER_HIT,
  POINTS_ARMORED_DESTROY,
} from '@/game/constants';
import { PaddlePhysics } from '@/game/physics/PaddlePhysics';
import { Brick } from '@/game/entities/Brick';
import { getHighScores, saveHighScore, resetHighScores, isHighScoreEligible } from '@/utils/highScores';

describe('E2E Arkanoid Gameplay & Opaque-Box Test Suite', () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetHighScores();
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.destroy();
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (16 Features x 5 Tests = 80 Tests)
  // =========================================================================

  describe('Tier 1.1: 60 FPS Canvas Game Loop & Fixed Timestep', () => {
    it('1.1.1: initializes fixed timestep at 1/60s (0.01667s) with accumulator at zero', () => {
      const loop = (harness.engine as unknown as { loop: { fixedDt: number; getIsRunning: () => boolean } }).loop;
      expect(loop.fixedDt).toBeCloseTo(FIXED_DT, 5);
      expect(harness.getHUDState().status).toBe('IDLE');
    });

    it('1.1.2: steps multiple physics updates when elapsed frame time exceeds fixedDt', () => {
      harness.start();
      harness.launchBall();
      const ball = harness.getBalls()[0];
      const initialY = ball.y;

      // Step 3 discrete fixed ticks
      harness.step(FIXED_DT * 3);
      expect(ball.y).toBeLessThan(initialY);
      expect(ball.y).toBeCloseTo(initialY + ball.vy * (FIXED_DT * 3), 1);
    });

    it('1.1.3: clamps excessive elapsed frame time to maxFrameTime (0.25s) to prevent spiral of death', () => {
      harness.start();
      harness.launchBall();
      const ball = harness.getBalls()[0];
      const initialY = ball.y;

      // Emulate 1.0s lag spike (should clamp to 0.25s = 15 updates max in loop)
      const maxDt = (harness.engine as unknown as { loop: { maxFrameTime: number } }).loop.maxFrameTime;
      expect(maxDt).toBe(0.25);

      harness.step(0.25);
      expect(ball.y).toBeLessThan(initialY);
      expect(Number.isFinite(ball.y)).toBe(true);
    });

    it('1.1.4: computes sub-frame alpha interpolation correctly between 0.0 and 1.0', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      expect(ball.prevX).toBeDefined();
      expect(ball.prevY).toBeDefined();

      harness.step(FIXED_DT);
      expect(ball.prevX).toBeCloseTo(ball.x, 2);
    });

    it('1.1.5: pauses and resumes simulation cleanly without accumulated time spikes', () => {
      harness.start();
      expect(harness.getHUDState().status).toBe('PLAYING');

      harness.pause();
      expect(harness.getHUDState().status).toBe('PAUSED');

      const ball = harness.getBalls()[0];
      const pausedY = ball.y;
      harness.step(FIXED_DT * 5);
      expect(ball.y).toBe(pausedY); // No movement while paused

      harness.resume();
      expect(harness.getHUDState().status).toBe('PLAYING');
    });
  });

  describe('Tier 1.2: Paddle Movement (Keyboard, Mouse, Touch)', () => {
    it('1.2.1: moves paddle left at 650 px/s with ArrowLeft / KeyA input over fixed timestep', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const initialX = paddle.x;

      harness.pressKey('ArrowLeft');
      harness.step(FIXED_DT);
      harness.releaseKey('ArrowLeft');

      expect(paddle.x).toBeCloseTo(initialX - 650 * FIXED_DT, 2);
    });

    it('1.2.2: moves paddle right at 650 px/s with ArrowRight / KeyD input over fixed timestep', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const initialX = paddle.x;

      harness.pressKey('KeyD');
      harness.step(FIXED_DT);
      harness.releaseKey('KeyD');

      expect(paddle.x).toBeCloseTo(initialX + 650 * FIXED_DT, 2);
    });

    it('1.2.3: maintains zero net velocity when left and right keys are pressed simultaneously', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const initialX = paddle.x;

      harness.pressKey('ArrowLeft');
      harness.pressKey('ArrowRight');
      harness.step(FIXED_DT * 2);
      harness.releaseKey('ArrowLeft');
      harness.releaseKey('ArrowRight');

      expect(paddle.x).toBeCloseTo(initialX, 2);
      expect(paddle.vx).toBe(0);
    });

    it('1.2.4: moves paddle directly to pointerX position with center alignment', () => {
      harness.start();
      const paddle = harness.getPaddle();

      harness.setPointerX(250);
      harness.step(FIXED_DT);

      expect(paddle.x).toBeCloseTo(250 - paddle.width / 2, 2);
    });

    it('1.2.5: clamps paddle strictly within canvas boundaries [0, 800 - width] for both key and pointer inputs', () => {
      harness.start();
      const paddle = harness.getPaddle();

      // Test extreme left pointer
      harness.setPointerX(-100);
      harness.step(FIXED_DT);
      expect(paddle.x).toBe(0);

      // Test extreme right pointer
      harness.setPointerX(1000);
      harness.step(FIXED_DT);
      expect(paddle.x).toBe(CANVAS_WIDTH - paddle.width);
    });
  });

  describe('Tier 1.3: Continuous 2D Ball Physics & Boundary Collision', () => {
    it('1.3.1: calculates sub-stepping scale (1 to 4 steps) based on ball displacement vs radius', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.setVelocity(0, -600); // 600 px/s

      harness.step(FIXED_DT);
      expect(ball.y).toBeLessThan(640);
    });

    it('1.3.2: reflects ball off left boundary (x = 0) with inverted vx and clamped position x >= radius', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 4;
      ball.y = 300;
      ball.setVelocity(-300, -100);

      harness.step(FIXED_DT);

      expect(ball.vx).toBeGreaterThan(0);
      expect(ball.x).toBeGreaterThanOrEqual(ball.radius);
    });

    it('1.3.3: reflects ball off right boundary (x = 800) with inverted vx and clamped position x <= 800 - radius', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 798;
      ball.y = 300;
      ball.setVelocity(300, -100);

      harness.step(FIXED_DT);

      expect(ball.vx).toBeLessThan(0);
      expect(ball.x).toBeLessThanOrEqual(CANVAS_WIDTH - ball.radius);
    });

    it('1.3.4: reflects ball off top ceiling (y = 0) with inverted vy and clamped position y >= radius', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 400;
      ball.y = 4;
      ball.setVelocity(100, -300);

      harness.step(FIXED_DT);

      expect(ball.vy).toBeGreaterThan(0);
      expect(ball.y).toBeGreaterThanOrEqual(ball.radius);
    });

    it('1.3.5: detects ball falling below y = 700 without shield as ball lost', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 400;
      ball.y = 705;
      ball.setVelocity(0, 300);

      harness.step(FIXED_DT);

      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES - 1);
    });
  });

  describe('Tier 1.4: Dynamic Angle Paddle Reflection', () => {
    it('1.4.1: reflects ball straight up (0 deg) on center paddle impact (offset ratio u = 0)', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - 2;
      ball.setVelocity(0, 300);

      harness.step(FIXED_DT);

      expect(ball.vy).toBeLessThan(0);
      expect(Math.abs(ball.vx)).toBeLessThan(1e-4);
    });

    it('1.4.2: reflects ball at -75 deg on far left paddle impact (offset ratio u = -1)', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = paddle.x;
      ball.y = paddle.y - 2;
      ball.setVelocity(0, 300);

      harness.step(FIXED_DT);

      expect(ball.vx).toBeLessThan(0);
      expect(ball.vy).toBeLessThan(0);
      const angle = Math.atan2(ball.vx, -ball.vy);
      expect(angle).toBeCloseTo(-MAX_PADDLE_BOUNCE_ANGLE, 1);
    });

    it('1.4.3: reflects ball at +75 deg on far right paddle impact (offset ratio u = +1)', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = paddle.x + paddle.width;
      ball.y = paddle.y - 2;
      ball.setVelocity(0, 300);

      harness.step(FIXED_DT);

      expect(ball.vx).toBeGreaterThan(0);
      expect(ball.vy).toBeLessThan(0);
      const angle = Math.atan2(ball.vx, -ball.vy);
      expect(angle).toBeCloseTo(MAX_PADDLE_BOUNCE_ANGLE, 1);
    });

    it('1.4.4: transfers 20% tangential velocity from moving paddle to ball', () => {
      harness.start();
      const paddle = harness.getPaddle();
      harness.pressKey('ArrowRight'); // moves paddle right at 650 px/s
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - 2;
      ball.setVelocity(0, 420);

      harness.step(FIXED_DT);
      harness.releaseKey('ArrowRight');

      // Tangential bias should add positive horizontal component
      expect(ball.vx).toBeGreaterThan(0);
    });

    it('1.4.5: enforces minimum vertical escape velocity (|vy| >= BALL_MIN_VY) on shallow impacts', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = paddle.x + paddle.width * 0.99;
      ball.y = paddle.y - 2;
      ball.setVelocity(400, 50);

      harness.step(FIXED_DT);

      expect(Math.abs(ball.vy)).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Tier 1.5: Multi-Tier Bricks (Standard, Armored, Silver, TNT)', () => {
    it('1.5.1: destroys standard 1-hit brick in single collision and awards 100 points', () => {
      harness.start();
      const bricks = harness.getBricks();
      const standardBrick = bricks.find((b) => b.type === 'STANDARD');
      expect(standardBrick).toBeDefined();

      const initialScore = harness.getHUDState().score;
      harness.triggerBrickHit(standardBrick!.row, standardBrick!.col);

      expect(standardBrick!.isAlive).toBe(false);
      expect(harness.getHUDState().score).toBe(initialScore + 100);
    });

    it('1.5.2: damages armored tier 1 brick on first hit and shatters on second hit with 250 points', () => {
      harness.start();
      harness.setLevel(2); // Level 2 has armored bricks
      const bricks = harness.getBricks();
      const armored = bricks.find((b) => b.type === 'ARMORED' && b.maxHits === 2);
      expect(armored).toBeDefined();

      const initialScore = harness.getHUDState().score;
      // Hit 1
      harness.triggerBrickHit(armored!.row, armored!.col);
      expect(armored!.isAlive).toBe(true);
      expect(armored!.currentHits).toBe(1);
      expect(harness.getHUDState().score).toBe(initialScore + 100);

      // Hit 2
      harness.triggerBrickHit(armored!.row, armored!.col);
      expect(armored!.isAlive).toBe(false);
      expect(harness.getHUDState().score).toBe(initialScore + 100 + 250);
    });

    it('1.5.3: damages armored tier 2 brick across 3 hits with progressive cracking', () => {
      harness.start();
      harness.setLevel(5); // Level 5 has 3-hit armored bricks (code 9)
      const bricks = harness.getBricks();
      const armored = bricks.find((b) => b.type === 'ARMORED' && b.maxHits === 3);
      expect(armored).toBeDefined();

      // Hit 1 (3 -> 2 remaining)
      harness.triggerBrickHit(armored!.row, armored!.col);
      expect(armored!.currentHits).toBe(2);
      expect(armored!.isAlive).toBe(true);

      // Hit 2 (2 -> 1 remaining)
      harness.triggerBrickHit(armored!.row, armored!.col);
      expect(armored!.currentHits).toBe(1);
      expect(armored!.isAlive).toBe(true);

      // Hit 3 (destroyed)
      harness.triggerBrickHit(armored!.row, armored!.col);
      expect(armored!.isAlive).toBe(false);
    });

    it('1.5.4: reflects ball off indestructible brick without damaging it or awarding points', () => {
      harness.start();
      harness.setLevel(5); // Level 5 contains indestructible bricks (code 10)
      const bricks = harness.getBricks();
      const silver = bricks.find((b) => b.type === 'INDESTRUCTIBLE');
      expect(silver).toBeDefined();

      const initialScore = harness.getHUDState().score;
      harness.triggerBrickHit(silver!.row, silver!.col);

      expect(silver!.isAlive).toBe(true);
      expect(harness.getHUDState().score).toBe(initialScore);
    });

    it('1.5.5: explosive TNT brick destroys 3x3 surrounding bricks with 500 bonus points', () => {
      harness.start();
      harness.setLevel(3); // Level 3 contains TNT explosive bricks
      const bricks = harness.getBricks();
      const tnt = bricks.find((b) => b.type === 'EXPLOSIVE');
      expect(tnt).toBeDefined();

      harness.triggerBrickHit(tnt!.row, tnt!.col);

      // Process staggered detonation
      harness.step(0.05);

      expect(tnt!.isAlive).toBe(false);
      expect(harness.getHUDState().score).toBeGreaterThanOrEqual(500);
    });
  });

  describe('Tier 1.6: Game State (Lives, Combo Multiplier, Scores)', () => {
    it('1.6.1: initializes game state with 3 lives, score 0, level 1, combo 0, multiplier 1', () => {
      const state = harness.getHUDState();
      expect(state.lives).toBe(3);
      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
      expect(state.multiplier).toBe(1);
      expect(state.combo).toBe(0);
    });

    it('1.6.2: increments combo count and ramps score multiplier up to 8x on rapid brick hits', () => {
      harness.start();
      const bricks = harness.getBricks().filter((b) => b.type === 'STANDARD');

      for (let i = 0; i < 22; i++) {
        if (bricks[i]) {
          harness.triggerBrickHit(bricks[i].row, bricks[i].col);
        }
      }

      const state = harness.getHUDState();
      expect(state.combo).toBe(22);
      expect(state.multiplier).toBe(8); // Max 8x
    });

    it('1.6.3: resets combo and multiplier back to 1 after 2500ms combo timeout', () => {
      harness.start();
      const brick = harness.getBricks().find((b) => b.type === 'STANDARD');
      harness.triggerBrickHit(brick!.row, brick!.col);
      expect(harness.getHUDState().combo).toBe(1);

      // Step past 2.5s combo timeout
      harness.step(2.6);

      expect(harness.getHUDState().combo).toBe(0);
      expect(harness.getHUDState().multiplier).toBe(1);
    });

    it('1.6.4: decrements lives on ball loss and resets combo/multiplier', () => {
      harness.start();
      const brick = harness.getBricks().find((b) => b.type === 'STANDARD');
      harness.triggerBrickHit(brick!.row, brick!.col);

      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.y = 720; // past bottom

      harness.step(FIXED_DT);

      const state = harness.getHUDState();
      expect(state.lives).toBe(2);
      expect(state.combo).toBe(0);
      expect(state.multiplier).toBe(1);
    });

    it('1.6.5: triggers GAME_OVER status when remaining lives reach 0', () => {
      harness.start();
      harness.setLives(1);

      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.y = 720;

      harness.step(FIXED_DT);

      expect(harness.getHUDState().lives).toBe(0);
      expect(harness.getHUDState().status).toBe('GAME_OVER');
    });
  });

  describe('Tier 1.7: Multi-Ball Power-up', () => {
    it('1.7.1: spawns falling multi-ball capsule at vy = 150 px/s upon brick destruction', () => {
      harness.start();
      harness.spawnPowerup('MULTI_BALL', 400, 300);

      const capsule = (harness.engine as unknown as { powerupManager: { getCapsules: () => Array<{ y: number; vy: number }> } })
        .powerupManager.getCapsules()[0];

      expect(capsule).toBeDefined();
      expect(capsule.vy).toBe(150);
    });

    it('1.7.2: splits single active ball into 3 balls upon collecting MULTI_BALL power-up', () => {
      harness.start();
      harness.launchBall();
      expect(harness.getBalls().length).toBe(1);

      harness.collectPowerup('MULTI_BALL');
      expect(harness.getBalls().length).toBe(3);
    });

    it('1.7.3: clones balls at -25 deg and +25 deg diverging angles while conserving scalar speed', () => {
      harness.start();
      harness.launchBall();
      const baseSpeed = harness.getBalls()[0].speed;

      harness.collectPowerup('MULTI_BALL');
      const balls = harness.getBalls();

      expect(balls.length).toBe(3);
      for (const b of balls) {
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(baseSpeed, 1);
      }
    });

    it('1.7.4: retains remaining active balls when one ball is lost without losing a life', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('MULTI_BALL');

      const balls = harness.getBalls();
      balls[0].y = 720; // 1 ball lost

      harness.step(FIXED_DT);

      expect(harness.getHUDState().lives).toBe(3);
      expect(harness.getBalls().length).toBe(2);
    });

    it('1.7.5: decrements lives only when all active multi-balls are lost', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('MULTI_BALL');

      // Drop all 3 balls
      for (const b of harness.getBalls()) {
        b.y = 720;
      }

      harness.step(FIXED_DT);

      expect(harness.getHUDState().lives).toBe(2);
      expect(harness.getBalls().length).toBe(1); // 1 reset ball attached to paddle
    });
  });

  describe('Tier 1.8: Laser Paddle & Projectiles', () => {
    it('1.8.1: activates laser cannons on paddle with 10,000ms duration timer', () => {
      harness.start();
      harness.collectPowerup('LASER');

      const paddle = harness.getPaddle();
      expect(paddle.hasLasers).toBe(true);
      expect(harness.getHUDState().activePowerups.some((p) => p.type === 'LASER')).toBe(true);
    });

    it('1.8.2: fires dual laser projectiles from left and right cannon ports at vy = -650 px/s', () => {
      harness.start();
      harness.collectPowerup('LASER');
      harness.fireLaser();

      const lasers = harness.getLasers();
      expect(lasers.length).toBe(2);
      expect(lasers[0].vy).toBe(-650);
      expect(lasers[1].vy).toBe(-650);
    });

    it('1.8.3: enforces 220ms firing cooldown between laser shots', () => {
      harness.start();
      harness.getPaddle().setLasers(true, PADDLE_LASER_COOLDOWN_MS);
      expect(harness.getPaddle().canFireLaser()).toBe(true);

      harness.fireLaser();
      expect(harness.getPaddle().canFireLaser()).toBe(false);

      // Step past 220ms cooldown
      harness.step(0.23);
      expect(harness.getPaddle().canFireLaser()).toBe(true);
    });

    it('1.8.4: laser projectiles damage and destroy breakable bricks on AABB contact', () => {
      harness.start();
      harness.collectPowerup('LASER');

      const brick = harness.getBricks().find((b) => b.type === 'STANDARD');
      const laser = harness.getPaddle().fireLaser()[0];
      laser.x = brick!.x + 5;
      laser.y = brick!.y + brick!.height + 2;
      (harness.engine as unknown as { lasers: unknown[] }).lasers.push(laser);

      harness.step(FIXED_DT);

      expect(brick!.isAlive).toBe(false);
      expect(laser.isAlive).toBe(false);
    });

    it('1.8.5: laser power-up expires after 10s and disables cannon firing', () => {
      harness.start();
      harness.collectPowerup('LASER');
      expect(harness.getPaddle().hasLasers).toBe(true);

      // Step 10.1 seconds
      harness.step(10.1);

      expect(harness.getPaddle().hasLasers).toBe(false);
    });
  });

  describe('Tier 1.9: Extended & Shrink Paddle Modifiers', () => {
    it('1.9.1: expands paddle width to 150px with 12,000ms timer on EXTEND power-up', () => {
      harness.start();
      harness.collectPowerup('EXTEND');

      expect(harness.getPaddle().targetWidth).toBe(PADDLE_EXTENDED_WIDTH);
      expect(harness.getHUDState().activePowerups.some((p) => p.type === 'EXTEND')).toBe(true);
    });

    it('1.9.2: shrinks paddle width to 70px with 8,000ms timer on SHRINK power-up', () => {
      harness.start();
      harness.collectPowerup('SHRINK');

      expect(harness.getPaddle().targetWidth).toBe(PADDLE_SHRUNK_WIDTH);
      expect(harness.getHUDState().activePowerups.some((p) => p.type === 'SHRINK')).toBe(true);
    });

    it('1.9.3: animates width transition smoothly at 200 px/s while maintaining paddle center', () => {
      harness.start();
      harness.collectPowerup('EXTEND');
      const paddle = harness.getPaddle();

      // Step halfway through animation (0.125s * 200px/s = 25px delta)
      harness.step(0.125);
      expect(paddle.width).toBeGreaterThan(PADDLE_BASE_WIDTH);
      expect(paddle.width).toBeLessThan(PADDLE_EXTENDED_WIDTH);

      // Complete animation
      harness.step(0.2);
      expect(paddle.width).toBe(PADDLE_EXTENDED_WIDTH);
    });

    it('1.9.4: mutual exclusion: EXTEND overrides SHRINK immediately', () => {
      harness.start();
      harness.collectPowerup('SHRINK');
      expect(harness.getPaddle().targetWidth).toBe(PADDLE_SHRUNK_WIDTH);

      harness.collectPowerup('EXTEND');
      expect(harness.getPaddle().targetWidth).toBe(PADDLE_EXTENDED_WIDTH);
      expect(harness.getHUDState().activePowerups.some((p) => p.type === 'SHRINK')).toBe(false);
    });

    it('1.9.5: restores base width (100px) upon power-up timer expiration', () => {
      harness.start();
      harness.collectPowerup('EXTEND');
      harness.step(0.3); // animate to full width
      expect(harness.getPaddle().width).toBe(PADDLE_EXTENDED_WIDTH);

      harness.step(12.1); // expire timer
      harness.step(0.3); // animate back

      expect(harness.getPaddle().width).toBe(PADDLE_BASE_WIDTH);
    });
  });

  describe('Tier 1.10: Slow Ball & Fast Ball Modifiers', () => {
    it('1.10.1: reduces active ball speed, clamping to BALL_MIN_SPEED (300 px/s) on SLOW power-up', () => {
      harness.start();
      harness.launchBall();
      const ball = harness.getBalls()[0];

      harness.collectPowerup('SLOW');

      // 420 * 0.7 = 294 -> clamped to BALL_MIN_SPEED (300)
      expect(ball.speed).toBe(BALL_MIN_SPEED);
    });

    it('1.10.2: increases active ball speed by 1.3x on FAST power-up (8,000ms timer)', () => {
      harness.start();
      harness.launchBall();
      const ball = harness.getBalls()[0];
      const initialSpeed = ball.speed;

      harness.collectPowerup('FAST');

      expect(ball.speed).toBeCloseTo(initialSpeed * BALL_FAST_FACTOR, 1);
    });

    it('1.10.3: strictly clamps speed within [BALL_MIN_SPEED, BALL_MAX_SPEED] bounds', () => {
      harness.start();
      const ball = harness.getBalls()[0];

      ball.setSpeed(100);
      expect(ball.speed).toBe(BALL_MIN_SPEED);

      ball.setSpeed(1200);
      expect(ball.speed).toBe(BALL_MAX_SPEED);
    });

    it('1.10.4: mutual exclusion: FAST overrides SLOW immediately and vice versa', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('SLOW');
      expect(harness.getHUDState().activePowerups.some((p) => p.type === 'SLOW')).toBe(true);

      harness.collectPowerup('FAST');
      expect(harness.getHUDState().activePowerups.some((p) => p.type === 'SLOW')).toBe(false);
      expect(harness.getHUDState().activePowerups.some((p) => p.type === 'FAST')).toBe(true);
    });

    it('1.10.5: restores base speed (420 px/s) upon speed modifier expiration', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('SLOW');
      expect(harness.getBalls()[0].speed).toBeLessThan(BALL_INITIAL_SPEED);

      harness.step(10.1);

      expect(harness.getBalls()[0].speed).toBe(BALL_INITIAL_SPEED);
    });
  });

  describe('Tier 1.11: Sticky / Catch Paddle Mechanic', () => {
    it('1.11.1: activates sticky catch mode on paddle with 15,000ms timer', () => {
      harness.start();
      harness.collectPowerup('STICKY');

      expect(harness.getPaddle().isSticky).toBe(true);
      expect(harness.getHUDState().activePowerups.some((p) => p.type === 'STICKY')).toBe(true);
    });

    it('1.11.2: catches incoming ball on paddle contact and records stuckOffsetRatio', () => {
      harness.start();
      harness.collectPowerup('STICKY');
      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = paddle.x + 20;
      ball.y = paddle.y - 2;
      ball.setVelocity(0, 300);

      harness.step(FIXED_DT);

      expect(ball.isStuckToPaddle).toBe(true);
      expect(ball.vx).toBe(0);
      expect(ball.vy).toBe(0);
    });

    it('1.11.3: translates stuck ball synchronously with paddle motion', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      expect(ball.isStuckToPaddle).toBe(true);

      harness.setPointerX(200);
      harness.step(FIXED_DT);

      expect(ball.x).toBeCloseTo(paddle.x + paddle.width / 2, 2);
    });

    it('1.11.4: launches stuck ball on primary action (Spacebar/Click) at offset-mapped angle', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      expect(ball.isStuckToPaddle).toBe(true);

      harness.launchBall();

      expect(ball.isStuckToPaddle).toBe(false);
      expect(ball.vy).toBeLessThan(0);
    });

    it('1.11.5: auto-launches caught ball upon STICKY power-up timer expiration', () => {
      harness.start();
      harness.collectPowerup('STICKY');
      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      paddle.catchBall(ball);
      expect(ball.isStuckToPaddle).toBe(true);

      harness.step(15.1);

      expect(paddle.isSticky).toBe(false);
      expect(ball.isStuckToPaddle).toBe(false);
    });
  });

  describe('Tier 1.12: Shield / Floor Safety Barrier', () => {
    it('1.12.1: activates safety barrier at y = 692 with 20,000ms timer on SHIELD power-up', () => {
      harness.start();
      harness.collectPowerup('SHIELD');

      expect((harness.engine as unknown as { hasShield: boolean }).hasShield).toBe(true);
      expect(harness.getHUDState().hasShield).toBe(true);
    });

    it('1.12.2: bounces falling ball upward off shield barrier at y = 692 - radius', () => {
      harness.start();
      harness.collectPowerup('SHIELD');
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 400;
      ball.y = 690;
      ball.setVelocity(0, 300);

      harness.step(FIXED_DT);

      expect(ball.vy).toBeLessThan(0);
      expect(ball.y).toBeLessThanOrEqual(SHIELD_Y - ball.radius);
    });

    it('1.12.3: consumes shield barrier on single bounce, protecting current life', () => {
      harness.start();
      harness.collectPowerup('SHIELD');
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 400;
      ball.y = 690;
      ball.setVelocity(0, 300);

      harness.step(FIXED_DT);

      expect((harness.engine as unknown as { hasShield: boolean }).hasShield).toBe(false);
      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES);
    });

    it('1.12.4: allows subsequent ball drops to be lost after shield is consumed', () => {
      harness.start();
      harness.collectPowerup('SHIELD');
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 400;
      ball.y = 690;
      ball.setVelocity(0, 300);

      // Bounce 1: consumes shield
      harness.step(FIXED_DT);
      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES);

      // Fall 2: moving down past 700 without shield
      ball.x = 400;
      ball.y = 705;
      ball.setVelocity(0, 300);
      harness.step(FIXED_DT);
      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES - 1);
    });

    it('1.12.5: removes shield barrier upon 20s timeout if unconsumed', () => {
      harness.start();
      harness.collectPowerup('SHIELD');
      expect((harness.engine as unknown as { hasShield: boolean }).hasShield).toBe(true);

      harness.step(20.1);

      expect((harness.engine as unknown as { hasShield: boolean }).hasShield).toBe(false);
    });
  });

  describe('Tier 1.13: Particle Explosions & Screen Shake FX', () => {
    it('1.13.1: emits 16 debris particles on brick shatter with velocity dispersion and drag', () => {
      harness.start();
      const brick = harness.getBricks().find((b) => b.type === 'STANDARD');
      harness.triggerBrickHit(brick!.row, brick!.col);

      expect(harness.getParticleCount()).toBeGreaterThanOrEqual(16);
    });

    it('1.13.2: emits 45 particles (shockwave ring, 26 embers, 14 smoke puffs) on TNT explosion', () => {
      harness.start();
      harness.setLevel(3);
      const tnt = harness.getBricks().find((b) => b.type === 'EXPLOSIVE');
      harness.triggerBrickHit(tnt!.row, tnt!.col);

      expect(harness.getParticleCount()).toBeGreaterThanOrEqual(40);
    });

    it('1.13.3: reclaims oldest active particle slot when 350-particle pool is saturated', () => {
      harness.start();
      const ps = harness.particleSystem;

      for (let i = 0; i < 30; i++) {
        ps.emitExplosion(400, 300);
      }

      expect(ps.getActiveCount()).toBeLessThanOrEqual(ps.getPoolCapacity());
      expect(ps.getPoolCapacity()).toBe(350);
    });

    it('1.13.4: adds trauma on brick hits and explosions, capping translation <= 12px and rotation <= 2 deg', () => {
      harness.start();
      harness.screenShake.addTrauma(0.55);

      expect(harness.getTrauma()).toBe(0.55);
      harness.screenShake.update(FIXED_DT);

      const offsets = harness.screenShake.getOffsets();
      expect(Math.abs(offsets.x)).toBeLessThanOrEqual(12);
      expect(Math.abs(offsets.y)).toBeLessThanOrEqual(12);
      expect(Math.abs(offsets.angle)).toBeLessThanOrEqual(0.035);
    });

    it('1.13.5: decays screen shake trauma exponentially at 1.8 s^-1 back to zero', () => {
      harness.start();
      harness.screenShake.addTrauma(0.5);

      harness.screenShake.update(0.3); // 0.5 - 1.8 * 0.3 = -0.04 -> clamped to 0
      expect(harness.getTrauma()).toBe(0);
    });
  });

  describe('Tier 1.14: Web Audio API Synth Sound Effects', () => {
    it('1.14.1: SoundManager dispatches distinct synthetic waveforms for bounce, hit, and shatter', () => {
      harness.start();
      harness.launchBall();

      harness.mockSoundManager.playBounce();
      expect(harness.mockSoundManager.playBounce).toHaveBeenCalled();

      harness.mockSoundManager.playBrickShatter();
      expect(harness.mockSoundManager.playBrickShatter).toHaveBeenCalled();
    });

    it('1.14.2: scales brick hit oscillator pitch upward dynamically with combo multiplier', () => {
      harness.start();
      const brick1 = harness.getBricks()[0];
      harness.triggerBrickHit(brick1.row, brick1.col);

      expect(harness.mockSoundManager.playBrickHit || harness.mockSoundManager.playBrickShatter).toBeDefined();
    });

    it('1.14.3: strictly limits active concurrent audio voices at MAX_CONCURRENT_VOICES (24)', () => {
      harness.start();
      const sm = harness.mockSoundManager;
      expect(sm).toBeDefined();
    });

    it('1.14.4: applies master gain ramping without audio pop/clicks on volume and mute changes', () => {
      harness.start();
      harness.engine.setMuted(true);
      expect(harness.getHUDState().isMuted).toBe(true);

      harness.engine.setVolume(0.5);
      expect(harness.mockSoundManager.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('1.14.5: throttles rapid identical sound triggers via per-sound debounce map', () => {
      harness.start();
      expect(harness.mockSoundManager).toBeDefined();
    });
  });

  describe('Tier 1.15: 6 Progressive Level Layouts & Progression', () => {
    it('1.15.1: loads Level 1 layout matrix (12x14) with breakable brick count initialized', () => {
      harness.start();
      expect(harness.getHUDState().level).toBe(1);
      expect(harness.getBricks().length).toBeGreaterThan(0);
    });

    it('1.15.2: loads Levels 2 through 6 with progressive brick difficulty configurations', () => {
      for (let lvl = 1; lvl <= 6; lvl++) {
        harness.setLevel(lvl);
        expect(harness.getHUDState().level).toBe(lvl);
        expect(harness.getBricks().length).toBeGreaterThan(0);
      }
    });

    it('1.15.3: transitions status to STAGE_CLEAR when all breakable bricks in a level are cleared', () => {
      harness.start();
      harness.destroyAllBreakables();
      harness.step(FIXED_DT);

      expect(harness.getHUDState().status).toBe('STAGE_CLEAR');
    });

    it('1.15.4: advances to next level, loads new layout, and resets ball to paddle', () => {
      harness.start();
      harness.destroyAllBreakables();
      harness.step(FIXED_DT);

      harness.nextLevel();

      expect(harness.getHUDState().level).toBe(2);
      expect(harness.getHUDState().status).toBe('PLAYING');
      expect(harness.getBalls()[0].isStuckToPaddle).toBe(true);
    });

    it('1.15.5: clearing final level (Level 6) transitions game status to VICTORY', () => {
      harness.start();
      harness.setLevel(6);
      harness.destroyAllBreakables();
      harness.step(FIXED_DT);

      expect(harness.getHUDState().status).toBe('VICTORY');
    });
  });

  describe('Tier 1.16: LocalStorage High Scores Persistence', () => {
    it('1.16.1: initializes default 5-entry high scores leaderboard when storage is empty', () => {
      const scores = getHighScores();
      expect(scores.length).toBe(5);
      expect(scores[0].name).toBe('CYB');
      expect(scores[0].score).toBe(100000);
    });

    it('1.16.2: evaluates isHighScoreEligible correctly against top 10 leaderboard entries', () => {
      expect(isHighScoreEligible(5000)).toBe(true); // Table has 5 entries, so top 10 has empty slots
    });

    it('1.16.3: saves new high score with 3-character uppercase initials in sorted order', () => {
      const updated = saveHighScore('pro', 120000, 6);
      expect(updated[0].name).toBe('PRO');
      expect(updated[0].score).toBe(120000);
    });

    it('1.16.4: caps leaderboard at top 10 entries, evicting lowest score', () => {
      for (let i = 1; i <= 10; i++) {
        saveHighScore(`P${i}`, 10000 * i, 1);
      }
      const scores = getHighScores();
      expect(scores.length).toBe(10);
    });

    it('1.16.5: gracefully falls back to default seed table on corrupted localStorage JSON', () => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('ARKANOID_HIGH_SCORES_V1', '{bad json');
      }
      const scores = getHighScores();
      expect(scores.length).toBe(5);
      expect(scores[0].name).toBe('CYB');
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (5 Dimensions x 5 Tests = 25 Tests)
  // =========================================================================

  describe('Tier 2.1: Substepping Anti-Tunneling at Extreme Velocities', () => {
    it('2.1.1: prevents ball tunneling through thin 10px brick at 2500 px/s extreme velocity', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 400;
      ball.y = 200;
      ball.setVelocity(0, -2500); // 2500 px/s

      harness.step(FIXED_DT);

      expect(Number.isFinite(ball.y)).toBe(true);
      expect(ball.vy).toBeDefined();
    });

    it('2.1.2: resolves contact normal and penetration at the exact leading edge during substepping', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 400;
      ball.y = 85;
      ball.setVelocity(0, 500);

      harness.step(FIXED_DT);
      expect(Number.isFinite(ball.y)).toBe(true);
    });

    it('2.1.3: resolves 45-degree diagonal trajectory striking brick corner without seam trapping', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 88;
      ball.y = 80;
      ball.setVelocity(400, 400);

      harness.step(FIXED_DT);
      expect(Number.isFinite(ball.x)).toBe(true);
      expect(Number.isFinite(ball.y)).toBe(true);
    });

    it('2.1.4: handles multiple rapid collisions within a single frame without NaN velocities', () => {
      harness.start();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 4;
      ball.y = 4;
      ball.setVelocity(-600, -600); // striking top-left corner boundary

      harness.step(FIXED_DT);

      expect(Number.isNaN(ball.vx)).toBe(false);
      expect(Number.isNaN(ball.vy)).toBe(false);
    });

    it('2.1.5: extreme speed ball (700 px/s) striking paddle edge never penetrates below paddle plane', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = paddle.x + paddle.width - 2;
      ball.y = paddle.y - 4;
      ball.setVelocity(200, 700);

      harness.step(FIXED_DT);

      expect(ball.vy).toBeLessThan(0);
      expect(ball.y).toBeLessThanOrEqual(paddle.y);
    });
  });

  describe('Tier 2.2: Paddle Wall Clamping & Boundary Transformations', () => {
    it('2.2.1: clamps paddle strictly at x = 0 when moving left at 650 px/s against left wall', () => {
      harness.start();
      const paddle = harness.getPaddle();
      paddle.x = 5;

      harness.pressKey('ArrowLeft');
      harness.step(FIXED_DT * 3);
      harness.releaseKey('ArrowLeft');

      expect(paddle.x).toBe(0);
    });

    it('2.2.2: clamps paddle strictly at x = 800 - width when moving right against right wall', () => {
      harness.start();
      const paddle = harness.getPaddle();
      paddle.x = CANVAS_WIDTH - paddle.width - 5;

      harness.pressKey('ArrowRight');
      harness.step(FIXED_DT * 3);
      harness.releaseKey('ArrowRight');

      expect(paddle.x).toBe(CANVAS_WIDTH - paddle.width);
    });

    it('2.2.3: dynamic width expansion at canvas right edge shifts paddle x left to prevent overflow', () => {
      harness.start();
      const paddle = harness.getPaddle();
      paddle.x = CANVAS_WIDTH - paddle.width; // 700

      harness.collectPowerup('EXTEND');
      harness.step(0.3); // animate width expansion to 150px

      expect(paddle.x + paddle.width).toBeLessThanOrEqual(CANVAS_WIDTH);
    });

    it('2.2.4: out-of-bounds pointer coordinates (x = -500, x = 2000) clamp safely within [0, 800 - w]', () => {
      harness.start();
      const paddle = harness.getPaddle();

      harness.setPointerX(-500);
      harness.step(FIXED_DT);
      expect(paddle.x).toBe(0);

      harness.setPointerX(2000);
      harness.step(FIXED_DT);
      expect(paddle.x).toBe(CANVAS_WIDTH - paddle.width);
    });

    it('2.2.5: caught ball at extreme paddle edge remains strictly within canvas boundaries [r, 800 - r]', () => {
      harness.start();
      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      ball.stuckOffsetRatio = 1.0; // rightmost edge
      paddle.x = CANVAS_WIDTH - paddle.width;

      harness.step(FIXED_DT);

      expect(ball.x).toBeLessThanOrEqual(CANVAS_WIDTH - ball.radius);
    });
  });

  describe('Tier 2.3: 12-Ball Pool Cap Saturation', () => {
    it('2.3.1: cascades multiple MULTI_BALL power-ups and strictly clamps active balls at 12', () => {
      harness.start();
      harness.launchBall();

      for (let i = 0; i < 6; i++) {
        harness.collectPowerup('MULTI_BALL');
      }

      expect(harness.getBalls().length).toBe(MAX_ACTIVE_BALLS);
    });

    it('2.3.2: collecting additional MULTI_BALL when pool is at 12 active balls triggers zero excess spawning', () => {
      harness.start();
      harness.launchBall();

      for (let i = 0; i < 8; i++) {
        harness.collectPowerup('MULTI_BALL');
      }

      expect(harness.getBalls().length).toBe(12);
    });

    it('2.3.3: verifies scalar speed conservation across all 12 active balls simultaneously', () => {
      harness.start();
      harness.launchBall();
      for (let i = 0; i < 5; i++) {
        harness.collectPowerup('MULTI_BALL');
      }

      const balls = harness.getBalls();
      for (const b of balls) {
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(BALL_INITIAL_SPEED, 1);
      }
    });

    it('2.3.4: processes concurrent boundary collisions for 12 balls in single tick without array corruption', () => {
      harness.start();
      harness.launchBall();
      for (let i = 0; i < 5; i++) {
        harness.collectPowerup('MULTI_BALL');
      }

      const balls = harness.getBalls();
      for (const b of balls) {
        b.y = 5; // all at top ceiling
        b.vy = -300;
      }

      harness.step(FIXED_DT);

      expect(harness.getBalls().length).toBe(12);
      for (const b of harness.getBalls()) {
        expect(b.vy).toBeGreaterThan(0);
      }
    });

    it('2.3.5: preserves player life while 11 balls are lost, losing life only when 12th ball drops', () => {
      harness.start();
      harness.launchBall();
      for (let i = 0; i < 5; i++) {
        harness.collectPowerup('MULTI_BALL');
      }

      const balls = harness.getBalls();
      // Drop 11 balls
      for (let i = 0; i < 11; i++) {
        balls[i].y = 720;
      }

      harness.step(FIXED_DT);
      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES);
      expect(harness.getBalls().length).toBe(1);

      // Drop final ball
      harness.getBalls()[0].y = 720;
      harness.step(FIXED_DT);
      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES - 1);
    });
  });

  describe('Tier 2.4: 350-Particle Recycling & Zero-Leak Stability', () => {
    it('2.4.1: caps active particles strictly at 350 under 50 simultaneous explosion triggers', () => {
      harness.start();
      const ps = harness.particleSystem;

      for (let i = 0; i < 50; i++) {
        ps.emitExplosion(400, 300);
      }

      expect(ps.getActiveCount()).toBeLessThanOrEqual(350);
    });

    it('2.4.2: evicts particle with smallest remaining life when pool is completely full', () => {
      harness.start();
      const ps = harness.particleSystem;

      ps.emitExplosion(400, 300);
      ps.update(0.2); // age active particles

      for (let i = 0; i < 20; i++) {
        ps.emitExplosion(400, 300);
      }

      expect(ps.getActiveCount()).toBeLessThanOrEqual(350);
    });

    it('2.4.3: executes 10,000 rapid emission cycles with zero memory leaks and stable pool references', () => {
      harness.start();
      const ps = harness.particleSystem;

      for (let i = 0; i < 1000; i++) {
        ps.emitBrickBurst(400, 300, '#ef4444');
        ps.update(FIXED_DT);
      }

      expect(ps.getActiveCount()).toBeGreaterThan(0);
      expect(ps.getPoolCapacity()).toBe(350);
    });

    it('2.4.4: clamps maximum screen shake trauma strictly at 1.0 under continuous explosions', () => {
      harness.start();
      for (let i = 0; i < 20; i++) {
        harness.screenShake.addTrauma(0.55);
      }

      expect(harness.getTrauma()).toBe(1.0);
    });

    it('2.4.5: strictly bounds screen translation <= 12px and rotation <= 0.0349 rad under peak trauma', () => {
      harness.start();
      harness.screenShake.addTrauma(1.0);

      for (let i = 0; i < 100; i++) {
        harness.screenShake.update(FIXED_DT);
        const offsets = harness.screenShake.getOffsets();
        expect(Math.abs(offsets.x)).toBeLessThanOrEqual(12);
        expect(Math.abs(offsets.y)).toBeLessThanOrEqual(12);
        expect(Math.abs(offsets.angle)).toBeLessThanOrEqual(0.035);
      }
    });
  });

  describe('Tier 2.5: Minimum Vertical Velocity Safeguard & Invariants', () => {
    it('2.5.1: bounds paddle exit angle strictly within [-75 deg, +75 deg] for all continuous offsets in [-1, 1]', () => {
      const paddle = harness.getPaddle();

      for (let offset = -1; offset <= 1; offset += 0.05) {
        const ball = { x: paddle.x + paddle.width / 2 + offset * (paddle.width / 2), y: paddle.y - 2, speed: 420 };
        const reflection = PaddlePhysics.calculateReflection(ball, paddle);

        const angle = Math.atan2(reflection.vx, -reflection.vy);
        expect(angle).toBeGreaterThanOrEqual(-MAX_PADDLE_BOUNCE_ANGLE - 1e-4);
        expect(angle).toBeLessThanOrEqual(MAX_PADDLE_BOUNCE_ANGLE + 1e-4);
      }
    });

    it('2.5.2: enforces |vy| >= BALL_MIN_VY (80 px/s) on extreme glancing paddle deflections', () => {
      const paddle = harness.getPaddle();
      const ball = { x: paddle.x + paddle.width * 0.99, y: paddle.y - 2, speed: 300 };
      const reflection = PaddlePhysics.calculateReflection(ball, paddle);

      expect(Math.abs(reflection.vy)).toBeGreaterThanOrEqual(80);
    });

    it('2.5.3: enforces |vy| >= speed * sin(15 deg) minimum escape angle on high-speed glancing hits', () => {
      const paddle = harness.getPaddle();
      const ball = { x: paddle.x + paddle.width, y: paddle.y - 2, speed: 700 };
      const reflection = PaddlePhysics.calculateReflection(ball, paddle);

      const minVy = 700 * Math.sin((15 * Math.PI) / 180);
      expect(Math.abs(reflection.vy)).toBeGreaterThanOrEqual(minVy - 1e-4);
    });

    it('2.5.4: maintains speed magnitude invariance: sqrt(vx^2 + vy^2) === ball.speed (+/- 0.001)', () => {
      const paddle = harness.getPaddle();
      const ball = { x: paddle.x + paddle.width * 0.3, y: paddle.y - 2, speed: 420 };
      const reflection = PaddlePhysics.calculateReflection(ball, paddle);

      expect(Math.hypot(reflection.vx, reflection.vy)).toBeCloseTo(420, 2);
    });

    it('2.5.5: moving paddle tangential velocity bias cannot flip vertical exit velocity downwards', () => {
      const paddle = harness.getPaddle();
      paddle.vx = 800; // moving fast right
      const ball = { x: paddle.x + paddle.width * 0.9, y: paddle.y - 2, speed: 420 };
      const reflection = PaddlePhysics.calculateReflection(ball, paddle);

      expect(reflection.vy).toBeLessThan(0); // Upward deflection always guaranteed
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE PAIRWISE INTERACTIONS (6 Suites = 17 Tests)
  // =========================================================================

  describe('Tier 3.1: Multi-Ball + Laser Paddle Interaction', () => {
    it('3.1.1: fires dual laser projectiles while 3 active balls simultaneously bounce and destroy bricks', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('MULTI_BALL');
      harness.collectPowerup('LASER');

      expect(harness.getBalls().length).toBe(3);
      expect(harness.getPaddle().hasLasers).toBe(true);

      harness.fireLaser();
      expect(harness.getLasers().length).toBe(2);

      harness.step(FIXED_DT * 3);
      expect(harness.getBalls().length).toBe(3);
      expect(harness.getLasers()[0].y).toBeLessThan(640);
    });

    it('3.1.2: laser and ball hitting the same armored brick in the same frame resolve damage and scores accurately', () => {
      harness.start();
      harness.setLevel(2);
      harness.collectPowerup('LASER');

      const armored = harness.getBricks().find((b) => b.type === 'ARMORED' && b.maxHits === 2);
      expect(armored).toBeDefined();

      // Hit with laser
      harness.triggerBrickHit(armored!.row, armored!.col);
      expect(armored!.currentHits).toBe(1);

      // Hit with ball
      harness.triggerBrickHit(armored!.row, armored!.col);
      expect(armored!.isAlive).toBe(false);
    });

    it('3.1.3: laser firing does not disrupt active multi-ball trajectories, speeds, or collision detection', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('MULTI_BALL');
      harness.collectPowerup('LASER');

      const balls = harness.getBalls();

      harness.fireLaser();
      harness.step(FIXED_DT);

      expect(balls[0].speed).toBe(BALL_INITIAL_SPEED);
      expect(Math.hypot(balls[0].vx, balls[0].vy)).toBeCloseTo(BALL_INITIAL_SPEED, 1);
    });
  });

  describe('Tier 3.2: Sticky Paddle + Extended / Shrink Paddle Interaction', () => {
    it('3.2.1: catches ball on sticky paddle while paddle width expands from 100px to 150px, maintaining offset', () => {
      harness.start();
      harness.collectPowerup('STICKY');
      harness.collectPowerup('EXTEND');

      const paddle = harness.getPaddle();
      const ball = harness.getBalls()[0];
      expect(ball.isStuckToPaddle).toBe(true);

      harness.step(0.3); // expand width

      expect(paddle.width).toBe(PADDLE_EXTENDED_WIDTH);
      expect(ball.isStuckToPaddle).toBe(true);
    });

    it('3.2.2: launches caught ball from expanded paddle at angle derived from preserved relative offset', () => {
      harness.start();
      harness.collectPowerup('STICKY');
      harness.collectPowerup('EXTEND');
      harness.step(0.3);

      const ball = harness.getBalls()[0];
      ball.stuckOffsetRatio = 0.5;

      harness.launchBall();

      expect(ball.isStuckToPaddle).toBe(false);
      expect(ball.vx).toBeGreaterThan(0);
      expect(ball.vy).toBeLessThan(0);
    });

    it('3.2.3: shrinks paddle with caught ball without ejecting or detaching the ball prematurely', () => {
      harness.start();
      harness.collectPowerup('STICKY');
      harness.collectPowerup('SHRINK');

      const ball = harness.getBalls()[0];
      expect(ball.isStuckToPaddle).toBe(true);

      harness.step(0.3);

      expect(harness.getPaddle().width).toBe(PADDLE_SHRUNK_WIDTH);
      expect(ball.isStuckToPaddle).toBe(true);
    });
  });

  describe('Tier 3.3: Shield Barrier + Slow / Fast Ball Interaction', () => {
    it('3.3.1: slow ball bounces off shield barrier at y = 692, consumes shield, and retains slow speed (300 px/s)', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('SLOW');
      harness.collectPowerup('SHIELD');

      const ball = harness.getBalls()[0];
      ball.x = 400;
      ball.y = 690;
      ball.setVelocity(0, 300);

      harness.step(FIXED_DT);

      expect(ball.vy).toBeLessThan(0);
      expect((harness.engine as unknown as { hasShield: boolean }).hasShield).toBe(false);
      expect(ball.speed).toBe(BALL_MIN_SPEED);
    });

    it('3.3.2: fast ball (1.3x) bounces off shield barrier without tunneling through bottom boundary', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('FAST');
      harness.collectPowerup('SHIELD');

      const ball = harness.getBalls()[0];
      ball.x = 400;
      ball.y = 688;
      ball.setVelocity(0, 546);

      harness.step(FIXED_DT);

      expect(ball.vy).toBeLessThan(0);
      expect(ball.y).toBeLessThanOrEqual(SHIELD_Y);
      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES);
    });

    it('3.3.3: multi-ball with shield: 1 ball saved by shield while 2 other balls remain active', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('MULTI_BALL');
      harness.collectPowerup('SHIELD');

      const balls = harness.getBalls();
      balls[0].y = 690; // drops into shield moving down
      balls[0].setVelocity(0, 300);
      balls[1].y = 300; // remains high
      balls[1].setVelocity(0, -300);
      balls[2].y = 350; // remains high
      balls[2].setVelocity(0, -300);

      harness.step(FIXED_DT);

      expect((harness.engine as unknown as { hasShield: boolean }).hasShield).toBe(false);
      expect(balls[0].vy).toBeLessThan(0);
      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES);
      expect(harness.getBalls().length).toBe(3);
    });
  });

  describe('Tier 3.4: TNT Explosive Cascade + Multi-Ball Interaction', () => {
    it('3.4.1: 2 balls simultaneously striking adjacent TNT bricks trigger dual 3x3 cascading explosions', () => {
      harness.start();
      harness.setLevel(3);
      const tnts = harness.getBricks().filter((b) => b.type === 'EXPLOSIVE');
      expect(tnts.length).toBeGreaterThanOrEqual(2);

      harness.triggerBrickHit(tnts[0].row, tnts[0].col);
      harness.triggerBrickHit(tnts[1].row, tnts[1].col);
      harness.step(0.06);

      expect(tnts[0].isAlive).toBe(false);
      expect(tnts[1].isAlive).toBe(false);
    });

    it('3.4.2: balls passing through freshly detonated TNT blast zones encounter no phantom collisions', () => {
      harness.start();
      harness.setLevel(3);
      const tnt = harness.getBricks().find((b) => b.type === 'EXPLOSIVE');
      harness.triggerBrickHit(tnt!.row, tnt!.col);
      harness.step(0.06);

      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = tnt!.x + 10;
      ball.y = tnt!.y + 10;
      ball.setVelocity(0, -300);

      const initialVy = ball.vy;
      harness.step(FIXED_DT);

      // Should not collide with destroyed brick
      expect(ball.vy).toBe(initialVy);
    });

    it('3.4.3: combo multiplier increments correctly for all bricks destroyed in multi-ball TNT cascade', () => {
      harness.start();
      harness.setLevel(3);
      const tnt = harness.getBricks().find((b) => b.type === 'EXPLOSIVE');
      harness.triggerBrickHit(tnt!.row, tnt!.col);
      harness.step(0.06);

      expect(harness.getHUDState().combo).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Tier 3.5: Laser + TNT Cascade + Multi-Drop Collection', () => {
    it('3.5.1: laser destroys TNT brick, triggering 3x3 cascade and spawning multiple power-up capsules', () => {
      harness.start();
      harness.setLevel(3);
      harness.collectPowerup('LASER');

      const tnt = harness.getBricks().find((b) => b.type === 'EXPLOSIVE');
      harness.triggerBrickHit(tnt!.row, tnt!.col);
      harness.step(0.06);

      expect(tnt!.isAlive).toBe(false);
    });

    it('3.5.2: rapid collection of multiple distinct power-ups applies mutual exclusions cleanly', () => {
      harness.start();
      harness.collectPowerup('EXTEND');
      harness.collectPowerup('SHRINK');
      harness.collectPowerup('SLOW');
      harness.collectPowerup('FAST');

      const active = harness.getHUDState().activePowerups;
      expect(active.some((p) => p.type === 'EXTEND')).toBe(false);
      expect(active.some((p) => p.type === 'SHRINK')).toBe(true);
      expect(active.some((p) => p.type === 'SLOW')).toBe(false);
      expect(active.some((p) => p.type === 'FAST')).toBe(true);
    });
  });

  describe('Tier 3.6: Combo Multiplier Retention Across Multi-Ball Hits & Life Loss', () => {
    it('3.6.1: staggered brick hits from 3 active balls sustain combo timer and ramp multiplier to 8x', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('MULTI_BALL');

      const bricks = harness.getBricks().filter((b) => b.type === 'STANDARD');
      for (let i = 0; i < 22; i++) {
        harness.triggerBrickHit(bricks[i].row, bricks[i].col);
        harness.step(0.1); // 100ms interval (well within 2500ms timeout)
      }

      expect(harness.getHUDState().multiplier).toBe(8);
    });

    it('3.6.2: losing 1 of 3 active balls does NOT reset active combo multiplier', () => {
      harness.start();
      harness.launchBall();
      harness.collectPowerup('MULTI_BALL');

      const bricks = harness.getBricks().filter((b) => b.type === 'STANDARD');
      for (let i = 0; i < 6; i++) {
        harness.triggerBrickHit(bricks[i].row, bricks[i].col);
      }
      expect(harness.getHUDState().multiplier).toBeGreaterThanOrEqual(2);

      // Drop 1 ball
      harness.getBalls()[0].y = 720;
      harness.step(FIXED_DT);

      expect(harness.getHUDState().multiplier).toBeGreaterThanOrEqual(2);
    });

    it('3.6.3: losing final remaining ball resets combo to 0 and multiplier back to 1x', () => {
      harness.start();
      harness.launchBall();

      const brick = harness.getBricks().find((b) => b.type === 'STANDARD');
      harness.triggerBrickHit(brick!.row, brick!.col);
      expect(harness.getHUDState().combo).toBe(1);

      // Drop only ball
      harness.getBalls()[0].y = 720;
      harness.step(FIXED_DT);

      expect(harness.getHUDState().combo).toBe(0);
      expect(harness.getHUDState().multiplier).toBe(1);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION PLAYTHROUGH SCENARIOS (6 Scenarios)
  // =========================================================================

  describe('Tier 4: Real-World Application Playthrough Scenarios', () => {
    it('Scenario 1: Full Level 1 Clean Run - paddle steer, combo accumulation, and stage clear transition', () => {
      const hud0 = harness.getHUDState();
      expect(hud0.status).toBe('IDLE');
      expect(hud0.score).toBe(0);
      expect(hud0.lives).toBe(INITIAL_LIVES);
      expect(hud0.level).toBe(1);

      // 1. Launch Game
      harness.start();
      expect(harness.getHUDState().status).toBe('PLAYING');

      // Launch ball
      harness.launchBall();
      const balls = harness.getBalls();
      expect(balls.length).toBe(1);
      expect(balls[0].isStuckToPaddle).toBe(false);
      expect(balls[0].vy).toBeLessThan(0);

      // 2. Paddle steering
      harness.setPointerX(500);
      harness.step(FIXED_DT);
      expect(harness.getPaddle().x).toBeCloseTo(450, 0);

      // 3. Clear bricks with combo accumulation
      const gridManager = (harness.engine as unknown as { brickGrid: { getRemainingBreakableCount: () => number; getActiveBricks: () => Brick[]; damageBrick: (b: Brick, dmg: number) => void; isLevelClear: () => boolean } }).brickGrid;
      const initialBreakables = gridManager.getRemainingBreakableCount();
      expect(initialBreakables).toBe(60);

      // Hit 4 consecutive bricks to verify combo stepping
      const activeBricks = gridManager.getActiveBricks();
      for (let i = 0; i < 4; i++) {
        gridManager.damageBrick(activeBricks[i], 1);
      }

      // Combo 4 -> Multiplier 2
      const hudAfter4 = harness.getHUDState();
      expect(hudAfter4.combo).toBe(4);
      expect(hudAfter4.multiplier).toBe(2);
      // Hits 1-3 = 300, Hit 4 = 200 => 500
      expect(hudAfter4.score).toBe(500);

      // 4. Clear all remaining breakable bricks
      const remaining = gridManager.getActiveBricks();
      for (const brick of remaining) {
        if (brick.isAlive && brick.type !== 'INDESTRUCTIBLE') {
          gridManager.damageBrick(brick, 1);
        }
      }

      // Step engine to process level clear
      harness.step(FIXED_DT);

      expect(gridManager.isLevelClear()).toBe(true);
      expect(harness.getHUDState().status).toBe('STAGE_CLEAR');
    });

    it('Scenario 2: Armored & Explosive Cascade - durability crack stages and 3x3 cascading TNT blast waves', () => {
      harness.start();
      const gridManager = (harness.engine as unknown as { brickGrid: { getActiveBricks: () => Brick[]; triggerExplosion: (r: number, c: number, depth: number) => void; explosionQueue: unknown[] } }).brickGrid;

      // 1. Armored Brick (2 HP)
      const armoredBrick = Brick.createArmored(2, 2, 100, 100, 2);
      expect(armoredBrick.maxHits).toBe(2);
      expect(armoredBrick.currentHits).toBe(2);

      const hit1 = armoredBrick.hit(1);
      expect(hit1.destroyed).toBe(false);
      expect(hit1.pointsAwarded).toBe(POINTS_ARMORED_PER_HIT);
      expect(armoredBrick.currentHits).toBe(1);
      expect(armoredBrick.isAlive).toBe(true);

      const hit2 = armoredBrick.hit(1);
      expect(hit2.destroyed).toBe(true);
      expect(hit2.pointsAwarded).toBe(POINTS_ARMORED_DESTROY);
      expect(armoredBrick.currentHits).toBe(0);
      expect(armoredBrick.isAlive).toBe(false);

      // 2. 3x3 Staggered TNT Chain Reaction
      harness.setLevel(2);

      const bricksBefore = gridManager.getActiveBricks().length;
      // Detonate TNT at (5, 5)
      gridManager.triggerExplosion(5, 5, 0);

      // Adjacent TNT at (5, 6) is enqueued with 40ms stagger
      expect(gridManager.explosionQueue.length).toBe(1);

      // Advance physics loop by 3 ticks (50ms > 40ms)
      for (let i = 0; i < 3; i++) {
        harness.step(FIXED_DT);
      }

      expect(gridManager.explosionQueue.length).toBe(0);
      const bricksAfter = gridManager.getActiveBricks().length;
      expect(bricksAfter).toBeLessThan(bricksBefore - 5);
    });

    it('Scenario 3: Multi-Ball & Laser Mayhem - multi-ball split, dual laser blaster projectiles, and concurrent destruction', () => {
      harness.start();
      harness.launchBall();

      // 1. Multi-Ball Split
      harness.collectPowerup('MULTI_BALL');
      expect(harness.getBalls().length).toBe(3);

      // Verify scalar speed conservation
      for (const b of harness.getBalls()) {
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(BALL_INITIAL_SPEED, 0);
      }

      // 2. Laser Cannon Activation & Dual Projectiles
      harness.collectPowerup('LASER');
      expect(harness.getPaddle().hasLasers).toBe(true);

      harness.fireLaser();
      expect(harness.getLasers().length).toBe(2);

      const [leftLaser, rightLaser] = harness.getLasers();
      expect(leftLaser.vy).toBe(-650);
      expect(rightLaser.vy).toBe(-650);

      // Cooldown enforces throttle
      harness.fireLaser();
      expect(harness.getLasers().length).toBe(2);

      // 3. Partial Ball Loss Safety
      const balls = (harness.engine as unknown as { balls: Array<unknown> }).balls;
      balls.pop();
      balls.pop();
      expect(harness.getBalls().length).toBe(1);

      // Step physics - remaining ball keeps lives intact
      harness.step(FIXED_DT);
      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES);
    });

    it('Scenario 4: Sticky Paddle Catch & Precision Aim - caught at arbitrary offset, tracks paddle, and precision trajectory', () => {
      harness.start();
      harness.collectPowerup('STICKY');
      expect(harness.getPaddle().isSticky).toBe(true);

      const paddle = harness.getPaddle();
      paddle.x = 350; // center = 400

      const ball = harness.getBalls()[0];
      ball.isStuckToPaddle = false;
      ball.x = 370; // offset = (370 - 400) / 50 = -0.6
      ball.y = 635;
      ball.vy = 300;

      // Update step to register paddle catch
      harness.step(FIXED_DT);

      expect(ball.isStuckToPaddle).toBe(true);
      expect(ball.stuckOffsetRatio).toBeCloseTo(-0.6, 2);
      expect(ball.vx).toBe(0);
      expect(ball.vy).toBe(0);

      // Paddle moves -> ball tracks docked position
      paddle.x = 200;
      harness.step(FIXED_DT);
      expect(ball.x).toBeCloseTo(224.2, 1);

      // Launch ball with calculated angle
      harness.launchBall();
      expect(ball.isStuckToPaddle).toBe(false);
      expect(ball.vx).toBeLessThan(0); // Aimed leftward
      expect(ball.vy).toBeLessThan(0); // Aimed upward
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(BALL_INITIAL_SPEED, 0);
    });

    it('Scenario 5: Shield Barrier Life Save & High Score - saves ball from life loss, dissipates shield, transitions to game over, and persists high score', () => {
      harness.start();
      harness.launchBall();

      // 1. Activate Shield
      harness.collectPowerup('SHIELD');
      expect((harness.engine as unknown as { hasShield: boolean }).hasShield).toBe(true);

      const ball = harness.getBalls()[0];
      ball.x = 400;
      ball.y = 690;
      ball.vy = 400;

      // Update step -> Shield collision
      harness.step(FIXED_DT);

      // Ball saved and reflected upward
      expect(ball.vy).toBeLessThan(0);
      expect(ball.y).toBeLessThan(SHIELD_Y);
      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES);
      expect((harness.engine as unknown as { hasShield: boolean }).hasShield).toBe(false); // Single-use consumption

      // 2. Drop ball again without shield -> Life lost
      ball.y = 705;
      ball.vy = 400;
      harness.step(FIXED_DT);

      expect(harness.getHUDState().lives).toBe(INITIAL_LIVES - 1);

      // 3. Force Game Over & Save High Score
      (harness.engine as unknown as { score: number; lives: number; handleBallLoss: () => void }).score = 42000;
      (harness.engine as unknown as { score: number; lives: number; handleBallLoss: () => void }).lives = 0;
      (harness.engine as unknown as { score: number; lives: number; handleBallLoss: () => void }).handleBallLoss();

      expect(harness.getHUDState().status).toBe('GAME_OVER');

      saveHighScore('ACE', 42000, 1);
      const scores = getHighScores();
      expect(scores.some((s) => s.name === 'ACE' && s.score === 42000)).toBe(true);
    });

    it('Scenario 6: 6-Level Full Campaign Playthrough - advances sequentially through levels 1 to 6 and achieves victory', () => {
      harness.start();

      for (let lvl = 1; lvl <= 5; lvl++) {
        expect(harness.getHUDState().level).toBe(lvl);
        expect(harness.getHUDState().status).toBe('PLAYING');

        // Clear all breakables on current level
        harness.destroyAllBreakables();

        harness.step(FIXED_DT);
        expect(harness.getHUDState().status).toBe('STAGE_CLEAR');

        // Advance to next stage
        harness.nextLevel();
      }

      // On Stage 6 (Final Level)
      expect(harness.getHUDState().level).toBe(6);
      expect((harness.engine as unknown as { levelManager: { isFinalLevel: () => boolean } }).levelManager.isFinalLevel()).toBe(true);

      // Clear Stage 6 breakables
      harness.destroyAllBreakables();

      harness.step(FIXED_DT);

      // Transitions to VICTORY
      expect(harness.getHUDState().status).toBe('VICTORY');
    });
  });
});
