import { AgentType, BoundingBoxType } from '../types';

export interface ActiveRulerSegment {
  left: number;
  width: number;
  top: number;
  height: number;
}

/**
 * Manages the open Shadow DOM overlay container, Figma rulers,
 * full-screen red & cyan alignment guide lines, SVG cursors, and selection bounding boxes.
 */
export class OverlayManager {
  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private agentsLayer: HTMLElement | null = null;
  private overlaysLayer: HTMLElement | null = null;
  private guidesLayer: HTMLElement | null = null;
  private rulersContainer: HTMLElement | null = null;
  private topRulerSegmentsEl: HTMLElement | null = null;
  private leftRulerSegmentsEl: HTMLElement | null = null;
  private mounted = false;

  constructor(private container: HTMLElement = typeof document !== 'undefined' ? document.body : (null as any)) {}

  /**
   * Mounts the full-screen Shadow DOM overlay.
   */
  public mount(showRulers = true): boolean {
    if (this.mounted || typeof document === 'undefined') return false;

    // Create root host element
    const host = document.createElement('dom-swarm-overlay');
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.width = '100vw';
    host.style.height = '100vh';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '2147483647';
    host.style.overflow = 'hidden';

    // Attach open Shadow DOM
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject scoped styles
    const styleEl = document.createElement('style');
    styleEl.textContent = this.getScopedStyles();
    shadow.appendChild(styleEl);

    // Root wrapper inside shadow
    const wrapper = document.createElement('div');
    wrapper.className = 'swarm-root';

    // 1. Figma Rulers Layer
    if (showRulers) {
      const rulers = this.createRulers();
      wrapper.appendChild(rulers);
      this.rulersContainer = rulers;
    }

    // 2. Alignment guides layer
    const guides = document.createElement('div');
    guides.className = 'swarm-guides-layer';
    wrapper.appendChild(guides);

    // 3. Bounding boxes layer
    const overlays = document.createElement('div');
    overlays.className = 'swarm-overlays-layer';
    wrapper.appendChild(overlays);

    // 4. Agents cursor layer (top)
    const agents = document.createElement('div');
    agents.className = 'swarm-agents-layer';
    wrapper.appendChild(agents);

    shadow.appendChild(wrapper);

    // Mount to host container
    const targetParent = this.container || document.body;
    targetParent.appendChild(host);

    this.hostElement = host;
    this.shadowRoot = shadow;
    this.guidesLayer = guides;
    this.overlaysLayer = overlays;
    this.agentsLayer = agents;
    this.mounted = true;

    return true;
  }

  /**
   * Constructs the Figma-style top and left measurement rulers.
   */
  private createRulers(): HTMLElement {
    const rulers = document.createElement('div');
    rulers.className = 'swarm-rulers-wrapper';

    // Corner box
    const corner = document.createElement('div');
    corner.className = 'swarm-ruler-corner';
    rulers.appendChild(corner);

    // Top horizontal ruler
    const topRuler = document.createElement('div');
    topRuler.className = 'swarm-ruler-top';
    topRuler.innerHTML = this.generateTopRulerTicks();

    const topSegments = document.createElement('div');
    topSegments.className = 'swarm-ruler-segments-top';
    topRuler.appendChild(topSegments);
    rulers.appendChild(topRuler);

    // Left vertical ruler
    const leftRuler = document.createElement('div');
    leftRuler.className = 'swarm-ruler-left';
    leftRuler.innerHTML = this.generateLeftRulerTicks();

    const leftSegments = document.createElement('div');
    leftSegments.className = 'swarm-ruler-segments-left';
    leftRuler.appendChild(leftSegments);
    rulers.appendChild(leftRuler);

    this.topRulerSegmentsEl = topSegments;
    this.leftRulerSegmentsEl = leftSegments;

    return rulers;
  }

  /**
   * Generates tick marks and coordinate numbers for top ruler.
   */
  private generateTopRulerTicks(): string {
    let html = '';
    for (let x = -100; x <= 2200; x += 100) {
      html += `<div class="swarm-ruler-tick-num" style="left: ${x + 100}px;">${x}</div>`;
      for (let sub = 10; sub < 100; sub += 10) {
        const height = sub === 50 ? 8 : 4;
        html += `<div class="swarm-ruler-tick" style="left: ${x + 100 + sub}px; height: ${height}px;"></div>`;
      }
    }
    return html;
  }

