import { AgentState, AgentType, CursorShape, OverlayItem, Vector2D } from '../types';
import { OverlayManager } from '../dom/OverlayManager';
import { BuilderEffects } from '../dom/BuilderEffects';
import { vec, add, mult, limit, dist, randomRange } from '../utils/math';

/**
 * Autonomous cursor agent entity with Figma cursor tools, coroutine generator state machine,
 * and Boids flocking dynamics.
 */
export class Agent {
  public id: number;
  public color: string;
  public label: string;
  public state: AgentState = 'IDLE_FLOCKING';
  public type: AgentType = 'pointer';
  public shape: CursorShape = 'arrow';
  public press = 0;
  public angle = 0;

  public position: Vector2D;
  public velocity: Vector2D;
  public acceleration: Vector2D;

  public maxSpeed: number;
  public maxForce: number;
  public defaultMaxSpeed: number;
  public defaultMaxForce: number;

  public speed: number;
  public force: number;
  public spin: number;
  public curl: number;
  public orbit: number;
  public follow = false;
  public worked = false;
  public idleFor = 0;
  public leaving = false;
  public sticky = false;
  public home: Vector2D | null = null;

  public gen: Generator<void, void, number> | null = null;
  public ov: (() => OverlayItem[]) | null = null;

  public targetPosition: Vector2D | null = null;
  public targetElement: HTMLElement | null = null;
  public assignedTaskId: string | null = null;

  public element: HTMLElement;
  public iconContainer: HTMLElement;
  public labelEl: HTMLElement | null;

  public headingAngle = 0;
  private currentScale = 1;
  private currentOpacity = 1;

  constructor(
    id: number,
    color: string,
    label: string,
    initialPos: Vector2D,
    overlayManager: OverlayManager,
    maxSpeed = 9.0,
    maxForce = 0.38,
    showLabel = false
  ) {
    this.id = id;
    this.color = color;
    this.label = label;
    this.position = { ...initialPos };
    this.velocity = vec(randomRange(-3, 3), randomRange(-3, 3));
    this.acceleration = vec(0, 0);
    this.defaultMaxSpeed = maxSpeed;
    this.defaultMaxForce = maxForce;
    this.maxSpeed = maxSpeed;
    this.maxForce = maxForce;

    // Movement personality parameters
    if (Math.random() < 0.25) {
      this.speed = randomRange(1000, 1500);
      this.force = randomRange(3500, 6000);
      this.spin = randomRange(2.2, 3.4);
    } else {
      this.speed = randomRange(350, 750);
      this.force = randomRange(700, 1800);
      this.spin = randomRange(0.8, 1.8);
    }
    this.curl = randomRange(-1, 1);
    this.orbit = randomRange(80, 160);

    // Create DOM cursor inside Shadow root
    const dom = overlayManager.createAgentElement(id, color, label, showLabel);
    this.element = dom.element;
    this.iconContainer = dom.iconContainer;
    this.labelEl = dom.labelEl;

    // Initial position
    overlayManager.updateAgentTransform(this.element, this.position.x, this.position.y, 0, 1, this.shape, this.press);
  }

  /**
   * Applies an external steering or acceleration force to the agent.
   */
  public applyForce(force: Vector2D): void {
    this.acceleration = add(this.acceleration, force);
  }

  /**
   * Switches cursor avatar between arrow, duplicate, pen, crosshair, or ibeam.
   */
  public setShape(newShape: CursorShape, overlayManager: OverlayManager): void {
    if (this.shape === newShape) return;
    this.shape = newShape;
    overlayManager.setCursorShape(this.iconContainer, newShape, this.color);
  }

  /**
   * Compatibility method for setAgentIcon.
   */
  public morphIcon(newType: AgentType, overlayManager: OverlayManager): void {
    const shape: CursorShape = newType === 'ibeam' ? 'ibeam' : newType === 'crosshair' ? 'cross' : 'arrow';
    this.setShape(shape, overlayManager);
  }

