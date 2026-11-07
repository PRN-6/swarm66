import { describe, it, expect } from 'vitest';
import { BoidsPhysics } from '../src/core/BoidsPhysics';
import { vec, mag } from '../src/utils/math';

describe('Boids Physics Engine', () => {
  it('calculates separation force away from close neighbors', () => {
    const agent = {
      id: 1,
      position: vec(100, 100),
      velocity: vec(0, 0),
      maxSpeed: 8,
      maxForce: 0.35,
    } as any;

    const neighbor = {
      id: 2,
      position: vec(105, 100), // slightly to the right
      velocity: vec(0, 0),
    } as any;

    const steer = BoidsPhysics.separate(agent, [neighbor], 30);
    // Steering force should push to the left (negative x)
    expect(steer.x).toBeLessThan(0);
    expect(mag(steer)).toBeLessThanOrEqual(agent.maxForce * 1.5 + 0.001);
  });

  it('calculates alignment force towards average flock velocity', () => {
    const agent = {
      id: 1,
      position: vec(100, 100),
      velocity: vec(1, 0),
      maxSpeed: 8,
      maxForce: 0.35,
    } as any;

    const neighbors = [
      { id: 2, position: vec(110, 100), velocity: vec(0, 5) },
      { id: 3, position: vec(120, 100), velocity: vec(0, 5) },
    ] as any[];

    const steer = BoidsPhysics.align(agent, neighbors, 50);
    // Steering force should steer towards positive y (velocity heading of neighbors)
    expect(steer.y).toBeGreaterThan(0);
  });

  it('calculates cohesion force towards group center of mass', () => {
    const agent = {
      id: 1,
      position: vec(50, 50),
      velocity: vec(0, 0),
      maxSpeed: 8,
      maxForce: 0.35,
    } as any;

    const neighbors = [
      { id: 2, position: vec(100, 100), velocity: vec(0, 0) },
      { id: 3, position: vec(120, 120), velocity: vec(0, 0) },
    ] as any[];

    const steer = BoidsPhysics.cohere(agent, neighbors, 150);
    // Group center is around (110, 110), so steering force should be positive in both x and y
    expect(steer.x).toBeGreaterThan(0);
    expect(steer.y).toBeGreaterThan(0);
  });

  it('attracts agents towards the active mouse position', () => {
    const agent = {
      id: 1,
      position: vec(200, 200),
      velocity: vec(0, 0),
      maxSpeed: 8,
      maxForce: 0.35,
    } as any;

    const mousePos = vec(300, 300);
    const force = BoidsPhysics.attractToMouse(agent, mousePos, 200, 0.5);

    expect(mag(force)).toBeGreaterThan(0);
    expect(mag(force)).toBeLessThanOrEqual(agent.maxForce * 1.8 + 0.001);
  });

  it('repels agents approaching viewport edges', () => {
    const agentNearLeft = {
      id: 1,
      position: vec(10, 300), // very close to left boundary
      velocity: vec(-2, 0),
      maxSpeed: 8,
      maxForce: 0.35,
    } as any;

    const force = BoidsPhysics.boundEdges(agentNearLeft, { width: 1000, height: 800 }, 60);
    // Should steer rightwards (positive x)
    expect(force.x).toBeGreaterThan(0);
  });
});

