/**
 * @file tests/unit/adversarial-m4-fx-challenger.test.ts
 * Comprehensive Empirical Adversarial Stress & Verification Suite by Challenger M4-2
 * Focus Areas:
 * 1. ParticleSystem:
 *    - Zero-GC 350-particle pool capacity invariance
 *    - 1,000 to 10,000 rapid sequential and concurrent emission requests
 *    - Oldest-slot (least remaining life) reclamation under full capacity
 *    - Kinematic drag damping, gravity acceleration, rotational tumbling, alpha fadeout
 *    - Sub-frame coordinate interpolation and multi-shape rendering safety
 * 2. ScreenShake:
 *    - Quadratic trauma curve: Intensity = Trauma^2
 *    - Trauma clamping to [0.0, 1.0] under extreme, negative, NaN, and infinite inputs
 *    - Exact 1.8 s^-1 decay rate across discrete and continuous timesteps
 *    - Strict translation bound (<= 12px) and rotation bound (<= 2 deg / 0.0349066 rad) across 50,000 frames
 *    - Center-pivot (400, 350) canvas transformation apply/restore matrix integrity
 * 3. FloatingTextSystem:
 *    - Pre-allocated 30-slot pool capacity invariance
 *    - Rapid multi-brick destruction burst recycling & oldest-slot eviction
 *    - Score & combo multiplier scaling, colors, font sizes, and elastic scale settling
 *    - Kinematic float (vy = -65 px/s), drag (0.97), and life fadeout (< 0.3s)
 * 4. Master GameEngine Integration:
 *    - High-throughput multi-ball TNT cascade & laser storm stress simulation
 *    - State isolation and visual FX reset synchronization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParticleSystem, ParticleSlot } from '@/game/systems/ParticleSystem';
import { ScreenShake, MAX_SHAKE_ROTATION_RAD } from '@/game/systems/ScreenShake';
import { FloatingTextSystem, FloatingTextItem } from '@/game/systems/FloatingTextSystem';
import { GameEngine } from '@/game/engine/GameEngine';
import { GameStateStore } from '@/hooks/useGameStateBridge';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PARTICLE_POOL_SIZE,
  PARTICLE_BRICK_BURST_COUNT,
  PARTICLE_EXPLOSION_COUNT,
  PARTICLE_LASER_SPARKS_COUNT,
  PARTICLE_PICKUP_COUNT,
  TRAUMA_MAX,
  TRAUMA_DECAY_RATE,
  MAX_SHAKE_TRANSLATE,
  TRAUMA_BRICK_HIT,
  TRAUMA_ARMORED_HIT,
  TRAUMA_EXPLOSION,
  TRAUMA_BALL_LOST,
} from '@/game/constants';

describe('Adversarial Stress Suite M4-2: Visual FX, Screen Shake & Particle Systems', () => {
  // =========================================================================
  // Dimension 1: ParticleSystem 350-Pool Zero-GC Invariance & Reclamation
  // =========================================================================
  describe('Dimension 1: ParticleSystem Pool Capacity & Oldest-Slot Reclamation', () => {
    let ps: ParticleSystem;

    beforeEach(() => {
      ps = new ParticleSystem(PARTICLE_POOL_SIZE);
    });

    it('1.1. Pre-allocates exact 350-particle capacity with zero active slots initially', () => {
      expect(ps.getPoolCapacity()).toBe(350);
      expect(ps.getActiveCount()).toBe(0);
    });

    it('1.2. Survives 1,000 rapid emission requests without exceeding 350 active particles', () => {
      // 1,000 emissions of mixed bursts, explosions, sparks, and pickups
      for (let i = 0; i < 1000; i++) {
        const type = i % 4;
        const x = 100 + (i % 600);
        const y = 100 + (i % 400);

        if (type === 0) {
          ps.emitBrickBurst(x, y, '#ef4444', 16);
        } else if (type === 1) {
          ps.emitExplosion(x, y, 90);
        } else if (type === 2) {
          ps.emitLaserSparks(x, y, 8);
        } else {
          ps.emitPowerupPickup(x, y, '#10b981', 14);
        }

        // Pool capacity invariant must NEVER be violated
        expect(ps.getActiveCount()).toBeLessThanOrEqual(350);
      }

      expect(ps.getActiveCount()).toBe(350);
      expect(ps.getPoolCapacity()).toBe(350);
    });

    it('1.3. Reclaims the slot with the minimum remaining life when pool is completely full', () => {
      // Fill pool with 350 particles with varying life
      for (let i = 0; i < 350; i++) {
        ps.emitBrickBurst(100, 100, '#ffffff', 1);
      }
      expect(ps.getActiveCount()).toBe(350);

      // Access internal pool representation to inspect life values
      const pool = (ps as unknown as { pool: ParticleSlot[] }).pool;
      expect(pool.length).toBe(350);

      // Artificially assign a distinct minimum life to slot 42
      pool.forEach((slot, idx) => {
        slot.life = 0.8 + idx * 0.001;
      });
      pool[42].life = 0.05; // Smallest life in pool
      pool[42].color = '#old_reclaim_target';

      // Emit 1 new particle to trigger slot reclamation
      ps.emitBrickBurst(500, 500, '#new_reclaimed_color', 1);

      // Slot 42 should have been reclaimed and rewritten
      expect(pool[42].color).toBe('#new_reclaimed_color');
      expect(pool[42].life).toBeGreaterThan(0.3); // Fresh life assigned
      expect(ps.getActiveCount()).toBe(350);
    });

    it('1.4. Validates zero memory allocation spikes across 50,000 emission cycles', () => {
      const pool = (ps as unknown as { pool: ParticleSlot[] }).pool;
      const initialPoolRef = pool;

      for (let i = 0; i < 50000; i++) {
        ps.emitBrickBurst(200, 200, '#06b6d4', 8);
        if (i % 50 === 0) {
          ps.update(1 / 60);
        }
      }

      // Ensure the pool array reference was never reallocated or resized
      expect((ps as unknown as { pool: ParticleSlot[] }).pool).toBe(initialPoolRef);
      expect(pool.length).toBe(350);
    });

    it('1.5. Accurately applies kinematic drag (0.96) and gravity (120 px/s^2) over time', () => {
      ps.emitBrickBurst(200, 200, '#ffffff', 1);
      const pool = (ps as unknown as { pool: ParticleSlot[] }).pool;
      const p = pool[0];

      // Fix initial kinematic parameters for deterministic verification
      p.x = 200;
      p.y = 200;
      p.vx = 100;
      p.vy = 0;
      p.gravity = 120;
      p.drag = 0.96;
      p.life = 1.0;
      p.maxLife = 1.0;

      const dt = 1 / 60;
      ps.update(dt);

      // Expected vx: 100 * 0.96 = 96 px/s
      // Expected vy: (0 + 120 * (1/60)) * 0.96 = 2 * 0.96 = 1.92 px/s
      // Expected x: 200 + 96 * (1/60) = 200 + 1.6 = 201.6
      // Expected y: 200 + 1.92 * (1/60) = 200 + 0.032 = 200.032
      expect(p.vx).toBeCloseTo(96, 4);
      expect(p.vy).toBeCloseTo(1.92, 4);
      expect(p.x).toBeCloseTo(201.6, 4);
      expect(p.y).toBeCloseTo(200.032, 4);
      expect(p.prevX).toBe(200);
      expect(p.prevY).toBe(200);
    });

    it('1.6. Progressively diminishes particle alpha and size towards end of life', () => {
      ps.emitBrickBurst(300, 300, '#fbbf24', 1);
      const pool = (ps as unknown as { pool: ParticleSlot[] }).pool;
      const p = pool[0];

      p.life = 0.5;
      p.maxLife = 1.0;
      p.baseAlpha = 1.0;
      p.initialSize = 6;
      p.targetSize = 2;

      ps.update(0); // Evaluate progress mapping
      // progress = 0.5 / 1.0 = 0.5
      // alpha = (0.5)^1.1 * 1.0 = ~0.4665
      // size = 2 + (6 - 2) * 0.5 = 4
      expect(p.alpha).toBeCloseTo(Math.pow(0.5, 1.1), 4);
      expect(p.size).toBeCloseTo(4.0, 4);
    });

    it('1.7. Deactivates expired particles and frees slots for subsequent reuse', () => {
      ps.emitLaserSparks(100, 100, 8);
      expect(ps.getActiveCount()).toBe(8);

      // Simulate 1.0 second elapsed (exceeds laser spark maxLife ~0.35s)
      for (let i = 0; i < 60; i++) {
        ps.update(1 / 60);
      }

      expect(ps.getActiveCount()).toBe(0);

      // New emissions must cleanly take inactive slots from nextFreeIndex
      ps.emitPowerupPickup(200, 200, '#38bdf8', 14);
      expect(ps.getActiveCount()).toBe(14);
    });

    it('1.8. Renders all 4 particle shapes (RECT, CIRCLE, RING, STAR) with sub-frame interpolation safely', () => {
      ps.emitBrickBurst(100, 100, '#ef4444', 1); // RECT
      ps.emitLaserSparks(200, 200, 1); // CIRCLE
      ps.emitExplosion(300, 300, 50); // RING + CIRCLE
      ps.emitPowerupPickup(400, 400, '#facc15', 1); // STAR

      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        globalAlpha: 1.0,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        shadowBlur: 0,
        shadowColor: '',
      } as unknown as CanvasRenderingContext2D;

      expect(() => ps.render(mockCtx, 0.75)).not.toThrow();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('1.9. Resets all 350 particles to inactive state immediately on reset()', () => {
      for (let i = 0; i < 30; i++) {
        ps.emitBrickBurst(200, 200, '#ffffff', 16);
      }
      expect(ps.getActiveCount()).toBe(350);

      ps.reset();
      expect(ps.getActiveCount()).toBe(0);
    });
  });

  // =========================================================================
  // Dimension 2: ScreenShake Quadratic Trauma Curve, Decay & Spatial Bounding
  // =========================================================================
  describe('Dimension 2: ScreenShake Quadratic Trauma Curve, Decay & Bounds', () => {
    let shake: ScreenShake;

    beforeEach(() => {
      shake = new ScreenShake();
    });

    it('2.1. Clamps trauma strictly in [0.0, 1.0] against negative, overflow, NaN, and Infinite inputs', () => {
      expect(shake.getTrauma()).toBe(0);

      // Negative trauma input must be ignored
      shake.addTrauma(-0.5);
      expect(shake.getTrauma()).toBe(0);

      // NaN and Infinity inputs must be ignored
      shake.addTrauma(NaN);
      expect(shake.getTrauma()).toBe(0);

      shake.addTrauma(Infinity);
      expect(shake.getTrauma()).toBe(0);

      // Overflow inputs must clamp to TRAUMA_MAX (1.0)
      shake.addTrauma(500.0);
      expect(shake.getTrauma()).toBe(TRAUMA_MAX);
    });

    it('2.2. Rigorously verifies quadratic intensity curve: Intensity = Trauma^2 across 1000 sample points', () => {
      for (let i = 0; i <= 1000; i++) {
        const t = i / 1000;
        shake.reset();
        shake.addTrauma(t);

        const expectedIntensity = t * t;
        expect(shake.getIntensity()).toBeCloseTo(expectedIntensity, 6);
      }
    });

    it('2.3. Verifies exact 1.8 s^-1 exponential/linear decay rate across discrete timesteps', () => {
      shake.addTrauma(1.0);
      expect(shake.getTrauma()).toBe(1.0);

      // Step 1: 0.1s elapsed -> decay 0.18 -> trauma 0.82
      shake.update(0.1);
      expect(shake.getTrauma()).toBeCloseTo(0.82, 5);

      // Step 2: 0.2s elapsed -> decay 0.36 -> trauma 0.46
      shake.update(0.2);
      expect(shake.getTrauma()).toBeCloseTo(0.46, 5);

      // Step 3: 0.2555s elapsed -> decay 0.46 -> trauma reaches 0
      shake.update(0.26);
      expect(shake.getTrauma()).toBe(0);
      expect(shake.getIntensity()).toBe(0);

      const offsets = shake.getOffsets();
      expect(offsets.x).toBe(0);
      expect(offsets.y).toBe(0);
      expect(offsets.angle).toBe(0);
    });

    it('2.4. Strictly enforces max translation <= 12px across 50,000 frames under maximum trauma', () => {
      shake.addTrauma(1.0);

      let maxObservedX = 0;
      let maxObservedY = 0;

      for (let frame = 0; frame < 50000; frame++) {
        // Keep trauma pegged at 1.0 for continuous maximum stress
        shake.addTrauma(1.0);
        // Vary dt to simulate jittery frame rates (30 FPS to 144 FPS)
        const dt = 0.007 + (frame % 10) * 0.003;
        shake.update(dt);

        const { x, y } = shake.getOffsets();
        expect(Math.abs(x)).toBeLessThanOrEqual(MAX_SHAKE_TRANSLATE + 1e-6);
        expect(Math.abs(y)).toBeLessThanOrEqual(MAX_SHAKE_TRANSLATE + 1e-6);
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);

        if (Math.abs(x) > maxObservedX) maxObservedX = Math.abs(x);
        if (Math.abs(y) > maxObservedY) maxObservedY = Math.abs(y);
      }

      // Ensure that offsets actually utilized the dynamic range (> 8px peak)
      expect(maxObservedX).toBeGreaterThan(8.0);
      expect(maxObservedY).toBeGreaterThan(8.0);
    });

    it('2.5. Strictly enforces max rotation <= 2 deg (~0.0349066 rad) across 50,000 frames', () => {
      let maxObservedAngle = 0;

      for (let frame = 0; frame < 50000; frame++) {
        shake.addTrauma(1.0);
        const dt = 0.008 + (frame % 7) * 0.002;
        shake.update(dt);

        const { angle } = shake.getOffsets();
        expect(Math.abs(angle)).toBeLessThanOrEqual(MAX_SHAKE_ROTATION_RAD + 1e-6);
        expect(Number.isFinite(angle)).toBe(true);

        if (Math.abs(angle) > maxObservedAngle) maxObservedAngle = Math.abs(angle);
      }

      // Ensure that rotation actually utilized the dynamic range (> 0.02 rad)
      expect(maxObservedAngle).toBeGreaterThan(0.02);
    });

    it('2.6. Validates center-pivot transformation matrix apply & restore cycle', () => {
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      // When trauma is zero: applyTransform must be a complete no-op
      shake.applyTransform(mockCtx);
      expect(mockCtx.save).not.toHaveBeenCalled();

      // When trauma is active: must save, translate to center+offset, rotate, translate back
      shake.addTrauma(0.8);
      shake.update(0.016);
      shake.applyTransform(mockCtx);

      const offsets = shake.getOffsets();
      expect(mockCtx.save).toHaveBeenCalledTimes(1);
      expect(mockCtx.translate).toHaveBeenNthCalledWith(
        1,
        expect.closeTo(CANVAS_WIDTH / 2 + offsets.x, 4),
        expect.closeTo(CANVAS_HEIGHT / 2 + offsets.y, 4)
      );
      expect(mockCtx.rotate).toHaveBeenCalledWith(expect.closeTo(offsets.angle, 6));
      expect(mockCtx.translate).toHaveBeenNthCalledWith(
        2,
        -CANVAS_WIDTH / 2,
        -CANVAS_HEIGHT / 2
      );

      shake.restoreTransform(mockCtx);
      expect(mockCtx.restore).toHaveBeenCalledTimes(1);
    });

    it('2.7. Completely zeroes trauma, offsets, and timeAccumulator on reset()', () => {
      shake.addTrauma(1.0);
      shake.update(0.016);
      expect(shake.getTrauma()).toBeGreaterThan(0);

      shake.reset();
      expect(shake.getTrauma()).toBe(0);
      expect(shake.getIntensity()).toBe(0);

      const offsets = shake.getOffsets();
      expect(offsets.x).toBe(0);
      expect(offsets.y).toBe(0);
      expect(offsets.angle).toBe(0);
    });
  });

  // =========================================================================
  // Dimension 3: FloatingTextSystem 30-Slot Pool Recycling & Cascades
  // =========================================================================
  describe('Dimension 3: FloatingTextSystem 30-Slot Pool Recycling & Formatting', () => {
    let fts: FloatingTextSystem;

    beforeEach(() => {
      fts = new FloatingTextSystem(30);
    });

    it('3.1. Pre-allocates exact 30-item capacity with zero active slots initially', () => {
      expect(fts.getActiveCount()).toBe(0);
      const pool = (fts as unknown as { pool: FloatingTextItem[] }).pool;
      expect(pool.length).toBe(30);
    });

    it('3.2. Handles 1,000 rapid popup spawns without exceeding 30-item capacity', () => {
      for (let i = 0; i < 1000; i++) {
        fts.spawnScorePopup(100, 100, 100, (i % 8) + 1);
        expect(fts.getActiveCount()).toBeLessThanOrEqual(30);
      }

      expect(fts.getActiveCount()).toBe(30);
      const pool = (fts as unknown as { pool: FloatingTextItem[] }).pool;
      expect(pool.length).toBe(30);
    });

    it('3.3. Correctly evicts oldest item with minimum life when all 30 slots are active', () => {
      // Spawn 30 popups
      for (let i = 0; i < 30; i++) {
        fts.spawnScorePopup(100, 100, 100, 1);
      }
      expect(fts.getActiveCount()).toBe(30);

      const pool = (fts as unknown as { pool: FloatingTextItem[] }).pool;

      // Assign varying life values and designate slot 17 as oldest
      pool.forEach((item, idx) => {
        item.life = 0.5 + idx * 0.01;
      });
      pool[17].life = 0.02;
      pool[17].text = 'OLDEST_SLOT_17';

      // Spawn 1 new popup
      fts.spawnScorePopup(200, 200, 500, 4);

      // Slot 17 must have been overwritten
      expect(pool[17].text).toBe('+500 x4');
      expect(pool[17].life).toBeCloseTo(0.9, 2);
      expect(fts.getActiveCount()).toBe(30);
    });

    it('3.4. Formats score popups and scales across multiplier thresholds (1x to 8x+)', () => {
      const pool = (fts as unknown as { pool: FloatingTextItem[] }).pool;

      // 1x: Standard white
      fts.reset();
      fts.spawnScorePopup(100, 100, 100, 1);
      expect(pool[0].text).toBe('+100');
      expect(pool[0].color).toBe('#f8fafc');
      expect(pool[0].scale).toBeCloseTo(1.15, 2);

      // 2x: Cyan
      fts.reset();
      fts.spawnScorePopup(100, 100, 100, 2);
      expect(pool[0].text).toBe('+100 x2');
      expect(pool[0].color).toBe('#38bdf8');
      expect(pool[0].scale).toBeCloseTo(1.35, 2);

      // 3x: Green
      fts.reset();
      fts.spawnScorePopup(100, 100, 100, 3);
      expect(pool[0].text).toBe('+100 x3');
      expect(pool[0].color).toBe('#34d399');
      expect(pool[0].scale).toBeCloseTo(1.45, 2);

      // 4x: Yellow / Amber
      fts.reset();
      fts.spawnScorePopup(100, 100, 100, 4);
      expect(pool[0].text).toBe('+100 x4');
      expect(pool[0].color).toBe('#fbbf24');
      expect(pool[0].scale).toBeCloseTo(1.55, 2);

      // 6x: Combo Magenta
      fts.reset();
      fts.spawnScorePopup(100, 100, 100, 6);
      expect(pool[0].text).toBe('COMBO x6! +100');
      expect(pool[0].color).toBe('#e879f9');
      expect(pool[0].scale).toBeCloseTo(1.65, 2);

      // 8x: Max Gold
      fts.reset();
      fts.spawnScorePopup(100, 100, 100, 8);
      expect(pool[0].text).toBe('MAX x8! +100');
      expect(pool[0].color).toBe('#facc15');
      expect(pool[0].scale).toBeCloseTo(1.8, 2);
    });

    it('3.5. Spawns custom special text alerts (e.g. TNT cascade, stage clear)', () => {
      fts.spawnSpecialText(400, 350, 'TNT CASCADE x3!', '#f43f5e', 'rgba(244, 63, 94, 0.9)', 16);
      const pool = (fts as unknown as { pool: FloatingTextItem[] }).pool;

      expect(pool[0].text).toBe('TNT CASCADE x3!');
      expect(pool[0].color).toBe('#f43f5e');
      expect(pool[0].fontSize).toBe(16);
      expect(pool[0].scale).toBe(1.5);
      expect(pool[0].life).toBe(1.2);
    });

    it('3.6. Updates kinematics (vy = -65 px/s, drag = 0.97) and elastic scale settling', () => {
      fts.spawnScorePopup(200, 200, 100, 4);
      const pool = (fts as unknown as { pool: FloatingTextItem[] }).pool;
      const item = pool[0];

      expect(item.scale).toBe(1.55);
      expect(item.vy).toBe(-65);

      const dt = 0.1;
      fts.update(dt);

      // y must have moved upward: 200 + (-65 * 0.1) = 193.5
      expect(item.y).toBeCloseTo(193.5, 2);
      expect(item.vy).toBeCloseTo(-65 * 0.97, 2);
      // scale settles towards 1.0 by -3.5 * dt = -0.35 -> 1.55 - 0.35 = 1.20
      expect(item.scale).toBeCloseTo(1.20, 2);
    });

    it('3.7. Deactivates expired items and renders text with canvas outline safely', () => {
      fts.spawnScorePopup(100, 100, 100, 1);
      expect(fts.getActiveCount()).toBe(1);

      // Simulate 1.5 seconds elapsed (exceeds score popup maxLife 0.9s)
      for (let i = 0; i < 90; i++) {
        fts.update(1 / 60);
      }
      expect(fts.getActiveCount()).toBe(0);

      // Test canvas rendering
      fts.spawnScorePopup(300, 300, 200, 2);
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        strokeText: vi.fn(),
        fillText: vi.fn(),
        font: '',
        textAlign: '',
        textBaseline: '',
        strokeStyle: '',
        lineWidth: 1,
        lineJoin: '',
        fillStyle: '',
        shadowBlur: 0,
        shadowColor: '',
        globalAlpha: 1.0,
      } as unknown as CanvasRenderingContext2D;

      expect(() => fts.render(mockCtx, 0.5)).not.toThrow();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.strokeText).toHaveBeenCalledWith('+200 x2', 0, 0);
      expect(mockCtx.fillText).toHaveBeenCalledWith('+200 x2', 0, 0);
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('3.8. Resets all 30 text slots to inactive state immediately on reset()', () => {
      for (let i = 0; i < 30; i++) {
        fts.spawnScorePopup(100, 100, 100, 1);
      }
      expect(fts.getActiveCount()).toBe(30);

      fts.reset();
      expect(fts.getActiveCount()).toBe(0);
    });
  });

  // =========================================================================
  // Dimension 4: GameEngine Integration & High-Throughput FX Cascade Stress
  // =========================================================================
  describe('Dimension 4: Master GameEngine Integration & Cascade Stress', () => {
    let engine: GameEngine;
    let store: GameStateStore;

    beforeEach(() => {
      store = new GameStateStore();
      engine = new GameEngine({ stateStore: store });
    });

    it('4.1. Integrates ParticleSystem, ScreenShake, and FloatingTextSystem during brick destruction', () => {
      engine.startGame();

      const particleSystem = (engine as unknown as { particleSystem: ParticleSystem }).particleSystem;
      const screenShake = (engine as unknown as { screenShake: ScreenShake }).screenShake;
      const floatingText = (engine as unknown as { floatingTextSystem: FloatingTextSystem }).floatingTextSystem;

      expect(particleSystem.getActiveCount()).toBe(0);
      expect(screenShake.getTrauma()).toBe(0);
      expect(floatingText.getActiveCount()).toBe(0);

      // Simulate a standard brick destruction event
      (engine as unknown as { handleBrickHit: (brick: unknown, isLaser: boolean, pts: number, destroyed: boolean) => void })
        .handleBrickHit(
          {
            id: 'b1',
            row: 0,
            col: 0,
            x: 200,
            y: 100,
            width: 58,
            height: 20,
            type: 'STANDARD',
            maxHits: 1,
            currentHits: 0,
            color: '#ef4444',
            points: 100,
            isAlive: false,
          },
          false,
          100,
          true
        );

      // Standard brick hit should emit brick burst, trigger trauma (0.08), and spawn floating score
      expect(particleSystem.getActiveCount()).toBe(PARTICLE_BRICK_BURST_COUNT);
      expect(screenShake.getTrauma()).toBeCloseTo(TRAUMA_BRICK_HIT, 4);
      expect(floatingText.getActiveCount()).toBe(1);
    });

    it('4.2. Triggers massive explosion FX, trauma (0.55), and cascade notification on TNT detonation', () => {
      engine.startGame();

      const particleSystem = (engine as unknown as { particleSystem: ParticleSystem }).particleSystem;
      const screenShake = (engine as unknown as { screenShake: ScreenShake }).screenShake;
      const floatingText = (engine as unknown as { floatingTextSystem: FloatingTextSystem }).floatingTextSystem;

      // Detonate an explosive TNT brick
      (engine as unknown as { handleBrickHit: (brick: unknown, isLaser: boolean, pts: number, destroyed: boolean) => void })
        .handleBrickHit(
          {
            id: 'tnt1',
            row: 2,
            col: 2,
            x: 300,
            y: 150,
            width: 58,
            height: 20,
            type: 'EXPLOSIVE',
            maxHits: 1,
            currentHits: 0,
            color: '#f43f5e',
            points: 500,
            isAlive: false,
          },
          false,
          500,
          true
        );

      // Explosive brick triggers explosion burst (1 ring + 26 embers + 14 smoke = 41 particles)
      // plus TNT special alert text and 0.55 trauma
      expect(particleSystem.getActiveCount()).toBe(41);
      expect(screenShake.getTrauma()).toBeCloseTo(TRAUMA_EXPLOSION, 4);
      expect(floatingText.getActiveCount()).toBe(2); // TNT ALERT + Score popup
    });

    it('4.3. Sustains a stress cascade of 100 simultaneous brick explosions without pool leakage or state corruption', () => {
      engine.startGame();

      const particleSystem = (engine as unknown as { particleSystem: ParticleSystem }).particleSystem;
      const screenShake = (engine as unknown as { screenShake: ScreenShake }).screenShake;
      const floatingText = (engine as unknown as { floatingTextSystem: FloatingTextSystem }).floatingTextSystem;

      for (let i = 0; i < 100; i++) {
        (engine as unknown as { handleBrickHit: (brick: unknown, isLaser: boolean, pts: number, destroyed: boolean) => void })
          .handleBrickHit(
            {
              id: `stress_brick_${i}`,
              row: i % 14,
              col: i % 12,
              x: 50 + (i % 10) * 60,
              y: 60 + Math.floor(i / 10) * 25,
              width: 58,
              height: 20,
              type: i % 2 === 0 ? 'EXPLOSIVE' : 'STANDARD',
              maxHits: 1,
              currentHits: 0,
              color: '#f43f5e',
              points: 500,
              isAlive: false,
            },
            false,
            500,
            true
          );
      }

      // Particle pool must be capped at 350
      expect(particleSystem.getActiveCount()).toBe(350);
      expect(particleSystem.getPoolCapacity()).toBe(350);

      // Screen shake trauma must be capped at 1.0
      expect(screenShake.getTrauma()).toBe(TRAUMA_MAX);
      expect(screenShake.getIntensity()).toBe(1.0);

      // Floating text pool must be capped at 30
      expect(floatingText.getActiveCount()).toBe(30);

      // Advance physics loop for 60 frames
      for (let f = 0; f < 60; f++) {
        (engine as unknown as { update: (dt: number) => void }).update(1 / 60);
      }

      // Trauma should decay steadily: 1.0 - 1.8 * 1.0s <= 0
      expect(screenShake.getTrauma()).toBe(0);
      expect(screenShake.getIntensity()).toBe(0);
    });

    it('4.4. Cleanly flushes and resets all visual FX systems on game reset / restart', () => {
      engine.startGame();

      const particleSystem = (engine as unknown as { particleSystem: ParticleSystem }).particleSystem;
      const screenShake = (engine as unknown as { screenShake: ScreenShake }).screenShake;
      const floatingText = (engine as unknown as { floatingTextSystem: FloatingTextSystem }).floatingTextSystem;

      // Populate systems
      particleSystem.emitExplosion(300, 300);
      screenShake.addTrauma(0.9);
      floatingText.spawnScorePopup(300, 300, 500, 4);

      expect(particleSystem.getActiveCount()).toBeGreaterThan(0);
      expect(screenShake.getTrauma()).toBeGreaterThan(0);
      expect(floatingText.getActiveCount()).toBeGreaterThan(0);

      // Reset game
      engine.restartGame();

      expect(particleSystem.getActiveCount()).toBe(0);
      expect(screenShake.getTrauma()).toBe(0);
      expect(floatingText.getActiveCount()).toBe(0);
    });
  });
});
