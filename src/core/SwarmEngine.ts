import {
  DomSwarmInstance,
  ResolvedSwarmConfig,
  SwarmConfig,
  SwarmMetrics,
  Vector2D,
  BoundingBoxType,
} from '../types';
import { Agent } from './Agent';
import { BoidsPhysics } from './BoidsPhysics';
import { OverlayManager, ActiveRulerSegment, BoxRect } from '../dom/OverlayManager';
import { BuilderEffects } from '../dom/BuilderEffects';
import { DomScanner } from '../dom/DomScanner';
import { vec, dist, randomRange } from '../utils/math';

interface ActiveTask {
  id: string;
  element: HTMLElement;
  fullRect: BoxRect;
  currentRect: BoxRect;
  boxType: BoundingBoxType;
  assignedAgents: Agent[];
  targetPositions: Vector2D[];
  cornerRoles: ('tl' | 'br' | 'tr' | 'bl' | 'mt' | 'mb' | 'badge' | 'ibeam')[];
  phase: 'NAVIGATING' | 'DRAWING' | 'BUILDING' | 'DONE';
  phaseStartTime: number;
  boxElement: HTMLElement | null;
  isText: boolean;
  cancelReveal?: () => void;
}

const DEFAULT_CONFIG: ResolvedSwarmConfig = {
  agentCount: 36,
  colors: ['#00A3FF', '#00C48C', '#FFAA00', '#FF007A', '#7B61FF', '#F24822', '#00E5FF', '#69DB7C'],
  selector: '.swarm-item, .price-card, .interactive-card, .metric-card, .code-box, .hero-pill, header.navbar, .hero h1, .hero p, .hero-actions button, .swarm-card',
  ignoreSelector: '[data-no-swarm], script, style, noscript, dom-swarm-overlay, .swarm-hud, .swarm-initial-hero',
  buildOnScroll: true,
  hideOnStart: true,
  showRulers: true,
  showGuides: true,
  showDimensions: true,
  typewriterEffect: true,
  concurrency: 1, // Sequential one-by-one element construction
  vanishAtCursor: true,
  buildOrder: 'top-to-bottom',
  showAgentNames: false,
  followMouse: true,
  maxSpeed: 10.0,
  maxForce: 0.45,
  buildDuration: 450,
  flockRadius: 85,
  separateDistance: 55,
  mouseAttractRadius: 220,
  mouseAttractForce: 0.45,
  typewriterSpeed: 16,
  customAgentNames: [
    'Figma AI',
    'Cursor-01',
    'Copilot',
    'Agent-α',
    'Agent-β',
    'PixelCraft',
    'Architect',
    'DevBot',
  ],
  debug: false,
};

/**
 * Main orchestrator of dom-swarm:
 * When idle at top, 36 cursors orbit around the initial center logo.
 * As user scrolls, cursors actively swarm visible incoming elements, draw Figma blue boxes,
 * handles, and alignment guides, typing text with I-beams, not automatically on a timer.
 */
export class SwarmEngine implements DomSwarmInstance {
  private config: ResolvedSwarmConfig;
  private overlayManager: OverlayManager;
  private builderEffects: BuilderEffects;
  private domScanner: DomScanner;

  private agents: Agent[] = [];
  private activeTasks = new Map<string, ActiveTask>();
  private buildQueue: HTMLElement[] = [];
  private completedElements = new Set<HTMLElement>();
  private activeBoxTypeToggle = false;

  private mousePos: Vector2D | null = null;
  private lastMouseMoveTime = 0;
  private isMouseActive = false;

  private hasUserScrolled = false;
  private initialLogoCenter: Vector2D | null = null;

  private animFrameId: number | null = null;
  private lastTime = 0;
  private paused = false;
  private destroyed = false;
  private isFinishedState = false;

