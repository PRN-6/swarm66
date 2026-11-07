import { describe, it, expect } from 'vitest';
import { enableSwarm } from '../src/index';

describe('Server-Side Rendering (SSR) Guard', () => {
  it('does not throw when initialized in Node environment without window', () => {
    expect(() => {
      enableSwarm();
    }).not.toThrow();
  });

  it('returns a complete, safe no-op instance under SSR', async () => {
    const swarm = enableSwarm({
      agentCount: 30,
      hideOnStart: true,
      vanishAtCursor: true,
      typewriterEffect: true,
      buildOnScroll: true,
    });

    expect(swarm).toBeDefined();
    expect(swarm.isPaused()).toBe(true);
    expect(swarm.isFinished()).toBe(true);
    expect(swarm.getActiveAgentCount()).toBe(0);

    const metrics = swarm.getMetrics();
    expect(metrics.fps).toBe(0);
    expect(metrics.totalAgents).toBe(0);
    expect(metrics.isFinished).toBe(true);

    // Methods should not throw
    expect(() => swarm.pause()).not.toThrow();
    expect(() => swarm.resume()).not.toThrow();
    expect(() => swarm.replay()).not.toThrow();
    expect(() => swarm.updateConfig({ agentCount: 50 })).not.toThrow();
    expect(() => swarm.destroy()).not.toThrow();

    // buildElement should resolve without error
    const dummyEl = {} as any;
    await expect(swarm.buildElement(dummyEl)).resolves.toBeUndefined();
  });
});
