// src/components/tour/TourGuide.tsx
import React, { useEffect, useRef, useState } from 'react';
import Joyride, { CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { getTourSteps, EnhancedTourStep } from './tourConfig';
import { waitForTourTarget } from './waitForTourTarget';

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
  const [targetError, setTargetError] = useState<string | null>(null);
  
  const advancingStep = useRef(false);

  // This effect ensures the tour waits for the target to be ready before proceeding.
  useEffect(() => {
    const selector = steps[stepIndex]?.target;
    if (run && typeof selector === 'string' && selector !== 'body') {
      advancingStep.current = true;
      setTargetError(null);
      
      waitForTourTarget(selector, { timeout: 3000, retries: 1 })
        .then((result) => {
          if (!result.success) {
            console.warn(`Tour target not found: ${selector}`);
            // Element not found, skip silently
            handleTourControl('SKIP_STEP');
          }
        })
        .catch((error) => {
          console.error('Error waiting for tour target:', error);
        })
        .finally(() => {
          advancingStep.current = false;
        });
    } else {
      advancingStep.current = false;
      setTargetError(null);
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

  // Custom tooltip for error states
  const tooltipComponent = targetError ? (
    <div style={{
      padding: '20px',
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxWidth: '300px',
    }}>
      <div style={{ marginBottom: '12px', color: '#d32f2f', fontWeight: 'bold' }}>
        ⚠️ Element Not Found
      </div>
      <div style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
        {targetError}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => handleTourControl('SKIP_STEP')}
          style={{
            flex: 1,
            padding: '8px 16px',
            background: '#f5f5f5',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Skip Step
        </button>
        <button
          onClick={() => {
            setTargetError(null);
            // Trigger re-check
            const selector = steps[stepIndex]?.target;
            if (typeof selector === 'string' && selector !== 'body') {
              waitForTourTarget(selector, { timeout: 8000, retries: 2 })
                .then((result) => {
                  if (!result.success) {
                    setTargetError(result.error || 'Target element not found');
                  }
                });
            }
          }}
          style={{
            flex: 1,
            padding: '8px 16px',
            background: '#2E7D32',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    </div>
  ) : undefined;

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
        showProgress
        showSkipButton
        disableOverlayClose
        disableCloseOnEsc
        disableScrolling={false}
        disableScrollParentFix={true}
        scrollOffset={120}
        scrollDuration={400}
        spotlightPadding={isMobile ? 5 : 10}
        spotlightClicks={false}
        styles={{
          options: {
            zIndex: 10000,
            arrowColor: '#fff',
            backgroundColor: '#fff',
            primaryColor: '#2E7D32',
            textColor: '#212529',
            overlayColor: 'rgba(0, 0, 0, 0.5)',
          },
          tooltip: {
            maxWidth: isMobile ? '95vw' : 'min(400px, 90vw)',
            width: 'auto',
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          tooltipContent: {
            padding: '16px',
          },
          buttonNext: {
            backgroundColor: '#2E7D32',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
          },
          buttonBack: {
            color: '#2E7D32',
            marginRight: '8px',
            fontSize: '14px',
          },
          buttonSkip: {
            color: '#666',
            fontSize: '14px',
          },
        }}
        floaterProps={{
          disableAnimation: false,
          offset: 15,
          disableFlip: false,
          options: {
            preventOverflow: {
              boundariesElement: 'window',
            },
          },
          styles: {
            floater: {
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
            },
          },
        }}
        tooltipComponent={targetError ? () => tooltipComponent : undefined}
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