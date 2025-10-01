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
    if (typeof window === 'undefined') return [];
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    return isMobile ? MOBILE_STEPS : DESKTOP_STEPS;
  }, []);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const isAppReady = useMemo(() => !!cityStats, [cityStats]);

  useEffect(() => {
    if (isStatusLoading || isTourCompleted) return;
    if (isAppReady) {
      setTimeout(() => setRun(true), 500);
    }
  }, [isTourCompleted, isAppReady, isStatusLoading]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action, index, step } = data;
    
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      markAsCompleted();
      setSidebarOpen(false);
      return;
    }
    
    if (type === EVENTS.STEP_AFTER) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      const nextStep = tourSteps[nextIndex] as ExtendedStep | undefined;

      if (nextStep?.action) {
        nextStep.action({ setSidebarOpen, setActiveTabIndex });
      }

      // FIX: The condition now correctly checks if the NEXT step's action will cause a transition.
      if (action !== ACTIONS.CLOSE && nextStep?.causesTransition) {
        setRun(false); // Pause tour

        const sidebarElement = document.querySelector('.sidebar');
        if (sidebarElement) {
          const onTransitionEnd = () => {
            setStepIndex(nextIndex);
            setRun(true);
          };
          sidebarElement.addEventListener('transitionend', onTransitionEnd, { once: true });
          
          // Fallback timer
          setTimeout(() => {
            sidebarElement.removeEventListener('transitionend', onTransitionEnd);
            if (!run) {
              setStepIndex(nextIndex);
              setRun(true);
            }
          }, 400);

        } else {
          setStepIndex(nextIndex);
          setRun(true);
        }
      } else {
        // No transition, proceed immediately.
        setStepIndex(nextIndex);
      }
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
      console.warn(`Onboarding target not found for step ${index}. Advancing.`);
      setStepIndex(index + 1);
    }
  };
  
  if (!isStatusLoading && !isTourCompleted && !isAppReady) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-[10001]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
        <p className="text-white text-lg">Preparing your dashboard experience...</p>
      </div>
    );
  }

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
        options: { zIndex: 10000, primaryColor: '#2E7D32' },
        tooltip: { borderRadius: '0.5rem', fontSize: '1rem', maxWidth: 'calc(100vw - 2rem)', width: 380 },
        buttonNext: { fontWeight: 600 },
        buttonBack: { marginRight: 'auto' }
      }}
      locale={{ last: 'End Tour' }}
    />
  );
};

export default Onboarding;