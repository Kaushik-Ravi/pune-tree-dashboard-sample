// src/components/tour/ModernTooltip.tsx
import React, { useEffect, useState, useRef } from 'react';
import { TooltipRenderProps } from 'react-joyride';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Calculate arrow position and direction based on tooltip and target positions
 */
interface ArrowPosition {
  styles: React.CSSProperties;
  visible: boolean;
}

const calculateArrowPosition = (
  tooltipRect: DOMRect | null,
  targetRect: DOMRect | null,
  placement: string | undefined
): ArrowPosition => {
  const arrowSize = 14;
  const arrowColor = '#2E7D32'; // Brand green

  if (!tooltipRect || !targetRect || !placement || placement === 'center') {
    return { styles: { display: 'none' }, visible: false };
  }

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    zIndex: 1,
  };

  // Calculate where target center is relative to tooltip
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  // Determine arrow position based on placement
  if (placement.includes('bottom') || placement.includes('top')) {
    // Horizontal arrow positioning - calculate where target is horizontally
    const relativeX = targetCenterX - tooltipRect.left;
    const clampedX = Math.max(30, Math.min(relativeX, tooltipRect.width - 30));

    if (placement.includes('bottom')) {
      // Tooltip below target → arrow on top pointing up
      return {
        styles: {
          ...baseStyle,
          top: -arrowSize,
          left: clampedX,
          transform: 'translateX(-50%)',
          borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
          borderColor: `transparent transparent ${arrowColor} transparent`,
        },
        visible: true,
      };
    } else {
      // Tooltip above target → arrow on bottom pointing down
      return {
        styles: {
          ...baseStyle,
          bottom: -arrowSize,
          left: clampedX,
          transform: 'translateX(-50%)',
          borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
          borderColor: `${arrowColor} transparent transparent transparent`,
        },
        visible: true,
      };
    }
  }

  if (placement.includes('left') || placement.includes('right')) {
    // Vertical arrow positioning - calculate where target is vertically
    const relativeY = targetCenterY - tooltipRect.top;
    const clampedY = Math.max(30, Math.min(relativeY, tooltipRect.height - 30));

    if (placement.includes('left')) {
      // Tooltip on left → arrow on right pointing right toward target
      return {
        styles: {
          ...baseStyle,
          right: -arrowSize,
          top: clampedY,
          transform: 'translateY(-50%)',
          borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
          borderColor: `transparent transparent transparent ${arrowColor}`,
        },
        visible: true,
      };
    } else {
      // Tooltip on right → arrow on left pointing left toward target
      return {
        styles: {
          ...baseStyle,
          left: -arrowSize,
          top: clampedY,
          transform: 'translateY(-50%)',
          borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
          borderColor: `transparent ${arrowColor} transparent transparent`,
        },
        visible: true,
      };
    }
  }

  return { styles: { display: 'none' }, visible: false };
};

/**
 * Modern, mobile-friendly custom tooltip for the tour
 * Features: Brand colors, dynamic arrow pointing to target, responsive design
 */
const ModernTooltip: React.FC<TooltipRenderProps> = ({
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  skipProps,
  isLastStep,
  size,
}) => {
  const isMobile = window.innerWidth < 768;
  const placement = step.placement as string;
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [arrowPosition, setArrowPosition] = useState<ArrowPosition>({ styles: { display: 'none' }, visible: false });

  // Calculate arrow position after tooltip renders
  useEffect(() => {
    const updateArrowPosition = () => {
      const tooltipEl = tooltipRef.current;
      const targetSelector = step.target as string;

      if (tooltipEl && targetSelector && targetSelector !== 'body') {
        const targetEl = document.querySelector(targetSelector);
        if (targetEl) {
          const tooltipRect = tooltipEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();
          setArrowPosition(calculateArrowPosition(tooltipRect, targetRect, placement));
        }
      } else {
        setArrowPosition({ styles: { display: 'none' }, visible: false });
      }
    };

    // Update on mount and after a small delay for positioning to settle
    updateArrowPosition();
    const timer = setTimeout(updateArrowPosition, 100);

    return () => clearTimeout(timer);
  }, [step.target, placement]);

  const arrowStyles = arrowPosition.styles;

  return (
    <div
      ref={tooltipRef}
      {...tooltipProps}
      className="modern-tour-tooltip"
      style={{
        position: 'relative',
        maxWidth: isMobile ? 'calc(100vw - 40px)' : '400px',
        width: isMobile ? 'calc(100vw - 40px)' : 'auto',
        padding: 0,
        margin: isMobile ? '10px' : '8px',
        background: 'transparent',
        border: 'none',
        overflow: 'visible',
      }}
    >
      {/* Arrow pointing to target */}
      <div style={arrowStyles} />

      {/* Main tooltip card */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(12px)',
          borderRadius: isMobile ? '16px' : '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Header with progress and close button */}
        <div
          style={{
            background: 'linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)',
            padding: isMobile ? '14px 16px' : '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1
          }}>
            <div style={{
              fontSize: isMobile ? '13px' : '12px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.95)',
              letterSpacing: '0.5px',
            }}>
              Step {index + 1} of {size}
            </div>
            <div style={{
              flex: 1,
              height: '4px',
              background: 'rgba(255, 255, 255, 0.25)',
              borderRadius: '2px',
              overflow: 'hidden',
              maxWidth: isMobile ? '120px' : '150px',
            }}>
              <div
                style={{
                  height: '100%',
                  background: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '2px',
                  width: `${((index + 1) / size) * 100}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
          <button
            {...closeProps}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label="Close tour"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: isMobile ? '20px' : '24px',
          }}
        >
          {step.title && (
            <div
              style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '700',
                color: '#212529',
                marginBottom: '12px',
                lineHeight: '1.3',
              }}
            >
              {step.title}
            </div>
          )}
          <div
            style={{
              fontSize: isMobile ? '15px' : '16px',
              color: '#495057',
              lineHeight: '1.6',
              marginBottom: 0,
            }}
          >
            {step.content}
          </div>
        </div>

        {/* Footer with navigation buttons */}
        <div
          style={{
            padding: isMobile ? '14px 20px' : '16px 24px',
            background: 'rgba(248, 249, 250, 0.8)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* Left side: Skip button */}
          <div>
            {!isLastStep && (
              <button
                {...skipProps}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6c757d',
                  cursor: 'pointer',
                  padding: isMobile ? '8px 12px' : '8px 16px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.color = '#495057';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#6c757d';
                }}
              >
                Skip Tour
              </button>
            )}
          </div>

          {/* Right side: Navigation buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {index > 0 && (
              <button
                {...backProps}
                style={{
                  background: 'white',
                  border: '1.5px solid #2E7D32',
                  color: '#2E7D32',
                  cursor: 'pointer',
                  padding: isMobile ? '10px 16px' : '10px 20px',
                  fontSize: isMobile ? '14px' : '15px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(46, 125, 50, 0.05)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                }}
              >
                <ChevronLeft size={16} />
                {!isMobile && 'Back'}
              </button>
            )}
            <button
              {...primaryProps}
              style={{
                background: 'linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: isMobile ? '10px 20px' : '10px 24px',
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: '600',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)',
                minWidth: isMobile ? '100px' : '120px',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(46, 125, 50, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(46, 125, 50, 0.3)';
              }}
            >
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernTooltip;
