/**
 * @file game/systems/PowerupManager.ts
 * Power-up lifecycle management system: drop probability resolution,
 * falling capsule pooling, paddle AABB collision, active duration timers,
 * mutual exclusion conflict resolution, and bridge event emission.
 */

import {
  PowerupType,
  ActivePowerup,
  GameEngineEvent,
  SoundType,
} from '../types';
import {
  DROP_RATES,
  POWERUP_CONFIGS,
  POWERUP_DURATIONS,
  PADDLE_BASE_WIDTH,
  PADDLE_EXTENDED_WIDTH,
  PADDLE_SHRUNK_WIDTH,
  BALL_INITIAL_SPEED,
  BALL_SLOW_FACTOR,
  BALL_FAST_FACTOR,
  MULTI_BALL_FAN_ANGLE,
  MAX_ACTIVE_BALLS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../constants';
import { PowerupCapsule } from '../entities/PowerupCapsule';
import { Paddle } from '../entities/Paddle';
import { Ball } from '../entities/Ball';
import { Brick } from '../entities/Brick';

export interface PowerupContext {
  paddle: Paddle;
  balls: Ball[];
  hasShield: boolean;
  setShield: (active: boolean) => void;
  spawnBall?: (ball: Ball) => void;
  emitSound?: (type: SoundType, params?: { combo?: number; offsetRatio?: number }) => void;
  emitParticlePickup?: (x: number, y: number, color: string) => void;
  emitEvent?: (event: GameEngineEvent) => void;
}

export interface PowerupManagerCallbacks {
  onPowerupCollected?: (type: PowerupType, capsule: PowerupCapsule) => void;
  onPowerupExpired?: (type: PowerupType) => void;
  onPowerupSpawned?: (capsule: PowerupCapsule) => void;
  onActivePowerupsChanged?: (active: ActivePowerup[]) => void;
}

export class PowerupManager {
  private capsules: PowerupCapsule[] = [];
  private activeTimers: Map<PowerupType, { remainingTimeMs: number; maxTimeMs: number }> = new Map();
  public callbacks: PowerupManagerCallbacks = {};

  constructor(callbacks?: PowerupManagerCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  // ==========================================
  // 1. Drop Generation & Spawning
  // ==========================================

  /**
   * Resolves whether a destroyed brick drops a power-up capsule,
   * checking predetermined level layout drops first, then weighted RNG.
   */
  public resolveBrickDrop(brick: Brick, specialDrop?: PowerupType): PowerupCapsule | null {
    let chosenType: PowerupType | undefined = specialDrop || brick.powerupDrop;

    if (!chosenType) {
      const dropChance = DROP_RATES[brick.type] ?? 0;
      if (dropChance > 0 && Math.random() < dropChance) {
        chosenType = this.rollWeightedDrop();
      }
    }

    if (chosenType) {
      const center = brick.getCenter();
      return this.spawnCapsule(chosenType, center.x, center.y);
    }

    return null;
  }

  /**
   * Selects a powerup type using weighted random probability distribution.
   */
  public rollWeightedDrop(): PowerupType {
    const configs = Object.values(POWERUP_CONFIGS);
    const totalWeight = configs.reduce((sum, cfg) => sum + cfg.weight, 0);
    let randomRoll = Math.random() * totalWeight;

    for (const cfg of configs) {
      if (randomRoll < cfg.weight) {
        return this.normalizeType(cfg.type);
      }
      randomRoll -= cfg.weight;
    }

    return 'MULTI_BALL';
  }

  /**
   * Instantiates and registers a falling PowerupCapsule entity.
   */
  public spawnCapsule(type: PowerupType, x: number, y: number): PowerupCapsule {
    const canonicalType = this.normalizeType(type);
    const capsule = new PowerupCapsule({
      type: canonicalType,
      x: x - 16, // Center 32px width on spawn coordinates
      y: y - 8,  // Center 16px height on spawn coordinates
    });

    this.capsules.push(capsule);

    if (this.callbacks.onPowerupSpawned) {
      this.callbacks.onPowerupSpawned(capsule);
    }

    return capsule;
  }

  // ==========================================
  // 2. Fixed-Timestep Update Pipeline
  // ==========================================

  /**
   * Updates falling capsules kinematics, evaluates paddle collision,
   * decrements active duration timers, and handles expiration.
   */
  public update(
    dt: number,
    context: PowerupContext,
    canvasWidth: number = CANVAS_WIDTH,
    canvasHeight: number = CANVAS_HEIGHT
  ): void {
    const paddleBounds = context.paddle.getBoundingBox();

    // 1. Update falling capsules & test paddle collision
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const capsule = this.capsules[i];
      const status = capsule.update(dt, canvasHeight);

      if (capsule.checkCollision(paddleBounds)) {
        this.collectCapsule(capsule, context);
        this.capsules.splice(i, 1);
        continue;
      }

      if (status.outOfBounds || !capsule.isAlive) {
        this.capsules.splice(i, 1);
      }
    }

    // 2. Decrement active timers
    let timersChanged = false;
    const expiredList: PowerupType[] = [];

    this.activeTimers.forEach((data, type) => {
      if (data.remainingTimeMs > 0) {
        data.remainingTimeMs -= dt * 1000;
        if (data.remainingTimeMs <= 0) {
          expiredList.push(type);
        }
      }
    });

    for (const expiredType of expiredList) {
      this.removePowerup(expiredType, context);
      timersChanged = true;
    }

    if (timersChanged && this.callbacks.onActivePowerupsChanged) {
      this.callbacks.onActivePowerupsChanged(this.getActivePowerupsList());
    }
  }

  // ==========================================
  // 3. Collection & Conflict Resolution
  // ==========================================

  /**
   * Handles capsule collection upon paddle contact.
   */
  public collectCapsule(capsule: PowerupCapsule, context: PowerupContext): void {
    const type = this.normalizeType(capsule.type);
    const center = capsule.getCenter(true);

    // Visual & audio feedback
    context.emitParticlePickup?.(center.x, center.y, capsule.color);
    context.emitSound?.('POWERUP_COLLECT');

    // Apply mechanics
    this.applyPowerup(type, context);

    if (this.callbacks.onPowerupCollected) {
      this.callbacks.onPowerupCollected(type, capsule);
    }

    context.emitEvent?.({ type: 'POWERUP_COLLECTED', powerup: type });

    if (this.callbacks.onActivePowerupsChanged) {
      this.callbacks.onActivePowerupsChanged(this.getActivePowerupsList());
    }
  }

  /**
   * Applies power-up mechanics with mutual exclusion stacking resolution.
   */
  public applyPowerup(rawType: PowerupType, context: PowerupContext): void {
    const type = this.normalizeType(rawType);
    const duration = POWERUP_DURATIONS[type] ?? 0;

    // Resolve Mutual Exclusion Stacking Conflicts
    if (type === 'EXTEND') {
      if (this.activeTimers.has('SHRINK')) {
        this.removePowerup('SHRINK', context);
      }
    } else if (type === 'SHRINK') {
      if (this.activeTimers.has('EXTEND')) {
        this.removePowerup('EXTEND', context);
      }
    } else if (type === 'SLOW') {
      if (this.activeTimers.has('FAST')) {
        this.removePowerup('FAST', context);
      }
    } else if (type === 'FAST') {
      if (this.activeTimers.has('SLOW')) {
        this.removePowerup('SLOW', context);
      }
    }

    // Execute specific power-up mechanics
    switch (type) {
      case 'MULTI_BALL':
        this.executeMultiBall(context);
        return; // Instantaneous, no timer

      case 'EXTEND':
        context.paddle.setWidth(PADDLE_EXTENDED_WIDTH);
        break;

      case 'SHRINK':
        context.paddle.setWidth(PADDLE_SHRUNK_WIDTH);
        break;

      case 'LASER':
        context.paddle.setLasers(true, duration);
        break;

      case 'STICKY':
        context.paddle.setSticky(true);
        break;

      case 'SLOW':
        for (const ball of context.balls) {
          ball.applySpeedModifier(BALL_SLOW_FACTOR);
        }
        break;

      case 'FAST':
        for (const ball of context.balls) {
          ball.applySpeedModifier(BALL_FAST_FACTOR);
        }
        break;

      case 'SHIELD':
        context.setShield(true);
        break;
    }

    // Register / Refresh duration timer
    if (duration > 0) {
      this.activeTimers.set(type, {
        remainingTimeMs: duration,
        maxTimeMs: duration,
      });
    }
  }

  /**
   * Reverts specific power-up mechanics upon expiration or override.
   */
  public removePowerup(rawType: PowerupType, context: PowerupContext): void {
    const type = this.normalizeType(rawType);
    this.activeTimers.delete(type);

    switch (type) {
      case 'EXTEND':
      case 'SHRINK':
        context.paddle.setWidth(context.paddle.baseWidth);
        break;

      case 'LASER':
        context.paddle.setLasers(false);
        break;

      case 'STICKY':
        context.paddle.setSticky(false);
        context.paddle.releaseHeldBalls();
        break;

      case 'SLOW':
      case 'FAST':
        for (const ball of context.balls) {
          ball.setSpeed(BALL_INITIAL_SPEED);
        }
        break;

      case 'SHIELD':
        context.setShield(false);
        break;
    }

    if (this.callbacks.onPowerupExpired) {
      this.callbacks.onPowerupExpired(type);
    }

    context.emitEvent?.({ type: 'POWERUP_EXPIRED', powerup: type });
  }

  /**
   * Multi-Ball Cloning: duplicates active balls with diverging fan angles (+/- 25 deg).
   */
  private executeMultiBall(context: PowerupContext): void {
    const currentBalls = [...context.balls];

    // Auto-launch any caught balls first
    for (const b of currentBalls) {
      if (b.isStuckToPaddle) {
        b.launch();
      }
    }
    context.paddle.releaseBall();

    for (const b of currentBalls) {
      if (context.balls.length >= MAX_ACTIVE_BALLS) break;

      const currentAngle = Math.atan2(b.vx, -b.vy);
      const speed = b.speed > 0 ? b.speed : BALL_INITIAL_SPEED;

      // Clone 1 (-25 deg)
      const targetAngle1 = currentAngle - MULTI_BALL_FAN_ANGLE;
      const b1 = new Ball({
        x: b.x,
        y: b.y,
        speed,
        radius: b.radius,
        color: b.color,
        glowColor: b.glowColor,
        isStuckToPaddle: false,
        vx: speed * Math.sin(targetAngle1),
        vy: -speed * Math.cos(targetAngle1),
      });
      context.balls.push(b1);

      if (context.balls.length >= MAX_ACTIVE_BALLS) break;

      // Clone 2 (+25 deg)
      const targetAngle2 = currentAngle + MULTI_BALL_FAN_ANGLE;
      const b2 = new Ball({
        x: b.x,
        y: b.y,
        speed,
        radius: b.radius,
        color: b.color,
        glowColor: b.glowColor,
        isStuckToPaddle: false,
        vx: speed * Math.sin(targetAngle2),
        vy: -speed * Math.cos(targetAngle2),
      });
      context.balls.push(b2);
    }
  }

  /**
   * Consumes active shield when a ball bounces on bottom energy barrier.
   */
  public consumeShield(context: PowerupContext): void {
    if (this.activeTimers.has('SHIELD') || context.hasShield) {
      this.removePowerup('SHIELD', context);
      if (this.callbacks.onActivePowerupsChanged) {
        this.callbacks.onActivePowerupsChanged(this.getActivePowerupsList());
      }
    }
  }

  // ==========================================
  // 4. Lifecycle & State Management
  // ==========================================

  /**
   * Resets all falling capsules and clears active timers.
   */
  public clearAll(context?: PowerupContext): void {
    if (context) {
      const activeTypes = Array.from(this.activeTimers.keys());
      for (const type of activeTypes) {
        this.removePowerup(type, context);
      }
    } else {
      this.activeTimers.clear();
    }

    this.capsules = [];

    if (this.callbacks.onActivePowerupsChanged) {
      this.callbacks.onActivePowerupsChanged([]);
    }
  }

  /**
   * Normalizes power-up type aliases to canonical enum values.
   */
  public normalizeType(type: PowerupType): PowerupType {
    switch (type) {
      case 'EXTEND_PADDLE':
        return 'EXTEND';
      case 'SHRINK_PADDLE':
        return 'SHRINK';
      case 'LASER_PADDLE':
        return 'LASER';
      case 'SLOW_BALL':
        return 'SLOW';
      case 'FAST_BALL':
        return 'FAST';
      case 'STICKY_PADDLE':
        return 'STICKY';
      default:
        return type;
    }
  }

  /**
   * Returns snapshot array of currently active power-ups for HUD synchronization.
   */
  public getActivePowerupsList(): ActivePowerup[] {
    const list: ActivePowerup[] = [];
    this.activeTimers.forEach((data, type) => {
      list.push({
        type,
        remainingTimeMs: Math.max(0, data.remainingTimeMs),
        maxTimeMs: data.maxTimeMs,
      });
    });
    return list;
  }

  public isPowerupActive(type: PowerupType): boolean {
    return this.activeTimers.has(this.normalizeType(type));
  }

  public getRemainingTime(type: PowerupType): number {
    const data = this.activeTimers.get(this.normalizeType(type));
    return data ? Math.max(0, data.remainingTimeMs) : 0;
  }

  public getCapsules(): PowerupCapsule[] {
    return this.capsules;
  }

  // ==========================================
  // 5. Canvas 2D Rendering
  // ==========================================

  /**
   * Renders all active falling capsules with sub-frame interpolation.
   */
  public render(ctx: CanvasRenderingContext2D, alpha: number = 1.0): void {
    for (const capsule of this.capsules) {
      capsule.render(ctx, alpha);
    }
  }
}
