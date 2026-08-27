/**
 * @file tests/e2e/helpers/testHarness.ts
 * Deterministic, headless E2E test harness for Arkanoid GameEngine.
 * Provides synchronous fixed-timestep stepping, input simulation, state inspection,
 * and test API bridge integration without reliance on real-time timers.
 */

import { GameEngine, GameEngineOptions } from '@/game/engine/GameEngine';
import { GameHUDState, Ball, Paddle, Brick, PowerupType, LaserProjectile, ISoundManager } from '@/game/types';
import { ParticleSystem } from '@/game/systems/ParticleSystem';
import { ScreenShake } from '@/game/systems/ScreenShake';
import { GameStateStore } from '@/hooks/useGameStateBridge';
import { CANVAS_WIDTH, CANVAS_HEIGHT, FIXED_DT } from '@/game/constants';
import { vi } from 'vitest';

export interface TestHarness {
  engine: GameEngine;
  store: GameStateStore;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mockSoundManager: ISoundManager;
  particleSystem: ParticleSystem;
  screenShake: ScreenShake;

  // Engine lifecycle controls
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  nextLevel: () => void;
  launchBall: () => void;
  fireLaser: () => void;

  // Deterministic simulation stepping
  step: (dt?: number) => void;
  stepFrames: (frames: number, dt?: number) => void;

  // Input simulations
  setPointerX: (x: number | null) => void;
  pressKey: (code: string) => void;
  releaseKey: (code: string) => void;
  triggerPrimaryAction: () => void;

  // State & entity inspection
  getHUDState: () => GameHUDState;
  getPaddle: () => Paddle;
  getBalls: () => Ball[];
  getBricks: () => Brick[];
  getLasers: () => LaserProjectile[];
  getParticleCount: () => number;
  getTrauma: () => number;

  // Direct state / test API manipulation
  spawnPowerup: (type: PowerupType, x?: number, y?: number) => void;
  collectPowerup: (type: PowerupType) => void;
  triggerBrickHit: (row: number, col: number) => void;
  setLives: (lives: number) => void;
  setLevel: (level: number) => void;
  destroyAllBreakables: () => void;
  destroy: () => void;
}

