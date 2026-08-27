/**
 * @file game/levels/level3.ts
 * Level 3: "Alien Invader"
 * Space Invader pixel glyph silhouette with TNT antennae tips, armored carapace, and reactor battery.
 */

import { ILevelLayout } from '../types';

export const level3: ILevelLayout = {
  levelNumber: 3,
  name: 'Alien Invader',
  themeColor: '#10b981', // Green
  matrix: [
    [0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 0], // Row 0
    [0, 0, 11,  0,  0,  0,  0,  0,  0, 11,  0, 0], // Row 1: TNT Antenna Tips
    [0, 0,  0,  4,  0,  0,  0,  0,  4,  0,  0, 0], // Row 2: Antenna Stalks
    [0, 0,  8,  4,  4,  4,  4,  4,  4,  8,  0, 0], // Row 3: Head Carapace
    [0, 8,  8,  1,  8,  8,  8,  8,  1,  8,  8, 0], // Row 4: Glowing Eyes & Cheeks
    [8, 8,  8,  8,  8,  8,  8,  8,  8,  8,  8, 8], // Row 5: Armored Thorax Ridge
    [8, 0,  8, 11, 11, 11, 11, 11, 11,  8,  0, 8], // Row 6: TNT Reactor Core Battery
    [8, 0,  8,  7,  7,  7,  7,  7,  7,  8,  0, 8], // Row 7: Purple Plasma Underbelly
    [0, 0,  0,  5,  5,  0,  0,  5,  5,  0,  0, 0], // Row 8: Landing Pods
    [0, 0,  5,  0,  0,  0,  0,  0,  0,  5,  0, 0], // Row 9: Tentacle Tips
    [0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 0], // Row 10
    [0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 0], // Row 11
    [0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 0], // Row 12
    [0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 0], // Row 13
  ],
  specialDrops: {
    '1_2': 'LASER',
    '1_9': 'LASER',
    '6_5': 'SHIELD',
    '7_6': 'MULTI_BALL',
  },
};
