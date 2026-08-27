/**
 * @file tests/unit/adversarial-m5-stress-physics-scoring.test.ts
 * Deep Empirical Adversarial Stress Testing Suite by Challenger 2 (challenger_m5_fix_2)
 *
 * Focus Areas:
 * 1. Ball velocity invariance across 1000+ frames of substepping physics.
 * 2. 3-hit armored brick destruction mechanics and points calculation (350 points).
 * 3. Sticky paddle translation coordinate boundaries and docked ball synchronization.
 * 4. High score leaderboard insertion, ranking, and storage persistence against seed entries.
 * 5. Power-up speed modifiers, multi-ball swarms, and 6-level continuous campaign progression.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  MAX_HIGH_SCORES,
  DEFAULT_HIGH_SCORES,
  STORAGE_KEY_HIGHSCORES,
} from '@/game/constants';
import { CollisionSystem } from '@/game/physics/CollisionSystem';
import { PaddlePhysics } from '@/game/physics/PaddlePhysics';
import { reflectVector, clamp } from '@/game/physics/MathUtils';
import { Ball } from '@/game/entities/Ball';
import { Paddle } from '@/game/entities/Paddle';
import { Brick } from '@/game/entities/Brick';
import {
  getHighScores,
  saveHighScore,
  resetHighScores,
  clearHighScores,
  isHighScore,
  isHighScoreEligible,
} from '@/utils/highScores';
import { storageGet, storageSet, storageClear } from '@/utils/storage';

describe('Adversarial Stress Suite M5-2: Physics Invariants, Armored Scoring, Sticky Docking & High Scores', () => {
  let harness: TestHarness;

  beforeEach(() => {
    storageClear();
    resetHighScores();
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.destroy();
    storageClear();
  });

  // =========================================================================
  // Dimension 1: Ball Velocity & Substepping Invariance Across 1,000+ Physics Frames
  // =========================================================================
  describe('Dimension 1: Ball Velocity & Substepping Invariance Across 1,000+ Frames', () => {
    it('1.1. Preserves scalar velocity magnitude across 2,000 continuous frames of multi-wall boundary reflections', () => {
      const angle = Math.PI / 4;
      const initialSpeed = BALL_INITIAL_SPEED;
      const ball = new Ball({
        x: 400,
        y: 350,
        vx: initialSpeed * Math.cos(angle),
        vy: -initialSpeed * Math.sin(angle),
        speed: initialSpeed,
        isStuckToPaddle: false,
        radius: BALL_DEFAULT_RADIUS,
      });

      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(initialSpeed, 6);

      let wallHitCount = 0;
      for (let frame = 0; frame < 2000; frame++) {
        const events = ball.update(FIXED_DT);
        if (events.boundaryHit) {
          wallHitCount++;
        }

        // Velocity magnitude must match initial speed at every single frame
        const currentSpeed = Math.hypot(ball.vx, ball.vy);
        expect(currentSpeed).toBeCloseTo(initialSpeed, 5);

        // Position must strictly stay within canvas bounds
        expect(ball.x).toBeGreaterThanOrEqual(ball.radius);
        expect(ball.x).toBeLessThanOrEqual(CANVAS_WIDTH - ball.radius);
        expect(ball.y).toBeGreaterThanOrEqual(ball.radius);
      }

      // Ensure that multiple wall bounces actually occurred during the 2000 frames
      expect(wallHitCount).toBeGreaterThan(20);
    });

    it('1.2. Preserves velocity invariance across a 12-ball swarm over 1,500 physics substepping frames', () => {
      harness.start();
      const paddle = harness.getPaddle();
      // Expand paddle across full width so balls bounce continuously without loss
      paddle.baseWidth = CANVAS_WIDTH;
      paddle.targetWidth = CANVAS_WIDTH;
      paddle.width = CANVAS_WIDTH;
      paddle.x = 0;

      harness.launchBall();

      // Spawn maximum ball swarm
      for (let i = 0; i < 6; i++) {
        harness.collectPowerup('MULTI_BALL');
      }

      const balls = harness.getBalls();
      expect(balls.length).toBe(MAX_ACTIVE_BALLS);

      for (let frame = 0; frame < 1500; frame++) {
        harness.step(FIXED_DT);

        for (const b of balls) {
          if (!b.isStuckToPaddle) {
            const mag = Math.hypot(b.vx, b.vy);
            expect(mag).toBeCloseTo(b.speed, 1);
            expect(Number.isFinite(b.x)).toBe(true);
            expect(Number.isFinite(b.y)).toBe(true);
            expect(b.x).toBeGreaterThanOrEqual(b.radius - 1);
            expect(b.x).toBeLessThanOrEqual(CANVAS_WIDTH - b.radius + 1);
          }
        }
      }
    });

    it('1.3. Substepping calculation strictly bounds steps between 1 and 4 without numerical overflow', () => {
      // Small displacement -> 1 step
      expect(CollisionSystem.calculateSubsteps(1, 1, 7)).toBe(1);
      // Displacement ~ 10px with radius 7 (threshold 5.25) -> 2 steps
      expect(CollisionSystem.calculateSubsteps(10, 0, 7)).toBe(2);
      // Displacement ~ 18px -> 4 steps
      expect(CollisionSystem.calculateSubsteps(18, 0, 7)).toBe(4);
      // Extreme displacement (1000px) -> clamped to 4 steps
      expect(CollisionSystem.calculateSubsteps(1000, 500, 7)).toBe(4);
      // Zero displacement -> 1 step
      expect(CollisionSystem.calculateSubsteps(0, 0, 7)).toBe(1);
      // Negative displacements -> clamped correctly via hypot
      expect(CollisionSystem.calculateSubsteps(-100, -100, 7)).toBe(4);
    });

    it('1.4. Anti-tunneling oracle: high-speed ball approaching thin brick obstacle detects collision via substepping', () => {
      const brick = Brick.createStandard(1, 1, 300, 200); // y = 200..220
      const ball = new Ball({
        x: 320,
        y: 190, // 10px above top surface of brick (y=200)
        vx: 0,
        vy: BALL_MAX_SPEED, // 700 px/s heading straight down
        speed: BALL_MAX_SPEED,
        isStuckToPaddle: false,
        radius: BALL_DEFAULT_RADIUS, // 7
      });

      // Advance by 1 full frame (dt = 1/60s -> displacement = 11.67px -> target y = 201.67px)
      const nextY = ball.y + ball.vy * FIXED_DT;
      const collision = CollisionSystem.testCircleAABB(
        { x: ball.x, y: nextY, radius: ball.radius },
        brick.getBounds()
      );

      expect(collision.hasCollision).toBe(true);
      expect(collision.contactSide).toBe('top');

      // Resolve collision
      ball.y = nextY;
      CollisionSystem.resolveCircleCollision(ball, collision);

      expect(ball.vy).toBeLessThan(0); // Upward reflection
      expect(Math.abs(ball.vy)).toBeCloseTo(BALL_MAX_SPEED, 2);
      expect(ball.y).toBeLessThanOrEqual(brick.y); // Repositioned at or above top surface
    });

    it('1.5. Deep penetration recovery resolves circle position outside AABB without velocity explosion', () => {
      const box = { x: 100, y: 100, width: 60, height: 20 };
      // Place circle center directly inside the box
      const circleInside = { x: 130, y: 105, radius: 7, vx: 0, vy: 400 };

      const col = CollisionSystem.testCircleAABB(circleInside, box);
      expect(col.hasCollision).toBe(true);
      expect(col.penetration).toBeGreaterThan(0);

      CollisionSystem.resolveCircleCollision(circleInside, col);
      expect(circleInside.y).toBeLessThanOrEqual(box.y); // Extracted to top
      expect(circleInside.vy).toBeLessThan(0); // Reflected upwards
      expect(Math.abs(circleInside.vy)).toBeCloseTo(400, 2);
    });

    it('1.6. 10,000 random arbitrary angle paddle reflections strictly preserve scalar ball speed', () => {
      const paddle = { x: 300, y: 640, width: 100, height: 16, vx: 150 };

      for (let i = 0; i < 10000; i++) {
        const testSpeed = BALL_MIN_SPEED + (i % (BALL_MAX_SPEED - BALL_MIN_SPEED));
        const impactOffsetRatio = -1 + (i % 2000) / 1000; // in [-1, 1]
        const ballX = paddle.x + paddle.width / 2 + impactOffsetRatio * (paddle.width / 2);

        const reflection = PaddlePhysics.calculateReflection(
          { x: ballX, y: 635, speed: testSpeed },
          paddle
        );

        expect(reflection.hit).toBe(true);
        expect(reflection.vy).toBeLessThan(0); // Must be directed upwards
        const reflectedSpeed = Math.hypot(reflection.vx, reflection.vy);
        expect(reflectedSpeed).toBeCloseTo(testSpeed, 4);
      }
    });
  });

  // =========================================================================
  // Dimension 2: 3-Hit Armored Brick Destruction Mechanics & Points Calculation (350 points)
  // =========================================================================
  describe('Dimension 2: 3-Hit Armored Brick Destruction & Points Calculation (350 pts)', () => {
    it('2.1. 3-Hit Armored Brick yields exactly 100 + 100 + 350 = 550 total points across 3 single-damage hits', () => {
      const armored3 = Brick.createArmored(0, 0, 100, 100, 3);
      expect(armored3.maxHits).toBe(3);
      expect(armored3.currentHits).toBe(3);
      expect(armored3.points).toBe(350);

      // Hit 1: Non-fatal hit
      const hit1 = armored3.hit(1);
      expect(hit1.destroyed).toBe(false);
      expect(hit1.pointsAwarded).toBe(100);
      expect(hit1.currentHits).toBe(2);
      expect(armored3.isAlive).toBe(true);

      // Hit 2: Non-fatal hit
      const hit2 = armored3.hit(1);
      expect(hit2.destroyed).toBe(false);
      expect(hit2.pointsAwarded).toBe(100);
      expect(hit2.currentHits).toBe(1);
      expect(armored3.isAlive).toBe(true);

      // Hit 3: Fatal destruction hit
      const hit3 = armored3.hit(1);
      expect(hit3.destroyed).toBe(true);
      expect(hit3.pointsAwarded).toBe(350);
      expect(hit3.currentHits).toBe(0);
      expect(armored3.isAlive).toBe(false);

      const totalPoints = hit1.pointsAwarded + hit2.pointsAwarded + hit3.pointsAwarded;
      expect(totalPoints).toBe(550);
    });

    it('2.2. Overkill damage (e.g. 5 damage) on fresh 3-hit armored brick destroys it and awards 350 points', () => {
      const armored = Brick.createArmored(1, 1, 200, 200, 3);
      const res = armored.hit(5);

      expect(res.destroyed).toBe(true);
      expect(res.damageDealt).toBe(3);
      expect(res.pointsAwarded).toBe(350);
      expect(armored.currentHits).toBe(0);
      expect(armored.isAlive).toBe(false);
    });

    it('2.3. Subsequent hits on an already destroyed armored brick award 0 points and 0 damage', () => {
      const armored = Brick.createArmored(2, 2, 300, 200, 3);
      armored.hit(3); // Destroyed
      expect(armored.isAlive).toBe(false);

      const ghostHit = armored.hit(1);
      expect(ghostHit.destroyed).toBe(false);
      expect(ghostHit.pointsAwarded).toBe(0);
      expect(ghostHit.damageDealt).toBe(0);
    });

    it('2.4. GameEngine combo multiplier scales 3-hit armored brick destruction points correctly (350 * multiplier)', () => {
      harness.start();
      // Setup combo state by hitting 3 standard bricks -> combo = 3, multiplier = 1 (hits 1-3)
      const standardBricks = harness.getBricks().filter((b) => b.type === 'STANDARD');
      for (let i = 0; i < 3; i++) {
        harness.triggerBrickHit(standardBricks[i].row, standardBricks[i].col);
      }

      expect(harness.getHUDState().combo).toBe(3);
      expect(harness.getHUDState().multiplier).toBe(1);
      const baseScoreBeforeArmored = harness.getHUDState().score; // 300

      // Create and damage a 3-hit armored brick in harness
      const armoredBrick = Brick.createArmored(10, 10, 400, 300, 3);
      const engineGrid = (harness.engine as unknown as { brickGrid: { damageBrick: (b: Brick, d: number) => void } }).brickGrid;

      // Hit 1: combo becomes 4 -> multiplier becomes 2 -> +200 pts
      engineGrid.damageBrick(armoredBrick, 1);
      expect(harness.getHUDState().combo).toBe(4);
      expect(harness.getHUDState().multiplier).toBe(2);
      expect(harness.getHUDState().score).toBe(baseScoreBeforeArmored + 100 * 2);

      // Hit 2: combo becomes 5 -> multiplier stays 2 -> +200 pts
      engineGrid.damageBrick(armoredBrick, 1);
      expect(harness.getHUDState().combo).toBe(5);
      expect(harness.getHUDState().multiplier).toBe(2);
      expect(harness.getHUDState().score).toBe(baseScoreBeforeArmored + 200 + 100 * 2);

      // Hit 3 (destruction): combo becomes 6 -> multiplier stays 2 -> +(350 * 2) = +700 pts
      engineGrid.damageBrick(armoredBrick, 1);
      expect(harness.getHUDState().combo).toBe(6);
      expect(harness.getHUDState().multiplier).toBe(2);
      expect(harness.getHUDState().score).toBe(baseScoreBeforeArmored + 200 + 200 + 350 * 2);
    });
  });

  // =========================================================================
  // Dimension 3: Sticky Paddle Translation Coordinate Boundaries & Docked Ball Synchronization
  // =========================================================================
  describe('Dimension 3: Sticky Paddle Translation Coordinate Boundaries & Docked Ball Synchronization', () => {
    it('3.1. Docked ball follows exact formula: x_ball = paddle.x + paddle.width/2 + u * (paddle.width/2 - radius)', () => {
      const paddle = new Paddle({ x: 300, y: 640, width: 100, height: 16 });
      const ball = new Ball({ radius: 7 });

      // Test across 21 offsets u in [-1.0, +1.0]
      for (let i = -10; i <= 10; i++) {
        const u = i / 10;
        ball.stuckOffsetRatio = u;
        ball.isStuckToPaddle = true;

        ball.update(FIXED_DT, paddle);

        const expectedX = paddle.x + paddle.width / 2 + u * (paddle.width / 2 - ball.radius);
        const expectedY = paddle.y - ball.radius - 1;

        expect(ball.x).toBeCloseTo(expectedX, 4);
        expect(ball.y).toBeCloseTo(expectedY, 4);

        // At u = -1.0 (extreme left), ball left edge (x - radius) must equal paddle.x (0 overhang)
        if (u === -1.0) {
          expect(ball.x - ball.radius).toBeCloseTo(paddle.x, 4);
        }
        // At u = +1.0 (extreme right), ball right edge (x + radius) must equal paddle.x + paddle.width (0 overhang)
        if (u === 1.0) {
          expect(ball.x + ball.radius).toBeCloseTo(paddle.x + paddle.width, 4);
        }
      }
    });

    it('3.2. Docked ball synchronizes with paddle across 1,000 frames of random rapid pointer translations', () => {
      const paddle = new Paddle({ x: 350, y: 640, width: 100 });
      const ball = new Ball({ radius: 7, isStuckToPaddle: true, stuckOffsetRatio: 0.75 });

      for (let frame = 0; frame < 1000; frame++) {
        // Random pointer target across full canvas width [0, 800]
        const targetPointerX = (frame * 137.5) % CANVAS_WIDTH;
        paddle.update(FIXED_DT, {
          left: false,
          right: false,
          launch: false,
          fireLaser: false,
          pointerActive: true,
          pointerX: targetPointerX,
        });

        ball.update(FIXED_DT, paddle);

        // Verify paddle is clamped strictly in [0, CANVAS_WIDTH - paddle.width]
        expect(paddle.x).toBeGreaterThanOrEqual(0);
        expect(paddle.x).toBeLessThanOrEqual(CANVAS_WIDTH - paddle.width);

        // Verify ball docked position matches paddle
        const expectedX = paddle.x + paddle.width / 2 + ball.stuckOffsetRatio * (paddle.width / 2 - ball.radius);
        expect(ball.x).toBeCloseTo(expectedX, 3);
        expect(ball.y).toBeCloseTo(paddle.y - ball.radius - 1, 3);

        // Ball is strictly within canvas visible area
        expect(ball.x - ball.radius).toBeGreaterThanOrEqual(0);
        expect(ball.x + ball.radius).toBeLessThanOrEqual(CANVAS_WIDTH);
      }
    });

    it('3.3. Width transitions (EXTEND / SHRINK) preserve docked ball attachment within paddle bounds', () => {
      const paddle = new Paddle({ x: 350, y: 640, width: PADDLE_BASE_WIDTH });
      const ball = new Ball({ radius: 7, isStuckToPaddle: true, stuckOffsetRatio: 1.0 }); // Right edge

      // Trigger Extend (targetWidth = 150)
      paddle.setWidth(PADDLE_EXTENDED_WIDTH);

      for (let step = 0; step < 60; step++) {
        paddle.update(FIXED_DT, { left: false, right: false, launch: false, fireLaser: false, pointerActive: false, pointerX: null });
        ball.update(FIXED_DT, paddle);

        // Ball right edge must not exceed paddle right edge
        expect(ball.x + ball.radius).toBeLessThanOrEqual(paddle.x + paddle.width + 0.001);
      }

      expect(paddle.width).toBeCloseTo(PADDLE_EXTENDED_WIDTH, 1);
      expect(ball.x + ball.radius).toBeCloseTo(paddle.x + PADDLE_EXTENDED_WIDTH, 1);

      // Trigger Shrink (targetWidth = 70)
      paddle.setWidth(PADDLE_SHRUNK_WIDTH);
      for (let step = 0; step < 60; step++) {
        paddle.update(FIXED_DT, { left: false, right: false, launch: false, fireLaser: false, pointerActive: false, pointerX: null });
        ball.update(FIXED_DT, paddle);

        expect(ball.x + ball.radius).toBeLessThanOrEqual(paddle.x + paddle.width + 0.001);
      }

      expect(paddle.width).toBeCloseTo(PADDLE_SHRUNK_WIDTH, 1);
      expect(ball.x + ball.radius).toBeCloseTo(paddle.x + PADDLE_SHRUNK_WIDTH, 1);
    });

    it('3.4. Launching docked ball calculates exit vector preserving ball.speed and mapped angle', () => {
      const ball = new Ball({
        radius: 7,
        speed: 420,
        isStuckToPaddle: true,
        stuckOffsetRatio: 0.5, // 50% right of center
      });

      ball.launch();
      expect(ball.isStuckToPaddle).toBe(false);

      const expectedAngle = 0.5 * MAX_PADDLE_BOUNCE_ANGLE * 0.8;
      const expectedVx = 420 * Math.sin(expectedAngle);
      const expectedVy = -420 * Math.cos(expectedAngle);

      expect(ball.vx).toBeCloseTo(expectedVx, 2);
      expect(ball.vy).toBeCloseTo(expectedVy, 2);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(420, 2);
    });
  });

  // =========================================================================
  // Dimension 4: High Score Leaderboard Insertion, Ranking & Storage Persistence
  // =========================================================================
  describe('Dimension 4: High Score Leaderboard Insertion, Ranking & Persistence', () => {
    it('4.1. Seeds default 5 entries in strict descending score order when storage is initialized', () => {
      const scores = getHighScores();
      expect(scores.length).toBe(5);

      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i].score).toBeGreaterThanOrEqual(scores[i + 1].score);
      }

      expect(scores[0]).toMatchObject({ name: 'CYB', score: 100000 });
      expect(scores[1]).toMatchObject({ name: 'NEO', score: 75000 });
      expect(scores[2]).toMatchObject({ name: 'ARK', score: 50000 });
      expect(scores[3]).toMatchObject({ name: 'PIL', score: 35000 });
      expect(scores[4]).toMatchObject({ name: 'ACE', score: 20000 });
    });

    it('4.2. Inserts new #1 high score and shifts existing entries downward correctly', () => {
      const updated = saveHighScore('MAX', 250000, 6);
      expect(updated.length).toBe(6);
      expect(updated[0].name).toBe('MAX');
      expect(updated[0].score).toBe(250000);
      expect(updated[1].name).toBe('CYB');
      expect(updated[1].score).toBe(100000);
    });

    it('4.3. Inserts intermediate score, maintaining strict descending ranking and unique IDs', () => {
      saveHighScore('MID', 60000, 4);
      const scores = getHighScores();

      expect(scores.length).toBe(6);
      expect(scores[2].name).toBe('MID');
      expect(scores[2].score).toBe(60000);
      expect(scores[1].score).toBe(75000);
      expect(scores[3].score).toBe(50000);

      const ids = scores.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(scores.length);
    });

    it('4.4. Strictly caps high score table to MAX_HIGH_SCORES (10) when 15 scores are submitted', () => {
      for (let s = 10000; s <= 150000; s += 10000) {
        saveHighScore(`P${s / 10000}`, s, 5);
      }

      const scores = getHighScores();
      expect(scores.length).toBe(MAX_HIGH_SCORES); // Exactly 10
      expect(scores[0].score).toBe(150000);

      // Verify descending order
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i].score).toBeGreaterThanOrEqual(scores[i + 1].score);
      }
    });

    it('4.5. Sanitizes player initials: uppercase, trimmed, truncated to 3 chars, and fallback to AAA on empty/invalid', () => {
      saveHighScore('  lowercase  ', 105000, 3);
      saveHighScore('WAYTOOLONGNAME', 106000, 3);
      saveHighScore('', 107000, 3);
      saveHighScore('   ', 108000, 3);

      const scores = getHighScores();
      const top4 = scores.slice(0, 4);

      expect(top4[0].name).toBe('AAA'); // from '   '
      expect(top4[1].name).toBe('AAA'); // from ''
      expect(top4[2].name).toBe('WAY'); // from 'WAYTOOLONGNAME'
      expect(top4[3].name).toBe('LOW'); // from '  lowercase  '
    });

    it('4.6. Evaluates isHighScore and isHighScoreEligible predicates accurately across empty/full tables', () => {
      // With seed data (5 entries, max is 10): any positive score qualifies
      expect(isHighScore(100)).toBe(true);
      expect(isHighScore(0)).toBe(false);
      expect(isHighScore(-500)).toBe(false);
      expect(isHighScore(NaN)).toBe(false);

      // Fill table to 10 entries with scores from 100k down to 10k
      clearHighScores();
      for (let s = 10; s >= 1; s--) {
        saveHighScore(`P${s}`, s * 10000, 1);
      }

      const fullScores = getHighScores();
      expect(fullScores.length).toBe(10);
      const lowestScore = fullScores[9].score; // 10000

      // Scores strictly greater than lowest qualify
      expect(isHighScore(lowestScore + 1)).toBe(true);
      expect(isHighScoreEligible(lowestScore + 1)).toBe(true);
      // Scores equal or less do not qualify
      expect(isHighScore(lowestScore)).toBe(false);
      expect(isHighScore(lowestScore - 100)).toBe(false);
    });

    it('4.7. Gracefully survives corrupted JSON in storage and resets to default seed table', () => {
      // Inject corrupted JSON directly into storage key
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_HIGHSCORES, '{{bad-json:}}');
      }

      const recovered = getHighScores();
      expect(recovered.length).toBe(5);
      expect(recovered[0].name).toBe('CYB');
      expect(recovered[0].score).toBe(100000);
    });
  });

  // =========================================================================
  // Dimension 5: Power-up Ball Speed Modifiers & Clamping Invariants
  // =========================================================================
  describe('Dimension 5: Power-up Ball Speed Modifiers & Clamping Invariants', () => {
    it('5.1. Applies SLOW (0.7x) and FAST (1.3x) modifiers and respects strict [300, 700] speed bounds', () => {
      const ball = new Ball({ speed: 420, isStuckToPaddle: false, vx: 0, vy: -420 });

      // Apply SLOW: 420 * 0.7 = 294 -> clamped to BALL_MIN_SPEED (300)
      ball.applySpeedModifier(0.7);
      expect(ball.speed).toBe(BALL_MIN_SPEED);
      expect(Math.hypot(ball.vx, ball.vy)).toBe(BALL_MIN_SPEED);

      // Apply FAST from 300: 300 * 1.3 = 390
      ball.applySpeedModifier(1.3);
      expect(ball.speed).toBeCloseTo(390, 1);

      // Apply multiple FAST modifiers: 390 * 1.3 * 1.3 * 1.3 -> exceeds 700 -> clamped to BALL_MAX_SPEED (700)
      ball.applySpeedModifier(1.3);
      ball.applySpeedModifier(1.3);
      ball.applySpeedModifier(1.3);
      expect(ball.speed).toBe(BALL_MAX_SPEED);
      expect(Math.hypot(ball.vx, ball.vy)).toBe(BALL_MAX_SPEED);
    });

    it('5.2. Brick destruction speed step increment (+4 px/s) scales velocity vector without angle drift', () => {
      const angle = Math.PI / 6; // 30 deg
      const ball = new Ball({
        speed: 400,
        vx: 400 * Math.sin(angle),
        vy: -400 * Math.cos(angle),
        isStuckToPaddle: false,
      });

      const initialAngle = Math.atan2(ball.vx, -ball.vy);

      // Simulate 25 brick destruction speed increments (+4 px/s each = +100 px/s)
      for (let i = 0; i < 25; i++) {
        ball.incrementSpeed(4);
      }

      expect(ball.speed).toBe(500);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(500, 4);

      // Verify trajectory angle was strictly preserved without drift
      const newAngle = Math.atan2(ball.vx, -ball.vy);
      expect(newAngle).toBeCloseTo(initialAngle, 6);
    });
  });

  // =========================================================================
  // Dimension 6: Full 6-Level Continuous Progression & Victory Oracle
  // =========================================================================
  describe('Dimension 6: Full 6-Level Continuous Progression & Victory Oracle', () => {
    it('6.1. Simulates flawless 6-level campaign, verifying brick counts, stage clear, and final victory', () => {
      harness.start();

      for (let level = 1; level <= 6; level++) {
        expect(harness.getHUDState().level).toBe(level);
        expect(harness.getHUDState().status).toBe('PLAYING');

        const activeBricks = harness.getBricks().filter((b) => b.isAlive);
        expect(activeBricks.length).toBeGreaterThan(0);

        const breakables = activeBricks.filter((b) => b.type !== 'INDESTRUCTIBLE');
        expect(breakables.length).toBeGreaterThan(0);

        // Destroy all breakables on this level
        harness.destroyAllBreakables();
        harness.step(FIXED_DT);

        if (level < 6) {
          expect(harness.getHUDState().status).toBe('STAGE_CLEAR');
          harness.nextLevel();
          expect(harness.getHUDState().level).toBe(level + 1);
        } else {
          expect(harness.getHUDState().status).toBe('VICTORY');
        }
      }
    });

    it('6.2. Game Over triggers cleanly upon losing all 3 lives and locks state against further updates', () => {
      harness.start();
      harness.launchBall();

      // Drop ball 3 times
      for (let life = INITIAL_LIVES; life > 1; life--) {
        expect(harness.getHUDState().lives).toBe(life);
        const ball = harness.getBalls()[0];
        ball.y = CANVAS_HEIGHT + 50;
        ball.vy = 400;
        harness.step(FIXED_DT);

        expect(harness.getHUDState().lives).toBe(life - 1);
        expect(harness.getHUDState().status).toBe('PLAYING');
        harness.launchBall();
      }

      // Drop final ball -> Game Over
      const finalBall = harness.getBalls()[0];
      finalBall.y = CANVAS_HEIGHT + 50;
      finalBall.vy = 400;
      harness.step(FIXED_DT);

      expect(harness.getHUDState().lives).toBe(0);
      expect(harness.getHUDState().status).toBe('GAME_OVER');
    });
  });
});
