/**
 * @file game/types.ts
 * Core domain types and interface definitions for Arkanoid.
 */

// ==========================================
// 1. Primitive Geometric & Coordinate Types
// ==========================================

export interface Vector2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface GridCoord {
  row: number;
  col: number;
}

// ==========================================
// 2. Game Lifecycle & HUD State
// ==========================================

export type GameStatus =
  | 'IDLE'          // Start screen / attract mode
  | 'PLAYING'       // Active gameplay
  | 'PAUSED'        // Gameplay paused via modal or Escape
  | 'STAGE_CLEAR'   // Current level cleared; showing transition/summary modal
  | 'GAME_OVER'     // Out of lives; showing game over modal
  | 'VICTORY';      // All levels cleared; showing victory modal

export type PowerupType =
  | 'MULTI_BALL'
  | 'LASER'
  | 'LASER_PADDLE'
  | 'EXTEND'
  | 'EXTEND_PADDLE'
  | 'SHRINK'
  | 'SHRINK_PADDLE'
  | 'SLOW'
  | 'SLOW_BALL'
  | 'FAST'
  | 'FAST_BALL'
  | 'STICKY'
  | 'STICKY_PADDLE'
  | 'SHIELD';

export interface ActivePowerup {
  type: PowerupType;
  remainingTimeMs: number;
  maxTimeMs: number;
}

export interface GameHUDState {
  score: number;
  highScore: number;
  lives: number;
  level: number;
  totalLevels: number;
  multiplier: number;
  combo: number;
  status: GameStatus;
  activePowerups: ActivePowerup[];
  isMuted: boolean;
  soundVolume?: number;
  volume?: number;
  isTouchControls?: boolean;
  hasShield?: boolean;
}

// ==========================================
// 3. Game Entities
// ==========================================

export interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  isStuckToPaddle: boolean;
  stuckOffsetRatio: number; // Normalized offset on paddle [-1 to 1]
  color: string;
  glowColor: string;
  trail?: Array<{ x: number; y: number; alpha: number }>;
  prevX: number;
  prevY: number;
  setVelocity(vx: number, vy: number): void;
  setSpeed(speed: number): void;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  baseWidth: number;
  vx: number;
  speed: number;
  hasLasers: boolean;
  laserCooldownMs: number;
  laserTimerMs?: number;
  isSticky: boolean;
  color: string;
  glowColor: string;
  targetX?: number;
  targetWidth: number;
  setLasers(enabled: boolean, cooldownMs?: number): void;
  canFireLaser(currentTimeMs?: number): boolean;
  fireLaser(currentTimeMs?: number): LaserProjectile[];
  catchBall(ball: Ball): void;
}

export type BrickType =
  | 'STANDARD'        // Single hit breakable
  | 'ARMORED'         // Multi-hit (2-3 HP) with crack overlays
  | 'INDESTRUCTIBLE'  // Silver/Gold metallic, cannot be broken
  | 'EXPLOSIVE';      // TNT hazard, triggers 3x3 blast wave

export interface Brick {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: BrickType;
  maxHits: number;
  currentHits: number;
  color: string;
  glowColor?: string;
  points: number;
  powerupDrop?: PowerupType;
  isAlive: boolean;
}

export interface PowerupCapsule {
  id: string;
  type: PowerupType;
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  spawnTime: number;
  color: string;
  glowColor: string;
  letter: string;
  label: string;
}

export interface LaserProjectile {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  damage: number;
  color: string;
  isAlive: boolean;
}

export type ParticleType =
  | 'SPARK'
  | 'BRICK_DEBRIS'
  | 'EXPLOSION_BLAST'
  | 'LASER_HIT'
  | 'POWERUP_PICKUP'
  | 'TRAIL';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type: ParticleType;
  active: boolean;
}

// ==========================================
// 4. Input & Controls
// ==========================================

export interface InputState {
  left: boolean;
  right: boolean;
  launch: boolean;
  fireLaser: boolean;
  pointerX: number | null;
  pointerActive: boolean;
}

export interface GameEngineInputHandler {
  setPointerX(x: number): void;
  handlePrimaryAction(): void;
  handleActionPress?(): void;
  handlePauseToggle?(): void;
}

// ==========================================
// 5. Audio & Sound System
// ==========================================

