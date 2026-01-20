// src/components/tour/waitForTourTarget.ts

export interface WaitForTargetOptions {
  timeout?: number;
}

export interface WaitForTargetResult {
  success: boolean;
  element?: HTMLElement;
  error?: string;
}

/**
 * Wait for a tour target element using MutationObserver (trigger-based).
 * Scrolls element into view within its scrollable container.
 * Silently fails on timeout - no console warnings.
 */
export function waitForTourTarget(
  selector: string,
  options: WaitForTargetOptions = {}
): Promise<WaitForTargetResult> {
  const { timeout = 5000 } = options;

  return new Promise((resolve) => {
    let observer: MutationObserver | null = null;
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      clearTimeout(timeoutId);
    };

    const scrollElementIntoView = (el: HTMLElement) => {
      // Find the scrollable parent (sidebar content area)
      let scrollParent: HTMLElement | null = el.parentElement;
      while (scrollParent) {
        const overflowY = getComputedStyle(scrollParent).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          break;
        }
        scrollParent = scrollParent.parentElement;
      }

      if (scrollParent) {
        // Scroll within the container
        const containerRect = scrollParent.getBoundingClientRect();
        const elementRect = el.getBoundingClientRect();
        const scrollTop = scrollParent.scrollTop + (elementRect.top - containerRect.top) - (containerRect.height / 2);
        scrollParent.scrollTo({ top: scrollTop, behavior: 'smooth' });
      } else {
        // Fallback to scrollIntoView
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    const checkAndResolve = (): boolean => {
      const el = document.querySelector(selector) as HTMLElement | null;

      if (el) {
        const rect = el.getBoundingClientRect();
        // Check if element has dimensions
        if (rect.width > 0 && rect.height > 0) {
          cleanup();
          scrollElementIntoView(el);
          // Wait a bit for scroll, then resolve
          setTimeout(() => {
            resolve({ success: true, element: el });
          }, 150);
          return true;
        }
      }
      return false;
    };

    // Initial check
    if (checkAndResolve()) return;

    // Set up MutationObserver for DOM changes
    observer = new MutationObserver(() => {
      checkAndResolve();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-tour-id']
    });

    // Timeout fallback - silently fail
    timeoutId = setTimeout(() => {
      cleanup();
      resolve({ success: false, error: `Target not found: ${selector}` });
    }, timeout);
  });
}
