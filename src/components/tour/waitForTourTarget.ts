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
 * Enhanced function to wait for a tour target element to be available and visible.
 * Includes retry logic, better timeout handling, and detailed error reporting.
 */
export function waitForTourTarget(
  selector: string,
  options: WaitForTargetOptions = {}
): Promise<WaitForTargetResult> {
  const {
    timeout = 5000, // Reduced from 8s to 5s
    retries = 1 // Reduced from 2 to 1 to prevent excessive retries
  } = options;

  return new Promise((resolve) => {
    let attemptCount = 0;
    let totalAttempts = 0;

    const attemptFind = () => {
      attemptCount++;
      totalAttempts++;
      const start = Date.now();
      
      const check = () => {
        const el = document.querySelector(selector) as HTMLElement | null;
        
        // Check if element exists, is visible, and is interactable
        if (el && el.offsetParent !== null) {
          // Additional check: ensure element has dimensions
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            console.log(`✅ Tour target found: "${selector}" (attempt ${totalAttempts})`);
            resolve({ success: true, element: el, attemptCount: totalAttempts });
            return;
          }
        }
        
        const elapsed = Date.now() - start;
        if (elapsed > timeout) {
          // Timeout reached for this attempt
          if (attemptCount <= retries) {
            console.warn(`⚠️ Tour target "${selector}" not found in ${timeout}ms. Retrying... (${attemptCount}/${retries})`);
            setTimeout(() => attemptFind(), 500); // Wait 500ms before retry
          } else {
            const error = `Tour target "${selector}" not found after ${totalAttempts} attempts (${timeout * (retries + 1)}ms total)`;
            console.warn(`⚠️ ${error} - will auto-skip`);
            resolve({
              success: false,
              error,
              attemptCount: totalAttempts
            });
          }
        } else {
          // Continue checking
          requestAnimationFrame(check);
        }
      };
      
      check();
    };
    
    attemptFind();
  });
}