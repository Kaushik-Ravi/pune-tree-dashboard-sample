/**
 * Central export file for React hooks
 * Provides clean imports for consumers
 */

// Rendering hooks
export { useRenderingManager } from './useRenderingManager';
export type {
  UseRenderingManagerConfig,
  UseRenderingManagerReturn,
} from './useRenderingManager';

export { usePerformanceMetrics } from './usePerformanceMetrics';
export type {
  UsePerformanceMetricsConfig,
  PerformanceHistoryEntry,
} from './usePerformanceMetrics';

// Sun position hook
export { useSunPosition, getSunTimes, isDaytime, getTimeOfDay } from './useSunPosition';
export type { SunPosition } from './useSunPosition';
