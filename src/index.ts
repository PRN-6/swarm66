import { SwarmConfig, DomSwarmInstance, ResolvedSwarmConfig, SwarmMetrics } from './types';
import { SwarmEngine } from './core/SwarmEngine';

/**
 * Public class implementation of DomSwarm.
 */
export class DomSwarm extends SwarmEngine {
  constructor(config?: SwarmConfig) {
    super(config);
  }
}

/**
 * Convenience factory to mount and enable the DomSwarm visual engine on any page.
 * Safe for Server-Side Rendering (SSR) environments.
 *
 * @param config Optional configuration options to customize swarm behaviors and visuals.
 * @returns An active DomSwarmInstance controlling the swarm.
 *
 * @example
 * ```ts
 * import { enableSwarm } from 'dom-swarm';
 *
 * const swarm = enableSwarm({
 *   agentCount: 20,
 *   hideOnStart: true,
 *   vanishAtCursor: true,
 *   typewriterEffect: true,
 * });
 * ```
 */
export function enableSwarm(config?: SwarmConfig): DomSwarmInstance {
  // SSR Guard for Next.js, Nuxt, Astro, SvelteKit, etc.
  if (typeof window === 'undefined') {
    return {
      destroy: () => {},
      pause: () => {},
      resume: () => {},
      replay: () => {},
      handlePageNavigation: () => {},
      buildElement: async () => {},
      getConfig: () => ({} as Readonly<ResolvedSwarmConfig>),
      updateConfig: () => {},
      isPaused: () => true,
      isFinished: () => true,
      getActiveAgentCount: () => 0,
      getMetrics: (): SwarmMetrics => ({
        fps: 0,
        totalAgents: 0,
        idleAgents: 0,
        constructingAgents: 0,
        convergingAgents: 0,
        vanishedAgents: 0,
        elementsConstructed: 0,
        elementsPending: 0,
        isFinished: true,
      }),
    };
  }

  return new DomSwarm(config);
}

// Re-export all TypeScript types and interfaces
export * from './types';
export { SwarmEngine } from './core/SwarmEngine';
export { Agent } from './core/Agent';
export { BoidsPhysics } from './core/BoidsPhysics';
export { OverlayManager } from './dom/OverlayManager';
export { DomScanner } from './dom/DomScanner';
export { BuilderEffects } from './dom/BuilderEffects';
export * from './utils/math';

// Default export
export default enableSwarm;
