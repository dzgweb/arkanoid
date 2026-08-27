/**
 * @file game/systems/ParticleSystem.ts
 * High-performance Zero-GC particle physics emitter with a pre-allocated 350-particle pool.
 * Supports brick shatter bursts, TNT blast waves, laser impact sparks, and power-up sparkles
 * with velocity decay (0.96), gravity (120 px/s^2), rotational tumbling, and sub-frame interpolation.
 */

import { IParticleSystem, ParticleType } from '../types';
import {
  PARTICLE_POOL_SIZE,
  PARTICLE_BRICK_BURST_COUNT,
  PARTICLE_EXPLOSION_COUNT,
  PARTICLE_LASER_SPARKS_COUNT,
  PARTICLE_PICKUP_COUNT,
} from '../constants';

export interface ParticleSlot {
  active: boolean;
  type: ParticleType;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  size: number;
  initialSize: number;
  targetSize: number;
  rotation: number;
  vRot: number;
  color: string;
  glowColor: string;
  alpha: number;
  baseAlpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  shape: 'RECT' | 'CIRCLE' | 'RING' | 'STAR';
}

export class ParticleSystem implements IParticleSystem {
  private pool: ParticleSlot[];
  private poolSize: number;
  private nextFreeIndex: number = 0;

  constructor(poolSize: number = PARTICLE_POOL_SIZE) {
    this.poolSize = poolSize;
    this.pool = new Array(poolSize);

    for (let i = 0; i < poolSize; i++) {
      this.pool[i] = {
        active: false,
        type: 'BRICK_DEBRIS',
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: 0,
        size: 4,
        initialSize: 4,
        targetSize: 4,
        rotation: 0,
        vRot: 0,
        color: '#ffffff',
        glowColor: 'rgba(255, 255, 255, 0.6)',
        alpha: 1,
        baseAlpha: 1,
        life: 0,
        maxLife: 1,
        gravity: 120,
        drag: 0.96,
        shape: 'RECT',
      };
    }
  }

  /**
   * Acquires a particle slot from the pre-allocated pool without GC overhead.
   * If the pool is exhausted, reclaims the slot with the least remaining life.
   */
  private acquireSlot(): ParticleSlot {
    // 1. Fast linear scan starting from nextFreeIndex
    for (let i = 0; i < this.poolSize; i++) {
      const idx = (this.nextFreeIndex + i) % this.poolSize;
      if (!this.pool[idx].active) {
        this.nextFreeIndex = (idx + 1) % this.poolSize;
        return this.pool[idx];
      }
    }

    // 2. Pool full: Reclaim slot with smallest remaining life
    let bestSlot = this.pool[0];
    let minLife = bestSlot.life;
    for (let i = 1; i < this.poolSize; i++) {
      const slot = this.pool[i];
      if (slot.life < minLife) {
        minLife = slot.life;
        bestSlot = slot;
      }
    }

    return bestSlot;
  }

