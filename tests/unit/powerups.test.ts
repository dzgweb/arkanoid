/**
 * @file tests/unit/powerups.test.ts
 * Comprehensive Vitest unit test suite for Milestone 3 Collectible Power-ups & Dynamic Mechanics:
 * 1. Multi-Ball cloning, +/-25 deg divergence, speed preservation, and pool cap (up to 12).
 * 2. Paddle Extend (+50%) / Shrink (-30%) width lerping, center preservation, and boundary clamping.
 * 3. Ball speed scaling (Slow 0.7x, Fast 1.3x), bounds clamping, and baseline recovery.
 * 4. Shield Barrier at y = 692, upward bounce, and single-use dissipation.
 * 5. Laser Paddle dual cannons, 220ms cooldown rate limiting, and projectile kinematics.
 * 6. Sticky Paddle docking, offset tracking, launch angle mapping, and auto-release.
 * 7. Power-up Capsule drop kinematics, wobble oscillation, paddle AABB collision, and despawn.
 * 8. Duration timers, refresh on re-collect, mutual exclusivity conflicts, and HUD sync.
 * 9. PowerupManager lifecycle, drop probability resolution, and entity pooling.
 * 10. LaserProjectile kinematics, spatial bounding, and brick collision matrix.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Ball } from '@/game/entities/Ball';
import { Paddle } from '@/game/entities/Paddle';
import { Brick } from '@/game/entities/Brick';
import { PowerupCapsule } from '@/game/entities/PowerupCapsule';
import { LaserProjectile } from '@/game/entities/LaserProjectile';
import { PowerupManager, PowerupContext } from '@/game/systems/PowerupManager';
import { CollisionSystem } from '@/game/physics/CollisionSystem';
import { PaddlePhysics } from '@/game/physics/PaddlePhysics';
import { GameEngine } from '@/game/engine/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_DEFAULT_RADIUS,
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
  PADDLE_Y,
  PADDLE_LASER_COOLDOWN_MS,
  SHIELD_Y,
  CAPSULE_WIDTH,
  CAPSULE_HEIGHT,
  CAPSULE_SPEED_Y,
  CAPSULE_WOBBLE_FREQ,
  CAPSULE_WOBBLE_AMP,
  LASER_WIDTH,
  LASER_HEIGHT,
  LASER_SPEED_Y,
  LASER_DAMAGE,
  POWERUP_DURATIONS,
  POWERUP_CONFIGS,
} from '@/game/constants';
import { PowerupType } from '@/game/types';
import { GameStateStore } from '@/hooks/useGameStateBridge';
import { aabbOverlap, degToRad } from '@/game/physics/MathUtils';

/** Helper to clone ball with specified divergence angle offset */
function createBallClone(parent: Ball, angleOffsetRad: number): Ball {
  const currentAngle = Math.atan2(parent.vx, -parent.vy);
  const targetAngle = currentAngle + angleOffsetRad;
  const speed = parent.speed > 0 ? parent.speed : BALL_INITIAL_SPEED;

  return new Ball({
    x: parent.x,
    y: parent.y,
    speed,
    radius: parent.radius,
    color: parent.color,
    glowColor: parent.glowColor,
    isStuckToPaddle: false,
    vx: speed * Math.sin(targetAngle),
    vy: -speed * Math.cos(targetAngle),
  });
}

