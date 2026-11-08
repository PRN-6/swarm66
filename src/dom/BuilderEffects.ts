import { ElementCategory } from '../types';

/**
 * Non-destructive DOM construction visual effects:
 * initial blank canvas hiding, typewriter text reveals, block scale-ins,
 * and safe style restoration failsafes.
 */
export class BuilderEffects {
  private activeRestorations = new Map<HTMLElement, () => void>();
  private modifiedElements = new Set<HTMLElement>();

  /**
   * Identifies the design/semantic category of an element to pick the appropriate cursor tool
   * (e.g. pencil/pen for text, frame for containers, image tool for media, button tool for clicks).
   */
  public static getElementCategory(element: HTMLElement): ElementCategory {
    const tagName = element.tagName.toLowerCase();

    // 1. Code blocks and terminal elements
    if (tagName === 'pre' || tagName === 'code' || tagName === 'kbd' || tagName === 'samp') {
      return 'code';
    }

    // 2. Form input controls
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return 'input';
    }

    // 3. Buttons & Clickable actions
    if (
      tagName === 'button' ||
      element.getAttribute('role') === 'button' ||
      element.classList.contains('btn') ||
      element.classList.contains('button') ||
      (tagName === 'a' &&
        (element.classList.contains('btn') ||
          element.classList.contains('btn-primary') ||
          element.classList.contains('btn-secondary')))
    ) {
      return 'button';
    }

    // 4. Media & Graphics
    if (
      tagName === 'img' ||
      tagName === 'svg' ||
      tagName === 'video' ||
      tagName === 'canvas' ||
      tagName === 'picture' ||
      tagName === 'figure' ||
      element.classList.contains('avatar') ||
      element.classList.contains('icon')
    ) {
      return 'media';
    }

    // 5. Text elements (headers, paragraphs, labels, spans, inline text)
    const textTags = [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'span',
      'label',
      'blockquote',
      'strong',
      'em',
      'small',
      'b',
      'i',
      'li',
      'a',
    ];
    if (textTags.includes(tagName)) {
      return 'text';
    }

