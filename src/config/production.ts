/**
 * Production Configuration
 * 
 * Optimized settings for production deployment.
 * Different configurations for various deployment scenarios.
 */

import type { RenderConfig } from '../rendering';

/**
 * Environment type
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Device profile
 */
export type DeviceProfile = 'desktop-high' | 'desktop-low' | 'mobile-high' | 'mobile-low';

/**
 * Production configuration by environment
 */
export const PRODUCTION_CONFIGS: Record<Environment, Partial<RenderConfig>> = {
  development: {
    shadowQuality: 'medium',
    shadowIntensity: 0.5,
    ambientIntensity: 0.3,
    enableTreeShadows: true,
    enableBuildingShadows: true,
    maxTrees: 2000,
    lodDistances: [100, 500, 1000],
    enableFrustumCulling: true,
    enableObjectPooling: true,
    targetFPS: 60,
    enablePerformanceMetrics: true,
  },

  staging: {
    shadowQuality: 'high',
    shadowIntensity: 0.5,
    ambientIntensity: 0.3,
    enableTreeShadows: true,
    enableBuildingShadows: true,
    maxTrees: 5000,
    lodDistances: [100, 500, 1000],
    enableFrustumCulling: true,
    enableObjectPooling: true,
    targetFPS: 60,
    enablePerformanceMetrics: true,
  },

  production: {
    shadowQuality: 'high',
    shadowIntensity: 0.5,
    ambientIntensity: 0.3,
    enableTreeShadows: true,
    enableBuildingShadows: true,
    maxTrees: 5000,
    lodDistances: [100, 500, 1000],
    enableFrustumCulling: true,
    enableObjectPooling: true,
    targetFPS: 60,
    enablePerformanceMetrics: false, // Disable in prod for performance
  },
};

/**
 * Device-specific configurations
 */
export const DEVICE_CONFIGS: Record<DeviceProfile, Partial<RenderConfig>> = {
  'desktop-high': {
    shadowQuality: 'ultra',
    maxTrees: 10000,
    lodDistances: [150, 600, 1200],
    targetFPS: 60,
  },

  'desktop-low': {
    shadowQuality: 'medium',
    maxTrees: 3000,
    lodDistances: [80, 400, 800],
    targetFPS: 60,
  },

  'mobile-high': {
    shadowQuality: 'medium',
    maxTrees: 1500,
    lodDistances: [60, 300, 600],
    targetFPS: 30,
  },

  'mobile-low': {
    shadowQuality: 'low',
    maxTrees: 500,
    lodDistances: [40, 200, 400],
    targetFPS: 30,
  },
};

/**
 * Detect device profile
 */
export function detectDeviceProfile(): DeviceProfile {
  // Check if mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (isMobile) {
    // Check mobile performance indicators
    const cores = navigator.hardwareConcurrency || 2;
    const memory = (navigator as any).deviceMemory || 2; // GB

    // High-end mobile: 6+ cores, 4GB+ RAM
    if (cores >= 6 && memory >= 4) {
      return 'mobile-high';
    }
    return 'mobile-low';
  }

  // Desktop detection
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory || 4; // GB

  // High-end desktop: 8+ cores, 8GB+ RAM
  if (cores >= 8 && memory >= 8) {
    return 'desktop-high';
  }

  return 'desktop-low';
}

/**
 * Get optimal configuration for current environment and device
 */
export function getOptimalConfig(env: Environment = 'production'): RenderConfig {
  const baseConfig = PRODUCTION_CONFIGS[env];
  const deviceProfile = detectDeviceProfile();
  const deviceConfig = DEVICE_CONFIGS[deviceProfile];

  console.log(`[Config] Environment: ${env}, Device: ${deviceProfile}`);

  return {
    ...baseConfig,
    ...deviceConfig,
  } as RenderConfig;
}

/**
 * Performance monitoring thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  critical: {
    fps: 20,        // Below this, show warning
    frameTime: 50,  // Above this (ms), show warning
    memory: 1024,   // MB
  },
  warning: {
    fps: 30,
    frameTime: 33.33,
    memory: 512,
  },
  good: {
    fps: 60,
    frameTime: 16.67,
    memory: 256,
  },
};

/**
 * Feature flags for production
 */
