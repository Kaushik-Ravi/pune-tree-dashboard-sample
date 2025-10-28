/**
 * Analytics & Monitoring System
 * 
 * Tracks performance, errors, and user interactions
 * for production monitoring and optimization.
 */

import type { PerformanceMetrics } from '../rendering';
import { ANALYTICS_CONFIG, ERROR_CONFIG, getCurrentEnvironment } from '../config/production';

/**
 * Event types for analytics
 */
export type AnalyticsEventType =
  | 'shadow_initialized'
  | 'shadow_error'
  | 'shadow_disposed'
  | 'performance_critical'
  | 'performance_warning'
  | 'user_interaction'
  | 'config_changed'
  | 'quality_adjusted';

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: number;
  data: Record<string, any>;
  sessionId: string;
  userId?: string;
  deviceInfo: DeviceInfo;
}

/**
 * Device information
 */
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  cores: number;
  memory?: number; // GB
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  isMobile: boolean;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  timestamp: number;
  metrics: PerformanceMetrics;
  duration: number; // milliseconds since last report
  sessionId: string;
}

/**
 * Error report
 */
export interface ErrorReport {
  timestamp: number;
  error: Error;
  errorInfo?: any;
  stack?: string;
  context: Record<string, any>;
  sessionId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Analytics & Monitoring Manager
 */
export class AnalyticsManager {
  private static instance: AnalyticsManager | null = null;
  
  private sessionId: string;
  private userId?: string;
  private eventBuffer: AnalyticsEvent[] = [];
  private performanceBuffer: PerformanceReport[] = [];
  private errorBuffer: ErrorReport[] = [];
  private flushInterval: number | null = null;
  private enabled: boolean;
  private deviceInfo: DeviceInfo;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.enabled = ANALYTICS_CONFIG.enabled;
    this.deviceInfo = this.collectDeviceInfo();
    
    if (this.enabled) {
      this.startFlushInterval();
    }

    console.log(`[Analytics] Initialized (Session: ${this.sessionId})`);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AnalyticsManager {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager();
    }
    return AnalyticsManager.instance;
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
    console.log(`[Analytics] User ID set: ${userId}`);
  }

  /**
   * Track event
   */
  trackEvent(type: AnalyticsEventType, data: Record<string, any> = {}): void {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      type,
      timestamp: Date.now(),
      data,
      sessionId: this.sessionId,
      userId: this.userId,
      deviceInfo: this.deviceInfo,
    };

    this.eventBuffer.push(event);

    // Log in development
    if (getCurrentEnvironment() !== 'production') {
      console.log(`[Analytics] Event: ${type}`, data);
    }

    // Flush if buffer is full
    if (this.eventBuffer.length >= ANALYTICS_CONFIG.batchSize) {
      this.flush();
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metrics: PerformanceMetrics, duration: number = 0): void {
    if (!this.enabled || !ANALYTICS_CONFIG.trackPerformance) return;

    // Sample based on configuration
    if (Math.random() > ANALYTICS_CONFIG.performanceSampleRate) return;

    const report: PerformanceReport = {
      timestamp: Date.now(),
      metrics,
      duration,
      sessionId: this.sessionId,
    };

    this.performanceBuffer.push(report);

    // Check for performance issues
    this.checkPerformanceThresholds(metrics);

    // Keep buffer size manageable
    if (this.performanceBuffer.length > 100) {
      this.performanceBuffer.shift();
    }
  }

  /**
   * Track error
   */
  trackError(error: Error, context: Record<string, any> = {}, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    if (!this.enabled || !ERROR_CONFIG.enableErrorReporting) return;

    // Check if error should be ignored
    const errorMessage = error.message || String(error);
    if (ERROR_CONFIG.ignoreErrors.some(ignore => errorMessage.includes(ignore))) {
      return;
    }

    const report: ErrorReport = {
      timestamp: Date.now(),
      error,
      stack: error.stack,
      context: {
        ...context,
        url: window.location.href,
        environment: getCurrentEnvironment(),
      },
      sessionId: this.sessionId,
      severity,
    };

    this.errorBuffer.push(report);

    // Log error
    console.error(`[Analytics] Error tracked:`, error, context);

    // Send critical errors immediately
    if (severity === 'critical') {
      this.flushErrors();
    }

    // Track as event
    this.trackEvent('shadow_error', {
      message: errorMessage,
      stack: error.stack?.split('\n')[0],
      severity,
      ...context,
    });
  }

