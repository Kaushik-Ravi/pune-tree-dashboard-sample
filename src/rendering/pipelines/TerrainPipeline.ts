/**
 * TerrainPipeline - Ground and Terrain Rendering System
 * 
 * Implements:
 * - Dynamic ground plane that follows camera
 * - DEM (Digital Elevation Model) support for realistic terrain
 * - Shadow receiving surface
 * - Texture mapping for realistic ground appearance
 * - LOD for terrain tiles
 * 
 * Performance target: Seamless terrain at 60 FPS
 */

import * as THREE from 'three';
import { TerrainData } from '../types/SceneObject';

/**
 * Ground material configuration
 */
interface GroundMaterialConfig {
  color: number;
  roughness: number;
  metalness: number;
}

const GROUND_MATERIAL_CONFIG: GroundMaterialConfig = {
  color: 0x6b8e23, // Olive green for ground
  roughness: 0.95,
  metalness: 0.0,
};

/**
 * Terrain tile for LOD system
 */
interface TerrainTile {
  id: string;
  mesh: THREE.Mesh;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  lodLevel: number;
}

/**
 * Terrain LOD configuration
 */
const TERRAIN_LOD_LEVELS = [
  { distance: 100, resolution: 128 },  // High detail
  { distance: 500, resolution: 64 },   // Medium detail
  { distance: 2000, resolution: 32 },  // Low detail
];

export class TerrainPipeline {
  private scene: THREE.Scene;
  
  // Ground plane
  private groundPlane: THREE.Mesh | null = null;
  private groundMaterial: THREE.MeshStandardMaterial;
  
  // Terrain tiles (for DEM support)
  private terrainTiles: Map<string, TerrainTile> = new Map();
  private terrainData: TerrainData | null = null;
  
  // Configuration - IMPORTANT: Using Mercator coordinate units (0-1 for entire world)
  // At Pune latitude (~18.5°), 1 meter ≈ 2.6e-8 Mercator units
  // So 10km ground plane = 10000m × 2.6e-8 ≈ 0.00026 Mercator units
  // For visibility, we use a much larger plane in Mercator space: 0.01 units ≈ 400km at equator
  private groundSize = 0.01; // 0.01 Mercator units (~400km at equator, ~380km at Pune)
  private groundSegments = 100; // Grid resolution

