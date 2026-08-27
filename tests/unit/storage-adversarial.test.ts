/**
 * @file tests/unit/storage-adversarial.test.ts
 * Empirical Adversarial Stress Test Suite for utils/storage.ts and utils/highScores.ts
 * Authored by Challenger 1 (Milestone 1)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isLocalStorageAvailable,
  storageGet,
  storageSet,
  storageRemove,
  storageClear,
} from '@/utils/storage';
import {
  getHighScores,
  saveHighScore,
  isHighScore,
  isHighScoreEligible,
  clearHighScores,
  resetHighScores,
} from '@/utils/highScores';
import {
  STORAGE_KEY_HIGHSCORES,
  DEFAULT_HIGH_SCORES,
  MAX_HIGH_SCORES,
} from '@/game/constants';
import { HighScoreEntry } from '@/game/types';

describe('Adversarial Stress Suite: utils/storage.ts', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Corrupted & Malformed JSON Handling', () => {
    it('handles malformed JSON in localStorage without throwing', () => {
      window.localStorage.setItem('test_corrupt', '{malformed:json, missing_brace:');
      const result = storageGet('test_corrupt', { default: true });
      expect(result).toEqual({ default: true });
    });

    it('handles raw "undefined" string in localStorage without throwing', () => {
      window.localStorage.setItem('test_undefined', 'undefined');
      const result = storageGet('test_undefined', 'fallback_val');
      expect(result).toBe('fallback_val');
    });

    it('handles empty string in localStorage by returning defaultValue', () => {
      window.localStorage.setItem('test_empty', '');
      const result = storageGet('test_empty', 'fallback_empty');
      expect(result).toBe('fallback_empty');
    });

    it('correctly deserializes literal JSON values (null, numbers, booleans)', () => {
      window.localStorage.setItem('test_null', 'null');
      expect(storageGet('test_null', 'default')).toBeNull();

      window.localStorage.setItem('test_num', '0');
      expect(storageGet('test_num', 999)).toBe(0);

      window.localStorage.setItem('test_bool', 'false');
      expect(storageGet('test_bool', true)).toBe(false);
    });

    it('prevents prototype pollution payloads in stored JSON', () => {
      window.localStorage.setItem(
        'test_pollution',
        '{"__proto__": {"polluted": true}, "normal": 42}'
      );
      const parsed = storageGet<{ normal: number }>('test_pollution', { normal: 0 });
      expect(parsed.normal).toBe(42);
      expect((Object.prototype as any).polluted).toBeUndefined();
    });
  });

  describe('2. Quota Exceeded & Storage Exceptions', () => {
    it('demonstrates storageGet read survival when write quota is full', () => {
      // 1. Store valid data in localStorage
      window.localStorage.setItem('saved_data', JSON.stringify({ score: 9999 }));

      // 2. Simulate storage quota full: setItem throws QuotaExceededError, but getItem works
      const origSetItem = Storage.prototype.setItem;
      try {
        Storage.prototype.setItem = () => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        };

        // With remediation, storageGet reads from localStorage even if write quota is exceeded
        const readResult = storageGet('saved_data', { score: 0 });
        expect(readResult).toEqual({ score: 9999 });
      } finally {
        Storage.prototype.setItem = origSetItem;
      }
    });

    it('handles SecurityError (cookies disabled / cross-origin iframe)', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Access is denied', 'SecurityError');
      });

      const value = storageGet('secure_key', 'safe_default');
      expect(value).toBe('safe_default');
      getItemSpy.mockRestore();
    });

    it('handles non-serializable objects (circular references, BigInt)', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      expect(storageSet('circular', circular)).toBe(false);

      const withBigInt = { val: 10n };
      expect(storageSet('bigint', withBigInt)).toBe(false);
    });

    it('supports in-memory fallback when localStorage is completely disabled', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage is disabled');
      });

      expect(isLocalStorageAvailable()).toBe(false);
      const writeResult = storageSet('fallback_key', { fallback: 'active' });
      expect(writeResult).toBe(true);

      const readResult = storageGet('fallback_key', null);
      expect(readResult).toEqual({ fallback: 'active' });

      expect(storageRemove('fallback_key')).toBe(true);
      expect(storageGet('fallback_key', null)).toBeNull();

      storageSet('clear_me', 123);
      expect(storageClear()).toBe(true);
      expect(storageGet('clear_me', null)).toBeNull();

      setItemSpy.mockRestore();
    });
  });

  describe('3. SSR Simulation (window = undefined)', () => {
    it('safely handles SSR environment where window is undefined', () => {
      const originalWindow = global.window;
      try {
        // @ts-ignore
        delete global.window;

        expect(isLocalStorageAvailable()).toBe(false);
        expect(storageGet('ssr_key', 'ssr_default')).toBe('ssr_default');
        expect(storageSet('ssr_key', 'val')).toBe(false);
        expect(storageRemove('ssr_key')).toBe(false);
        expect(storageClear()).toBe(false);
      } finally {
        global.window = originalWindow;
      }
    });
  });
});

describe('Adversarial Stress Suite: utils/highScores.ts', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  describe('1. Storage Initialization & Default Seeding Integrity', () => {
    it('returns 5 default seed entries on first call when storage is empty', () => {
      const scores = getHighScores();
      expect(scores.length).toBe(DEFAULT_HIGH_SCORES.length);
      expect(scores[0].score).toBe(100000);
      expect(scores[0].name).toBe('CYB');
    });

    it('preserves default seed entries when saving high score on pristine storage', () => {
      // If a user plays for the first time without viewing high scores modal,
      // saving a score incorporates existing default high scores.
      const updated = saveHighScore('ACE', 60000, 4);

      expect(updated.length).toBe(6);
      expect(updated.some((s) => s.name === 'ACE' && s.score === 60000)).toBe(true);

      const retrieved = getHighScores();
      expect(retrieved.length).toBe(6);
      expect(retrieved[0].name).toBe('CYB');
      expect(retrieved[0].score).toBe(100000);
    });

    it('handles non-array or invalid JSON stored under high scores key', () => {
      window.localStorage.setItem(STORAGE_KEY_HIGHSCORES, JSON.stringify({ not: 'an array' }));
      const scores = getHighScores();
      expect(Array.isArray(scores)).toBe(true);
      expect(scores.length).toBe(DEFAULT_HIGH_SCORES.length);
    });

    it('handles arrays containing null entries safely in getHighScores without crashing', () => {
      // If localStorage contains [null, { name: "VAL", score: 50000 }]
      window.localStorage.setItem(
        STORAGE_KEY_HIGHSCORES,
        JSON.stringify([null, { name: 'VAL', score: 50000, level: 3 }])
      );

      const scores = getHighScores();
      expect(Array.isArray(scores)).toBe(true);
      expect(scores.length).toBe(1);
      expect(scores[0].name).toBe('VAL');
      expect(scores[0].score).toBe(50000);
    });
  });

  describe('2. Extreme Values & Score Mathematical Boundaries', () => {
    it('ensures isHighScore(NaN) and invalid numbers evaluate to false', () => {
      expect(isHighScore(NaN)).toBe(false);
      expect(isHighScore(Infinity)).toBe(false);
      expect(isHighScore(-Infinity)).toBe(false);
      expect(isHighScoreEligible(0)).toBe(false);
      expect(isHighScore(-100)).toBe(false);
    });

    it('clamps negative score to 0 and negative level to 1 on save', () => {
      saveHighScore('NEG', -500, -10);
      const scores = getHighScores();
      const entry = scores.find((s) => s.name === 'NEG');
      expect(entry).toBeDefined();
      expect(entry?.score).toBe(0);
      expect(entry?.level).toBe(1);
    });

    it('handles Number.MAX_SAFE_INTEGER (2^53 - 1)', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      expect(isHighScore(maxSafe)).toBe(true);
      saveHighScore('MAX', maxSafe, 6);
      const scores = getHighScores();
      expect(scores[0].name).toBe('MAX');
      expect(scores[0].score).toBe(maxSafe);
    });

    it('handles exact tie scores at table capacity', () => {
      clearHighScores();
      for (let i = 10; i >= 1; i--) {
        saveHighScore(`P${i}`, 100000 + i * 1000, 1);
      }
      const initialScores = getHighScores();
      expect(initialScores.length).toBe(10);
      expect(initialScores[9].score).toBe(101000);

      // Exactly tying 10th place (101000) does not qualify
      expect(isHighScore(101000)).toBe(false);
      // Strictly greater (101001) qualifies
      expect(isHighScore(101001)).toBe(true);

      // Inserting a tie/higher score maintains top 10 limit
      saveHighScore('TIE', 105000, 2);
      const afterTie = getHighScores();
      expect(afterTie.length).toBe(10);
      expect(afterTie.some((s) => s.name === 'TIE')).toBe(true);
    });
  });

  describe('3. String Sanitization, XSS Payloads & Unicode Handling', () => {
    it('trims whitespace and converts lowercase to uppercase', () => {
      saveHighScore('  abc  ', 80000, 3);
      const scores = getHighScores();
      expect(scores.some((s) => s.name === 'ABC')).toBe(true);
    });

    it('defaults empty or whitespace-only initials to AAA', () => {
      saveHighScore('   ', 85000, 3);
      const scores = getHighScores();
      expect(scores.some((s) => s.name === 'AAA')).toBe(true);
    });

    it('sanitizes long strings and XSS script tags safely to 3 characters', () => {
      saveHighScore('<script>alert("xss")</script>', 90000, 4);
      const scores = getHighScores();
      const xssEntry = scores.find((s) => s.score === 90000);
      expect(xssEntry).toBeDefined();
      expect(xssEntry?.name).toBe('<SC');
      expect(xssEntry?.name.length).toBeLessThanOrEqual(3);
    });

    it('handles unicode and emoji initials without splitting surrogate pairs', () => {
      saveHighScore('👾🚀', 95000, 5);
      const scores = getHighScores();
      const emojiEntry = scores.find((s) => s.score === 95000);
      expect(emojiEntry).toBeDefined();
      expect(emojiEntry?.name).toBe('👾🚀');
      expect(Array.from(emojiEntry!.name).length).toBe(2);
    });
  });

  describe('4. API Polymorphism (Object vs Positional arguments)', () => {
    it('supports object argument signature', () => {
      saveHighScore({ name: 'OBJ', score: 110000, level: 5 });
      const scores = getHighScores();
      expect(scores[0].name).toBe('OBJ');
      expect(scores[0].score).toBe(110000);
      expect(scores[0].level).toBe(5);
    });

    it('handles object with undefined or missing name safely without crashing', () => {
      // @ts-ignore
      const scores = saveHighScore({ name: undefined, score: 70000, level: 1 });
      expect(scores.some((s) => s.name === 'AAA' && s.score === 70000)).toBe(true);
    });
  });

  describe('5. High Frequency & Stress Invariance', () => {
    it('maintains strict descending sort and top 10 limit across 100 rapid random saves', () => {
      for (let i = 0; i < 100; i++) {
        const randomScore = Math.floor(Math.random() * 500000);
        const randomLevel = Math.floor(Math.random() * 6) + 1;
        saveHighScore(`R${i}`, randomScore, randomLevel);
      }

      const scores = getHighScores();
      expect(scores.length).toBe(MAX_HIGH_SCORES);

      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i].score).toBeGreaterThanOrEqual(scores[i + 1].score);
      }
    });
  });
});
