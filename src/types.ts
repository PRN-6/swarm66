/**
 * Core type definitions for dom-swarm.
 * Zero external dependencies.
 */

export interface Vector2D {
  x: number;
  y: number;
}

export type AgentState =
  | 'IDLE_FLOCKING'
  | 'MOVING_TO_TARGET'
  | 'CONSTRUCTING_ELEMENT'
  | 'RETURNING_TO_SWARM'
  | 'CONVERGING_TO_USER'
  | 'VANISHED';

export type AgentType = 'pointer' | 'ibeam' | 'crosshair';

export type CursorShape =
  | 'arrow'
  | 'dup'
  | 'pen'
  | 'pen-add'
  | 'pen-close'
  | 'cross'
  | 'ibeam'
  | 'ew'
  | 'ns';

export type TaskType = 'path' | 'rect' | 'text' | 'guide' | 'dup' | 'edit';

export interface OverlayBoxSpec {
  t: 'box';
  b: { left: number; top: number; width: number; height: number };
  handles?: boolean;
  badge?: string;
  rulerLines?: boolean;
  underline?: { left: number; top: number; width: number; height: number };
  color?: 'blue' | 'red';
}

export interface OverlayMeasureSpec {
  t: 'measure';
  a: Vector2D;
  b: Vector2D;
  label: string;
}

export interface OverlayGuideSpec {
  t: 'guide';
  axis: 'x' | 'y';
  pos: number;
  flash?: number;
  opacity?: number;
  dragging?: boolean;
}

export interface OverlayPathSpec {
  t: 'path';
  points: Vector2D[];
  cursorPos?: Vector2D | null;
  closed?: boolean;
}

export type OverlayItem =
  | OverlayBoxSpec
  | OverlayMeasureSpec
  | OverlayGuideSpec
  | OverlayPathSpec;

export type BoundingBoxType = 'blue' | 'red';

export type BuildOrder = 'top-to-bottom' | 'random' | 'viewport';

export interface SwarmConfig {
  /**
   * Total number of autonomous cursor agents in the swarm.
   * @default 36
   */
  agentCount?: number;

  /**
   * Vibrant color palette for the cursor agents and wireframes.
   * @default ['#00A3FF', '#00C48C', '#FFAA00', '#FF007A', '#7B61FF', '#F24822', '#00E5FF', '#69DB7C']
   */
  colors?: string[];

  /**
   * CSS selector matching DOM elements to reverse-engineer and construct.
   * @default '.swarm-item, .price-card, .interactive-card, .metric-card, .code-box, .hero-pill, header.navbar, .hero h1, .hero p, .hero-actions button, .swarm-card'
   */
  selector?: string;

  /**
   * CSS selector to exclude elements from swarm construction.
   * @default '[data-no-swarm], script, style, noscript, dom-swarm-overlay, .swarm-hud, .swarm-initial-hero'
   */
  ignoreSelector?: string;

  /**
   * Whether to construct elements strictly as the user scrolls into view (not automatically).
   * @default true
   */
  buildOnScroll?: boolean;

  /**
   * Whether to initially hide all scroll-target elements below the fold until the user scrolls to them.
   * @default true
   */
  hideOnStart?: boolean;

  /**
   * Show Figma-style top and left measurement rulers with active coordinate segments during construction.
   * @default true
   */
  showRulers?: boolean;

  /**
   * Show Figma-style full-screen horizontal and vertical red/cyan alignment guides and crosshairs.
   * @default true
   */
  showGuides?: boolean;

  /**
   * Show dimensional pixel badge (e.g., "580 × 130", "184 × 48") on selection bounding boxes.
   * @default true
   */
  showDimensions?: boolean;

  /**
   * Simulate a fast typewriter reveal effect for text nodes (p, h1-h6, code, etc.) with I-beam cursor.
   * @default true
   */
  typewriterEffect?: boolean;

  /**
   * Number of elements being constructed simultaneously. Set to 1 for sequential one-by-one element construction.
   * @default 1
   */
  concurrency?: number;

  /**
   * Whether agents accelerate and converge into the user cursor once all elements are constructed.
   * @default true
   */
  vanishAtCursor?: boolean;

  /**
   * Order in which detected elements are constructed.
   * @default 'top-to-bottom'
   */
  buildOrder?: BuildOrder;

  /**
   * Whether to display text name badges alongside cursor avatars.
   * @default false
   */
  showAgentNames?: boolean;

  /**
   * Whether cursor agents flock around and follow the user's active cursor/touch when idle.
   * @default true
   */
  followMouse?: boolean;

  /**
   * Maximum movement velocity of agents in pixels per frame.
   * @default 9.5
   */
  maxSpeed?: number;

  /**
   * Maximum steering force applied to agents.
   * @default 0.4
   */
  maxForce?: number;

