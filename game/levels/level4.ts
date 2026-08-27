/**
 * @file game/levels/level4.ts
 * Level 4: "Diamond Vault & Maze"
 * Concentric crystalline diamond maze with indestructible perimeter barriers guarding the interior vault.
 */

import { ILevelLayout } from '../types';

export const level4: ILevelLayout = {
  levelNumber: 4,
  name: 'Diamond Vault & Maze',
  themeColor: '#d946ef', // Fuchsia / Purple
  matrix: [
    [0,   0,  0,  0,  0, 10, 10,  0,  0,  0,  0,  0], // Row 0: Diamond Apex
    [0,   0,  0,  0, 10,  9,  9, 10,  0,  0,  0,  0], // Row 1: 3-Hit Armored Apex Guard
    [0,   0,  0, 10,  7,  1,  1,  7, 10,  0,  0,  0], // Row 2: Upper Vault Shell
    [0,   0, 10,  7,  1, 11, 11,  1,  7, 10,  0,  0], // Row 3: TNT Vault Heart
    [0,  10,  7,  1, 11,  9,  9, 11,  1,  7, 10,  0], // Row 4: Heavy Core Safe
    [10,  6,  2, 11,  9,  8,  8,  9, 11,  2,  6, 10], // Row 5: Equator
    [0,  10,  6,  2, 11,  9,  9, 11,  2,  6, 10,  0], // Row 6: Lower Diamond Half
    [0,   0, 10,  6,  2, 11, 11,  2,  6, 10,  0,  0], // Row 7
    [0,   0,  0, 10,  5,  3,  3,  5, 10,  0,  0,  0], // Row 8
    [0,   0,  0,  0, 10,  9,  9, 10,  0,  0,  0,  0], // Row 9: Lower Apex Guard
    [0,   0,  0,  0,  0, 10, 10,  0,  0,  0,  0,  0], // Row 10: Bottom Apex
    [0,   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // Row 11
    [0,   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // Row 12
    [0,   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // Row 13
  ],
  specialDrops: {
    '3_5': 'LASER',
    '4_6': 'MULTI_BALL',
    '5_5': 'EXTEND',
    '7_6': 'SLOW',
  },
};