  constructor(scene: THREE.Scene, _camera: THREE.Camera) {
    this.scene = scene;
    
    // Initialize ground material
    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: GROUND_MATERIAL_CONFIG.color,
      roughness: GROUND_MATERIAL_CONFIG.roughness,
      metalness: GROUND_MATERIAL_CONFIG.metalness,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
    });
    
    // Create initial ground plane
    this.createGroundPlane();
  }

  /**
   * Create or update the ground plane
   */
  private createGroundPlane(): void {
    // Remove existing ground plane
    if (this.groundPlane) {
      this.scene.remove(this.groundPlane);
      this.groundPlane.geometry.dispose();
    }

    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(
      this.groundSize,
      this.groundSize,
      this.groundSegments,
      this.groundSegments
    );

    // Rotate to be horizontal
    geometry.rotateX(-Math.PI / 2);

    // Create mesh
    this.groundPlane = new THREE.Mesh(geometry, this.groundMaterial);
    this.groundPlane.receiveShadow = true;
    this.groundPlane.castShadow = false;
    this.groundPlane.position.y = 0; // Ground level
    this.groundPlane.userData.isGroundPlane = true;

    // Add to scene
    this.scene.add(this.groundPlane);

    console.log('[TerrainPipeline] Ground plane created');
  }

  /**
   * Update ground plane position to follow camera
   * This creates illusion of infinite terrain
   */
  public updateGroundPosition(cameraPosition: THREE.Vector3): void {
    if (!this.groundPlane) return;

    // Snap ground plane to camera position (rounded to avoid jittering)
    const snapSize = this.groundSize / 10; // Snap every 1km
    this.groundPlane.position.x = Math.floor(cameraPosition.x / snapSize) * snapSize;
    this.groundPlane.position.z = Math.floor(cameraPosition.z / snapSize) * snapSize;
  }

  /**
   * Load terrain data (DEM - Digital Elevation Model)
   */
  public loadTerrainData(terrainData: TerrainData): void {
    console.log('[TerrainPipeline] Loading terrain data');
    this.terrainData = terrainData;

    // Create terrain tiles from elevation data
    this.createTerrainTiles();
  }

  /**
   * Create terrain tiles from elevation data
   */
  private createTerrainTiles(): void {
    if (!this.terrainData || !this.terrainData.elevationGrid) {
      console.warn('[TerrainPipeline] No elevation data available');
      return;
    }

    // Clear existing tiles
    this.clearTerrainTiles();

    // For now, create a single tile covering the entire terrain
    // In production, this would be divided into multiple tiles for LOD
    const tile = this.createTerrainTile(
      'main',
      this.terrainData.bounds,
      this.terrainData.elevationGrid,
      0 // LOD level
    );

    if (tile) {
      this.terrainTiles.set(tile.id, tile);
      this.scene.add(tile.mesh);
      console.log('[TerrainPipeline] Terrain tile created');
    }
  }

  /**
   * Create a single terrain tile from elevation data
   */
  private createTerrainTile(
    id: string,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    elevationGrid: number[][],
    lodLevel: number
  ): TerrainTile | null {
    try {
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      
      // Get resolution for this LOD level
      const lodConfig = TERRAIN_LOD_LEVELS[lodLevel] || TERRAIN_LOD_LEVELS[0];
      const resolution = lodConfig.resolution;

      // Create plane geometry
      const geometry = new THREE.PlaneGeometry(
        width,
        height,
        resolution,
        resolution
      );

      // Apply elevation data to vertices
      const vertices = geometry.attributes.position.array as Float32Array;
      const gridWidth = elevationGrid[0]?.length || 1;
      const gridHeight = elevationGrid.length;

      for (let i = 0; i < vertices.length; i += 3) {
        // Get grid coordinates
        const x = (vertices[i] - bounds.minX) / width;
        const y = (vertices[i + 1] - bounds.minY) / height;

        // Sample elevation grid
        const gridX = Math.floor(x * (gridWidth - 1));
        const gridY = Math.floor(y * (gridHeight - 1));

        if (gridY >= 0 && gridY < gridHeight && gridX >= 0 && gridX < gridWidth) {
          vertices[i + 2] = elevationGrid[gridY][gridX]; // Z coordinate = elevation
        }
      }

      // Update geometry
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();

      // Rotate to be horizontal
      geometry.rotateX(-Math.PI / 2);

      // Create mesh
      const mesh = new THREE.Mesh(geometry, this.groundMaterial);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.position.set(
        (bounds.minX + bounds.maxX) / 2,
        0,
        (bounds.minY + bounds.maxY) / 2
      );
      mesh.userData.terrainTile = true;

      return {
        id,
        mesh,
        bounds,
        lodLevel,
      };

    } catch (error) {
      console.error('[TerrainPipeline] Error creating terrain tile:', error);
      return null;
    }
  }

  /**
   * Update terrain LOD based on camera distance
   */
  public update(cameraPosition: THREE.Vector3): void {
    // Update ground plane position
    this.updateGroundPosition(cameraPosition);

    // Update terrain tile visibility based on LOD
    for (const [, tile] of this.terrainTiles) {
      // Calculate distance to tile center
      const tileCenter = new THREE.Vector3(
        (tile.bounds.minX + tile.bounds.maxX) / 2,
        0,
        (tile.bounds.minY + tile.bounds.maxY) / 2
      );
      const distance = cameraPosition.distanceTo(tileCenter);

      // Determine appropriate LOD level (currently unused, for future expansion)
      // const lodConfig = TERRAIN_LOD_LEVELS.find((cfg) => distance < cfg.distance);
      
      // For now, just show/hide based on max distance
      tile.mesh.visible = distance < TERRAIN_LOD_LEVELS[TERRAIN_LOD_LEVELS.length - 1].distance;
    }
  }

  /**
   * Clear all terrain tiles
   */
  private clearTerrainTiles(): void {
    for (const tile of this.terrainTiles.values()) {
      this.scene.remove(tile.mesh);
      tile.mesh.geometry.dispose();
    }
    this.terrainTiles.clear();
  }

  /**
   * Set ground color
   */
  public setGroundColor(color: number): void {
    this.groundMaterial.color.setHex(color);
  }

  /**
   * Set ground material properties
   */
  public setGroundMaterial(config: Partial<GroundMaterialConfig>): void {
    if (config.color !== undefined) {
      this.groundMaterial.color.setHex(config.color);
    }
    if (config.roughness !== undefined) {
      this.groundMaterial.roughness = config.roughness;
    }
    if (config.metalness !== undefined) {
      this.groundMaterial.metalness = config.metalness;
    }
  }

  /**
   * Set ground plane visibility
   */
  public setGroundVisible(visible: boolean): void {
    if (this.groundPlane) {
      this.groundPlane.visible = visible;
    }
  }

  /**
   * Set terrain tiles visibility
   */
  public setTerrainVisible(visible: boolean): void {
    for (const tile of this.terrainTiles.values()) {
      tile.mesh.visible = visible;
    }
  }

  /**
   * Update ground plane bounds
   */
  public updateGroundBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    // Update ground size to encompass bounds
    const maxDimension = Math.max(width, height);
    this.groundSize = maxDimension * 2; // Add padding
    
    // Recreate ground plane with new size
    this.createGroundPlane();
    
    console.log(`[TerrainPipeline] Ground bounds updated: ${this.groundSize}m`);
  }

  /**
   * Get current stats
   */
  public getStats() {
    return {
      groundPlaneSize: this.groundSize,
      terrainTiles: this.terrainTiles.size,
      hasTerrainData: this.terrainData !== null,
    };
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    console.log('[TerrainPipeline] Disposing resources');

    // Dispose ground plane
    if (this.groundPlane) {
      this.scene.remove(this.groundPlane);
      this.groundPlane.geometry.dispose();
      this.groundPlane = null;
    }

    // Dispose ground material
    this.groundMaterial.dispose();

    // Dispose terrain tiles
    this.clearTerrainTiles();

    // Clear terrain data
    this.terrainData = null;
  }
}
