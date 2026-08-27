/**
 * @file tests/unit/screen-shake.test.ts
 * Comprehensive unit and trauma physics test suite for ScreenShake.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScreenShake, MAX_SHAKE_ROTATION_RAD } from '@/game/systems/ScreenShake';
import { MAX_SHAKE_TRANSLATE, TRAUMA_MAX } from '@/game/constants';

describe('ScreenShake: Quadratic Trauma Camera Perturbation Suite', () => {
  let shake: ScreenShake;

  beforeEach(() => {
    shake = new ScreenShake();
  });

  it('1. Initializes with zero trauma and zero offsets', () => {
    expect(shake.getTrauma()).toBe(0);
    expect(shake.getIntensity()).toBe(0);
    const offsets = shake.getOffsets();
    expect(offsets.x).toBe(0);
    expect(offsets.y).toBe(0);
    expect(offsets.angle).toBe(0);
  });

  it('2. Adds trauma and clamps strictly to TRAUMA_MAX (1.0)', () => {
    shake.addTrauma(0.4);
    expect(shake.getTrauma()).toBeCloseTo(0.4, 5);

    shake.addTrauma(0.8);
    expect(shake.getTrauma()).toBe(TRAUMA_MAX);
  });

  it('3. Calculates quadratic intensity mapping (Intensity = Trauma^2)', () => {
    shake.addTrauma(0.5);
    // 0.5^2 = 0.25
    expect(shake.getIntensity()).toBeCloseTo(0.25, 5);

    shake.addTrauma(0.5); // now 1.0
    expect(shake.getIntensity()).toBeCloseTo(1.0, 5);
  });

  it('4. Decays trauma steadily at 1.8 s^-1 rate', () => {
    shake.addTrauma(0.9);
    // After 0.25 seconds: trauma reduces by 1.8 * 0.25 = 0.45 -> remaining 0.45
    shake.update(0.25);
    expect(shake.getTrauma()).toBeCloseTo(0.45, 4);

    // After another 0.3 seconds: 0.45 - 1.8 * 0.3 = 0.45 - 0.54 -> clamped to 0
    shake.update(0.3);
    expect(shake.getTrauma()).toBe(0);
    expect(shake.getIntensity()).toBe(0);
  });

  it('5. Strictly bounds translational offsets (<= 12 px) and rotational offsets (<= 2 deg)', () => {
    shake.addTrauma(1.0);

    for (let i = 0; i < 100; i++) {
      shake.update(0.016);
      const offsets = shake.getOffsets();

      expect(Math.abs(offsets.x)).toBeLessThanOrEqual(MAX_SHAKE_TRANSLATE + 0.001);
      expect(Math.abs(offsets.y)).toBeLessThanOrEqual(MAX_SHAKE_TRANSLATE + 0.001);
      expect(Math.abs(offsets.angle)).toBeLessThanOrEqual(MAX_SHAKE_ROTATION_RAD + 0.001);
      expect(Number.isFinite(offsets.x)).toBe(true);
      expect(Number.isFinite(offsets.y)).toBe(true);
      expect(Number.isFinite(offsets.angle)).toBe(true);
    }
  });

  it('6. Applies and restores canvas center-pivot transform matrix correctly', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    // No-op when trauma is 0
    shake.applyTransform(mockCtx);
    expect(mockCtx.save).not.toHaveBeenCalled();

    // When trauma is active
    shake.addTrauma(0.8);
    shake.update(0.016);
    shake.applyTransform(mockCtx);

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.translate).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    expect(mockCtx.rotate).toHaveBeenCalledWith(expect.any(Number));

    shake.restoreTransform(mockCtx);
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('7. Resets trauma and offsets to absolute zero on reset()', () => {
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
