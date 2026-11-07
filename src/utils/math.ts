import { Vector2D } from '../types';

/**
 * Creates a 2D vector.
 */
export function vec(x = 0, y = 0): Vector2D {
  return { x, y };
}

/**
 * Adds two vectors.
 */
export function add(v1: Vector2D, v2: Vector2D): Vector2D {
  return { x: v1.x + v2.x, y: v1.y + v2.y };
}

/**
 * Subtracts v2 from v1.
 */
export function sub(v1: Vector2D, v2: Vector2D): Vector2D {
  return { x: v1.x - v2.x, y: v1.y - v2.y };
}

/**
 * Multiplies vector by scalar.
 */
export function mult(v: Vector2D, n: number): Vector2D {
  return { x: v.x * n, y: v.y * n };
}

/**
 * Divides vector by scalar.
 */
export function div(v: Vector2D, n: number): Vector2D {
  if (n === 0) return { x: 0, y: 0 };
  return { x: v.x / n, y: v.y / n };
}

/**
 * Squared magnitude of a vector.
 */
export function magSq(v: Vector2D): number {
  return v.x * v.x + v.y * v.y;
}

/**
 * Magnitude (length) of a vector.
 */
export function mag(v: Vector2D): number {
  return Math.sqrt(magSq(v));
}

/**
 * Squared Euclidean distance between two points.
 */
export function distSq(v1: Vector2D, v2: Vector2D): number {
  const dx = v1.x - v2.x;
  const dy = v1.y - v2.y;
  return dx * dx + dy * dy;
}

/**
 * Euclidean distance between two points.
 */
export function dist(v1: Vector2D, v2: Vector2D): number {
  return Math.sqrt(distSq(v1, v2));
}

/**
 * Normalizes vector to unit length (length = 1).
 */
export function normalize(v: Vector2D): Vector2D {
  const m = mag(v);
  if (m === 0) return { x: 0, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

/**
 * Sets magnitude of a vector to specified length.
 */
export function setMag(v: Vector2D, n: number): Vector2D {
  return mult(normalize(v), n);
}

/**
 * Limits magnitude of vector to max value.
 */
export function limit(v: Vector2D, maxVal: number): Vector2D {
  const mSq = magSq(v);
  if (mSq > maxVal * maxVal) {
    return mult(div(v, Math.sqrt(mSq)), maxVal);
  }
  return { x: v.x, y: v.y };
}

/**
 * Calculates heading angle in radians (-PI to PI).
 */
export function heading(v: Vector2D): number {
  return Math.atan2(v.y, v.x);
}

/**
 * Calculates heading angle in degrees (0 to 360 or -180 to 180).
 */
export function headingDeg(v: Vector2D): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

/**
 * Linear interpolation between two values.
 */
export function lerp(start: number, end: number, amt: number): number {
  return start + (end - start) * amt;
}

/**
 * Clamps a number between min and max bounds.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generates random float between min and max.
 */
export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Selects a random element from an array.
 */
export function randomChoice<T>(items: T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index] as T;
}

/**
 * Computes dot product of two vectors.
 */
export function dot(v1: Vector2D, v2: Vector2D): number {
  return v1.x * v2.x + v1.y * v2.y;
}

