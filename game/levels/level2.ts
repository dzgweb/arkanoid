/**
 * @file game/levels/level2.ts
 * Level 2: "The Stepped Fortress"
 * Medieval fortified bastion with 2-hit Armored towers and indestructible corner keystones.
 */

import { ILevelLayout } from '../types';

export const level2: ILevelLayout = {
  levelNumber: 2,
  name: 'The Stepped Fortress',
  themeColor: '#f59e0b', // Amber
  matrix: [
    [0,  0, 0,  0, 0,  0,  0,  0, 0,  0, 0,  0], // Row 0
    [10, 0, 8,  0, 0,  8,  8,  0, 0,  8, 0, 10], // Row 1: Keystones & Tower Parapets
    [8,  8, 8,  0, 8,  8,  8,  8, 0,  8, 8,  8], // Row 2: Armored Ramparts
    [8,  1, 1,  8, 1,  1,  1,  1, 8,  1, 1,  8], // Row 3: Red Garrison
    [8,  2, 2,  8, 2,  2,  2,  2, 8,  2, 2,  8], // Row 4: Orange Garrison
    [10, 3, 3, 10, 3, 11, 11,  3, 10, 3, 3, 10], // Row 5: Indestructible Pillars + TNT Stash
    [0,  4, 4,  4, 4,  4,  4,  4, 4,  4, 4,  0], // Row 6: Green Tier
    [0,  0, 5,  5, 5,  5,  5,  5, 5,  5, 0,  0], // Row 7: Cyan Gatehouse
    [0,  0, 0,  6, 6,  6,  6,  6, 6,  0, 0,  0], // Row 8: Blue Moat Step
    [0,  0, 0,  0, 0,  0,  0,  0, 0,  0, 0,  0], // Row 9
    [0,  0, 0,  0, 0,  0,  0,  0, 0,  0, 0,  0], // Row 10
    [0,  0, 0,  0, 0,  0,  0,  0, 0,  0, 0,  0], // Row 11
    [0,  0, 0,  0, 0,  0,  0,  0, 0,  0, 0,  0], // Row 12
    [0,  0, 0,  0, 0,  0,  0,  0, 0,  0, 0,  0], // Row 13
  ],
  specialDrops: {
    '1_2': 'STICKY',
    '3_4': 'MULTI_BALL',
    '5_5': 'LASER',
    '7_6': 'EXTEND',
  },
};
