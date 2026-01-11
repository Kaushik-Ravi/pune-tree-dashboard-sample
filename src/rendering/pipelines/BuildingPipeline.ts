/**
 * BuildingPipeline - High-Performance Building Rendering System
 * 
 * Implements:
 * - Extruded building geometries from polygons
 * - Material caching for different building types
 * - Shadow casting and receiving
 * - Efficient batch rendering
 * - Height-based LOD
 * 
 * Performance target: 1,000+ buildings at 60 FPS
 */

import * as THREE from 'three';
import { BuildingData } from '../types/SceneObject';

/**
 * Building material types
 */
enum BuildingMaterialType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  INDUSTRIAL = 'industrial',
  PUBLIC = 'public',
  DEFAULT = 'default',
}

/**
 * Material configuration for building types
 */
interface BuildingMaterialConfig {
  color: number;
  roughness: number;
  metalness: number;
  emissive?: number;
  emissiveIntensity?: number;
}

const MATERIAL_CONFIGS: Record<BuildingMaterialType, BuildingMaterialConfig> = {
  [BuildingMaterialType.RESIDENTIAL]: {
    color: 0xd4a574,
    roughness: 0.9,
    metalness: 0.1,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
  },
  [BuildingMaterialType.COMMERCIAL]: {
    color: 0xa0a0a0,
    roughness: 0.3,
    metalness: 0.5,
    emissive: 0x404040,
    emissiveIntensity: 0.1,
  },
  [BuildingMaterialType.INDUSTRIAL]: {
    color: 0x808080,
    roughness: 0.8,
    metalness: 0.3,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
  },
  [BuildingMaterialType.PUBLIC]: {
    color: 0xc8b088,
    roughness: 0.6,
    metalness: 0.2,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
  },
  [BuildingMaterialType.DEFAULT]: {
    color: 0xcccccc,
    roughness: 0.7,
    metalness: 0.2,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
  },
};

/**
 * LOD thresholds for buildings
 */
const BUILDING_LOD_DISTANCE = 500; // meters

export class BuildingPipeline {
  private scene: THREE.Scene;
  private buildings: BuildingData[] = [];
  private buildingMeshes: Map<string, THREE.Mesh> = new Map();
  private materialCache: Map<BuildingMaterialType, THREE.Material> = new Map();
  private geometryCache: Map<string, THREE.ExtrudeGeometry> = new Map();

  // Batch rendering groups
  private batches: Map<BuildingMaterialType, THREE.Group> = new Map();

  // Performance tracking
  private visibleCount = 0;
  private drawCalls = 0;

  constructor(scene: THREE.Scene, _camera: THREE.Camera) {
    this.scene = scene;
    this.initializeMaterials();
  }

  /**
   * Initialize material cache
   */
  private initializeMaterials(): void {
    for (const [type, config] of Object.entries(MATERIAL_CONFIGS)) {
      const material = new THREE.MeshStandardMaterial({
        color: config.color,
        roughness: config.roughness,
        metalness: config.metalness,
        emissive: config.emissive,
        emissiveIntensity: config.emissiveIntensity,
      });
      this.materialCache.set(type as BuildingMaterialType, material);
    }
  }

  /**
   * Add buildings to the rendering pipeline
   */
  public addBuildings(buildings: BuildingData[]): void {
    console.log(`[BuildingPipeline] Adding ${buildings.length} buildings`);

    for (const building of buildings) {
      this.addBuilding(building);
    }

    console.log(`[BuildingPipeline] Total buildings: ${this.buildings.length}`);
  }

  /**
   * Add a single building
   */
  private addBuilding(building: BuildingData): void {
    try {
      // Create geometry from polygon
      const geometry = this.createBuildingGeometry(building);
      if (!geometry) {
        console.warn(`[BuildingPipeline] Failed to create geometry for building ${building.id}`);
        return;
      }

      // Get material
      const materialType = this.determineMaterialType(building);
      const material = this.materialCache.get(materialType) || 
                       this.materialCache.get(BuildingMaterialType.DEFAULT)!;

      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.buildingId = building.id;
      mesh.userData.buildingType = materialType;
      
      // SHADOW OVERLAY MODE:
      // Make buildings semi-transparent so MapLibre's native buildings show through
      // but Three.js buildings still cast shadows on ground and trees
      const transparentMaterial = (material as THREE.MeshStandardMaterial).clone();
      transparentMaterial.transparent = true;
      transparentMaterial.opacity = 0.05; // Nearly invisible, shadows-only mode
      mesh.material = transparentMaterial;
      
      // Add to scene
      this.scene.add(mesh);
      this.buildingMeshes.set(building.id, mesh);
      this.buildings.push(building);

    } catch (error) {
      console.error(`[BuildingPipeline] Error adding building ${building.id}:`, error);
    }
  }

