// src/components/tour/UserTour.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Joyride, { CallBackProps, STATUS, Step, EVENTS, ACTIONS, FloaterProps } from 'react-joyride';
import { DESKTOP_STEPS, MOBILE_STEPS, ExtendedStep } from './TourSteps';
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
      return true;
    }
  });

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
  const { cityStats } = useTreeStore();
  
  // MODIFIED: Dynamically select the correct tour steps based on viewport width
  const tourSteps = useMemo(() => {
      const isMobile = window.innerWidth < 768; // Tailwind's 'md' breakpoint
      return isMobile ? MOBILE_STEPS : DESKTOP_STEPS;
  }, []);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showLoader, setShowLoader] = useState(false);

  // Data-Contingent Activation: Show loader, then start the tour.
  useEffect(() => {
    if (isStatusLoading) return;

    if (!isTourCompleted) {
      if (!cityStats) {
        setShowLoader(true);
      } else {
        setShowLoader(false);
        setTimeout(() => setRun(true), 500);
      }
    }
  }, [isTourCompleted, cityStats, isStatusLoading]);

  // MODIFIED: State-Driven Controller Logic
  // This effect runs before a step is rendered to prepare the UI.
  useEffect(() => {
    if (!run) return;

    const step = tourSteps[stepIndex] as ExtendedStep;
    if (step?.action) {
      // Execute the pre-step action to set the application state correctly.
      step.action({ setSidebarOpen, setActiveTabIndex });
    }
  }, [stepIndex, run, setSidebarOpen, setActiveTabIndex, tourSteps]);

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
    
    // Use a delay after a step to allow UI transitions to complete before advancing.
    if (type === EVENTS.STEP_AFTER) {
      setTimeout(() => {
        const newIndex = index + (action === ACTIONS.PREV ? -1 : 1);
        setStepIndex(newIndex);
      }, 300); // This duration must match the sidebar's CSS transition time.
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
      // If a target is still not found, advance anyway to prevent getting stuck.
      setStepIndex(index + 1);
    }
  };
  
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
        steps={tourSteps}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous
        scrollToFirstStep
        showProgress
        showSkipButton
        floaterProps={floaterProps}
        disableOverlayClose
        disableScrollParentFix
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