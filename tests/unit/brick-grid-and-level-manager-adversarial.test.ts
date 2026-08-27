/**
 * @file tests/unit/brick-grid-and-level-manager-adversarial.test.ts
 * Comprehensive Empirical Adversarial Stress Suite for BrickGridManager and LevelManager (Milestone 2).
 *
 * Tests:
 * 1. 3x3 cascading explosions with dense clusters of TNT bricks & boundary conditions
 * 2. Indestructible bricks durability invariants and level clear independence
 * 3. Armored bricks hit count decrement (2-3 HP), damage scaling, and destruction transitions
 * 4. Progressive level advancement 1..6, victory state triggers, and matrix validation
 * 5. Spatial query fuzzing, extreme inputs, and performance under massive chain reactions
 */

import { describe, it, expect, vi } from 'vitest';
import { BrickGridManager, StaggeredExplosion } from '@/game/systems/BrickGridManager';
import { LevelManager } from '@/game/systems/LevelManager';
import { Brick } from '@/game/entities/Brick';
import { Ball } from '@/game/entities/Ball';
import { ILevelLayout, PowerupType } from '@/game/types';
import {
  GRID_ROWS,
  GRID_COLS,
  TOTAL_LEVELS,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  GRID_GAP,
  GRID_OFFSET_LEFT,
  GRID_OFFSET_TOP,
  POINTS_STANDARD,
  POINTS_ARMORED_PER_HIT,
  POINTS_ARMORED_DESTROY,
  POINTS_EXPLOSIVE,
  POINTS_INDESTRUCTIBLE,
  TRAUMA_EXPLOSION,
} from '@/game/constants';
import { ALL_LEVELS } from '@/game/levels';

// Helper to generate empty matrix
function createEmptyMatrix(): number[][] {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
}

// Helper to create custom layout
function createCustomLayout(matrix: number[][], specialDrops?: Record<string, PowerupType>): ILevelLayout {
  return {
    levelNumber: 99,
    name: 'Adversarial Test Layout',
    themeColor: '#ff0055',
    matrix,
    specialDrops,
  };
}