    // 6. Default: Layout containers, sections, cards, wrappers
    return 'container';
  }

  /**
   * Checks whether an element is suitable for a typewriter text reveal.
   * Only leaf text elements with zero child HTML tags qualify, ensuring full safety
   * with React Virtual DOM, Vue templates, and Svelte hydration.
   */
  public static isTextElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    const textTags = [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'code',
      'pre',
      'span',
      'strong',
      'em',
      'blockquote',
      'li',
      'label',
    ];
    if (!textTags.includes(tagName)) return false;

    // Only typewrite if it is a pure leaf element with direct text (no nested tags like SVG icons)
    const text = element.textContent?.trim() || '';
    return text.length > 0 && text.length < 500 && element.childElementCount === 0;
  }

  /**
   * Immediately hides an element while preserving its native document layout and background.
   * Uses !important property overrides to guarantee child cards, badges, and text stay hidden
   * even when framework stylesheets (like Tailwind or Bootstrap) use high-specificity utility classes.
   */
  public hideElement(element: HTMLElement): void {
    if (this.modifiedElements.has(element)) return;

    const originalOpacity = element.style.opacity;
    const originalVisibility = element.style.visibility;
    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;
    const originalPointerEvents = element.style.pointerEvents;
    const originalClipPath = element.style.clipPath;

    element.style.setProperty('opacity', '0', 'important');
    element.style.setProperty('transform', 'scale(0.96)', 'important');
    element.style.setProperty('transition', 'none', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');

    this.modifiedElements.add(element);

    this.activeRestorations.set(element, () => {
      if (originalOpacity) {
        element.style.setProperty('opacity', originalOpacity);
      } else {
        element.style.removeProperty('opacity');
      }
      if (originalVisibility) {
        element.style.setProperty('visibility', originalVisibility);
      } else {
        element.style.removeProperty('visibility');
      }
      if (originalTransform) {
        element.style.setProperty('transform', originalTransform);
      } else {
        element.style.removeProperty('transform');
      }
      if (originalTransition) {
        element.style.setProperty('transition', originalTransition);
      } else {
        element.style.removeProperty('transition');
      }
      if (originalPointerEvents) {
        element.style.setProperty('pointer-events', originalPointerEvents);
      } else {
        element.style.removeProperty('pointer-events');
      }
      if (originalClipPath) {
        element.style.setProperty('clip-path', originalClipPath);
      } else {
        element.style.removeProperty('clip-path');
      }
      this.modifiedElements.delete(element);
    });
  }

  /**
   * Executes element construction reveal (safe typewriter for text, smooth scale/opacity for blocks).
   * Framework-safe: Never destroys React Fiber text nodes, preventing reconciliation crashes.
   */
  public executeReveal(
    element: HTMLElement,
    isText: boolean,
    enableTypewriter: boolean,
    durationMs: number,
    onComplete: () => void
  ): () => void {
    let cancelled = false;
    let timerId: any = null;

    // Remove the !important overrides so the element can animate into view
    element.style.removeProperty('opacity');
    element.style.removeProperty('transform');
    element.style.removeProperty('transition');
    element.style.removeProperty('pointer-events');

    // Un-hide all child elements inside this container so content is immediately visible inside the card/box
    const hiddenChildren = element.querySelectorAll<HTMLElement>('*');
    for (let i = 0; i < hiddenChildren.length; i++) {
      const child = hiddenChildren[i];
      if (child && this.modifiedElements.has(child)) {
        child.style.removeProperty('opacity');
        child.style.removeProperty('transform');
        child.style.removeProperty('transition');
        child.style.removeProperty('pointer-events');
        child.style.removeProperty('clip-path');
        this.modifiedElements.delete(child);
        this.activeRestorations.delete(child);
      }
    }

    const safeTypewriter = isText && enableTypewriter && BuilderEffects.isTextElement(element);

    if (safeTypewriter && element.childElementCount === 0) {
      // Non-destructive Progressive Reveal:
      // Uses hardware-accelerated clip-path to unveil text left-to-right without mutating textContent.
      // 100% immune to React Fiber removeChild errors and hydration conflicts.
      element.style.opacity = '1';
      element.style.transform = 'scale(1)';
      element.style.pointerEvents = '';

      const originalText = element.textContent || '';
      const textLen = Math.max(originalText.length, 1);
      const steps = Math.min(textLen, 40);
      const stepDelay = Math.max(12, Math.floor((durationMs * 0.75) / steps));
      let currentStep = 0;

      const stepReveal = () => {
        if (cancelled) return;
        currentStep++;
        const pct = Math.min(100, Math.round((currentStep / steps) * 100));
        element.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;

        if (currentStep < steps) {
          timerId = setTimeout(stepReveal, stepDelay);
        } else {
          element.style.clipPath = '';
          this.cleanupElement(element);
          onComplete();
        }
      };

      timerId = setTimeout(stepReveal, 16);

      const cancel = () => {
        cancelled = true;
        if (timerId) clearTimeout(timerId);
        element.style.clipPath = '';
        this.cleanupElement(element);
      };

      this.activeRestorations.set(element, cancel);
      return cancel;
    } else {
      // Smooth Scale & Opacity Reveal for Blocks/Images/Buttons/Cards/Nested Text
      element.style.transition = `opacity ${durationMs * 0.75}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${durationMs * 0.75}ms cubic-bezier(0.16, 1, 0.3, 1)`;

      // Force style recalculation before transition
      void element.offsetHeight;

      element.style.opacity = '1';
      element.style.transform = 'scale(1)';
      element.style.pointerEvents = '';

      timerId = setTimeout(() => {
        if (cancelled) return;
        this.cleanupElement(element);
        onComplete();
      }, durationMs);

      const cancel = () => {
        cancelled = true;
        if (timerId) clearTimeout(timerId);
        this.cleanupElement(element);
      };

      this.activeRestorations.set(element, cancel);
      return cancel;
    }
  }

  /**
   * Cleans up temporary inline styles applied during animation.
   */
  private cleanupElement(element: HTMLElement): void {
    element.style.removeProperty('transition');
    element.style.removeProperty('transform');
    element.style.removeProperty('opacity');
    element.style.removeProperty('pointer-events');
    element.style.removeProperty('clip-path');
    this.activeRestorations.delete(element);
    this.modifiedElements.delete(element);
  }

  /**
   * Failsafe cleanup restoring all modified host DOM elements back to pristine native state.
   */
  public restoreAll(): void {
    this.activeRestorations.forEach((restore) => {
      try {
        restore();
      } catch {
        // Silently tolerate if element is already detached
      }
    });
    this.activeRestorations.clear();
    this.modifiedElements.clear();
  }
}
