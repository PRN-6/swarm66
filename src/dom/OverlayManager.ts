import { AgentType, CursorShape, OverlayItem } from '../types';

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

const OP_HOTSPOTS: Record<CursorShape, [number, number]> = {
  arrow: [5, 3.5],
  dup: [5, 3.5],
  pen: [3, 3],
  'pen-add': [3, 3],
  'pen-close': [3, 3],
  cross: [12, 12],
  ibeam: [12, 12],
  ew: [12, 12],
  ns: [12, 12],
};

const PI_ARROW =
  'M4.6 3.9 C4.2 3.1 4.9 2.4 5.7 2.8 L20.6 9.4 C21.5 9.8 21.4 11.1 20.4 11.3 L13.9 12.9 C13.4 13 13 13.4 12.9 13.9 L11.3 20.4 C11.1 21.4 9.8 21.5 9.4 20.6 Z';

/**
 * Manages the open Shadow DOM overlay container, Figma rulers,
 * full-screen red & cyan alignment guide lines, SVG cursors, and selection bounding boxes.
 */
export class OverlayManager {
  private hostElement: HTMLElement | null = null;
  private agentsLayer: HTMLElement | null = null;
  private svgLayer: SVGSVGElement | null = null;
  private badgesLayer: HTMLElement | null = null;
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

