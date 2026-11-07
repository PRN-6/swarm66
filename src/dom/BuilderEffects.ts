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
    ];
    if (!textTags.includes(tagName)) return false;

    // Only typewrite if it has direct text content and not complex nested element trees
    const text = element.textContent?.trim() || '';
    return text.length > 0 && text.length < 350 && element.childElementCount <= 1;
  }

  /**
   * Immediately hides an element while preserving its native document layout and background.
   */
  public hideElement(element: HTMLElement): void {
    if (this.modifiedElements.has(element)) return;

    const originalOpacity = element.style.opacity;
    const originalVisibility = element.style.visibility;
    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;
    const originalPointerEvents = element.style.pointerEvents;

    element.style.opacity = '0';
    element.style.transform = 'scale(0.96)';
    element.style.transition = 'none';
    element.style.pointerEvents = 'none';

    this.modifiedElements.add(element);

    this.activeRestorations.set(element, () => {
      element.style.opacity = originalOpacity;
      element.style.visibility = originalVisibility;
      element.style.transform = originalTransform;
      element.style.transition = originalTransition;
      element.style.pointerEvents = originalPointerEvents;
      this.modifiedElements.delete(element);
    });
  }

  /**
   * Executes element construction reveal (typewriter for text, scale/opacity for blocks).
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

    if (isText && enableTypewriter && BuilderEffects.isTextElement(element)) {
      // Typewriter Effect
      const originalText = element.textContent || '';
      element.textContent = '';
      element.style.opacity = '1';
      element.style.transform = 'scale(1)';
      element.style.pointerEvents = '';

      const charDelay = Math.max(
        10,
        Math.floor((durationMs * 0.75) / Math.max(originalText.length, 1))
      );
      let charIndex = 0;

      const typeNextChar = () => {
        if (cancelled) return;

        if (charIndex < originalText.length) {
          element.textContent = originalText.slice(0, charIndex + 1);
          charIndex++;
          timerId = setTimeout(typeNextChar, charDelay);
        } else {
          element.textContent = originalText;
          this.cleanupElement(element);
          onComplete();
        }
      };

      timerId = setTimeout(typeNextChar, 50);

      const cancel = () => {
        cancelled = true;
        if (timerId) clearTimeout(timerId);
        element.textContent = originalText;
        this.cleanupElement(element);
      };

      this.activeRestorations.set(element, cancel);
      return cancel;
    } else {
      // Smooth Scale & Opacity Reveal for Blocks/Images/Buttons/Cards
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
    element.style.transition = '';
    element.style.transform = '';
    element.style.opacity = '';
    element.style.pointerEvents = '';
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