  /**
   * Generates tick marks and coordinate numbers for left ruler.
   */
  private generateLeftRulerTicks(): string {
    let html = '';
    for (let y = 0; y <= 2000; y += 100) {
      html += `<div class="swarm-ruler-tick-num-v" style="top: ${y}px;">${y}</div>`;
      for (let sub = 10; sub < 100; sub += 10) {
        const width = sub === 50 ? 8 : 4;
        html += `<div class="swarm-ruler-tick-v" style="top: ${y + sub}px; width: ${width}px;"></div>`;
      }
    }
    return html;
  }

  /**
   * Shows or hides the Figma rulers.
   */
  public setRulersVisible(visible: boolean): void {
    if (this.rulersContainer) {
      this.rulersContainer.style.opacity = visible ? '1' : '0';
      this.rulersContainer.style.pointerEvents = 'none';
    }
  }

  /**
   * Updates the highlighted blue coordinate segments on the top and left rulers.
   */
  public updateRulerSegments(segments: ActiveRulerSegment[]): void {
    if (!this.topRulerSegmentsEl || !this.leftRulerSegmentsEl) return;

    let topHtml = '';
    let leftHtml = '';

    segments.forEach((s) => {
      const leftVal = Math.round(s.left);
      const topVal = Math.round(s.top);

      topHtml += `<div class="swarm-ruler-segment-top" style="left: ${s.left}px; width: ${s.width}px;">${leftVal}</div>`;
      leftHtml += `<div class="swarm-ruler-segment-left" style="top: ${s.top}px; height: ${s.height}px;">${topVal}</div>`;
    });

    this.topRulerSegmentsEl.innerHTML = topHtml;
    this.leftRulerSegmentsEl.innerHTML = leftHtml;
  }

  /**
   * Creates an agent cursor element with SVG icon (and optional label badge).
   */
  public createAgentElement(id: number, color: string, label?: string, showLabel = false): {
    element: HTMLElement;
    iconContainer: HTMLElement;
    labelEl: HTMLElement | null;
  } {
    if (!this.agentsLayer) {
      throw new Error('[dom-swarm] OverlayManager is not mounted.');
    }

    const agentEl = document.createElement('div');
    agentEl.className = 'swarm-agent';
    agentEl.dataset.agentId = id.toString();

    // Inner icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'swarm-agent-icon';
    iconContainer.innerHTML = this.getPointerSvg(color);

    agentEl.appendChild(iconContainer);

    let labelEl: HTMLElement | null = null;
    if (showLabel && label) {
      labelEl = document.createElement('div');
      labelEl.className = 'swarm-agent-label';
      labelEl.style.backgroundColor = color;
      labelEl.textContent = label;
      agentEl.appendChild(labelEl);
    }

    this.agentsLayer.appendChild(agentEl);

    return { element: agentEl, iconContainer, labelEl };
  }

  /**
   * Updates hardware-accelerated transform of an agent cursor.
   */
  public updateAgentTransform(
    el: HTMLElement,
    x: number,
    y: number,
    angleDeg: number,
    scale = 1
  ): void {
    const isIBeam = el.querySelector('.is-ibeam') !== null;
    const offsetX = isIBeam ? 10 : 3;
    const offsetY = isIBeam ? 12 : 2;
    el.style.transform = `translate3d(${x - offsetX}px, ${y - offsetY}px, 0) rotate(${angleDeg}deg) scale(${scale})`;
  }

  /**
   * Morphs/switches an agent icon between pointer arrow, I-beam text cursor, and crosshair.
   */
  public setAgentIcon(iconContainer: HTMLElement, type: AgentType, color: string): void {
    if (type === 'ibeam') {
      iconContainer.innerHTML = this.getIBeamSvg(color);
      iconContainer.classList.add('is-ibeam');
    } else if (type === 'crosshair') {
      iconContainer.innerHTML = this.getCrosshairSvg(color);
      iconContainer.classList.remove('is-ibeam');
    } else {
      iconContainer.innerHTML = this.getPointerSvg(color);
      iconContainer.classList.remove('is-ibeam');
    }
  }

