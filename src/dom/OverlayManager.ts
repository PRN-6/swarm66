import { AgentType, BoundingBoxType } from '../types';

/**
 * Manages the open Shadow DOM overlay container, scoped CSS styles,
 * SVG cursor rendering, Figma selection boxes, and alignment guides.
 */
export class OverlayManager {
  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private agentsLayer: HTMLElement | null = null;
  private overlaysLayer: HTMLElement | null = null;
  private guidesLayer: HTMLElement | null = null;
  private mounted = false;

  constructor(private container: HTMLElement = typeof document !== 'undefined' ? document.body : (null as any)) {}

  /**
   * Mounts the full-screen Shadow DOM overlay.
   */
  public mount(): boolean {
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

    // Alignment guides layer (bottom)
    const guides = document.createElement('div');
    guides.className = 'swarm-guides-layer';
    wrapper.appendChild(guides);

    // Bounding boxes layer (middle)
    const overlays = document.createElement('div');
    overlays.className = 'swarm-overlays-layer';
    wrapper.appendChild(overlays);

    // Agents cursor layer (top)
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
   * Creates an agent cursor element with crisp SVG icon (no text badges).
   */
  public createAgentElement(id: number, color: string): {
    element: HTMLElement;
    iconContainer: HTMLElement;
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
    this.agentsLayer.appendChild(agentEl);

    return { element: agentEl, iconContainer };
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
    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angleDeg}deg) scale(${scale})`;
  }

  /**
   * Morphs/switches an agent icon to match the contextual tool category
   * (e.g. pen for text, frame for containers, media for images, button for clicks, duplicate for clones).
   */
  public setAgentIcon(iconContainer: HTMLElement, type: AgentType, color: string): void {
    iconContainer.className = 'swarm-agent-icon';

    switch (type) {
      case 'pen':
        iconContainer.innerHTML = this.getPenSvg(color);
        iconContainer.classList.add('is-pen');
        break;
      case 'frame':
        iconContainer.innerHTML = this.getFrameSvg(color);
        iconContainer.classList.add('is-frame');
        break;
      case 'media':
        iconContainer.innerHTML = this.getMediaSvg(color);
        iconContainer.classList.add('is-media');
        break;
      case 'button':
        iconContainer.innerHTML = this.getButtonSvg(color);
        iconContainer.classList.add('is-button');
        break;
      case 'code':
        iconContainer.innerHTML = this.getCodeSvg(color);
        iconContainer.classList.add('is-code');
        break;
      case 'ibeam':
        iconContainer.innerHTML = this.getIBeamSvg(color);
        iconContainer.classList.add('is-ibeam');
        break;
      case 'hand':
      case 'duplicate':
        iconContainer.innerHTML = this.getHandSvg(color);
        iconContainer.classList.add('is-hand');
        break;
      case 'pointer':
      default:
        iconContainer.innerHTML = this.getPointerSvg(color);
        break;
    }
  }

  /**
   * Creates an animated selection bounding box overlay drawn by the swarm.
   */
  public createBoundingBox(
    id: string,
    rect: DOMRect,
    type: BoundingBoxType,
    showDimensions = true,
    showGuides = true,
    initialGeometry?: { left: number; top: number; width: number; height: number; opacity?: number }
  ): HTMLElement {
    if (!this.overlaysLayer) {
      throw new Error('[dom-swarm] OverlayManager is not mounted.');
    }

    const box = document.createElement('div');
    box.className = `swarm-bounding-box box-${type}`;
    box.id = `swarm-box-${id}`;

    const geo = initialGeometry || {
      left: rect.left,
      top: rect.top,
      width: Math.max(4, rect.width),
      height: Math.max(4, rect.height),
      opacity: 1,
    };

    box.style.transform = `translate3d(${geo.left}px, ${geo.top}px, 0)`;
    box.style.width = `${Math.max(0, geo.width)}px`;
    box.style.height = `${Math.max(0, geo.height)}px`;
    box.style.opacity = (geo.opacity ?? 1).toString();

    if (type === 'blue') {
      const corners = ['tl', 'tr', 'bl', 'br'];
      corners.forEach((c) => {
        const handle = document.createElement('div');
        handle.className = `swarm-corner-handle handle-${c}`;
        box.appendChild(handle);
      });

      if (showDimensions) {
        const badge = document.createElement('div');
        badge.className = 'swarm-dimension-badge';
        badge.textContent = `${Math.round(geo.width)} × ${Math.round(geo.height)}`;
        box.appendChild(badge);
      }
    } else {
      if (showGuides && this.guidesLayer) {
        this.createAlignmentGuides(id, rect);
      }

      if (showDimensions) {
        const badge = document.createElement('div');
        badge.className = 'swarm-distance-badge';
        const distVal = Math.round(Math.min(rect.left, rect.top));
        badge.textContent = `${distVal}px`;
        box.appendChild(badge);
      }
    }

    this.overlaysLayer.appendChild(box);
    return box;
  }

  /**
   * Creates a ghost wireframe clone for Figma-style copy/paste duplicate animations.
   */
  public createGhostClone(id: string, rect: DOMRect): HTMLElement {
    if (!this.overlaysLayer) {
      throw new Error('[dom-swarm] OverlayManager is not mounted.');
    }

    const clone = document.createElement('div');
    clone.className = 'swarm-ghost-clone';
    clone.id = `swarm-clone-${id}`;
    clone.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    clone.style.width = `${Math.max(4, rect.width)}px`;
    clone.style.height = `${Math.max(4, rect.height)}px`;

    const badge = document.createElement('div');
    badge.className = 'swarm-clone-badge';
    badge.textContent = 'Duplicate ⌥Drag';
    clone.appendChild(badge);

    const corners = ['tl', 'tr', 'bl', 'br'];
    corners.forEach((c) => {
      const handle = document.createElement('div');
      handle.className = `swarm-corner-handle handle-${c}`;
      clone.appendChild(handle);
    });

    this.overlaysLayer.appendChild(clone);
    return clone;
  }

  /**
   * Updates coordinates of the ghost clone as it glides from source to destination.
   */
  public updateGhostClone(
    cloneEl: HTMLElement,
    x: number,
    y: number,
    width: number,
    height: number,
    opacity = 1
  ): void {
    cloneEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    cloneEl.style.width = `${Math.max(4, width)}px`;
    cloneEl.style.height = `${Math.max(4, height)}px`;
    cloneEl.style.opacity = opacity.toString();
  }

  /**
   * Removes a ghost clone element.
   */
  public removeGhostClone(cloneEl: HTMLElement): void {
    if (cloneEl.parentNode) {
      cloneEl.parentNode.removeChild(cloneEl);
    }
  }

  /**
   * Smoothly updates bounding box geometry as the swarm cursors drag/expand it.
   */
  public updateBoxGeometry(
    boxEl: HTMLElement,
    rect: { left: number; top: number; width: number; height: number },
    opacity = 1,
    id?: string
  ): void {
    boxEl.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    boxEl.style.width = `${Math.max(0, rect.width)}px`;
    boxEl.style.height = `${Math.max(0, rect.height)}px`;
    boxEl.style.opacity = opacity.toString();

    const dimBadge = boxEl.querySelector('.swarm-dimension-badge');
    if (dimBadge) {
      dimBadge.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    }

    if (id && this.guidesLayer) {
      const guidesGroup = this.shadowRoot?.getElementById(`swarm-guides-${id}`);
      if (guidesGroup) {
        const guidesH = guidesGroup.querySelectorAll<HTMLElement>('.swarm-guide-h');
        if (guidesH[0]) guidesH[0].style.top = `${rect.top}px`;
        if (guidesH[1]) guidesH[1].style.top = `${rect.top + rect.height}px`;

        const guidesV = guidesGroup.querySelectorAll<HTMLElement>('.swarm-guide-v');
        if (guidesV[0]) guidesV[0].style.left = `${rect.left}px`;
        if (guidesV[1]) guidesV[1].style.left = `${rect.left + rect.width}px`;
      }
    }
  }

  /**
   * Creates full-screen red alignment guide lines.
   */
  private createAlignmentGuides(id: string, rect: DOMRect): void {
    if (!this.guidesLayer) return;

    const guidesContainer = document.createElement('div');
    guidesContainer.className = 'swarm-guides-group';
    guidesContainer.id = `swarm-guides-${id}`;

    // Horizontal top guide
    const hTop = document.createElement('div');
    hTop.className = 'swarm-guide swarm-guide-h';
    hTop.style.top = `${rect.top}px`;

    // Horizontal bottom guide
    const hBottom = document.createElement('div');
    hBottom.className = 'swarm-guide swarm-guide-h';
    hBottom.style.top = `${rect.bottom}px`;

    // Vertical left guide
    const vLeft = document.createElement('div');
    vLeft.className = 'swarm-guide swarm-guide-v';
    vLeft.style.left = `${rect.left}px`;

    // Vertical right guide
    const vRight = document.createElement('div');
    vRight.className = 'swarm-guide swarm-guide-v';
    vRight.style.left = `${rect.right}px`;

    guidesContainer.appendChild(hTop);
    guidesContainer.appendChild(hBottom);
    guidesContainer.appendChild(vLeft);
    guidesContainer.appendChild(vRight);

    this.guidesLayer.appendChild(guidesContainer);
  }

  /**
   * Updates coordinates of an existing bounding box and its alignment guides during scrolling/resizing.
   */
  public updateBoundingBox(boxEl: HTMLElement, rect: DOMRect, id?: string): void {
    boxEl.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    boxEl.style.width = `${Math.max(4, rect.width)}px`;
    boxEl.style.height = `${Math.max(4, rect.height)}px`;

    const dimBadge = boxEl.querySelector('.swarm-dimension-badge');
    if (dimBadge) {
      dimBadge.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    }

    if (id && this.guidesLayer) {
      const guidesGroup = this.shadowRoot?.getElementById(`swarm-guides-${id}`);
      if (guidesGroup) {
        const guidesH = guidesGroup.querySelectorAll<HTMLElement>('.swarm-guide-h');
        if (guidesH[0]) guidesH[0].style.top = `${rect.top}px`;
        if (guidesH[1]) guidesH[1].style.top = `${rect.bottom}px`;

        const guidesV = guidesGroup.querySelectorAll<HTMLElement>('.swarm-guide-v');
        if (guidesV[0]) guidesV[0].style.left = `${rect.left}px`;
        if (guidesV[1]) guidesV[1].style.left = `${rect.right}px`;
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
   * Standard Pointer SVG icon string.
   */
  private getPointerSvg(color: string): string {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2L10 21L13.5 13.5L21 10L3 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Pencil / Pen tool SVG for text drafting and editing.
   * Sharp tip aligned at (2, 2) matching cursor transform-origin.
   */
  private getPenSvg(color: string): string {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2L3.5 9L9 3.5L2 2Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M3.5 9L9 3.5L17.5 12L12 17.5L3.5 9Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M12 17.5L17.5 12L20 14.5C21 15.5 21 17 20 18L18 20C17 21 15.5 21 14.5 20L12 17.5Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M6.5 6.5L15 15" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="2" cy="2" r="1.2" fill="#111827"/>
    </svg>`;
  }

  /**
   * Figma Frame / Container tool SVG with "#" layout badge.
   */
  private getFrameSvg(color: string): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2L8.5 19L11.5 12.5L18 9.5L2 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M14 12V21M18 12V21M11 15H21M11 18.5H21" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M14 12V21M18 12V21M11 15H21M11 18.5H21" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Media / Image tool SVG with landscape photo placement badge.
   */
  private getMediaSvg(color: string): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2L8.5 19L11.5 12.5L18 9.5L2 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="12" y="12" width="10" height="9" rx="1.5" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="15" cy="15" r="1.2" fill="#FBBF24"/>
      <path d="M13 19L16 15.5L18 17.5L20 15L21 16.5V19H13Z" fill="${color}"/>
    </svg>`;
  }

  /**
   * Button / Interactive tool SVG with rounded button pill badge.
   */
  private getButtonSvg(color: string): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2L8.5 19L11.5 12.5L18 9.5L2 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="11.5" y="12.5" width="10.5" height="7.5" rx="3.75" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>
      <path d="M15 14.5L18.5 16.25L15 18V14.5Z" fill="#FFFFFF"/>
    </svg>`;
  }

  /**
   * Code / Terminal tool SVG with code brackets badge.
   */
  private getCodeSvg(color: string): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2L8.5 19L11.5 12.5L18 9.5L2 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="11" y="12" width="12" height="9" rx="2" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.5"/>
      <path d="M14 15L12.5 16.5L14 18M18 15L19.5 16.5L18 18" stroke="#38BDF8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * I-Beam text insertion SVG icon string.
   */
  private getIBeamSvg(color: string): string {
    return `<svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 3H16M10 3V21M4 21H16" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
      <path d="M4 3H16M10 3V21M4 21H16" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Hand dragging tool SVG for copy-pasting elements.
   * Classic Figma / OS open dragging hand anchored at top fingertip.
   */
  private getHandSvg(color: string): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3V11M8 11L6 9C5.2 8.2 3.8 8.2 3 9C2.2 9.8 2.2 11.2 3 12L8 17C9.3 18.3 11.1 19 13 19H16C18.8 19 21 16.8 21 14V10C21 8.9 20.1 8 19 8C18.7 8 18.4 8.1 18.2 8.2C17.9 7.2 17 6.5 16 6.5C15.6 6.5 15.3 6.6 15 6.8C14.6 6 13.8 5.5 13 5.5C12.6 5.5 12.3 5.6 12 5.8V3C12 1.9 11.1 1 10 1C8.9 1 8 1.9 8 3V11" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Spawns a glowing expanding ripple when a cursor converges and vanishes into the user pointer.
   */
  public createVanishRipple(x: number, y: number, color: string): void {
    if (!this.overlaysLayer) return;

    const ripple = document.createElement('div');
    ripple.className = 'swarm-vanish-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.border = `2px solid ${color}`;
    ripple.style.boxShadow = `0 0 12px ${color}`;

    this.overlaysLayer.appendChild(ripple);

    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 600);
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
      .swarm-agents-layer,
      .swarm-overlays-layer,
      .swarm-guides-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .swarm-agent {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform;
        transform-origin: 3px 2px;
        filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.28));
        transition: opacity 0.2s ease;
      }
      .swarm-agent-icon {
        display: inline-block;
        pointer-events: none;
        transform-origin: 0 0;
        transition: transform 0.15s ease;
      }
      .swarm-agent-icon.is-pen {
        animation: swarm-pen-draw 0.35s infinite alternate ease-in-out;
      }
      @keyframes swarm-pen-draw {
        0% { transform: translate(0, 0); }
        100% { transform: translate(1.5px, -1.5px); }
      }
      .swarm-agent-icon.is-ibeam {
        animation: swarm-ibeam-pulse 0.7s infinite alternate ease-in-out;
      }
      @keyframes swarm-ibeam-pulse {
        0% { opacity: 0.6; transform: scale(0.95); }
        100% { opacity: 1; transform: scale(1.05); }
      }
      .swarm-agent-icon.is-button {
        animation: swarm-button-press 0.45s infinite alternate ease-in-out;
      }
      @keyframes swarm-button-press {
        0% { transform: scale(1); }
        100% { transform: scale(0.92); }
      }
      .swarm-agent-icon.is-hand,
      .swarm-agent-icon.is-duplicate {
        animation: swarm-dup-float 0.45s infinite alternate ease-in-out;
      }
      @keyframes swarm-dup-float {
        0% { transform: translateY(0); }
        100% { transform: translateY(-1.5px); }
      }
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
        border: 1.5px solid #0d99ff;
        background: rgba(13, 153, 255, 0.08);
        box-shadow: 0 0 0 1px rgba(13, 153, 255, 0.2);
      }
      .box-red {
        border: 1.5px solid #f24822;
        background: rgba(242, 72, 34, 0.07);
        box-shadow: 0 0 0 1px rgba(242, 72, 34, 0.2);
      }
      .swarm-ghost-clone {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform;
        box-sizing: border-box;
        border: 1.5px dashed #0d99ff;
        background: rgba(13, 153, 255, 0.12);
        box-shadow: 0 4px 14px rgba(13, 153, 255, 0.22);
        border-radius: 2px;
      }
      .swarm-clone-badge {
        position: absolute;
        top: -22px;
        left: 0;
        background: #0d99ff;
        color: #ffffff;
        font-size: 9px;
        font-weight: 700;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
        letter-spacing: 0.3px;
      }
      .swarm-corner-handle {
        position: absolute;
        width: 6px;
        height: 6px;
        background: #ffffff;
        border: 1.5px solid #0d99ff;
        border-radius: 1px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      }
      .handle-tl { top: -4px; left: -4px; }
      .handle-tr { top: -4px; right: -4px; }
      .handle-bl { bottom: -4px; left: -4px; }
      .handle-br { bottom: -4px; right: -4px; }

      .swarm-dimension-badge {
        position: absolute;
        left: 50%;
        bottom: -22px;
        transform: translateX(-50%);
        background: #0d99ff;
        color: #ffffff;
        font-size: 10px;
        font-weight: 600;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        letter-spacing: 0.2px;
      }
      .swarm-distance-badge {
        position: absolute;
        top: -18px;
        left: 4px;
        background: #f24822;
        color: #ffffff;
        font-size: 9px;
        font-weight: 700;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 1px 5px;
        border-radius: 3px;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .swarm-vanish-ripple {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
        animation: swarm-ripple 0.55s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
      }
      @keyframes swarm-ripple {
        0% {
          width: 6px;
          height: 6px;
          opacity: 0.9;
          transform: translate(-50%, -50%) scale(0.6);
        }
        100% {
          width: 70px;
          height: 70px;
          opacity: 0;
          transform: translate(-50%, -50%) scale(1.4);
        }
      }
      .swarm-guide {
        position: absolute;
        pointer-events: none;
      }
      .swarm-guide-h {
        left: 0;
        right: 0;
        width: 100vw;
        height: 1px;
        background: rgba(242, 72, 34, 0.45);
        border-top: 1px dashed rgba(242, 72, 34, 0.6);
      }
      .swarm-guide-v {
        top: 0;
        bottom: 0;
        height: 100vh;
        width: 1px;
        background: rgba(242, 72, 34, 0.45);
        border-left: 1px dashed rgba(242, 72, 34, 0.6);
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
    this.mounted = false;
  }
}

