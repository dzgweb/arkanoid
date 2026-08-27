/**
 * @file game/levels/level6.ts
 * Level 6: "Circuit Breaker"
 * Master Control CPU motherboard with capacitor TNT relays, logic bus lines, and hardened die armor.
 */

import { ILevelLayout } from '../types';

export const level6: ILevelLayout = {
  levelNumber: 6,
  name: 'Circuit Breaker',
  themeColor: '#f43f5e', // Neon Crimson
  matrix: [
    [10, 11, 10, 11, 10, 11, 11, 10, 11, 10, 11, 10], // Row 0: Top Capacitor Bus Rail
    [10,  9, 10,  9, 10,  9,  9, 10,  9, 10,  9, 10], // Row 1: Hardened Logic Gates
    [11,  9,  1,  1,  1,  1,  1,  1,  1,  1,  9, 11], // Row 2: High-Voltage Rail
    [10, 10,  1, 10, 10, 10, 10, 10, 10,  1, 10, 10], // Row 3: CPU Heat Shield
    [11,  9,  2, 10,  9,  9,  9,  9, 10,  2,  9, 11], // Row 4: CPU Die Silicon
    [10,  8,  3, 10,  9, 11, 11,  9, 10,  3,  8, 10], // Row 5: CPU Core Overclock TNT
    [10,  8,  3, 10,  9, 11, 11,  9, 10,  3,  8, 10], // Row 6: CPU Core Overclock TNT
    [11,  9,  4, 10,  9,  9,  9,  9, 10,  4,  9, 11], // Row 7: Lower CPU Die
    [10, 10,  5, 10, 10, 10, 10, 10, 10,  5, 10, 10], // Row 8: Lower Heat Shield
    [11,  9,  6,  6,  6,  6,  6,  6,  6,  6,  9, 11], // Row 9: Lower High-Voltage Rail
    [10, 11, 10,  8,  8, 11, 11,  8,  8, 10, 11, 10], // Row 10: Sub-Processor Cluster
    [0,  10,  0, 10,  0, 10, 10,  0, 10,  0, 10,  0], // Row 11: Ground Bus Pins
    [0,   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // Row 12
    [0,   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // Row 13
  ],
  specialDrops: {
    '0_1': 'MULTI_BALL',
    '0_10': 'LASER',
    '5_5': 'MULTI_BALL',
    '6_6': 'SHIELD',
    '10_5': 'LASER',
    '10_6': 'EXTEND',
  },
};
