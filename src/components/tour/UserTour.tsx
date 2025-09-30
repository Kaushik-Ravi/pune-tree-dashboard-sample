// src/components/tour/UserTour.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

// MODIFIED: Re-architected responsive hook for intelligent placement
const useResponsiveSteps = (steps: Step[]): Step[] => {
    return useMemo(() => {
        const isMobile = window.innerWidth < 768; // md breakpoint
        if (!isMobile) {
            return steps;
        }
        // On mobile, the sidebar is a bottom sheet. Tooltips for its elements must appear on top.
        return steps.map(step => {
            const target = typeof step.target === 'string' ? step.target : '';
            if (target.startsWith('.sidebar')) {
                return { ...step, placement: 'top' };
            }
            if (step.placement === 'left' || step.placement === 'right') {
                return { ...step, placement: 'top' };
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
  const [isTourCompleted, markAsCompleted, isStatusLoading] = useTourStatus();
  const { cityStats } = useTreeStore();
  const responsiveSteps = useResponsiveSteps(TOUR_STEPS);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (isStatusLoading) return;

    if (!isTourCompleted) {
      if (!cityStats) {
        setShowLoader(true);
      } else {
        setShowLoader(false);
        setTimeout(() => {
          setRun(true);
        }, 500);
      }
    }
  }, [isTourCompleted, cityStats, isStatusLoading]);

  // MODIFIED: Re-architected state controller logic
  useEffect(() => {
    if (!run) return;

    const step = responsiveSteps[stepIndex];
    if (!step) return;

    const target = typeof step.target === 'string' ? step.target : '';

    // Determine required UI state for the current step
    const shouldSidebarBeOpen = target.startsWith('.sidebar');

    // Dispatch UI state changes
    setSidebarOpen(shouldSidebarBeOpen);

    // Switch tabs only if the sidebar is supposed to be open
    if (shouldSidebarBeOpen) {
        if (target.includes('button:nth-of-type(4)')) {
            setActiveTabIndex(3); // Map Layers
        } else if (target.includes('button:nth-of-type(3)')) {
            setActiveTabIndex(2); // Planting Advisor
        } else {
            setActiveTabIndex(0); // Default to City Overview for other sidebar steps
        }
    }

  }, [stepIndex, run, setSidebarOpen, setActiveTabIndex, responsiveSteps]);

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

    // MODIFIED: Added a delay for UI transitions before advancing the step.
    // This resolves the race condition where the tour tries to find a target
    // that is still animating into view.
    if (type === EVENTS.STEP_AFTER) {
      setTimeout(() => {
        const newIndex = index + (action === ACTIONS.PREV ? -1 : 1);
        setStepIndex(newIndex);
      }, 300); // 300ms matches the sidebar's CSS transition duration.
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
        steps={responsiveSteps}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous
        scrollToFirstStep
        showProgress
        showSkipButton
        floaterProps={floaterProps}
        // Disable Joyride's internal step advancement; we control it manually in the callback.
        disableScrollParentFix
        disableOverlayClose
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