  /**
   * Create extruded geometry from building polygon
   * 
   * CRITICAL: Vertices are in XZ plane (horizontal), extrude upward in Y axis
   * Coordinates come from geoToWorld which returns (x, altitude, z) for (lng, lat, alt)
   */
  private createBuildingGeometry(building: BuildingData): THREE.ExtrudeGeometry | null {
    // Create cache key from vertices
    const cacheKey = this.createGeometryCacheKey(building);
    
    // Check cache first
    if (this.geometryCache.has(cacheKey)) {
      return this.geometryCache.get(cacheKey)!.clone();
    }

    try {
      // Create shape from vertices in XZ plane
      const shape = new THREE.Shape();
      
      if (building.vertices.length < 3) {
        console.warn(`[BuildingPipeline] Building ${building.id} has insufficient vertices`);
        return null;
      }

      // Move to first vertex (use X and Z coordinates)
      shape.moveTo(building.vertices[0].x, building.vertices[0].z);

      // Line to remaining vertices (use X and Z coordinates)
      for (let i = 1; i < building.vertices.length; i++) {
        shape.lineTo(building.vertices[i].x, building.vertices[i].z);
      }

      // Close the shape
      shape.closePath();

      // Extrude settings - extrude upward in Y axis
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: building.height,
        bevelEnabled: false,
      };

      // Create extruded geometry (extrudes along Z by default)
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      // Rotate to stand upright: shape is in XY, extrude in Z, rotate to XZ plane with Y up
      geometry.rotateX(-Math.PI / 2);

      // Compute normals for proper lighting and shadow calculation
      geometry.computeVertexNormals();

      // Cache the geometry
      this.geometryCache.set(cacheKey, geometry);

      return geometry.clone();

    } catch (error) {
      console.error(`[BuildingPipeline] Error creating geometry for building ${building.id}:`, error);
      return null;
    }
  }

  /**
   * Create cache key from building vertices
   * Uses X and Z coordinates (horizontal plane)
   */
  private createGeometryCacheKey(building: BuildingData): string {
    // Create a simple hash from vertices and height
    const vertexStr = building.vertices
      .map((v) => `${v.x.toFixed(2)},${v.z.toFixed(2)}`)
      .join('|');
    return `${vertexStr}_${building.height.toFixed(1)}`;
  }

  /**
   * Determine material type from building properties
   */
  private determineMaterialType(building: BuildingData): BuildingMaterialType {
    // Use building type if available
    if (building.type) {
      const type = building.type.toLowerCase();
      if (type.includes('residential') || type.includes('house')) {
        return BuildingMaterialType.RESIDENTIAL;
      }
      if (type.includes('commercial') || type.includes('office') || type.includes('retail')) {
        return BuildingMaterialType.COMMERCIAL;
      }
      if (type.includes('industrial') || type.includes('warehouse')) {
        return BuildingMaterialType.INDUSTRIAL;
      }
      if (type.includes('public') || type.includes('government') || type.includes('school')) {
        return BuildingMaterialType.PUBLIC;
      }
    }

    // Fallback: use height to guess type
    if (building.height > 30) {
      return BuildingMaterialType.COMMERCIAL; // Tall = commercial
    } else if (building.height < 10) {
      return BuildingMaterialType.RESIDENTIAL; // Short = residential
    }

    return BuildingMaterialType.DEFAULT;
  }

  /**
   * Remove specific buildings by ID
   */
  public removeBuildings(buildingIds: string[]): void {
    for (const id of buildingIds) {
      const mesh = this.buildingMeshes.get(id);
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.buildingMeshes.delete(id);
      }
    }

    // Remove from data array
    const idSet = new Set(buildingIds);
    this.buildings = this.buildings.filter((b) => !idSet.has(b.id));

    console.log(`[BuildingPipeline] Removed ${buildingIds.length} buildings`);
  }

  /**
   * Clear all buildings
   */
  public clearBuildings(): void {
    console.log('[BuildingPipeline] Clearing all buildings');

    for (const mesh of this.buildingMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }

    this.buildingMeshes.clear();
    this.buildings = [];
  }

  /**
   * Update rendering based on camera position
   * Called every frame
   */
  public update(cameraPosition: THREE.Vector3): void {
    let visible = 0;
    let drawCalls = 0;

    for (const [, mesh] of this.buildingMeshes) {
      // Calculate distance to camera
      const distance = mesh.position.distanceTo(cameraPosition);

      // Simple LOD: hide buildings beyond threshold
      if (distance > BUILDING_LOD_DISTANCE) {
        if (mesh.visible) {
          mesh.visible = false;
        }
      } else {
        if (!mesh.visible) {
          mesh.visible = true;
        }
        visible++;
        drawCalls++;
      }
    }

    this.visibleCount = visible;
    this.drawCalls = drawCalls;
  }

  /**
   * Update building visibility
   */
  public setBuildingVisibility(buildingId: string, visible: boolean): void {
    const mesh = this.buildingMeshes.get(buildingId);
    if (mesh) {
      mesh.visible = visible;
    }
  }

  /**
   * Set visibility for all buildings
   */
  public setAllBuildingsVisibility(visible: boolean): void {
    for (const mesh of this.buildingMeshes.values()) {
      mesh.visible = visible;
    }
  }

  /**
   * Get current performance stats
   */
  public getStats() {
    return {
      totalBuildings: this.buildings.length,
      visibleBuildings: this.visibleCount,
      drawCalls: this.drawCalls,
      cachedGeometries: this.geometryCache.size,
      cachedMaterials: this.materialCache.size,
    };
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    console.log('[BuildingPipeline] Disposing resources');

    // Dispose meshes
    for (const mesh of this.buildingMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.buildingMeshes.clear();

    // Dispose cached geometries
    for (const geometry of this.geometryCache.values()) {
      geometry.dispose();
    }
    this.geometryCache.clear();

    // Dispose materials
    for (const material of this.materialCache.values()) {
      material.dispose();
    }
    this.materialCache.clear();

    // Clear batches
    for (const batch of this.batches.values()) {
      this.scene.remove(batch);
    }
    this.batches.clear();

    // Clear data
    this.buildings = [];
  }
}