  /**
   * Get session summary
   */
  getSessionSummary(): {
    sessionId: string;
    userId?: string;
    duration: number;
    eventsCount: number;
    performanceReports: number;
    errors: number;
    averageFPS: number;
    deviceInfo: DeviceInfo;
  } {
    const avgFPS = this.performanceBuffer.length > 0
      ? this.performanceBuffer.reduce((sum, r) => sum + r.metrics.fps, 0) / this.performanceBuffer.length
      : 0;

    return {
      sessionId: this.sessionId,
      userId: this.userId,
      duration: Date.now() - parseInt(this.sessionId.split('-')[0]),
      eventsCount: this.eventBuffer.length,
      performanceReports: this.performanceBuffer.length,
      errors: this.errorBuffer.length,
      averageFPS: avgFPS,
      deviceInfo: this.deviceInfo,
    };
  }

  /**
   * Check performance thresholds and track issues
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const { fps, frameTime } = metrics;

    // Critical performance
    if (fps < 20 || frameTime > 50) {
      this.trackEvent('performance_critical', {
        fps,
        frameTime,
        drawCalls: metrics.drawCalls,
        objectCount: metrics.objectCount,
      });
    }
    // Warning performance
    else if (fps < 30 || frameTime > 33.33) {
      this.trackEvent('performance_warning', {
        fps,
        frameTime,
        drawCalls: metrics.drawCalls,
        objectCount: metrics.objectCount,
      });
    }
  }

  /**
   * Flush all buffers
   */
  async flush(): Promise<void> {
    await Promise.all([
      this.flushEvents(),
      this.flushPerformance(),
      this.flushErrors(),
    ]);
  }

  /**
   * Flush events to server
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.sendToAnalytics('events', events);
    } catch (error) {
      console.error('[Analytics] Failed to flush events:', error);
      // Put events back in buffer
      this.eventBuffer.unshift(...events);
    }
  }

  /**
   * Flush performance reports
   */
  private async flushPerformance(): Promise<void> {
    if (this.performanceBuffer.length === 0) return;

    const reports = [...this.performanceBuffer];
    this.performanceBuffer = [];

    try {
      await this.sendToAnalytics('performance', reports);
    } catch (error) {
      console.error('[Analytics] Failed to flush performance:', error);
    }
  }

  /**
   * Flush error reports
   */
  private async flushErrors(): Promise<void> {
    if (this.errorBuffer.length === 0) return;

    const errors = [...this.errorBuffer];
    this.errorBuffer = [];

    try {
      await this.sendToAnalytics('errors', errors);
    } catch (error) {
      console.error('[Analytics] Failed to flush errors:', error);
      // Put errors back in buffer
      this.errorBuffer.unshift(...errors);
    }
  }

  /**
   * Send data to analytics endpoint
   */
  private async sendToAnalytics(type: string, data: any[]): Promise<void> {
    // In development, just log
    if (getCurrentEnvironment() === 'development') {
      console.log(`[Analytics] Would send ${type}:`, data);
      return;
    }

    // Send to analytics API
    const endpoint = `https://api.pune-tree-dashboard.com/api/analytics/${type}`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          userId: this.userId,
          timestamp: Date.now(),
          data,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.warn(`[Analytics] Failed to send ${type}:`, error);
    }
  }

  /**
   * Start periodic flush
   */
  private startFlushInterval(): void {
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, ANALYTICS_CONFIG.flushInterval);
  }

  /**
   * Stop periodic flush
   */
  private stopFlushInterval(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Collect device information
   */
  private collectDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      cores: navigator.hardwareConcurrency || 4,
      memory: (navigator as any).deviceMemory,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    };
  }

  /**
   * Cleanup and flush before page unload
   */
  dispose(): void {
    this.stopFlushInterval();
    this.flush(); // Final flush
    console.log('[Analytics] Disposed');
  }
}

/**
 * Initialize analytics on page load
 */
export function initializeAnalytics(): AnalyticsManager {
  const analytics = AnalyticsManager.getInstance();

  // Flush before page unload
  window.addEventListener('beforeunload', () => {
    analytics.flush();
  });

  // Track visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      analytics.flush();
    }
  });

  return analytics;
}

/**
 * Convenience exports
 */
export const analytics = AnalyticsManager.getInstance();
export default AnalyticsManager;
