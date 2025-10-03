// src/components/tour/TourGuide.tsx
import React from 'react';
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { TourSteps } from './tourSteps';

// Refined, simpler set of actions sent from the tour to the App
export type TourControlAction =
  | 'NEXT_STEP'
  | 'PREV_STEP'
  | 'RESTART'; // Covers skip, close, and finish

interface TourGuideProps {
  run: boolean;
  stepIndex: number;
  handleTourControl: (action: TourControlAction, payload?: any) => void;
}

const TourGuide: React.FC<TourGuideProps> = ({ run, stepIndex, handleTourControl }) => {
  const isMobile = window.innerWidth < 768;

  // The step array is determined once. No complex logic needed here.
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
        TourSteps.dashboardTabs,
        TourSteps.drawingTools,
        TourSteps.knowYourNeighbourhood,
        TourSteps.plantingAdvisor,
        TourSteps.mapLayers,
        TourSteps.threeDMode,
        TourSteps.finish,
      ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    // On any completion or close action, tell the parent to reset everything.
    if (finishedStatuses.includes(status) || action === ACTIONS.CLOSE) {
      handleTourControl('RESTART');
      return;
    }

    // This component's only job is to report user intent back to the parent.
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        // Find the key of the *next* step to help the parent orchestrate the UI.
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
      // These props are crucial for ensuring manual control.
      disableOverlayClose={true}
      disableCloseOnEsc={true}
      // This prevents Joyride from automatically advancing. We are in full control.
      disableScrolling={true} 
      styles={{
        options: {
          zIndex: 10000,
        },
      }}
    />
  );
};

export default TourGuide;