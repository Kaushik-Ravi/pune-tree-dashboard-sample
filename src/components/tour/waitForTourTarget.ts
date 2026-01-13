// src/components/tour/waitForTourTarget.ts

export interface WaitForTargetOptions {
  timeout?: number;
  retries?: number;
  checkInterval?: number;
}

export interface WaitForTargetResult {
  success: boolean;
  element?: HTMLElement;
  error?: string;
  attemptCount?: number;
}

/**
 * Enhanced trigger-based function to wait for a tour target element.
 * Uses MutationObserver for real-time detection instead of polling.
 * Waits for element to be fully rendered, visible, and interactable.
 */
export function waitForTourTarget(
  selector: string,
  options: WaitForTargetOptions = {}
): Promise<WaitForTargetResult> {
  const {
    timeout = 10000, // Generous timeout - we're trigger-based now
    retries = 0
  } = options;

  return new Promise((resolve) => {
    let attemptCount = 0;
    let totalAttempts = 0;

    const attemptFind = () => {
      attemptCount++;
      totalAttempts++;
      
      // First, check if element already exists
      const checkElement = () => {
        const el = document.querySelector(selector) as HTMLElement | null;
        
        if (el && el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            console.log(`✅ Tour target found: "${selector}" (attempt ${totalAttempts})`);
            resolve({ success: true, element: el, attemptCount: totalAttempts });
            return true;
          }
        }
        return false;
      };

      // Quick initial check
      if (checkElement()) return;

      // Set up MutationObserver to watch for DOM changes
      const observer = new MutationObserver(() => {
        if (checkElement()) {
          observer.disconnect();
          clearTimeout(timeoutId);
        }
      });

      // Observe the entire document for changes
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-tour-id']
      });

      // Timeout fallback
      const timeoutId = setTimeout(() => {
        observer.disconnect();
        
        if (attemptCount <= retries) {
          console.warn(`⚠️ Retrying target: "${selector}" (attempt ${attemptCount}/${retries + 1})`);
          setTimeout(() => attemptFind(), 500);
        } else {
          console.warn(`❌ Tour target not found after ${totalAttempts} attempts: "${selector}"`);
          resolve({
            success: false,
            error: `Target not found: ${selector}`,
            attemptCount: totalAttempts
          });
        }
      }, timeout);
    };

    attemptFind();
  });
}