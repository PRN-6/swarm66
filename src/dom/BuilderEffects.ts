/**
 * Non-destructive DOM construction visual effects:
 * initial blank canvas hiding, typewriter text reveals, block scale-ins,
 * and safe style restoration failsafes.
 */
export class BuilderEffects {
  private activeRestorations = new Map<HTMLElement, () => void>();
  private modifiedElements = new Set<HTMLElement>();

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
    element.style.transform = 'scale(0.97)';
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
      const rawText = element.textContent || '';
      const cleanText = rawText.replace(/\s+/g, ' ').trim();
      const initialRect = element.getBoundingClientRect();
      if (initialRect.height > 10) {
        element.style.minHeight = `${initialRect.height}px`;
      }
      element.textContent = '';
      element.style.opacity = '1';
      element.style.transform = 'scale(1)';
      element.style.pointerEvents = '';

      const charDelay = Math.max(
        10,
        Math.floor((durationMs * 0.72) / Math.max(cleanText.length, 1))
      );
      let charIndex = 0;

      const typeNextChar = () => {
        if (cancelled) return;

        if (charIndex < cleanText.length) {
          element.textContent = cleanText.slice(0, charIndex + 1);
          charIndex++;
          timerId = setTimeout(typeNextChar, charDelay);
        } else {
          element.textContent = cleanText;
          this.cleanupElement(element);
          onComplete();
        }
      };

      timerId = setTimeout(typeNextChar, 30);

      const cancel = () => {
        cancelled = true;
        if (timerId) clearTimeout(timerId);
        element.textContent = rawText;
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
   * Cleans up temporary styles on an element after reveal completion.
   */
  public cleanupElement(element: HTMLElement): void {
    element.style.minHeight = '';
    element.style.transition = '';
    element.style.pointerEvents = '';
    this.modifiedElements.delete(element);
    this.activeRestorations.delete(element);
  }

  /**
   * Restores all modified elements to their original native styles.
   */
  public restoreAll(): void {
    const restorations = Array.from(this.activeRestorations.values());
    this.activeRestorations.clear();
    this.modifiedElements.clear();
    restorations.forEach((restore) => {
      try {
        restore();
      } catch (e) {
        // Safe restoration fallback
      }
    });
  }
}
