/**
 * @file tests/unit/brick-grid.test.ts
 * Vitest unit test suite for 12x14 spatial brick grid,
 * multi-tier durability, explosive TNT cascades, and breakable counts.
 */

import { describe, it, expect } from 'vitest';
import { BrickGridManager } from '@/game/systems/BrickGridManager';
import { ILevelLayout } from '@/game/types';
import { GRID_ROWS, GRID_COLS } from '@/game/constants';

describe('BrickGridManager & Multi-Tier Brick System', () => {
  const createMockLevel = (): ILevelLayout => {
    const matrix: Array<Array<number | null>> = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(0)
    );
    // Row 0: 12 standard bricks (1-hit) (code 1)
    matrix[0] = Array(12).fill(1);
    // Row 1: 12 armored bricks (2-hit) (code 8)
    matrix[1] = Array(12).fill(8);
    // Row 2: 2 indestructible bricks (code 10), 1 standard brick at (2,5)
    matrix[2][0] = 10;
    matrix[2][1] = 10;
    matrix[2][5] = 1;
    // Row 3: 1 explosive TNT brick (code 11)
    matrix[3][5] = 11;

    return {
      levelNumber: 1,
      name: 'Test Matrix',
      themeColor: '#06b6d4',
      matrix,
    };
  };

  it('initializes 12x14 grid and correctly counts remaining breakable bricks', () => {
    const grid = new BrickGridManager();
    const layout = createMockLevel();
    grid.loadLevel(layout);

    // 12 standard + 12 armored + 1 standard + 1 explosive = 26 breakables (indestructible bricks are excluded)
    expect(grid.getRemainingBreakables()).toBe(26);
  });

  it('resolves spatial coordinates in O(1) from pixel positions', () => {
    const grid = new BrickGridManager();
    grid.loadLevel(createMockLevel());

    // Row 0 Col 0 is at offset left = 30, top = 60; brick width 58, height 20
    const brick = grid.getBrickAtPixel(35, 65);
    expect(brick).not.toBeNull();
    expect(brick?.row).toBe(0);
    expect(brick?.col).toBe(0);
  });

  it('decrements durability on multi-hit armored bricks', () => {
    const grid = new BrickGridManager();
    grid.loadLevel(createMockLevel());

    const armoredBrick = grid.getBrickAt(1, 0);
    expect(armoredBrick).not.toBeNull();
    expect(armoredBrick?.type).toBe('ARMORED');
    expect(armoredBrick?.maxHits).toBe(2);
    expect(armoredBrick?.currentHits).toBe(2);

    // First hit -> damage 1, not destroyed
    const hit1 = armoredBrick?.hit(1);
    expect(hit1?.destroyed).toBe(false);
    expect(armoredBrick?.currentHits).toBe(1);
    expect(grid.getRemainingBreakables()).toBe(26);

    // Second hit -> destroyed
    const hit2 = armoredBrick?.hit(1);
    expect(hit2?.destroyed).toBe(true);
    expect(armoredBrick?.isAlive).toBe(false);
  });

  it('ignores hits on INDESTRUCTIBLE bricks without decrementing breakable count', () => {
    const grid = new BrickGridManager();
    grid.loadLevel(createMockLevel());

    const silverBrick = grid.getBrickAt(2, 0);
    expect(silverBrick?.type).toBe('INDESTRUCTIBLE');

    const hit = silverBrick?.hit(1);
    expect(hit?.destroyed).toBe(false);
    expect(hit?.pointsAwarded).toBe(0);
    expect(silverBrick?.isAlive).toBe(true);
  });

  it('triggers 3x3 cascading explosion on explosive TNT brick detonation', () => {
    const grid = new BrickGridManager();
    grid.loadLevel(createMockLevel());

    // Trigger explosion at Row 3 Col 5
    const initialBreakables = grid.getRemainingBreakables();
    grid.triggerExplosion(3, 5);

    // Run grid update to process cascade queue
    grid.update(0.1);

    expect(grid.getRemainingBreakables()).toBeLessThan(initialBreakables);
    const tntBrick = grid.getBrickAt(3, 5);
    expect(tntBrick?.isAlive).toBe(false);
  });
});
