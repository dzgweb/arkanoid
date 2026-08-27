/**
 * @file game/levels/index.ts
 * Master export index for all 6 Arkanoid level layouts.
 */

import { ILevelLayout } from '../types';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { level4 } from './level4';
import { level5 } from './level5';
import { level6 } from './level6';

export const ALL_LEVELS: readonly ILevelLayout[] = [
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
] as const;

export function getLevelLayout(levelNumber: number): ILevelLayout {
  const index = Math.max(0, Math.min(ALL_LEVELS.length - 1, levelNumber - 1));
  return ALL_LEVELS[index];
}

export { level1, level2, level3, level4, level5, level6 };
