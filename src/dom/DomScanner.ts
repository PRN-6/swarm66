import { BuilderEffects } from './BuilderEffects';
import { BuildOrder, ConstructionTask, TaskType } from '../types';

export interface DomScannerOptions {
  selector: string;
  ignoreSelector: string;
  hideOnStart: boolean;
  buildOrder: BuildOrder;
  builderEffects: BuilderEffects;
  onElementDiscovered?: (element: HTMLElement) => void;
}

/**
 * Scans, indexes, and prepares host DOM elements for live swarm construction,
 * filtering out nested redundant children and sorting elements top-to-bottom.
 */
export class DomScanner {
  private intersectionObserver: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private indexedElements: HTMLElement[] = [];
  private observedElements = new WeakSet<HTMLElement>();
  private mutationTimeout: any = null;

  constructor(private options: DomScannerOptions) {}

  /**
   * Initializes DOM scanning, initial element hiding, and observers.
   */
  public init(): HTMLElement[] {
    if (typeof window === 'undefined' || typeof document === 'undefined') return [];

    this.scanAndIndex();
    this.setupIntersectionObserver();
    this.setupMutationObserver();

    return this.indexedElements;
  }

  /**
   * Scans document for eligible elements, applies initial blank state if enabled,
   * and returns elements sorted by buildOrder.
   */
  public scanAndIndex(): HTMLElement[] {
    if (typeof document === 'undefined') return [];

    try {
      const allCandidates = Array.from(
        document.querySelectorAll<HTMLElement>(this.options.selector)
      );

      const validElements: HTMLElement[] = [];

      for (let i = 0; i < allCandidates.length; i++) {
        const el = allCandidates[i];
        if (!el || this.shouldIgnoreElement(el)) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) continue;

        // Prevent targeting child elements when their parent card/container is already targeted
        const isNestedUnderTarget = allCandidates.some(
          (parent) => parent !== el && parent.contains(el) && this.isBlockContainer(parent)
        );
        if (isNestedUnderTarget) continue;

        validElements.push(el);
      }

      // Sort by build order (default: top-to-bottom in document)
      if (this.options.buildOrder === 'top-to-bottom') {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        validElements.sort((a, b) => {
          const topA = a.getBoundingClientRect().top + scrollY;
          const topB = b.getBoundingClientRect().top + scrollY;
          if (Math.abs(topA - topB) < 20) {
            return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
          }
          return topA - topB;
        });
      } else if (this.options.buildOrder === 'random') {
        validElements.sort(() => Math.random() - 0.5);
      }

      // Apply initial blank state (hide elements while preserving native page background)
      if (this.options.hideOnStart) {
        validElements.forEach((el) => {
          this.options.builderEffects.hideElement(el);
        });
      }

      this.indexedElements = validElements;
      return validElements;
    } catch (e) {
      console.warn('[dom-swarm] Selector query warning:', e);
      return [];
    }
  }

  /**
   * Identifies if an element is a distinct component container (card, box, section).
   */
  private isBlockContainer(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    // Buttons, links, and text elements must always be constructed as independent elements
    if (
      tag === 'button' ||
      tag === 'a' ||
      tag === 'h1' ||
      tag === 'h2' ||
      tag === 'h3' ||
      tag === 'h4' ||
      tag === 'h5' ||
      tag === 'h6' ||
      tag === 'p' ||
      tag === 'code'
    ) {
      return false;
    }

    const classList = el.className || '';
    if (classList.includes('card') || classList.includes('terminal') || classList.includes('spec-terminal')) {
      return true;
    }
    return tag === 'section' || tag === 'article';
  }

  /**
   * Intersection observer to trigger scroll-based builds if configured.
   */
  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            if (!this.observedElements.has(target)) {
              this.observedElements.add(target);
              this.options.onElementDiscovered?.(target);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px 100px 0px',
        threshold: 0.05,
      }
    );

    this.indexedElements.forEach((el) => {
      this.intersectionObserver?.observe(el);
    });
  }

  /**
   * Monitors dynamic component mounting for SPA client-side route changes.
   */
  private setupMutationObserver(): void {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;

    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldRescan = false;
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        if (mutation && mutation.addedNodes.length > 0) {
          for (let j = 0; j < mutation.addedNodes.length; j++) {
            const node = mutation.addedNodes[j];
            if (node instanceof HTMLElement && node.tagName.toLowerCase() !== 'dom-swarm-overlay') {
              shouldRescan = true;
              break;
            }
          }
        }
        if (shouldRescan) break;
      }

      if (shouldRescan) {
        if (this.mutationTimeout) clearTimeout(this.mutationTimeout);
        this.mutationTimeout = setTimeout(() => {
          const fresh = this.scanAndIndex();
          fresh.forEach((el) => {
            this.intersectionObserver?.observe(el);
          });
        }, 120);
      }
    });

    const target = document.body || document.documentElement;
    if (target) {
      this.mutationObserver.observe(target, { childList: true, subtree: true });
    }
  }

  /**
   * Evaluates if element matches ignore selectors or is structurally hidden.
   */
  private shouldIgnoreElement(el: HTMLElement): boolean {
    if (el.closest('dom-swarm-overlay') || el.closest('.swarm-hud')) return true;
    if (this.options.ignoreSelector && el.matches(this.options.ignoreSelector)) return true;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return true;

    return false;
  }

  /**
   * Creates a structured dependency-aware task graph for agentic construction:
   * Classifies tasks into 'rect', 'text', 'path', 'dup', and 'guide'.
   */
  public buildTaskGraph(elements: HTMLElement[]): ConstructionTask[] {
    const tasks: ConstructionTask[] = [];
    const elementToId = new Map<HTMLElement, string>();

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const id = `task-${i}`;
      elementToId.set(el, id);

      const isText = BuilderEffects.isTextElement(el);
      const isSvg = el.tagName.toLowerCase() === 'svg' || el.querySelector('path') !== null;

      // Check if this element is a repeating duplicate of an earlier sibling
      const prevSibling = el.previousElementSibling as HTMLElement | null;
      const isDuplicate =
        prevSibling &&
        elementToId.has(prevSibling) &&
        prevSibling.tagName === el.tagName &&
        Math.abs(prevSibling.getBoundingClientRect().width - rect.width) < 25 &&
        Math.abs(prevSibling.getBoundingClientRect().height - rect.height) < 25;

      let taskType: TaskType = 'rect';
      let sourceElement: HTMLElement | undefined = undefined;

      if (isDuplicate && prevSibling) {
        taskType = 'dup';
        sourceElement = prevSibling;
      } else if (isText) {
        taskType = 'text';
      } else if (isSvg) {
        taskType = 'path';
      } else {
        taskType = 'rect';
      }

      const deps: string[] = [];
      if (sourceElement && elementToId.has(sourceElement)) {
        deps.push(elementToId.get(sourceElement)!);
      }

      tasks.push({
        id,
        element: el,
        rect,
        boxType: i % 2 === 0 ? 'blue' : 'red',
        assignedAgents: [],
        targetPositions: [],
        startTime: 0,
        duration: 450,
        isText,
        completed: false,
        spec: {
          type: taskType,
          sourceElement,
          dx: sourceElement ? rect.left - sourceElement.getBoundingClientRect().left : 0,
          dy: sourceElement ? rect.top - sourceElement.getBoundingClientRect().top : 0,
        },
        deps,
      });
    }

    return tasks;
  }

  /**
   * Destroys observers.
   */
  public destroy(): void {
    if (this.mutationTimeout) {
      clearTimeout(this.mutationTimeout);
      this.mutationTimeout = null;
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    this.indexedElements = [];
  }
}
