import { AgentState, AgentType, BorderRole, Vector2D } from '../types';
import { OverlayManager } from '../dom/OverlayManager';
import {
  vec,
  add,
  mult,
  limit,
  randomRange,
} from '../utils/math';

/**
 * Individual cursor agent entity with autonomous Boids state machine,
 * collaborative 4-team border construction, and convergence/vanishing finale.
 */
export class Agent {
  public id: number;
  public color: string;
  public teamId = 0;
  public state: AgentState = 'IDLE_FLOCKING';
  public type: AgentType = 'pointer';

  public position: Vector2D;
  public velocity: Vector2D;
  public acceleration: Vector2D;

  public maxSpeed: number;
  public maxForce: number;

  public targetPosition: Vector2D | null = null;
  public targetElement: HTMLElement | null = null;
  public assignedTaskId: string | null = null;
  public borderRole: BorderRole | null = null;
  public targetRect: DOMRect | null = null;
  public lastAssignedTime = 0;
  public convergenceStartPos: Vector2D = { x: 0, y: 0 };
  public orbitSlotAngle = 0;
  private borderProgress = 0;

  public element: HTMLElement;
  public iconContainer: HTMLElement;

  private headingAngle = 0;
  private targetScale = 1;
  private currentScale = 1;
  private currentOpacity = 1;

  constructor(
    id: number,
    color: string,
    teamId: number,
    initialPos: Vector2D,
    overlayManager: OverlayManager,
    maxSpeed = 11.5,
    maxForce = 0.45
  ) {
    this.id = id;
    this.color = color;
    this.teamId = teamId;
    this.position = { ...initialPos };
    this.velocity = vec(randomRange(-2, 2), randomRange(-2, 2));
    this.acceleration = vec(0, 0);
    this.maxSpeed = maxSpeed;
    this.maxForce = maxForce;
    this.borderProgress = randomRange(0, 1);

    // Create DOM cursor inside Shadow root
    const dom = overlayManager.createAgentElement(id, color);
    this.element = dom.element;
    this.iconContainer = dom.iconContainer;

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

    if (this.state === 'CONSTRUCTING_ELEMENT' && this.borderRole && this.targetRect) {
      // Smooth sinusoidal movement along the border without rotation
      const rect = this.targetRect;
      this.borderProgress = (this.borderProgress + dt * 0.022) % 1.0;
      const t = (Math.sin(this.borderProgress * Math.PI * 2) + 1) * 0.5;

      if (this.borderRole === 'top') {
        this.position.x = rect.left + rect.width * t;
        this.position.y = rect.top;
      } else if (this.borderRole === 'right') {
        this.position.x = rect.right;
        this.position.y = rect.top + rect.height * t;
      } else if (this.borderRole === 'bottom') {
        this.position.x = rect.right - rect.width * t;
        this.position.y = rect.bottom;
      } else if (this.borderRole === 'left') {
        this.position.x = rect.left;
        this.position.y = rect.bottom - rect.height * t;
      } else {
        // Center text typewriter
        this.position.x = rect.left + rect.width * 0.5;
        this.position.y = rect.top + rect.height * 0.5;
      }

      // No rotation while working: keep cursor clean and naturally upright
      this.headingAngle = 0;
      this.targetScale = 1.05;
      this.currentOpacity = 1;
    } else {
      // Standard physics integration
      const scaledAcc = mult(this.acceleration, dt);
      this.velocity = limit(add(this.velocity, scaledAcc), this.maxSpeed);

      const scaledVel = mult(this.velocity, dt);
      this.position = add(this.position, scaledVel);

      this.acceleration = vec(0, 0);

      if (this.state === 'CONVERGING_TO_USER') {
        this.headingAngle = 0;
        this.element.style.opacity = this.currentOpacity.toFixed(3);
        overlayManager.updateAgentTransform(
          this.element,
          this.position.x,
          this.position.y,
          0,
          this.currentScale
        );
        return;
      } else {
        // Naturally upright with zero or subtle movement
        this.headingAngle = 0;
        this.targetScale = 1.0;
        this.currentOpacity = 1;
      }
    }

    // Smooth scale interpolation
    this.currentScale += (this.targetScale - this.currentScale) * 0.2;

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
   * Dispatches agent to navigate to a target DOM element coordinate on its border,
   * switching to the element's contextual tool icon (e.g. pencil/pen for text, frame for boxes).
   */
  public assignTarget(
    targetPos: Vector2D,
    element: HTMLElement,
    taskId: string,
    borderRole: BorderRole,
    rect: DOMRect,
    toolType: AgentType,
    overlayManager: OverlayManager
  ): void {
    this.targetPosition = { ...targetPos };
    this.targetElement = element;
    this.assignedTaskId = taskId;
    this.borderRole = borderRole;
    this.targetRect = rect;
    this.lastAssignedTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.state = 'MOVING_TO_TARGET';

    this.morphIcon(toolType, overlayManager);
  }

  /**
   * Puts agent into element construction mode along its assigned border.
   */
  public setConstructing(): void {
    this.state = 'CONSTRUCTING_ELEMENT';
    this.velocity = mult(this.velocity, 0.2);
  }

  /**
   * Marks construction complete and initiates return to swarm flock.
   */
  public returnToSwarm(overlayManager: OverlayManager): void {
    this.state = 'RETURNING_TO_SWARM';
    this.targetPosition = null;
    this.targetElement = null;
    this.assignedTaskId = null;
    this.borderRole = null;
    this.targetRect = null;
    this.morphIcon('pointer', overlayManager);

    this.velocity = vec(randomRange(-4, 4), randomRange(-4, 4));
  }

  /**
   * Directs the agent to converge towards the user's cursor, swirl 360°, and join the main cursor.
   */
  public convergeTo(userPos: Vector2D, overlayManager: OverlayManager, orbitAngle = 0): void {
    this.state = 'CONVERGING_TO_USER';
    this.targetPosition = { ...userPos };
    this.convergenceStartPos = { ...this.position };
    this.orbitSlotAngle = orbitAngle;
    this.targetElement = null;
    this.assignedTaskId = null;
    this.borderRole = null;
    this.targetRect = null;
    this.morphIcon('pointer', overlayManager);
    this.element.style.display = 'block';
    this.element.style.opacity = '1';
    this.headingAngle = 0;
    this.targetScale = 1.05;
    this.currentScale = 1.05;
    this.currentOpacity = 1;
    this.maxSpeed = 15.0;
  }

  /**
   * Restores agent to idle Boids flocking state.
   */
  public setIdle(): void {
    this.state = 'IDLE_FLOCKING';
    this.targetPosition = null;
    this.targetElement = null;
    this.assignedTaskId = null;
    this.borderRole = null;
    this.targetRect = null;
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
    this.borderRole = null;
    this.targetRect = null;
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
