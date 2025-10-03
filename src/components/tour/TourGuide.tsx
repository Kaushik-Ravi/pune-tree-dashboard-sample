// src/components/tour/TourGuide.tsx
import React, { useEffect, useRef } from 'react';
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { TourSteps } from './tourSteps';
import { waitForTourTarget } from './waitForTourTarget';

export type TourControlAction = 'NEXT_STEP' | 'PREV_STEP' | 'RESTART';

interface TourGuideProps {
  run: boolean;
  stepIndex: number;
  handleTourControl: (action: TourControlAction, payload?: any) => void;
}

const TourGuide: React.FC<TourGuideProps> = ({ run, stepIndex, handleTourControl }) => {
  const isMobile = window.innerWidth < 768;
  const steps: Step[] = isMobile
    ? [
        TourSteps.welcome,
        TourSteps.openDashboardMobile,
        TourSteps.dashboardTabs,
        TourSteps.drawingTools,
        TourSteps.knowYourNeighbourhood,
        TourSteps.plantingAdvisor,
        TourSteps.mapLayers,
        TourSteps.threeDMode,
        TourSteps.finish,
      ]
    : [
        TourSteps.welcome,
        TourSteps.openDashboardDesktop,
        TourSteps.dashboardTabs,
        TourSteps.drawingTools,
        TourSteps.knowYourNeighbourhood,
        TourSteps.plantingAdvisor,
        TourSteps.mapLayers,
        TourSteps.threeDMode,
        TourSteps.finish,
      ];

  const advancingStep = useRef(false);

  // This effect ensures the tour waits for the target to be ready before proceeding.
  useEffect(() => {
    const selector = steps[stepIndex]?.target;
    if (run && typeof selector === 'string') {
      advancingStep.current = true;
      waitForTourTarget(selector)
        .catch((err) => {
          console.error("Tour target failed to mount:", err.message);
          // Optional: handle error, e.g., by skipping the step or stopping the tour.
        })
        .finally(() => {
          advancingStep.current = false;
        });
    } else {
        advancingStep.current = false;
    }
  }, [run, stepIndex, steps]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, type, index } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || action === ACTIONS.CLOSE) {
      handleTourControl('RESTART');
      return;
    }
    
    // Only process STEP_AFTER events, and only when not already waiting for a target.
    if (type === EVENTS.STEP_AFTER) {
      if (advancingStep.current) return; // Prevent double-advancement

      if (action === ACTIONS.NEXT) {
        // Pass the key of the *next* step to the orchestrator
        const nextStepKey = Object.keys(TourSteps).find(key => TourSteps[key] === steps[index + 1]);
        handleTourControl('NEXT_STEP', nextStepKey);
      } else if (action === ACTIONS.PREV) {
        handleTourControl('PREV_STEP');
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      disableOverlayClose
      disableCloseOnEsc
      disableScrolling
      styles={{ options: { zIndex: 10000 } }}
    />
  );
};

export default TourGuide;