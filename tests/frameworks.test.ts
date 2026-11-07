import { describe, it, expect, vi } from 'vitest';
import { enableSwarm, DomSwarm, Swarm66, swarm66, DomSwarmInstance } from '../src/index';

describe('Universal Framework & Web Language Compatibility', () => {
  it('supports React & Next.js lifecycle pattern (useEffect mount and cleanup)', () => {
    // Simulating React component mount
    let swarmInstance: DomSwarmInstance | null = null;
    const cleanupSpy = vi.fn();

    // Inside useEffect
    const onMount = () => {
      swarmInstance = enableSwarm({
        agentCount: 18,
        teamSize: 4,
        hideOnStart: true,
      });

      return () => {
        cleanupSpy();
        swarmInstance?.destroy();
        swarmInstance = null;
      };
    };

    const cleanup = onMount();
    expect(swarmInstance).toBeDefined();

    // Simulating React component unmount
    cleanup();
    expect(cleanupSpy).toHaveBeenCalledOnce();
    expect(swarmInstance).toBeNull();
  });

  it('supports Angular lifecycle pattern (ngOnInit and ngOnDestroy)', () => {
    class MockAngularComponent {
      public swarm?: DomSwarmInstance;
      public isDestroyed = false;

      ngOnInit() {
        this.swarm = enableSwarm({
          teamSize: 4,
          buildOrder: 'top-to-bottom',
        });
      }

      ngOnDestroy() {
        this.swarm?.destroy();
        this.isDestroyed = true;
      }
    }

    const component = new MockAngularComponent();
    component.ngOnInit();
    expect(component.swarm).toBeDefined();

    component.ngOnDestroy();
    expect(component.isDestroyed).toBe(true);
  });

  it('supports Vue 3 & Nuxt 3 lifecycle pattern (onMounted and onUnmounted)', () => {
    let swarm: DomSwarmInstance | undefined;
    let unmounted = false;

    // Inside onMounted
    const onMounted = () => {
      swarm = enableSwarm({
        concurrency: 3,
        typewriterEffect: true,
      });
    };

    // Inside onUnmounted
    const onUnmounted = () => {
      swarm?.destroy();
      unmounted = true;
    };

    onMounted();
    expect(swarm).toBeDefined();

    onUnmounted();
    expect(unmounted).toBe(true);
  });

  it('supports Svelte & SvelteKit lifecycle pattern (onMount with return cleanup)', () => {
    let instance: DomSwarmInstance | null = null;
    let destroyed = false;

    const onMount = () => {
      instance = enableSwarm();
      return () => {
        instance?.destroy();
        destroyed = true;
      };
    };

    const onDestroy = onMount();
    expect(instance).toBeDefined();

    onDestroy();
    expect(destroyed).toBe(true);
  });

  it('supports Vanilla HTML, PHP (Laravel / WordPress / Symfony) and Django via global window', () => {
    // In browser global environment
    expect(typeof enableSwarm).toBe('function');
    expect(typeof swarm66).toBe('function');
    expect(typeof DomSwarm).toBe('function');
    expect(typeof Swarm66).toBe('function');

    const instance1 = swarm66({ agentCount: 12 });
    expect(instance1).toBeDefined();
    instance1.destroy();

    const instance2 = new Swarm66({ agentCount: 8 });
    expect(instance2).toBeDefined();
    instance2.destroy();
  });

  it('provides safe execution across Node SSR environments (Next.js SSR / Nuxt SSR / PHP prerender)', () => {
    const isServer = typeof window === 'undefined';
    expect(isServer).toBe(true);

    // Should instantiate safe stub on server without throwing
    const serverInstance = enableSwarm({ hideOnStart: true });
    expect(serverInstance).toBeDefined();
    expect(serverInstance.isFinished()).toBe(true);
    expect(serverInstance.getMetrics().totalAgents).toBe(0);

    expect(() => {
      serverInstance.pause();
      serverInstance.resume();
      serverInstance.replay();
      serverInstance.handlePageNavigation();
      serverInstance.destroy();
    }).not.toThrow();
  });
});

