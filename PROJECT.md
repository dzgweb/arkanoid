# Project: Arkanoid Retro Arcade Web Application

## Architecture
- **Framework & Runtime**: Next.js (App Router), React 18/19, TypeScript (strict mode), Tailwind CSS for retro neon styling.
- **Game Engine**: HTML5 Canvas 2D engine with a fixed-timestep physics loop (`fixedDt = 1/60s`) and sub-frame alpha interpolation decoupled from React rendering.
- **Rendering & Coordinates**: Logical internal resolution $800 \times 700$ with auto-letterboxed/pillarboxed responsive canvas container scaling across desktop and mobile.
- **State Bridge**: 2-tier decoupled architecture (`GameEngine` event emitter $\rightarrow$ `useGameStateBridge` external store) ensuring zero React reconciliation overhead on 60 FPS animation frames while keeping React HUD and modals in sync.
- **Audio Engine**: Zero-dependency procedural Web Audio API synthesizer generating 12 distinct 8-bit/16-bit arcade sound effects with ADSR envelopes and dynamic combo pitch scaling.
- **Visual FX**: Pre-allocated zero-GC 350-particle pool for brick bursts, spark trails, and explosive detonations; quadratic trauma screen shake with exponential decay; retro neon bloom and CRT scanline styling.
- **Persistence**: SSR-safe versioned `localStorage` storage for high scores, achievements, and user audio/control preferences.
- **Testing**: Vitest (`jsdom` + `vitest-canvas-mock`) for pure math/physics and React UI unit tests, plus deterministic `window.__ARKANOID_TEST_API__` test hooks for automated E2E testing.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Next.js App Router & React Shell | Next.js App Router, TypeScript configuration, Tailwind CSS, Lucide icons, responsive container | M1 | R4 |
| 2 | Decoupled Game State Bridge | Event-driven bridge connecting Canvas engine to React HUD without per-frame React re-renders | M1 | R1, R4 |
| 3 | React HUD & Modal Overlays | Score, High Score, Level, Lives counter, Multiplier, Start, Pause, GameOver, StageClear modals | M1 | R1, R4 |
| 4 | LocalStorage High Scores & Settings | SSR-safe versioned high scores board with initials and sound/controls settings | M1 | R1 |
| 5 | 60 FPS Canvas Game Loop | Fixed-timestep accumulator loop (`fixedDt = 1/60s`) with max frame clamping for deterministic physics | M2 | R1 |
| 6 | Fluid Paddle Controls | Keyboard (Arrow keys / A-D), Mouse movement, Touch gestures with boundary clamping | M2 | R1 |
| 7 | Continuous 2D Ball Physics | Circle-to-AABB collision detection with sub-stepping ($N \le 4$) to eliminate tunneling | M2 | R1 |
| 8 | Dynamic Angle Paddle Reflection | Impact offset mapped to $[-75^\circ, +75^\circ]$ exit angles with tangential velocity transfer | M2 | R1 |
| 9 | Multi-Tier Brick Grid | Standard (1-hit), Armored (2-3 hits with cracks), Indestructible (silver/gold), Explosive (3x3 cascade) | M2 | R1 |
| 10 | 6 Progressive Level Layouts | 6 distinct 12x14 level matrices with geometric themes and progressive challenge | M2 | R3 |
| 11 | Power-up Drop & Collect System | Kinematic capsule drops ($v_y = 150\text{ px/s}$), wobble animation, paddle AABB collision | M3 | R2 |
| 12 | Multi-Ball Power-up | Splits active balls into 3 balls with diverging angles ($\pm 25^\circ$) | M3 | R2 |
| 13 | Laser Paddle Power-up | Twin laser blasters on paddle edges, firing dual projectiles ($220\text{ms}$ cooldown) to destroy bricks | M3 | R2 |
| 14 | Extended / Shrink Paddle | Expands paddle width by $+50\%$ or penalty shrink by $-30\%$ with active duration timers | M3 | R2 |
| 15 | Slow Ball / Fast Ball | Dynamic velocity scaling ($0.7\times$ slow, $1.3\times$ speed) with smooth transitions | M3 | R2 |
| 16 | Sticky / Catch Paddle | Catches ball on paddle impact and holds until player presses Spacebar / clicks to launch | M3 | R2 |
| 17 | Shield Floor Barrier | Energy barrier at bottom of canvas ($y = 692$) that bounces lost balls once before dissipating | M3 | R2 |
| 18 | Power-up Timers & HUD Badges | Active power-up duration countdowns and visual badge display on HUD | M3 | R2 |
| 19 | Web Audio API Synth | Zero-dependency procedural synthesizer producing 12 arcade SFX with combo pitch scaling | M4 | R3 |
| 20 | Particle Explosion System | Zero-GC 350-particle pool for brick shatter bursts, spark trails, and TNT blast waves | M4 | R3 |
| 21 | Quadratic Trauma Screen Shake | Screen shake with trauma accumulation ($\text{Intensity} = \text{Trauma}^2$) and $1.8\text{ s}^{-1}$ decay | M4 | R3 |
| 22 | Retro Arcade Visuals & Polish | Neon bloom glows, animated grid background, optional CRT scanline overlay, combo popup text | M4 | R3 |
| 23 | Level Progression & Transitions | Seamless stage clear fanfare, level advance, bonus calculation, game over reset flow | M4 | R1, R3 |
| 24 | Mobile Touch Controls & Virtual D-Pad | Touch drag paddle tracking, tap-to-fire lasers / tap-to-launch ball, responsive scaling | M5 | R1, R4 |
| 25 | Comprehensive Unit & Math Tests | Vitest test suites for collision math, reflection angles, powerup durations, state transitions | M5 | R4 |
| 26 | Production Build & Lint Verification | Zero TypeScript errors, zero lint warnings, optimized production bundle | M5 | R4 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Next.js Project Foundation & React UI Shell | Next.js App Router, Tailwind CSS, TypeScript setup, Canvas container, HUD, Modal overlays, decoupled State Bridge, LocalStorage high scores | none | DONE |
| M2 | 2D Physics Engine, Paddle & Multi-Tier Bricks | Fixed-timestep Canvas loop, circle-AABB continuous collision with substepping, paddle reflection math, 4 brick types, 6 level layouts | M1 | PLANNED |
| M3 | Collectible Power-ups & Dynamic Mechanics | Power-up capsule drops, 7 power-up types (Multi-Ball, Laser, Extend, Shrink, Slow, Sticky, Shield), laser projectile physics, timers & HUD badges | M2 | PLANNED |
| M4 | Audio Synth, Particles, Screen Shake & FX Polish | Web Audio API procedural synth (12 SFX), 350-particle emitter system, quadratic screen shake, neon visual effects, level transitions & score multiplier | M3 | PLANNED |
| M5 | E2E Testing, Mobile Controls & Production Verification | Comprehensive Vitest unit tests, test API bridge, responsive touch controls, clean `npm run build` verification | M4 | PLANNED |

