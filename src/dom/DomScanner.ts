import { BuilderEffects } from './BuilderEffects';
import { BuildOrder } from '../types';

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
 * sorting elements in natural visual sequence (top-to-bottom).
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
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(this.options.selector)
      );

      const validElements: HTMLElement[] = [];

      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        if (!el || this.shouldIgnoreElement(el)) continue;

        const rect = el.getBoundingClientRect();
        // Ignore zero-size or invisible elements
        if (rect.width < 8 || rect.height < 8) continue;

        validElements.push(el);
      }

      // Sort by build order (default: top-to-bottom)
      if (this.options.buildOrder === 'top-to-bottom') {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        validElements.sort((a, b) => {
          // Ancestors must always construct before their children
          if (a.contains(b)) return -1;
          if (b.contains(a)) return 1;

          const topA = a.getBoundingClientRect().top + scrollY;
          const topB = b.getBoundingClientRect().top + scrollY;
          if (Math.abs(topA - topB) < 15) {
            // If roughly on the same vertical line, order left-to-right
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
        rootMargin: '0px 0px 50px 0px',
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
