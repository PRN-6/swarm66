import {
  AgentType,
  BorderRole,
  ConstructionTask,
  DomSwarmInstance,
  ResolvedSwarmConfig,
  SwarmConfig,
  SwarmMetrics,
  Vector2D,
} from '../types';
import { Agent } from './Agent';
import { BoidsPhysics } from './BoidsPhysics';
import { OverlayManager } from '../dom/OverlayManager';
import { BuilderEffects } from '../dom/BuilderEffects';
import { DomScanner } from '../dom/DomScanner';
import { vec, dist, randomRange, sub, normalize, mult } from '../utils/math';

const DEFAULT_CONFIG: ResolvedSwarmConfig = {
  agentCount: 18,
  teamSize: 4,
  copyPasteDuplicates: true,
  colors: ['#FF5722', '#00BCD4', '#8BC34A', '#9C27B0', '#FFC107', '#E91E63', '#2196F3'],
  selector: 'nav, header, h1, h2, h3, h4, h5, h6, p, button, a, img, pre, code, .swarm-item, .price-card, .interactive-card, .metric-card',
  ignoreSelector: '[data-no-swarm], script, style, noscript, dom-swarm-overlay, .swarm-hud',
  hideOnStart: true,
  concurrency: 4,
  buildOrder: 'top-to-bottom',
  vanishAtCursor: true,
  rebuildOnRouteChange: true,
  buildOnScroll: true,
  typewriterEffect: true,
  showGuides: true,
  showDimensions: true,
  followMouse: true,
  maxSpeed: 9.5,
  maxForce: 0.4,
  buildDuration: 550,
  flockRadius: 85,
  separateDistance: 32,
  mouseAttractRadius: 220,
  mouseAttractForce: 0.45,
  typewriterSpeed: 16,
  debug: false,
};

/**
 * Main orchestrator of dom-swarm:
 * divides 18 agents into 4-agent teams, dispatches them to the 4 borders of elements,
 * and converges all agents to the user's cursor to vanish upon completion.
 */
export class SwarmEngine implements DomSwarmInstance {
  private config: ResolvedSwarmConfig;
  private overlayManager: OverlayManager;
  private builderEffects: BuilderEffects;
  private domScanner: DomScanner;

  private agents: Agent[] = [];
  private tasks = new Map<string, ConstructionTask>();
  private buildQueue: HTMLElement[] = [];
  private activeBoxTypeToggle = false;

  private mousePos: Vector2D | null = null;
  private lastMouseMoveTime = 0;
  private isMouseActive = false;

  private animFrameId: number | null = null;
  private lastTime = 0;
  private paused = false;
  private destroyed = false;
  private isFinishedState = false;
  private isConverging = false;

  // Performance telemetry
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 60;
  private constructedCount = 0;

  // History of recently constructed element templates for Figma-style copy/paste duplicate animations
  private constructedTemplates: Array<{ element: HTMLElement; rect: DOMRect }> = [];

  // Multi-page & client-side SPA route tracking
  private lastUrl = typeof window !== 'undefined' ? window.location.href : '';
  private unbindRouteListeners: (() => void) | null = null;
  private routeChangeDebounce: any = null;

  constructor(userConfig?: SwarmConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      container: userConfig?.container,
      onAgentStateChange: userConfig?.onAgentStateChange,
      onElementConstructed: userConfig?.onElementConstructed,
      onAllElementsConstructed: userConfig?.onAllElementsConstructed,
      onSwarmVanished: userConfig?.onSwarmVanished,
    };

    this.overlayManager = new OverlayManager(this.config.container);
    this.builderEffects = new BuilderEffects();
    this.domScanner = new DomScanner({
      selector: this.config.selector,
      ignoreSelector: this.config.ignoreSelector,
      hideOnStart: this.config.hideOnStart,
      buildOrder: this.config.buildOrder,
      builderEffects: this.builderEffects,
      onElementDiscovered: (el) => this.enqueueElement(el),
    });

