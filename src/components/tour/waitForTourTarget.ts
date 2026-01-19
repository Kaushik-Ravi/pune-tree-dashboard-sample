// src/components/tour/waitForTourTarget.ts

export interface WaitForTargetOptions {
  timeout?: number;
  retries?: number;
}

export interface WaitForTargetResult {
  success: boolean;
  element?: HTMLElement;
  error?: string;
  attemptCount?: number;
}

/**
 * Simplified function to wait for a tour target element.
 * Scrolls element into view when found. Uses polling for reliability.
 */
export function waitForTourTarget(
  selector: string,
  options: WaitForTargetOptions = {}
): Promise<WaitForTargetResult> {
  const { timeout = 5000 } = options;

  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkElement = () => {
      const el = document.querySelector(selector) as HTMLElement | null;

      if (el) {
        // Scroll element into view if it's inside a scrollable container
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Give a moment for scroll to complete, then verify visibility
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            resolve({ success: true, element: el, attemptCount: 1 });
            return;
          }
          // Element exists but not visible, keep trying
          scheduleNextCheck();
        }, 100);
        return;
      }

      // Element not found yet
      if (Date.now() - startTime < timeout) {
        scheduleNextCheck();
      } else {
        // Timeout reached - silently fail (no noisy console logs)
        resolve({
          success: false,
          error: `Target not found: ${selector}`,
          attemptCount: 1
        });
      }
    };

    const scheduleNextCheck = () => {
      requestAnimationFrame(() => setTimeout(checkElement, 50));
    };

    // Start checking
    checkElement();
  });
}
