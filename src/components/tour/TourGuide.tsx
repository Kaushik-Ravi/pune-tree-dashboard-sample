// src/components/tour/TourGuide.tsx
import React from 'react';
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { TourSteps } from './tourSteps';

export type TourControlAction =
  | 'OPEN_SIDEBAR'
  | 'CLOSE_SIDEBAR'
  | 'SWITCH_TAB_OVERVIEW'
  | 'SWITCH_TAB_PLANTING'
  | 'SWITCH_TAB_LAYERS'
  | 'GO_TO_STEP';

interface TourGuideProps {
  run: boolean;
  setRun: (run: boolean) => void;
  stepIndex: number;
  handleTourControl: (action: TourControlAction, payload?: any) => void;
}

const TourGuide: React.FC<TourGuideProps> = ({ run, setRun, stepIndex, handleTourControl }) => {

  const isMobile = window.innerWidth < 768;

  // Dynamically construct the step sequence based on device type.
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
        // Desktop doesn't need the 'open sidebar' step as we'll open it programmatically.
        TourSteps.dashboardTabs,
        TourSteps.drawingTools,
        TourSteps.knowYourNeighbourhood,
        TourSteps.plantingAdvisor,
        TourSteps.mapLayers,
        TourSteps.threeDMode,
        TourSteps.finish,
      ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type, step } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      handleTourControl('GO_TO_STEP', 0); // Reset step index in parent
      localStorage.setItem('hasCompletedTour', 'true');
      handleTourControl('CLOSE_SIDEBAR'); // Close sidebar on finish
      return;
    }

    // This is the core orchestration logic.
    if (action === ACTIONS.NEXT && type === EVENTS.STEP_AFTER) {
        const nextStepIndex = index + 1;
        const nextStepKey = Object.keys(TourSteps).find(key => TourSteps[key] === steps[nextStepIndex]);

        // Command the App component to prepare the UI for the *next* step.
        switch(nextStepKey) {
            case 'openDashboardDesktop':
            case 'dashboardTabs':
            case 'knowYourNeighbourhood':
                handleTourControl('OPEN_SIDEBAR');
                handleTourControl('SWITCH_TAB_OVERVIEW');
                // Give sidebar time to animate open before moving to the step
                setTimeout(() => handleTourControl('GO_TO_STEP', nextStepIndex), 300);
                break;
            case 'plantingAdvisor':
                handleTourControl('OPEN_SIDEBAR');
                handleTourControl('SWITCH_TAB_PLANTING');
                setTimeout(() => handleTourControl('GO_TO_STEP', nextStepIndex), 300);
                break;
            case 'mapLayers':
                handleTourControl('OPEN_SIDEBAR');
                handleTourControl('SWITCH_TAB_LAYERS');
                setTimeout(() => handleTourControl('GO_TO_STEP', nextStepIndex), 300);
                break;
            case 'drawingTools':
                 handleTourControl('CLOSE_SIDEBAR');
                 setTimeout(() => handleTourControl('GO_TO_STEP', nextStepIndex), 300);
                 break;
            default:
                // If no special action is needed, just advance the step.
                handleTourControl('GO_TO_STEP', nextStepIndex);
                break;
        }
    } else if (action === ACTIONS.PREV && type === EVENTS.STEP_AFTER) {
        const prevStepIndex = index - 1;
        handleTourControl('GO_TO_STEP', prevStepIndex);
    } else if (action === ACTIONS.CLOSE) {
       setRun(false);
       localStorage.setItem('hasCompletedTour', 'true');
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      // We are controlling the flow manually now, so the 'Next' button
      // will trigger our callback but not automatically advance the state.
      disableOverlayClose={true}
      disableCloseOnEsc={true}
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