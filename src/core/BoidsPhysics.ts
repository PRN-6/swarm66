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
 * Reynolds Boids algorithm implementation with dynamic orbital dispersal,
 * neighbor velocity alignment, and viewport boundary protection.
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
    viewport: { width: number; height: number },
    timeSeconds = 0
  ): Vector2D {
    // 1. Separation: Strong repulsion when closer than 65px so agents never bunch up
    const sep = this.separate(agent, allAgents, Math.max(config.separateDistance, 65));

    // 2. Alignment: match velocity of nearby idle agents
    const ali = this.align(agent, allAgents, config.flockRadius);

    // 3. Gentle cohesion: very low weight to prevent collapsing into a tight ball
    const coh = this.cohere(agent, allAgents, config.flockRadius);

    // 4. Viewport boundaries: keep inside screen
    const bounds = this.boundEdges(agent, viewport, 60);

    let totalForce = vec(0, 0);
    totalForce = add(totalForce, mult(sep, 3.2));
    totalForce = add(totalForce, mult(ali, 0.4));
    totalForce = add(totalForce, mult(coh, 0.15));
    totalForce = add(totalForce, mult(bounds, 2.5));

    // 5. Dynamic Orbital Halo around Focal Point (center logo, user mouse, or upcoming content)
    if (mousePos) {
      const orbitForce = this.orbitalHalo(agent, mousePos, timeSeconds);
      totalForce = add(totalForce, orbitForce);
    }

    return limit(totalForce, agent.maxForce * 2.2);
  }

  /**
   * Smooth orbital dispersion around a focal center point.
   * Maintains an open ring (radius 130px - 220px) with tangential rotation
   * and outward radial repulsion when agents approach too closely.
   */
  public static orbitalHalo(agent: Agent, focal: Vector2D, time = 0): Vector2D {
    const toFocal = sub(agent.position, focal);
    const d = dist(agent.position, focal) || 0.01;
    const dir = div(toFocal, d); // Unit vector pointing outwards from focal center

    // Individual orbital radius per agent based on id
    const baseRadius = 140 + ((agent.id * 19) % 90);
    const breathing = 1 + 0.15 * Math.sin(time * 0.7 + agent.id);
    const desiredRadius = baseRadius * breathing;

    // Radial spring force: pushes outward if d < desiredRadius, pulls inward if d > desiredRadius
    const radialDelta = desiredRadius - d;
    const radialMag = Math.max(-1.8, Math.min(1.8, radialDelta * 0.025));
    const radialForce = mult(dir, radialMag);

    // Tangential orbital velocity: spins clockwise or counter-clockwise
    const spinDirection = agent.id % 2 === 0 ? 1 : -1;
    const tangent = { x: -dir.y * spinDirection, y: dir.x * spinDirection };
    const tangentialForce = mult(tangent, 0.95);

    return add(radialForce, tangentialForce);
  }

  /**
   * Reference flocking and mouse follow physics:
   * Smooth orbital breathing, tangential velocity, dynamic neighbor separation,
   * 48px repulsion bubble around mouse pointer, and velocity rotation alignment.
   */
  public static follow(
    dt: number,
    cursors: Agent[],
    focal: Vector2D,
    mouse: Vector2D | null,
    mouseVelocity: Vector2D,
    time: number,
    scale = 1
  ): boolean {
    const u = 135 * scale * (1 + 0.18 * Math.sin(time * 0.55));
    const a = Math.tanh(Math.cos(time * 0.11) * 3);
    const p: [number, number][] = [];

    for (const h of cursors) {
      const v = h.position.x - focal.x;
      const w = h.position.y - focal.y;
      const T = Math.hypot(v, w) || 0.01;
      const d = v / T;
      const f = w / T;
      const y = Math.atan2(w, v);
      const g = (h.orbit - 120) * 0.55 * scale;
      const E = u * (1 + 0.3 * Math.sin(3 * y + time * 0.7)) + g;
      const L = 300 * (0.7 + h.spin * 0.2) * a;
      const M = Math.max(-2600, Math.min(1400, (E - T) * 4));
      const S = Math.min(1, Math.max(0, (T - E) / 600));
      p.push([-f * L + d * M - f * h.curl * 400 * S, d * L + f * M + d * h.curl * 400 * S]);
    }

    for (let i = 0; i < cursors.length; i++) {
      const v = cursors[i];
      if (!v) continue;
      let w = 0;
      let T = 0;
      let d = 0;
      for (let j = 0; j < cursors.length; j++) {
        if (i === j) continue;
        const other = cursors[j];
        if (!other) continue;
        const dist = Math.hypot(other.position.x - v.position.x, other.position.y - v.position.y);
        if (dist > 90) continue;
        const X = 1 - dist / 90;
        w += other.velocity.x * X;
        T += other.velocity.y * X;
        d += X;
      }
      const pItem = p[i];
      if (!pItem) continue;
      let [f, y] = pItem;
      if (d > 0) {
        f = f * 0.7 + (w / d) * 0.3;
        y = y * 0.7 + (T / d) * 0.3;
      }
      const g = Math.max(0, Math.hypot(v.position.x - focal.x, v.position.y - focal.y) - 180 * scale);
      const E = v.speed * (1.3 + Math.min(3.2, g / 90));
      const N = Math.hypot(f, y);
      if (N > E) {
        f *= E / N;
        y *= E / N;
      }
      let L = (f - v.velocity.x) * 6;
      let M = (y - v.velocity.y) * 6;
      const S = v.force * (1.4 + Math.min(5, g / 50));
      const C = Math.hypot(L, M);
      if (C > S) {
        L *= S / C;
        M *= S / C;
      }
      v.velocity.x += L * dt;
      v.velocity.y += M * dt;
      v.position.x += v.velocity.x * dt;
      v.position.y += v.velocity.y * dt;
    }

    // 48px repulsion bubble around mouse
    const m = 48;
    let near = false;
    if (mouse) {
      for (const h of cursors) {
        const v = h.position.x - mouse.x;
        const w = h.position.y - mouse.y;
        const T = Math.hypot(v, w) || 0.01;
        if (T < m) {
          near = true;
          const d = v / T;
          const f = w / T;
          h.position.x = mouse.x + d * m;
          h.position.y = mouse.y + f * m;
          const y = (h.velocity.x - mouseVelocity.x) * d + (h.velocity.y - mouseVelocity.y) * f;
          if (y < 0) {
            h.velocity.x -= d * y * 1.6;
            h.velocity.y -= f * y * 1.6;
          }
          h.velocity.x += d * 260;
          h.velocity.y += f * 260;
        }
      }
    }

    // Heading rotation alignment
    for (const h of cursors) {
      const v = h.velocity.x;
      const w = h.velocity.y;
      if (Math.hypot(v, w) > 30) {
        const d = (((Math.atan2(w, v) * 180) / Math.PI + 128 - h.angle + 540) % 360) - 180;
        h.angle += d * Math.min(1, dt * 8);
      }
      h.press = Math.max(0, h.press - dt * 6);
    }

    return near;
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
        let diff = sub(agent.position, other.position);
        diff = normalize(diff);
        // Inverse distance weighting
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

    const seekForce = this.seek(agent, mousePos, radius * 0.8);
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