    // 3. Dynamic SVG overlays layer
    const overlays = document.createElement('div');
    overlays.className = 'swarm-overlays-layer';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'swarm-svg-canvas');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.overflow = 'visible';
    overlays.appendChild(svg);

    const badges = document.createElement('div');
    badges.className = 'swarm-badges-layer';
    overlays.appendChild(badges);

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
    this.svgLayer = svg;
    this.badgesLayer = badges;
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
    for (let x = -100; x <= 2500; x += 100) {
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
    for (let y = 0; y <= 3500; y += 100) {
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
   * Slides rulers smoothly between hidden (0) and fully visible (1).
   */
  public setRulersProgress(progress: number): void {
    if (!this.rulersContainer) return;
    const top = this.rulersContainer.querySelector<HTMLElement>('.swarm-ruler-top');
    const left = this.rulersContainer.querySelector<HTMLElement>('.swarm-ruler-left');
    const corner = this.rulersContainer.querySelector<HTMLElement>('.swarm-ruler-corner');

    if (top) top.style.transform = `translateY(${(progress - 1) * 100}%)`;
    if (left) left.style.transform = `translateX(${(progress - 1) * 100}%)`;
    if (corner) corner.style.opacity = progress.toFixed(3);
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
    iconContainer.innerHTML = this.getCursorSvg('arrow', color);

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
   * Updates hardware-accelerated transform of an agent cursor with exact hot-spot pivot,
   * heading rotation, and click press compression.
   */
  public updateAgentTransform(
    el: HTMLElement,
    x: number,
    y: number,
    angleDeg: number,
    scale = 1,
    shape: CursorShape = 'arrow',
    press = 0
  ): void {
    const [hotspotX, hotspotY] = OP_HOTSPOTS[shape] || [5, 3.5];
    const pressScale = 1 - Math.min(Math.max(press, 0), 1) * 0.12;
    const finalScale = scale * pressScale;

    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

    const svg = el.querySelector<SVGSVGElement>('svg');
    if (svg) {
      svg.style.transform = `translate(${-hotspotX}px, ${-hotspotY}px) rotate(${angleDeg.toFixed(1)}deg) scale(${finalScale.toFixed(3)})`;
      svg.style.transformOrigin = `${hotspotX}px ${hotspotY}px`;
    }
  }

  /**
   * Sets cursor shape using Figma SVG definitions.
   */
  public setCursorShape(iconContainer: HTMLElement, shape: CursorShape, color: string): void {
    iconContainer.innerHTML = this.getCursorSvg(shape, color);
    if (shape === 'ibeam') {
      iconContainer.classList.add('is-ibeam');
    } else {
      iconContainer.classList.remove('is-ibeam');
    }
  }

  /**
   * Compatibility alias for setAgentType.
   */
  public setAgentType(iconContainer: HTMLElement, type: AgentType, color: string): void {
    const shape: CursorShape = type === 'ibeam' ? 'ibeam' : type === 'crosshair' ? 'cross' : 'arrow';
    this.setCursorShape(iconContainer, shape, color);
  }

  public setAgentIcon(iconContainer: HTMLElement, type: AgentType, color: string): void {
    this.setAgentType(iconContainer, type, color);
  }

  /**
   * Generates exact Figma SVG for all cursor tools.
   */
  public getCursorSvg(shape: CursorShape, color: string): string {
    const common = 'stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"';
    let content = '';

    switch (shape) {
      case 'arrow':
        content = `<path d="${PI_ARROW}" fill="${color}" ${common}/>`;
        break;
      case 'dup':
        content = `
          <path d="${PI_ARROW}" transform="translate(4 3.5)" fill="#ffffff" stroke="${color}" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="${PI_ARROW}" fill="${color}" ${common}/>
        `;
        break;
      case 'pen':
      case 'pen-add':
      case 'pen-close': {
        let badge = '';
        if (shape === 'pen-add') {
          badge = `
            <g stroke-linecap="round">
              <path d="M23 19.5 V26.5 M19.5 23 H26.5" stroke="#ffffff" stroke-width="3.4"/>
              <path d="M23 19.5 V26.5 M19.5 23 H26.5" stroke="#1E1E1E" stroke-width="1.3"/>
            </g>
          `;
        } else if (shape === 'pen-close') {
          badge = `
            <circle cx="23" cy="23" r="2.8" fill="none" stroke="#ffffff" stroke-width="3.2"/>
            <circle cx="23" cy="23" r="2.8" fill="none" stroke="#1E1E1E" stroke-width="1.2"/>
          `;
        }
        content = `
          <path d="M17.4 10.6 L20.6 13.8 L13.8 20.6 L10.6 17.4 Z" fill="${color}" ${common}/>
          <path d="M3 3 L13.1 6.3 L17.4 10.6 L10.6 17.4 L6.3 13.1 Z" fill="${color}" ${common}/>
          <path d="M3.6 3.6 L8.9 8.9" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
          <circle cx="10.2" cy="10.2" r="1.75" fill="none" stroke="#ffffff" stroke-width="1.2"/>
          ${badge}
        `;
        break;
      }
      case 'cross':
        content = `
          <g stroke-linecap="round">
            <path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke="#ffffff" stroke-width="3.6"/>
            <path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke="${color}" stroke-width="1.5"/>
          </g>
        `;
        break;
      case 'ibeam': {
        const d =
          'M8.5 4.5 H10.5 Q12 4.5 12 6 Q12 4.5 13.5 4.5 H15.5 M12 6 V18 M8.5 19.5 H10.5 Q12 19.5 12 18 Q12 19.5 13.5 19.5 H15.5';
        content = `
          <g fill="none" stroke-linecap="round">
            <path d="${d}" stroke="#ffffff" stroke-width="3.6"/>
            <path d="${d}" stroke="${color}" stroke-width="1.5"/>
          </g>
        `;
        break;
      }
      case 'ew':
      case 'ns':
        content = `<path d="M2.5 12 L7 7.5 V10.4 H17 V7.5 L21.5 12 L17 16.5 V13.6 H7 V16.5 Z" ${
          shape === 'ns' ? 'transform="rotate(90 12 12)"' : ''
        } fill="${color}" ${common}/>`;
        break;
    }

    return `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" class="swarm-cursor-svg" style="overflow: visible; filter: drop-shadow(0 1px 1.5px rgba(0,0,0,0.28));">${content}</svg>`;
  }

  /**
   * Renders dynamic overlays (selection boxes, handles, badges, guidelines, ruler lines, measurement lines).
   */
  public renderDynamicOverlays(items: OverlayItem[], rulerT = 0): void {
    if (!this.svgLayer || !this.badgesLayer) return;

    let svgHtml = '';
    let badgesHtml = '';

    for (const item of items) {
      if (item.t === 'box') {
        const strokeColor = item.color === 'red' ? '#F24822' : '#0D99FF';
        const b = item.b;

        // Bounding Box
        svgHtml += `<rect x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" fill="none" stroke="${strokeColor}" stroke-width="1.5"/>`;

        // Underline
        if (item.underline && item.underline.width > 0) {
          const u = item.underline;
          svgHtml += `<line x1="${u.left}" x2="${u.left + u.width}" y1="${u.top}" y2="${u.top}" stroke="${strokeColor}" stroke-width="1.5"/>`;
        }

        // Projection lines to top/left rulers
        if (item.rulerLines && rulerT > 0.05) {
          svgHtml += `
            <g stroke="${strokeColor}" stroke-width="1" stroke-dasharray="2 2" opacity="${rulerT}">
              <line x1="20" x2="${b.left}" y1="${b.top + b.height / 2}" y2="${b.top + b.height / 2}"/>
              <line x1="${b.left + b.width / 2}" x2="${b.left + b.width / 2}" y1="20" y2="${b.top}"/>
            </g>
          `;
        }

        // 4 white corner handles (7px × 7px)
        if (item.handles && b.width > 12 && b.height > 12) {
          const corners = [
            [b.left, b.top],
            [b.left + b.width, b.top],
            [b.left, b.top + b.height],
            [b.left + b.width, b.top + b.height],
          ];
          for (const corner of corners) {
            if (!corner) continue;
            const [cx, cy] = corner;
            if (cx !== undefined && cy !== undefined) {
              svgHtml += `<rect x="${cx - 3.5}" y="${cy - 3.5}" width="7" height="7" fill="#ffffff" stroke="${strokeColor}" stroke-width="1"/>`;
            }
          }
        }

        // Dimension badge
        if (item.badge && b.width > 0) {
          badgesHtml += `
            <div class="swarm-dimension-badge" style="left: ${b.left + b.width / 2}px; top: ${
            b.top + b.height + 8
          }px; background: ${strokeColor};">
              ${item.badge}
            </div>
          `;
        }
      } else if (item.t === 'measure') {
        const { a, b, label } = item;
        svgHtml += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#F24822" stroke-width="1.2"/>`;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        badgesHtml += `
          <div class="swarm-dimension-badge" style="left: ${midX}px; top: ${midY - 9}px; background: #F24822;">
            ${label}
          </div>
        `;
      } else if (item.t === 'guide') {
        const strokeW = 1 + (item.flash || 0);
        const filter = item.flash ? `drop-shadow(0 0 ${2 + item.flash * 3}px #F24822)` : '';
        const op = item.opacity !== undefined ? item.opacity : 1;

        if (item.axis === 'x') {
          svgHtml += `<line x1="${item.pos}" x2="${item.pos}" y1="0" y2="10000" stroke="#F24822" stroke-width="${strokeW}" opacity="${op}" style="filter: ${filter};"/>`;
        } else {
          svgHtml += `<line x1="0" x2="10000" y1="${item.pos}" y2="${item.pos}" stroke="#F24822" stroke-width="${strokeW}" opacity="${op}" style="filter: ${filter};"/>`;
        }
      } else if (item.t === 'path') {
        const pts = item.points;
        if (pts.length > 0) {
          const allPts = item.cursorPos ? [...pts, item.cursorPos] : pts;
          const p0 = pts[0];
          const closedStr = item.closed && p0 ? ` ${p0.x},${p0.y}` : '';
          const pointsStr = allPts.map((p) => `${p.x},${p.y}`).join(' ') + closedStr;
          svgHtml += `<polyline points="${pointsStr}" fill="none" stroke="#0D99FF" stroke-width="1.5"/>`;

          for (const p of pts) {
            svgHtml += `<circle cx="${p.x}" cy="${p.y}" r="3.6" fill="#ffffff" stroke="#0D99FF" stroke-width="1.5"/>`;
          }
        }
      }
    }

    this.svgLayer.innerHTML = svgHtml;
    this.badgesLayer.innerHTML = badgesHtml;
  }

  /**
   * Clears dynamic SVG and HTML badge layers.
   */
  public clearDynamicOverlays(): void {
    if (this.svgLayer) this.svgLayer.innerHTML = '';
    if (this.badgesLayer) this.badgesLayer.innerHTML = '';
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

      /* Layers */
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
      .swarm-badges-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .swarm-agents-layer {
        position: absolute;
        inset: 0;
        z-index: 30;
        pointer-events: none;
      }

      /* Cursors */
      .swarm-agent {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform;
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

      /* Dimension & Measurement Badges */
      .swarm-dimension-badge {
        position: absolute;
        transform: translateX(-50%);
        color: #ffffff;
        font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        font-size: 11px;
        line-height: 16px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        padding: 1px 4px;
        border-radius: 2px;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
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
    this.agentsLayer = null;
    this.svgLayer = null;
    this.badgesLayer = null;
    this.rulersContainer = null;
    this.topRulerSegmentsEl = null;
    this.leftRulerSegmentsEl = null;
    this.mounted = false;
  }
}
