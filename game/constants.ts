/**
 * @file game/constants.ts
 * Core constants, physics configuration, color palettes, and default settings.
 */

import { HighScoreEntry, PowerupType, GameHUDState } from './types';

// ==========================================
// 1. Canvas & Timestep Configuration
// ==========================================

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 700;
export const TARGET_FPS = 60;
export const FIXED_DT = 1 / 60; // 0.016666666666666666 s
export const MAX_FRAME_TIME = 0.25; // Max 250ms clamp to prevent spiral of death

// ==========================================
// 2. Gameplay & Scoring Constants
// ==========================================

export const INITIAL_LIVES = 3;
export const MAX_LIVES = 5;
export const TOTAL_LEVELS = 6;
export const COMBO_TIMEOUT_MS = 2500;
export const COMBO_MAX_MULTIPLIER = 8;

export const POINTS_STANDARD = 100;
export const POINTS_ARMORED_PER_HIT = 100;
export const POINTS_ARMORED_DESTROY = 250;
export const POINTS_EXPLOSIVE = 500;
export const POINTS_INDESTRUCTIBLE = 0;

// ==========================================
// 3. Paddle Configuration
// ==========================================

export const PADDLE_BASE_WIDTH = 100;
export const PADDLE_EXTENDED_WIDTH = 150;
export const PADDLE_SHRUNK_WIDTH = 70;
export const PADDLE_HEIGHT = 16;
export const PADDLE_Y = 640;
export const PADDLE_KEYBOARD_SPEED = 650; // px/s
export const PADDLE_COLOR = '#06b6d4'; // Cyan neon
export const PADDLE_GLOW_COLOR = 'rgba(6, 182, 212, 0.6)';
export const PADDLE_LASER_COOLDOWN_MS = 220; // 220ms between dual shots
export const MAX_PADDLE_BOUNCE_ANGLE = (75 * Math.PI) / 180; // 75 degrees in radians

// ==========================================
// 4. Ball Configuration
// ==========================================

export const BALL_DEFAULT_RADIUS = 7;
export const BALL_INITIAL_SPEED = 420; // px/s
export const BALL_MIN_SPEED = 300;
export const BALL_MAX_SPEED = 700;
export const BALL_SPEED_STEP_PER_HIT = 4;
export const BALL_SLOW_FACTOR = 0.7;
export const BALL_FAST_FACTOR = 1.3;
export const BALL_MIN_VY = 80; // px/s vertical safeguard
export const BALL_COLOR = '#f8fafc';
export const BALL_GLOW_COLOR = 'rgba(255, 255, 255, 0.8)';
export const BALL_TRAIL_LENGTH = 6;
export const MAX_ACTIVE_BALLS = 12;
export const MULTI_BALL_FAN_ANGLE = (25 * Math.PI) / 180; // 25 degrees divergence

// ==========================================
// 5. Brick Grid Configuration
// ==========================================

export const GRID_ROWS = 14;
export const GRID_COLS = 12;
export const BRICK_WIDTH = 58;
export const BRICK_HEIGHT = 20;
export const GRID_GAP = 4;
export const GRID_OFFSET_LEFT = 30; // (800 - (12 * 58 + 11 * 4)) / 2 = 30 px
export const GRID_OFFSET_TOP = 60;

export const BRICK_COLORS = {
  RED: { fill: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)', border: '#f87171' },
  ORANGE: { fill: '#f97316', glow: 'rgba(249, 115, 22, 0.6)', border: '#fb923c' },
  AMBER: { fill: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)', border: '#fbbf24' },
  GREEN: { fill: '#10b981', glow: 'rgba(16, 185, 129, 0.6)', border: '#34d399' },
  CYAN: { fill: '#06b6d4', glow: 'rgba(6, 182, 212, 0.6)', border: '#22d3ee' },
  BLUE: { fill: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)', border: '#60a5fa' },
  PURPLE: { fill: '#d946ef', glow: 'rgba(217, 70, 239, 0.6)', border: '#e879f9' },
  ARMORED: {
    STAGE1: { fill: '#64748b', glow: 'rgba(100, 116, 139, 0.5)', border: '#94a3b8' },
    STAGE2: { fill: '#94a3b8', glow: 'rgba(148, 163, 184, 0.6)', border: '#cbd5e1' },
    STAGE3: { fill: '#cbd5e1', glow: 'rgba(203, 213, 225, 0.7)', border: '#f1f5f9' },
  },
  INDESTRUCTIBLE: { fill: '#9ca3af', glow: 'rgba(156, 163, 175, 0.4)', border: '#e5e7eb' },
  EXPLOSIVE: { fill: '#f43f5e', glow: 'rgba(244, 63, 94, 0.8)', border: '#fda4af' },
} as const;

// ==========================================
// 6. Power-ups Configuration
// ==========================================

export const POWERUP_DURATIONS: Record<PowerupType, number> = {
  MULTI_BALL: 0,
  LASER: 10000,
  LASER_PADDLE: 10000,
  EXTEND: 12000,
  EXTEND_PADDLE: 12000,
  SHRINK: 8000,
  SHRINK_PADDLE: 8000,
  SLOW: 10000,
  SLOW_BALL: 10000,
  FAST: 8000,
  FAST_BALL: 8000,
  STICKY: 15000,
  STICKY_PADDLE: 15000,
  SHIELD: 20000,
} as const;

export const CAPSULE_WIDTH = 32;
export const CAPSULE_HEIGHT = 16;
export const CAPSULE_RADIUS = 8;
export const CAPSULE_SPEED_Y = 150; // px/s
export const CAPSULE_WOBBLE_FREQ = 6;
export const CAPSULE_WOBBLE_AMP = 6;