  /**
   * Human-like curved mouse movement coroutine with cubic ease-in-out and bezier bend.
   */
  public *moveTo(
    target: Vector2D | (() => Vector2D),
    options: {
      speed?: number;
      bend?: number;
      drag?: boolean;
      tempo?: number;
      onStep?: () => void;
    } = {}
  ): Generator<void, void, number> {
    const startX = this.position.x;
    const startY = this.position.y;
    const getTarget = typeof target === 'function' ? target : () => target;
    let tPos = getTarget();
    const d = Math.hypot(tPos.x - startX, tPos.y - startY);

    if (d < 0.5) {
      this.position.x = tPos.x;
      this.position.y = tPos.y;
      options.onStep?.();
      return;
    }

    const moveSpeed = options.speed ?? 1;
    const duration = Math.max(0.14, Math.min(0.9, 0.12 + Math.sqrt(d) * 0.021)) / moveSpeed;
    const bend =
      (options.bend ?? (Math.random() < 0.5 ? -1 : 1) * (0.04 + Math.random() * 0.1)) * Math.min(d, 600);

    let elapsed = 0;
    while (elapsed < duration) {
      const dt: number = (yield) ?? 0.016;
      const tempo = options.tempo ?? 1;
      elapsed += dt * tempo;
      const progress = Math.min(1, elapsed / duration);

      // Easing function
      const ease =
        options.drag || progress < 0.15
          ? progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2
          : 1 - Math.pow(1 - progress, 3);

      tPos = getTarget();
      const dx = tPos.x - startX;
      const dy = tPos.y - startY;
      const hyp = Math.hypot(dx, dy) || 1;
      const perp = Math.sin(Math.PI * ease) * bend;

      this.position.x = startX + dx * ease - (dy / hyp) * perp;
      this.position.y = startY + dy * ease + (dx / hyp) * perp;

      options.onStep?.();
    }

    tPos = getTarget();
    this.position.x = tPos.x;
    this.position.y = tPos.y;
    options.onStep?.();
  }

  /**
   * Coroutine to wait a given duration in seconds.
   */
  public *wait(seconds: number, tempo = 1): Generator<void, void, number> {
    let elapsed = 0;
    while (elapsed < seconds) {
      const dt: number = (yield) ?? 0.016;
      elapsed += dt * tempo;
    }
  }

  /**
   * Click feedback coroutine: scales cursor down, pauses, and releases.
   */
  public *click(tempo = 1): Generator<void, void, number> {
    this.press = 1;
    yield* this.wait(0.07, tempo);
  }

  /**
   * Typewriter typing coroutine: types characters with realistic human rhythm.
   */
  public *typeText(
    element: HTMLElement,
    text: string,
    builderEffects: BuilderEffects,
    replace = false,
    tempo = 1
  ): Generator<void, void, number> {
    let current = '';
    for (let i = 0; i < text.length; i++) {
      if (i === 0 && replace) {
        current = '';
      }
      current += text[i];
      builderEffects.setTypedText(element, current);

      let delay = 0.012 + Math.random() * 0.028;
      if (text[i] === ' ') delay += Math.random() * 0.03;
      if (text[i] === '\n') delay += 0.1;
      if (Math.random() < 0.025) delay += 0.08 + Math.random() * 0.12;

      yield* this.wait(delay, tempo);
    }
  }

  /**
   * Advances physics and updates visual transform in Shadow DOM.
   */
  public update(dt: number, overlayManager: OverlayManager): void {
    if (this.state === 'VANISHED') {
      this.element.style.display = 'none';
      return;
    }

    // Decay click press
    if (this.press > 0) {
      this.press = Math.max(0, this.press - dt * 6);
    }

    // Decay angle toward 0 if idle
    if (this.angle !== 0 && !this.follow) {
      this.angle = Math.abs(this.angle) < 0.5 ? 0 : this.angle * (1 - Math.min(1, dt * 10));
    }

    if (this.state === 'CONVERGING_TO_USER') {
      const scaledAcc = mult(this.acceleration, dt);
      this.velocity = limit(add(this.velocity, scaledAcc), this.maxSpeed);
      const scaledVel = mult(this.velocity, dt);
      this.position = add(this.position, scaledVel);
      this.acceleration = vec(0, 0);

      if (this.targetPosition) {
        const d = dist(this.position, this.targetPosition);
        const progress = Math.min(Math.max(d / 70, 0), 1);
        this.currentScale = progress * 1.1;
        this.currentOpacity = progress;

        if (d < 12) {
          this.state = 'VANISHED';
          this.element.style.opacity = '0';
          this.element.style.display = 'none';
          return;
        }
      }
    }

    this.element.style.opacity = this.currentOpacity.toFixed(3);

    // Update Shadow DOM transform with exact hot-spot and press compression
    overlayManager.updateAgentTransform(
      this.element,
      this.position.x,
      this.position.y,
      this.angle,
      this.currentScale,
      this.shape,
      this.press
    );
  }

  /**
   * Resets agent for replaying.
   */
  public reset(pos: Vector2D, overlayManager: OverlayManager): void {
    this.position = { ...pos };
    this.velocity = vec(randomRange(-3, 3), randomRange(-3, 3));
    this.acceleration = vec(0, 0);
    this.state = 'IDLE_FLOCKING';
    this.shape = 'arrow';
    this.press = 0;
    this.angle = 0;
    this.follow = false;
    this.worked = false;
    this.idleFor = 0;
    this.leaving = false;
    this.gen = null;
    this.ov = null;
    this.currentScale = 1;
    this.currentOpacity = 1;
    this.element.style.display = 'block';
    this.element.style.opacity = '1';

    overlayManager.setCursorShape(this.iconContainer, 'arrow', this.color);
    overlayManager.updateAgentTransform(this.element, this.position.x, this.position.y, 0, 1, 'arrow', 0);
  }

  /**
   * Clean up.
   */
  public destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
