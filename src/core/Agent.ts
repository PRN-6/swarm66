import { AgentState, AgentType, Vector2D } from '../types';
import { OverlayManager } from '../dom/OverlayManager';
import {
  vec,
  add,
  mult,
  limit,
  headingDeg,
  dist,
  distSq,
  randomRange,
} from '../utils/math';

/**
 * Individual cursor agent entity with autonomous Boids state machine,
 * element construction behaviors, and cursor convergence/vanishing finale.
 */
export class Agent {
  public id: number;
  public color: string;
  public label: string;
  public state: AgentState = 'IDLE_FLOCKING';
  public type: AgentType = 'pointer';

  public position: Vector2D;
  public velocity: Vector2D;
  public acceleration: Vector2D;

  public maxSpeed: number;
  public maxForce: number;
  public defaultMaxSpeed: number;
  public defaultMaxForce: number;

  public targetPosition: Vector2D | null = null;
  public targetElement: HTMLElement | null = null;
  public assignedTaskId: string | null = null;

  public element: HTMLElement;
  public iconContainer: HTMLElement;
  public labelEl: HTMLElement | null;

  public headingAngle = 0;
  private targetScale = 1;
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

    // Create DOM cursor inside Shadow root without label by default
    const dom = overlayManager.createAgentElement(id, color, label, showLabel);
    this.element = dom.element;
    this.iconContainer = dom.iconContainer;
    this.labelEl = dom.labelEl;

