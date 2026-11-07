import {
  DomSwarmInstance,
  ResolvedSwarmConfig,
  SwarmConfig,
  SwarmMetrics,
  Vector2D,
  OverlayItem,
  ConstructionTask,
} from '../types';
import { Agent } from './Agent';
import { BoidsPhysics } from './BoidsPhysics';
import { OverlayManager, BoxRect } from '../dom/OverlayManager';
import { BuilderEffects } from '../dom/BuilderEffects';
import { DomScanner } from '../dom/DomScanner';
import { vec, randomRange } from '../utils/math';

const DEFAULT_CONFIG: ResolvedSwarmConfig = {
  agentCount: 36,
  colors: [
    '#F24E1E',
    '#A259FF',
    '#1ABCFE',
    '#0ACF83',
    '#FF7262',
    '#FFC700',
    '#9747FF',
    '#E8467C',
    '#14AE5C',
    '#0D99FF',
    '#FF8A00',
    '#00B5CE',
  ],
  selector:
    '.swarm-item, .price-card, .interactive-card, .metric-card, .code-box, .hero-pill, header.navbar, .hero h1, .hero p, .hero-actions button, .swarm-card',
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
    'Ada',
    'Linus',
    'Grace',
    'Alan',
    'Margaret',
    'Ken',
    'Barbara',
    'Dennis',
    'Radia',
    'Guido',
    'Frances',
    'Bjarne',
    'Hedy',
    'Tim',
    'Katherine',
    'Edsger',
    'Joan',
    'Donald',
  ],
  debug: false,
};

/**
 * Main orchestrator of dom-swarm:
 * When idle at top, 36 cursors swirl smoothly around the initial center logo.
 * As user scrolls, cursors actively construct the webpage using Figma tools:
 * Crosshair rectangles with live dimensions, I-Beam text typing with carets,
 * Alt-drag duplications with red measurement lines, and ruler alignment guidelines.
 */
export class SwarmEngine implements DomSwarmInstance {
  private config: ResolvedSwarmConfig;
  private overlayManager: OverlayManager;
  private builderEffects: BuilderEffects;
  private domScanner: DomScanner;

  private agents: Agent[] = [];
  private tasks: ConstructionTask[] = [];
  private taskMap = new Map<string, ConstructionTask>();
  private completedTaskIds = new Set<string>();
  private activeTask: ConstructionTask | null = null;

  private mousePos: Vector2D | null = null;
  private lastMousePos: Vector2D | null = null;
  private mouseVelocity: Vector2D = vec(0, 0);

  private started = false;
  private flocking = false;
  private time = 0;
  private lastTime = 0;
  private tempo = 2.1;
  private scrollVel = 0;
  private lastScrollY = 0;
  private scrollFrontier = 0;

  private rulersWant = 0;
  private rulerT = 0;
  private lastRulerNeed = -10;

  private initialLogoCenter: Vector2D | null = null;
  private introLogoEl: HTMLElement | null = null;

