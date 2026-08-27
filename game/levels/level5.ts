/**
 * @file game/levels/level5.ts
 * Level 5: "Quantum Reactor"
 * Particle containment ring with 3-hit heavy containment rods and 4 plasma valves.
 */

import { ILevelLayout } from '../types';

export const level5: ILevelLayout = {
  levelNumber: 5,
  name: 'Quantum Reactor',
  themeColor: '#3b82f6', // Blue
  matrix: [
    [0,   0,  0, 10, 10, 10, 10, 10, 10,  0,  0,  0], // Row 0: Top Containment Barrier
    [0,  10, 11,  9,  9,  9,  9,  9,  9, 11, 10,  0], // Row 1: Plasma Valves & 3-Hit Rods
    [10, 11,  6,  6,  1,  1,  1,  1,  6,  6, 11, 10], // Row 2
    [10,  9,  6, 10, 10,  0,  0, 10, 10,  6,  9, 10], // Row 3: Magnetic Choke Funnel
    [10,  9,  1, 10, 11,  7,  7, 11, 10,  1,  9, 10], // Row 4: Inner Reactor Chamber
    [10,  9,  1,  0,  7,  9,  9,  7,  0,  1,  9, 10], // Row 5: Zero-Point Core
    [10,  9,  1,  0,  7,  9,  9,  7,  0,  1,  9, 10], // Row 6: Zero-Point Core
    [10,  9,  1, 10, 11,  7,  7, 11, 10,  1,  9, 10], // Row 7: Inner Chamber Base
    [10,  9,  5, 10, 10,  0,  0, 10, 10,  5,  9, 10], // Row 8: Lower Funnel
    [10, 11,  5,  5,  2,  2,  2,  2,  5,  5, 11, 10], // Row 9
    [0,  10, 11,  9,  9,  9,  9,  9,  9, 11, 10,  0], // Row 10: Lower Plasma Valves
    [0,   0,  0, 10, 10, 10, 10, 10, 10,  0,  0,  0], // Row 11: Bottom Containment Barrier
    [0,   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // Row 12
    [0,   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // Row 13
  ],
  specialDrops: {
    '1_2': 'MULTI_BALL',
    '1_9': 'SHIELD',
    '4_4': 'LASER',
    '7_7': 'STICKY',
    '10_2': 'EXTEND',
  },
};
