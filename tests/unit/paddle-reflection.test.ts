/**
 * @file tests/unit/paddle-reflection.test.ts
 * Vitest unit test suite for dynamic angle paddle deflection,
 * tangential velocity bias, and minimum vertical escape safeguards.
 */

import { describe, it, expect } from 'vitest';
import { PaddlePhysics } from '@/game/physics/PaddlePhysics';
import { MAX_PADDLE_BOUNCE_ANGLE, BALL_MIN_VY } from '@/game/constants';

describe('PaddlePhysics Reflection Math', () => {
  const paddle = {
    x: 350,
    y: 640,
    width: 100,
    height: 16,
    vx: 0,
  };

  it('computes exact impact offset ratio u in [-1, 1]', () => {
    // Center of paddle (350 + 50 = 400)
    expect(PaddlePhysics.calculateImpactOffset(400, paddle.x, paddle.width)).toBeCloseTo(0, 4);

    // Left edge (350)
    expect(PaddlePhysics.calculateImpactOffset(350, paddle.x, paddle.width)).toBeCloseTo(-1, 4);

    // Right edge (450)
    expect(PaddlePhysics.calculateImpactOffset(450, paddle.x, paddle.width)).toBeCloseTo(1, 4);

    // Quarter right (425)
    expect(PaddlePhysics.calculateImpactOffset(425, paddle.x, paddle.width)).toBeCloseTo(0.5, 4);
  });

  it('deflects straight up (0 deg) when hitting exact paddle center', () => {
    const ball = { x: 400, y: 633, speed: 420 };
    const res = PaddlePhysics.calculateReflection(ball, paddle);

    expect(res.offsetRatio).toBeCloseTo(0, 4);
    expect(res.vx).toBeCloseTo(0, 2);
    expect(res.vy).toBeCloseTo(-420, 2);
  });

  it('deflects at +75 degrees on extreme right paddle edge', () => {
    const ball = { x: 450, y: 633, speed: 400 };
    const res = PaddlePhysics.calculateReflection(ball, paddle);

    const expectedVx = 400 * Math.sin(MAX_PADDLE_BOUNCE_ANGLE);
    const expectedVy = -400 * Math.cos(MAX_PADDLE_BOUNCE_ANGLE);

    expect(res.offsetRatio).toBeCloseTo(1, 4);
    expect(res.vx).toBeCloseTo(expectedVx, 1);
    expect(res.vy).toBeCloseTo(expectedVy, 1);
  });

  it('deflects at -75 degrees on extreme left paddle edge', () => {
    const ball = { x: 350, y: 633, speed: 400 };
    const res = PaddlePhysics.calculateReflection(ball, paddle);

    const expectedVx = -400 * Math.sin(MAX_PADDLE_BOUNCE_ANGLE);
    const expectedVy = -400 * Math.cos(MAX_PADDLE_BOUNCE_ANGLE);

    expect(res.offsetRatio).toBeCloseTo(-1, 4);
    expect(res.vx).toBeCloseTo(expectedVx, 1);
    expect(res.vy).toBeCloseTo(expectedVy, 1);
  });

  it('applies 20% tangential paddle velocity bias', () => {
    const movingPaddle = { ...paddle, vx: 500 };
    const ball = { x: 400, y: 633, speed: 400 };
    const res = PaddlePhysics.calculateReflection(ball, movingPaddle);

    // Center bounce with positive paddle velocity pushes vx to the right
    expect(res.vx).toBeGreaterThan(0);
    // Scalar speed must remain conserved
    expect(Math.hypot(res.vx, res.vy)).toBeCloseTo(400, 1);
  });

  it('enforces vertical speed safeguard |vy| >= speed * sin(15 deg)', () => {
    const fastMovingPaddle = { ...paddle, vx: 1200 };
    const ball = { x: 450, y: 633, speed: 400 };
    const res = PaddlePhysics.calculateReflection(ball, fastMovingPaddle);

    const minVy = Math.max(BALL_MIN_VY, 400 * Math.sin((15 * Math.PI) / 180));
    expect(Math.abs(res.vy)).toBeGreaterThanOrEqual(minVy - 0.01);
    expect(res.vy).toBeLessThan(0); // Upward velocity
  });
});
