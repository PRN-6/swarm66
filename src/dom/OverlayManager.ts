import { AgentType, BoundingBoxType } from '../types';

export interface BoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right?: number;
  bottom?: number;
}

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
    for (let x = -100; x <= 2400; x += 100) {
      html += `<div class="swarm-ruler-tick-num" style="left: ${x + 100}px;">${x}</div>`;
      for (let sub = 10; sub < 100; sub += 10) {
        const height = sub === 50 ? 7 : 4;
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
    for (let y = 0; y <= 2400; y += 100) {
      html += `<div class="swarm-ruler-tick-num-v" style="top: ${y}px;">${y}</div>`;
      for (let sub = 10; sub < 100; sub += 10) {
        const width = sub === 50 ? 7 : 4;
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
      if (visible) {
        this.rulersContainer.classList.add('visible');
      } else {
        this.rulersContainer.classList.remove('visible');
      }
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
   * Keeps arrow cursor upright with hotspot tip at (4, 3) like Figma.
   */
  public updateAgentTransform(
    el: HTMLElement,
    x: number,
    y: number,
    _angleDeg: number,
    scale = 1
  ): void {
    const isIBeam = el.querySelector('.is-ibeam') !== null;
    const isCross = el.querySelector('.is-crosshair') !== null;
    const offsetX = isIBeam || isCross ? 11 : 4;
    const offsetY = isIBeam || isCross ? 11 : 3;

    el.style.transform = `translate3d(${(x - offsetX).toFixed(1)}px, ${(y - offsetY).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
  }

  /**
   * Changes agent cursor appearance (pointer, ibeam, or crosshair).
   */
  public setAgentType(iconContainer: HTMLElement, type: AgentType, color: string): void {
    if (type === 'ibeam') {
      iconContainer.innerHTML = this.getIBeamSvg(color);
      iconContainer.classList.add('is-ibeam');
      iconContainer.classList.remove('is-crosshair');
    } else if (type === 'crosshair') {
      iconContainer.innerHTML = this.getCrosshairSvg(color);
      iconContainer.classList.add('is-crosshair');
      iconContainer.classList.remove('is-ibeam');
    } else {
      iconContainer.innerHTML = this.getPointerSvg(color);
      iconContainer.classList.remove('is-ibeam', 'is-crosshair');
    }
  }

  /**
   * Compatibility alias for setAgentType.
   */
  public setAgentIcon(iconContainer: HTMLElement, type: AgentType, color: string): void {
    this.setAgentType(iconContainer, type, color);
  }

  /**
   * Creates a bold, crisp Figma selection bounding box overlay with 8 resize handles.
   */
  public createBoundingBox(
    id: string,
    rect: BoxRect,
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
    box.style.width = `${Math.max(6, rect.width)}px`;
    box.style.height = `${Math.max(6, rect.height)}px`;

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
  private createAlignmentGuides(id: string, rect: BoxRect): void {
    if (!this.guidesLayer) return;

    const right = rect.right !== undefined ? rect.right : rect.left + rect.width;
    const bottom = rect.bottom !== undefined ? rect.bottom : rect.top + rect.height;

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
    hBottom.style.top = `${bottom}px`;

    // Vertical cyan dashed line at right
    const vRight = document.createElement('div');
    vRight.className = 'swarm-guide swarm-guide-cyan-v';
    vRight.style.left = `${right}px`;

    // Crosshair markers at corners
    const cross1 = document.createElement('div');
    cross1.className = 'swarm-crosshair crosshair-tl';
    cross1.textContent = '+';
    cross1.style.left = `${rect.left}px`;
    cross1.style.top = `${rect.top}px`;

    const cross2 = document.createElement('div');
    cross2.className = 'swarm-crosshair crosshair-br';
    cross2.textContent = '+';
    cross2.style.left = `${right}px`;
    cross2.style.top = `${bottom}px`;

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
  public updateBoundingBox(boxEl: HTMLElement, rect: BoxRect, id?: string): void {
    boxEl.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    boxEl.style.width = `${Math.max(6, rect.width)}px`;
    boxEl.style.height = `${Math.max(6, rect.height)}px`;

    const dimBadge = boxEl.querySelector('.swarm-dimension-badge');
    if (dimBadge) {
      dimBadge.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    }

    if (id && this.guidesLayer && this.shadowRoot) {
      const guidesGroup = this.shadowRoot.getElementById(`swarm-guides-${id}`);
      if (guidesGroup) {
        const right = rect.right !== undefined ? rect.right : rect.left + rect.width;
        const bottom = rect.bottom !== undefined ? rect.bottom : rect.top + rect.height;

        const redV = guidesGroup.querySelector<HTMLElement>('.swarm-guide-red-v');
        if (redV) redV.style.left = `${rect.left}px`;

        const hCyan = guidesGroup.querySelectorAll<HTMLElement>('.swarm-guide-cyan-h');
        if (hCyan[0]) hCyan[0].style.top = `${rect.top}px`;
        if (hCyan[1]) hCyan[1].style.top = `${bottom}px`;

        const vCyan = guidesGroup.querySelector<HTMLElement>('.swarm-guide-cyan-v');
        if (vCyan) vCyan.style.left = `${right}px`;

        const cross1 = guidesGroup.querySelector<HTMLElement>('.crosshair-tl');
        if (cross1) {
          cross1.style.left = `${rect.left}px`;
          cross1.style.top = `${rect.top}px`;
        }

        const cross2 = guidesGroup.querySelector<HTMLElement>('.crosshair-br');
        if (cross2) {
          cross2.style.left = `${right}px`;
          cross2.style.top = `${bottom}px`;
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
   * Figma-exact pointer arrow SVG.
   */
  private getPointerSvg(color: string): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.6 3.9 C4.2 3.1 4.9 2.4 5.7 2.8 L20.6 9.4 C21.5 9.8 21.4 11.1 20.4 11.3 L13.9 12.9 C13.4 13 13 13.4 12.9 13.9 L11.3 20.4 C11.1 21.4 9.8 21.5 9.4 20.6 Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Figma I-Beam text SVG icon string.
   */
  private getIBeamSvg(color: string): string {
    const d = "M8.5 4.5 H10.5 Q12 4.5 12 6 Q12 4.5 13.5 4.5 H15.5 M12 6 V18 M8.5 19.5 H10.5 Q12 19.5 12 18 Q12 19.5 13.5 19.5 H15.5";
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="${d}" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round"/>
      <path d="${d}" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Figma Crosshair (+) SVG icon string.
   */
  private getCrosshairSvg(color: string): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Scoped CSS styles injected directly into Shadow DOM.
   */
  private getScopedStyles(): string {
    return `
      :host {
        all: initial;
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483647;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .swarm-root {
        position: absolute;
        inset: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        pointer-events: none;
        user-select: none;
      }

      /* Figma Rulers Container */
      .swarm-rulers-wrapper {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 40;
      }

      .swarm-ruler-corner {
        position: fixed;
        top: 0;
        left: 0;
        width: 20px;
        height: 20px;
        background: #2c2c2c;
        border-right: 1px solid #3a3a3a;
        border-bottom: 1px solid #3a3a3a;
        z-index: 42;
        opacity: 0;
        transition: opacity 0.25s ease;
      }

      .swarm-ruler-top {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 20px;
        background: #2c2c2c;
        border-bottom: 1px solid #3a3a3a;
        z-index: 41;
        overflow: hidden;
        transform: translateY(-100%);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .swarm-ruler-left {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: 20px;
        background: #2c2c2c;
        border-right: 1px solid #3a3a3a;
        z-index: 41;
        overflow: hidden;
        transform: translateX(-100%);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .swarm-rulers-wrapper.visible .swarm-ruler-top {
        transform: translateY(0);
      }
      .swarm-rulers-wrapper.visible .swarm-ruler-left {
        transform: translateX(0);
      }
      .swarm-rulers-wrapper.visible .swarm-ruler-corner {
        opacity: 1;
      }

      .swarm-ruler-tick-num {
        position: absolute;
        bottom: 7px;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 9px;
        font-weight: 500;
        color: #8c8c8c;
        transform: translateX(-50%);
        letter-spacing: -0.2px;
      }
      .swarm-ruler-tick {
        position: absolute;
        bottom: 0;
        width: 1px;
        background: #5e5e5e;
      }

      .swarm-ruler-tick-num-v {
        position: absolute;
        right: 6px;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 8px;
        font-weight: 500;
        color: #8c8c8c;
        transform: translateY(-50%) rotate(-90deg);
        letter-spacing: -0.2px;
      }
      .swarm-ruler-tick-v {
        position: absolute;
        right: 0;
        height: 1px;
        background: #5e5e5e;
      }

      /* Active highlighted coordinate segments on rulers */
      .swarm-ruler-segment-top {
        position: absolute;
        top: 0;
        height: 20px;
        background: rgba(13, 153, 255, 0.22);
        color: #0d99ff;
        font-family: Inter, -apple-system, system-ui, sans-serif;
        font-weight: 600;
        font-size: 9px;
        display: flex;
        align-items: center;
        padding-left: 3px;
        overflow: hidden;
        white-space: nowrap;
      }
      .swarm-ruler-segment-left {
        position: absolute;
        left: 0;
        width: 20px;
        background: rgba(13, 153, 255, 0.22);
        color: #0d99ff;
        font-family: Inter, -apple-system, system-ui, sans-serif;
        font-weight: 600;
        font-size: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        white-space: nowrap;
        writing-mode: vertical-lr;
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
        opacity: 0.85;
      }
      .swarm-guide-cyan-h {
        left: 0;
        right: 0;
        width: 100vw;
        height: 1px;
        background: transparent;
        border-top: 1px dashed rgba(13, 153, 255, 0.5);
      }
      .swarm-guide-cyan-v {
        top: 0;
        bottom: 0;
        height: 100vh;
        width: 1px;
        background: transparent;
        border-left: 1px dashed rgba(13, 153, 255, 0.5);
      }
      .swarm-crosshair {
        position: absolute;
        transform: translate(-50%, -50%);
        font-size: 13px;
        font-weight: 600;
        color: #0d99ff;
        pointer-events: none;
        line-height: 1;
      }

      /* Cursors */
      .swarm-agent {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
        transition: opacity 0.15s ease;
      }
      .swarm-agent-icon {
        display: inline-block;
        pointer-events: none;
      }
      .swarm-agent-icon.is-ibeam {
        animation: swarm-ibeam-pulse 0.6s infinite alternate ease-in-out;
      }
      @keyframes swarm-ibeam-pulse {
        0% { opacity: 0.8; }
        100% { opacity: 1; }
      }

      .swarm-agent-label {
        position: absolute;
        top: 16px;
        left: 14px;
        padding: 2px 6px;
        border-radius: 4px;
        color: #ffffff;
        font-size: 10px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      }

      /* Figma Selection & Wireframe Bounding Boxes */
      .swarm-bounding-box {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform, width, height;
        box-sizing: border-box;
      }
      .box-blue {
        border: 1.5px solid #0d99ff;
        background: rgba(13, 153, 255, 0.035);
      }
      .box-red {
        border: 1.5px solid #f24822;
        background: rgba(242, 72, 34, 0.035);
      }

      /* 8 Figma Handles (7px × 7px white squares with box-colored 1px border) */
      .swarm-corner-handle {
        position: absolute;
        width: 7px;
        height: 7px;
        background: #ffffff;
        border: 1px solid #0d99ff;
        border-radius: 1px;
        box-sizing: border-box;
      }
      .box-red .swarm-corner-handle {
        border-color: #f24822;
      }
      .handle-tl { top: -3.5px; left: -3.5px; }
      .handle-tr { top: -3.5px; right: -3.5px; }
      .handle-bl { bottom: -3.5px; left: -3.5px; }
      .handle-br { bottom: -3.5px; right: -3.5px; }
      .handle-mt { top: -3.5px; left: calc(50% - 3.5px); }
      .handle-mb { bottom: -3.5px; left: calc(50% - 3.5px); }
      .handle-ml { left: -3.5px; top: calc(50% - 3.5px); }
      .handle-mr { right: -3.5px; top: calc(50% - 3.5px); }

      /* Figma Dimension Pill Badge */
      .swarm-dimension-badge {
        position: absolute;
        left: 50%;
        top: calc(100% + 8px);
        transform: translateX(-50%);
        background: #0d99ff;
        color: #ffffff;
        font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        font-size: 11px;
        line-height: 16px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        padding: 1px 5px;
        border-radius: 2px;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
      }
      .box-red .swarm-dimension-badge {
        background: #f24822;
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
