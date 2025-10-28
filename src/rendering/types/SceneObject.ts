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
  
  /** World position [x, y, z] */
  position: [number, number, number];
  
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
  /** Original GeoJSON feature */
  feature: Feature<Polygon>;
  
  /** Building height in meters */
  height: number;
  
  /** Building type (residential, commercial, etc.) */
  type?: string;
  
  /** World positions for vertices */
  vertices: Array<[number, number, number]>;
  
  /** Three.js object reference */
  object?: THREE.Object3D;
  
  /** Is currently visible (frustum culling) */
  visible?: boolean;
}

/**
 * Terrain/ground data
 */
export interface TerrainData {
  /** Bounds of terrain [swLng, swLat, neLng, neLat] */
  bounds: [number, number, number, number];
  
  /** Elevation data (optional, for DEM) */
  elevations?: Float32Array;
  
  /** Width of elevation grid */
  gridWidth?: number;
  
  /** Height of elevation grid */
  gridHeight?: number;
  
  /** Three.js mesh reference */
  mesh?: THREE.Mesh;
}

/**
 * LOD level definition
 */
export interface LODLevel {
  /** Distance threshold in meters */
  distance: number;
  
  /** Geometry for this LOD level */
  geometry: THREE.BufferGeometry;
  
  /** Material for this LOD level */
  material: THREE.Material;
}

/**
 * Instanced tree group (for performance)
 */
export interface InstancedTreeGroup {
  /** Tree type/species identifier */
  type: string;
  
  /** Number of instances */
  count: number;
  
  /** Instanced mesh */
  instancedMesh: THREE.InstancedMesh;
  
  /** Individual tree data */
  trees: TreeData[];
  
  /** Transform matrices for each instance */
  matrices: THREE.Matrix4[];
}

/**
 * Bounds for frustum culling
 */
export interface CullingBounds {
  /** Minimum x coordinate */
  minX: number;
  
  /** Maximum x coordinate */
  maxX: number;
  
  /** Minimum y coordinate */
  minY: number;
  
  /** Maximum y coordinate */
  maxY: number;
  
  /** Minimum z coordinate */
  minZ: number;
  
  /** Maximum z coordinate */
  maxZ: number;
}

/**
 * Camera frustum for culling
 */
export interface CameraFrustum {
  /** Frustum planes */
  planes: THREE.Plane[];
  
  /** Camera position */
  position: THREE.Vector3;
  
  /** View distance */
  far: number;
}
