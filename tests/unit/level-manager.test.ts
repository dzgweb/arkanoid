/**
 * @file tests/unit/level-manager.test.ts
 * Vitest unit test suite for level loading, matrix validation,
 * progression (1 -> 6 -> Victory), and restart capabilities.
 */

import { describe, it, expect } from 'vitest';
import { LevelManager } from '@/game/systems/LevelManager';
import { TOTAL_LEVELS, GRID_ROWS, GRID_COLS } from '@/game/constants';

describe('LevelManager Progression & Matrix Integrity', () => {
  it('loads all 6 levels with valid 12x14 geometry and metadata', () => {
    const manager = new LevelManager();
    expect(manager.getTotalLevels()).toBe(TOTAL_LEVELS);

    for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
      const layout = manager.loadLevel(lvl);
      expect(layout.levelNumber).toBe(lvl);
      expect(layout.name).toBeTruthy();
      expect(layout.themeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(layout.matrix.length).toBe(GRID_ROWS);

      for (const row of layout.matrix) {
        expect(row.length).toBe(GRID_COLS);
      }
    }
  });

  it('progresses sequentially from level 1 to level 6', () => {
    const manager = new LevelManager();
    expect(manager.getCurrentLevelNumber()).toBe(1);

    for (let i = 1; i < TOTAL_LEVELS; i++) {
      const res = manager.advanceLevel();
      expect(res.levelNumber).toBe(i + 1);
      expect(res.isVictory).toBe(false);
    }

    expect(manager.getCurrentLevelNumber()).toBe(TOTAL_LEVELS);
    expect(manager.isFinalLevel()).toBe(true);
  });

  it('triggers isVictory: true when advancing past the final level', () => {
    const manager = new LevelManager();
    manager.loadLevel(TOTAL_LEVELS);
    expect(manager.isFinalLevel()).toBe(true);

    const victoryRes = manager.advanceLevel();
    expect(victoryRes.isVictory).toBe(true);
  });

  it('restarts current level without altering level number', () => {
    const manager = new LevelManager();
    manager.loadLevel(3);
    const layout = manager.restartCurrentLevel();

    expect(layout.levelNumber).toBe(3);
    expect(manager.getCurrentLevelNumber()).toBe(3);
  });

  it('resets to level 1 on resetToFirstLevel()', () => {
    const manager = new LevelManager();
    manager.loadLevel(5);
    manager.resetToFirstLevel();

    expect(manager.getCurrentLevelNumber()).toBe(1);
  });
});