export const DROP_RATES = {
  STANDARD: 0.15,
  ARMORED: 0.30,
  EXPLOSIVE: 0.40,
  INDESTRUCTIBLE: 0.0,
} as const;

export interface PowerupConfig {
  type: PowerupType;
  letter: string;
  label: string;
  color: string;
  glowColor: string;
  weight: number;
}

export const POWERUP_CONFIGS: Record<PowerupType, PowerupConfig> = {
  MULTI_BALL: {
    type: 'MULTI_BALL',
    letter: 'M',
    label: 'Multi-Ball',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.7)',
    weight: 22,
  },
  LASER: {
    type: 'LASER',
    letter: 'L',
    label: 'Laser Cannon',
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.7)',
    weight: 18,
  },
  LASER_PADDLE: {
    type: 'LASER_PADDLE',
    letter: 'L',
    label: 'Laser Cannon',
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.7)',
    weight: 18,
  },
  EXTEND: {
    type: 'EXTEND',
    letter: 'E',
    label: 'Expand Paddle',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    weight: 20,
  },
  EXTEND_PADDLE: {
    type: 'EXTEND_PADDLE',
    letter: 'E',
    label: 'Expand Paddle',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    weight: 20,
  },
  SHRINK: {
    type: 'SHRINK',
    letter: 'X',
    label: 'Shrink Penalty',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.7)',
    weight: 5,
  },
  SHRINK_PADDLE: {
    type: 'SHRINK_PADDLE',
    letter: 'X',
    label: 'Shrink Penalty',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.7)',
    weight: 5,
  },
  SLOW: {
    type: 'SLOW',
    letter: 'S',
    label: 'Slow Ball',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.7)',
    weight: 12,
  },
  SLOW_BALL: {
    type: 'SLOW_BALL',
    letter: 'S',
    label: 'Slow Ball',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.7)',
    weight: 12,
  },
  FAST: {
    type: 'FAST',
    letter: 'F',
    label: 'Turbo Ball',
    color: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.7)',
    weight: 6,
  },
  FAST_BALL: {
    type: 'FAST_BALL',
    letter: 'F',
    label: 'Turbo Ball',
    color: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.7)',
    weight: 6,
  },
  STICKY: {
    type: 'STICKY',
    letter: 'C',
    label: 'Catch / Sticky',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    weight: 15,
  },
  STICKY_PADDLE: {
    type: 'STICKY_PADDLE',
    letter: 'C',
    label: 'Catch / Sticky',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    weight: 15,
  },
  SHIELD: {
    type: 'SHIELD',
    letter: 'B',
    label: 'Shield Barrier',
    color: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.7)',
    weight: 8,
  },
} as const;

// ==========================================
// 7. Laser Projectiles & Shield Floor
// ==========================================

export const LASER_WIDTH = 4;
export const LASER_HEIGHT = 14;
export const LASER_SPEED_Y = -650; // px/s
export const LASER_DAMAGE = 1;
export const LASER_COLOR = '#f43f5e';
export const LASER_GLOW_COLOR = 'rgba(244, 63, 94, 0.8)';

export const SHIELD_Y = 692;
export const SHIELD_HEIGHT = 6;
export const SHIELD_COLOR = '#8b5cf6';
export const SHIELD_GLOW_COLOR = 'rgba(139, 92, 246, 0.8)';

// ==========================================
// 8. Visual FX: Particles & Screen Shake
// ==========================================

export const PARTICLE_POOL_SIZE = 350;
export const PARTICLE_BRICK_BURST_COUNT = 16;
export const PARTICLE_EXPLOSION_COUNT = 45;
export const PARTICLE_LASER_SPARKS_COUNT = 8;
export const PARTICLE_PICKUP_COUNT = 14;

export const TRAUMA_MAX = 1.0;
export const TRAUMA_DECAY_RATE = 1.8; // Trauma reduction per second
export const MAX_SHAKE_TRANSLATE = 12; // Maximum pixel translation
export const MAX_SHAKE_ROTATION = 0.05; // Maximum radians rotation (~2.8 deg)

export const TRAUMA_BRICK_HIT = 0.08;
export const TRAUMA_ARMORED_HIT = 0.12;
export const TRAUMA_EXPLOSION = 0.55;
export const TRAUMA_BALL_LOST = 0.35;

// ==========================================
// 9. Storage Keys & High Score Seed
// ==========================================

export const STORAGE_KEY_HIGHSCORES = 'ARKANOID_HIGH_SCORES_V1';
export const STORAGE_KEY_SETTINGS = 'arkanoid_settings_v1';
export const MAX_HIGH_SCORES = 10;

export const DEFAULT_HIGH_SCORES: readonly HighScoreEntry[] = [
  { id: 'seed-1', name: 'CYB', score: 100000, level: 6, date: '2026-08-01' },
  { id: 'seed-2', name: 'NEO', score: 75000, level: 5, date: '2026-08-05' },
  { id: 'seed-3', name: 'ARK', score: 50000, level: 4, date: '2026-08-10' },
  { id: 'seed-4', name: 'PIL', score: 35000, level: 3, date: '2026-08-15' },
  { id: 'seed-5', name: 'ACE', score: 20000, level: 2, date: '2026-08-20' },
] as const;

export const INITIAL_HUD_STATE: GameHUDState = {
  score: 0,
  highScore: 100000,
  lives: INITIAL_LIVES,
  level: 1,
  totalLevels: TOTAL_LEVELS,
  multiplier: 1,
  combo: 0,
  status: 'IDLE',
  activePowerups: [],
  isMuted: false,
  soundVolume: 0.8,
  volume: 0.8,
  isTouchControls: false,
  hasShield: false,
};
