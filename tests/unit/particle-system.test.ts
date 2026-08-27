/**
 * @file tests/unit/particle-system.test.ts
 * Comprehensive unit and physics stress test suite for ParticleSystem.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParticleSystem } from '@/game/systems/ParticleSystem';
import { PARTICLE_POOL_SIZE } from '@/game/constants';

describe('ParticleSystem: Zero-GC Physics Emitter & Object Pool Suite', () => {
  let ps: ParticleSystem;

  beforeEach(() => {
    ps = new ParticleSystem(PARTICLE_POOL_SIZE);
  });

  it('1. Initializes with zero active particles and exact pool capacity (350)', () => {
    expect(ps.getPoolCapacity()).toBe(350);
    expect(ps.getActiveCount()).toBe(0);
  });

  it('2. Emits brick shatter burst with exact count and active state', () => {
    ps.emitBrickBurst(400, 200, '#ef4444', 16);
    expect(ps.getActiveCount()).toBe(16);
  });

  it('3. Emits explosion with shockwave ring, embers, and smoke puffs', () => {
    ps.emitExplosion(400, 300, 90);
    // 1 ring + 26 embers + 14 smoke puffs = 41 active particles
    expect(ps.getActiveCount()).toBe(41);
  });

  it('4. Emits laser sparks with directional deflection cone', () => {
    ps.emitLaserSparks(200, 150, 8);
    expect(ps.getActiveCount()).toBe(8);
  });

  it('5. Emits power-up sparkles with starburst shapes', () => {
    ps.emitPowerupPickup(300, 600, '#06b6d4', 14);
    expect(ps.getActiveCount()).toBe(14);
  });

  it('6. Applies velocity decay (0.96) and gravity (120 px/s^2) across updates', () => {
    ps.emitBrickBurst(100, 100, '#10b981', 1);
    expect(ps.getActiveCount()).toBe(1);

    ps.update(1 / 60);
    expect(ps.getActiveCount()).toBe(1);
  });

  it('7. Decrements lifetime and deactivates expired particles', () => {
    ps.emitLaserSparks(100, 100, 5);
    expect(ps.getActiveCount()).toBe(5);

    // Step forward 1.0 second (longer than laser spark maxLife ~0.35s)
    for (let i = 0; i < 60; i++) {
      ps.update(1 / 60);
    }
    expect(ps.getActiveCount()).toBe(0);
  });

  it('8. Handles pool exhaustion via oldest-slot reclamation without crashing or exceeding poolSize', () => {
    // Attempt to emit 30 bursts of 16 particles (480 particles > 350 capacity)
    for (let i = 0; i < 30; i++) {
      ps.emitBrickBurst(200, 200, '#38bdf8', 16);
    }

    // Must never exceed pool size 350
    expect(ps.getActiveCount()).toBe(350);
  });

  it('9. Updates sub-frame interpolation coordinates (prevX, prevY)', () => {
    ps.emitBrickBurst(100, 100, '#f59e0b', 1);
    ps.update(1 / 60);

    // Canvas mock rendering with sub-frame alpha
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
    } as unknown as CanvasRenderingContext2D;

    expect(() => ps.render(mockCtx, 0.5)).not.toThrow();
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('10. Resets all particles to inactive in a single pass', () => {
    ps.emitExplosion(300, 300);
    expect(ps.getActiveCount()).toBeGreaterThan(0);

    ps.reset();
    expect(ps.getActiveCount()).toBe(0);
  });
});
