/**
 * Configuration Export Index
 */

export {
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
} from './production';

export type { Environment, DeviceProfile } from './production';
