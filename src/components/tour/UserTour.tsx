// src/components/tour/UserTour.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Joyride, { CallBackProps, STATUS, Step, EVENTS, ACTIONS } from 'react-joyride';
import { TOUR_STEPS } from './TourSteps';
import { useTreeStore } from '../../store/TreeStore';

// Custom hook for managing tour completion state in localStorage
const useTourStatus = (): [boolean, () => void] => {
  const TOUR_COMPLETED_KEY = 'puneTreeDashboardTourCompleted';

  const [isCompleted, setIsCompleted] = useState(() => {
    // On mount, check localStorage. Default to 'true' if localStorage is unavailable to prevent tour loops.
    try {
      return window.localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
    } catch (error) {
      console.error("Could not access localStorage. Disabling tour.", error);
      return true;
    }
  });

  const markAsCompleted = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      setIsCompleted(true);
    } catch (error) {
      console.error("Could not write to localStorage.", error);
    }
  }, []);

  return [isCompleted, markAsCompleted];
};

// Custom hook to adapt tour step placement for mobile viewports
const useResponsiveSteps = (steps: Step[]): Step[] => {
    return useMemo(() => {
        const isMobile = window.innerWidth < 768; // md breakpoint
        if (!isMobile) {
            return steps;
        }
        return steps.map(step => {
            if (step.placement === 'left' || step.placement === 'right') {
                return { ...step, placement: 'bottom' };
            }
            return step;
        });
    }, [steps]);
};


interface UserTourProps {
  setSidebarOpen: (isOpen: boolean) => void;
  setActiveTabIndex: (index: number) => void;
}

const UserTour: React.FC<UserTourProps> = ({ setSidebarOpen, setActiveTabIndex }) => {
  const [isTourCompleted, markTourAsCompleted] = useTourStatus();
  const { cityStats } = useTreeStore(); // Subscribe to the data store
  const responsiveSteps = useResponsiveSteps(TOUR_STEPS);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Data-Contingent Activation: Start the tour only after initial data is loaded.
  useEffect(() => {
    if (!isTourCompleted && cityStats) {
      // Delay ensures the UI has settled after data load.
      setTimeout(() => {
        setRun(true);
      }, 1500);
    }
  }, [isTourCompleted, cityStats]);

  // State-Aware UI Control: Programmatically prepare the UI before each step.
  useEffect(() => {
    if (!run) return;

    const step = responsiveSteps[stepIndex];
    if (!step) return;

    const target = typeof step.target === 'string' ? step.target : '';

    // Open the sidebar for steps that target its elements
    if (target.startsWith('.sidebar')) {
      // Use a short timeout to allow the sidebar animation to begin before Joyride tries to find the element
      setTimeout(() => setSidebarOpen(true), 100);
    }

    // Switch to the correct tab for specific steps
    if (target.includes('button:nth-of-type(4)')) { // Map Layers tab
      setActiveTabIndex(3);
    } else if (target.includes('button:nth-of-type(3)')) { // Planting Advisor tab
      setActiveTabIndex(2);
    } else if (stepIndex === 1 || stepIndex === 2) { // City Overview & Navigation tabs
      setActiveTabIndex(0);
    }

  }, [stepIndex, run, setSidebarOpen, setActiveTabIndex, responsiveSteps]);


  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action, index } = data;
    
    // Handle tour completion or dismissal
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finishedStatuses.includes(status)) {
      setRun(false);
      markTourAsCompleted();
      setSidebarOpen(false); // Ensure sidebar is closed at the end
      setStepIndex(0); // Reset for potential future re-trigger
      return;
    }

    // Manually control step progression after user clicks Next/Back
    if (type === EVENTS.STEP_AFTER) {
      const newIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      setStepIndex(newIndex);
    }
  };

  return (
    <Joyride
      run={run}
      steps={responsiveSteps}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#2E7D32', // Matches the app's primary green
        },
        tooltip: {
          borderRadius: '0.5rem',
          fontSize: 15,
        },
        tooltipContainer: {
          textAlign: 'left',
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