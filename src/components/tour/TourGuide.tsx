// src/components/tour/TourGuide.tsx
import React from 'react';
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { TourSteps } from './tourSteps';

export type TourControlAction =
  | 'NEXT_STEP'
  | 'PREV_STEP'
  | 'RESTART';

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

    // If the tour is finished or skipped, tell the parent to restart/reset.
    if (finishedStatuses.includes(status) || action === ACTIONS.CLOSE) {
      handleTourControl('RESTART');
      return;
    }

    // When the user clicks "Next", report this action to the parent.
    // The parent (App.tsx) will handle the UI changes and then update the stepIndex.
    if (action === ACTIONS.NEXT && type === EVENTS.STEP_AFTER) {
      const nextStepKey = Object.keys(TourSteps).find(key => TourSteps[key] === steps[index + 1]);
      handleTourControl('NEXT_STEP', nextStepKey);
    }
    // Handle the "Back" button click
    else if (action === ACTIONS.PREV && type === EVENTS.STEP_AFTER) {
      handleTourControl('PREV_STEP');
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      // We are now preventing joyride from managing the step index internally.
      // All control flows through our handleTourControl prop.
      disableCloseOnEsc={true}
      disableOverlayClose={true}
      showProgress
      showSkipButton
      styles={{
        options: {
          zIndex: 10000,
        },
      }}
    />
  );
};

export default TourGuide;