  /**
   * Creates a bold, crisp Figma selection bounding box overlay with 8 resize handles.
   */
  public createBoundingBox(
    id: string,
    rect: DOMRect,
    type: BoundingBoxType,
    showDimensions = true,
    showGuides = true
  ): HTMLElement {
    if (!this.overlaysLayer) {
      throw new Error('[dom-swarm] OverlayManager is not mounted.');
    }

    const box = document.createElement('div');
    box.className = `swarm-bounding-box box-${type}`;
    box.id = `swarm-box-${id}`;

    // Apply geometry
    box.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    box.style.width = `${Math.max(8, rect.width)}px`;
    box.style.height = `${Math.max(8, rect.height)}px`;

    // 8 Figma Resize Handles (4 corners + 4 midpoints)
    const handles = ['tl', 'tr', 'bl', 'br', 'mt', 'mb', 'ml', 'mr'];
    handles.forEach((h) => {
      const handle = document.createElement('div');
      handle.className = `swarm-corner-handle handle-${h}`;
      box.appendChild(handle);
    });

    // Dimension badge (e.g., "580 × 130")
    if (showDimensions) {
      const badge = document.createElement('div');
      badge.className = 'swarm-dimension-badge';
      badge.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
      box.appendChild(badge);
    }

    // Full-screen alignment guidelines & crosshairs
    if (showGuides && this.guidesLayer) {
      this.createAlignmentGuides(id, rect);
    }

    this.overlaysLayer.appendChild(box);
    return box;
  }

  /**
   * Creates full-screen red alignment guide lines and cyan dashed layout lines with crosshairs.
   */
  private createAlignmentGuides(id: string, rect: DOMRect): void {
    if (!this.guidesLayer) return;

    const guidesContainer = document.createElement('div');
    guidesContainer.className = 'swarm-guides-group';
    guidesContainer.id = `swarm-guides-${id}`;

    // Full-screen solid red vertical guideline at left margin
    const redV = document.createElement('div');
    redV.className = 'swarm-guide swarm-guide-red-v';
    redV.style.left = `${rect.left}px`;

    // Horizontal cyan dashed line at top
    const hTop = document.createElement('div');
    hTop.className = 'swarm-guide swarm-guide-cyan-h';
    hTop.style.top = `${rect.top}px`;

    // Horizontal cyan dashed line at bottom
    const hBottom = document.createElement('div');
    hBottom.className = 'swarm-guide swarm-guide-cyan-h';
    hBottom.style.top = `${rect.bottom}px`;

    // Vertical cyan dashed line at right
    const vRight = document.createElement('div');
    vRight.className = 'swarm-guide swarm-guide-cyan-v';
    vRight.style.left = `${rect.right}px`;

    // Crosshair markers at corners
    const cross1 = document.createElement('div');
    cross1.className = 'swarm-crosshair crosshair-tl';
    cross1.textContent = '+';
    cross1.style.left = `${rect.left}px`;
    cross1.style.top = `${rect.top}px`;

    const cross2 = document.createElement('div');
    cross2.className = 'swarm-crosshair crosshair-br';
    cross2.textContent = '+';
    cross2.style.left = `${rect.right}px`;
    cross2.style.top = `${rect.bottom}px`;

    guidesContainer.appendChild(redV);
    guidesContainer.appendChild(hTop);
    guidesContainer.appendChild(hBottom);
    guidesContainer.appendChild(vRight);
    guidesContainer.appendChild(cross1);
    guidesContainer.appendChild(cross2);

    this.guidesLayer.appendChild(guidesContainer);
  }

  /**
   * Updates coordinates of an existing bounding box and its alignment guides during scrolling/resizing.
   */
  public updateBoundingBox(boxEl: HTMLElement, rect: DOMRect, id?: string): void {
    boxEl.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    boxEl.style.width = `${Math.max(8, rect.width)}px`;
    boxEl.style.height = `${Math.max(8, rect.height)}px`;

    const dimBadge = boxEl.querySelector('.swarm-dimension-badge');
    if (dimBadge) {
      dimBadge.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    }

    if (id && this.guidesLayer) {
      const guidesGroup = this.shadowRoot?.getElementById(`swarm-guides-${id}`);
      if (guidesGroup) {
        const redV = guidesGroup.querySelector<HTMLElement>('.swarm-guide-red-v');
        if (redV) redV.style.left = `${rect.left}px`;

        const hCyan = guidesGroup.querySelectorAll<HTMLElement>('.swarm-guide-cyan-h');
        if (hCyan[0]) hCyan[0].style.top = `${rect.top}px`;
        if (hCyan[1]) hCyan[1].style.top = `${rect.bottom}px`;

        const vCyan = guidesGroup.querySelector<HTMLElement>('.swarm-guide-cyan-v');
        if (vCyan) vCyan.style.left = `${rect.right}px`;

        const cross1 = guidesGroup.querySelector<HTMLElement>('.crosshair-tl');
        if (cross1) {
          cross1.style.left = `${rect.left}px`;
          cross1.style.top = `${rect.top}px`;
        }

        const cross2 = guidesGroup.querySelector<HTMLElement>('.crosshair-br');
        if (cross2) {
          cross2.style.left = `${rect.right}px`;
          cross2.style.top = `${rect.bottom}px`;
        }
      }
    }
  }