  private animFrameId: number | null = null;
  private paused = false;
  private destroyed = false;
  private isFinishedState = false;

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
      onElementDiscovered: (el) => this.onElementDiscovered(el),
    });

    this.init();
  }

  /**
   * Initializes overlay, agents, input listeners, and starts the simulation loop.
   */
  private init(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // 1. Mount Shadow DOM container
    this.overlayManager.mount(this.config.showRulers);
    this.overlayManager.setRulersProgress(0);

    // 2. Locate initial center logo
    this.detectInitialLogoCenter();

    // 3. Spawn cursor agents
    this.spawnAgents();

    // 4. Register listeners
    this.bindEvents();

    // 5. Index elements and build task graph
    const elements = this.domScanner.init();
    this.tasks = this.domScanner.buildTaskGraph(elements);
    this.tasks.forEach((t) => this.taskMap.set(t.id, t));

    // 6. Start simulation loop
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
    this.animFrameId = requestAnimationFrame(this.renderLoop);
  }

  /**
   * Detects initial logo center (e.g. .swarm-initial-hero or viewport center).
   */
  private detectInitialLogoCenter(): void {
    this.introLogoEl =
      document.querySelector<HTMLElement>('.swarm-initial-hero') ||
      document.querySelector<HTMLElement>('.intro-logo') ||
      document.querySelector<HTMLElement>('#swarmLogo');

    if (this.introLogoEl) {
      const rect = this.introLogoEl.getBoundingClientRect();
      this.initialLogoCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    } else {
      this.initialLogoCenter = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
    }
  }

  /**
   * Spawns cursor agents in a swirling ring around the center logo.
   */
  private spawnAgents(): void {
    const center = this.initialLogoCenter || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    const count = this.config.agentCount;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 160;
      const initialPos = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };

      const color = this.config.colors[i % this.config.colors.length] || '#0D99FF';
      const name = this.config.customAgentNames[i % this.config.customAgentNames.length] || `Agent-${i}`;

      const agent = new Agent(
        i,
        color,
        name,
        initialPos,
        this.overlayManager,
        this.config.maxSpeed,
        this.config.maxForce,
        this.config.showAgentNames
      );

      agent.follow = true;
      agent.home = i < 6 ? { x: initialPos.x, y: initialPos.y } : null;
      this.agents.push(agent);
    }
  }

  /**
   * Binds scroll, mouse, and resize event handlers.
   */
  private bindEvents(): void {
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('touchstart', this.onTouchMove, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.mousePos = { x: e.clientX, y: e.clientY };
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length > 0 && e.touches[0]) {
      this.mousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  private onScroll = (): void => {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    if (scrollY > 4 && !this.started) {
      this.start();
    }
  };

  private onWheel = (): void => {
    if (!this.started) {
      this.start();
    }
  };

  private onResize = (): void => {
    this.detectInitialLogoCenter();
  };

  private onElementDiscovered(el: HTMLElement): void {
    if (!this.taskMap.has(el.id)) {
      const freshTasks = this.domScanner.buildTaskGraph([el]);
      freshTasks.forEach((t) => {
        this.tasks.push(t);
        this.taskMap.set(t.id, t);
      });
    }
  }

  /**
   * Starts agentic construction: fades intro logo and releases cursors.
   */
  public start(): void {
    if (this.started) return;
    this.started = true;

    if (this.introLogoEl) {
      this.introLogoEl.classList.add('gone');
    }

    for (const a of this.agents) {
      a.follow = false;
      a.gen = null;
      a.angle = (((a.angle + 180) % 360) + 360) % 360 - 180;
    }

    this.rulersWant++;
    this.lastRulerNeed = this.time;
  }

  /**
   * Main animation frame simulation loop.
   */
  private renderLoop = (timestamp: number): void => {
    if (this.destroyed) return;

    const rawDt = (timestamp - this.lastTime) / 1000;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.lastTime = timestamp;
    this.time += dt;

    if (!this.paused) {
      this.step(dt);
    }

    this.frameCount++;
    if (timestamp - this.lastFpsUpdate >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
    }

    this.animFrameId = requestAnimationFrame(this.renderLoop);
  };

  /**
   * Advances the simulation state by dt seconds.
   */
  private step(dt: number): void {
    const currentScrollY = window.scrollY || window.pageYOffset || 0;
    const scrollDelta = Math.abs(currentScrollY - this.lastScrollY);
    this.lastScrollY = currentScrollY;

    // Track scroll velocity & dynamic construction tempo
    const r = scrollDelta / Math.max(dt, 0.001);
    this.scrollVel = Math.max(this.scrollVel * Math.exp(-dt * 1.2), this.scrollVel * 0.7 + r * 0.3);

    if (this.started) {
      this.scrollFrontier = Math.max(this.scrollFrontier, currentScrollY + window.innerHeight + 120);
    }

    // Track mouse velocity
    if (this.mousePos && this.lastMousePos && dt > 0) {
      const h = Math.min(1, dt * 18);
      this.mouseVelocity.x += ((this.mousePos.x - this.lastMousePos.x) / dt - this.mouseVelocity.x) * h;
      this.mouseVelocity.y += ((this.mousePos.y - this.lastMousePos.y) / dt - this.mouseVelocity.y) * h;
    }
    this.lastMousePos = this.mousePos ? { ...this.mousePos } : null;

    const pendingCount = this.tasks.filter((t) => !this.completedTaskIds.has(t.id)).length;
    this.tempo = Math.max(2.1, Math.min(4.5, 2.1 + this.scrollVel / 900 + pendingCount * 0.15));

    // Rulers slide-in animation
    if (this.rulersWant > 0) {
      this.lastRulerNeed = this.time;
    }
    const rulerTarget = this.started && (this.rulersWant > 0 || this.time - this.lastRulerNeed < 0.7) ? 1 : 0;
    this.rulerT += (rulerTarget - this.rulerT) * Math.min(1, dt * 10);
    if (Math.abs(rulerTarget - this.rulerT) < 0.002) {
      this.rulerT = rulerTarget;
    }
    this.overlayManager.setRulersProgress(this.rulerT);

    // Initial state: cursors follow & swirl around center logo
    if (!this.started) {
      const center = this.initialLogoCenter || {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      const focal = this.mousePos || center;
      const near = BoidsPhysics.follow(dt, this.agents, focal, this.mousePos, this.mouseVelocity, this.time, 0.7);
      if (near && this.mousePos && currentScrollY > 0) {
        this.start();
      }
      this.agents.forEach((a) => a.update(dt, this.overlayManager));
      return;
    }

    // Finale: if all tasks are complete, switch to flocking around user cursor
    const allDone = this.tasks.length > 0 && this.tasks.every((t) => this.completedTaskIds.has(t.id));
    if (allDone && !this.flocking) {
      this.flocking = true;
      this.isFinishedState = true;
      this.config.onAllElementsConstructed?.();
      for (const a of this.agents) {
        a.follow = true;
        a.gen = null;
        a.ov = null;
        a.setShape('arrow', this.overlayManager);
      }
    }

    if (this.flocking) {
      const target = this.mousePos || {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      BoidsPhysics.follow(dt, this.agents, target, this.mousePos, this.mouseVelocity, this.time, 1);
      this.agents.forEach((a) => a.update(dt, this.overlayManager));

      if (this.config.vanishAtCursor && this.mousePos) {
        this.agents.forEach((a) => {
          if (a.state !== 'VANISHED' && a.state !== 'CONVERGING_TO_USER') {
            a.state = 'CONVERGING_TO_USER';
            a.targetPosition = { ...this.mousePos! };
          }
        });
        if (this.agents.every((a) => a.state === 'VANISHED')) {
          this.config.onSwarmVanished?.();
        }
      }
      return;
    }

    // Task Dispatching
    this.dispatchTasks();

    // Step active generator coroutines
    for (const a of this.agents) {
      if (a.follow) continue;

      if (a.gen) {
        const res = a.gen.next(dt);
        if (res.done) {
          a.gen = null;
          a.ov = null;
          a.setShape('arrow', this.overlayManager);
          if (this.activeTask) {
            this.completedTaskIds.add(this.activeTask.id);
            this.constructedCount++;
            this.config.onElementConstructed?.(this.activeTask.element);
            this.activeTask = null;
          }
        }
      } else {
        // Idle cursor movement: halo orbit around the active task
        if (this.activeTask) {
          const rect = this.activeTask.element.getBoundingClientRect();
          const focal = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          const force = BoidsPhysics.orbitalHalo(a, focal, this.time);
          a.applyForce(force);
          const sep = BoidsPhysics.separate(a, this.agents, 60);
          a.applyForce(sep);
          a.update(dt, this.overlayManager);
        } else {
          // Roam gently
          const focal = this.mousePos || {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          };
          const force = BoidsPhysics.orbitalHalo(a, focal, this.time);
          a.applyForce(force);
          a.update(dt, this.overlayManager);
        }
      }
    }

    // Collect and render dynamic overlays
    const overlayItems: OverlayItem[] = [];
    for (const a of this.agents) {
      if (a.ov) {
        overlayItems.push(...a.ov());
      }
    }
    this.overlayManager.renderDynamicOverlays(overlayItems, this.rulerT);

    // Update active ruler coordinate highlight strips
    if (this.activeTask) {
      const rect = this.activeTask.element.getBoundingClientRect();
      this.overlayManager.updateRulerSegments([
        {
          left: rect.left,
          width: rect.width,
          top: rect.top,
          height: rect.height,
        },
      ]);
    } else {
      this.overlayManager.updateRulerSegments([]);
    }
  }

  /**
   * Finds next available task and assigns it to a cursor agent.
   */
  private dispatchTasks(): void {
    if (this.activeTask !== null && this.config.concurrency === 1) {
      return;
    }

    const available = this.tasks.filter((t) => {
      if (this.completedTaskIds.has(t.id)) return false;
      if (t === this.activeTask) return false;

      // Check dependencies
      if (t.deps && t.deps.length > 0) {
        if (!t.deps.every((depId) => this.completedTaskIds.has(depId))) {
          return false;
        }
      }

      // Check scroll frontier
      const rect = t.element.getBoundingClientRect();
      const docTop = rect.top + (window.scrollY || window.pageYOffset || 0);
      return docTop <= this.scrollFrontier;
    });

    if (available.length === 0 || !available[0]) return;

    // Pick closest task to view top
    const nextTask = available[0];
    const idleAgent = this.agents.find((a) => !a.gen && !a.follow);
    if (!idleAgent) return;

    this.activeTask = nextTask;
    idleAgent.worked = true;
    idleAgent.gen = this.runTask(idleAgent, nextTask);
  }

  /**
   * Main agentic task coroutine.
   */
  private *runTask(agent: Agent, task: ConstructionTask): Generator<void, void, number> {
    const spec = task.spec;
    if (!spec) return;

    switch (spec.type) {
      case 'rect':
        yield* this.drawRect(agent, task);
        break;
      case 'text':
        yield* this.drawText(agent, task);
        break;
      case 'dup':
        yield* this.duplicate(agent, task);
        break;
      case 'path':
        yield* this.drawPath(agent, task);
        break;
      case 'guide':
        yield* this.dragGuide(agent, task);
        break;
    }
  }

  /**
   * Rectangle / Card construction coroutine:
   * Crosshair drafting, live drag box, final styling transition, handles, and dimensions badge.
   */
  private *drawRect(agent: Agent, task: ConstructionTask): Generator<void, void, number> {
    const el = task.element;
    const r = el.getBoundingClientRect();
    const rect: BoxRect = {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    };

    agent.setShape('cross', this.overlayManager);
    yield* agent.moveTo({ x: rect.left, y: rect.top }, { speed: 1.2, tempo: this.tempo });
    yield* agent.click(this.tempo);

    this.builderEffects.setDrafting(el, true);

    const activeBox: BoxRect = {
      left: rect.left,
      top: rect.top,
      width: 0,
      height: 0,
    };

    agent.ov = () => [
      {
        t: 'box',
        b: activeBox,
        color: 'blue',
      },
    ];

    yield* agent.moveTo(
      { x: rect.left + rect.width, y: rect.top + rect.height },
      {
        speed: 0.75,
        drag: true,
        bend: 0,
        tempo: this.tempo,
        onStep: () => {
          activeBox.width = Math.max(0, agent.position.x - rect.left);
          activeBox.height = Math.max(0, agent.position.y - rect.top);
        },
      }
    );

    activeBox.width = rect.width;
    activeBox.height = rect.height;

    agent.setShape('arrow', this.overlayManager);
    yield* agent.wait(0.2, this.tempo);

    this.builderEffects.applyFinalStyles(el);

    agent.ov = () => [
      {
        t: 'box',
        b: rect,
        handles: true,
        badge: `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
        rulerLines: true,
        color: 'blue',
      },
    ];

    yield* agent.wait(0.35, this.tempo);
    agent.ov = null;
  }

  /**
   * Text construction coroutine:
   * Crosshair framing, I-Beam typing with blinking caret, and dimensions badge.
   */
  private *drawText(agent: Agent, task: ConstructionTask): Generator<void, void, number> {
    const el = task.element;
    const r = el.getBoundingClientRect();
    const rect: BoxRect = {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    };

    const fullText = this.builderEffects.getFullText(el);

    // Crosshair frame draft
    agent.setShape('cross', this.overlayManager);
    yield* agent.moveTo({ x: rect.left, y: rect.top }, { speed: 1.2, tempo: this.tempo });
    yield* agent.click(this.tempo);

    const activeBox: BoxRect = {
      left: rect.left,
      top: rect.top,
      width: 0,
      height: rect.height,
    };

    agent.ov = () => [
      {
        t: 'box',
        b: activeBox,
        color: 'blue',
      },
    ];

    yield* agent.moveTo(
      { x: rect.left + rect.width, y: rect.top + rect.height },
      {
        speed: 0.9,
        drag: true,
        bend: 0,
        tempo: this.tempo,
        onStep: () => {
          activeBox.width = Math.max(0, agent.position.x - rect.left);
        },
      }
    );

    // Switch to I-Beam and type text
    agent.setShape('ibeam', this.overlayManager);
    this.builderEffects.prepareTextEditing(el);

    agent.ov = () => [
      {
        t: 'box',
        b: rect,
        underline: { left: rect.left, top: rect.top + rect.height * 0.9, width: rect.width, height: 1 },
      },
    ];

    yield* agent.moveTo({ x: rect.left + 8, y: rect.top + rect.height * 0.5 }, { speed: 1.5, tempo: this.tempo });

    yield* agent.typeText(el, fullText, this.builderEffects, false, this.tempo);
    yield* agent.wait(0.12, this.tempo);

    this.builderEffects.finishTextEditing(el);
    agent.setShape('arrow', this.overlayManager);

    agent.ov = () => [
      {
        t: 'box',
        b: rect,
        handles: true,
        badge: `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
        rulerLines: true,
        color: 'blue',
      },
    ];

    yield* agent.wait(0.3, this.tempo);
    agent.ov = null;
  }

  /**
   * Alt-Drag Duplicate coroutine:
   * Selects source with handles, switches to Figma 'dup' cursor, drags duplicate with red
   * wireframes and red distance measurement line, then double-clicks to edit text if different!
   */
  private *duplicate(agent: Agent, task: ConstructionTask): Generator<void, void, number> {
    const el = task.element;
    const sourceEl = task.spec?.sourceElement;
    if (!sourceEl) {
      yield* this.drawRect(agent, task);
      return;
    }

    const sRect = sourceEl.getBoundingClientRect();
    const tRect = el.getBoundingClientRect();

    const sourceBox: BoxRect = {
      left: sRect.left,
      top: sRect.top,
      width: sRect.width,
      height: sRect.height,
    };
    const targetBox: BoxRect = {
      left: tRect.left,
      top: tRect.top,
      width: tRect.width,
      height: tRect.height,
    };

    agent.setShape('arrow', this.overlayManager);
    yield* agent.moveTo(
      { x: sourceBox.left + sourceBox.width * 0.45, y: sourceBox.top + sourceBox.height * 0.45 },
      { speed: 1.1, tempo: this.tempo }
    );
    yield* agent.click(this.tempo);

    agent.ov = () => [
      {
        t: 'box',
        b: sourceBox,
        handles: true,
        badge: `${Math.round(sourceBox.width)} × ${Math.round(sourceBox.height)}`,
      },
    ];
    yield* agent.wait(0.18, this.tempo);

    // Switch to duplicate cursor
    agent.setShape('dup', this.overlayManager);
    yield* agent.wait(0.12, this.tempo);
    agent.press = 1;

    const dx = targetBox.left - sourceBox.left;
    const dy = targetBox.top - sourceBox.top;
    this.builderEffects.prepareDuplicate(el, sourceEl, -dx, -dy);

    const dragTarget = {
      x: agent.position.x + dx,
      y: agent.position.y + dy,
    };

    const movingTargetBox: BoxRect = {
      left: sourceBox.left,
      top: sourceBox.top,
      width: targetBox.width,
      height: targetBox.height,
    };

    agent.ov = () => [
      { t: 'box', b: sourceBox, color: 'red' },
      { t: 'box', b: movingTargetBox, color: 'red' },
      {
        t: 'measure',
        a: { x: sourceBox.left + sourceBox.width, y: sourceBox.top + sourceBox.height / 2 },
        b: { x: movingTargetBox.left, y: movingTargetBox.top + movingTargetBox.height / 2 },
        label: `${Math.round(Math.hypot(dx, dy))}px`,
      },
    ];

    yield* agent.moveTo(dragTarget, {
      speed: 0.65,
      drag: true,
      bend: 0,
      tempo: this.tempo,
      onStep: () => {
        const curDx = agent.position.x - dragTarget.x;
        const curDy = agent.position.y - dragTarget.y;
        this.builderEffects.updateDuplicateOffset(el, curDx, curDy);
        movingTargetBox.left = targetBox.left + curDx;
        movingTargetBox.top = targetBox.top + curDy;
      },
    });

    yield* agent.wait(0.1, this.tempo);
    agent.setShape('arrow', this.overlayManager);
    this.builderEffects.finishDuplicate(el);

    agent.ov = () => [
      {
        t: 'box',
        b: targetBox,
        handles: true,
        badge: `${Math.round(targetBox.width)} × ${Math.round(targetBox.height)}`,
      },
    ];
    yield* agent.wait(0.3, this.tempo);
    agent.ov = null;

    // If text is different, double click to edit!
    if (this.builderEffects.hasDifferentText(sourceEl, el)) {
      yield* this.editText(agent, el, targetBox);
    }
  }

  /**
   * Double-click text editing coroutine:
   * Double-clicks, selects all text (.swarm-text-sel), switches to I-Beam, types replacement text.
   */
  private *editText(agent: Agent, el: HTMLElement, box: BoxRect): Generator<void, void, number> {
    agent.setShape('arrow', this.overlayManager);
    yield* agent.moveTo(
      { x: box.left + Math.min(box.width * 0.5, 50), y: box.top + box.height * 0.55 },
      { speed: 1.2, tempo: this.tempo }
    );

    // Double click!
    yield* agent.click(this.tempo);
    yield* agent.wait(0.08, this.tempo);
    yield* agent.click(this.tempo);

    this.builderEffects.selectAllText(el);
    agent.setShape('ibeam', this.overlayManager);

    agent.ov = () => [{ t: 'box', b: box }];
    yield* agent.wait(0.25, this.tempo);

    const replacement = this.builderEffects.getFullText(el);
    yield* agent.typeText(el, replacement, this.builderEffects, true, this.tempo);
    yield* agent.wait(0.12, this.tempo);

    this.builderEffects.finishTextEditing(el);
    agent.setShape('arrow', this.overlayManager);

    agent.ov = () => [
      {
        t: 'box',
        b: box,
        handles: true,
        badge: `${Math.round(box.width)} × ${Math.round(box.height)}`,
      },
    ];
    yield* agent.wait(0.25, this.tempo);
    agent.ov = null;
  }

  /**
   * Vector path drafting coroutine using the pen tool.
   */
  private *drawPath(agent: Agent, task: ConstructionTask): Generator<void, void, number> {
    const el = task.element;
    const r = el.getBoundingClientRect();
    const pts: Vector2D[] = [
      { x: r.left, y: r.top },
      { x: r.left + r.width, y: r.top },
      { x: r.left + r.width, y: r.top + r.height },
      { x: r.left, y: r.top + r.height },
    ];

    const p0 = pts[0];
    if (!p0) return;

    agent.setShape('pen', this.overlayManager);
    yield* agent.moveTo(p0, { speed: 1.2, tempo: this.tempo });
    yield* agent.click(this.tempo);

    const placedPts: Vector2D[] = [p0];
    agent.ov = () => [
      {
        t: 'path',
        points: placedPts,
        cursorPos: { x: agent.position.x, y: agent.position.y },
      },
    ];

    for (let i = 1; i < pts.length; i++) {
      const curPt = pts[i];
      if (!curPt) continue;
      yield* agent.moveTo(curPt, {
        bend: randomRange(-0.03, 0.03),
        tempo: this.tempo,
      });
      yield* agent.click(this.tempo);
      placedPts.push(curPt);
      yield* agent.wait(0.08, this.tempo);
    }

    // Close path
    agent.setShape('pen-close', this.overlayManager);
    yield* agent.moveTo(p0, { speed: 1.2, tempo: this.tempo });
    yield* agent.click(this.tempo);

    agent.ov = () => [
      {
        t: 'path',
        points: placedPts,
        closed: true,
      },
    ];

    agent.setShape('pen', this.overlayManager);
    yield* agent.moveTo(
      { x: agent.position.x + 20, y: agent.position.y + 15 },
      { speed: 1.4, tempo: this.tempo }
    );
    yield* agent.wait(0.25, this.tempo);

    this.builderEffects.applyFinalStyles(el);
    agent.ov = null;
  }

  /**
   * Guideline dragging coroutine:
   * Slides rulers down, moves to ruler, grabs guideline with 'ew'/'ns' cursor,
   * drags across/down, snaps into place, flashes guide line with drop-shadow.
   */
  private *dragGuide(agent: Agent, task: ConstructionTask): Generator<void, void, number> {
    this.rulersWant++;
    const axis = task.spec?.axis || 'x';
    const pos = task.spec?.pos || 120;

    const startPos =
      axis === 'x'
        ? { x: 10, y: Math.max(100, Math.min(window.innerHeight * 0.6, pos)) }
        : { x: Math.max(100, Math.min(window.innerWidth * 0.5, pos)), y: 10 };

    agent.setShape('arrow', this.overlayManager);
    yield* agent.moveTo(startPos, { speed: 1.5, tempo: this.tempo });

    while (this.rulerT < 0.95) {
      yield;
    }

    agent.press = 1;
    agent.setShape(axis === 'x' ? 'ew' : 'ns', this.overlayManager);

    let curPos = startPos[axis];
    agent.ov = () => [
      {
        t: 'guide',
        axis,
        pos: curPos,
        opacity: 0.85,
      },
    ];

    const targetPos =
      axis === 'x' ? { x: pos, y: startPos.y + 40 } : { x: startPos.x + 30, y: pos };

    yield* agent.moveTo(targetPos, {
      speed: 0.55,
      drag: true,
      tempo: this.tempo,
      onStep: () => {
        curPos = axis === 'x' ? agent.position.x : agent.position.y;
      },
    });

    // Snap flash!
    agent.ov = () => [
      {
        t: 'guide',
        axis,
        pos,
        flash: 1,
        opacity: 1,
      },
    ];
    agent.setShape('arrow', this.overlayManager);
    yield* agent.wait(0.25, this.tempo);

    this.rulersWant--;
    agent.ov = null;
  }

  /**
   * Public API: Replays swarm construction from beginning.
   */
  public replay(): void {
    this.builderEffects.restoreAll();
    this.completedTaskIds.clear();
    this.activeTask = null;
    this.started = false;
    this.flocking = false;
    this.constructedCount = 0;
    this.scrollFrontier = 0;
    this.isFinishedState = false;

    if (this.introLogoEl) {
      this.introLogoEl.classList.remove('gone');
    }

    const elements = this.domScanner.scanAndIndex();
    this.tasks = this.domScanner.buildTaskGraph(elements);
    this.tasks.forEach((t) => this.taskMap.set(t.id, t));

    const center = this.initialLogoCenter || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    const count = this.agents.length;

    this.agents.forEach((agent, i) => {
      const angle = (i / count) * Math.PI * 2;
      const initialPos = {
        x: center.x + Math.cos(angle) * 160,
        y: center.y + Math.sin(angle) * 160,
      };
      agent.reset(initialPos, this.overlayManager);
      agent.follow = true;
    });

    this.overlayManager.setRulersProgress(0);
    this.overlayManager.clearDynamicOverlays();
  }

  /**
   * Public API: Pause simulation.
   */
  public pause(): void {
    this.paused = true;
  }

  /**
   * Public API: Resume simulation.
   */
  public resume(): void {
    this.paused = false;
  }

  /**
   * Public API: Manually trigger construction on a specific element.
   */
  public async buildElement(element: HTMLElement): Promise<void> {
    const task = this.taskMap.get(element.id) || this.domScanner.buildTaskGraph([element])[0];
    if (!task) return;

    const agent = this.agents.find((a) => !a.gen && !a.follow) || this.agents[0];
    if (!agent) return;
    return new Promise((resolve) => {
      const gen = this.runTask(agent, task);
      const runner = () => {
        const res = gen.next(0.016);
        if (res.done) {
          this.completedTaskIds.add(task.id);
          this.config.onElementConstructed?.(element);
          resolve();
        } else {
          requestAnimationFrame(runner);
        }
      };
      requestAnimationFrame(runner);
    });
  }

  public getConfig(): Readonly<ResolvedSwarmConfig> {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<SwarmConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public isFinished(): boolean {
    return this.isFinishedState;
  }

  public getActiveAgentCount(): number {
    return this.agents.filter((a) => a.state !== 'VANISHED').length;
  }

  public getMetrics(): SwarmMetrics {
    let idle = 0;
    let constructing = 0;

    for (const a of this.agents) {
      if (a.gen) constructing++;
      else idle++;
    }

    return {
      fps: this.currentFps,
      totalAgents: this.agents.length,
      idleAgents: idle,
      constructingAgents: constructing,
      convergingAgents: this.flocking ? this.agents.length : 0,
      vanishedAgents: this.agents.filter((a) => a.state === 'VANISHED').length,
      elementsConstructed: this.constructedCount,
      elementsPending: this.tasks.length - this.completedTaskIds.size,
      isFinished: this.isFinishedState,
    };
  }

  /**
   * Complete teardown: cleans up listeners, overlay, agents, and styles.
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
      window.removeEventListener('wheel', this.onWheel);
      window.removeEventListener('resize', this.onResize);
    }

    this.domScanner.destroy();
    this.builderEffects.restoreAll();
    this.overlayManager.destroy();
    this.agents.forEach((a) => a.destroy());
    this.agents = [];
  }
}
