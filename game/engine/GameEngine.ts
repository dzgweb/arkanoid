/**
 * @file game/engine/GameEngine.ts
 * Master game engine coordinator integrating physics, entities, levels, audio, visual FX, power-up systems, and React bridge.
 */

import {
  GameHUDState,
  GameStatus,
  PowerupType,
  ActivePowerup,
  GameEngineEvent,
  ISoundManager,
  IParticleSystem,
  IScreenShake,
  ITestAPI,
  GameEngine as IGameEngine,
} from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  INITIAL_LIVES,
  TOTAL_LEVELS,
  COMBO_TIMEOUT_MS,
  COMBO_MAX_MULTIPLIER,
  BALL_DEFAULT_RADIUS,
  MAX_PADDLE_BOUNCE_ANGLE,
  SHIELD_Y,
  SHIELD_HEIGHT,
  SHIELD_COLOR,
  SHIELD_GLOW_COLOR,
  TRAUMA_BRICK_HIT,
  TRAUMA_ARMORED_HIT,
  TRAUMA_EXPLOSION,
  TRAUMA_BALL_LOST,
} from '../constants';
import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { Paddle } from '../entities/Paddle';
import { Ball } from '../entities/Ball';
import { Brick } from '../entities/Brick';
import { LaserProjectile } from '../entities/LaserProjectile';
import { BrickGridManager } from '../systems/BrickGridManager';
import { LevelManager } from '../systems/LevelManager';
import { PowerupManager, PowerupContext } from '../systems/PowerupManager';
import { ParticleSystem } from '../systems/ParticleSystem';
import { ScreenShake } from '../systems/ScreenShake';
import { BackgroundRenderer } from '../systems/BackgroundRenderer';
import { FloatingTextSystem } from '../systems/FloatingTextSystem';
import { getSoundManager } from '../audio/SoundManager';
import { GameStateStore } from '@/hooks/useGameStateBridge';

export interface GameEngineOptions {
  stateStore?: GameStateStore;
  soundManager?: ISoundManager;
  particleSystem?: IParticleSystem;
  screenShake?: IScreenShake;
  backgroundRenderer?: BackgroundRenderer;
  floatingTextSystem?: FloatingTextSystem;
}

export class GameEngine implements IGameEngine {
  public inputManager: InputManager;
  private loop: GameLoop;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private stateStore: GameStateStore | null = null;
  private soundManager: ISoundManager | null = null;
  private particleSystem: IParticleSystem | null = null;
  private screenShake: IScreenShake | null = null;
  private backgroundRenderer: BackgroundRenderer;
  private floatingTextSystem: FloatingTextSystem;

  // Entities & Systems
  private paddle: Paddle;
  private balls: Ball[] = [];
  private brickGrid: BrickGridManager;
  private levelManager: LevelManager;
  private powerupManager: PowerupManager;
  private lasers: LaserProjectile[] = [];

  // Engine Lifecycle State
  private status: GameStatus = 'IDLE';
  private score: number = 0;
  private highScore: number = 100000;
  private lives: number = INITIAL_LIVES;
  private combo: number = 0;
  private multiplier: number = 1;
  private comboTimer: number = 0;
  private hasShield: boolean = false;
  private isMuted: boolean = false;
  private volume: number = 0.8;

  private actionUnsub: (() => void) | null = null;

  constructor(options: GameEngineOptions = {}) {
    this.stateStore = options.stateStore || null;
    this.soundManager =
      options.soundManager !== undefined
        ? options.soundManager
        : typeof window !== 'undefined'
        ? getSoundManager()
        : null;
    this.particleSystem = options.particleSystem !== undefined ? options.particleSystem : new ParticleSystem();
    this.screenShake = options.screenShake !== undefined ? options.screenShake : new ScreenShake();
    this.backgroundRenderer = options.backgroundRenderer ?? new BackgroundRenderer(75);
    this.floatingTextSystem = options.floatingTextSystem ?? new FloatingTextSystem(30);

    this.inputManager = new InputManager();
    this.paddle = new Paddle();

    this.powerupManager = new PowerupManager({
      onPowerupCollected: (_type, _capsule) => {
        this.syncHUDState();
      },
      onPowerupExpired: (_type) => {
        this.syncHUDState();
      },
      onActivePowerupsChanged: (_active) => {
        this.syncHUDState();
      },
    });

    this.brickGrid = new BrickGridManager({
      onBrickHit: (brick, pointsAwarded, destroyed) => {
        this.handleBrickHit(brick, false, pointsAwarded, destroyed);
      },
      onExplosionDetonated: (x, y, radiusPx, _chainDepth) => {
        this.soundManager?.playExplosion();
        this.particleSystem?.emitExplosion(x, y, radiusPx);
        this.backgroundRenderer.triggerPulse(0.7);
        this.screenShake?.addTrauma(TRAUMA_EXPLOSION);
      },
      onScreenShake: (trauma) => {
        this.screenShake?.addTrauma(trauma);
      },
      onPowerupSpawn: (type, x, y) => {
        this.powerupManager.spawnCapsule(type, x, y);
        this.soundManager?.playPowerupSpawn();
      },
    });

    this.levelManager = new LevelManager(this.brickGrid);

    this.loop = new GameLoop({
      onUpdate: (dt) => this.update(dt),
      onRender: (alpha) => this.render(alpha),
    });

    this.initListeners();
    this.resetGame();
    this.registerTestAPI();
  }