export const FEATURE_FLAGS = {
  enableShadows: true,
  enableTreeShadows: true,
  enableBuildingShadows: true,
  enablePerformanceMonitoring: false, // Disable in prod
  enableDebugMode: false,
  enableAutoRecovery: true,
  enableAdaptiveLOD: true,
  enableObjectPooling: true,
  enableWebWorkers: true,
  enableFrustumCulling: true,
};

/**
 * API endpoints for production
 */
export const API_ENDPOINTS = {
  production: {
    trees: 'https://api.pune-tree-dashboard.com/api/trees',
    buildings: 'https://api.pune-tree-dashboard.com/api/buildings',
    analytics: 'https://api.pune-tree-dashboard.com/api/analytics',
  },
  staging: {
    trees: 'https://staging.pune-tree-dashboard.com/api/trees',
    buildings: 'https://staging.pune-tree-dashboard.com/api/buildings',
    analytics: 'https://staging.pune-tree-dashboard.com/api/analytics',
  },
  development: {
    trees: 'http://localhost:3000/api/trees',
    buildings: 'http://localhost:3000/api/buildings',
    analytics: 'http://localhost:3000/api/analytics',
  },
};

/**
 * Get current environment
 */
export function getCurrentEnvironment(): Environment {
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }

  if (hostname.includes('staging')) {
    return 'staging';
  }

  return 'production';
}

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  // Tree data cache duration (ms)
  treeCacheDuration: 5 * 60 * 1000, // 5 minutes

  // Building data cache duration (ms)
  buildingCacheDuration: 30 * 60 * 1000, // 30 minutes

  // Geometry cache size (number of cached geometries)
  geometryCacheSize: 100,

  // Material cache size
  materialCacheSize: 50,

  // Enable service worker caching
  enableServiceWorker: true,
};

/**
 * Error reporting configuration
 */
export const ERROR_CONFIG = {
  // Enable error reporting to analytics
  enableErrorReporting: true,

  // Sample rate for error reporting (0-1)
  errorSampleRate: 1.0,

  // Errors to ignore (non-critical)
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],

  // Max errors before disabling system
  maxConsecutiveErrors: 5,

  // Auto-recovery enabled
  enableAutoRecovery: true,

  // Max recovery attempts
  maxRecoveryAttempts: 3,
};

/**
 * Analytics configuration
 */
export const ANALYTICS_CONFIG = {
  // Enable analytics
  enabled: true,

  // Track performance metrics
  trackPerformance: true,

  // Track user interactions
  trackInteractions: true,

  // Batch size for analytics events
  batchSize: 10,

  // Flush interval (ms)
  flushInterval: 30000, // 30 seconds

  // Sample rate for performance tracking (0-1)
  performanceSampleRate: 0.1, // 10% of users
};

/**
 * Logging configuration
 */
export const LOGGING_CONFIG = {
  // Log level: 'debug' | 'info' | 'warn' | 'error' | 'none'
  level: getCurrentEnvironment() === 'production' ? 'error' : 'info',

  // Enable console logging
  enableConsole: getCurrentEnvironment() !== 'production',

  // Enable remote logging
  enableRemote: getCurrentEnvironment() === 'production',

  // Remote logging endpoint
  remoteEndpoint: 'https://api.pune-tree-dashboard.com/api/logs',

  // Buffer size for remote logging
  bufferSize: 100,
};

/**
 * Export all configurations
 */
export default {
  PRODUCTION_CONFIGS,
  DEVICE_CONFIGS,
  PERFORMANCE_THRESHOLDS,
  FEATURE_FLAGS,
  API_ENDPOINTS,
  CACHE_CONFIG,
  ERROR_CONFIG,
  ANALYTICS_CONFIG,
  LOGGING_CONFIG,
  getOptimalConfig,
  detectDeviceProfile,
  getCurrentEnvironment,
};
