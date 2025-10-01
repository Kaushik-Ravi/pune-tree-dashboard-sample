// src/components/Onboarding/hooks.ts
import { useState, useEffect, useCallback } from 'react';

// Custom hook for managing tour completion state in localStorage
export const useTourStatus = (): [boolean, () => void, boolean] => {
  const TOUR_COMPLETED_KEY = 'puneTreeDashboardTourCompleted_v2'; // Use a new key to ensure users see the new tour
  const [isLoading, setIsLoading] = useState(true);

  // Initialize state from localStorage, defaulting to true if localStorage is unavailable.
  const [isCompleted, setIsCompleted] = useState(() => {
    try {
      return window.localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
    } catch (error) {
      console.error("Could not access localStorage. Disabling tour.", error);
      return true; // Assume completed if localStorage is inaccessible
    }
  });

  // Effect to re-verify from localStorage once the component mounts on the client.
  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(TOUR_COMPLETED_KEY);
      setIsCompleted(storedValue === 'true');
    } catch (error) {
      // If reading fails, default to completed to avoid showing the tour.
      setIsCompleted(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsCompleted = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      setIsCompleted(true);
    } catch (error) {
      console.error("Could not write to localStorage.", error);
    }
  }, []);

  return [isCompleted, markAsCompleted, isLoading];
};