  // Performance telemetry
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 60;
  private constructedCount = 0;

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
   * Initializes overlay, agents, input listeners, and starts the simulation loop.
   */
  private init(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // 1. Mount Shadow DOM container with Figma rulers
    this.overlayManager.mount(this.config.showRulers);

    // Initial rulers are hidden until user starts scrolling
    this.overlayManager.setRulersVisible(false);

    // 2. Identify initial logo center (e.g. #swarmLogo or screen center)
    this.detectInitialLogoCenter();

    // 3. Spawn 36 cursor agents around the initial center
    this.spawnAgents();

    // 4. Register scroll & pointer listeners
    this.bindEvents();

    // 5. Index elements below the fold
    const elements = this.domScanner.init();
    this.buildQueue = [...elements];

    // 6. Start simulation loop
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
    this.animFrameId = requestAnimationFrame(this.renderLoop);

    // If user loaded the page already scrolled down, trigger construction immediately
    if (window.scrollY > 40) {
      this.hasUserScrolled = true;
      this.overlayManager.setRulersVisible(true);
      this.processBuildQueue();
    }
  }

  /**
   * Detects the initial center logo element if present on the page.
   */
  private detectInitialLogoCenter(): void {
    const logoEl = document.querySelector<HTMLElement>('#swarmCenterLogo, .swarm-initial-hero, .logo');
    if (logoEl) {
      const rect = logoEl.getBoundingClientRect();
      this.initialLogoCenter = vec(rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else {
      this.initialLogoCenter = vec(
        (window.innerWidth || 1024) / 2,
        (window.innerHeight || 768) / 2
      );
    }
  }

  /**
   * Spawns 36 cursor agents clustered in an orbit around the center.
   */
  private spawnAgents(): void {
    const center = this.initialLogoCenter || vec(
      (window.innerWidth || 1024) / 2,
      (window.innerHeight || 768) / 2
    );

    for (let i = 0; i < this.config.agentCount; i++) {
      const color = this.config.colors[i % this.config.colors.length] || '#00A3FF';
      const label =
        this.config.customAgentNames[i % this.config.customAgentNames.length] ||
        `Agent-${i + 1}`;

      // Distribute in an elliptical ring around center logo
      const angle = (i / this.config.agentCount) * Math.PI * 2;
      const radiusX = 140 + (i % 3) * 20;
      const radiusY = 95 + (i % 3) * 15;

      const pos = vec(
        center.x + Math.cos(angle) * radiusX + randomRange(-10, 10),
        center.y + Math.sin(angle) * radiusY + randomRange(-10, 10)
      );

      const agent = new Agent(
        i + 1,
        color,
        label,
        pos,
        this.overlayManager,
        this.config.maxSpeed,
        this.config.maxForce,
        this.config.showAgentNames
      );

      this.agents.push(agent);
    }
  }

  /**
   * Binds pointer, touch, scroll, and resize listeners.
   */
  private bindEvents(): void {
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('touchstart', this.onTouchMove, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });
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

  /**
   * Scroll event listener: drives the construction of elements strictly as user scrolls.
   */
  private onScroll = (): void => {
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (!this.hasUserScrolled && scrollY > 5) {
      this.hasUserScrolled = true;
      const intro = document.getElementById('swarmCenterLogo') || document.getElementById('introLogo');
      if (intro) intro.classList.add('gone');
      if (this.config.showRulers) {
        this.overlayManager.setRulersVisible(true);
      }
    }

    // Check if user has reached bottom of page
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const isAtBottom = scrollY + clientHeight >= scrollHeight - 60;

    if (isAtBottom && this.buildQueue.length === 0 && this.activeTasks.size === 0 && !this.isFinishedState) {
      // At bottom: hide rulers and let cursors converge into user pointer or flock at footer
      this.overlayManager.setRulersVisible(false);
      this.isFinishedState = true;
      if (this.config.vanishAtCursor) {
        this.triggerVanishAtCursor();
      }
    }

    // Process elements entering viewport during active scrolling
    this.syncActiveBoundingBoxes();
    this.processBuildQueue();
  };

  private onResize = (): void => {
    this.detectInitialLogoCenter();
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

      // Telemetry calculation
      this.frameCount++;
      if (timestamp - this.lastFpsUpdate >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdate));
        this.frameCount = 0;
        this.lastFpsUpdate = timestamp;
      }

      if (this.isMouseActive && timestamp - this.lastMouseMoveTime > 2500) {
        this.isMouseActive = false;
      }

      // Update active tasks (NAVIGATING -> BUILDING -> DONE)
      this.updateActiveTasks(timestamp);

      // Determine orbit focal center:
      // If user has not scrolled yet, orbit around center logo!
      const viewport = {
        width: window.innerWidth || 1024,
        height: window.innerHeight || 768,
      };

      const scrollY = window.scrollY || 0;
      const timeSeconds = timestamp / 1000;
      const activeList = Array.from(this.activeTasks.values());

      // Update agent physics and transforms
      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        if (!agent || agent.state === 'VANISHED') continue;

        if (agent.state === 'IDLE_FLOCKING' || agent.state === 'RETURNING_TO_SWARM') {
          let agentFocal: Vector2D | null = null;
          if (!this.hasUserScrolled && scrollY < 5) {
            agentFocal = this.initialLogoCenter || vec(viewport.width / 2, viewport.height / 2);
          } else if (this.isMouseActive && this.mousePos) {
            agentFocal = this.mousePos;
          } else if (activeList.length > 0) {
            const task = activeList[i % activeList.length];
            if (task) {
              agentFocal = vec(
                task.currentRect.left + task.currentRect.width / 2,
                task.currentRect.top + task.currentRect.height / 2
              );
            }
          } else if (this.buildQueue.length > 0 && this.buildQueue[0]) {
            const nextEl = this.buildQueue[0];
            const r = nextEl.getBoundingClientRect();
            agentFocal = vec(r.left + r.width / 2, r.top + r.height / 2);
          } else {
            agentFocal = vec(viewport.width / 2, viewport.height / 2);
          }

          const force = BoidsPhysics.calculateFlockingForces(
            agent,
            this.agents,
            agentFocal,
            this.config,
            viewport,
            timeSeconds
          );
          agent.applyForce(force);

          if (agent.state === 'RETURNING_TO_SWARM') {
            const vSq = agent.velocity.x * agent.velocity.x + agent.velocity.y * agent.velocity.y;
            if (vSq < 4.0) {
              agent.setIdle();
              this.config.onAgentStateChange?.(agent.id, 'IDLE_FLOCKING');
            }
          }
        } else if (agent.state === 'MOVING_TO_TARGET') {
          if (agent.targetPosition) {
            const seekForce = BoidsPhysics.seek(agent, agent.targetPosition, 50);
            agent.applyForce(seekForce);
          }
        } else if (agent.state === 'CONSTRUCTING_ELEMENT') {
          // Absolute edge/corner handle locking is maintained in syncActiveBoundingBoxes
        } else if (agent.state === 'CONVERGING_TO_USER') {
          if (this.mousePos) {
            agent.targetPosition = { ...this.mousePos };
          }
          if (agent.targetPosition) {
            const seekForce = BoidsPhysics.seek(agent, agent.targetPosition, 60);
            agent.applyForce(seekForce);
          }
        }

        agent.update(dt, this.overlayManager);
      }

