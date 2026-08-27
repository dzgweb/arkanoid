/**
 * @file game/physics/MathUtils.ts
 * Vector arithmetic, geometric collision math, and interpolation utilities.
 */

import { Vector2D, BoundingBox, Circle } from '../types';

/**
 * Clamps a numerical value within [min, max] range.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Linear interpolation between start and end by factor t [0, 1].
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Converts degrees to radians.
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Computes Euclidean magnitude (length) of a 2D vector.
 */
export function vectorMagnitude(v: Vector2D): number {
  return Math.hypot(v.x, v.y);
}

/**
 * Computes squared magnitude of a 2D vector (avoids sqrt for performance).
 */
export function vectorMagnitudeSquared(v: Vector2D): number {
  return v.x * v.x + v.y * v.y;
}

/**
 * Normalizes a 2D vector to unit length. Returns zero vector if magnitude is 0.
 */
export function normalizeVector(v: Vector2D): Vector2D {
  const mag = Math.hypot(v.x, v.y);
  if (mag === 0) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / mag, y: v.y / mag };
}

/**
 * Computes the dot product of two 2D vectors.
 */
export function dotProduct(a: Vector2D, b: Vector2D): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Reflects incident vector v against surface with unit normal n.
 * Formula: v' = v - 2 * (v . n) * n
 */
export function reflectVector(v: Vector2D, normal: Vector2D): Vector2D {
  const dot = dotProduct(v, normal);
  return {
    x: v.x - 2 * dot * normal.x,
    y: v.y - 2 * dot * normal.y,
  };
}

/**
 * Computes Euclidean distance between two 2D points.
 */
export function distance(a: Vector2D, b: Vector2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Computes squared Euclidean distance between two 2D points.
 */
export function distanceSquared(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Tests if point p is inside an axis-aligned bounding box.
 */
export function pointInAABB(p: Vector2D, box: BoundingBox): boolean {
  return (
    p.x >= box.x &&
    p.x <= box.x + box.width &&
    p.y >= box.y &&
    p.y <= box.y + box.height
  );
}

/**
 * Tests intersection between two axis-aligned bounding boxes (AABBs).
 */
export function aabbOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
  return !(
    box1.x + box1.width < box2.x ||
    box1.x > box2.x + box2.width ||
    box1.y + box1.height < box2.y ||
    box1.y > box2.y + box2.height
  );
}

/**
 * Finds the closest point on an AABB to a target point p.
 */
export function closestPointOnAABB(p: Vector2D, box: BoundingBox): Vector2D {
  return {
    x: clamp(p.x, box.x, box.x + box.width),
    y: clamp(p.y, box.y, box.y + box.height),
  };
}

/**
 * Tests intersection between a Circle and an AABB.
 */
export function circleAABBOverlap(circle: Circle, box: BoundingBox): boolean {
  const closest = closestPointOnAABB(circle, box);
  return distanceSquared(circle, closest) <= circle.radius * circle.radius;
}

export interface LineCircleIntersectionResult {
  intersects: boolean;
  t: number;
  point: Vector2D;
}

/**
 * Computes intersection between a line segment (lineStart -> lineEnd) and a circle.
 * Returns earliest intersection point with parameter t in [0, 1], or null if no hit.
 */
export function lineCircleIntersection(
  lineStart: Vector2D,
  lineEnd: Vector2D,
  circleCenter: Vector2D,
  radius: number
): LineCircleIntersectionResult | null {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const fx = lineStart.x - circleCenter.x;
  const fy = lineStart.y - circleCenter.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;

  if (a === 0) {
    if (c <= 0) {
      return { intersects: true, t: 0, point: { x: lineStart.x, y: lineStart.y } };
    }
    return null;
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  let tHit = -1;
  if (t1 >= 0 && t1 <= 1) {
    tHit = t1;
  } else if (t2 >= 0 && t2 <= 1) {
    tHit = t2;
  }

  if (tHit >= 0) {
    return {
      intersects: true,
      t: tHit,
      point: {
        x: lineStart.x + tHit * dx,
        y: lineStart.y + tHit * dy,
      },
    };
  }

  return null;
}
