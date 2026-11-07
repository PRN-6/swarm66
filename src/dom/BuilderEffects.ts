/**
 * Non-destructive DOM construction visual effects:
 * initial blank canvas hiding, typewriter text reveals with blinking caret and selection highlights,
 * block scale-ins, Alt-drag duplication offsets, and safe style restoration failsafes.
 */
export class BuilderEffects {
  private activeRestorations = new Map<HTMLElement, () => void>();
  private modifiedElements = new Set<HTMLElement>();
  private originalTextMap = new Map<HTMLElement, string>();

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
      'a',
      'button',
    ];
    if (!textTags.includes(tagName)) return false;

    const text = element.textContent?.trim() || '';
    return text.length > 0 && text.length < 500 && element.childElementCount <= 2;
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
    const originalText = element.textContent || '';

    this.originalTextMap.set(element, originalText);

    element.style.opacity = '0';
    element.style.visibility = 'hidden';
    element.style.transition = 'none';
    element.style.pointerEvents = 'none';

    this.modifiedElements.add(element);

    this.activeRestorations.set(element, () => {
      element.style.opacity = originalOpacity;
      element.style.visibility = originalVisibility;
      element.style.transform = originalTransform;
      element.style.transition = originalTransition;
      element.style.pointerEvents = originalPointerEvents;
      if (this.originalTextMap.has(element)) {
        element.textContent = this.originalTextMap.get(element)!;
      }
      this.modifiedElements.delete(element);
    });
  }

  /**
   * Puts an element into drafting mode (visible wireframe before full styles).
   */
  public setDrafting(element: HTMLElement, isDrafting: boolean): void {
    if (isDrafting) {
      element.style.visibility = 'visible';
      element.style.opacity = '0.9';
    }
  }

  /**
   * Applies smooth CSS transition to restore final styles.
   */
  public applyFinalStyles(element: HTMLElement): void {
    element.style.visibility = 'visible';
    element.style.transition = 'opacity 0.28s ease, transform 0.28s ease, box-shadow 0.28s ease';
    element.style.opacity = '1';
    element.style.transform = 'none';
    element.style.pointerEvents = '';
  }

  /**
   * Gets stored full original text of an element.
   */
  public getFullText(element: HTMLElement): string {
    return this.originalTextMap.get(element) || element.textContent || '';
  }

  /**
   * Prepares text element for typing with blinking caret.
   */
  public prepareTextEditing(element: HTMLElement): void {
    const full = this.getFullText(element);
    this.originalTextMap.set(element, full);
    element.style.visibility = 'visible';
    element.style.opacity = '1';
    element.innerHTML = '<span class="swarm-text-content"></span><span class="swarm-caret" style="display:inline-block;width:1.5px;height:1.15em;vertical-align:text-bottom;background:currentColor;animation:swarm-blink 1s steps(1) infinite;margin-left:1px;"></span>';
  }

  /**
   * Appends text to an element being edited.
   */
  public setTypedText(element: HTMLElement, currentText: string): void {
    const textSpan = element.querySelector('.swarm-text-content');
    if (textSpan) {
      textSpan.textContent = currentText;
    } else {
      element.textContent = currentText;
    }
  }

  /**
   * Highlights all text in blue (.text-sel) during double-click edit.
   */
  public selectAllText(element: HTMLElement): void {
    const text = this.getFullText(element);
    element.style.visibility = 'visible';
    element.style.opacity = '1';
    element.innerHTML = `<span class="swarm-text-sel" style="background:#0d99ff47;border-radius:2px;">${text}</span>`;
  }

  /**
   * Finishes text editing, removes caret/selection wrappers, and sets final text.
   */
  public finishTextEditing(element: HTMLElement): void {
    const text = this.getFullText(element);
    element.textContent = text;
    this.cleanupElement(element);
  }

  /**
   * Prepares a duplicated element to follow cursor during Alt-drag.
   */
  public prepareDuplicate(target: HTMLElement, source: HTMLElement, initialDx: number, initialDy: number): void {
    const full = this.getFullText(source);
    this.originalTextMap.set(target, full);
    target.style.visibility = 'visible';
    target.style.opacity = '1';
    target.style.transition = 'none';
    target.style.transform = `translate3d(${initialDx}px, ${initialDy}px, 0)`;
  }

  /**
   * Updates duplicate offset during dragging.
   */
  public updateDuplicateOffset(target: HTMLElement, dx: number, dy: number): void {
    target.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  }

  /**
   * Finishes duplicate drop.
   */
  public finishDuplicate(target: HTMLElement): void {
    target.style.transition = 'transform 0.15s ease';
    target.style.transform = 'none';
    this.cleanupElement(target);
  }

  /**
   * Checks whether two elements have different text content.
   */
  public hasDifferentText(a: HTMLElement, b: HTMLElement): boolean {
    const textA = (this.getFullText(a) || a.textContent || '').trim();
    const textB = (this.getFullText(b) || b.textContent || '').trim();
    return textA !== textB;
  }

  /**
   * Cleans up temporary styles on an element after reveal completion.
   */
  public cleanupElement(element: HTMLElement): void {
    element.style.minHeight = '';
    element.style.transition = '';
    element.style.pointerEvents = '';
    element.style.transform = '';
    element.style.opacity = '1';
    element.style.visibility = 'visible';
    this.modifiedElements.delete(element);
    this.activeRestorations.delete(element);
  }

  /**
   * Reverts all modified elements to their pre-swarm appearance.
   */
  public restoreAll(): void {
    this.activeRestorations.forEach((restore) => {
      try {
        restore();
      } catch {
        // Safe restoration fallback
      }
    });
    this.activeRestorations.clear();
    this.modifiedElements.clear();
    this.originalTextMap.clear();
  }
}
