// src/components/Onboarding/index.tsx
import React, { useState, useEffect, useMemo } from 'react';
import Joyride, { CallBackProps, STATUS, EVENTS, ACTIONS, Step } from 'react-joyride';
import { DESKTOP_STEPS, MOBILE_STEPS, ExtendedStep } from './steps';
import { useTourStatus } from './hooks';
import { useTreeStore } from '../../store/TreeStore';

interface OnboardingProps {
  setSidebarOpen: (isOpen: boolean) => void;
  setActiveTabIndex: (index: number) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ setSidebarOpen, setActiveTabIndex }) => {
  const [isTourCompleted, markAsCompleted, isStatusLoading] = useTourStatus();
  const { cityStats } = useTreeStore();
  
  const tourSteps = useMemo(() => {
    // Media query must be checked client-side.
    if (typeof window === 'undefined') return [];
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    return isMobile ? MOBILE_STEPS : DESKTOP_STEPS;
  }, []);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Determine if the app is ready for the tour to start.
  const isAppReady = useMemo(() => !!cityStats, [cityStats]);

  useEffect(() => {
    // Gate 1: Don't run if still loading completion status from localStorage.
    if (isStatusLoading) return;
    
    // Gate 2: Don't run if tour is already completed.
    if (isTourCompleted) return;

    // Gate 3: Only run when the application has loaded its initial data.
    if (isAppReady) {
      // Use a timeout to ensure the initial render is complete before starting the tour.
      setTimeout(() => setRun(true), 500);
    }
  }, [isTourCompleted, isAppReady, isStatusLoading]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action, index, step } = data;
    
    // 1. Handle Tour End
    // FIX: Use direct comparison to satisfy TypeScript's type narrowing.
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      markAsCompleted();
      setSidebarOpen(false);
      return;
    }
    
    // 2. Handle Step Progression (NEXT or PREV)
    if (type === EVENTS.STEP_AFTER) {
      const currentStep = step as ExtendedStep;
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      const nextStep = tourSteps[nextIndex] as ExtendedStep | undefined;

      // Pre-emptively execute the action for the *next* step.
      if (nextStep?.action) {
        nextStep.action({ setSidebarOpen, setActiveTabIndex });
      }

      // If the *current* step caused a UI transition, pause the tour to wait for it.
      if (action !== ACTIONS.CLOSE && currentStep.causesTransition) {
        setRun(false); // Pause tour

        const sidebarElement = document.querySelector('.sidebar');
        if (sidebarElement) {
          const onTransitionEnd = () => {
            sidebarElement.removeEventListener('transitionend', onTransitionEnd);
            // Resume tour after transition is complete.
            setStepIndex(nextIndex);
            setRun(true);
          };

          // Wait a frame to ensure the transition has started before attaching the listener.
          requestAnimationFrame(() => {
            sidebarElement.addEventListener('transitionend', onTransitionEnd, { once: true });
          });
          
          // Fallback timer in case 'transitionend' doesn't fire.
          setTimeout(() => {
              sidebarElement.removeEventListener('transitionend', onTransitionEnd);
              if (!run) { // Only if not already resumed
                setStepIndex(nextIndex);
                setRun(true);
              }
          }, 400); // 300ms transition + 100ms buffer

        } else {
          // Fallback if sidebar element is not found.
          setStepIndex(nextIndex);
          setRun(true);
        }
      } else {
        // No transition, proceed immediately.
        setStepIndex(nextIndex);
      }
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
      // If a target is missing, skip to the next step to avoid getting stuck.
      console.warn(`Onboarding target not found for step ${index}. Advancing.`);
      setStepIndex(index + 1);
    }
  };
  
  // Show a loader only if the tour is supposed to run but the app isn't ready.
  if (!isStatusLoading && !isTourCompleted && !isAppReady) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-[10001]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
        <p className="text-white text-lg">Preparing your dashboard experience...</p>
      </div>
    );
  }

  // Do not render Joyride if it's not supposed to run.
  if (!run) {
    return null;
  }

  return (
    <Joyride
      run={run}
      steps={tourSteps as Step[]}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
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

export default Onboarding;