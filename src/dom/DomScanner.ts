import { BuilderEffects } from './BuilderEffects';
import { BuildOrder } from '../types';

export interface DomScannerOptions {
  selector: string;
  ignoreSelector: string;
  hideOnStart: boolean;
  buildOrder: BuildOrder;
  builderEffects: BuilderEffects;
  onElementDiscovered?: (element: HTMLElement) => void;
  isElementConstructed?: (element: HTMLElement) => boolean;
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
      // 1. Gather all elements matching configured selector
      const primaryCandidates = Array.from(
        document.querySelectorAll<HTMLElement>(this.options.selector)
      );

      // 2. Also query modern UI cards, badges, spec boxes, and leaf text containers
      const componentCandidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'div[class*="border"], div[class*="bg-"], div[class*="card"], div[class*="box"], div[class*="spec"], div[class*="item"], div[class*="panel"], span'
        )
      );

      const combined = Array.from(new Set([...primaryCandidates, ...componentCandidates]));
      const validElements: HTMLElement[] = [];

      for (let i = 0; i < combined.length; i++) {
        const el = combined[i];
        if (!el || this.shouldIgnoreElement(el)) continue;

        const rect = el.getBoundingClientRect();
        if (!this.isEligibleElement(el, rect)) continue;

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
   * Immediately hides newly mounted elements in the DOM tree before browser paint.
   * Guarantees true blank canvas on dynamic React/Vue page transitions and client navigation.
   */
  public hideCandidateTree(root: HTMLElement): void {
    if (this.shouldIgnoreElement(root)) return;
    if (this.options.isElementConstructed?.(root)) return;

    const rect = root.getBoundingClientRect();
    if (this.isEligibleElement(root, rect)) {
      this.options.builderEffects.hideElement(root);
    }
    const children = root.querySelectorAll<HTMLElement>(
      'header, nav, main, section, article, aside, footer, h1, h2, h3, h4, h5, h6, p, span, a, button, input, textarea, select, label, img, svg, canvas, video, pre, code, blockquote, li, table, [class*="card"], [class*="badge"], [class*="box"], [class*="border"], [class*="spec"]'
    );
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child && !this.shouldIgnoreElement(child) && !this.options.isElementConstructed?.(child)) {
        this.options.builderEffects.hideElement(child);
      }
    }
  }

  /**
   * Monitors dynamic component mounting for SPA client-side route changes (React, Vue, Next.js, Svelte).
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
              // Synchronously hide newly added DOM trees to prevent visual flicker before construction
              if (this.options.hideOnStart) {
                this.hideCandidateTree(node);
              }
            }
          }
        }
      }

      if (shouldRescan) {
        if (this.mutationTimeout) clearTimeout(this.mutationTimeout);
        // Fast 16ms single-frame debounce
        this.mutationTimeout = setTimeout(() => {
          const fresh = this.scanAndIndex();
          fresh.forEach((el) => {
            if (!this.observedElements.has(el)) {
              this.observedElements.add(el);
              this.options.onElementDiscovered?.(el);
            }
            this.intersectionObserver?.observe(el);
          });
        }, 16);
      }
    });

    const target = document.body || document.documentElement;
    if (target) {
      this.mutationObserver.observe(target, { childList: true, subtree: true });
    }
  }

  /**
   * Checks whether an element contains meaningful content or visual styling
   * worthy of autonomous agent construction.
   */
  private isEligibleElement(el: HTMLElement, rect: DOMRect): boolean {
    if (rect.width < 8 || rect.height < 8) return false;

    const tagName = el.tagName.toLowerCase();

    // 1. Semantic headings, copy, media, form controls, and lists are always eligible
    const alwaysEligible = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'button',
      'a',
      'img',
      'svg',
      'canvas',
      'video',
      'pre',
      'code',
      'kbd',
      'samp',
      'blockquote',
      'label',
      'input',
      'textarea',
      'select',
      'li',
      'table',
    ];
    if (alwaysEligible.includes(tagName)) return true;

    // 2. Elements with explicit card, badge, spec, item, border, button, or swarm classes
    const className = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const visualClassKeywords = [
      'card',
      'badge',
      'box',
      'panel',
      'item',
      'border',
      'btn',
      'spec',
      'pill',
      'tile',
      'stat',
      'banner',
      'tag',
      'swarm',
      'aspect-square',
    ];
    if (visualClassKeywords.some((kw) => className.includes(kw))) return true;

    // 3. Spans: Eligible if they have direct text content or inline badges
    if (tagName === 'span') {
      const text = el.textContent?.trim() || '';
      return text.length > 0 && text.length < 500 && el.childElementCount <= 3;
    }

    // 4. Divs / Containers: Eligible if they have direct text or visible border/background styling
    if (
      tagName === 'div' ||
      tagName === 'section' ||
      tagName === 'article' ||
      tagName === 'header' ||
      tagName === 'nav' ||
      tagName === 'footer' ||
      tagName === 'aside'
    ) {
      // Direct text node
      const hasDirectText = Array.from(el.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent?.trim() || '').length > 0
      );
      if (hasDirectText && el.childElementCount <= 2) return true;

      // Visual container with border or non-transparent background
      if (typeof window !== 'undefined') {
        const style = window.getComputedStyle(el);
        const hasBorder =
          style.borderWidth !== '0px' && style.borderStyle !== 'none' && style.borderStyle !== '';
        const hasBg =
          style.backgroundColor !== 'transparent' &&
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
          style.backgroundColor !== '';
        const hasShadow = style.boxShadow !== 'none' && style.boxShadow !== '';
        if ((hasBorder || hasBg || hasShadow) && rect.width >= 40 && rect.height >= 24) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Evaluates if element matches ignore selectors or is structurally hidden.
   * Protects whole-page viewport background wrappers so the native page theme is never lost,
   * and prevents decomposition of composite interactive widgets (chessboards, canvas, SVGs, code blocks).
   */
  private shouldIgnoreElement(el: HTMLElement): boolean {
    if (!el || !(el instanceof HTMLElement)) return true;
    if (el.closest('dom-swarm-overlay') || el.closest('.swarm-hud')) return true;
    if (this.options.ignoreSelector && el.matches(this.options.ignoreSelector)) return true;

    const tagName = el.tagName.toLowerCase();
    // Ignore non-visual technical tags and application mount roots
    if (
      ['html', 'body', 'script', 'style', 'noscript', 'link', 'meta', 'template', 'head'].includes(
        tagName
      )
    ) {
      return true;
    }
    if (el.id === 'root' || el.id === '__next' || el.hasAttribute('data-reactroot')) return true;

    // Never decompose internal SVG elements (paths, rects, circles, defs, g)
    if (el.closest('svg') && tagName !== 'svg') return true;

    // Never decompose Canvas or Video internals
    if (el.closest('canvas') && tagName !== 'canvas') return true;

    // Never decompose complex interactive widgets (Chessboards, Maps, Calendars, Iframes)
    if (
      el.closest(
        '[data-square], [data-chessboard], [class*="chessboard"], [class*="leaflet"], [class*="mapbox"], iframe'
      ) &&
      !el.matches('[data-chessboard], [class*="chessboard"], [class*="aspect-square"]')
    ) {
      return true;
    }

    // Never decompose syntax-highlighted code block internals (tokens inside pre/code)
    if (el.closest('pre') && el !== el.closest('pre')) return true;

    // Never decompose atomic interactive controls (buttons and links)
    if (el.closest('button') && el !== el.closest('button')) return true;
    if (el.closest('a') && el !== el.closest('a')) return true;

    // Ignore elements with zero dimension or hidden display
    if (typeof window !== 'undefined') {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return true;

      // Protect full-viewport background wrappers (e.g. <div class="min-h-screen bg-black">)
      // so the native background of the website is NEVER lost!
      const winW = window.innerWidth || 1024;
      const winH = window.innerHeight || 768;
      const rect = el.getBoundingClientRect();
      if (rect.width >= winW * 0.96 && rect.height >= winH * 0.96 && el.childElementCount >= 2) {
        return true;
      }
    }

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