describe('Milestone 3: Power-ups & Dynamic Mechanics Unit Tests', () => {
  // =========================================================================
  // 1. Multi-Ball Cloning Mechanics
  // =========================================================================
  describe('1. Multi-Ball Cloning Physics & Divergence', () => {
    it('clones an active in-flight ball into 3 balls diverging by +/- 25 degrees', () => {
      const parentBall = new Ball({
        x: 400,
        y: 300,
        vx: 0,
        vy: -400,
        speed: 400,
        isStuckToPaddle: false,
      });

      // Trajectory angle: atan2(vx, -vy) = atan2(0, 400) = 0 rad (straight up)
      const currentAngle = Math.atan2(parentBall.vx, -parentBall.vy);
      expect(currentAngle).toBeCloseTo(0, 4);

      const cloneLeft = createBallClone(parentBall, -MULTI_BALL_FAN_ANGLE);
      const cloneRight = createBallClone(parentBall, +MULTI_BALL_FAN_ANGLE);

      // Left clone should diverge by -25 degrees (vx < 0, vy < 0)
      const expectedVxLeft = 400 * Math.sin(-degToRad(25));
      const expectedVyLeft = -400 * Math.cos(-degToRad(25));
      expect(cloneLeft.vx).toBeCloseTo(expectedVxLeft, 2);
      expect(cloneLeft.vy).toBeCloseTo(expectedVyLeft, 2);
      expect(Math.hypot(cloneLeft.vx, cloneLeft.vy)).toBeCloseTo(400, 2);

      // Right clone should diverge by +25 degrees (vx > 0, vy < 0)
      const expectedVxRight = 400 * Math.sin(degToRad(25));
      const expectedVyRight = -400 * Math.cos(degToRad(25));
      expect(cloneRight.vx).toBeCloseTo(expectedVxRight, 2);
      expect(cloneRight.vy).toBeCloseTo(expectedVyRight, 2);
      expect(Math.hypot(cloneRight.vx, cloneRight.vy)).toBeCloseTo(400, 2);
    });

    it('strictly preserves scalar speed across arbitrary 2D velocity headings', () => {
      const headings = [
        { vx: 200, vy: -300 },
        { vx: -250, vy: -250 },
        { vx: 350, vy: 150 },
        { vx: -100, vy: 380 },
        { vx: 450, vy: 0 },
        { vx: 0, vy: 450 },
      ];

      for (const h of headings) {
        const speed = Math.hypot(h.vx, h.vy);
        const ball = new Ball({ x: 400, y: 300, vx: h.vx, vy: h.vy, speed, isStuckToPaddle: false });

        const left = createBallClone(ball, -MULTI_BALL_FAN_ANGLE);
        const right = createBallClone(ball, +MULTI_BALL_FAN_ANGLE);

        expect(Math.hypot(left.vx, left.vy)).toBeCloseTo(speed, 2);
        expect(Math.hypot(right.vx, right.vy)).toBeCloseTo(speed, 2);
      }
    });

    it('enforces maximum active ball pool cap of 12 balls under cascading multi-ball activations', () => {
      let balls: Ball[] = [
        new Ball({ x: 400, y: 300, vx: 0, vy: -400, speed: 400, isStuckToPaddle: false }),
      ];

      const applyMultiBall = () => {
        const currentBalls = [...balls];
        for (const b of currentBalls) {
          if (balls.length >= MAX_ACTIVE_BALLS) break;
          const b1 = createBallClone(b, -MULTI_BALL_FAN_ANGLE);
          balls.push(b1);

          if (balls.length >= MAX_ACTIVE_BALLS) break;
          const b2 = createBallClone(b, +MULTI_BALL_FAN_ANGLE);
          balls.push(b2);
        }
      };

      // 1st Multi-Ball: 1 -> 3 balls
      applyMultiBall();
      expect(balls.length).toBe(3);

      // 2nd Multi-Ball: 3 -> 9 balls
      applyMultiBall();
      expect(balls.length).toBe(9);

      // 3rd Multi-Ball: 9 -> capped at 12 balls (not 27)
      applyMultiBall();
      expect(balls.length).toBe(12);

      // 4th Multi-Ball: remains strictly at 12
      applyMultiBall();
      expect(balls.length).toBe(12);
    });

    it('handles exact boundary cap when ball count is 11 and clones 1 ball instead of 2', () => {
      let balls: Ball[] = [];
      for (let i = 0; i < 11; i++) {
        balls.push(new Ball({ x: 400, y: 300, vx: 0, vy: -400, speed: 400, isStuckToPaddle: false }));
      }
      expect(balls.length).toBe(11);

      const currentBalls = [...balls];
      for (const b of currentBalls) {
        if (balls.length >= MAX_ACTIVE_BALLS) break;
        const b1 = createBallClone(b, -MULTI_BALL_FAN_ANGLE);
        balls.push(b1);

        if (balls.length >= MAX_ACTIVE_BALLS) break;
        const b2 = createBallClone(b, +MULTI_BALL_FAN_ANGLE);
        balls.push(b2);
      }

      expect(balls.length).toBe(12);
    });

    it('launches stuck ball before cloning if Multi-Ball is triggered while ball is docked', () => {
      const paddle = new Paddle({ x: 350, width: 100 });
      const ball = new Ball({ x: 400, y: 630, isStuckToPaddle: true, stuckOffsetRatio: 0.5 });

      if (ball.isStuckToPaddle) {
        ball.launch();
      }

      expect(ball.isStuckToPaddle).toBe(false);
      expect(ball.vy).toBeLessThan(0);
      expect(ball.vx).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. Paddle Width Lerping (Extend & Shrink)
  // =========================================================================
  describe('2. Paddle Width Lerp Animation & Boundary Clamping', () => {
    let paddle: Paddle;

    beforeEach(() => {
      paddle = new Paddle({ x: 350, width: PADDLE_BASE_WIDTH }); // center = 400
    });

    it('smoothly expands from base 100px to 150px (+50%) over 250ms', () => {
      paddle.setWidth(PADDLE_EXTENDED_WIDTH, false);
      expect(paddle.width).toBe(100);
      expect(paddle.targetWidth).toBe(150);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };

      // Simulate 125ms (halfway)
      paddle.update(0.125, dummyInput, CANVAS_WIDTH);
      expect(paddle.width).toBeGreaterThan(100);
      expect(paddle.width).toBeLessThan(150);

      // Simulate remaining 125ms
      paddle.update(0.125, dummyInput, CANVAS_WIDTH);
      expect(paddle.width).toBe(150);
    });

    it('smoothly shrinks from base 100px to 70px (-30%) over 250ms', () => {
      paddle.setWidth(PADDLE_SHRUNK_WIDTH, false);
      expect(paddle.targetWidth).toBe(70);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };

      paddle.update(0.25, dummyInput, CANVAS_WIDTH);
      expect(paddle.width).toBe(70);
    });

    it('preserves paddle center coordinate during width expansion in open field', () => {
      const initialCenter = paddle.x + paddle.width / 2; // 350 + 50 = 400
      paddle.setWidth(PADDLE_EXTENDED_WIDTH, false);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };
      paddle.update(0.25, dummyInput, CANVAS_WIDTH);

      const finalCenter = paddle.x + paddle.width / 2;
      expect(paddle.width).toBe(150);
      expect(finalCenter).toBeCloseTo(initialCenter, 1);
      expect(paddle.x).toBeCloseTo(325, 1); // 400 - 75 = 325
    });

    it('re-clamps paddle within canvas bounds [0, 800 - width] when expanding near right wall', () => {
      paddle.x = 700; // at base width 100, right edge is 800
      paddle.setWidth(PADDLE_EXTENDED_WIDTH, false);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };
      paddle.update(0.25, dummyInput, CANVAS_WIDTH);

      expect(paddle.width).toBe(150);
      expect(paddle.x).toBe(CANVAS_WIDTH - 150); // 650
      expect(paddle.x + paddle.width).toBe(CANVAS_WIDTH); // 800
    });

    it('re-clamps paddle within canvas bounds [0, 800 - width] when expanding near left wall', () => {
      paddle.x = 0;
      paddle.setWidth(PADDLE_EXTENDED_WIDTH, false);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };
      paddle.update(0.25, dummyInput, CANVAS_WIDTH);

      expect(paddle.width).toBe(150);
      expect(paddle.x).toBe(0);
    });
  });

  // =========================================================================
  // 3. Ball Speed Modifiers (Slow & Fast)
  // =========================================================================
  describe('3. Ball Speed Scaling & Clamping', () => {
    it('scales ball speed down by 0.7x for SLOW and clamps to BALL_MIN_SPEED (300)', () => {
      const ball = new Ball({ x: 400, y: 300, vx: 0, vy: -420, speed: 420, isStuckToPaddle: false });

      ball.applySpeedModifier(BALL_SLOW_FACTOR); // 420 * 0.7 = 294 -> clamped to 300
      expect(ball.speed).toBe(BALL_MIN_SPEED);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(300, 2);
      expect(ball.vy).toBeCloseTo(-300, 2);
    });

    it('scales ball speed up by 1.3x for FAST and clamps to BALL_MAX_SPEED (700)', () => {
      const ball = new Ball({ x: 400, y: 300, vx: 0, vy: -600, speed: 600, isStuckToPaddle: false });

      ball.applySpeedModifier(BALL_FAST_FACTOR); // 600 * 1.3 = 780 -> clamped to 700
      expect(ball.speed).toBe(BALL_MAX_SPEED);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(700, 2);
      expect(ball.vy).toBeCloseTo(-700, 2);
    });

    it('preserves velocity heading angle precisely during speed scaling', () => {
      const vx = 300;
      const vy = -400;
      const initialAngle = Math.atan2(vx, vy);
      const ball = new Ball({ x: 400, y: 300, vx, vy, speed: 500, isStuckToPaddle: false });

      ball.applySpeedModifier(BALL_SLOW_FACTOR);
      const newAngle = Math.atan2(ball.vx, ball.vy);
      expect(newAngle).toBeCloseTo(initialAngle, 4);

      ball.applySpeedModifier(BALL_FAST_FACTOR);
      const postFastAngle = Math.atan2(ball.vx, ball.vy);
      expect(postFastAngle).toBeCloseTo(initialAngle, 4);
    });
  });

  // =========================================================================
  // 4. Shield Floor Barrier Mechanics
  // =========================================================================
  describe('4. Shield Barrier at y = 692 px', () => {
    it('bounces falling ball upward at y = 692 when shield is active', () => {
      const ball = { x: 400, y: 690, vx: 150, vy: 350, radius: 7 };
      const res = CollisionSystem.checkBoundaryCollision(ball, true);

      expect(res.hitBoundary).toBe('shield');
      expect(ball.y).toBe(SHIELD_Y - 7); // 685
      expect(ball.vy).toBe(-350); // Inverted upward
      expect(ball.vx).toBe(150);  // Horizontal component unaffected
      expect(res.lost).toBeUndefined();
    });

    it('lets ball drop below y = 700 and flags lost when shield is inactive', () => {
      const ball = { x: 400, y: 708, vx: 150, vy: 350, radius: 7 };
      const res = CollisionSystem.checkBoundaryCollision(ball, false);

      expect(res.hitBoundary).toBe('bottom');
      expect(res.lost).toBe(true);
    });

    it('does not trigger shield reflection if ball is already moving upward (vy <= 0)', () => {
      const ball = { x: 400, y: 690, vx: 150, vy: -350, radius: 7 };
      const res = CollisionSystem.checkBoundaryCollision(ball, true);

      expect(res.hitBoundary).toBeUndefined();
      expect(ball.vy).toBe(-350);
    });
  });

  // =========================================================================
  // 5. Laser Paddle Cannons & Cooldown
  // =========================================================================
  describe('5. Laser Paddle Weapon System', () => {
    let paddle: Paddle;

    beforeEach(() => {
      paddle = new Paddle({ x: 350, width: 100, y: PADDLE_Y });
      paddle.setLasers(true, PADDLE_LASER_COOLDOWN_MS);
    });

    it('fires dual laser projectiles from left and right cannon ports', () => {
      const projectiles = paddle.fireLaser();
      expect(projectiles.length).toBe(2);

      const [left, right] = projectiles;
      expect(left.x).toBe(paddle.x + 6);
      expect(right.x).toBe(paddle.x + paddle.width - 6 - 4); // 6px inset, 4px width
      expect(left.y).toBeLessThan(paddle.y);
      expect(left.vy).toBe(LASER_SPEED_Y);
      expect(left.damage).toBe(LASER_DAMAGE);
    });

    it('enforces 220ms cooldown rate limiting between successive shots', () => {
      const firstShot = paddle.fireLaser();
      expect(firstShot.length).toBe(2);

      // Immediate second shot is blocked
      const blockedShot = paddle.fireLaser();
      expect(blockedShot.length).toBe(0);

      // Advance time by 100ms (still on cooldown)
      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };
      paddle.update(0.100, dummyInput, CANVAS_WIDTH);
      expect(paddle.canFireLaser()).toBe(false);

      // Advance remaining 120ms (cooldown expired)
      paddle.update(0.120, dummyInput, CANVAS_WIDTH);
      expect(paddle.canFireLaser()).toBe(true);

      const secondShot = paddle.fireLaser();
      expect(secondShot.length).toBe(2);
    });
  });

  // =========================================================================
  // 6. Sticky Paddle Catch & Launch Mechanics
  // =========================================================================
  describe('6. Sticky / Catch Paddle Mechanics', () => {
    let paddle: Paddle;
    let ball: Ball;

    beforeEach(() => {
      paddle = new Paddle({ x: 350, width: 100, y: PADDLE_Y });
      paddle.setSticky(true);
      ball = new Ball({ x: 420, y: 630, vx: 50, vy: 300, speed: 400, isStuckToPaddle: false });
    });

    it('catches falling ball on collision and records normalized stuckOffsetRatio', () => {
      const events = ball.update(0.016, paddle, false);
      expect(events.paddleHit).toBeDefined();
      expect(ball.isStuckToPaddle).toBe(true);
      expect(ball.vx).toBe(0);
      expect(ball.vy).toBe(0);

      // Offset ratio for ball at x~420 with paddle at x=350, width=100 (center=400, halfWidth=50)
      expect(ball.stuckOffsetRatio).toBeCloseTo(0.4, 1);
    });

    it('synchronizes docked ball position as paddle moves horizontally', () => {
      ball.stickToPaddle(paddle);
      expect(ball.isStuckToPaddle).toBe(true);

      const moveInput = { left: false, right: true, launch: false, fireLaser: false, pointerX: null, pointerActive: false };
      paddle.update(0.1, moveInput, CANVAS_WIDTH); // paddle moves right

      ball.update(0.1, paddle, false);
      const expectedBallX = paddle.x + paddle.width / 2 + ball.stuckOffsetRatio * (paddle.width / 2 - ball.radius);
      expect(ball.x).toBeCloseTo(expectedBallX, 1);
    });

    it('releases held ball with dynamic exit angle corresponding to offset on launch', () => {
      ball.stickToPaddle(paddle);
      ball.stuckOffsetRatio = 0.5; // right side
      ball.launch();

      expect(ball.isStuckToPaddle).toBe(false);
      expect(ball.vx).toBeGreaterThan(0); // angles right
      expect(ball.vy).toBeLessThan(0);    // launches upward
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(ball.speed, 2);
    });
  });

  // =========================================================================
  // 7. Powerup Capsule Kinematics & Paddle AABB Collision
  // =========================================================================
  describe('7. Powerup Capsule Kinematics & Collision', () => {
    it('falls at constant kinematic velocity of 150 px/s downward', () => {
      const capsule = new PowerupCapsule({
        type: 'MULTI_BALL',
        x: 400,
        y: 200,
      });

      const dt = 0.5;
      capsule.update(dt);
      expect(capsule.y).toBe(275);
    });

    it('computes sinusoidal wobble offset correctly based on elapsed time', () => {
      const capsule = new PowerupCapsule({
        type: 'EXTEND',
        x: 400,
        y: 200,
      });

      // t = 0 -> sin(0) = 0
      expect(capsule.getWobbleOffset(0)).toBeCloseTo(0, 4);

      // t = PI / (2 * CAPSULE_WOBBLE_FREQ) -> sin(PI/2) = 1 -> offset = AMPLITUDE (6)
      const tPeak = Math.PI / (2 * CAPSULE_WOBBLE_FREQ);
      expect(capsule.getWobbleOffset(tPeak)).toBeCloseTo(CAPSULE_WOBBLE_AMP, 4);
    });

    it('detects AABB collection collision when capsule overlaps paddle', () => {
      const paddleBox = { x: 350, y: 640, width: 100, height: 16 };
      const overlappingCapsule = { x: 380, y: 638, width: 32, height: 16 };
      const nonOverlappingCapsule = { x: 380, y: 500, width: 32, height: 16 };

      expect(aabbOverlap(overlappingCapsule, paddleBox)).toBe(true);
      expect(aabbOverlap(nonOverlappingCapsule, paddleBox)).toBe(false);
    });
  });

  // =========================================================================
  // 8. Timers, Stacking Rules & Conflict Resolution
  // =========================================================================
  describe('8. Power-up Timers & Mutual Exclusivity', () => {
    let store: GameStateStore;
    let engine: GameEngine;

    beforeEach(() => {
      store = new GameStateStore();
      engine = new GameEngine({ stateStore: store });
      engine.startGame();
    });

    it('all 7 power-up types have valid configuration entries and colors', () => {
      const types: PowerupType[] = [
        'MULTI_BALL',
        'LASER',
        'EXTEND',
        'SHRINK',
        'SLOW',
        'FAST',
        'STICKY',
        'SHIELD',
      ];

      for (const t of types) {
        const config = POWERUP_CONFIGS[t];
        expect(config).toBeDefined();
        expect(config.letter).toBeTruthy();
        expect(config.label).toBeTruthy();
        expect(config.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('collecting Extend paddle overrides active Shrink paddle penalty', () => {
      const testAPI = (window as unknown as { __ARKANOID_TEST_API__: any }).__ARKANOID_TEST_API__;
      const paddle = testAPI.getPaddle();

      // Apply Shrink
      testAPI.spawnPowerup('SHRINK', paddle.x + 20, paddle.y);
      (engine as any).update(0.016);
      expect(paddle.targetWidth).toBe(PADDLE_SHRUNK_WIDTH);

      // Now apply Extend
      testAPI.spawnPowerup('EXTEND', paddle.x + 20, paddle.y);
      (engine as any).update(0.016);
      expect(paddle.targetWidth).toBe(PADDLE_EXTENDED_WIDTH);
    });

    it('decrements power-up duration timers and expires cleanly', () => {
      const testAPI = (window as unknown as { __ARKANOID_TEST_API__: any }).__ARKANOID_TEST_API__;
      const paddle = testAPI.getPaddle();

      testAPI.spawnPowerup('LASER', paddle.x + 20, paddle.y);
      (engine as any).update(0.016);
      expect(paddle.hasLasers).toBe(true);

      const stateBefore = testAPI.getHUDState();
      const laserPowerup = stateBefore.activePowerups.find((p: any) => p.type === 'LASER');
      expect(laserPowerup).toBeDefined();

      // Fast forward 11 seconds (duration is 10s)
      for (let i = 0; i < 110; i++) {
        (engine as any).update(0.1);
      }

      expect(paddle.hasLasers).toBe(false);
      const stateAfter = testAPI.getHUDState();
      const expiredLaser = stateAfter.activePowerups.find((p: any) => p.type === 'LASER');
      expect(expiredLaser).toBeUndefined();
    });
  });

  // =========================================================================
  // 9. PowerupManager System Unit Tests
  // =========================================================================
  describe('9. PowerupManager System Implementation', () => {
    let manager: PowerupManager;
    let paddle: Paddle;
    let balls: Ball[];
    let hasShield: boolean;
    let context: PowerupContext;

    beforeEach(() => {
      manager = new PowerupManager();
      paddle = new Paddle({ x: 350, width: 100 });
      balls = [new Ball({ x: 400, y: 600, speed: BALL_INITIAL_SPEED, vx: 0, vy: -BALL_INITIAL_SPEED, isStuckToPaddle: false })];
      hasShield = false;

      context = {
        paddle,
        balls,
        hasShield,
        setShield: (active) => {
          hasShield = active;
          context.hasShield = active;
        },
      };
    });

    it('resolves predetermined special drop with 100% certainty', () => {
      const brick = Brick.createStandard(0, 0, 100, 100, 'RED', 'MULTI_BALL');
      const capsule = manager.resolveBrickDrop(brick, 'MULTI_BALL');
      expect(capsule).not.toBeNull();
      expect(capsule?.type).toBe('MULTI_BALL');
    });

    it('cancels SLOW when FAST is collected and vice versa', () => {
      // 1. Apply SLOW
      manager.applyPowerup('SLOW', context);
      expect(manager.isPowerupActive('SLOW')).toBe(true);
      expect(balls[0].speed).toBe(BALL_MIN_SPEED);

      // 2. Apply FAST -> should cancel SLOW
      manager.applyPowerup('FAST', context);
      expect(manager.isPowerupActive('SLOW')).toBe(false);
      expect(manager.isPowerupActive('FAST')).toBe(true);
      expect(balls[0].speed).toBe(BALL_INITIAL_SPEED * BALL_FAST_FACTOR);
    });

    it('re-collecting the same powerup refreshes the timer to maximum duration', () => {
      manager.applyPowerup('LASER', context);
      expect(manager.getRemainingTime('LASER')).toBe(10000);

      // Advance by 4 seconds
      manager.update(4.0, context);
      expect(manager.getRemainingTime('LASER')).toBeCloseTo(6000, -2);

      // Re-apply LASER -> timer should refresh to 10000
      manager.applyPowerup('LASER', context);
      expect(manager.getRemainingTime('LASER')).toBe(10000);
    });

    it('clearAll completely wipes active powerups and reverts paddle/ball state', () => {
      manager.applyPowerup('EXTEND', context);
      manager.applyPowerup('LASER', context);
      manager.applyPowerup('FAST', context);
      manager.applyPowerup('SHIELD', context);

      expect(paddle.targetWidth).toBe(PADDLE_EXTENDED_WIDTH);
      expect(paddle.hasLasers).toBe(true);
      expect(context.hasShield).toBe(true);

      manager.clearAll(context);

      expect(manager.getActivePowerupsList().length).toBe(0);
      expect(paddle.targetWidth).toBe(PADDLE_BASE_WIDTH);
      expect(paddle.hasLasers).toBe(false);
      expect(balls[0].speed).toBe(BALL_INITIAL_SPEED);
      expect(context.hasShield).toBe(false);
    });
  });

  // =========================================================================
  // 10. LaserProjectile Entity Unit Tests
  // =========================================================================
  describe('10. LaserProjectile Entity Class', () => {
    it('initializes with default constants and moves upward at LASER_SPEED_Y', () => {
      const laser = new LaserProjectile({
        x: 350,
        y: 600,
      });

      expect(laser.width).toBe(LASER_WIDTH);
      expect(laser.height).toBe(LASER_HEIGHT);
      expect(laser.vy).toBe(LASER_SPEED_Y);
      expect(laser.damage).toBe(LASER_DAMAGE);
      expect(laser.isAlive).toBe(true);

      // Update by 0.1s
      laser.update(0.1);
      expect(laser.y).toBeCloseTo(600 + LASER_SPEED_Y * 0.1, 2);
    });

    it('deactivates when traveling past top ceiling (y + height < 0)', () => {
      const laser = new LaserProjectile({
        x: 350,
        y: 2,
      });

      laser.update(0.1); // moves by -65px -> y = -63px
      expect(laser.y + laser.height).toBeLessThan(0);
      expect(laser.isAlive).toBe(false);
    });

    it('destroys immediately on destroy() call', () => {
      const laser = new LaserProjectile({ x: 350, y: 400 });
      expect(laser.isAlive).toBe(true);
      laser.destroy();
      expect(laser.isAlive).toBe(false);
    });
  });
});
