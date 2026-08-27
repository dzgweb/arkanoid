/**
 * @file utils/highScores.ts
 * High Scores leaderboard manager with ranking, sorting, and default seed data.
 */

import { HighScoreEntry } from '@/game/types';
import {
  STORAGE_KEY_HIGHSCORES,
  MAX_HIGH_SCORES,
  DEFAULT_HIGH_SCORES,
} from '@/game/constants';
import { storageGet, storageSet, storageRemove } from './storage';

/**
 * Retrieve high scores table, automatically seeding default entries if empty.
 */
export function getHighScores(): HighScoreEntry[] {
  const scores = storageGet<HighScoreEntry[]>(STORAGE_KEY_HIGHSCORES, []);
  if (!scores || !Array.isArray(scores) || scores.length === 0) {
    const seed = [...DEFAULT_HIGH_SCORES];
    storageSet(STORAGE_KEY_HIGHSCORES, seed);
    return seed;
  }

  // Ensure returned array is sorted descending by score
  return [...scores].sort((a, b) => b.score - a.score).slice(0, MAX_HIGH_SCORES);
}

/**
 * Check whether a given score qualifies for the top high scores list.
 */
export function isHighScore(score: number): boolean {
  if (score <= 0) return false;
  const currentScores = getHighScores();
  if (currentScores.length < MAX_HIGH_SCORES) return true;
  return score > currentScores[currentScores.length - 1].score;
}

/**
 * Alias for isHighScore to support multiple component conventions.
 */
export function isHighScoreEligible(score: number): boolean {
  return isHighScore(score);
}

/**
 * Save a new high score entry, maintain top 10 descending order, and persist.
 * Supports both object parameter `{ name, score, level }` and positional `(name, score, level)`.
 */
export function saveHighScore(
  entryOrName: string | Omit<HighScoreEntry, 'id' | 'date'>,
  scoreParam?: number,
  levelParam?: number
): HighScoreEntry[] {
  let rawName: string;
  let rawScore: number;
  let rawLevel: number;

  if (typeof entryOrName === 'string') {
    rawName = entryOrName;
    rawScore = scoreParam ?? 0;
    rawLevel = levelParam ?? 1;
  } else {
    rawName = entryOrName.name;
    rawScore = entryOrName.score;
    rawLevel = entryOrName.level;
  }

  const currentScores = storageGet<HighScoreEntry[]>(STORAGE_KEY_HIGHSCORES, []);
  const cleanName = (rawName.trim().toUpperCase() || 'AAA').slice(0, 3);
  const newEntry: HighScoreEntry = {
    id: `hs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: cleanName,
    score: Math.max(0, Math.floor(rawScore)),
    level: Math.max(1, Math.floor(rawLevel)),
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  };

  const updatedScores = [...currentScores, newEntry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HIGH_SCORES);

  storageSet(STORAGE_KEY_HIGHSCORES, updatedScores);
  return updatedScores;
}

/**
 * Reset high scores back to default seed table.
 */
export function resetHighScores(): HighScoreEntry[] {
  const seed = [...DEFAULT_HIGH_SCORES];
  storageSet(STORAGE_KEY_HIGHSCORES, seed);
  return seed;
}

/**
 * Completely purge or reset high scores back to defaults.
 */
export function clearHighScores(): void {
  storageRemove(STORAGE_KEY_HIGHSCORES);
}
