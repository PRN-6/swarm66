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

export type AgentType =
  | 'pointer'
  | 'pen'
  | 'frame'
  | 'media'
  | 'button'
  | 'code'
  | 'ibeam'
  | 'hand'
  | 'duplicate';

export type ElementCategory = 'text' | 'container' | 'media' | 'button' | 'code' | 'input';

export type BoundingBoxType = 'blue' | 'red';

export type BuildOrder = 'top-to-bottom' | 'random' | 'viewport';

export type BorderRole = 'top' | 'right' | 'bottom' | 'left' | 'center';

export type TaskPhase = 'MOVING' | 'CLONING' | 'EXPANDING' | 'BUILDING' | 'DONE';

export interface SwarmConfig {
  /**
   * Total number of autonomous cursor agents in the swarm.
   * @default 18
   */
  agentCount?: number;

  /**
   * Number of agents assigned to each construction team.
   * @default 4
   */
  teamSize?: number;

  /**
   * When multiple elements/containers share the same dimensions,
   * animate a Figma-style copy-paste duplication and live editing sequence.
   * @default true
   */
  copyPasteDuplicates?: boolean;

  /**
   * Vibrant color palette for the cursor agents and wireframes.
   * @default ['#FF5722', '#00BCD4', '#8BC34A', '#9C27B0', '#FFC107', '#E91E63', '#2196F3']
   */
  colors?: string[];

  /**
   * CSS selector matching DOM elements to reverse-engineer and construct.
   * Covers semantic tags, structural sections, cards, badges, spec boxes, and leaf text containers.
   * @default 'header, nav, main, section, article, aside, footer, h1, h2, h3, h4, h5, h6, p, span, a, button, input, textarea, select, label, img, svg, canvas, video, pre, code, blockquote, li, table, [class*="card"], [class*="badge"], [class*="box"], [class*="panel"], [class*="item"], [class*="border"], [class*="btn"], [class*="spec"], [class*="pill"], .swarm-item'
   */
  selector?: string;

  /**
   * CSS selector to exclude elements from swarm construction.
   * @default '[data-no-swarm], script, style, noscript, dom-swarm-overlay, .swarm-hud'
   */
  ignoreSelector?: string;

  /**
   * Whether to initially hide all detected elements on page load, keeping the native background intact,
   * so the swarm builds the whole page from a blank canvas.
   * @default true
   */
  hideOnStart?: boolean;

  /**
   * Number of elements being constructed simultaneously in parallel by teams.
   * @default 4
   */
  concurrency?: number;

  /**
   * Order in which detected elements are constructed.
   * @default 'top-to-bottom'
   */
  buildOrder?: BuildOrder;

  /**
   * Once all page elements are constructed, all cursors converge to the user's cursor and vanish.
   * @default true
   */
  vanishAtCursor?: boolean;

  /**
   * Automatically detect SPA client-side route changes (Next.js, React Router, Vue Router, Nuxt, SvelteKit, Turbo)
   * and reconstruct elements on every visited page.
   * @default true
   */
  rebuildOnRouteChange?: boolean;

  /**
   * Whether to construct elements automatically when they enter the viewport via scrolling.
   * @default true
   */
  buildOnScroll?: boolean;

  /**
   * Simulate a fast typewriter reveal effect for text nodes (p, h1-h6, code, etc.).
   * @default true
   */
  typewriterEffect?: boolean;

  /**
   * Show Figma-style full-screen horizontal and vertical alignment guides during construction.
   * @default true
   */
  showGuides?: boolean;

  /**
   * Show dimensional pixel badge (e.g., "380 × 48") on selection bounding boxes.
   * @default true
   */
  showDimensions?: boolean;

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
   * @default 550
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
  borderRoles: BorderRole[];
  phase: TaskPhase;
  isCopyPaste: boolean;
  sourceRect?: DOMRect;
  startTime: number;
  expandStartTime: number;
  expandDuration: number;
  duration: number;
  isText: boolean;
  category?: ElementCategory;
  cursorType?: AgentType;
  boxElement?: HTMLElement;
  cloneElement?: HTMLElement;
  completed: boolean;
  cancelEffect?: () => void;
  watchdogTimer?: any;
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
  destroy(): void;
  pause(): void;
  resume(): void;
  replay(): void;
  handlePageNavigation(): void;
  buildElement(element: HTMLElement): Promise<void>;
  getConfig(): Readonly<ResolvedSwarmConfig>;
  updateConfig(newConfig: Partial<SwarmConfig>): void;
  isPaused(): boolean;
  isFinished(): boolean;
  getActiveAgentCount(): number;
  getMetrics(): SwarmMetrics;
}