  /**
   * Duration in milliseconds spent constructing each element before moving to the next.
   * @default 850
   */
  buildDuration?: number;

  /**
   * Radius in pixels within which agents recognize flockmates for alignment and cohesion.
   * @default 85
   */
  flockRadius?: number;

  /**
   * Minimum distance agents maintain to avoid crowding each other.
   * @default 32
   */
  separateDistance?: number;

  /**
   * Radius around the user's mouse within which flocking agents feel gravitational attraction.
   * @default 220
   */
  mouseAttractRadius?: number;

  /**
   * Gravitational strength pulling idle agents toward the user's cursor.
   * @default 0.45
   */
  mouseAttractForce?: number;

  /**
   * Minimum delay between character reveals during typewriter effect (ms).
   * @default 16
   */
  typewriterSpeed?: number;

  /**
   * Optional custom labels or names displayed alongside cursor avatars if showAgentNames is true.
   * @default ['Figma AI', 'Cursor-01', 'Copilot', 'Agent-α', 'Agent-β', 'PixelCraft', 'Architect', 'DevBot']
   */
  customAgentNames?: string[];

  /**
   * Mount container for the Shadow DOM overlay. Defaults to `document.body`.
   */
  container?: HTMLElement;

  /**
   * Enable diagnostic console logging.
   * @default false
   */
  debug?: boolean;

  /**
   * Callback fired when an agent transitions between lifecycle states.
   */
  onAgentStateChange?: (agentId: number, state: AgentState) => void;

  /**
   * Callback fired when a DOM element has finished construction.
   */
  onElementConstructed?: (element: HTMLElement) => void;

  /**
   * Callback fired when all detected page elements have been constructed.
   */
  onAllElementsConstructed?: () => void;

  /**
   * Callback fired when the swarm has converged onto the user cursor and completely vanished.
   */
  onSwarmVanished?: () => void;
}

export type ResolvedSwarmConfig = Required<
  Omit<
    SwarmConfig,
    | 'container'
    | 'onAgentStateChange'
    | 'onElementConstructed'
    | 'onAllElementsConstructed'
    | 'onSwarmVanished'
  >
> & {
  container?: HTMLElement;
  onAgentStateChange?: (agentId: number, state: AgentState) => void;
  onElementConstructed?: (element: HTMLElement) => void;
  onAllElementsConstructed?: () => void;
  onSwarmVanished?: () => void;
};

export interface ConstructionTask {
  id: string;
  element: HTMLElement;
  rect: DOMRect;
  boxType: BoundingBoxType;
  assignedAgents: number[];
  targetPositions: Vector2D[];
  startTime: number;
  duration: number;
  isText: boolean;
  boxElement?: HTMLElement;
  completed: boolean;
  cancelEffect?: () => void;
  // Enhanced agentic task spec
  spec?: {
    type: TaskType;
    sourceElement?: HTMLElement;
    axis?: 'x' | 'y';
    pos?: number;
    guideline?: { axis: 'x' | 'y'; pos: number };
    dx?: number;
    dy?: number;
    pathPoints?: Vector2D[];
  };
  deps?: string[];
}

export interface SwarmMetrics {
  fps: number;
  totalAgents: number;
  idleAgents: number;
  constructingAgents: number;
  convergingAgents: number;
  vanishedAgents: number;
  elementsConstructed: number;
  elementsPending: number;
  isFinished: boolean;
}

export interface DomSwarmInstance {
  /**
   * Terminate the swarm engine, remove the Shadow DOM overlay, and restore all native DOM styles.
   */
  destroy(): void;

  /**
   * Pause the Boids physics loop and active construction tasks.
   */
  pause(): void;

  /**
   * Resume the Boids physics loop and active construction tasks.
   */
  resume(): void;

  /**
   * Replays the entire swarm construction from the beginning:
   * clears elements back to blank, spawns cursors, and builds while scrolling.
   */
  replay(): void;

  /**
   * Manually dispatch autonomous agents to construct a specific DOM element immediately.
   */
  buildElement(element: HTMLElement): Promise<void>;

  /**
   * Retrieve the current read-only configuration.
   */
  getConfig(): Readonly<ResolvedSwarmConfig>;

  /**
   * Update configuration options dynamically at runtime.
   */
  updateConfig(newConfig: Partial<SwarmConfig>): void;

  /**
   * Check whether the swarm is currently paused.
   */
  isPaused(): boolean;

  /**
   * Check whether the swarm has finished building the page.
   */
  isFinished(): boolean;

  /**
   * Current number of active agents.
   */
  getActiveAgentCount(): number;

  /**
   * Retrieve live diagnostic performance telemetry.
   */
  getMetrics(): SwarmMetrics;
}