  private initListeners(): void {
    this.actionUnsub = this.inputManager.onAction((action) => {
      if (action === 'LAUNCH') {
        this.launchBall();
      } else if (action === 'FIRE_LASER') {
        this.fireLaser();
      } else if (action === 'PAUSE_TOGGLE') {
        this.handlePauseToggle();
      }
    });

    if (this.stateStore) {
      this.stateStore.bindActionHandler((action) => {
        switch (action.type) {
          case 'START_GAME':
            this.startGame();
            break;
          case 'PAUSE_GAME':
            this.pauseGame();
            break;
          case 'RESUME_GAME':
            this.resumeGame();
            break;
          case 'RESTART_GAME':
            this.restartGame();
            break;
          case 'NEXT_LEVEL':
            this.nextLevel();
            break;
          case 'LAUNCH_BALL':
            this.launchBall();
            break;
          case 'FIRE_LASER':
            this.fireLaser();
            break;
          case 'TOGGLE_MUTE':
            this.setMuted(!this.isMuted);
            break;
          case 'SET_MUTED':
            this.setMuted(action.muted);
            break;
          case 'SET_VOLUME':
            this.setVolume(action.volume);
            break;
          default:
            break;
        }
      });
    }
  }

  /**
   * Mounts HTML5 canvas and initiates game loop.
   */
  public mountCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D | null): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.inputManager.attach(window);
    this.loop.start();
  }

  /**
   * Unmounts canvas and suspends game loop.
   */
  public unmountCanvas(): void {
    this.loop.stop();
    this.inputManager.detach();
    this.canvas = null;
    this.ctx = null;
  }

  public startGame(): void {
    if (this.status === 'IDLE' || this.status === 'GAME_OVER' || this.status === 'VICTORY') {
      this.resetGame();
    }
    this.status = 'PLAYING';
    this.loop.resume();
    this.syncHUDState();
  }

  public pauseGame(): void {
    if (this.status === 'PLAYING') {
      this.status = 'PAUSED';
      this.loop.pause();
      this.syncHUDState();
    }
  }

  public resumeGame(): void {
    if (this.status === 'PAUSED') {
      this.status = 'PLAYING';
      this.loop.resume();
      this.syncHUDState();
    }
  }

  public restartGame(): void {
    this.resetGame();
    this.status = 'PLAYING';
    this.loop.resume();
    this.syncHUDState();
  }

  public nextLevel(): void {
    const nextResult = this.levelManager.advanceLevel();
    if (nextResult.isVictory || nextResult.hasWon) {
      this.status = 'VICTORY';
      this.emitEvent({ type: 'VICTORY', finalScore: this.score });
      this.soundManager?.playVictory();
    } else {
      this.loadCurrentLevel();
      this.status = 'PLAYING';
      this.loop.resume();
    }
    this.syncHUDState();
  }

  public launchBall(): void {
    if (this.status === 'IDLE') {
      this.startGame();
      return;
    }
    if (this.status !== 'PLAYING') return;

    let launched = false;
    for (const ball of this.balls) {
      if (ball.isStuckToPaddle) {
        ball.launch();
        launched = true;
      }
    }
    if (launched) {
      this.paddle.releaseBall();
      this.soundManager?.playBounce();
    }
  }

  public fireLaser(): void {
    if (this.status !== 'PLAYING' || !this.paddle.hasLasers) return;

    const firedLasers = this.paddle.fireLaser();
    if (firedLasers && firedLasers.length > 0) {
      for (const laser of firedLasers) {
        this.lasers.push(laser);
      }
      this.soundManager?.playLaserFire();
    }
  }

  public handleActionPress(): void {
    if (this.status === 'IDLE') {
      this.startGame();
    } else if (this.status === 'PLAYING') {
      const anyStuck = this.balls.some((b) => b.isStuckToPaddle);
      if (anyStuck) {
        this.launchBall();
      } else if (this.paddle.hasLasers) {
        this.fireLaser();
      }
    }
  }

  public handlePauseToggle(): void {
    if (this.status === 'PLAYING') {
      this.pauseGame();
    } else if (this.status === 'PAUSED') {
      this.resumeGame();
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.soundManager?.setMuted(muted);
    this.syncHUDState();
  }

  public setVolume(volume: number): void {
    this.volume = volume;
    this.soundManager?.setVolume(volume);
    this.syncHUDState();
  }

  public destroy(): void {
    this.unmountCanvas();
    if (this.actionUnsub) {
      this.actionUnsub();
      this.actionUnsub = null;
    }
  }

  // ==========================================
  // Core Physics & Update Pipeline
  // ==========================================

  private getPowerupContext(): PowerupContext {
    return {
      paddle: this.paddle,
      balls: this.balls,
      hasShield: this.hasShield,
      setShield: (active: boolean) => {
        this.hasShield = active;
      },
      emitSound: (sound, params) => {
        this.soundManager?.playSound(sound, params);
      },
      emitParticlePickup: (x, y, color) => {
        this.particleSystem?.emitPowerupPickup(x, y, color);
      },
      emitEvent: (event) => {
        this.emitEvent(event);
      },
    };
  }

  private update(fixedDt: number): void {
    // Background and floating texts update regardless
    this.backgroundRenderer.update(fixedDt);
    this.floatingTextSystem.update(fixedDt);

    if (this.status !== 'PLAYING') return;

    const inputState = this.inputManager.getState();
    const powerupContext = this.getPowerupContext();

    // 1. Update Paddle
    this.paddle.update(fixedDt, inputState, CANVAS_WIDTH);

    // 2. Update Combo Timer
    if (this.comboTimer > 0) {
      this.comboTimer -= fixedDt * 1000;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.multiplier = 1;
        this.emitEvent({ type: 'SCORE_CHANGED', score: this.score, multiplier: this.multiplier });
      }
    }

    // 3. Update Powerup Manager (Capsules, Paddle collision, Timers, Decay)
    this.powerupManager.update(fixedDt, powerupContext, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 4. Update Laser Projectiles
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.update(fixedDt);

      if (!laser.isAlive) {
        this.lasers.splice(i, 1);
        continue;
      }

      // Check collision with brick grid
      const hitResult = this.brickGrid.checkLaserCollision(laser);
      if (hitResult.hit && hitResult.brick) {
        laser.destroy();
        this.brickGrid.damageBrick(hitResult.brick, laser.damage);
        this.particleSystem?.emitLaserSparks(
          laser.x + laser.width / 2,
          hitResult.brick.y + hitResult.brick.height
        );
        this.screenShake?.addTrauma(TRAUMA_BRICK_HIT);
        this.lasers.splice(i, 1);
      }
    }

    // 5. Update Balls & Collision
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      const events = ball.update(fixedDt, this.paddle, this.hasShield);

      if (events.boundaryHit) {
        if (events.boundaryHit === 'shield') {
          this.powerupManager.consumeShield(powerupContext);
          this.soundManager?.playBounce();
        } else if (events.boundaryHit !== 'bottom') {
          this.soundManager?.playBounce();
        }
      }

      if (events.paddleHit) {
        this.soundManager?.playPaddleHit(events.paddleHit.offsetRatio);
      }

      if (events.lost) {
        this.balls.splice(i, 1);
        continue;
      }

      // Check Brick Grid Collision
      if (!ball.isStuckToPaddle) {
        this.brickGrid.checkBallCollisions(ball);
      }
    }

    // 6. Update Systems
    this.brickGrid.update(fixedDt);
    this.particleSystem?.update(fixedDt);
    this.screenShake?.update(fixedDt);

    // 7. Evaluate Life Loss and Stage Clear Conditions
    if (this.balls.length === 0) {
      this.handleBallLoss();
    } else if (this.brickGrid.isLevelClear()) {
      this.handleLevelCleared();
    }
  }

  private handleBrickHit(brick: Brick, _isLaser: boolean, pointsAwarded: number, destroyed: boolean): void {
    if (brick.type === 'ARMORED' && !destroyed) {
      this.soundManager?.playArmoredHit();
      this.screenShake?.addTrauma(TRAUMA_ARMORED_HIT);
    } else if (brick.type === 'EXPLOSIVE') {
      this.soundManager?.playExplosion();
      this.screenShake?.addTrauma(TRAUMA_EXPLOSION);
      this.particleSystem?.emitExplosion(brick.x + brick.width / 2, brick.y + brick.height / 2);
      this.backgroundRenderer.triggerPulse(0.7);
      this.floatingTextSystem.spawnSpecialText(
        brick.x + brick.width / 2,
        brick.y,
        'TNT BLAST!',
        '#f43f5e',
        'rgba(244, 63, 94, 0.9)',
        14
      );
    } else if (destroyed) {
      this.soundManager?.playBrickShatter();
      this.screenShake?.addTrauma(TRAUMA_BRICK_HIT);
      this.particleSystem?.emitBrickBurst(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color);
    } else {
      this.soundManager?.playBrickHit(this.combo);
      this.screenShake?.addTrauma(TRAUMA_BRICK_HIT);
    }

    // Score & Combo calculation
    this.combo++;
    this.multiplier = Math.min(COMBO_MAX_MULTIPLIER, 1 + Math.floor((this.combo - 1) / 3));
    this.comboTimer = COMBO_TIMEOUT_MS;

    const points = pointsAwarded * this.multiplier;
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }

    this.floatingTextSystem.spawnScorePopup(
      brick.x + brick.width / 2,
      brick.y + brick.height / 2,
      pointsAwarded,
      this.multiplier
    );

    this.emitEvent({
      type: 'BRICK_HIT',
      brick: { ...brick },
      combo: this.combo,
      points,
    });

    this.emitEvent({
      type: 'SCORE_CHANGED',
      score: this.score,
      multiplier: this.multiplier,
    });
  }

  private handleBallLoss(): void {
    this.lives--;
    this.combo = 0;
    this.multiplier = 1;
    this.screenShake?.addTrauma(TRAUMA_BALL_LOST);
    this.soundManager?.playBallLost();

    this.emitEvent({ type: 'BALL_LOST', remainingLives: this.lives });
    this.emitEvent({ type: 'LIVES_CHANGED', lives: this.lives });

    if (this.lives <= 0) {
      this.status = 'GAME_OVER';
      this.loop.pause();
      this.emitEvent({
        type: 'GAME_OVER',
        finalScore: this.score,
        isHighScore: this.score > 0,
      });
      this.soundManager?.playGameOver();
    } else {
      this.resetBallToPaddle();
    }
    this.syncHUDState();
  }

  private handleLevelCleared(): void {
    this.status = 'STAGE_CLEAR';
    this.loop.pause();
    this.soundManager?.playStageClear();

    const isLast = this.levelManager.isFinalLevel();
    if (isLast) {
      this.status = 'VICTORY';
      this.emitEvent({ type: 'VICTORY', finalScore: this.score });
      this.soundManager?.playVictory();
    } else {
      this.emitEvent({
        type: 'LEVEL_COMPLETED',
        level: this.levelManager.getCurrentLevelNumber(),
        totalScore: this.score,
      });
    }
    this.syncHUDState();
  }

  private resetGame(): void {
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.combo = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
    this.hasShield = false;
    this.powerupManager.clearAll();
    this.lasers = [];
    this.particleSystem?.reset();
    this.floatingTextSystem.reset();
    this.screenShake?.reset();

    this.levelManager.resetToFirstLevel();
    this.loadCurrentLevel();
  }

  private loadCurrentLevel(): void {
    const layout = this.levelManager.getCurrentLayout();
    this.brickGrid.loadLevel(layout);
    this.paddle.reset(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.resetBallToPaddle();
    this.powerupManager.clearAll();
    this.lasers = [];
    this.hasShield = false;
    this.particleSystem?.reset();
    this.floatingTextSystem.reset();
  }

  private resetBallToPaddle(): void {
    this.balls = [
      new Ball({
        x: this.paddle.x + this.paddle.width / 2,
        y: this.paddle.y - BALL_DEFAULT_RADIUS - 1,
        isStuckToPaddle: true,
        stuckOffsetRatio: 0,
      }),
    ];
    this.paddle.catchBall(this.balls[0]);
  }

  private emitEvent(event: GameEngineEvent): void {
    if (this.stateStore) {
      this.stateStore.emitEvent(event);
    }
  }

  private syncHUDState(): void {
    const hudState: Partial<GameHUDState> = {
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.levelManager.getCurrentLevelNumber(),
      totalLevels: TOTAL_LEVELS,
      multiplier: this.multiplier,
      combo: this.combo,
      status: this.status,
      activePowerups: this.powerupManager.getActivePowerupsList(),
      hasShield: this.hasShield,
      isMuted: this.isMuted,
      volume: this.volume,
    };

    this.emitEvent({ type: 'STATE_CHANGED', state: hudState });
  }

  // ==========================================
  // Render Pipeline
  // ==========================================

  private render(alpha: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();

    // 1. Screen Shake Matrix Transform
    this.screenShake?.applyTransform(ctx);

    // 2. Cosmic Synthwave Parallax Starfield & Horizon Grid Background
    this.backgroundRenderer.render(ctx);

    // 3. Shield Floor
    if (this.hasShield) {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = SHIELD_GLOW_COLOR;
      ctx.fillStyle = SHIELD_COLOR;
      ctx.fillRect(0, SHIELD_Y, CANVAS_WIDTH, SHIELD_HEIGHT);
      ctx.restore();
    }

    // 4. Brick Grid
    this.brickGrid.render(ctx, typeof performance !== 'undefined' ? performance.now() : Date.now());

    // 5. Falling Power-up Capsules
    this.powerupManager.render(ctx, alpha);

    // 6. Laser Projectiles
    for (const laser of this.lasers) {
      laser.render(ctx, alpha);
    }

    // 7. Paddle
    this.paddle.render(ctx, alpha);

    // 8. Sticky Docking Aim Guides
    if (this.paddle.isSticky || this.balls.some((b) => b.isStuckToPaddle)) {
      for (const ball of this.balls) {
        if (ball.isStuckToPaddle) {
          const angle = ball.stuckOffsetRatio * MAX_PADDLE_BOUNCE_ANGLE * 0.8;
          const guideLen = 28;
          const tipX = ball.x + Math.sin(angle) * guideLen;
          const tipY = ball.y - Math.cos(angle) * guideLen;

          ctx.save();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(ball.x, ball.y - ball.radius);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();

          // Aim tip chevron / dot
          ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
          ctx.beginPath();
          ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // 9. Balls
    for (const ball of this.balls) {
      ball.render(ctx, alpha);
    }

    // 10. Particles
    this.particleSystem?.render(ctx);

    // 11. Floating Text Popups
    this.floatingTextSystem.render(ctx, alpha);

    // 12. Restore Screen Shake
    this.screenShake?.restoreTransform(ctx);

    ctx.restore();
  }

  // ==========================================
  // E2E Test Hooks
  // ==========================================

  private registerTestAPI(): void {
    if (typeof window === 'undefined') return;

    const testAPI: ITestAPI = {
      getHUDState: () => ({
        score: this.score,
        highScore: this.highScore,
        lives: this.lives,
        level: this.levelManager.getCurrentLevelNumber(),
        totalLevels: TOTAL_LEVELS,
        multiplier: this.multiplier,
        combo: this.combo,
        status: this.status,
        activePowerups: this.powerupManager.getActivePowerupsList(),
        isMuted: this.isMuted,
        hasShield: this.hasShield,
      }),
      getBalls: () => this.balls,
      getPaddle: () => this.paddle,
      getBricks: () => this.brickGrid.getBricks(),
      spawnPowerup: (type: PowerupType, x?: number, y?: number) => {
        this.powerupManager.spawnCapsule(type, x ?? this.paddle.x + 20, y ?? this.paddle.y);
      },
      triggerBrickHit: (row: number, col: number) => {
        const brick = this.brickGrid.getBrickAt(row, col);
        if (brick) {
          this.brickGrid.damageBrick(brick, 1);
        }
      },
      setLives: (lives: number) => {
        this.lives = lives;
        this.syncHUDState();
      },
      setLevel: (levelNumber: number) => {
        this.levelManager.loadLevel(levelNumber);
        this.loadCurrentLevel();
        this.syncHUDState();
      },
      forceStageClear: () => {
        this.handleLevelCleared();
      },
      forceGameOver: () => {
        this.lives = 0;
        this.handleBallLoss();
      },
    };

    (window as unknown as { __ARKANOID_TEST_API__?: ITestAPI }).__ARKANOID_TEST_API__ = testAPI;
  }
}
