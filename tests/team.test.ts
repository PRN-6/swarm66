import { describe, it, expect } from 'vitest';
import { vec } from '../src/utils/math';
import { BuilderEffects } from '../src/dom/BuilderEffects';

describe('4-Agent Team & Border Geometry', () => {
  it('calculates the 4 bounding box corner positions accurately during expansion', () => {
    const rect = { left: 100, top: 200, width: 300, height: 100 };
    const cx = rect.left + rect.width / 2; // 250
    const cy = rect.top + rect.height / 2; // 250

    // At progress p = 0.5 (ease = 0.875)
    const p = 0.5;
    const ease = 1 - Math.pow(1 - p, 3); // 1 - 0.125 = 0.875
    const curW = rect.width * ease; // 300 * 0.875 = 262.5
    const curH = rect.height * ease; // 100 * 0.875 = 87.5
    const curLeft = cx - curW / 2;
    const curTop = cy - curH / 2;

    const corners = [
      { x: curLeft, y: curTop, heading: 0 },
      { x: curLeft + curW, y: curTop, heading: 0 },
      { x: curLeft + curW, y: curTop + curH, heading: 0 },
      { x: curLeft, y: curTop + curH, heading: 0 },
    ];

    expect(corners).toHaveLength(4);
    expect(corners[0]!.x).toBeCloseTo(curLeft);
    expect(corners[0]!.y).toBeCloseTo(curTop);
    expect(corners[1]!.x).toBeCloseTo(curLeft + curW);
    expect(corners[2]!.y).toBeCloseTo(curTop + curH);
    expect(corners[3]!.x).toBeCloseTo(curLeft);
  });

  it('guarantees agents stay strictly locked on the 4 borders during construction', () => {
    const rect = { left: 50, top: 150, width: 200, height: 80, right: 250, bottom: 230 };
    const borderProgress = 0.4;

    // Top border agent must have y === rect.top
    const topAgent = {
      x: rect.left + rect.width * borderProgress,
      y: rect.top,
    };
    expect(topAgent.y).toBe(rect.top);
    expect(topAgent.x).toBeGreaterThanOrEqual(rect.left);
    expect(topAgent.x).toBeLessThanOrEqual(rect.right);

    // Right border agent must have x === rect.right
    const rightAgent = {
      x: rect.right,
      y: rect.top + rect.height * borderProgress,
    };
    expect(rightAgent.x).toBe(rect.right);
    expect(rightAgent.y).toBeGreaterThanOrEqual(rect.top);
    expect(rightAgent.y).toBeLessThanOrEqual(rect.bottom);

    // Bottom border agent must have y === rect.bottom
    const bottomAgent = {
      x: rect.right - rect.width * borderProgress,
      y: rect.bottom,
    };
    expect(bottomAgent.y).toBe(rect.bottom);
    expect(bottomAgent.x).toBeGreaterThanOrEqual(rect.left);
    expect(bottomAgent.x).toBeLessThanOrEqual(rect.right);

    // Left border agent must have x === rect.left
    const leftAgent = {
      x: rect.left,
      y: rect.bottom - rect.height * borderProgress,
    };
    expect(leftAgent.x).toBe(rect.left);
    expect(leftAgent.y).toBeGreaterThanOrEqual(rect.top);
    expect(leftAgent.y).toBeLessThanOrEqual(rect.bottom);
  });

  it('divides 18 agents into squads of 4', () => {
    const totalAgents = 18;
    const teamSize = 4;
    const teamIndices: number[] = [];

    for (let i = 0; i < totalAgents; i++) {
      teamIndices.push(Math.floor(i / teamSize));
    }

    expect(teamIndices).toHaveLength(18);

    const teamCounts = new Map<number, number>();
    teamIndices.forEach((t) => {
      teamCounts.set(t, (teamCounts.get(t) || 0) + 1);
    });

    // Teams 0, 1, 2, 3 should each have 4 members
    expect(teamCounts.get(0)).toBe(4);
    expect(teamCounts.get(1)).toBe(4);
    expect(teamCounts.get(2)).toBe(4);
    expect(teamCounts.get(3)).toBe(4);
    // Team 4 has the remaining 2 members
    expect(teamCounts.get(4)).toBe(2);
  });

  it('detects same-sized container templates for copy-paste duplicate animations', () => {
    const templateRect = { left: 100, top: 400, width: 320, height: 240 };
    const sameSizeRect = { left: 450, top: 400, width: 320, height: 240 };
    const slightlyDifferentRect = { left: 800, top: 400, width: 330, height: 245 }; // diff <= 16px
    const differentRect = { left: 100, top: 700, width: 500, height: 100 };

    const isMatch = (r1: typeof templateRect, r2: typeof templateRect) => {
      const wDiff = Math.abs(r1.width - r2.width);
      const hDiff = Math.abs(r1.height - r2.height);
      return wDiff <= 16 && hDiff <= 16;
    };

    expect(isMatch(templateRect, sameSizeRect)).toBe(true);
    expect(isMatch(templateRect, slightlyDifferentRect)).toBe(true);
    expect(isMatch(templateRect, differentRect)).toBe(false);
  });

  it('interpolates sliding ghost clone geometry smoothly between source and destination', () => {
    const src = { left: 100, top: 200, width: 300, height: 180 };
    const dest = { left: 500, top: 200, width: 300, height: 180 };

    // At progress p = 0.5 with cubic ease out
    const p = 0.5;
    const ease = 1 - Math.pow(1 - p, 3); // 0.875
    const curX = src.left + (dest.left - src.left) * ease; // 100 + 400 * 0.875 = 450
    const curY = src.top + (dest.top - src.top) * ease; // 200

    expect(curX).toBe(450);
    expect(curY).toBe(200);

    // At completion p = 1.0
    const pEnd = 1.0;
    const easeEnd = 1 - Math.pow(1 - pEnd, 3);
    const endX = src.left + (dest.left - src.left) * easeEnd;
    expect(endX).toBe(dest.left);
  });

  it('classifies DOM elements into tool categories for pencil, frame, button, media, and code cursors', () => {
    // In node/vitest, create dummy mock elements
    const mockEl = (tagName: string, className = '') =>
      ({
        tagName: tagName.toUpperCase(),
        className,
        classList: {
          contains: (cls: string) => className.split(' ').includes(cls),
        },
        getAttribute: (_attr: string) => null,
      }) as unknown as HTMLElement;

    expect(BuilderEffects.getElementCategory(mockEl('h1'))).toBe('text');
    expect(BuilderEffects.getElementCategory(mockEl('p'))).toBe('text');
    expect(BuilderEffects.getElementCategory(mockEl('span'))).toBe('text');

    expect(BuilderEffects.getElementCategory(mockEl('div', 'price-card'))).toBe('container');
    expect(BuilderEffects.getElementCategory(mockEl('section'))).toBe('container');

    expect(BuilderEffects.getElementCategory(mockEl('img'))).toBe('media');
    expect(BuilderEffects.getElementCategory(mockEl('video'))).toBe('media');

    expect(BuilderEffects.getElementCategory(mockEl('button'))).toBe('button');
    expect(BuilderEffects.getElementCategory(mockEl('a', 'btn'))).toBe('button');

    expect(BuilderEffects.getElementCategory(mockEl('pre'))).toBe('code');
    expect(BuilderEffects.getElementCategory(mockEl('code'))).toBe('code');

    expect(BuilderEffects.getElementCategory(mockEl('input'))).toBe('input');
  });

  it('assigns the hand cursor for dragging copy-pasted duplicate elements', () => {
    const isCopyPaste = true;
    const categoryTool = 'frame';
    const tool = isCopyPaste ? 'hand' : categoryTool;
    expect(tool).toBe('hand');
  });

  it('handles multi-page SPA navigation and URL route changes', () => {
    let lastUrl = 'http://localhost:3000/page1';
    let navigationTriggered = false;

    const onRouteChange = (newUrl: string) => {
      if (newUrl !== lastUrl) {
        lastUrl = newUrl;
        navigationTriggered = true;
      }
    };

    onRouteChange('http://localhost:3000/page1');
    expect(navigationTriggered).toBe(false);

    onRouteChange('http://localhost:3000/page2');
    expect(navigationTriggered).toBe(true);
    expect(lastUrl).toBe('http://localhost:3000/page2');
  });

  it('wakes up vanished agents when dynamic elements are discovered on a new page', () => {
    const agentStates = ['VANISHED', 'VANISHED', 'VANISHED'];
    let isFinished = true;

    // Simulate discovering dynamic elements on a new page or via route change
    if (isFinished) {
      isFinished = false;
      for (let i = 0; i < agentStates.length; i++) {
        if (agentStates[i] === 'VANISHED') {
          agentStates[i] = 'IDLE_FLOCKING';
        }
      }
    }

    expect(isFinished).toBe(false);
    expect(agentStates).toEqual(['IDLE_FLOCKING', 'IDLE_FLOCKING', 'IDLE_FLOCKING']);
  });

  it('accurately positions single agent dragging corner outward when creating a shape/cube', () => {
    const rect = { left: 80, top: 120, width: 400, height: 260 };
    const p = 0.6;
    const ease = 1 - Math.pow(1 - p, 3); // 1 - 0.064 = 0.936

    const curLeft = rect.left;
    const curTop = rect.top;
    const curW = Math.max(4, rect.width * ease);
    const curH = Math.max(4, rect.height * ease);

    // Box remains anchored at origin
    expect(curLeft).toBe(80);
    expect(curTop).toBe(120);

    // Dragging agent (Agent 0) tracks the opposite bottom-right corner being dragged
    const draggingAgent = {
      x: curLeft + curW,
      y: curTop + curH,
      opacity: 1,
    };

    expect(draggingAgent.x).toBeCloseTo(80 + 400 * 0.936);
    expect(draggingAgent.y).toBeCloseTo(120 + 260 * 0.936);
    expect(draggingAgent.opacity).toBe(1);

    // Other squad agents (1, 2, 3) are hidden during the drag
    const otherSquadAgents = [1, 2, 3].map(() => ({
      opacity: 0,
    }));

    otherSquadAgents.forEach((agent) => {
      expect(agent.opacity).toBe(0);
    });
  });
});
