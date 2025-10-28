/**
 * ShadowErrorBoundary - Error Boundary for Shadow Rendering
 * 
 * Gracefully handles errors in the shadow rendering system.
 * Provides fallback UI and recovery options.
 * 
 * Benefits:
 * - Prevents full app crash on rendering errors
 * - Shows user-friendly error messages
 * - Allows graceful fallback to basic 3D mode
 * - Logs errors for debugging
 */

import React, { Component, type ReactNode } from 'react';

/**
 * Error boundary props
 */
export interface ShadowErrorBoundaryProps {
  /** Child components */
  children: ReactNode;
  
  /** Custom fallback UI */
  fallback?: ReactNode;
  
  /** Whether to show error details in fallback */
  showDetails?: boolean;
  
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  
  /** Callback when reset is attempted */
  onReset?: () => void;
  
  /** Enable automatic recovery attempts */
  enableAutoRecovery?: boolean;
  
  /** Max recovery attempts before giving up */
  maxRecoveryAttempts?: number;
}

/**
 * Error boundary state
 */
interface ShadowErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  recoveryAttempts: number;
}

/**
 * ShadowErrorBoundary Component
 * 
 * Usage:
 * ```tsx
 * <ShadowErrorBoundary
 *   fallback={<div>Shadow rendering unavailable</div>}
 *   onError={(error) => console.error('Shadow error:', error)}
 * >
 *   <RealisticShadowLayer map={map} />
 * </ShadowErrorBoundary>
 * ```
 */
export class ShadowErrorBoundary extends Component<
  ShadowErrorBoundaryProps,
  ShadowErrorBoundaryState
> {
  private recoveryTimer: number | null = null;

  constructor(props: ShadowErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempts: 0,
    };
  }

  /**
   * Catch errors in child components
   */
  static getDerivedStateFromError(error: Error): Partial<ShadowErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error details
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ShadowErrorBoundary] Caught error:', error);
    console.error('[ShadowErrorBoundary] Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Attempt automatic recovery if enabled
    if (this.props.enableAutoRecovery) {
      this.attemptRecovery();
    }
  }

  /**
   * Attempt to recover from error
   */
  private attemptRecovery = (): void => {
    const { maxRecoveryAttempts = 3 } = this.props;
    const { recoveryAttempts } = this.state;

    if (recoveryAttempts >= maxRecoveryAttempts) {
      console.log('[ShadowErrorBoundary] Max recovery attempts reached, giving up');
      return;
    }

    console.log(`[ShadowErrorBoundary] Attempting recovery (${recoveryAttempts + 1}/${maxRecoveryAttempts})`);

    // Wait 2 seconds before attempting recovery
    this.recoveryTimer = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        recoveryAttempts: prevState.recoveryAttempts + 1,
      }));
    }, 2000);
  };

  /**
   * Manual reset
   */
  private handleReset = (): void => {
    console.log('[ShadowErrorBoundary] Manual reset triggered');
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempts: 0,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  /**
   * Cleanup
   */
  componentWillUnmount(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }
  }

  /**
   * Render error UI or children
   */
  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails = false } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(255, 59, 48, 0.9)',
            color: 'white',
            padding: '16px',
            borderRadius: '8px',
            maxWidth: '400px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ marginRight: '8px' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Shadow Rendering Error
            </h3>
          </div>

          <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: '1.5' }}>
            The 3D shadow rendering system encountered an error. The map will continue
            to work, but shadows may not be displayed correctly.
          </p>

          {showDetails && error && (
            <details style={{ marginBottom: '12px' }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: '13px',
                  marginBottom: '8px',
                  opacity: 0.9,
                }}
              >
                Error Details
              </summary>
              <div
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <strong>Error:</strong> {error.message}
                </div>
                {errorInfo && (
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                    {errorInfo.componentStack}
                  </div>
                )}
              </div>
            </details>
          )}

          <button
            onClick={this.handleReset}
            style={{
              backgroundColor: 'white',
              color: '#ff3b30',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Retry Shadow Rendering
          </button>
        </div>
      );
    }

    return children;
  }
}

/**
 * Default export for convenience
 */
export default ShadowErrorBoundary;