  /**
   * Removes a bounding box overlay and any attached guide lines.
   */
  public removeBoundingBox(boxEl: HTMLElement, id?: string): void {
    if (boxEl.parentNode) {
      boxEl.parentNode.removeChild(boxEl);
    }
    if (id && this.shadowRoot) {
      const guides = this.shadowRoot.getElementById(`swarm-guides-${id}`);
      if (guides && guides.parentNode) {
        guides.parentNode.removeChild(guides);
      }
    }
  }

  /**
   * Pointer SVG icon string.
   */
  private getPointerSvg(color: string): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2L10 21L13.5 13.5L21 10L3 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * I-Beam text SVG icon string.
   */
  private getIBeamSvg(color: string): string {
    return `<svg width="22" height="26" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 3H16M10 3V21M4 21H16" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M4 3H16M10 3V21M4 21H16" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Crosshair (+) SVG icon string.
   */
  private getCrosshairSvg(color: string): string {
    return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2V18M2 10H18" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Scoped CSS styles injected directly into Shadow DOM.
   */
  private getScopedStyles(): string {
    return `
      :host {
        all: initial;
        pointer-events: none;
      }
      .swarm-root {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        overflow: hidden;
        user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }

      /* Figma Rulers */
      .swarm-rulers-wrapper {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 50;
        transition: opacity 0.3s ease;
      }
      .swarm-ruler-corner {
        position: fixed;
        top: 0;
        left: 0;
        width: 24px;
        height: 22px;
        background: #18191c;
        border-right: 1px solid #2d2f34;
        border-bottom: 1px solid #2d2f34;
        z-index: 55;
      }
      .swarm-ruler-top {
        position: fixed;
        top: 0;
        left: 24px;
        right: 0;
        height: 22px;
        background: #18191c;
        color: #72747d;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 9px;
        border-bottom: 1px solid #2d2f34;
        overflow: hidden;
        pointer-events: none;
        z-index: 50;
      }
      .swarm-ruler-left {
        position: fixed;
        top: 22px;
        left: 0;
        bottom: 0;
        width: 24px;
        background: #18191c;
        color: #72747d;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 9px;
        border-right: 1px solid #2d2f34;
        overflow: hidden;
        pointer-events: none;
        z-index: 50;
      }
      .swarm-ruler-tick {
        position: absolute;
        bottom: 0;
        width: 1px;
        background: #3a3d45;
      }
      .swarm-ruler-tick-num {
        position: absolute;
        bottom: 4px;
        transform: translateX(-50%);
        font-size: 8px;
        color: #8a8d98;
      }
      .swarm-ruler-tick-v {
        position: absolute;
        right: 0;
        height: 1px;
        background: #3a3d45;
      }
      .swarm-ruler-tick-num-v {
        position: absolute;
        right: 3px;
        font-size: 7px;
        color: #8a8d98;
      }
      .swarm-ruler-segments-top,
      .swarm-ruler-segments-left {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .swarm-ruler-segment-top {
        position: absolute;
        top: 0;
        height: 22px;
        background: rgba(0, 163, 255, 0.35);
        border-left: 1px solid #00a3ff;
        border-right: 1px solid #00a3ff;
        color: #ffffff;
        font-weight: 700;
        font-size: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        white-space: nowrap;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      .swarm-ruler-segment-left {
        position: absolute;
        left: 0;
        width: 24px;
        background: rgba(0, 163, 255, 0.35);
        border-top: 1px solid #00a3ff;
        border-bottom: 1px solid #00a3ff;
        color: #ffffff;
        font-weight: 700;
        font-size: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        white-space: nowrap;
        writing-mode: vertical-lr;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }

      /* Guide Lines & Wireframes */
      .swarm-guides-layer {
        position: absolute;
        inset: 0;
        z-index: 10;
        pointer-events: none;
      }
      .swarm-overlays-layer {
        position: absolute;
        inset: 0;
        z-index: 20;
        pointer-events: none;
      }
      .swarm-agents-layer {
        position: absolute;
        inset: 0;
        z-index: 30;
        pointer-events: none;
      }

      .swarm-guide {
        position: absolute;
        pointer-events: none;
      }
      .swarm-guide-red-v {
        top: 0;
        bottom: 0;
        height: 100vh;
        width: 1px;
        background: #f24822;
        box-shadow: 0 0 6px rgba(242, 72, 34, 0.7);
      }
      .swarm-guide-cyan-h {
        left: 0;
        right: 0;
        width: 100vw;
        height: 1px;
        background: transparent;
        border-top: 1px dashed rgba(0, 168, 255, 0.65);
      }
      .swarm-guide-cyan-v {
        top: 0;
        bottom: 0;
        height: 100vh;
        width: 1px;
        background: transparent;
        border-left: 1px dashed rgba(0, 168, 255, 0.65);
      }
      .swarm-crosshair {
        position: absolute;
        transform: translate(-50%, -50%);
        font-size: 14px;
        font-weight: bold;
        color: #00a8ff;
        pointer-events: none;
        line-height: 1;
        text-shadow: 0 0 4px rgba(0, 168, 255, 0.8);
      }

      /* Cursors */
      .swarm-agent {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform;
        transform-origin: 3px 2px;
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.45));
        transition: opacity 0.2s ease;
      }
      .swarm-agent-icon {
        display: inline-block;
        pointer-events: none;
        transform-origin: 0 0;
        transition: transform 0.15s ease;
      }
      .swarm-agent-icon.is-ibeam {
        animation: swarm-ibeam-pulse 0.5s infinite alternate ease-in-out;
      }
      @keyframes swarm-ibeam-pulse {
        0% { opacity: 0.7; transform: scale(0.95); }
        100% { opacity: 1; transform: scale(1.1); }
      }
      .swarm-agent-label {
        position: absolute;
        top: 16px;
        left: 14px;
        padding: 2px 7px;
        border-radius: 4px;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.4px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.4);
      }

