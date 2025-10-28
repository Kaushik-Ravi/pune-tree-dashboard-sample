/**
 * Optimization Module - Central Exports
 * 
 * Advanced performance optimization components:
 * - ObjectPool: Reduce GC pressure with object pooling
 * - GeometryWorker: Off-thread geometry creation
 * - AdaptiveLODManager: Dynamic quality adjustment
 */

// Object Pooling
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
} from './ObjectPool';

// Web Worker Geometry Creation
export {
  GeometryWorkerManager,
  createGeometryFromWorkerData,
  type GeometryRequest,
  type GeometryResponse,
  type TreeGeometryParams,
  type BuildingGeometryParams,
} from './GeometryWorker';

// Adaptive LOD
export {
  AdaptiveLODManager,
  QualityPreset,
  type LODStrategy,
} from './AdaptiveLODManager';
