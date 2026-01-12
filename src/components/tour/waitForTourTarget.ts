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
    timeout = 2000, // Quick check only
    retries = 0 // No retries
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
          // Timeout reached
          if (attemptCount <= retries) {
            setTimeout(() => attemptFind(), 500);
          } else {
            resolve({
              success: false,
              error: `Target not found: ${selector}`,
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