      /* Figma Blue Selection Boxes */
      .swarm-bounding-box {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform, width, height;
        box-sizing: border-box;
        border-radius: 2px;
        transition: opacity 0.2s ease;
      }
      .box-blue {
        border: 1.5px solid #00a8ff;
        background: rgba(0, 168, 255, 0.08);
        box-shadow: 0 0 14px rgba(0, 168, 255, 0.35);
      }
      .box-red {
        border: 1.5px solid #f24822;
        background: rgba(242, 72, 34, 0.08);
        box-shadow: 0 0 14px rgba(242, 72, 34, 0.35);
      }

      /* 8 Figma Handles */
      .swarm-corner-handle {
        position: absolute;
        width: 6px;
        height: 6px;
        background: #ffffff;
        border: 1.5px solid #00a8ff;
        border-radius: 1px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
      }
      .handle-tl { top: -4px; left: -4px; }
      .handle-tr { top: -4px; right: -4px; }
      .handle-bl { bottom: -4px; left: -4px; }
      .handle-br { bottom: -4px; right: -4px; }
      .handle-mt { top: -4px; left: calc(50% - 3px); }
      .handle-mb { bottom: -4px; left: calc(50% - 3px); }
      .handle-ml { left: -4px; top: calc(50% - 3px); }
      .handle-mr { right: -4px; top: calc(50% - 3px); }

      /* Figma Dimension Pill Badge */
      .swarm-dimension-badge {
        position: absolute;
        left: 50%;
        bottom: -24px;
        transform: translateX(-50%);
        background: #00a8ff;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        letter-spacing: 0.2px;
      }
    `;
  }

  /**
   * Destroys and cleans up the overlay.
   */
  public destroy(): void {
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
    this.hostElement = null;
    this.shadowRoot = null;
    this.agentsLayer = null;
    this.overlaysLayer = null;
    this.guidesLayer = null;
    this.rulersContainer = null;
    this.topRulerSegmentsEl = null;
    this.leftRulerSegmentsEl = null;
    this.mounted = false;
  }
}
