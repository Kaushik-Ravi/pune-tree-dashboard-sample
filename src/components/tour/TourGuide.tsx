// src/components/tour/TourGuide.tsx
import React, { useEffect, useRef } from 'react';
import Joyride, { CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { getTourSteps, EnhancedTourStep } from './tourConfig';
import { waitForTourTarget } from './waitForTourTarget';
import ModernTooltip from './ModernTooltip';

export type TourControlAction = 'NEXT_STEP' | 'PREV_STEP' | 'RESTART' | 'SKIP_STEP';

interface TourGuideProps {
  run: boolean;
  stepIndex: number;
  handleTourControl: (action: TourControlAction, payload?: any) => void;
  isPreparingStep?: boolean;
}

const TourGuide: React.FC<TourGuideProps> = ({ run, stepIndex, handleTourControl, isPreparingStep }) => {
  const isMobile = window.innerWidth < 768;
  const steps: EnhancedTourStep[] = getTourSteps(isMobile);

  const advancingStep = useRef(false);

  // This effect ensures the tour waits for the target to be ready (trigger-based).
  useEffect(() => {
    const selector = steps[stepIndex]?.target;
    if (run && typeof selector === 'string' && selector !== 'body') {
      advancingStep.current = true;

      // Use generous timeout since we're trigger-based with MutationObserver
      waitForTourTarget(selector, { timeout: 10000, retries: 2 })
        .then((result) => {
          if (!result.success) {
            console.warn(`⚠️ Tour target not found: ${selector}`);
            // Silently skip if element is truly not available
            handleTourControl('SKIP_STEP');
          }
        })
        .catch((error) => {
          console.error('Error waiting for tour target:', error);
          handleTourControl('SKIP_STEP');
        })
        .finally(() => {
          advancingStep.current = false;
        });
    } else {
      advancingStep.current = false;
    }
  }, [run, stepIndex, steps, handleTourControl]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, type, index } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    // Handle tour completion or manual close
    if (finishedStatuses.includes(status) || action === ACTIONS.CLOSE) {
      handleTourControl('RESTART');
      return;
    }

    // Only process STEP_AFTER events, and only when not already waiting for a target.
    if (type === EVENTS.STEP_AFTER && !advancingStep.current) {
      if (action === ACTIONS.NEXT) {
        // Pass the key of the *next* step to the orchestrator
        const nextStep = steps[index + 1];
        if (nextStep) {
          handleTourControl('NEXT_STEP', nextStep.key);
        }
      } else if (action === ACTIONS.PREV) {
        // Pass the key of the *previous* step to restore its state
        const prevStep = steps[index - 1];
        if (prevStep) {
          handleTourControl('PREV_STEP', prevStep.key);
        }
      }
    }
  };

  return (
    <>
      {isPreparingStep && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '20px 30px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '3px solid #2E7D32',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: '#2E7D32', fontWeight: '500' }}>
            Preparing next step...
          </span>
        </div>
      )}
      <Joyride
        steps={steps}
        run={run && !isPreparingStep}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous
        scrollToFirstStep={true}
        showProgress={false}
        showSkipButton={false}
        disableOverlayClose
        disableCloseOnEsc
        disableOverlay={true}
        disableScrolling={false}
        disableScrollParentFix={true}
        scrollOffset={isMobile ? 80 : 120}
        scrollDuration={300}
        spotlightPadding={isMobile ? 4 : 8}
        spotlightClicks={false}
        tooltipComponent={ModernTooltip}
        styles={{
          options: {
            zIndex: 10000,
            overlayColor: 'rgba(0, 0, 0, 0.15)',
            arrowColor: '#2E7D32',
          },
          overlay: {
            mixBlendMode: 'normal',
          },
          spotlight: {
            borderRadius: isMobile ? '12px' : '8px',
            boxShadow: '0 0 0 4px rgba(46, 125, 50, 0.4), 0 0 0 9999px rgba(0, 0, 0, 0.4)',
          },
        }}
        floaterProps={{
          disableAnimation: false,
          offset: isMobile ? 16 : 20,
          disableFlip: false,
          options: {
            preventOverflow: {
              boundariesElement: 'viewport',
              padding: isMobile ? 20 : 12,
            },
          },
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Prevent body scroll during tour */
        body:has([data-test-id="button-primary"]) {
          overflow: hidden !important;
          position: fixed;
          width: 100%;
          height: 100%;
        }
        
        /* Ensure tooltips stay within viewport */
        .__floater__body {
          max-width: 90vw !important;
        }
        
        /* Fix for mobile devices */
        @media (max-width: 768px) {
          .__floater__body {
            max-width: 95vw !important;
          }
        }
      `}</style>
    </>
  );
};

export default TourGuide;