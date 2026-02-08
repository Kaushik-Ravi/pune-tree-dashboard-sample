// src/hooks/useDebounce.ts
/**
 * DEBOUNCE HOOK
 * =============
 * 
 * Delays updating a value until after a specified delay.
 * Essential for search inputs to avoid excessive API calls.
 * 
 * Usage:
 *   const debouncedQuery = useDebounce(searchQuery, 300);
 */

import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of the provided value.
 * The debounced value will only update after the specified delay
 * has passed without the value changing.
 * 
 * @param value - The value to debounce
 * @param delay - The debounce delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if the value changes before the delay completes
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
