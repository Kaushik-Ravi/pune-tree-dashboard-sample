// src/rendering/index.ts

/**
 * Central export file for the rendering subsystem
 * Provides clean imports for consumers
 */

// Managers
export { ShadowRenderingManager } from './managers/ShadowRenderingManager';
export { SceneGraphManager } from './managers/SceneGraphManager';
export type { SceneGroupType, GroupStats } from './managers/SceneGraphManager';
export { LightingManager } from './managers/LightingManager';
export { PerformanceMonitor } from './managers/PerformanceMonitor';

// Types
export type {
  RenderConfig,
  SunConfig,
  AmbientLightConfig,
  PerformanceMetrics,
  ShadowQuality,
  LODDistances
} from './types/RenderConfig';

export {
  SHADOW_MAP_SIZES,
  DEFAULT_RENDER_CONFIG,
  DEFAULT_SUN_CONFIG,
  DEFAULT_AMBIENT_CONFIG
} from './types/RenderConfig';

export type {
  RenderingEventType,
  RenderingEventPayloads,
  RenderingEventListener,
  RenderingEventEmitter
} from './types/Events';

export type {
  TreeData,
  BuildingData,
  TerrainData,
  LODLevel,
  InstancedTreeGroup,
  CullingBounds,
  CameraFrustum
} from './types/SceneObject';

// Pipelines
export { TreeRenderPipeline } from './pipelines/TreeRenderPipeline';
export { BuildingPipeline } from './pipelines/BuildingPipeline';
export { TerrainPipeline } from './pipelines/TerrainPipeline';
export { CullingPipeline, type CullingConfig } from './pipelines/CullingPipeline';

// Optimization
export {
  ObjectPool,
  Vector3Pool,
  Matrix4Pool,
  QuaternionPool,
  ColorPool,
  GeometryPool,
  MaterialPool,
  PoolManager,
  type IPoolable,
  type PoolConfig,
  type PoolStats,
} from './optimization/ObjectPool';

export {
  GeometryWorkerManager,
  createGeometryFromWorkerData,
  type GeometryRequest,
  type GeometryResponse,
  type TreeGeometryParams,
  type BuildingGeometryParams,
} from './optimization/GeometryWorker';

export {
  AdaptiveLODManager,
  QualityPreset,
  type LODStrategy,
} from './optimization/AdaptiveLODManager';
