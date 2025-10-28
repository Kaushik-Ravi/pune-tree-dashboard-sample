// src/rendering/types/SceneObject.ts

/**
 * Types for objects in the Three.js scene
 * Defines data structures for trees, buildings, and terrain
 */

import type * as THREE from 'three';
import type { Feature, Point, Polygon } from 'geojson';

/**
 * Tree data from GeoJSON
 */
export interface TreeData {
  /** Unique tree identifier */
  id: string;
  
  /** Original GeoJSON feature */
  feature: Feature<Point>;
  
  /** Tree height in meters */
  height: number;
  
  /** Trunk girth in centimeters */
  girth: number;
  
  /** Canopy diameter in meters */
  canopyDiameter: number;
  
  /** Tree species/type */
  species?: string;
  
  /** World position (THREE.Vector3) */
  position: THREE.Vector3;
  
  /** Three.js object reference */
  object?: THREE.Object3D;
  
  /** Is currently visible (frustum culling) */
  visible?: boolean;
  
  /** Distance from camera (for LOD) */
  distance?: number;
}

/**
 * Building data from GeoJSON
 */
export interface BuildingData {
  /** Unique building identifier */
  id: string;
  
  /** Original GeoJSON feature */
  feature: Feature<Polygon>;
  
  /** Building height in meters */
  height: number;
  
  /** Building type (residential, commercial, etc.) */
  type?: string;
  
  /** World positions for vertices (Vector3 format) */
  vertices: Array<THREE.Vector3>;
  
  /** Three.js object reference */
  object?: THREE.Object3D;
  
  /** Is currently visible (frustum culling) */
  visible?: boolean;
}

/**
 * Terrain/ground data
 */
export interface TerrainData {
  /** Bounds of terrain [minX, minY, maxX, maxY] */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  
  /** Elevation data (2D grid for DEM) */
  elevationGrid?: number[][];
  
  /** Elevation data (1D array alternative) */
  elevations?: Float32Array;
  
  /** Width of elevation grid */
  gridWidth?: number;
  
  /** Height of elevation grid */
  gridHeight?: number;
  
  /** Three.js mesh reference */
  mesh?: THREE.Mesh;
}

/**
 * LOD level type
 */
export type LODLevel = 'high' | 'medium' | 'low';

/**
 * LOD group data
 */
export interface LODGroup {
  /** LOD level identifier */
  level: LODLevel;
  
  /** Trees at this LOD level */
  trees: TreeData[];
  
  /** Mesh for this LOD level (trunk mesh, canopy in userData) */
  mesh: THREE.InstancedMesh | null;
}

/**
 * Instanced tree group (for performance)
 */
export interface InstancedTreeGroup {
  /** Tree type/species identifier */
  species: string;
  
  /** Individual tree data */
  trees: TreeData[];
  
  /** LOD groups (high/medium/low detail) */
  lodGroups: {
    high: LODGroup;
    medium: LODGroup;
    low: LODGroup;
  };
}

/**
 * Bounds for frustum culling
 */
export interface CullingBounds {
  /** Bounding sphere */
  boundingSphere?: {
    center: THREE.Vector3;
    radius: number;
  };
  
  /** Bounding box */
  boundingBox?: {
    min: THREE.Vector3;
    max: THREE.Vector3;
  };
}

/**
 * Camera frustum for culling
 */
export interface CameraFrustum {
  /** Frustum planes (simplified - normal and constant only) */
  planes: Array<{
    normal: THREE.Vector3;
    constant: number;
  }>;
}