      // Keep bounding boxes and ruler coordinate segments locked to active elements
      this.syncActiveBoundingBoxes();
    }

    this.animFrameId = requestAnimationFrame(this.renderLoop);
  };

  /**
   * Advances active construction tasks through NAVIGATING -> DRAWING -> BUILDING -> DONE phases.
   */
  private updateActiveTasks(timestamp: number): void {
    if (this.activeTasks.size === 0) return;

    this.activeTasks.forEach((task) => {
      if (task.phase === 'NAVIGATING') {
        let hasArrived = false;
        for (let i = 0; i < task.assignedAgents.length; i++) {
          const a = task.assignedAgents[i];
          const target = task.targetPositions[i] || task.targetPositions[0];
          if (a && target && dist(a.position, target) < 45) {
            hasArrived = true;
            break;
          }
        }

        const elapsed = timestamp - task.phaseStartTime;
        if (hasArrived || elapsed > 250) {
          // Cursors reached origin: START LIVE DIAGONAL BOX DRAWING!
          task.phase = 'DRAWING';
          task.phaseStartTime = timestamp;
          const liveRect = task.element.getBoundingClientRect();
          task.fullRect = liveRect;
          task.currentRect = {
            left: liveRect.left,
            top: liveRect.top,
            width: 12,
            height: 12,
          };

          task.boxElement = this.overlayManager.createBoundingBox(
            task.id,
            task.currentRect,
            task.boxType,
            this.config.showDimensions,
            this.config.showGuides
          );

          if (this.config.showRulers) {
            this.overlayManager.setRulersVisible(true);
          }
        }
      } else if (task.phase === 'DRAWING') {
        const elapsed = timestamp - task.phaseStartTime;
        const drawDuration = 220; // 220ms fast diagonal drag
        const progress = Math.min(elapsed / drawDuration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        const liveRect = task.element.getBoundingClientRect();
        task.fullRect = liveRect;

        const curW = Math.max(12, ease * liveRect.width);
        const curH = Math.max(12, ease * liveRect.height);

        task.currentRect = {
          left: liveRect.left,
          top: liveRect.top,
          width: curW,
          height: curH,
        };

        if (task.boxElement) {
          this.overlayManager.updateBoundingBox(task.boxElement, task.currentRect, task.id);
        }

        // DRAG AGENTS WITH THE EXPANDING BOX:
        task.assignedAgents.forEach((agent, i) => {
          const role = task.cornerRoles[i] || (i === 0 ? 'tl' : 'br');
          let targetX = liveRect.left;
          let targetY = liveRect.top;
          let heading = -20;

          if (role === 'tl') {
            targetX = liveRect.left;
            targetY = liveRect.top;
            heading = -20;
          } else if (role === 'br') {
            targetX = liveRect.left + curW;
            targetY = liveRect.top + curH;
            heading = -45;
          } else if (role === 'tr') {
            targetX = liveRect.left + curW;
            targetY = liveRect.top;
            heading = -65;
          } else if (role === 'bl') {
            targetX = liveRect.left;
            targetY = liveRect.top + curH;
            heading = 25;
          } else if (role === 'mt') {
            targetX = liveRect.left + curW / 2;
            targetY = liveRect.top;
            heading = -30;
          } else if (role === 'mb') {
            targetX = liveRect.left + curW / 2;
            targetY = liveRect.top + curH;
            heading = 30;
          } else if (role === 'badge') {
            targetX = liveRect.left + curW / 2;
            targetY = liveRect.top + curH + 16;
            heading = 0;
          } else if (role === 'ibeam') {
            targetX = liveRect.left + 8;
            targetY = liveRect.top + curH / 2;
            heading = 0;
          }

          agent.position.x = targetX;
          agent.position.y = targetY;
          agent.velocity = vec(0, 0);
          agent.acceleration = vec(0, 0);
          agent.headingAngle = heading;
        });

        if (progress >= 1) {
          // Drawing complete! Now reveal element content while cursors hold handles
          task.phase = 'BUILDING';
          task.phaseStartTime = timestamp;

          task.assignedAgents.forEach((a) => {
            a.setConstructing();
            this.config.onAgentStateChange?.(a.id, 'CONSTRUCTING_ELEMENT');
          });

          task.cancelReveal = this.builderEffects.executeReveal(
            task.element,
            task.isText,
            this.config.typewriterEffect,
            this.config.buildDuration,
            () => {
              this.completeTask(task.id);
            }
          );
        }
      }
    });
  }

  /**
   * Processes elements from the queue when scrolling brings them into view (not automatically).
   */
  private processBuildQueue(): void {
    if (this.destroyed || this.paused) return;

    // Only construct elements if the user has started scrolling
    const scrollY = window.scrollY || window.pageYOffset || 0;
    if (!this.hasUserScrolled && scrollY < 5) return;

    // STRICTLY ONE-BY-ONE: Never build multiple elements simultaneously if concurrency is 1
    if (this.activeTasks.size >= this.config.concurrency) return;

    while (this.buildQueue.length > 0) {
      const visibleIndex = this.buildQueue.findIndex((el) => this.isElementInScrollWindow(el));
      if (visibleIndex < 0) break; // Next elements are not visible yet! Wait for user scroll!

      const nextElement = this.buildQueue.splice(visibleIndex, 1)[0];
      if (nextElement && !this.completedElements.has(nextElement)) {
        this.constructElement(nextElement);
        // STRICTLY ONE AT A TIME: Launch this element, then wait for it to finish!
        break;
      }
    }

    if (this.buildQueue.length === 0 && this.activeTasks.size === 0 && !this.isFinishedState) {
      this.config.onAllElementsConstructed?.();
      this.overlayManager.setRulersVisible(false);
      this.isFinishedState = true;
      if (this.config.vanishAtCursor) {
        this.triggerVanishAtCursor();
      }
    }
  }

  /**
   * Checks whether an element is inside the current scroll window.
   */
  private isElementInScrollWindow(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    const vHeight = window.innerHeight || 800;
    const vWidth = window.innerWidth || 1024;
    return (
      rect.bottom > -40 &&
      rect.right > 0 &&
      rect.top < vHeight + 180 &&
      rect.left < vWidth
    );
  }

  /**
   * Determines how many agents should construct a given element.
   * Large blocks receive 7 agents (4 corners, 2 edges, 1 badge).
   * Text nodes receive 4 agents (I-beam typing, TL, BR, badge).
   */
  private getRequiredAgentCount(isText: boolean, rect: DOMRect): number {
    if (isText) {
      return 4; // 1 ibeam + 1 tl + 1 br + 1 badge
    }
    // Block element: cards, terminals, pricing cards, hero container, code blocks
    if (rect.width >= 120 && rect.height >= 40) {
      return 7; // tl, br, tr, bl, mt, mb, badge
    }
    return 4; // tl, br, tr, bl
  }

  /**
   * Dispatches agents to an element's edges/corners to construct it live.
   */
  private constructElement(element: HTMLElement): void {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const rect = element.getBoundingClientRect();

    if (rect.width < 5 || rect.height < 5) {
      this.builderEffects.executeReveal(element, false, false, 50, () => {
        this.constructedCount++;
        this.completedElements.add(element);
        this.processBuildQueue();
      });
      return;
    }

    const isText = BuilderEffects.isTextElement(element);
    const boxType = this.activeBoxTypeToggle ? 'red' : 'blue';
    this.activeBoxTypeToggle = !this.activeBoxTypeToggle;

    const elementCenter = vec(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const needed = this.getRequiredAgentCount(isText, rect);
    const assigned = this.pickNearestAgents(elementCenter, needed);

    if (assigned.length === 0) {
      // Put back in queue to build when agents finish current work - never auto-reveal without cursors!
      this.buildQueue.unshift(element);
      return;
    }

    // Assign corner/edge roles to agents
    const cornerRoles: ('tl' | 'br' | 'tr' | 'bl' | 'mt' | 'mb' | 'badge' | 'ibeam')[] = [];
    const targets: Vector2D[] = [];

    if (isText) {
      cornerRoles.push('ibeam');
      targets.push(vec(rect.left + 8, rect.top + rect.height / 2));
      cornerRoles.push('tl');
      targets.push(vec(rect.left, rect.top));
      cornerRoles.push('br');
      targets.push(vec(rect.right, rect.bottom));
      if (assigned.length > 3) {
        cornerRoles.push('badge');
        targets.push(vec(rect.left + rect.width / 2, rect.bottom + 16));
      }
    } else {
      const allRoles: ('tl' | 'br' | 'tr' | 'bl' | 'mt' | 'mb' | 'badge')[] = [
        'tl', 'br', 'tr', 'bl', 'mt', 'mb', 'badge'
      ];
      for (let i = 0; i < assigned.length; i++) {
        const role = allRoles[i] || 'br';
        cornerRoles.push(role);
        if (role === 'tl') targets.push(vec(rect.left, rect.top));
        else if (role === 'br') targets.push(vec(rect.right, rect.bottom));
        else if (role === 'tr') targets.push(vec(rect.right, rect.top));
        else if (role === 'bl') targets.push(vec(rect.left, rect.bottom));
        else if (role === 'mt') targets.push(vec(rect.left + rect.width / 2, rect.top));
        else if (role === 'mb') targets.push(vec(rect.left + rect.width / 2, rect.bottom));
        else if (role === 'badge') targets.push(vec(rect.left + rect.width / 2, rect.bottom + 16));
      }
    }

    const task: ActiveTask = {
      id: taskId,
      element,
      fullRect: rect,
      currentRect: {
        left: rect.left,
        top: rect.top,
        width: 12,
        height: 12,
      },
      boxType,
      assignedAgents: assigned,
      targetPositions: targets,
      cornerRoles,
      phase: 'NAVIGATING',
      phaseStartTime: performance.now(),
      boxElement: null,
      isText,
    };

    this.activeTasks.set(taskId, task);

    // Dispatch cursors directly to origin with speed boost
    assigned.forEach((agent, idx) => {
      const targetCoord = targets[idx] || elementCenter;
      const isIBeamRole = isText && cornerRoles[idx] === 'ibeam';
      agent.assignTarget(targetCoord, element, taskId, isIBeamRole, this.overlayManager);
      this.config.onAgentStateChange?.(agent.id, 'MOVING_TO_TARGET');
    });
  }

  /**
   * Completes a task, removes bounding box, releases agents, and processes next elements.
   */
  private completeTask(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (!task || task.phase === 'DONE') return;

    task.phase = 'DONE';

    if (task.boxElement) {
      this.overlayManager.removeBoundingBox(task.boxElement, task.id);
    }

    task.assignedAgents.forEach((agent) => {
      if (agent.assignedTaskId === taskId) {
        agent.returnToSwarm(this.overlayManager);
        this.config.onAgentStateChange?.(agent.id, 'RETURNING_TO_SWARM');
      }
    });

    this.completedElements.add(task.element);
    this.activeTasks.delete(taskId);
    this.constructedCount++;
    this.config.onElementConstructed?.(task.element);

    this.processBuildQueue();
  }

  /**
   * Adds an element dynamically.
   */
  private enqueueElement(element: HTMLElement): void {
    if (!this.buildQueue.includes(element) && !this.completedElements.has(element)) {
      this.buildQueue.push(element);
      this.processBuildQueue();
    }
  }

  /**
   * Synchronizes active bounding boxes, locks assigned agents directly onto edges/corners,
   * and updates top/left ruler coordinate segments.
   */
  private syncActiveBoundingBoxes(): void {
    if (this.activeTasks.size === 0) {
      if (this.config.showRulers) {
        this.overlayManager.updateRulerSegments([]);
      }
      return;
    }

    const rulerSegments: ActiveRulerSegment[] = [];

    this.activeTasks.forEach((task) => {
      const liveRect = task.element.getBoundingClientRect();
      task.fullRect = liveRect;

      if (task.phase === 'BUILDING') {
        task.currentRect = {
          left: liveRect.left,
          top: liveRect.top,
          width: liveRect.width,
          height: liveRect.height,
        };

        if (task.boxElement) {
          this.overlayManager.updateBoundingBox(task.boxElement, task.currentRect, task.id);
          rulerSegments.push({
            left: task.currentRect.left,
            width: task.currentRect.width,
            top: task.currentRect.top,
            height: task.currentRect.height,
          });
        }

        // Lock assigned agents firmly onto the corners and edges of the bounding box
        const elapsed = performance.now() - task.phaseStartTime;
        task.assignedAgents.forEach((agent, i) => {
          const role = task.cornerRoles[i] || (i === 0 ? 'tl' : 'br');
          let targetX = liveRect.left;
          let targetY = liveRect.top;
          let heading = -20;

          if (role === 'tl') {
            targetX = liveRect.left;
            targetY = liveRect.top;
            heading = -20;
          } else if (role === 'br') {
            targetX = liveRect.right;
            targetY = liveRect.bottom;
            heading = -45;
          } else if (role === 'tr') {
            targetX = liveRect.right;
            targetY = liveRect.top;
            heading = -65;
          } else if (role === 'bl') {
            targetX = liveRect.left;
            targetY = liveRect.bottom;
            heading = 25;
          } else if (role === 'mt') {
            targetX = liveRect.left + liveRect.width / 2;
            targetY = liveRect.top;
            heading = -30;
          } else if (role === 'mb') {
            targetX = liveRect.left + liveRect.width / 2;
            targetY = liveRect.bottom;
            heading = 30;
          } else if (role === 'badge') {
            targetX = liveRect.left + liveRect.width / 2;
            targetY = liveRect.bottom + 16;
            heading = 0;
          } else if (role === 'ibeam') {
            const buildDur = Math.max(this.config.buildDuration, 100);
            const progress = Math.min(elapsed / (buildDur * 0.75), 1);
            const textWidth = Math.min(
              liveRect.width - 16,
              Math.max(30, (task.element.textContent?.length || 10) * 8)
            );
            targetX = liveRect.left + 8 + progress * textWidth;
            targetY = liveRect.top + liveRect.height / 2;
            heading = 0;
          }

          agent.position.x = targetX;
          agent.position.y = targetY;
          agent.velocity = vec(0, 0);
          agent.acceleration = vec(0, 0);
          agent.headingAngle = heading;
        });
      } else if (task.phase === 'DRAWING') {
        rulerSegments.push({
          left: task.currentRect.left,
          width: task.currentRect.width,
          top: task.currentRect.top,
          height: task.currentRect.height,
        });
      } else if (task.phase === 'NAVIGATING') {
        // Keep targetPositions updated with live rect origin during scroll navigation
        task.assignedAgents.forEach((_, i) => {
          task.targetPositions[i] = vec(liveRect.left, liveRect.top);
        });
      }
    });

    if (this.config.showRulers) {
      this.overlayManager.updateRulerSegments(rulerSegments);
    }
  }

  /**
   * Directs all agents to accelerate and converge into the user's cursor, then vanish.
   */
  private triggerVanishAtCursor(): void {
    const targetUserPos = this.mousePos || vec(
      (window.innerWidth || 1024) / 2,
      (window.innerHeight || 768) / 2
    );
    this.agents.forEach((agent) => {
      agent.convergeTo(targetUserPos, this.overlayManager);
      this.config.onAgentStateChange?.(agent.id, 'CONVERGING_TO_USER');
    });

    const checkInterval = setInterval(() => {
      if (this.destroyed) {
        clearInterval(checkInterval);
        return;
      }
      const activeCount = this.getActiveAgentCount();
      if (activeCount === 0) {
        clearInterval(checkInterval);
        this.config.onSwarmVanished?.();
      }
    }, 100);
  }

  /**
   * Selects nearest available agents for a construction assignment.
   */
  private pickNearestAgents(target: Vector2D, count: number): Agent[] {
    const idleAgents = this.agents.filter(
      (a) => a.state === 'IDLE_FLOCKING' || a.state === 'RETURNING_TO_SWARM'
    );

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

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const intro = document.getElementById('swarmCenterLogo') || document.getElementById('introLogo');
    if (intro) intro.classList.remove('gone');

    this.activeTasks.forEach((task) => {
      task.cancelReveal?.();
      if (task.boxElement) {
        this.overlayManager.removeBoundingBox(task.boxElement, task.id);
      }
    });
    this.activeTasks.clear();
    this.completedElements.clear();

    const elements = this.domScanner.scanAndIndex();
    this.buildQueue = [...elements];
    this.constructedCount = 0;
    this.isFinishedState = false;
    this.hasUserScrolled = false;
    this.overlayManager.setRulersVisible(false);

    this.detectInitialLogoCenter();
    const center = this.initialLogoCenter || vec(
      (window.innerWidth || 1024) / 2,
      (window.innerHeight || 768) / 2
    );

    this.agents.forEach((agent, i) => {
      const angle = (i / this.agents.length) * Math.PI * 2;
      const radiusX = 140 + (i % 3) * 20;
      const radiusY = 95 + (i % 3) * 15;
      const pos = vec(
        center.x + Math.cos(angle) * radiusX,
        center.y + Math.sin(angle) * radiusY
      );
      agent.reset(pos, this.overlayManager);
    });
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

  /**
   * Public API: Pauses simulation.
   */
  public pause(): void {
    this.paused = true;
  }

  /**
   * Public API: Resumes simulation.
   */
  public resume(): void {
    if (this.paused) {
      this.paused = false;
      this.lastTime = performance.now();
      this.processBuildQueue();
    }
  }

  /**
   * Public API: Check if paused.
   */
  public isPaused(): boolean {
    return this.paused;
  }

  /**
   * Public API: Check if finished building all elements.
   */
  public isFinished(): boolean {
    return this.isFinishedState;
  }

  /**
   * Public API: Retrieve read-only configuration.
   */
  public getConfig(): Readonly<ResolvedSwarmConfig> {
    return { ...this.config };
  }

  /**
   * Public API: Update configuration dynamically.
   */
  public updateConfig(newConfig: Partial<SwarmConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    if (newConfig.maxSpeed !== undefined || newConfig.maxForce !== undefined) {
      this.agents.forEach((a) => {
        if (newConfig.maxSpeed !== undefined) {
          a.defaultMaxSpeed = newConfig.maxSpeed;
          a.maxSpeed = newConfig.maxSpeed;
        }
        if (newConfig.maxForce !== undefined) {
          a.defaultMaxForce = newConfig.maxForce;
          a.maxForce = newConfig.maxForce;
        }
      });
    }
  }

  /**
   * Public API: Returns total active agent count.
   */
  public getActiveAgentCount(): number {
    return this.agents.filter((a) => a.state !== 'VANISHED').length;
  }

  /**
   * Public API: Returns diagnostic metrics.
   */
  public getMetrics(): SwarmMetrics {
    let idle = 0;
    let constructing = 0;

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (!a) continue;
      if (a.state === 'IDLE_FLOCKING' || a.state === 'RETURNING_TO_SWARM') {
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
      convergingAgents: 0,
      vanishedAgents: 0,
      elementsConstructed: this.constructedCount,
      elementsPending: this.buildQueue.length + this.activeTasks.size,
      isFinished: this.isFinishedState,
    };
  }

  /**
   * Complete teardown: restores all native styles, stops RAF loop, unbinds events, removes overlay.
   */
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

    this.domScanner.destroy();

    this.activeTasks.forEach((task) => {
      task.cancelReveal?.();
      if (task.boxElement) {
        this.overlayManager.removeBoundingBox(task.boxElement, task.id);
      }
    });
    this.activeTasks.clear();
    this.buildQueue = [];
    this.completedElements.clear();

    this.agents.forEach((agent) => agent.destroy());
    this.agents = [];

    this.builderEffects.restoreAll();
    this.overlayManager.destroy();
  }
}
