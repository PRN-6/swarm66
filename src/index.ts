import { SwarmConfig, DomSwarmInstance, ResolvedSwarmConfig, SwarmMetrics } from './types';
import { SwarmEngine } from './core/SwarmEngine';

/**
 * Public class implementation of Swarm66 / DomSwarm.
 */
export class Swarm66 extends SwarmEngine {
  constructor(config?: SwarmConfig) {
    super(config);
  }
}

export class DomSwarm extends Swarm66 {}

/**
 * Convenience alias for swarm66 initialization.
 */
export const swarm66 = enableSwarm;

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
      getConfig: (): Readonly<ResolvedSwarmConfig> => ({
        agentCount: config?.agentCount ?? 18,
        teamSize: config?.teamSize ?? 4,
        copyPasteDuplicates: config?.copyPasteDuplicates ?? true,
        colors: config?.colors ?? ['#FF5722', '#00BCD4', '#8BC34A', '#9C27B0', '#FFC107', '#E91E63', '#2196F3'],
        selector:
          config?.selector ??
          'header, nav, main, section, article, aside, footer, h1, h2, h3, h4, h5, h6, p, span, a, button, input, textarea, select, label, img, svg, canvas, video, pre, code, blockquote, li, table, [class*="card"], [class*="badge"], [class*="box"], [class*="panel"], [class*="item"], [class*="border"], [class*="btn"], [class*="spec"], [class*="pill"], .swarm-item',
        ignoreSelector:
          config?.ignoreSelector ??
          '[data-no-swarm], script, style, noscript, dom-swarm-overlay, .swarm-hud',
        hideOnStart: config?.hideOnStart ?? true,
        concurrency: config?.concurrency ?? 4,
        buildOrder: config?.buildOrder ?? 'top-to-bottom',
        vanishAtCursor: config?.vanishAtCursor ?? true,
        rebuildOnRouteChange: config?.rebuildOnRouteChange ?? true,
        buildOnScroll: config?.buildOnScroll ?? true,
        typewriterEffect: config?.typewriterEffect ?? true,
        showGuides: config?.showGuides ?? true,
        showDimensions: config?.showDimensions ?? true,
        followMouse: config?.followMouse ?? true,
        maxSpeed: config?.maxSpeed ?? 9.5,
        maxForce: config?.maxForce ?? 0.4,
        buildDuration: config?.buildDuration ?? 550,
        flockRadius: config?.flockRadius ?? 85,
        separateDistance: config?.separateDistance ?? 32,
        mouseAttractRadius: config?.mouseAttractRadius ?? 220,
        mouseAttractForce: config?.mouseAttractForce ?? 0.45,
        typewriterSpeed: config?.typewriterSpeed ?? 16,
        debug: config?.debug ?? false,
      }),
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

// Auto-bind to window global for vanilla HTML, PHP, Laravel, WordPress, and Django templates
if (typeof window !== 'undefined') {
  (window as any).enableSwarm = enableSwarm;
  (window as any).swarm66 = enableSwarm;
  (window as any).Swarm66 = Swarm66;
  (window as any).DomSwarm = DomSwarm;
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