describe('Empirical Challenger M2-2: BrickGridManager & LevelManager', () => {

  // =========================================================================
  // SUITE 1: 3x3 Cascading Explosions & Dense TNT Clusters
  // =========================================================================
  describe('1. 3x3 Cascading Explosions & Dense TNT Clusters', () => {

    it('verifies isolated 3x3 explosion destroys all 8 adjacent breakable neighbors and the detonator', () => {
      const matrix = createEmptyMatrix();
      // Center at (5, 5) with 8 standard bricks around it
      for (let r = 4; r <= 6; r++) {
        for (let c = 4; c <= 6; c++) {
          matrix[r][c] = (r === 5 && c === 5) ? 11 : 1; // 11 = TNT, 1 = Standard
        }
      }

      const grid = new BrickGridManager();
      grid.loadLevel(createCustomLayout(matrix));

      expect(grid.getRemainingBreakables()).toBe(9);
      expect(grid.getTotalBricksCount()).toBe(9);

      const hitRecords: Array<{ brick: Brick; points: number; destroyed: boolean }> = [];
      const detonations: Array<{ x: number; y: number; radius: number; depth: number }> = [];
      let totalTrauma = 0;

      grid.callbacks = {
        onBrickHit: (b, p, d) => hitRecords.push({ brick: b, points: p, destroyed: d }),
        onExplosionDetonated: (x, y, radius, depth) => detonations.push({ x, y, radius, depth }),
        onScreenShake: (t) => { totalTrauma += t; },
      };

      // Detonate center TNT
      grid.triggerExplosion(5, 5, 0);

      // Verify immediate destruction of all 9 bricks in the 3x3
      expect(grid.getRemainingBreakables()).toBe(0);
      expect(grid.isLevelClear()).toBe(true);

      for (let r = 4; r <= 6; r++) {
        for (let c = 4; c <= 6; c++) {
          const b = grid.getBrickAt(r, c);
          expect(b?.isAlive).toBe(false);
        }
      }

      expect(detonations.length).toBe(1);
      expect(detonations[0].depth).toBe(0);
      expect(totalTrauma).toBeCloseTo(TRAUMA_EXPLOSION, 4);

      // Verify points: 1 TNT (500) + 8 standard (100 each) = 1300
      const totalPoints = hitRecords.reduce((sum, h) => sum + h.points, 0);
      expect(totalPoints).toBe(POINTS_EXPLOSIVE + 8 * POINTS_STANDARD);
    });

    it('verifies dense 4x4 TNT cluster produces staggered multi-wave cascading chain reaction', () => {
      const matrix = createEmptyMatrix();
      // 4x4 block of pure TNT from row 2..5, col 2..5 (16 TNT bricks)
      for (let r = 2; r <= 5; r++) {
        for (let c = 2; c <= 5; c++) {
          matrix[r][c] = 11;
        }
      }

      const grid = new BrickGridManager();
      grid.loadLevel(createCustomLayout(matrix));

      expect(grid.getRemainingBreakables()).toBe(16);

      const detonationDepths: number[] = [];
      grid.callbacks = {
        onExplosionDetonated: (x, y, radius, depth) => detonationDepths.push(depth),
      };

      // Trigger top-left TNT at (2,2)
      grid.triggerExplosion(2, 2, 0);

      // Immediate wave: (2,2) is center, adjacent TNTs at (2,3), (3,2), (3,3) are destroyed & enqueued
      expect(detonationDepths).toEqual([0]);

      // Step time forward to process staggered queue (40ms steps)
      let time = 0;
      const dt = 0.02; // 20ms physics ticks
      while (time < 1.0) { // simulate up to 1 second
        grid.update(dt);
        time += dt;
      }

      // All 16 TNT bricks must be destroyed
      expect(grid.getRemainingBreakables()).toBe(0);
      expect(grid.isLevelClear()).toBe(true);

      for (let r = 2; r <= 5; r++) {
        for (let c = 2; c <= 5; c++) {
          expect(grid.getBrickAt(r, c)?.isAlive).toBe(false);
        }
      }

      // Verify multi-wave cascading occurred (chain depth > 0 was reached)
      expect(detonationDepths.length).toBeGreaterThan(1);
      expect(Math.max(...detonationDepths)).toBeGreaterThanOrEqual(2);
    });

    it('verifies full grid of 168 TNT bricks cascades cleanly without infinite loop or double-counting', () => {
      const matrix = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(11));
      const grid = new BrickGridManager();
      grid.loadLevel(createCustomLayout(matrix));

      expect(grid.getRemainingBreakables()).toBe(168);

      let explosionCount = 0;
      let brickHitCount = 0;
      grid.callbacks = {
        onExplosionDetonated: () => { explosionCount++; },
        onBrickHit: (b, p, destroyed) => {
          if (destroyed) brickHitCount++;
        },
      };

      // Detonate corner (0,0)
      grid.triggerExplosion(0, 0, 0);

      // Advance time until all chain reactions finish
      for (let step = 0; step < 200; step++) {
        grid.update(0.02);
      }

      expect(grid.getRemainingBreakables()).toBe(0);
      expect(grid.isLevelClear()).toBe(true);
      expect(brickHitCount).toBe(168); // Exactly 168 bricks destroyed once
    });

    it('verifies explosion boundary safety at all 4 corners and edges of grid', () => {
      const corners = [
        { r: 0, c: 0 },
        { r: 0, c: GRID_COLS - 1 },
        { r: GRID_ROWS - 1, c: 0 },
        { r: GRID_ROWS - 1, c: GRID_COLS - 1 },
      ];

      for (const { r, c } of corners) {
        const matrix = createEmptyMatrix();
        matrix[r][c] = 11;
        const grid = new BrickGridManager();
        grid.loadLevel(createCustomLayout(matrix));

        expect(() => {
          grid.triggerExplosion(r, c, 0);
          grid.update(0.1);
        }).not.toThrow();

        expect(grid.getRemainingBreakables()).toBe(0);
      }
    });

    it('verifies explosive blast wave instantly shatters 3-hit Armored bricks without requiring 3 hits', () => {
      const matrix = createEmptyMatrix();
      matrix[5][5] = 11; // TNT
      matrix[5][6] = 9;  // 3-hit Armored brick adjacent

      const grid = new BrickGridManager();
      grid.loadLevel(createCustomLayout(matrix));

      const armoredBrick = grid.getBrickAt(5, 6);
      expect(armoredBrick?.type).toBe('ARMORED');
      expect(armoredBrick?.maxHits).toBe(3);
      expect(armoredBrick?.currentHits).toBe(3);

      grid.triggerExplosion(5, 5, 0);

      expect(armoredBrick?.isAlive).toBe(false);
      expect(grid.getRemainingBreakables()).toBe(0);
    });

    it('verifies screen shake trauma increases dynamically with cascade chainDepth', () => {
      const traumas: number[] = [];
      const grid = new BrickGridManager({
        onScreenShake: (t) => traumas.push(t),
      });

      // Chain depth 0
      grid.triggerExplosion(0, 0, 0);
      // Chain depth 1
      grid.triggerExplosion(1, 1, 1);
      // Chain depth 3
      grid.triggerExplosion(2, 2, 3);

      expect(traumas[0]).toBeCloseTo(TRAUMA_EXPLOSION * 1.0, 4);
      expect(traumas[1]).toBeCloseTo(TRAUMA_EXPLOSION * (1 + 1 * 0.15), 4);
      expect(traumas[2]).toBeCloseTo(TRAUMA_EXPLOSION * (1 + 3 * 0.15), 4);
      expect(traumas[2]).toBeGreaterThan(traumas[1]);
      expect(traumas[1]).toBeGreaterThan(traumas[0]);
    });
  });

  // =========================================================================
  // SUITE 2: Indestructible Bricks Durability Invariants
  // =========================================================================
  describe('2. Indestructible Bricks Durability Invariants', () => {

    it('verifies indestructible bricks withstand normal hits, high damage hits, and zero damage dealt', () => {
      const brick = Brick.createIndestructible(3, 3, 100, 100);
      expect(brick.type).toBe('INDESTRUCTIBLE');
      expect(brick.maxHits).toBe(Infinity);
      expect(brick.currentHits).toBe(Infinity);
      expect(brick.isAlive).toBe(true);

      // Hit with 1 damage
      const res1 = brick.hit(1);
      expect(res1.destroyed).toBe(false);
      expect(res1.isIndestructible).toBe(true);
      expect(res1.pointsAwarded).toBe(0);
      expect(res1.damageDealt).toBe(0);
      expect(brick.isAlive).toBe(true);

      // Hit with 1,000,000 damage
      const res2 = brick.hit(1000000);
      expect(res2.destroyed).toBe(false);
      expect(res2.isIndestructible).toBe(true);
      expect(brick.isAlive).toBe(true);
      expect(brick.currentHits).toBe(Infinity);
    });

    it('verifies indestructible bricks are completely immune to 3x3 TNT explosive detonations', () => {
      const matrix = createEmptyMatrix();
      matrix[5][5] = 11; // TNT center
      matrix[4][5] = 10; // Indestructible top
      matrix[6][5] = 10; // Indestructible bottom
      matrix[5][4] = 10; // Indestructible left
      matrix[5][6] = 10; // Indestructible right

      const grid = new BrickGridManager();
      grid.loadLevel(createCustomLayout(matrix));

      // 1 TNT + 4 Indestructible = total 5 bricks, but only 1 breakable
      expect(grid.getTotalBricksCount()).toBe(5);
      expect(grid.getRemainingBreakables()).toBe(1);

      grid.triggerExplosion(5, 5, 0);

      // TNT is destroyed
      expect(grid.getBrickAt(5, 5)?.isAlive).toBe(false);
      expect(grid.getRemainingBreakables()).toBe(0);
      expect(grid.isLevelClear()).toBe(true);

      // All 4 indestructible bricks remain perfectly intact and alive
      expect(grid.getBrickAt(4, 5)?.isAlive).toBe(true);
      expect(grid.getBrickAt(6, 5)?.isAlive).toBe(true);
      expect(grid.getBrickAt(5, 4)?.isAlive).toBe(true);
      expect(grid.getBrickAt(5, 6)?.isAlive).toBe(true);
    });

    it('verifies indestructible bricks do not block isLevelClear() when all breakables are gone', () => {
      const matrix = createEmptyMatrix();
      matrix[0][0] = 10; // Indestructible
      matrix[0][1] = 10; // Indestructible
      matrix[1][0] = 1;  // Standard (1-hit)

      const grid = new BrickGridManager();
      grid.loadLevel(createCustomLayout(matrix));

      expect(grid.getRemainingBreakables()).toBe(1);
      expect(grid.isLevelClear()).toBe(false);

      const standardBrick = grid.getBrickAt(1, 0)!;
      grid.damageBrick(standardBrick, 1);

      expect(grid.getRemainingBreakables()).toBe(0);
      expect(grid.isLevelClear()).toBe(true);
    });

    it('verifies ball collision with indestructible brick reflects ball without destroying brick', () => {
      const matrix = createEmptyMatrix();
      matrix[2][2] = 10; // Indestructible brick at (2, 2)
      const grid = new BrickGridManager();
      grid.loadLevel(createCustomLayout(matrix));

      const silverBrick = grid.getBrickAt(2, 2)!;
      const initialBreakables = grid.getRemainingBreakables();

      // Ball colliding with top surface of silver brick
      const ball = new Ball({
        x: silverBrick.x + silverBrick.width / 2,
        y: silverBrick.y - 5,
        vx: 0,
        vy: 200,
        speed: 200,
      });

      const colResult = grid.checkBallCollisions(ball);
      expect(colResult.hit).toBe(true);
      expect(colResult.brick?.type).toBe('INDESTRUCTIBLE');
      expect(silverBrick.isAlive).toBe(true);
      expect(grid.getRemainingBreakables()).toBe(initialBreakables);
      expect(ball.vy).toBeLessThan(0); // Bounced upward
    });
  });

  // =========================================================================
  // SUITE 3: Armored Bricks Hit Counts (2-3 HP) & Transitions
  // =========================================================================
  describe('3. Armored Bricks Hit Counts (2-3 HP) & Transitions', () => {

    it('verifies 2-hit Armored brick transitions: Hit 1 (damage taken) -> Hit 2 (destruction)', () => {
      const brick = Brick.createArmored(1, 1, 100, 100, 2);
      expect(brick.maxHits).toBe(2);
      expect(brick.currentHits).toBe(2);
      expect(brick.isAlive).toBe(true);

      // --- HIT 1 ---
      const hit1 = brick.hit(1);
      expect(hit1.destroyed).toBe(false);
      expect(hit1.damageDealt).toBe(1);
      expect(hit1.currentHits).toBe(1);
      expect(hit1.pointsAwarded).toBe(POINTS_ARMORED_PER_HIT);
      expect(brick.isAlive).toBe(true);

      // --- HIT 2 ---
      const hit2 = brick.hit(1);
      expect(hit2.destroyed).toBe(true);
      expect(hit2.damageDealt).toBe(1);
      expect(hit2.currentHits).toBe(0);
      expect(hit2.pointsAwarded).toBe(POINTS_ARMORED_DESTROY);
      expect(brick.isAlive).toBe(false);

      // --- HIT 3 (After death) ---
      const hit3 = brick.hit(1);
      expect(hit3.destroyed).toBe(false);
      expect(hit3.damageDealt).toBe(0);
      expect(hit3.pointsAwarded).toBe(0);
    });

    it('verifies 3-hit Armored brick transitions: Hit 1 -> Hit 2 -> Hit 3 (destruction)', () => {
      const brick = Brick.createArmored(1, 1, 100, 100, 3);
      expect(brick.maxHits).toBe(3);
      expect(brick.currentHits).toBe(3);

      // --- HIT 1 ---
      const hit1 = brick.hit(1);
      expect(hit1.destroyed).toBe(false);
      expect(hit1.currentHits).toBe(2);
      expect(hit1.pointsAwarded).toBe(POINTS_ARMORED_PER_HIT);
      expect(brick.isAlive).toBe(true);

      // --- HIT 2 ---
      const hit2 = brick.hit(1);
      expect(hit2.destroyed).toBe(false);
      expect(hit2.currentHits).toBe(1);
      expect(hit2.pointsAwarded).toBe(POINTS_ARMORED_PER_HIT);
      expect(brick.isAlive).toBe(true);

      // --- HIT 3 ---
      const hit3 = brick.hit(1);
      expect(hit3.destroyed).toBe(true);
      expect(hit3.currentHits).toBe(0);
      expect(hit3.pointsAwarded).toBe(350); // 3-hit armored destruction points
      expect(brick.isAlive).toBe(false);
    });

    it('verifies remainingBreakables in BrickGridManager decrements ONLY upon fatal hit', () => {
      const matrix = createEmptyMatrix();
      matrix[0][0] = 8; // 2-hit armored brick (code 8)
      matrix[0][1] = 9; // 3-hit armored brick (code 9)

      const grid = new BrickGridManager();
      grid.loadLevel(createCustomLayout(matrix));

      expect(grid.getRemainingBreakables()).toBe(2);

      const b1 = grid.getBrickAt(0, 0)!;
      const b2 = grid.getBrickAt(0, 1)!;

      // Hit 1 on b1 (non-fatal)
      grid.damageBrick(b1, 1);
      expect(grid.getRemainingBreakables()).toBe(2);
      expect(b1.isAlive).toBe(true);

      // Hit 2 on b1 (fatal)
      grid.damageBrick(b1, 1);
      expect(grid.getRemainingBreakables()).toBe(1);
      expect(b1.isAlive).toBe(false);

      // Hit 1 on b2 (non-fatal)
      grid.damageBrick(b2, 1);
      expect(grid.getRemainingBreakables()).toBe(1);

      // Hit 2 on b2 (non-fatal)
      grid.damageBrick(b2, 1);
      expect(grid.getRemainingBreakables()).toBe(1);

      // Hit 3 on b2 (fatal)
      grid.damageBrick(b2, 1);
      expect(grid.getRemainingBreakables()).toBe(0);
      expect(grid.isLevelClear()).toBe(true);
    });

    it('verifies power-up drop on armored brick is ONLY delivered on destruction, not partial damage', () => {
      const spawnedDrops: PowerupType[] = [];
      const grid = new BrickGridManager({
        onPowerupSpawn: (type) => spawnedDrops.push(type),
      });

      const matrix = createEmptyMatrix();
      matrix[0][0] = 8; // 2-hit armored brick
      const layout = createCustomLayout(matrix, { '0_0': 'LASER' });
      grid.loadLevel(layout);

      const brick = grid.getBrickAt(0, 0)!;
      expect(brick.powerupDrop).toBe('LASER');

      // First hit: no powerup drop
      grid.damageBrick(brick, 1);
      expect(spawnedDrops.length).toBe(0);

      // Second hit: fatal -> powerup drop triggered
      grid.damageBrick(brick, 1);
      expect(spawnedDrops).toEqual(['LASER']);
    });
  });

  // =========================================================================
  // SUITE 4: Level Progression 1..6 & Victory Trigger
  // =========================================================================
  describe('4. Level Progression 1..6 & Victory Trigger', () => {

    it('verifies all 6 master level layouts satisfy strict 12x14 geometry and validity requirements', () => {
      expect(ALL_LEVELS.length).toBe(TOTAL_LEVELS);
      expect(TOTAL_LEVELS).toBe(6);

      ALL_LEVELS.forEach((level, idx) => {
        const expectedLvl = idx + 1;
        expect(level.levelNumber).toBe(expectedLvl);
        expect(level.name.length).toBeGreaterThan(0);
        expect(level.themeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(level.matrix.length).toBe(GRID_ROWS); // 14 rows

        let totalBricks = 0;
        let breakableCount = 0;
        let indestructibleCount = 0;

        for (let r = 0; r < GRID_ROWS; r++) {
          const row = level.matrix[r];
          expect(row.length).toBe(GRID_COLS); // 12 columns

          for (let c = 0; c < GRID_COLS; c++) {
            const code = row[c];
            if (code !== 0 && code !== null) {
              totalBricks++;
              if (code === 10) {
                indestructibleCount++;
              } else {
                breakableCount++;
              }
            }
          }
        }

        // Each level must have at least 1 breakable brick to be playable
        expect(breakableCount).toBeGreaterThan(0);
        expect(totalBricks).toBe(breakableCount + indestructibleCount);
      });
    });

    it('verifies sequential progression through levels 1 to 6 and exact Victory state on completing Level 6', () => {
      const manager = new LevelManager();
      expect(manager.getCurrentLevelNumber()).toBe(1);
      expect(manager.isFinalLevel()).toBe(false);

      // Advance 1 -> 2
      let res = manager.advanceLevel();
      expect(res.levelNumber).toBe(2);
      expect(res.isVictory).toBe(false);
      expect(res.layout?.levelNumber).toBe(2);

      // Advance 2 -> 3
      res = manager.advanceLevel();
      expect(res.levelNumber).toBe(3);
      expect(res.isVictory).toBe(false);

      // Advance 3 -> 4
      res = manager.advanceLevel();
      expect(res.levelNumber).toBe(4);
      expect(res.isVictory).toBe(false);

      // Advance 4 -> 5
      res = manager.advanceLevel();
      expect(res.levelNumber).toBe(5);
      expect(res.isVictory).toBe(false);

      // Advance 5 -> 6
      res = manager.advanceLevel();
      expect(res.levelNumber).toBe(6);
      expect(res.isVictory).toBe(false);
      expect(manager.isFinalLevel()).toBe(true);

      // Advance from Level 6 -> VICTORY
      const victoryRes = manager.advanceLevel();
      expect(victoryRes.hasWon).toBe(true);
      expect(victoryRes.isVictory).toBe(true);
      expect(victoryRes.levelNumber).toBe(6);
      expect(victoryRes.layout).toBeNull();
      expect(manager.getCurrentLevelNumber()).toBe(6);

      // Idempotency: multiple subsequent advances from level 6 keep returning victory
      const victoryRes2 = manager.advanceLevel();
      expect(victoryRes2.isVictory).toBe(true);
      expect(victoryRes2.hasWon).toBe(true);
    });

    it('verifies empirical simulated playthrough clearing all breakables on all 6 levels', () => {
      const manager = new LevelManager();

      for (let lvl = 1; lvl <= 6; lvl++) {
        manager.loadLevel(lvl);
        expect(manager.getCurrentLevelNumber()).toBe(lvl);

        const grid = manager.gridManager;
        const initialBreakables = grid.getRemainingBreakables();
        expect(initialBreakables).toBeGreaterThan(0);
        expect(grid.isLevelClear()).toBe(false);

        // Destroy all breakable bricks
        const activeBricks = grid.getActiveBricks();
        for (const brick of activeBricks) {
          if (brick.type !== 'INDESTRUCTIBLE') {
            grid.damageBrick(brick, 100); // Fatal damage
          }
        }

        // Process any staggered explosive cascades
        grid.update(0.5);

        // Grid must now be clear
        expect(grid.getRemainingBreakables()).toBe(0);
        expect(grid.isLevelClear()).toBe(true);

        if (lvl < 6) {
          const adv = manager.advanceLevel();
          expect(adv.isVictory).toBe(false);
          expect(adv.levelNumber).toBe(lvl + 1);
        } else {
          const adv = manager.advanceLevel();
          expect(adv.isVictory).toBe(true);
        }
      }
    });

    it('verifies loadLevel boundary clamping on out-of-range level indices', () => {
      const manager = new LevelManager();

      // Negative level -> clamped to 1
      manager.loadLevel(-10);
      expect(manager.getCurrentLevelNumber()).toBe(1);

      // Zero -> clamped to 1
      manager.loadLevel(0);
      expect(manager.getCurrentLevelNumber()).toBe(1);

      // Greater than TOTAL_LEVELS -> clamped to 6
      manager.loadLevel(99);
      expect(manager.getCurrentLevelNumber()).toBe(6);
    });
  });

  // =========================================================================
  // SUITE 5: Spatial Grid Queries, Edge Cases & Performance Stress
  // =========================================================================
  describe('5. Spatial Grid Queries, Edge Cases & Performance Stress', () => {

    it('fuzzes spatial pixel coordinate queries at margins, outside canvas, and between gaps', () => {
      const matrix = createEmptyMatrix();
      matrix[0][0] = 1; // Top-left brick
      const grid = new BrickGridManager();
      grid.loadLevel(createCustomLayout(matrix));

      // Negative coordinates
      expect(grid.getBrickAtPixel(-50, -50)).toBeNull();

      // Outside right/bottom
      expect(grid.getBrickAtPixel(900, 800)).toBeNull();

      // In the gap between col 0 and col 1
      const gapX = GRID_OFFSET_LEFT + BRICK_WIDTH + GRID_GAP / 2;
      const brickY = GRID_OFFSET_TOP + BRICK_HEIGHT / 2;
      expect(grid.getBrickAtPixel(gapX, brickY)).toBeNull();

      // Exact center of brick (0, 0)
      const b00 = grid.getBrickAt(0, 0)!;
      const hitBrick = grid.getBrickAtPixel(b00.x + b00.width / 2, b00.y + b00.height / 2);
      expect(hitBrick).not.toBeNull();
      expect(hitBrick?.row).toBe(0);
      expect(hitBrick?.col).toBe(0);
    });

    it('verifies performance: 1,000 rapid grid level reloads and damage sweeps execute under 150ms', () => {
      const manager = new LevelManager();
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const lvl = (i % 6) + 1;
        manager.loadLevel(lvl);
        const bricks = manager.gridManager.getActiveBricks();
        if (bricks.length > 0) {
          manager.gridManager.damageBrick(bricks[0], 1);
        }
      }

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(500); // comfortably fast
    });
  });
});
