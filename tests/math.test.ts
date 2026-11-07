import { describe, it, expect } from 'vitest';
import {
  vec,
  add,
  sub,
  mult,
  div,
  mag,
  magSq,
  dist,
  distSq,
  normalize,
  setMag,
  limit,
  headingDeg,
  lerp,
  clamp,
} from '../src/utils/math';

describe('2D Vector Math Utilities', () => {
  it('creates vectors with vec()', () => {
    const v = vec(10, 20);
    expect(v.x).toBe(10);
    expect(v.y).toBe(20);
  });

  it('adds and subtracts vectors correctly', () => {
    const v1 = vec(5, 10);
    const v2 = vec(2, 3);
    expect(add(v1, v2)).toEqual({ x: 7, y: 13 });
    expect(sub(v1, v2)).toEqual({ x: 3, y: 7 });
  });

  it('multiplies and divides vectors by scalar', () => {
    const v = vec(8, 12);
    expect(mult(v, 2)).toEqual({ x: 16, y: 24 });
    expect(div(v, 4)).toEqual({ x: 2, y: 3 });
    expect(div(v, 0)).toEqual({ x: 0, y: 0 });
  });

  it('computes magnitude and squared magnitude', () => {
    const v = vec(3, 4);
    expect(magSq(v)).toBe(25);
    expect(mag(v)).toBe(5);
  });

  it('computes Euclidean distance between points', () => {
    const p1 = vec(0, 0);
    const p2 = vec(6, 8);
    expect(distSq(p1, p2)).toBe(100);
    expect(dist(p1, p2)).toBe(10);
  });

  it('normalizes vector to unit length', () => {
    const v = vec(10, 0);
    const unit = normalize(v);
    expect(unit.x).toBeCloseTo(1);
    expect(unit.y).toBeCloseTo(0);
    expect(mag(unit)).toBeCloseTo(1);
  });

  it('sets magnitude of vector', () => {
    const v = vec(3, 4);
    const scaled = setMag(v, 15);
    expect(mag(scaled)).toBeCloseTo(15);
  });

  it('limits magnitude when exceeding maximum', () => {
    const v = vec(30, 40); // mag = 50
    const limited = limit(v, 10);
    expect(mag(limited)).toBeCloseTo(10);

    const small = vec(2, 2);
    expect(limit(small, 10)).toEqual({ x: 2, y: 2 });
  });

  it('calculates heading angle in degrees', () => {
    expect(headingDeg(vec(1, 0))).toBeCloseTo(0);
    expect(headingDeg(vec(0, 1))).toBeCloseTo(90);
    expect(headingDeg(vec(-1, 0))).toBeCloseTo(180);
    expect(headingDeg(vec(0, -1))).toBeCloseTo(-90);
  });

  it('interpolates and clamps values', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

