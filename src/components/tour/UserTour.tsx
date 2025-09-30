// src/components/tour/UserTour.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Joyride, { CallBackProps, STATUS, Step, EVENTS } from 'react-joyride';
import { TOUR_STEPS } from './TourSteps';

// Custom hook for managing tour completion state in localStorage
const useTourStatus = (): [boolean, () => void] => {
  const TOUR_COMPLETED_KEY = 'puneTreeDashboardTourCompleted';

  const [isCompleted, setIsCompleted] = useState(() => {
    try {
      const storedValue = window.localStorage.getItem(TOUR_COMPLETED_KEY);
      return storedValue === 'true';
    } catch (error) {
      console.error("Could not access localStorage:", error);
      return true; // Default to completed if localStorage is unavailable
    }
  });

  const markAsCompleted = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      setIsCompleted(true);
    } catch (error) {
      console.error("Could not write to localStorage:", error);
    }
  }, []);

  return [isCompleted, markAsCompleted];
};


interface UserTourProps {
  setSidebarOpen: (isOpen: boolean) => void;
  setActiveTabIndex: (index: number) => void;
}

const UserTour: React.FC<UserTourProps> = ({ setSidebarOpen, setActiveTabIndex }) => {
  const [isTourCompleted, markTourAsCompleted] = useTourStatus();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Automatically start the tour for first-time users
    if (!isTourCompleted) {
      // A small delay ensures the initial UI has rendered before the tour starts
      setTimeout(() => {
        setRun(true);
      }, 1500);
    }
  }, [isTourCompleted]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index, step } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      markTourAsCompleted();
      setSidebarOpen(false); // Ensure sidebar is closed at the end
      return;
    }
    
    // Programmatically control UI elements based on the current step
    if (type === EVENTS.STEP_BEFORE) {
      const target = typeof step.target === 'string' ? step.target : '';
      
      // Open the sidebar for steps that target elements within it
      if (target.startsWith('.sidebar')) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }

      // Switch to the correct tab for specific steps
      if (target.includes('button:nth-of-type(4)')) { // Map Layers tab
        setActiveTabIndex(3);
      } else if (target.includes('button:nth-of-type(3)')) { // Planting Advisor tab
        setActiveTabIndex(2);
      } else if (index === 1 || index === 2) { // City Overview / Navigation tabs
        setActiveTabIndex(0);
      }
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        // This advances the tour to the next step
        const newIndex = index + (data.action === 'prev' ? -1 : 1);
        setStepIndex(newIndex);
    }

  };

  return (
    <Joyride
      run={run}
      steps={TOUR_STEPS}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#2E7D32', // Matches the app's primary green
        },
        tooltip: {
          borderRadius: '0.5rem',
        },
        buttonNext: {
            fontWeight: 600,
        },
        buttonBack: {
            marginRight: 'auto',
        }
      }}
      locale={{
        last: 'End Tour',
      }}
    />
  );
};

export default UserTour;