---

## Interface Contracts

### 1. `GameEngine` $\leftrightarrow$ React UI Bridge (`useGameStateBridge`)
```typescript
export interface GameHUDState {
  score: number;
  highScore: number;
  lives: number;
  level: number;
  totalLevels: number;
  multiplier: number;
  status: 'IDLE' | 'PLAYING' | 'PAUSED' | 'STAGE_CLEAR' | 'GAME_OVER' | 'VICTORY';
  activePowerups: Array<{ type: PowerupType; remainingTimeMs: number; maxTimeMs: number }>;
  isMuted: boolean;
}

export type GameEngineEvent =
  | { type: 'STATE_CHANGED'; state: Partial<GameHUDState> }
  | { type: 'BRICK_HIT'; brick: Brick; combo: number; points: number }
  | { type: 'POWERUP_COLLECTED'; powerup: PowerupType }
  | { type: 'POWERUP_EXPIRED'; powerup: PowerupType }
  | { type: 'BALL_LOST'; remainingLives: number }
  | { type: 'LEVEL_COMPLETED'; level: number; totalScore: number }
  | { type: 'GAME_OVER'; finalScore: number; isHighScore: boolean };
```

### 2. `GameEngine` $\leftrightarrow$ `PhysicsEngine` & `BrickGridManager`
```typescript
export interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  isStuckToPaddle: boolean;
  stuckOffsetRatio: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  baseWidth: number;
  vx: number;
  hasLasers: boolean;
  laserCooldownMs: number;
  isSticky: boolean;
  color: string;
}

export interface Brick {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'STANDARD' | 'ARMORED' | 'INDESTRUCTIBLE' | 'EXPLOSIVE';
  maxHits: number;
  currentHits: number;
  color: string;
  points: number;
  powerupDrop?: PowerupType;
  isAlive: boolean;
}
```

