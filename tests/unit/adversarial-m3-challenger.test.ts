/**
 * @file tests/unit/adversarial-m3-challenger.test.ts
 * Empirical Adversarial Verification Suite by Challenger M3-2
 * Focus Areas:
 * 1. Laser Projectiles:
 *    - Exact 220ms rate limiting & cooldown countdown math
 *    - Twin projectile spawn geometry from paddle edges across standard, extended, and shrunk paddle widths
 *    - Projectile kinematics (vy = -650 px/s), ceiling despawn (y + height < 0), bounding boxes
 *    - Collision against Standard (1-hit), Armored (2-3 hits), Indestructible (resist), and TNT Explosive (3x3 cascade)
 * 2. Sticky Paddle:
 *    - Impact contact point capture and stuckOffsetRatio calculation
 *    - Spatial retention during keyboard and pointer paddle movement
 *    - Accurate launch angle computation based on offset ratio upon Space/click/tap
 *    - Multi-ball sticky docking and simultaneous launch
 *    - Auto-release upon powerup expiration / removal
 * 3. Shield Barrier:
 *    - Barrier positioning at y = 692
 *    - Upward bounce of falling balls (vy > 0) with vx preservation
 *    - Clean single-use dissipation upon first contact
 *    - Loss of subsequent balls after shield consumption or expiration
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
  INITIAL_LIVES,
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
  GRID_OFFSET_LEFT,
  GRID_OFFSET_TOP,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  GRID_GAP,
} from '@/game/constants';
import { ILevelLayout } from '@/game/types';

describe('Empirical Adversarial Test Suite: Challenger M3-2', () => {
  // =========================================================================
  // SECTION 1: LASER PROJECTILE MECHANICS & COOLDOWN RATE LIMITING
  // =========================================================================
  describe('1. Laser Projectiles: Rate Limiting, Geometry & Damage', () => {
    let paddle: Paddle;

    beforeEach(() => {
      paddle = new Paddle({ x: 350, width: PADDLE_BASE_WIDTH, y: PADDLE_Y });
      paddle.setLasers(true, PADDLE_LASER_COOLDOWN_MS);
    });

    it('empirically verifies exact 220ms rate limiting across sub-millisecond intervals', () => {
      // 1. Initial shot must succeed
      expect(paddle.canFireLaser()).toBe(true);
      const shot1 = paddle.fireLaser();
      expect(shot1.length).toBe(2);
      expect(paddle.canFireLaser()).toBe(false);
      expect(paddle.laserTimerMs).toBe(220);

      const dummyInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: null, pointerActive: false };

      // 2. Test firing attempts during cooldown: 50ms, 100ms, 150ms, 200ms, 219ms
      const subIntervals = [0.050, 0.050, 0.050, 0.050, 0.019]; // total 219ms
      for (const step of subIntervals) {
        paddle.update(step, dummyInput, CANVAS_WIDTH);
        expect(paddle.canFireLaser()).toBe(false);
        const blockedShot = paddle.fireLaser();
        expect(blockedShot.length).toBe(0);
      }

      // At 219ms, 1ms remains
      expect(paddle.laserTimerMs).toBeCloseTo(1, 1);
      expect(paddle.canFireLaser()).toBe(false);

      // 3. Advance final 1ms (total 220ms) -> cooldown clears
      paddle.update(0.001, dummyInput, CANVAS_WIDTH);
      expect(paddle.laserTimerMs).toBe(0);
      expect(paddle.canFireLaser()).toBe(true);

      // 4. Second shot succeeds
      const shot2 = paddle.fireLaser();
      expect(shot2.length).toBe(2);
      expect(paddle.laserTimerMs).toBe(220);
    });

    it('spawns twin projectiles with exact paddle edge offsets for standard, extended, and shrunk paddle widths', () => {
      const testCases = [
        { width: PADDLE_BASE_WIDTH, name: 'Standard (100px)' },
        { width: PADDLE_EXTENDED_WIDTH, name: 'Extended (150px)' },
        { width: PADDLE_SHRUNK_WIDTH, name: 'Shrunk (70px)' },
      ];

      for (const tc of testCases) {
        paddle.width = tc.width;
        paddle.targetWidth = tc.width;
        paddle.x = 200;
        paddle.laserTimerMs = 0;

        const projectiles = paddle.fireLaser();
        expect(projectiles.length).toBe(2);

        const [left, right] = projectiles;
        // Left cannon at paddle.x + 6
        expect(left.x).toBe(200 + 6);
        // Right cannon at paddle.x + width - 6 - LASER_WIDTH (4) = paddle.x + width - 10
        expect(right.x).toBe(200 + tc.width - 10);
        // Spawn Y at paddle.y - LASER_HEIGHT (14)
        expect(left.y).toBe(PADDLE_Y - LASER_HEIGHT);
        expect(right.y).toBe(PADDLE_Y - LASER_HEIGHT);

        // Projectile properties
        expect(left.width).toBe(LASER_WIDTH);
        expect(left.height).toBe(LASER_HEIGHT);
        expect(left.vy).toBe(LASER_SPEED_Y);
        expect(left.damage).toBe(LASER_DAMAGE);
        expect(left.isAlive).toBe(true);
      }
    });

    it('verifies laser projectile kinematics and ceiling boundary deactivation', () => {
      const laser = new LaserProjectile({
        x: 400,
        y: 100,
        vy: -650,
      });

      // Advance by 0.1s: displacement = -65px -> y = 35px
      laser.update(0.1);
      expect(laser.y).toBeCloseTo(35, 1);
      expect(laser.isAlive).toBe(true);

      // Advance by 0.1s: displacement = -65px -> y = -30px (y + height = -30 + 14 = -16 < 0)
      laser.update(0.1);
      expect(laser.y).toBeCloseTo(-30, 1);
      expect(laser.isAlive).toBe(false);
    });

    it('damages and destroys standard (1-hit) bricks with laser', () => {
      const gridManager = new BrickGridManager();
      const layout: ILevelLayout = {
        name: 'Test Level',
        author: 'Challenger',
        matrix: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // (0,0) is Red Standard Brick
        ],
      };
      gridManager.loadLevel(layout);
      const brick = gridManager.getBrickAt(0, 0)!;
      expect(brick).not.toBeNull();
      expect(brick.isAlive).toBe(true);
      expect(brick.currentHits).toBe(1);

      // Spawn laser directly beneath brick
      const laser = new LaserProjectile({
        x: brick.x + brick.width / 2 - LASER_WIDTH / 2,
        y: brick.y + brick.height + 2,
        vy: LASER_SPEED_Y,
      });

      // Move laser into brick
      laser.update(0.01);
      const hitRes = gridManager.checkLaserCollision(laser);
      expect(hitRes.hit).toBe(true);
      expect(hitRes.brick).toBe(brick);

      // Apply damage
      gridManager.damageBrick(hitRes.brick!, laser.damage);
      laser.destroy();

      expect(laser.isAlive).toBe(false);
      expect(brick.isAlive).toBe(false);
      expect(gridManager.getRemainingBreakableCount()).toBe(0);
    });

    it('damages armored bricks incrementally (2 hits for tier 1, 3 hits for tier 2) and destroys upon zero health', () => {
      const gridManager = new BrickGridManager();
      const layout: ILevelLayout = {
        name: 'Armored Test',
        author: 'Challenger',
        matrix: [
          [8, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // (0,0)=Tier 1 Armored (2 hits), (0,1)=Tier 2 Armored (3 hits)
        ],
      };
      gridManager.loadLevel(layout);

      const brickTier1 = gridManager.getBrickAt(0, 0)!;
      const brickTier2 = gridManager.getBrickAt(0, 1)!;
      expect(brickTier1.currentHits).toBe(2);
      expect(brickTier2.currentHits).toBe(3);

      // Hit Tier 1 with 1st laser
      gridManager.damageBrick(brickTier1, 1);
      expect(brickTier1.currentHits).toBe(1);
      expect(brickTier1.isAlive).toBe(true);

      // Hit Tier 1 with 2nd laser -> destroyed
      gridManager.damageBrick(brickTier1, 1);
      expect(brickTier1.currentHits).toBe(0);
      expect(brickTier1.isAlive).toBe(false);

      // Hit Tier 2 with 3 lasers sequentially
      gridManager.damageBrick(brickTier2, 1);
      expect(brickTier2.currentHits).toBe(2);
      expect(brickTier2.isAlive).toBe(true);

      gridManager.damageBrick(brickTier2, 1);
      expect(brickTier2.currentHits).toBe(1);
      expect(brickTier2.isAlive).toBe(true);

      gridManager.damageBrick(brickTier2, 1);
      expect(brickTier2.currentHits).toBe(0);
      expect(brickTier2.isAlive).toBe(false);
    });

    it('laser projectile hitting indestructible brick is destroyed while brick remains unharmed', () => {
      const gridManager = new BrickGridManager();
      const layout: ILevelLayout = {
        name: 'Indestructible Test',
        author: 'Challenger',
        matrix: [
          [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // (0,0)=Indestructible (code 10)
        ],
      };
      gridManager.loadLevel(layout);

      const brick = gridManager.getBrickAt(0, 0)!;
      expect(brick.type).toBe('INDESTRUCTIBLE');
      expect(brick.isAlive).toBe(true);

      const laser = new LaserProjectile({
        x: brick.x + 10,
        y: brick.y + brick.height - 2,
        vy: LASER_SPEED_Y,
      });

      const hitRes = gridManager.checkLaserCollision(laser);
      expect(hitRes.hit).toBe(true);

      gridManager.damageBrick(hitRes.brick!, laser.damage);
      laser.destroy();

      expect(laser.isAlive).toBe(false);
      expect(brick.isAlive).toBe(true); // Indestructible bricks do not take damage
    });

    it('laser hitting explosive TNT detonates cascading 3x3 destruction including adjacent armored bricks', () => {
      const gridManager = new BrickGridManager();
      // 3x3 layout with TNT in center at (1,1), surrounded by standard (1) and armored (8) bricks
      const layout: ILevelLayout = {
        name: 'TNT Cascade Test',
        author: 'Challenger',
        matrix: [
          [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [8, 11, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0], // (1,1) is TNT (11)
          [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
      };
      gridManager.loadLevel(layout);
      expect(gridManager.getRemainingBreakableCount()).toBe(9);

      const tntBrick = gridManager.getBrickAt(1, 1)!;
      expect(tntBrick.type).toBe('EXPLOSIVE');

      // Spawn laser impacting TNT
      const laser = new LaserProjectile({
        x: tntBrick.x + 20,
        y: tntBrick.y + tntBrick.height - 1,
        vy: LASER_SPEED_Y,
      });

      const hitRes = gridManager.checkLaserCollision(laser);
      expect(hitRes.hit).toBe(true);

      gridManager.damageBrick(hitRes.brick!, laser.damage);
      laser.destroy();

      // Verify all 9 bricks in 3x3 cluster are destroyed
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const b = gridManager.getBrickAt(r, c);
          expect(b?.isAlive).toBe(false);
        }
      }
      expect(gridManager.getRemainingBreakableCount()).toBe(0);
      expect(gridManager.isLevelClear()).toBe(true);
    });

    it('laser hitting chained TNT bricks triggers delayed staggered detonations', () => {
      const gridManager = new BrickGridManager();
      // Layout with TNT at (0,0) and chained TNT at (0,1)
      const layout: ILevelLayout = {
        name: 'Chained TNT Test',
        author: 'Challenger',
        matrix: [
          [11, 11, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], // TNT at (0,0) and (0,1), Standard at (0,2)
        ],
      };
      gridManager.loadLevel(layout);
      expect(gridManager.getRemainingBreakableCount()).toBe(3);

      const tnt1 = gridManager.getBrickAt(0, 0)!;
      const tnt2 = gridManager.getBrickAt(0, 1)!;
      const std3 = gridManager.getBrickAt(0, 2)!;

      // Damage TNT 1
      gridManager.damageBrick(tnt1, 1);
      expect(tnt1.isAlive).toBe(false);
      // TNT 2 is immediately marked inactive and queued for 40ms stagger
      expect(tnt2.isAlive).toBe(false);
      // Standard at (0,2) is not adjacent to (0,0), so it is still alive before stagger update
      expect(std3.isAlive).toBe(true);

      // Advance by 20ms (stagger still pending)
      gridManager.update(0.02);
      expect(std3.isAlive).toBe(true);

      // Advance remaining 25ms (total 45ms > 40ms) -> TNT 2 detonates and destroys adjacent Standard at (0,2)
      gridManager.update(0.025);
      expect(std3.isAlive).toBe(false);
      expect(gridManager.getRemainingBreakableCount()).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 2: STICKY PADDLE CATCH, RETENTION & LAUNCH MECHANICS
  // =========================================================================
  describe('2. Sticky Paddle: Contact Catch, Retention & Accurate Launch', () => {
    let paddle: Paddle;

    beforeEach(() => {
      paddle = new Paddle({ x: 350, width: 100, y: PADDLE_Y });
      paddle.setSticky(true);
    });

    it('catches falling balls at arbitrary contact points and accurately computes stuckOffsetRatio', () => {
      // Test offsets: left edge (x=350), quarter (x=375), center (x=400), three-quarter (x=425), right edge (x=450)
      const testPositions = [
        { ballX: 350, expectedOffsetRatio: -1.0 },
        { ballX: 375, expectedOffsetRatio: -0.5 },
        { ballX: 400, expectedOffsetRatio: 0.0 },
        { ballX: 425, expectedOffsetRatio: 0.5 },
        { ballX: 450, expectedOffsetRatio: 1.0 },
      ];

      for (const tp of testPositions) {
        const ball = new Ball({
          x: tp.ballX,
          y: PADDLE_Y - 5,
          vx: 0,
          vy: 300,
          speed: 400,
          isStuckToPaddle: false,
        });

        // Run ball update against sticky paddle
        const events = ball.update(0.016, paddle, false);
        expect(events.paddleHit).toBeDefined();
        expect(ball.isStuckToPaddle).toBe(true);
        expect(ball.vx).toBe(0);
        expect(ball.vy).toBe(0);
        expect(ball.stuckOffsetRatio).toBeCloseTo(tp.expectedOffsetRatio, 1);
        expect(paddle.heldBalls.includes(ball)).toBe(true);
      }
    });

    it('strictly preserves relative contact offset as paddle moves across canvas via keyboard and pointer', () => {
      const ball = new Ball({
        x: 425, // offset ratio = +0.5
        y: PADDLE_Y - 8,
        vx: 0,
        vy: 300,
        speed: 400,
        isStuckToPaddle: false,
      });

      ball.update(0.016, paddle, false);
      expect(ball.isStuckToPaddle).toBe(true);
      const ratio = ball.stuckOffsetRatio;
      expect(ratio).toBeCloseTo(0.5, 1);

      // Move paddle to the right via keyboard
      const rightInput = { left: false, right: true, launch: false, fireLaser: false, pointerX: null, pointerActive: false };
      for (let f = 0; f < 10; f++) {
        paddle.update(0.016, rightInput, CANVAS_WIDTH);
        ball.update(0.016, paddle, false);

        const expectedCenter = paddle.x + paddle.width / 2;
        const expectedBallX = expectedCenter + ratio * (paddle.width / 2 - ball.radius);
        expect(ball.x).toBeCloseTo(expectedBallX, 2);
        expect(ball.y).toBe(PADDLE_Y - ball.radius - 1);
      }

      // Move paddle via mouse pointer to x = 150
      const pointerInput = { left: false, right: false, launch: false, fireLaser: false, pointerX: 150, pointerActive: true };
      paddle.update(0.016, pointerInput, CANVAS_WIDTH);
      ball.update(0.016, paddle, false);

      const expectedCenter2 = paddle.x + paddle.width / 2;
      const expectedBallX2 = expectedCenter2 + ratio * (paddle.width / 2 - ball.radius);
      expect(ball.x).toBeCloseTo(expectedBallX2, 2);
      expect(ball.y).toBe(PADDLE_Y - ball.radius - 1);
    });

    it('launches ball with exit angle mathematically matching stuckOffsetRatio upon release', () => {
      const testRatios = [-0.8, -0.4, 0.0, 0.4, 0.8];

      for (const r of testRatios) {
        const ball = new Ball({
          x: 400,
          y: 630,
          speed: 450,
          isStuckToPaddle: true,
          stuckOffsetRatio: r,
        });

        ball.launch();
        expect(ball.isStuckToPaddle).toBe(false);

        const expectedAngle = r * MAX_PADDLE_BOUNCE_ANGLE * 0.8;
        const expectedVx = 450 * Math.sin(expectedAngle);
        const expectedVy = -450 * Math.cos(expectedAngle);

        expect(ball.vx).toBeCloseTo(expectedVx, 2);
        expect(ball.vy).toBeCloseTo(expectedVy, 2);
        expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(450, 2);
      }
    });

    it('catches multiple balls simultaneously on sticky paddle and launches all upon action', () => {
      const ball1 = new Ball({ x: 370, y: PADDLE_Y - 5, vx: 0, vy: 300, speed: 400, isStuckToPaddle: false });
      const ball2 = new Ball({ x: 430, y: PADDLE_Y - 5, vx: 0, vy: 300, speed: 400, isStuckToPaddle: false });

      ball1.update(0.016, paddle, false);
      ball2.update(0.016, paddle, false);

      expect(ball1.isStuckToPaddle).toBe(true);
      expect(ball2.isStuckToPaddle).toBe(true);
      expect(paddle.heldBalls.length).toBe(2);

      // Launch all held balls
      paddle.releaseHeldBalls();
      expect(ball1.isStuckToPaddle).toBe(false);
      expect(ball2.isStuckToPaddle).toBe(false);
      expect(ball1.vy).toBeLessThan(0);
      expect(ball2.vy).toBeLessThan(0);
      expect(paddle.heldBalls.length).toBe(0);
    });

    it('automatically releases docked balls when Sticky powerup expires or is removed', () => {
      const powerupManager = new PowerupManager();
      const balls = [new Ball({ x: 400, y: 630, isStuckToPaddle: true, stuckOffsetRatio: 0.2 })];
      paddle.catchBall(balls[0]);

      let shieldActive = false;
      const context: PowerupContext = {
        paddle,
        balls,
        hasShield: shieldActive,
        setShield: (act) => { shieldActive = act; },
      };

      powerupManager.applyPowerup('STICKY', context);
      expect(paddle.isSticky).toBe(true);
      expect(balls[0].isStuckToPaddle).toBe(true);

      // Fast forward past sticky duration (15s)
      powerupManager.update(16.0, context);

      expect(paddle.isSticky).toBe(false);
      expect(balls[0].isStuckToPaddle).toBe(false);
      expect(balls[0].vy).toBeLessThan(0);
    });

    it('GameEngine launches docked balls via inputManager Space / click / tap actions', () => {
      const store = new GameStateStore();
      const engine = new GameEngine({ stateStore: store });
      engine.startGame();

      const testAPI = (window as unknown as { __ARKANOID_TEST_API__: any }).__ARKANOID_TEST_API__;
      const balls = testAPI.getBalls();
      expect(balls.length).toBe(1);
      expect(balls[0].isStuckToPaddle).toBe(true);

      // Trigger action (Spacebar / Primary Action)
      engine.inputManager.handlePrimaryAction();

      expect(balls[0].isStuckToPaddle).toBe(false);
      expect(balls[0].vy).toBeLessThan(0);
    });
  });

  // =========================================================================
  // SECTION 3: SHIELD BARRIER COLLISION & SINGLE-USE DISSIPATION
  // =========================================================================
  describe('3. Shield Barrier at y = 692: Reflection & Dissipation', () => {
    it('bounces falling ball upward at y = 692 and conserves horizontal momentum', () => {
      const ball = { x: 400, y: 686, vx: -200, vy: 350, radius: 7 };
      // Move ball past shield y = 692 (y + radius = 693 >= 692)
      ball.y = 687;
      const res = CollisionSystem.checkBoundaryCollision(ball, true);

      expect(res.hitBoundary).toBe('shield');
      expect(ball.y).toBe(SHIELD_Y - ball.radius); // 685
      expect(ball.vy).toBe(-350); // Upward reflection
      expect(ball.vx).toBe(-200); // Unaltered horizontal velocity
      expect(res.lost).toBeUndefined();
    });

    it('cleanly dissipates shield after single bounce in GameEngine fixed-timestep loop', () => {
      const store = new GameStateStore();
      const engine = new GameEngine({ stateStore: store });
      engine.startGame();

      const testAPI = (window as unknown as { __ARKANOID_TEST_API__: any }).__ARKANOID_TEST_API__;
      const paddle = testAPI.getPaddle();
      const balls = testAPI.getBalls();
      const ball = balls[0];

      // Launch ball
      engine.launchBall();
      expect(ball.isStuckToPaddle).toBe(false);

      // Grant Shield power-up
      testAPI.spawnPowerup('SHIELD', paddle.x + 20, paddle.y);
      (engine as any).update(0.016); // Collect capsule

      const hudStateWithShield = testAPI.getHUDState();
      expect(hudStateWithShield.hasShield).toBe(true);

      // Position ball falling directly onto shield
      ball.x = 400;
      ball.y = SHIELD_Y - ball.radius - 2;
      ball.vx = 0;
      ball.vy = 400;

      // Update 1 step -> ball reaches shield and bounces
      (engine as any).update(0.016);

      expect(ball.vy).toBeLessThan(0); // Bounced upward
      const hudStateAfterBounce = testAPI.getHUDState();
      expect(hudStateAfterBounce.hasShield).toBe(false); // Shield cleanly dissipated

      // Subsequent ball falling past shield is lost
      ball.y = 695;
      ball.vy = 400;
      (engine as any).update(0.05); // Moves past y = 700

      // Ball was lost, lives decremented
      const hudStateLost = testAPI.getHUDState();
      expect(hudStateLost.lives).toBe(INITIAL_LIVES - 1);
    });

    it('handles multiple balls: shield saves the first ball, subsequent lost ball is lost', () => {
      const store = new GameStateStore();
      const engine = new GameEngine({ stateStore: store });
      engine.startGame();

      const testAPI = (window as unknown as { __ARKANOID_TEST_API__: any }).__ARKANOID_TEST_API__;
      const paddle = testAPI.getPaddle();
      testAPI.spawnPowerup('SHIELD', paddle.x + 20, paddle.y);
      (engine as any).update(0.016);

      const hud = testAPI.getHUDState();
      expect(hud.hasShield).toBe(true);

      // Create 2 falling balls
      const balls = testAPI.getBalls();
      balls.length = 0;

      const ball1 = new Ball({ x: 200, y: SHIELD_Y - 5, vx: 0, vy: 400, isStuckToPaddle: false });
      const ball2 = new Ball({ x: 600, y: SHIELD_Y - 50, vx: 0, vy: 400, isStuckToPaddle: false });
      balls.push(ball1, ball2);

      // Step 1: ball1 hits shield and bounces, consuming shield
      (engine as any).update(0.016);
      expect(ball1.vy).toBeLessThan(0);
      expect(testAPI.getHUDState().hasShield).toBe(false);
      expect(balls.length).toBe(2);

      // Step 2: ball2 continues falling without shield -> falls off bottom and is removed
      for (let i = 0; i < 15; i++) {
        (engine as any).update(0.016);
      }
      expect(balls.length).toBe(1); // ball2 was removed
      expect(balls[0]).toBe(ball1); // ball1 remains in play
    });

    it('does not reflect upward-moving balls passing y = 692', () => {
      const ball = { x: 400, y: 692, vx: 100, vy: -300, radius: 7 };
      const res = CollisionSystem.checkBoundaryCollision(ball, true);

      expect(res.hitBoundary).toBeUndefined();
      expect(ball.vy).toBe(-300); // Unaffected
    });
  });
});