    this.init();
  }

  /**
   * Initializes overlay, agents, input listeners, and starts the construction sequence.
   */
  private init(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    this.overlayManager.mount();
    this.spawnAgents();
    this.bindEvents();

    const elements = this.domScanner.init();
    this.buildQueue = [...elements];

    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
    this.animFrameId = requestAnimationFrame(this.renderLoop);

    setTimeout(() => {
      this.processBuildQueue();
    }, 150);
  }

  /**
   * Spawns 18 agents divided randomly into 4-agent teams.
   */
  private spawnAgents(): void {
    const width = window.innerWidth || 1024;
    const height = window.innerHeight || 768;

    // Create random team assignments (0, 1, 2, 3)
    const teamIndices: number[] = [];
    for (let i = 0; i < this.config.agentCount; i++) {
      teamIndices.push(Math.floor(i / this.config.teamSize));
    }
    // Shuffle team assignments for random distribution
    teamIndices.sort(() => Math.random() - 0.5);

    for (let i = 0; i < this.config.agentCount; i++) {
      const color = this.config.colors[i % this.config.colors.length] || '#FF5722';
      const teamId = teamIndices[i] ?? 0;

      const pos = vec(
        randomRange(width * 0.1, width * 0.9),
        randomRange(height * 0.1, height * 0.9)
      );

      const agent = new Agent(
        i + 1,
        color,
        teamId,
        pos,
        this.overlayManager,
        this.config.maxSpeed,
        this.config.maxForce
      );

      this.agents.push(agent);
    }
  }

  /**
   * Binds pointer and touch listeners for interactive flocking and convergence target.
   */
  private bindEvents(): void {
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('touchstart', this.onTouchMove, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });
    this.setupRouteListeners();
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.mousePos = { x: e.clientX, y: e.clientY };
    this.lastMouseMoveTime = performance.now();
    this.isMouseActive = true;
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (e.touches && e.touches[0]) {
      this.mousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.lastMouseMoveTime = performance.now();
      this.isMouseActive = true;
    }
  };

  private onScroll = (): void => {
    this.syncActiveBoundingBoxes();
  };

  private onResize = (): void => {
    this.syncActiveBoundingBoxes();
  };

  /**
   * Main simulation and animation loop running on requestAnimationFrame.
   */
  private renderLoop = (timestamp: number): void => {
    if (this.destroyed) return;

    if (!this.paused) {
      const rawDt = (timestamp - this.lastTime) / 16.666;
      const dt = Math.min(Math.max(rawDt, 0.1), 3.0);
      this.lastTime = timestamp;

      this.frameCount++;
      if (timestamp - this.lastFpsUpdate >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdate));
        this.frameCount = 0;
        this.lastFpsUpdate = timestamp;
      }

      if (this.isMouseActive && timestamp - this.lastMouseMoveTime > 2500) {
        this.isMouseActive = false;
      }

      const activeMouse = this.mousePos || vec(
        (window.innerWidth || 1024) / 2,
        (window.innerHeight || 768) / 2
      );

      const viewport = {
        width: window.innerWidth || 1024,
        height: window.innerHeight || 768,
      };

      if (this.isConverging && !this.isFinishedState) {
        const remainingAgents = this.agents.filter((a) => a.state !== 'VANISHED');
        if (remainingAgents.length === 0) {
          this.isFinishedState = true;
          this.isConverging = false;
          this.config.onSwarmVanished?.();
        }
      }

      // Update unassigned agents (flocking, converging, or idle)
      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        if (!agent || agent.state === 'VANISHED' || agent.assignedTaskId) continue;

        if (agent.state === 'CONVERGING_TO_USER') {
          const seekForce = BoidsPhysics.seek(agent, activeMouse, 50);
          agent.applyForce(seekForce);

          const toMouse = sub(activeMouse, agent.position);
          const tangent = normalize({ x: -toMouse.y, y: toMouse.x });
          agent.applyForce(mult(tangent, 1.4));
        } else if (agent.state === 'IDLE_FLOCKING' || agent.state === 'RETURNING_TO_SWARM') {
          const force = BoidsPhysics.calculateFlockingForces(
            agent,
            this.agents,
            this.isMouseActive ? this.mousePos : null,
            this.config,
            viewport
          );
          agent.applyForce(force);

          if (agent.state === 'RETURNING_TO_SWARM') {
            const vSq = agent.velocity.x * agent.velocity.x + agent.velocity.y * agent.velocity.y;
            if (vSq < 3.0) {
              agent.setIdle();
              this.config.onAgentStateChange?.(agent.id, 'IDLE_FLOCKING');
            }
          }
        }

        agent.update(dt, this.overlayManager);
      }

      // Update active construction tasks: agents stay locked directly to the box borders
      this.tasks.forEach((task) => {
        if (task.completed) return;
        const rect = task.element.getBoundingClientRect();
        task.rect = rect;

        if (task.phase === 'CLONING') {
          const elapsed = timestamp - task.expandStartTime;
          const p = Math.min(elapsed / task.expandDuration, 1.0);
          const ease = 1 - Math.pow(1 - p, 3); // Smooth cubic ease-out

          const src = task.sourceRect || rect;
          const curX = src.left + (rect.left - src.left) * ease;
          const curY = src.top + (rect.top - src.top) * ease;
          const curW = src.width + (rect.width - src.width) * ease;
          const curH = src.height + (rect.height - src.height) * ease;

          if (task.cloneElement) {
            this.overlayManager.updateGhostClone(task.cloneElement, curX, curY, curW, curH, 0.95);
          }

          // Only keep the first cursor for copy-pasting (1 hand cursor dragging the clone)
          // Remove the other cursors during the drag
          task.assignedAgents.forEach((agentId, idx) => {
            const agent = this.agents.find((a) => a.id === agentId);
            if (!agent) return;

            if (idx === 0) {
              // Lead cursor holds the top-left of the duplicate wireframe
              agent.position.x = curX + 16;
              agent.position.y = curY;
              agent.velocity = vec(0, 0);
              agent.element.style.opacity = '1';
              agent.morphIcon('hand', this.overlayManager);
              this.overlayManager.updateAgentTransform(
                agent.element,
                agent.position.x,
                agent.position.y,
                0,
                1.05
              );
            } else {
              // Hide the other cursors during the drag
              agent.element.style.opacity = '0';
              agent.position.x = rect.left + rect.width / 2;
              agent.position.y = rect.top + rect.height / 2;
              agent.velocity = vec(0, 0);
            }
          });

          // When clone arrives at target, transition to building & editing
          if (p >= 1.0) {
            if (task.cloneElement) {
              this.overlayManager.removeGhostClone(task.cloneElement);
              task.cloneElement = undefined;
            }

            task.boxElement = this.overlayManager.createBoundingBox(
              task.id,
              rect,
              task.boxType,
              this.config.showDimensions,
              this.config.showGuides
            );

            task.phase = 'BUILDING';
            task.assignedAgents.forEach((agentId, idx) => {
              const agent = this.agents.find((a) => a.id === agentId);
              if (agent) {
                agent.element.style.opacity = '1';
                agent.setConstructing();
                agent.targetRect = rect;
                // First cursor uses pencil for text editing; others use standard pointer
                const editTool: AgentType = idx === 0 ? 'pen' : 'pointer';
                agent.morphIcon(editTool, this.overlayManager);
                this.config.onAgentStateChange?.(agent.id, 'CONSTRUCTING_ELEMENT');
              }
            });

            // Trigger typewriter / content editing reveal
            const cancelReveal = this.builderEffects.executeReveal(
              task.element,
              task.isText,
              this.config.typewriterEffect,
              task.duration,
              () => {
                this.completeTask(task.id);
              }
            );
            task.cancelEffect = cancelReveal;
          }
        } else if (task.phase === 'EXPANDING') {
          const elapsed = timestamp - task.expandStartTime;
          const p = Math.min(elapsed / task.expandDuration, 1.0);
          const ease = 1 - Math.pow(1 - p, 3); // Smooth cubic ease out

          // Anchor at top-left origin: rect.left, rect.top
          const curLeft = rect.left;
          const curTop = rect.top;
          const curW = Math.max(4, rect.width * ease);
          const curH = Math.max(4, rect.height * ease);
          const curOpacity = Math.min(p * 2.5, 1);

          if (task.boxElement) {
            this.overlayManager.updateBoxGeometry(
              task.boxElement,
              { left: curLeft, top: curTop, width: curW, height: curH },
              curOpacity,
              task.id
            );
          }

          // Single agent selects top-left edge and drags opposite bottom-right corner
          // until the shape reaches the desired size. Other agents remain hidden during the drag.
          task.assignedAgents.forEach((agentId, idx) => {
            const agent = this.agents.find((a) => a.id === agentId);
            if (!agent) return;

            if (idx === 0) {
              // Lead agent is directly locked to the corner/edge being dragged
              agent.position.x = curLeft + curW;
              agent.position.y = curTop + curH;
              agent.velocity = vec(0, 0);
              agent.element.style.opacity = '1';
              // Naturally upright cursor (0deg) - no rotation
              this.overlayManager.updateAgentTransform(
                agent.element,
                agent.position.x,
                agent.position.y,
                0,
                1.05
              );
            } else {
              // Hide the other agents during the drag
              agent.element.style.opacity = '0';
              agent.position.x = rect.left + rect.width / 2;
              agent.position.y = rect.top + rect.height / 2;
              agent.velocity = vec(0, 0);
            }
          });

          // When box reaches full size, transition to content building
          if (p >= 1.0) {
            task.phase = 'BUILDING';
            task.assignedAgents.forEach((agentId, idx) => {
              const agent = this.agents.find((a) => a.id === agentId);
              if (agent) {
                agent.element.style.opacity = '1';
                agent.setConstructing();
                agent.targetRect = rect;
                // Only the first cursor uses pencil for text; other border cursors use the standard pointer
                const tool: AgentType = (idx === 0 && task.isText) ? 'pen' : 'pointer';
                agent.morphIcon(tool, this.overlayManager);
                this.config.onAgentStateChange?.(agent.id, 'CONSTRUCTING_ELEMENT');
              }
            });

            // Trigger typewriter or scale reveal
            const cancelReveal = this.builderEffects.executeReveal(
              task.element,
              task.isText,
              this.config.typewriterEffect,
              task.duration,
              () => {
                this.completeTask(task.id);
              }
            );
            task.cancelEffect = cancelReveal;
          }
        } else if (task.phase === 'BUILDING') {
          if (task.boxElement) {
            this.overlayManager.updateBoundingBox(task.boxElement, rect, task.id);
          }
          // The 4 agents patrol along the 4 borders of the full-size box
          task.assignedAgents.forEach((agentId) => {
            const agent = this.agents.find((a) => a.id === agentId);
            if (agent && agent.assignedTaskId === task.id) {
              agent.targetRect = rect;
              agent.update(dt, this.overlayManager);
            }
          });
        }
      });
    }

    this.animFrameId = requestAnimationFrame(this.renderLoop);
  };

  /**
   * Continuously processes elements from the queue using parallel 4-agent teams.
   */
  private processBuildQueue(): void {
    if (this.destroyed || this.paused || this.isConverging) return;

    // Dispatch next elements up to concurrency limit
    while (this.tasks.size < this.config.concurrency && this.buildQueue.length > 0) {
      const nextElement = this.buildQueue.shift();
      if (nextElement) {
        this.constructElement(nextElement);
      }
    }

    if (this.buildQueue.length === 0 && this.tasks.size === 0 && !this.isFinishedState) {
      this.config.onAllElementsConstructed?.();

      if (this.config.vanishAtCursor && !this.isConverging) {
        this.triggerConvergenceFinale();
      }
    }
  }

  /**
   * Checks if an element has matching dimensions to an already constructed element
   * to enable Figma-style copy/paste duplicate animation.
   */
  private findMatchingTemplate(
    rect: DOMRect,
    currentEl: HTMLElement
  ): { element: HTMLElement; rect: DOMRect } | null {
    if (!this.config.copyPasteDuplicates) return null;
    if (rect.width < 30 || rect.height < 20) return null;

    for (let i = this.constructedTemplates.length - 1; i >= 0; i--) {
      const template = this.constructedTemplates[i];
      if (!template || template.element === currentEl) continue;

      const widthDiff = Math.abs(template.rect.width - rect.width);
      const heightDiff = Math.abs(template.rect.height - rect.height);

      if (widthDiff <= 16 && heightDiff <= 16) {
        if (typeof document !== 'undefined' && document.body.contains(template.element)) {
          const liveRect = template.element.getBoundingClientRect();
          if (liveRect.width >= 10 && liveRect.height >= 10) {
            return { element: template.element, rect: liveRect };
          }
        }
      }
    }
    return null;
  }

  /**
   * Initiates live construction of an element by dispatching a team of 4 agents
   * to the 4 borders of the bounding box.
   */
  private constructElement(element: HTMLElement): void {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const rect = element.getBoundingClientRect();

    if (rect.width < 5 || rect.height < 5) {
      this.builderEffects.executeReveal(element, false, false, 50, () => {
        this.constructedCount++;
        this.processBuildQueue();
      });
      return;
    }

    const category = BuilderEffects.getElementCategory(element);
    const isText = category === 'text' || BuilderEffects.isTextElement(element);
    const boxType = this.activeBoxTypeToggle ? 'red' : 'blue';
    this.activeBoxTypeToggle = !this.activeBoxTypeToggle;

    const elementCenter = vec(rect.left + rect.width / 2, rect.top + rect.height / 2);

    // Pick a team of 4 idle agents (preferring same teamId if available)
    const assigned = this.pickTeamAgents(elementCenter, this.config.teamSize);

    if (assigned.length === 0) {
      this.builderEffects.executeReveal(
        element,
        isText,
        this.config.typewriterEffect,
        this.config.buildDuration,
        () => {
          this.constructedCount++;
          this.config.onElementConstructed?.(element);
          this.processBuildQueue();
        }
      );
      return;
    }

    // 4 Border roles: Top, Right, Bottom, Left
    const borderRoles: BorderRole[] = ['top', 'right', 'bottom', 'left'];

    const matchingTemplate = this.findMatchingTemplate(rect, element);
    const isCopyPaste = matchingTemplate !== null;
    const sourceRect = matchingTemplate ? matchingTemplate.rect : undefined;

    // For text: 'pen' (Pencil / Pen tool for drafting)
    // For copy-paste: 'hand' (Hand tool for grabbing and dragging)
    // For all other categories: remove other cursors and only keep the first one ('pointer')
    const categoryTool: AgentType = isText ? 'pen' : 'pointer';
    const initialTool: AgentType = isCopyPaste ? 'hand' : categoryTool;

    let boxEl: HTMLElement | undefined;
    let cloneEl: HTMLElement | undefined;

    if (isCopyPaste && sourceRect) {
      // Create ghost wireframe clone at source coordinates for Figma-style copy-paste glide
      cloneEl = this.overlayManager.createGhostClone(taskId, sourceRect);
    } else {
      // The box starts at size 0 anchored at the top-left edge (dragged open live by single agent)
      boxEl = this.overlayManager.createBoundingBox(
        taskId,
        rect,
        boxType,
        this.config.showDimensions,
        this.config.showGuides,
        { left: rect.left, top: rect.top, width: 0, height: 0, opacity: 0 }
      );
    }

    const task: ConstructionTask = {
      id: taskId,
      element,
      rect,
      boxType,
      assignedAgents: assigned.map((a) => a.id),
      borderRoles,
      phase: isCopyPaste ? 'CLONING' : 'EXPANDING',
      isCopyPaste,
      category,
      cursorType: initialTool,
      sourceRect,
      startTime: performance.now(),
      expandStartTime: performance.now(),
      expandDuration: isCopyPaste ? 320 : 280,
      duration: this.config.buildDuration,
      isText,
      boxElement: boxEl,
      cloneElement: cloneEl,
      completed: false,
    };

    this.tasks.set(taskId, task);

    // Save template for future same-size element matching
    this.constructedTemplates.push({ element, rect });
    if (this.constructedTemplates.length > 50) {
      this.constructedTemplates.shift();
    }

    const startPos =
      isCopyPaste && sourceRect
        ? vec(sourceRect.left + sourceRect.width / 2, sourceRect.top + sourceRect.height / 2)
        : vec(rect.left, rect.top);

    // Dispatch agents: lead agent uses the specialized tool (pen or hand or pointer), others use the primary pointer
    assigned.forEach((agent, idx) => {
      const role = borderRoles[idx % borderRoles.length] || 'top';
      const agentTool: AgentType = idx === 0 ? initialTool : 'pointer';
      agent.assignTarget(startPos, element, taskId, role, rect, agentTool, this.overlayManager);

      // When starting a new shape drag (not copy-paste), only the single lead agent is visible dragging the shape
      if (!isCopyPaste) {
        if (idx === 0) {
          agent.position.x = rect.left;
          agent.position.y = rect.top;
          agent.element.style.opacity = '1';
        } else {
          agent.element.style.opacity = '0';
          agent.position.x = rect.left + rect.width / 2;
          agent.position.y = rect.top + rect.height / 2;
        }
      }

      this.config.onAgentStateChange?.(agent.id, 'MOVING_TO_TARGET');
    });
  }

  /**
   * Completes a task, removes overlays, releases agents, and triggers the next queue item.
   */
  private completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.completed) return;

    task.completed = true;

    if (task.boxElement) {
      this.overlayManager.removeBoundingBox(task.boxElement, task.id);
      task.boxElement = undefined;
    }

    if (task.cloneElement) {
      this.overlayManager.removeGhostClone(task.cloneElement);
      task.cloneElement = undefined;
    }

    task.assignedAgents.forEach((agentId) => {
      const agent = this.agents.find((a) => a.id === agentId);
      if (agent && agent.assignedTaskId === taskId) {
        agent.returnToSwarm(this.overlayManager);
        this.config.onAgentStateChange?.(agent.id, 'RETURNING_TO_SWARM');
      }
    });

    this.tasks.delete(taskId);
    this.constructedCount++;
    this.config.onElementConstructed?.(task.element);

    this.processBuildQueue();
  }

  /**
   * Triggers the grand finale: all 18 cursors accelerate towards the user's cursor, swirl, and vanish.
   */
  private triggerConvergenceFinale(): void {
    this.isConverging = true;

    const targetPos = this.mousePos || vec(
      (window.innerWidth || 1024) / 2,
      (window.innerHeight || 768) / 2
    );

    this.agents.forEach((agent) => {
      agent.convergeTo(targetPos, this.overlayManager);
      this.config.onAgentStateChange?.(agent.id, 'CONVERGING_TO_USER');
    });

    setTimeout(() => {
      if (this.isConverging) {
        this.agents.forEach((agent) => {
          agent.state = 'VANISHED';
          agent.element.style.display = 'none';
        });
        this.isFinishedState = true;
        this.isConverging = false;
        this.config.onSwarmVanished?.();
      }
    }, 2500);
  }

  /**
   * Binds SPA client-side route change listeners for Next.js, React Router, Vue, Nuxt, SvelteKit, Turbo, etc.
   */
  private setupRouteListeners(): void {
    if (typeof window === 'undefined' || !this.config.rebuildOnRouteChange) return;

    this.lastUrl = window.location.href;

    const onRouteEvent = () => this.handleRouteChange();

    window.addEventListener('popstate', onRouteEvent);
    window.addEventListener('hashchange', onRouteEvent);

    // Framework-specific SPA view transition events
    window.addEventListener('turbo:load', onRouteEvent);
    window.addEventListener('turbolinks:load', onRouteEvent);
    window.addEventListener('astro:page-load', onRouteEvent);
    window.addEventListener('pjax:end', onRouteEvent);

    // Intercept pushState & replaceState for Next.js, React Router, Vue Router, Nuxt, SvelteKit
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const self = this;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      self.handleRouteChange();
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      self.handleRouteChange();
      return result;
    };

    this.unbindRouteListeners = () => {
      window.removeEventListener('popstate', onRouteEvent);
      window.removeEventListener('hashchange', onRouteEvent);
      window.removeEventListener('turbo:load', onRouteEvent);
      window.removeEventListener('turbolinks:load', onRouteEvent);
      window.removeEventListener('astro:page-load', onRouteEvent);
      window.removeEventListener('pjax:end', onRouteEvent);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }

  private handleRouteChange(): void {
    if (this.destroyed || !this.config.rebuildOnRouteChange) return;
    if (typeof window === 'undefined') return;

    if (this.routeChangeDebounce) {
      clearTimeout(this.routeChangeDebounce);
    }

    this.routeChangeDebounce = setTimeout(() => {
      const newUrl = window.location.href;
      if (newUrl === this.lastUrl && this.isFinishedState) return;
      this.lastUrl = newUrl;
      this.handlePageNavigation();
    }, 60);
  }

  /**
   * Public API: Reinitializes and launches the swarm construction sequence for a newly navigated page.
   * Cancels in-flight tasks, clears templates, scans the new page's DOM,
   * applies initial blank canvas hiding, respawns the 18 agents, and begins live construction.
   */
  public handlePageNavigation(): void {
    if (this.destroyed) return;

    // 1. Cancel in-flight tasks and clear existing overlays
    this.tasks.forEach((task) => {
      task.cancelEffect?.();
      if (task.boxElement) {
        this.overlayManager.removeBoundingBox(task.boxElement, task.id);
      }
      if (task.cloneElement) {
        this.overlayManager.removeGhostClone(task.cloneElement);
      }
    });
    this.tasks.clear();
    this.constructedTemplates = [];
    this.buildQueue = [];
    this.constructedCount = 0;
    this.isFinishedState = false;
    this.isConverging = false;

    // 2. Allow a brief tick for SPA frameworks (Next.js / React / Vue) to mount the new route components
    setTimeout(() => {
      if (this.destroyed) return;

      // 3. Scan and hide new page elements
      const elements = this.domScanner.scanAndIndex();
      this.buildQueue = [...elements];

      // 4. Respawn and reposition all 18 agents from the screen edges
      const width = window.innerWidth || 1024;
      const height = window.innerHeight || 768;

      this.agents.forEach((agent) => {
        const pos = vec(
          randomRange(width * 0.1, width * 0.9),
          randomRange(height * 0.1, height * 0.9)
        );
        agent.reset(pos, this.overlayManager);
      });

      // 5. Begin processing build queue for the new page
      setTimeout(() => {
        if (!this.destroyed) {
          this.processBuildQueue();
        }
      }, 150);
    }, 80);
  }

  /**
   * Adds an element to the queue dynamically.
   */
  private enqueueElement(element: HTMLElement): void {
    if (!this.buildQueue.includes(element)) {
      this.buildQueue.push(element);

      // If swarm has finished/vanished, wake up agents to build the newly added element!
      if (this.isFinishedState) {
        this.isFinishedState = false;
        this.isConverging = false;
        const width = window.innerWidth || 1024;
        const height = window.innerHeight || 768;

        this.agents.forEach((agent) => {
          if (agent.state === 'VANISHED') {
            const pos = vec(
              randomRange(width * 0.1, width * 0.9),
              randomRange(height * 0.1, height * 0.9)
            );
            agent.reset(pos, this.overlayManager);
          }
        });
      }

      this.processBuildQueue();
    }
  }

  /**
   * Synchronizes active bounding boxes, alignment guides, and agent border targets
   * during live scrolling or resizing.
   */
  private syncActiveBoundingBoxes(): void {
    if (this.tasks.size === 0) return;

    this.tasks.forEach((task) => {
      if (!task.boxElement || task.completed) return;
      const rect = task.element.getBoundingClientRect();
      task.rect = rect;

      if (task.phase === 'BUILDING') {
        this.overlayManager.updateBoundingBox(task.boxElement, rect, task.id);
      }

      // Keep border agents synchronized to the moving element boundaries
      task.assignedAgents.forEach((agentId) => {
        const agent = this.agents.find((a) => a.id === agentId);
        if (agent && agent.assignedTaskId === task.id) {
          agent.targetRect = rect;
        }
      });
    });
  }

  /**
   * Selects a team of 4 available agents closest to the element.
   */
  private pickTeamAgents(target: Vector2D, count: number): Agent[] {
    const idleAgents = this.agents.filter(
      (a) => a.state === 'IDLE_FLOCKING' || a.state === 'RETURNING_TO_SWARM'
    );

    // Group by teamId first if a complete team of 4 is idle
    const teamMap = new Map<number, Agent[]>();
    idleAgents.forEach((a) => {
      const list = teamMap.get(a.teamId) || [];
      list.push(a);
      teamMap.set(a.teamId, list);
    });

    // Check for an intact team of 4
    for (const [, teamList] of teamMap.entries()) {
      if (teamList.length >= count) {
        return teamList.slice(0, count);
      }
    }

    // Otherwise, pick the closest available agents
    idleAgents.sort((a, b) => {
      const distA = dist(a.position, target);
      const distB = dist(b.position, target);
      return distA - distB;
    });

    return idleAgents.slice(0, count);
  }

  /**
   * Public API: Replays the whole swarm construction from the beginning.
   */
  public replay(): void {
    if (this.destroyed) return;

    this.tasks.forEach((task) => {
      task.cancelEffect?.();
      if (task.boxElement) {
        this.overlayManager.removeBoundingBox(task.boxElement, task.id);
      }
      if (task.cloneElement) {
        this.overlayManager.removeGhostClone(task.cloneElement);
      }
    });
    this.tasks.clear();
    this.constructedTemplates = [];

    const elements = this.domScanner.scanAndIndex();
    this.buildQueue = [...elements];
    this.constructedCount = 0;
    this.isFinishedState = false;
    this.isConverging = false;

    const width = window.innerWidth || 1024;
    const height = window.innerHeight || 768;

    this.agents.forEach((agent) => {
      const pos = vec(
        randomRange(width * 0.1, width * 0.9),
        randomRange(height * 0.1, height * 0.9)
      );
      agent.reset(pos, this.overlayManager);
    });

    setTimeout(() => {
      this.processBuildQueue();
    }, 150);
  }

  /**
   * Public API: Manually trigger construction on an element immediately.
   */
  public async buildElement(element: HTMLElement): Promise<void> {
    if (this.destroyed) return;
    return new Promise<void>((resolve) => {
      const existingHandler = this.config.onElementConstructed;
      const onDone = (el: HTMLElement) => {
        if (el === element) resolve();
      };
      this.config.onElementConstructed = (el) => {
        existingHandler?.(el);
        onDone(el);
      };
      this.constructElement(element);
    });
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    if (this.paused) {
      this.paused = false;
      this.lastTime = performance.now();
      this.processBuildQueue();
    }
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public isFinished(): boolean {
    return this.isFinishedState;
  }

  public getConfig(): Readonly<ResolvedSwarmConfig> {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<SwarmConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    if (newConfig.maxSpeed !== undefined || newConfig.maxForce !== undefined) {
      this.agents.forEach((a) => {
        if (newConfig.maxSpeed !== undefined) a.maxSpeed = newConfig.maxSpeed;
        if (newConfig.maxForce !== undefined) a.maxForce = newConfig.maxForce;
      });
    }
  }

  public getActiveAgentCount(): number {
    return this.agents.filter((a) => a.state !== 'VANISHED').length;
  }

  public getMetrics(): SwarmMetrics {
    let idle = 0;
    let constructing = 0;
    let converging = 0;
    let vanished = 0;

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (!a) continue;
      if (a.state === 'VANISHED') {
        vanished++;
      } else if (a.state === 'CONVERGING_TO_USER') {
        converging++;
      } else if (a.state === 'IDLE_FLOCKING' || a.state === 'RETURNING_TO_SWARM') {
        idle++;
      } else if (a.state === 'CONSTRUCTING_ELEMENT' || a.state === 'MOVING_TO_TARGET') {
        constructing++;
      }
    }

    return {
      fps: this.currentFps,
      totalAgents: this.agents.length,
      idleAgents: idle,
      constructingAgents: constructing,
      convergingAgents: converging,
      vanishedAgents: vanished,
      elementsConstructed: this.constructedCount,
      elementsPending: this.buildQueue.length + this.tasks.size,
      isFinished: this.isFinishedState,
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('touchstart', this.onTouchMove);
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onResize);
    }

    if (this.unbindRouteListeners) {
      this.unbindRouteListeners();
      this.unbindRouteListeners = null;
    }

    if (this.routeChangeDebounce) {
      clearTimeout(this.routeChangeDebounce);
      this.routeChangeDebounce = null;
    }

    this.domScanner.destroy();

    this.tasks.forEach((task) => {
      task.cancelEffect?.();
      if (task.boxElement) {
        this.overlayManager.removeBoundingBox(task.boxElement, task.id);
      }
      if (task.cloneElement) {
        this.overlayManager.removeGhostClone(task.cloneElement);
      }
    });
    this.tasks.clear();
    this.constructedTemplates = [];
    this.buildQueue = [];

    this.agents.forEach((agent) => agent.destroy());
    this.agents = [];

    this.builderEffects.restoreAll();
    this.overlayManager.destroy();
  }
}
