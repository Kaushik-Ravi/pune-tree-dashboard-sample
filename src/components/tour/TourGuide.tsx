// src/components/tour/TourGuide.tsx
import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step, ACTIONS } from 'react-joyride';
import { TourSteps } from './tourSteps';

// Define the actions our tour can request from the main App component.
export type TourControlAction =
  | 'OPEN_SIDEBAR'
  | 'SWITCH_TAB_OVERVIEW'
  | 'SWITCH_TAB_PLANTING'
  | 'SWITCH_TAB_LAYERS';

interface TourGuideProps {
  run: boolean;
  setRun: (run: boolean) => void;
  handleTourControl: (action: TourControlAction) => void;
}

const TourGuide: React.FC<TourGuideProps> = ({ run, setRun, handleTourControl }) => {
  const [stepIndex, setStepIndex] = useState(0);

  // Determine which set of steps to use based on screen width.
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;

    // Construct the step sequence dynamically.
    const desktopSteps = [
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

    const mobileSteps = [
      TourSteps.welcome,
      TourSteps.openDashboardMobile,
      TourSteps.dashboardTabs,
      TourSteps.drawingTools,
      TourSteps.knowYourNeighbourhood,
      TourSteps.plantingAdvisor,
      TourSteps.mapLayers,
      TourSteps.threeDMode,
      TourSteps.finish,
    ];

    setSteps(isMobile ? mobileSteps : desktopSteps);
  }, []);


  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, step, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      setStepIndex(0);
      localStorage.setItem('hasCompletedTour', 'true');
      return;
    }

    // This is the orchestration logic. When a step is about to be displayed,
    // we fire the corresponding control action to prepare the UI.
    if (type === 'step:before') {
      // For mobile, open the sidebar when we first introduce it.
      if (step.target === '[data-tour-id="sidebar-toggle-mobile"]') {
        // No action needed here, we just point to the button.
      }
      // For both mobile and desktop, ensure sidebar is open for tab steps.
      else if (
        step.target === '[data-tour-id="sidebar-tabs"]' ||
        step.target === '[data-tour-id="know-your-neighbourhood"]'
      ) {
        handleTourControl('OPEN_SIDEBAR');
        handleTourControl('SWITCH_TAB_OVERVIEW');
      } else if (step.target === '[data-tour-id="tab-planting-advisor"]') {
        handleTourControl('OPEN_SIDEBAR');
        handleTourControl('SWITCH_TAB_PLANTING');
      } else if (step.target === '[data-tour-id="tab-map-layers"]') {
        handleTourControl('OPEN_SIDEBAR');
        handleTourControl('SWITCH_TAB_LAYERS');
      }
    }


    if (action === ACTIONS.NEXT || action === ACTIONS.PREV) {
      setStepIndex(index + (action === ACTIONS.NEXT ? 1 : -1));
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
      showProgress
      showSkipButton
      styles={{
        options: {
          zIndex: 10000, // Ensure tour is on top of everything
        },
      }}
    />
  );
};

export default TourGuide;