  // ==========================================
  // Emitter 1: Brick Shatter Burst
  // ==========================================
  public emitBrickBurst(
    x: number,
    y: number,
    color: string,
    count: number = PARTICLE_BRICK_BURST_COUNT
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireSlot();
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 120 + Math.random() * 200; // 120 - 320 px/s
      const size = 3 + Math.random() * 3.5;
      const life = 0.4 + Math.random() * 0.35; // 0.4 - 0.75 s

      p.active = true;
      p.type = 'BRICK_DEBRIS';
      p.shape = 'RECT';
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y + (Math.random() - 0.5) * 10;
      p.prevX = p.x;
      p.prevY = p.y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 40; // Slight upward bias
      p.size = size;
      p.initialSize = size;
      p.targetSize = size * 0.5;
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 12; // Tumbling rotation
      p.color = color;
      p.glowColor = color;
      p.baseAlpha = 1.0;
      p.alpha = 1.0;
      p.life = life;
      p.maxLife = life;
      p.gravity = 120; // 120 px/s^2
      p.drag = 0.96;
    }
  }

  // ==========================================
  // Emitter 2: Explosive TNT Blast Wave
  // ==========================================
  public emitExplosion(x: number, y: number, radius: number = 90): void {
    // A. Expanding Shockwave Ring (1 Entity)
    const ring = this.acquireSlot();
    ring.active = true;
    ring.type = 'EXPLOSION_BLAST';
    ring.shape = 'RING';
    ring.x = x;
    ring.y = y;
    ring.prevX = x;
    ring.prevY = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.size = 8;
    ring.initialSize = 8;
    ring.targetSize = radius;
    ring.rotation = 0;
    ring.vRot = 0;
    ring.color = '#fef08a'; // Bright yellow neon
    ring.glowColor = '#facc15';
    ring.baseAlpha = 0.9;
    ring.alpha = 0.9;
    ring.life = 0.3;
    ring.maxLife = 0.3;
    ring.gravity = 0;
    ring.drag = 1.0;

    // B. High-Velocity Incandescent Fire Embers (26 Particles)
    const emberColors = ['#f43f5e', '#f97316', '#fbbf24', '#ffffff', '#ef4444'];
    const emberCount = 26;
    for (let i = 0; i < emberCount; i++) {
      const p = this.acquireSlot();
      const angle = Math.random() * Math.PI * 2;
      const speed = 180 + Math.random() * 340; // 180 - 520 px/s
      const size = 3 + Math.random() * 4;
      const life = 0.35 + Math.random() * 0.4;
      const color = emberColors[Math.floor(Math.random() * emberColors.length)];

      p.active = true;
      p.type = 'EXPLOSION_BLAST';
      p.shape = 'CIRCLE';
      p.x = x;
      p.y = y;
      p.prevX = x;
      p.prevY = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = size;
      p.initialSize = size;
      p.targetSize = 1;
      p.rotation = 0;
      p.vRot = 0;
      p.color = color;
      p.glowColor = color;
      p.baseAlpha = 1.0;
      p.alpha = 1.0;
      p.life = life;
      p.maxLife = life;
      p.gravity = 120;
      p.drag = 0.94;
    }

    // C. Billowing Smoke Puffs (14 Particles)
    const smokeCount = 14;
    for (let i = 0; i < smokeCount; i++) {
      const p = this.acquireSlot();
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      const life = 0.5 + Math.random() * 0.45;

      p.active = true;
      p.type = 'EXPLOSION_BLAST';
      p.shape = 'CIRCLE';
      p.x = x + (Math.random() - 0.5) * 16;
      p.y = y + (Math.random() - 0.5) * 16;
      p.prevX = p.x;
      p.prevY = p.y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 30; // Buoyant lift
      p.size = 5;
      p.initialSize = 5;
      p.targetSize = 18;
      p.rotation = 0;
      p.vRot = 0;
      p.color = 'rgba(100, 116, 139, 0.45)'; // Slate smoke
      p.glowColor = 'rgba(71, 85, 105, 0.3)';
      p.baseAlpha = 0.5;
      p.alpha = 0.5;
      p.life = life;
      p.maxLife = life;
      p.gravity = -25; // Negative gravity / buoyancy
      p.drag = 0.92;
    }
  }

  // ==========================================
  // Emitter 3: Laser Impact Sparks
  // ==========================================
  public emitLaserSparks(
    x: number,
    y: number,
    count: number = PARTICLE_LASER_SPARKS_COUNT
  ): void {
    const laserColors = ['#f43f5e', '#fda4af', '#ffffff', '#fb7185'];
    for (let i = 0; i < count; i++) {
      const p = this.acquireSlot();
      // Downward deflection cone [30 deg to 150 deg]
      const angle = (30 + Math.random() * 120) * (Math.PI / 180);
      const speed = 160 + Math.random() * 220; // 160 - 380 px/s
      const size = 2 + Math.random() * 2.5;
      const life = 0.15 + Math.random() * 0.2;
      const color = laserColors[Math.floor(Math.random() * laserColors.length)];

      p.active = true;
      p.type = 'LASER_HIT';
      p.shape = 'CIRCLE';
      p.x = x + (Math.random() - 0.5) * 6;
      p.y = y;
      p.prevX = p.x;
      p.prevY = p.y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = size;
      p.initialSize = size;
      p.targetSize = 1;
      p.rotation = 0;
      p.vRot = 0;
      p.color = color;
      p.glowColor = color;
      p.baseAlpha = 1.0;
      p.alpha = 1.0;
      p.life = life;
      p.maxLife = life;
      p.gravity = 120;
      p.drag = 0.95;
    }
  }

  // ==========================================
  // Emitter 4: Power-up Collection Sparkles
  // ==========================================
  public emitPowerupPickup(
    x: number,
    y: number,
    color: string,
    count: number = PARTICLE_PICKUP_COUNT
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireSlot();
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 80 + Math.random() * 150;
      const size = 3 + Math.random() * 3;
      const life = 0.45 + Math.random() * 0.35;

      p.active = true;
      p.type = 'POWERUP_PICKUP';
      p.shape = 'STAR';
      p.x = x;
      p.y = y;
      p.prevX = x;
      p.prevY = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 50; // Upward drift
      p.size = size;
      p.initialSize = size;
      p.targetSize = size * 0.3;
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 8;
      p.color = Math.random() > 0.3 ? color : '#ffffff';
      p.glowColor = color;
      p.baseAlpha = 1.0;
      p.alpha = 1.0;
      p.life = life;
      p.maxLife = life;
      p.gravity = 30; // Gentle float
      p.drag = 0.96;
    }
  }

  // ==========================================
  // Simulation Update Loop (Fixed dt = 1/60s)
  // ==========================================
  public update(dt: number): void {
    const dtFactor = dt / (1 / 60);

    for (let i = 0; i < this.poolSize; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // Record previous coordinates for sub-frame interpolation
      p.prevX = p.x;
      p.prevY = p.y;

      // Kinematic Drag
      const currentDrag = Math.pow(p.drag, dtFactor);
      p.vx *= currentDrag;
      p.vy = (p.vy + p.gravity * dt) * currentDrag;

      // Position update
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;

      // Normalized lifetime progress [1.0 -> 0.0]
      const progress = Math.max(0, p.life / p.maxLife);
      p.alpha = Math.pow(progress, 1.1) * p.baseAlpha;
      p.size = p.targetSize + (p.initialSize - p.targetSize) * progress;
    }
  }

  // ==========================================
  // Render Pipeline
  // ==========================================
  public render(ctx: CanvasRenderingContext2D, alpha: number = 1.0): void {
    ctx.save();

    for (let i = 0; i < this.poolSize; i++) {
      const p = this.pool[i];
      if (!p.active || p.alpha <= 0.01) continue;

      // Sub-frame interpolated coordinates
      const renderX = p.prevX + (p.x - p.prevX) * alpha;
      const renderY = p.prevY + (p.y - p.prevY) * alpha;

      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

      if (p.shape === 'RECT') {
        ctx.save();
        ctx.translate(renderX, renderY);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.shape === 'CIRCLE') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(renderX, renderY, Math.max(0.5, p.size / 2), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'RING') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 4 * (p.life / p.maxLife));
        ctx.beginPath();
        ctx.arc(renderX, renderY, Math.max(1, p.size), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'STAR') {
        // 4-point sparkle diamond
        ctx.save();
        ctx.translate(renderX, renderY);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.3, -s * 0.3);
        ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.3, s * 0.3);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.3, s * 0.3);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.3, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * Resets all particles to inactive state and resets pointer.
   */
  public reset(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.pool[i].active = false;
      this.pool[i].life = 0;
    }
    this.nextFreeIndex = 0;
  }

  /**
   * Returns current count of active particles (for unit test verification).
   */
  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.poolSize; i++) {
      if (this.pool[i].active) count++;
    }
    return count;
  }

  /**
   * Returns pool capacity.
   */
  public getPoolCapacity(): number {
    return this.poolSize;
  }
}
