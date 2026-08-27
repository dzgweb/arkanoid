import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getHighScores,
  saveHighScore,
  isHighScore,
  isHighScoreEligible,
  clearHighScores,
  resetHighScores,
} from '@/utils/highScores';

describe('High Scores Utility (utils/highScores.ts)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  it('returns default high scores when storage is empty', () => {
    const scores = getHighScores();
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].name).toBe('CYB');
    expect(scores[0].score).toBe(100000);
  });

  it('correctly sorts scores descending', () => {
    saveHighScore('TST', 120000, 6);
    const scores = getHighScores();
    expect(scores[0].name).toBe('TST');
    expect(scores[0].score).toBe(120000);
  });

  it('determines high score eligibility accurately', () => {
    expect(isHighScoreEligible(0)).toBe(false);
    expect(isHighScoreEligible(-500)).toBe(false);
    expect(isHighScoreEligible(150000)).toBe(true);
    expect(isHighScore(150000)).toBe(true);
  });

  it('limits stored high scores to maximum 10 entries', () => {
    for (let i = 1; i <= 15; i++) {
      saveHighScore(`P${i}`, i * 10000, 1);
    }
    const scores = getHighScores();
    expect(scores.length).toBe(10);
    expect(scores[0].score).toBe(150000);
    expect(scores[9].score).toBe(60000);
  });

  it('truncates initials to 3 uppercase letters', () => {
    saveHighScore('longerName', 200000, 1);
    const scores = getHighScores();
    expect(scores[0].name).toBe('LON');
  });

  it('resets high scores back to defaults on clear', () => {
    saveHighScore('NEW', 999999, 6);
    expect(getHighScores()[0].name).toBe('NEW');
    clearHighScores();
    expect(getHighScores()[0].name).toBe('CYB');
    expect(getHighScores()[0].score).toBe(100000);
  });

  it('resets high scores back to default seed on resetHighScores', () => {
    saveHighScore('NEW', 999999, 6);
    resetHighScores();
    const scores = getHighScores();
    expect(scores[0].name).toBe('CYB');
    expect(scores[0].score).toBe(100000);
  });
});