export type SoundType =
  | 'BOUNCE'
  | 'PADDLE_HIT'
  | 'BRICK_HIT'
  | 'ARMORED_HIT'
  | 'BRICK_SHATTER'
  | 'EXPLOSION'
  | 'LASER_FIRE'
  | 'POWERUP_SPAWN'
  | 'POWERUP_COLLECT'
  | 'BALL_LOST'
  | 'STAGE_CLEAR'
  | 'GAME_OVER'
  | 'VICTORY';

export interface AudioSettings {
  isMuted: boolean;
  volume: number;
  sfxVolume: number;
}

// ==========================================
// 6. Persistence & Leaderboard
// ==========================================

export interface HighScoreEntry {
  id: string;
  name: string;
  score: number;
  level: number;
  date: string;
}

export interface GameSettings {
  sfxVolume: number;
  isMuted: boolean;
  crtFilter: boolean;
  touchControls: boolean;
  mouseSensitivity: number;
}

// ==========================================
// 7. Decoupled Engine Events
// ==========================================

export type GameEngineEvent =
  | { type: 'STATE_CHANGED'; state: Partial<GameHUDState> }
  | { type: 'BRICK_HIT'; brick: Brick; combo: number; points: number }
  | { type: 'POWERUP_COLLECTED'; powerup: PowerupType }
  | { type: 'POWERUP_EXPIRED'; powerup: PowerupType }
  | { type: 'BALL_LOST'; remainingLives: number }
  | { type: 'LEVEL_COMPLETED'; level: number; totalScore: number }
  | { type: 'GAME_OVER'; finalScore: number; isHighScore: boolean }
  | { type: 'VICTORY'; finalScore: number }
  | { type: 'LIVES_CHANGED'; lives: number }
  | { type: 'SCORE_CHANGED'; score: number; multiplier: number }
  | { type: 'SHAKE_SCREEN'; intensity: number }
  | { type: 'PLAY_SOUND'; sound: SoundType; params?: { combo?: number; offsetRatio?: number } };

// ==========================================
// 8. System Contract Interfaces
// ==========================================

export interface ISoundManager {
  init(): Promise<void>;
  playSound(type: SoundType, params?: { combo?: number; offsetRatio?: number }): void;
  playBounce(): void;
  playPaddleHit(offsetRatio: number): void;
  playBrickHit(combo: number): void;
  playArmoredHit(): void;
  playBrickShatter(): void;
  playExplosion(): void;
  playLaserFire(): void;
  playPowerupSpawn(): void;
  playPowerupCollect(type: PowerupType): void;
  playBallLost(): void;
  playStageClear(): void;
  playGameOver(): void;
  playVictory(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
}

export interface IParticleSystem {
  emitBrickBurst(x: number, y: number, color: string, count?: number): void;
  emitExplosion(x: number, y: number, radius?: number): void;
  emitLaserSparks(x: number, y: number): void;
  emitPowerupPickup(x: number, y: number, color: string): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  reset(): void;
}

export interface IScreenShake {
  addTrauma(amount: number): void;
  update(dt: number): void;
  applyTransform(ctx: CanvasRenderingContext2D): void;
  restoreTransform(ctx: CanvasRenderingContext2D): void;
  reset(): void;
}

export interface ILevelLayout {
  levelNumber?: number;
  name: string;
  themeColor?: string;
  matrix: Array<Array<number | null>>;
  specialDrops?: Record<string, PowerupType>;
  author?: string;
}

export interface ITestAPI {
  getHUDState(): GameHUDState;
  getBalls(): Ball[];
  getPaddle(): Paddle;
  getBricks(): Brick[];
  spawnPowerup(type: PowerupType, x?: number, y?: number): void;
  triggerBrickHit(row: number, col: number): void;
  setLives(lives: number): void;
  setLevel(levelNumber: number): void;
  forceStageClear(): void;
  forceGameOver(): void;
}

export interface GameEngine {
  inputManager?: GameEngineInputHandler;
  mountCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D | null): void;
  unmountCanvas(): void;
  handleActionPress?(): void;
  handlePauseToggle?(): void;
  startGame?(): void;
  pauseGame?(): void;
  resumeGame?(): void;
  restartGame?(): void;
  nextLevel?(): void;
  launchBall?(): void;
  fireLaser?(): void;
  destroy?(): void;
}