export function createTestHarness(options: Partial<GameEngineOptions> = {}): TestHarness {
  const store = options.stateStore || new GameStateStore();
  const particleSystem = (options.particleSystem as ParticleSystem) || new ParticleSystem();
  const screenShake = (options.screenShake as ScreenShake) || new ScreenShake();

  const mockSoundManager: ISoundManager = {
    init: vi.fn().mockResolvedValue(undefined),
    playSound: vi.fn(),
    playBounce: vi.fn(),
    playPaddleHit: vi.fn(),
    playBrickHit: vi.fn(),
    playArmoredHit: vi.fn(),
    playBrickShatter: vi.fn(),
    playExplosion: vi.fn(),
    playLaserFire: vi.fn(),
    playPowerupSpawn: vi.fn(),
    playPowerupCollect: vi.fn(),
    playBallLost: vi.fn(),
    playStageClear: vi.fn(),
    playGameOver: vi.fn(),
    playVictory: vi.fn(),
    setMuted: vi.fn(),
    setVolume: vi.fn(),
  };

  const engine = new GameEngine({
    stateStore: store,
    soundManager: options.soundManager || mockSoundManager,
    particleSystem,
    screenShake,
  });

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d') || ({} as CanvasRenderingContext2D);

  engine.mountCanvas(canvas, ctx);

  const step = (dt: number = FIXED_DT) => {
    (engine as unknown as { update: (dt: number) => void }).update(dt);
  };

  const stepFrames = (frames: number, dt: number = FIXED_DT) => {
    for (let i = 0; i < frames; i++) {
      step(dt);
    }
  };

  const getHUDState = (): GameHUDState => {
    const testAPI = (window as unknown as { __ARKANOID_TEST_API__?: { getHUDState: () => GameHUDState } }).__ARKANOID_TEST_API__;
    if (testAPI) {
      return testAPI.getHUDState();
    }
    return store.getSnapshot();
  };

  const getPaddle = (): Paddle => {
    return (engine as unknown as { paddle: Paddle }).paddle;
  };

  const getBalls = (): Ball[] => {
    return (engine as unknown as { balls: Ball[] }).balls;
  };

  const getBricks = (): Brick[] => {
    return (engine as unknown as { brickGrid: { getBricks: () => Brick[] } }).brickGrid.getBricks();
  };

  const getLasers = (): LaserProjectile[] => {
    return (engine as unknown as { lasers: LaserProjectile[] }).lasers;
  };

  const getParticleCount = (): number => {
    return particleSystem.getActiveCount();
  };

  const getTrauma = (): number => {
    return screenShake.getTrauma();
  };

  const spawnPowerup = (type: PowerupType, x?: number, y?: number) => {
    const pad = getPaddle();
    (engine as unknown as { powerupManager: { spawnCapsule: (t: PowerupType, px: number, py: number) => void } })
      .powerupManager.spawnCapsule(type, x ?? pad.x + pad.width / 2, y ?? pad.y - 20);
  };

  const collectPowerup = (type: PowerupType) => {
    const ctxObj = (engine as unknown as { getPowerupContext: () => unknown }).getPowerupContext();
    (engine as unknown as { powerupManager: { applyPowerup: (t: PowerupType, c: unknown) => void } })
      .powerupManager.applyPowerup(type, ctxObj);
    (engine as unknown as { syncHUDState: () => void }).syncHUDState();
  };

  const triggerBrickHit = (row: number, col: number) => {
    const testAPI = (window as unknown as { __ARKANOID_TEST_API__?: { triggerBrickHit: (r: number, c: number) => void } }).__ARKANOID_TEST_API__;
    if (testAPI) {
      testAPI.triggerBrickHit(row, col);
    } else {
      const brick = (engine as unknown as { brickGrid: { getBrickAt: (r: number, c: number) => Brick | null } }).brickGrid.getBrickAt(row, col);
      if (brick) {
        (engine as unknown as { brickGrid: { damageBrick: (b: Brick, dmg: number) => void } }).brickGrid.damageBrick(brick, 1);
      }
    }
  };

  const setLives = (lives: number) => {
    const testAPI = (window as unknown as { __ARKANOID_TEST_API__?: { setLives: (n: number) => void } }).__ARKANOID_TEST_API__;
    if (testAPI) {
      testAPI.setLives(lives);
    } else {
      (engine as unknown as { lives: number }).lives = lives;
      (engine as unknown as { syncHUDState: () => void }).syncHUDState();
    }
  };

  const setLevel = (level: number) => {
    const testAPI = (window as unknown as { __ARKANOID_TEST_API__?: { setLevel: (n: number) => void } }).__ARKANOID_TEST_API__;
    if (testAPI) {
      testAPI.setLevel(level);
    }
  };

  const destroyAllBreakables = () => {
    const bricks = getBricks();
    for (const b of bricks) {
      if (b.type !== 'INDESTRUCTIBLE' && b.isAlive) {
        (engine as unknown as { brickGrid: { damageBrick: (brick: Brick, damage: number) => void } }).brickGrid.damageBrick(b, b.maxHits);
      }
    }
  };

  const setPointerX = (x: number | null) => {
    engine.inputManager.setPointerX(x);
  };

  const pressKey = (code: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  };

  const releaseKey = (code: string) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  };

  const triggerPrimaryAction = () => {
    engine.inputManager.handlePrimaryAction();
  };

  return {
    engine,
    store,
    canvas,
    ctx,
    mockSoundManager,
    particleSystem,
    screenShake,
    start: () => engine.startGame(),
    pause: () => engine.pauseGame(),
    resume: () => engine.resumeGame(),
    restart: () => engine.restartGame(),
    nextLevel: () => engine.nextLevel(),
    launchBall: () => engine.launchBall(),
    fireLaser: () => engine.fireLaser(),
    step,
    stepFrames,
    setPointerX,
    pressKey,
    releaseKey,
    triggerPrimaryAction,
    getHUDState,
    getPaddle,
    getBalls,
    getBricks,
    getLasers,
    getParticleCount,
    getTrauma,
    spawnPowerup,
    collectPowerup,
    triggerBrickHit,
    setLives,
    setLevel,
    destroyAllBreakables,
    destroy: () => engine.destroy(),
  };
}
