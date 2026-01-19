// src/components/tour/ModernTooltip.tsx
import React from 'react';
import { TooltipRenderProps } from 'react-joyride';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Get arrow position styles based on placement
 */
const getArrowStyles = (placement: string | undefined): React.CSSProperties => {
  const arrowSize = 12;
  const arrowColor = '#2E7D32'; // Brand green

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };

  // Determine arrow direction based on tooltip placement
  // If tooltip is on bottom, arrow points UP (at the top of tooltip)
  // If tooltip is on top, arrow points DOWN (at the bottom of tooltip)
  // If tooltip is on left, arrow points RIGHT
  // If tooltip is on right, arrow points LEFT

  if (!placement || placement === 'center') {
    return { display: 'none' };
  }

  if (placement.includes('bottom')) {
    // Tooltip below target → arrow on top pointing up
    return {
      ...baseStyle,
      top: -arrowSize,
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
      borderColor: `transparent transparent ${arrowColor} transparent`,
    };
  }

  if (placement.includes('top')) {
    // Tooltip above target → arrow on bottom pointing down
    return {
      ...baseStyle,
      bottom: -arrowSize,
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
      borderColor: `${arrowColor} transparent transparent transparent`,
    };
  }

  if (placement.includes('left')) {
    // Tooltip on left → arrow on right pointing right
    return {
      ...baseStyle,
      right: -arrowSize,
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
      borderColor: `transparent transparent transparent ${arrowColor}`,
    };
  }

  if (placement.includes('right')) {
    // Tooltip on right → arrow on left pointing left
    return {
      ...baseStyle,
      left: -arrowSize,
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
      borderColor: `transparent ${arrowColor} transparent transparent`,
    };
  }

  return { display: 'none' };
};

/**
 * Modern, mobile-friendly custom tooltip for the tour
 * Features: Brand colors, arrow indicator, responsive design
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
  const arrowStyles = getArrowStyles(placement);

  return (
    <div
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
