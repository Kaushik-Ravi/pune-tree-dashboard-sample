// src/components/tour/waitForTourTarget.ts
export function waitForTourTarget(selector: string, timeout = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      // Check if the element exists and is visible (offsetParent is not null)
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el && el.offsetParent !== null) {
        resolve();
      } else if (Date.now() - start > timeout) {
        console.error(`Tour target "${selector}" not mounted or visible within ${timeout}ms.`);
        reject(new Error('Tour target not mounted in time'));
      } else {
        requestAnimationFrame(check);
      }
    }
    check();
  });
}