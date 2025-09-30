// src/components/tour/UserTour.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Joyride, { CallBackProps, STATUS, Step, EVENTS, ACTIONS, FloaterProps } from 'react-joyride';
import { TOUR_STEPS } from './TourSteps';
import { useTreeStore } from '../../store/TreeStore';

// Custom hook for managing tour completion state in localStorage
const useTourStatus = (): [boolean, () => void, boolean] => {
  const TOUR_COMPLETED_KEY = 'puneTreeDashboardTourCompleted';
  const [isLoading, setIsLoading] = useState(true);

  const [isCompleted, setIsCompleted] = useState(() => {
    try {
      return window.localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
    } catch (error) {
      console.error("Could not access localStorage. Disabling tour.", error);
      return true; // Default to completed if localStorage is unavailable
    }
  });

  // Check storage only once on mount
  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(TOUR_COMPLETED_KEY);
      setIsCompleted(storedValue === 'true');
    } catch (error) {
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


interface UserTourProps {
  setSidebarOpen: (isOpen: boolean) => void;
  setActiveTabIndex: (index: number) => void;
}

const UserTour: React.FC<UserTourProps> = ({ setSidebarOpen, setActiveTabIndex }) => {
  const [isTourCompleted, markAsCompleted, isStatusLoading] = useTourStatus();
  const { cityStats } = useTreeStore(); // Subscribe to the data store
  
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showLoader, setShowLoader] = useState(false);

  // Data-Contingent Activation with Pre-Tour Loader
  useEffect(() => {
    if (isStatusLoading) return; // Wait until we know if the tour was completed

    if (!isTourCompleted) {
      if (!cityStats) {
        // If tour is needed but data isn't ready, show the loader.
        setShowLoader(true);
      } else {
        // Data is ready, hide loader and start the tour.
        setShowLoader(false);
        setTimeout(() => {
          setRun(true);
        }, 500); // A brief delay for UI to settle
      }
    }
  }, [isTourCompleted, cityStats, isStatusLoading]);

  // State-Aware UI Control: Programmatically prepare the UI before each step.
  useEffect(() => {
    if (!run) return;

    const step = TOUR_STEPS[stepIndex];
    if (!step) return;

    const target = typeof step.target === 'string' ? step.target : '';

    const shouldOpenSidebar = target.startsWith('.sidebar') || 
                              target.includes('button:nth-of-type(4)') ||
                              target.includes('button:nth-of-type(3)');

    if (shouldOpenSidebar) {
      setSidebarOpen(true);
    }

    if (target.includes('button:nth-of-type(4)')) { 
      setActiveTabIndex(3);
    } else if (target.includes('button:nth-of-type(3)')) {
      setActiveTabIndex(2);
    } else if (stepIndex === 1 || stepIndex === 2) { 
      setActiveTabIndex(0);
    }

  }, [stepIndex, run, setSidebarOpen, setActiveTabIndex]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action, index } = data;
    
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finishedStatuses.includes(status)) {
      setRun(false);
      markAsCompleted();
      setSidebarOpen(false);
      setStepIndex(0);
      return;
    }
    
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      requestAnimationFrame(() => {
        setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
      });
    }
  };

  // MODIFIED: Removed invalid 'preventOverflow' prop. The library handles flipping by default.
  // We only pass valid props, such as 'styles'.
  const floaterProps: FloaterProps = {
    styles: {
      floater: {
        filter: `drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))`
      },
    },
  };

  return (
    <>
      {showLoader && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-[10001]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
          <p className="text-white text-lg">Preparing your dashboard experience...</p>
        </div>
      )}
      <Joyride
        run={run}
        steps={TOUR_STEPS}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous
        scrollToFirstStep
        showProgress
        showSkipButton
        floaterProps={floaterProps}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: '#2E7D32',
          },
          tooltip: {
            borderRadius: '0.5rem',
            fontSize: '1rem',
            maxWidth: 'calc(100vw - 2rem)',
            width: 380,
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
    </>
  );
};

export default UserTour;