### 3. `GameEngine` $\leftrightarrow$ `SoundManager` & `ParticleSystem`
```typescript
export interface ISoundManager {
  init(): Promise<void>;
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
}
```

---

## Code Layout
```
/Users/dweb/React+Next/arkanoid/
├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── GameContainer.tsx
│   ├── CanvasStage.tsx
│   ├── HUD/
│   │   ├── ScoreBoard.tsx
│   │   ├── LivesDisplay.tsx
│   │   ├── LevelIndicator.tsx
│   │   ├── ComboMultiplier.tsx
│   │   └── PowerupBadges.tsx
│   ├── Modals/
│   │   ├── StartScreenModal.tsx
│   │   ├── PauseModal.tsx
│   │   ├── StageClearModal.tsx
│   │   ├── GameOverModal.tsx
│   │   └── HighScoresModal.tsx
│   ├── Controls/
│   │   └── TouchControls.tsx
│   └── AudioControls.tsx
├── game/
│   ├── constants.ts
│   ├── types.ts
│   ├── engine/
│   │   ├── GameEngine.ts
│   │   ├── GameLoop.ts
│   │   └── InputManager.ts
│   ├── physics/
│   │   ├── CollisionSystem.ts
│   │   ├── PaddlePhysics.ts
│   │   └── MathUtils.ts
│   ├── entities/
│   │   ├── Ball.ts
│   │   ├── Paddle.ts
│   │   ├── Brick.ts
│   │   ├── LaserProjectile.ts
│   │   └── PowerupCapsule.ts
│   ├── systems/
│   │   ├── BrickGridManager.ts
│   │   ├── PowerupManager.ts
│   │   ├── ParticleSystem.ts
│   │   ├── ScreenShake.ts
│   │   └── LevelManager.ts
│   ├── levels/
│   │   ├── level1.ts
│   │   ├── level2.ts
│   │   ├── level3.ts
│   │   ├── level4.ts
│   │   ├── level5.ts
│   │   ├── level6.ts
│   │   └── index.ts
│   └── audio/
│       ├── SoundSynth.ts
│       └── SoundManager.ts
├── hooks/
│   ├── useGameStateBridge.ts
│   ├── useLocalStorage.ts
│   ├── useAudio.ts
│   └── useWindowDimensions.ts
├── utils/
│   ├── storage.ts
│   └── highScores.ts
├── tests/
│   ├── unit/
│   │   ├── collision.test.ts
│   │   ├── paddle-reflection.test.ts
│   │   ├── powerups.test.ts
│   │   ├── level-manager.test.ts
│   │   └── high-scores.test.ts
│   ├── components/
│   │   ├── HUD.test.tsx
│   │   └── Modals.test.tsx
│   └── e2e/
│       └── gameplay.test.ts
├── vitest.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```
