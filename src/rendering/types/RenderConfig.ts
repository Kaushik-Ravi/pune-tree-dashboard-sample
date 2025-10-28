// src/rendering/types/RenderConfig.ts

/**
 * Configuration types for the rendering system
 * Defines all tuneable parameters for shadow rendering, performance, and quality
 */

/**
 * Shadow quality levels
 * Determines shadow map resolution (texture size)
 */
export type ShadowQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Level of Detail distances (in meters)
 * [nearDistance, midDistance, farDistance]
 */
export type LODDistances = [number, number, number];

/**
 * Main rendering configuration
 * Central configuration object for all rendering parameters
 */
export interface RenderConfig {
  /** Shadow map quality - affects texture resolution */
  shadowQuality: ShadowQuality;
  
  /** Shadow darkness/opacity (0.0 - 1.0) */
  shadowIntensity: number;
  
  /** Ambient light intensity (0.0 - 1.0) */
  ambientIntensity: number;
  
  /** Enable shadow casting from trees */
  enableTreeShadows: boolean;
  
  /** Enable shadow casting from buildings */
  enableBuildingShadows: boolean;
  
  /** Maximum number of trees to render */
  maxTrees: number;
  
  /** LOD switching distances [near, mid, far] in meters */
  lodDistances: LODDistances;
  
  /** Enable frustum culling for performance */
  enableFrustumCulling: boolean;
  
  /** Enable object pooling for memory efficiency */
  enableObjectPooling: boolean;
  
  /** Target FPS for performance monitoring */
  targetFPS: number;
  
  /** Enable performance metrics collection */
  enablePerformanceMetrics: boolean;
}

/**
 * Sun/directional light configuration
 */
export interface SunConfig {
  /** Sun position in 3D space [x, y, z] */
  position: [number, number, number];
  
  /** Light intensity (0.0 - 2.0+) */
  intensity: number;
  
  /** Light color (hex string or CSS color) */
  color: string;
  
  /** Cast shadows */
  castShadow: boolean;
}

/**
 * Ambient light configuration
 */
export interface AmbientLightConfig {
  /** Light intensity (0.0 - 1.0) */
  intensity: number;
  
  /** Light color (hex string or CSS color) */
  color: string;
}

/**
 * Performance metrics snapshot
 */
export interface PerformanceMetrics {
  /** Current frames per second */
  fps: number;
  
  /** Average frame time in milliseconds */
  frameTime: number;
  
  /** Current draw calls per frame */
  drawCalls: number;
  
  /** Number of triangles rendered */
  triangles: number;
  
  /** GPU memory usage in bytes (if available) */
  gpuMemory?: number;
  
  /** JS heap memory usage in bytes (if available) */
  jsMemory?: number;
  
  /** Number of active objects in scene */
  objectCount: number;
}

/**
 * Shadow map size configuration
 */
export const SHADOW_MAP_SIZES: Record<ShadowQuality, number> = {
  low: 512,
  medium: 1024,
  high: 2048,
  ultra: 4096
};

/**
 * Default rendering configuration
 * Optimized for balance between quality and performance
 */
export const DEFAULT_RENDER_CONFIG: RenderConfig = {
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
  enablePerformanceMetrics: true
};

/**
 * Default sun configuration
 */
export const DEFAULT_SUN_CONFIG: SunConfig = {
  position: [0, 100, 100],
  intensity: 1.0,
  color: '#ffffff',
  castShadow: true
};

/**
 * Default ambient light configuration
 */
export const DEFAULT_AMBIENT_CONFIG: AmbientLightConfig = {
  intensity: 0.3,
  color: '#ffffff'
};
