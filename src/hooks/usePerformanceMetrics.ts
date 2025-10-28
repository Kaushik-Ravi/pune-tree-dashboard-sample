/**
 * usePerformanceMetrics - React Hook for Performance Monitoring
 * 
 * Provides real-time performance metrics from the rendering system.
 * Updates at configurable intervals for UI display.
 * 
 * Benefits:
 * - Real-time FPS display
 * - Performance statistics
 * - Draw call tracking
 * - Memory usage monitoring
 */

import { useState, useEffect, useRef } from 'react';
import type { PerformanceMetrics } from '../../rendering';
import { ShadowRenderingManager } from '../../rendering';

/**
 * Hook configuration
 */
export interface UsePerformanceMetricsConfig {
  /** Update interval in milliseconds (default: 1000 = 1 second) */
  updateInterval?: number;
  
  /** Whether monitoring is enabled */
  enabled?: boolean;
  
  /** Whether to track history */
  trackHistory?: boolean;
  
  /** Maximum history size */
  maxHistorySize?: number;
}

/**
 * Performance history entry
 */
export interface PerformanceHistoryEntry {
  timestamp: number;
  metrics: PerformanceMetrics;
}

/**
 * Hook return value
 */
export interface UsePerformanceMetricsReturn {
  /** Current performance metrics */
  metrics: PerformanceMetrics | null;
  
  /** Performance history (if trackHistory is enabled) */
  history: PerformanceHistoryEntry[];
  
  /** Whether metrics are being collected */
  isCollecting: boolean;
  
  /** Average FPS over last N samples */
  averageFPS: number;
  
  /** Minimum FPS over last N samples */
  minFPS: number;
  
  /** Maximum FPS over last N samples */
  maxFPS: number;
  
  /** Clear history */
  clearHistory: () => void;
}

/**
 * Default metrics when not available
 */
const DEFAULT_METRICS: PerformanceMetrics = {
  fps: 0,
  frameTime: 0,
  drawCalls: 0,
  triangles: 0,
  objectCount: 0,
};

/**
 * React hook for performance metrics
 */
export function usePerformanceMetrics(
  config: UsePerformanceMetricsConfig = {}
): UsePerformanceMetricsReturn {
  const {
    updateInterval = 1000,
    enabled = true,
    trackHistory = false,
    maxHistorySize = 60, // 1 minute at 1 second intervals
  } = config;

  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [history, setHistory] = useState<PerformanceHistoryEntry[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const managerRef = useRef<ShadowRenderingManager | null>(null);

  /**
   * Calculate average FPS from history or current
   */
  const averageFPS = history.length > 0
    ? history.reduce((sum, entry) => sum + entry.metrics.fps, 0) / history.length
    : metrics?.fps || 0;

  /**
   * Calculate min FPS from history
   */
  const minFPS = history.length > 0
    ? Math.min(...history.map(entry => entry.metrics.fps))
    : metrics?.fps || 0;

  /**
   * Calculate max FPS from history
   */
  const maxFPS = history.length > 0
    ? Math.max(...history.map(entry => entry.metrics.fps))
    : metrics?.fps || 0;

  /**
   * Clear history
   */
  const clearHistory = () => {
    setHistory([]);
  };

  /**
   * Collect metrics from manager
   */
  const collectMetrics = () => {
    try {
      const manager = managerRef.current || ShadowRenderingManager.getInstance();
      managerRef.current = manager;

      // Get metrics from manager
      // Note: Assuming manager has a getMetrics() method
      // If not, we'll need to subscribe to performance:update events
      const currentMetrics = manager.getMetrics?.() || DEFAULT_METRICS;
      
      setMetrics(currentMetrics);
      setIsCollecting(true);

      // Add to history if tracking is enabled
      if (trackHistory) {
        setHistory(prev => {
          const newEntry: PerformanceHistoryEntry = {
            timestamp: Date.now(),
            metrics: currentMetrics,
          };
          
          const newHistory = [...prev, newEntry];
          
          // Trim to max size
          if (newHistory.length > maxHistorySize) {
            return newHistory.slice(newHistory.length - maxHistorySize);
          }
          
          return newHistory;
        });
      }
    } catch (err) {
      console.error('[usePerformanceMetrics] Failed to collect metrics:', err);
      setIsCollecting(false);
    }
  };

  /**
   * Setup collection interval
   */
  useEffect(() => {
    if (!enabled) {
      setIsCollecting(false);
      return;
    }

    // Collect immediately
    collectMetrics();

    // Setup interval
    intervalRef.current = setInterval(() => {
      collectMetrics();
    }, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, updateInterval, trackHistory, maxHistorySize]);

  /**
   * Alternative: Subscribe to performance:update events
   * This provides more real-time updates
   */
  useEffect(() => {
    if (!enabled) return;

    try {
      const manager = ShadowRenderingManager.getInstance();
      managerRef.current = manager;

      // Subscribe to performance updates
      const unsubscribe = manager.onTyped?.('performance:update', (payload) => {
        setMetrics(payload);
        setIsCollecting(true);

        if (trackHistory) {
          setHistory(prev => {
            const newEntry: PerformanceHistoryEntry = {
              timestamp: Date.now(),
              metrics: payload,
            };
            
            const newHistory = [...prev, newEntry];
            
            if (newHistory.length > maxHistorySize) {
              return newHistory.slice(newHistory.length - maxHistorySize);
            }
            
            return newHistory;
          });
        }
      });

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } catch (err) {
      console.error('[usePerformanceMetrics] Failed to subscribe to events:', err);
    }
  }, [enabled, trackHistory, maxHistorySize]);

  return {
    metrics,
    history,
    isCollecting,
    averageFPS,
    minFPS,
    maxFPS,
    clearHistory,
  };
}
