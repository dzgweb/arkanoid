/**
 * @file game/levels/level1.ts
 * Level 1: "The Classic Wall"
 * 6 horizontal rainbow bands across rows 2–7. Perfect introduction to paddle reflection mechanics.
 */

import { ILevelLayout } from '../types';

export const level1: ILevelLayout = {
  levelNumber: 1,
  name: 'The Classic Wall',
  themeColor: '#06b6d4', // Cyan
  matrix: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Row 0
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Row 1
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0], // Row 2: Red
    [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0], // Row 3: Orange
    [0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0], // Row 4: Amber
    [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0], // Row 5: Green
    [0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0], // Row 6: Cyan
    [0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0], // Row 7: Blue
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Row 8
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Row 9
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Row 10
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Row 11
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Row 12
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Row 13
  ],
  specialDrops: {
    '2_5': 'MULTI_BALL',
    '4_3': 'EXTEND',
    '6_8': 'LASER',
    '5_6': 'SLOW',
  },
};