    // Initial position
    overlayManager.updateAgentTransform(this.element, this.position.x, this.position.y, 0, 1);
  }

  /**
   * Applies an external steering or acceleration force to the agent.
   */
  public applyForce(force: Vector2D): void {
    this.acceleration = add(this.acceleration, force);
  }

  /**
   * Advances the agent's physics simulation and visual presentation by delta time.
   */
  public update(dt: number, overlayManager: OverlayManager): void {
    if (this.state === 'VANISHED') {
      this.element.style.display = 'none';
      return;
    }

    // Compute heading rotation angle & visual properties
    if (this.state === 'CONSTRUCTING_ELEMENT') {
      this.velocity = vec(0, 0);
      this.acceleration = vec(0, 0);
      this.targetScale = 1.15;
      this.currentOpacity = 1;
    } else if (this.state === 'CONVERGING_TO_USER') {
      // Integrate physics towards user convergence point
      const scaledAcc = mult(this.acceleration, dt);
      this.velocity = limit(add(this.velocity, scaledAcc), this.maxSpeed);
      const scaledVel = mult(this.velocity, dt);
      this.position = add(this.position, scaledVel);
      this.acceleration = vec(0, 0);

      if (this.targetPosition) {
        const d = dist(this.position, this.targetPosition);
        const progress = Math.min(Math.max(d / 70, 0), 1);
        this.targetScale = progress * 1.1;
        this.currentOpacity = progress;

        // When very close, vanish completely
        if (d < 12) {
          this.state = 'VANISHED';
          this.element.style.opacity = '0';
          this.element.style.display = 'none';
          return;
        }

        const targetDeg = headingDeg(this.velocity) - 45;
        this.headingAngle = this.headingAngle + (targetDeg - this.headingAngle) * 0.25;
      }
    } else {
      // Integrate physics: v = v + a * dt, capped at maxSpeed
      const scaledAcc = mult(this.acceleration, dt);
      this.velocity = limit(add(this.velocity, scaledAcc), this.maxSpeed);

      // Position integration: p = p + v * dt
      const scaledVel = mult(this.velocity, dt);
      this.position = add(this.position, scaledVel);

      this.acceleration = vec(0, 0);

      const vMagSq = distSq(this.velocity, vec(0, 0));
      if (vMagSq > 0.05) {
        const targetDeg = headingDeg(this.velocity) - 45;
        this.headingAngle = this.headingAngle + (targetDeg - this.headingAngle) * 0.22;
      }
      this.targetScale = 1.0;
      this.currentOpacity = 1;
    }

    // Smooth scale interpolation
    this.currentScale += (this.targetScale - this.currentScale) * 0.2;

    // Apply opacity
    this.element.style.opacity = this.currentOpacity.toFixed(3);

    // Update Shadow DOM transform
    overlayManager.updateAgentTransform(
      this.element,
      this.position.x,
      this.position.y,
      this.headingAngle,
      this.currentScale
    );
  }

  /**
   * Switches cursor avatar between arrow pointer and I-beam text tool.
   */
  public morphIcon(newType: AgentType, overlayManager: OverlayManager): void {
    if (this.type === newType) return;
    this.type = newType;
    overlayManager.setAgentIcon(this.iconContainer, newType, this.color);
  }

  /**
   * Dispatches agent to navigate to a target DOM element coordinate with speed boost.
   */
  public assignTarget(
    targetPos: Vector2D,
    element: HTMLElement,
    taskId: string,
    isText: boolean,
    overlayManager: OverlayManager
  ): void {
    this.targetPosition = { ...targetPos };
    this.targetElement = element;
    this.assignedTaskId = taskId;
    this.state = 'MOVING_TO_TARGET';
    this.maxSpeed = 18.0; // Brisk flight speed to snap to element
    this.maxForce = 1.0;

    if (isText) {
      this.morphIcon('ibeam', overlayManager);
    } else {
      this.morphIcon('pointer', overlayManager);
    }
  }

  /**
   * Puts agent into element construction mode.
   */
  public setConstructing(): void {
    this.state = 'CONSTRUCTING_ELEMENT';
    this.velocity = mult(this.velocity, 0.15);
  }

  /**
   * Marks construction complete and initiates return to swarm flock.
   */
  public returnToSwarm(overlayManager: OverlayManager): void {
    this.state = 'RETURNING_TO_SWARM';
    this.targetPosition = null;
    this.targetElement = null;
    this.assignedTaskId = null;
    this.maxSpeed = this.defaultMaxSpeed;
    this.maxForce = this.defaultMaxForce;
    this.morphIcon('pointer', overlayManager);

    this.velocity = vec(randomRange(-5, 5), randomRange(-5, 5));
  }

  /**
   * Directs the agent to accelerate and converge into the user's cursor, then vanish.
   */
  public convergeTo(userPos: Vector2D, overlayManager: OverlayManager): void {
    this.state = 'CONVERGING_TO_USER';
    this.targetPosition = { ...userPos };
    this.targetElement = null;
    this.assignedTaskId = null;
    this.morphIcon('pointer', overlayManager);
    this.maxSpeed = 16.0;
    this.maxForce = 1.2;
  }

  /**
   * Restores agent to idle Boids flocking state.
   */
  public setIdle(): void {
    this.state = 'IDLE_FLOCKING';
    this.targetPosition = null;
    this.targetElement = null;
    this.assignedTaskId = null;
    this.maxSpeed = this.defaultMaxSpeed;
    this.maxForce = this.defaultMaxForce;
  }

  /**
   * Resets agent position, visibility, and state for replaying.
   */
  public reset(pos: Vector2D, overlayManager: OverlayManager): void {
    this.position = { ...pos };
    this.velocity = vec(randomRange(-3, 3), randomRange(-3, 3));
    this.acceleration = vec(0, 0);
    this.state = 'IDLE_FLOCKING';
    this.type = 'pointer';
    this.targetPosition = null;
    this.targetElement = null;
    this.assignedTaskId = null;
    this.maxSpeed = this.defaultMaxSpeed;
    this.maxForce = this.defaultMaxForce;
    this.targetScale = 1;
    this.currentScale = 1;
    this.currentOpacity = 1;
    this.element.style.display = 'block';
    this.element.style.opacity = '1';
    overlayManager.setAgentIcon(this.iconContainer, 'pointer', this.color);
    overlayManager.updateAgentTransform(this.element, this.position.x, this.position.y, 0, 1);
  }

  /**
   * Removes agent element from DOM.
   */
  public destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
