import { Agent } from './Agent';
import { ResolvedSwarmConfig, Vector2D } from '../types';
import {
  vec,
  add,
  sub,
  mult,
  div,
  dist,
  distSq,
  normalize,
  setMag,
  limit,
} from '../utils/math';

/**
 * Reynolds Boids algorithm implementation with dynamic mouse attraction
 * and viewport boundary repulsion.
 */
export class BoidsPhysics {
  /**
   * Computes the combined flocking force for an agent in IDLE_FLOCKING or RETURNING_TO_SWARM state.
   */
  public static calculateFlockingForces(
    agent: Agent,
    allAgents: Agent[],
    mousePos: Vector2D | null,
    config: ResolvedSwarmConfig,
    viewport: { width: number; height: number }
  ): Vector2D {
    const sep = this.separate(agent, allAgents, config.separateDistance);
    const ali = this.align(agent, allAgents, config.flockRadius);
    const coh = this.cohere(agent, allAgents, config.flockRadius);
    const bounds = this.boundEdges(agent, viewport, 60);

    // Default force weights
    let totalForce = vec(0, 0);
    totalForce = add(totalForce, mult(sep, 1.6));
    totalForce = add(totalForce, mult(ali, 1.0));
    totalForce = add(totalForce, mult(coh, 0.9));
    totalForce = add(totalForce, mult(bounds, 2.2));

    // Mouse attraction / Orbiting
    if (config.followMouse && mousePos) {
      const mouseForce = this.attractToMouse(
        agent,
        mousePos,
        config.mouseAttractRadius,
        config.mouseAttractForce
      );
      totalForce = add(totalForce, mouseForce);
    }

    return limit(totalForce, agent.maxForce * 2.0);
  }

  /**
   * Separation: steer to avoid colliding with nearby flockmates.
   */
  public static separate(agent: Agent, agents: Agent[], desiredSeparation: number): Vector2D {
    let steer = vec(0, 0);
    let count = 0;
    const sepSq = desiredSeparation * desiredSeparation;

    for (let i = 0; i < agents.length; i++) {
      const other = agents[i];
      if (!other || other.id === agent.id) continue;

      const dSq = distSq(agent.position, other.position);
      if (dSq > 0 && dSq < sepSq) {
        const d = Math.sqrt(dSq);
        // Vector pointing away from neighbor, inversely proportional to distance
        let diff = sub(agent.position, other.position);
        diff = normalize(diff);
        diff = div(diff, Math.max(d, 1));
        steer = add(steer, diff);
        count++;
      }
    }

    if (count > 0) {
      steer = div(steer, count);
      if (distSq(steer, vec(0, 0)) > 0) {
        steer = normalize(steer);
        steer = mult(steer, agent.maxSpeed);
        steer = sub(steer, agent.velocity);
        steer = limit(steer, agent.maxForce * 1.5);
      }
    }

    return steer;
  }

  /**
   * Alignment: steer towards the average velocity of nearby flockmates.
   */
  public static align(agent: Agent, agents: Agent[], neighborDist: number): Vector2D {
    let sum = vec(0, 0);
    let count = 0;
    const neighborDistSq = neighborDist * neighborDist;

    for (let i = 0; i < agents.length; i++) {
      const other = agents[i];
      if (!other || other.id === agent.id || other.state === 'CONSTRUCTING_ELEMENT') continue;

      const dSq = distSq(agent.position, other.position);
      if (dSq > 0 && dSq < neighborDistSq) {
        sum = add(sum, other.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum = div(sum, count);
      sum = normalize(sum);
      sum = mult(sum, agent.maxSpeed);
      let steer = sub(sum, agent.velocity);
      steer = limit(steer, agent.maxForce);
      return steer;
    }

    return vec(0, 0);
  }

  /**
   * Cohesion: steer to move toward the average position of nearby flockmates.
   */
  public static cohere(agent: Agent, agents: Agent[], neighborDist: number): Vector2D {
    let sum = vec(0, 0);
    let count = 0;
    const neighborDistSq = neighborDist * neighborDist;

    for (let i = 0; i < agents.length; i++) {
      const other = agents[i];
      if (!other || other.id === agent.id || other.state === 'CONSTRUCTING_ELEMENT') continue;

      const dSq = distSq(agent.position, other.position);
      if (dSq > 0 && dSq < neighborDistSq) {
        sum = add(sum, other.position);
        count++;
      }
    }

    if (count > 0) {
      sum = div(sum, count);
      return this.seek(agent, sum);
    }

    return vec(0, 0);
  }

  /**
   * Mouse Attraction: draws agents toward live cursor coordinates with dynamic swirling orbit.
   */
  public static attractToMouse(
    agent: Agent,
    mousePos: Vector2D,
    radius: number,
    forceStrength: number
  ): Vector2D {
    const d = dist(agent.position, mousePos);
    if (d > radius * 2.5) return vec(0, 0);

    // Seek towards mouse with arrival
    const seekForce = this.seek(agent, mousePos, radius * 0.8);

    // Add gentle swirling tangential vector around cursor for dynamic flock cloud
    const toMouse = sub(mousePos, agent.position);
    const tangent = normalize({ x: -toMouse.y, y: toMouse.x });
    const orbitMag = (1 - Math.min(d / radius, 1)) * 0.8;
    const orbitForce = mult(tangent, orbitMag);

    const combined = add(mult(seekForce, forceStrength), orbitForce);
    return limit(combined, agent.maxForce * 1.8);
  }

  /**
   * Steer toward a specific target coordinate with arrival slowing.
   */
  public static seek(agent: Agent, target: Vector2D, slowingRadius = 120): Vector2D {
    const desired = sub(target, agent.position);
    const d = dist(target, agent.position);

    if (d === 0) return vec(0, 0);

    let speed = agent.maxSpeed;
    if (d < slowingRadius) {
      speed = agent.maxSpeed * (d / slowingRadius);
    }

    const desiredVel = setMag(desired, speed);
    const steer = sub(desiredVel, agent.velocity);
    return limit(steer, agent.maxForce);
  }

  /**
   * Smooth boundary repulsion from viewport edges so agents stay visible.
   */
  public static boundEdges(
    agent: Agent,
    viewport: { width: number; height: number },
    margin = 60
  ): Vector2D {
    let steer = vec(0, 0);

    if (agent.position.x < margin) {
      steer.x = (margin - agent.position.x) / margin;
    } else if (agent.position.x > viewport.width - margin) {
      steer.x = (viewport.width - margin - agent.position.x) / margin;
    }

    if (agent.position.y < margin) {
      steer.y = (margin - agent.position.y) / margin;
    } else if (agent.position.y > viewport.height - margin) {
      steer.y = (viewport.height - margin - agent.position.y) / margin;
    }

    if (distSq(steer, vec(0, 0)) > 0) {
      steer = setMag(steer, agent.maxSpeed);
      steer = sub(steer, agent.velocity);
      steer = limit(steer, agent.maxForce * 2.0);
    }

    return steer;
  }
}

