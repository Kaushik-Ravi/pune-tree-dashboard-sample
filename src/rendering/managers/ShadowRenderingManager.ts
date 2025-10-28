// src/rendering/managers/ShadowRenderingManager.ts

/**
 * Central rendering manager - Singleton pattern
 * Orchestrates all rendering operations, manages lifecycle, and coordinates sub-managers
 * 
 * Inspired by:
 * - Cesium's Scene architecture
 * - Three.js WebGLRenderer patterns
 * - Deck.gl's LayerManager
 * 
 * Responsibilities:
 * - Owns the Three.js renderer and scene
 * - Manages MapLibre custom layer lifecycle
 * - Provides event-driven update mechanism
 * - Coordinates sub-managers (scene, lighting, performance)
 * - Handles resource cleanup
 */

import * as THREE from 'three';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MercatorCoordinate } from 'maplibre-gl';

import type { 
  RenderConfig, 
  SunConfig, 
  PerformanceMetrics
} from '../types/RenderConfig';
import { DEFAULT_RENDER_CONFIG, DEFAULT_SUN_CONFIG } from '../types/RenderConfig';
import type { 
  RenderingEventType, 
  RenderingEventPayloads, 
  RenderingEventListener 
} from '../types/Events';

import { SceneGraphManager } from './SceneGraphManager';
import { LightingManager } from './LightingManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { createGroundPlane, geoToWorld } from '../../utils/geometryBuilder';

// Import Phase 2 Pipelines (Advanced Rendering)
import { TreeRenderPipeline } from '../pipelines/TreeRenderPipeline';
import { BuildingPipeline } from '../pipelines/BuildingPipeline';
import { TerrainPipeline } from '../pipelines/TerrainPipeline';

/**
 * Singleton rendering manager
 */
export class ShadowRenderingManager {
  private static instance: ShadowRenderingManager | null = null;
  
  // Core Three.js objects
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private map: MapLibreMap | null = null;
  
  // Configuration
  private config: RenderConfig = DEFAULT_RENDER_CONFIG;
  private sunConfig: SunConfig = DEFAULT_SUN_CONFIG;
  
  // State
  private isInitialized = false;
  private frameCount = 0;
  
  // Event listeners
  private eventListeners: Map<string, Set<Function>> = new Map();
  
  // Sub-managers
  private sceneManager: SceneGraphManager | null = null;
  private lightingManager: LightingManager | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  
  // Phase 2 Pipelines (Advanced Rendering)
  private treeRenderPipeline: TreeRenderPipeline | null = null;
  private buildingPipeline: BuildingPipeline | null = null;
  private terrainPipeline: TerrainPipeline | null = null;
  
  // Ground plane (legacy - will be replaced by TerrainPipeline)
  private groundPlane: THREE.Mesh | null = null;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    console.log('🎬 [ShadowRenderingManager] Instance created');
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): ShadowRenderingManager {
    if (!ShadowRenderingManager.instance) {
      ShadowRenderingManager.instance = new ShadowRenderingManager();
    }
    return ShadowRenderingManager.instance;
  }
  
  /**
   * Initialize the rendering system
   * Called once when MapLibre custom layer is added
   */
  async initialize(map: MapLibreMap, gl: WebGLRenderingContext): Promise<void> {
    if (this.isInitialized) {
      console.warn('⚠️ [ShadowRenderingManager] Already initialized');
      return;
    }
    
    console.log('🚀 [ShadowRenderingManager] Initializing...');
    
    try {
      this.map = map;
      
      // Initialize Three.js renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
        alpha: true, // CRITICAL: Transparent background to show MapLibre beneath
        powerPreference: 'high-performance',
        precision: 'highp'
      });
      
      // Configure renderer for shadow overlay mode
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.autoClear = false; // CRITICAL: Don't clear MapLibre's rendering
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      
      // CRITICAL: Set clear color to fully transparent
      this.renderer.setClearColor(0x000000, 0.0);
      
      console.log('✅ [ShadowRenderingManager] WebGL renderer initialized (transparent overlay mode)');
      
      // Initialize scene
      this.scene = new THREE.Scene();
      this.scene.background = null; // Transparent
      
      // Initialize camera (will be synced with MapLibre)
      this.camera = new THREE.Camera();
      
      console.log('✅ [ShadowRenderingManager] Scene and camera initialized');
      
      // Initialize sub-managers
      this.sceneManager = new SceneGraphManager(this.scene);
      this.lightingManager = new LightingManager(this.scene, {
        sun: this.sunConfig,
        shadowQuality: this.config.shadowQuality
      });
      
      this.performanceMonitor = new PerformanceMonitor({
        onMetricsUpdate: (metrics) => this.emitTyped('performance:update', { metrics }),
        onPerformanceWarning: (message) => this.emitTyped('warning', { message, context: 'performance' })
      });
      
      console.log('✅ [ShadowRenderingManager] Sub-managers initialized');
      
      // Initialize Phase 2 Pipelines (Advanced Rendering)
      console.log('🔧 [ShadowRenderingManager] Initializing rendering pipelines...');
      
      this.terrainPipeline = new TerrainPipeline(this.scene, this.camera);
      console.log('✅ [ShadowRenderingManager] TerrainPipeline initialized (ground plane created)');
      
      this.buildingPipeline = new BuildingPipeline(this.scene, this.camera);
      console.log('✅ [ShadowRenderingManager] BuildingPipeline initialized');
      
      this.treeRenderPipeline = new TreeRenderPipeline(this.scene, this.camera);
      console.log('✅ [ShadowRenderingManager] TreeRenderPipeline initialized (instanced rendering)');
      
      console.log('✅ [ShadowRenderingManager] All pipelines initialized');
      
      // Mark as initialized
      this.isInitialized = true;
      // Expose manager for debugging (ALWAYS expose for shadow debugging)
      try {
        (window as any).__shadowRenderingManager = this;
        console.log('🔎 [ShadowRenderingManager] Exposed as window.__shadowRenderingManager for debugging');
      } catch (e) {
        console.warn('⚠️ Could not expose shadow manager to window:', e);
      }
      this.emitTyped('initialized', undefined);
      
      console.log('✅ [ShadowRenderingManager] Initialization complete', {
        shadowQuality: this.config.shadowQuality,
        maxTrees: this.config.maxTrees,
        enableCulling: this.config.enableFrustumCulling
      });
      
    } catch (error) {
      console.error('❌ [ShadowRenderingManager] Initialization failed:', error);
      this.emitTyped('error', { 
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'initialization'
      });
      throw error;
    }
  }
  
  /**
   * Main render loop
   * Called every frame by MapLibre
   * 
   * CRITICAL: Properly synchronize Three.js camera with MapLibre's projection matrix
   * to ensure objects appear in the correct viewport position
   */
  render(_gl: WebGLRenderingContext, matrix: number[]): void {
    if (!this.renderer || !this.scene || !this.camera || !this.isInitialized) {
      return;
    }
    
    try {
      // Start performance tracking
      this.performanceMonitor?.startFrame();
      
      // CRITICAL: Sync Three.js camera with MapLibre's projection matrix
      // This ensures Three.js objects appear correctly in MapLibre's viewport
      const projectionMatrix = new THREE.Matrix4().fromArray(matrix);
      this.camera.projectionMatrix = projectionMatrix;
      
      // IMPORTANT: Set camera matrix mode to manual to prevent Three.js from overwriting
      this.camera.projectionMatrixInverse.copy(projectionMatrix).invert();
      
      // Update camera world matrix for accurate frustum culling and shadow casting
      this.camera.updateMatrixWorld(true);
      
      // Extract camera position for pipeline updates
      const cameraPosition = new THREE.Vector3();
      cameraPosition.setFromMatrixPosition(this.camera.matrixWorld);
      
      // Update all rendering pipelines (Phase 2 Integration)
      this.terrainPipeline?.update(cameraPosition);
      this.buildingPipeline?.update(cameraPosition);
      this.treeRenderPipeline?.update(cameraPosition);
      
      // Render scene with proper state management
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      
      // End performance tracking
      this.performanceMonitor?.endFrame(this.renderer, this.scene);
      
      // Increment frame counter
      this.frameCount++;
      
      // Log every 120 frames (~2 seconds at 60 FPS) for debugging
      if (this.frameCount % 120 === 0) {
        const metrics = this.performanceMonitor?.getMetrics();
        console.log(`🎬 [ShadowRenderingManager] Frame ${this.frameCount}:`, {
          fps: metrics?.fps.toFixed(1),
          objects: this.sceneManager?.getTotalObjectCount(),
          children: this.scene.children.length
        });
      }
      
      // Request next frame
      if (this.map) {
        this.map.triggerRepaint();
      }
      
    } catch (error) {
      console.error('❌ [ShadowRenderingManager] Render error:', error);
      this.emitTyped('error', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'render'
      });
    }
  }
  
  /**
   * Update rendering configuration
   */
  updateConfig(partial: Partial<RenderConfig>): void {
    if (!this.isInitialized) {
      console.warn('⚠️ [ShadowRenderingManager] Not initialized, queueing config update');
      this.config = { ...this.config, ...partial };
      return;
    }
    
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...partial };
    
    // Apply shadow quality change
    if (partial.shadowQuality && partial.shadowQuality !== oldConfig.shadowQuality) {
      this.lightingManager?.updateShadowQuality(partial.shadowQuality);
    }
    
    // Apply ambient intensity change
    if (partial.ambientIntensity !== undefined && partial.ambientIntensity !== oldConfig.ambientIntensity) {
      this.lightingManager?.updateAmbient({ intensity: partial.ambientIntensity });
    }
    
    // Log significant changes
    if (partial.shadowQuality || partial.maxTrees || partial.enableFrustumCulling) {
      console.log('🔧 [ShadowRenderingManager] Config updated:', {
        shadowQuality: this.config.shadowQuality,
        maxTrees: this.config.maxTrees,
        culling: this.config.enableFrustumCulling
      });
    }
    
    this.emitTyped('config:changed', { config: this.config });
  }
  
  /**
   * Update sun position and intensity
   */
  updateSun(config: Partial<SunConfig>): void {
    if (!this.isInitialized) {
      this.sunConfig = { ...this.sunConfig, ...config };
      return;
    }
    
    this.sunConfig = { ...this.sunConfig, ...config };
    this.lightingManager?.updateSun(config);
    
    this.emitTyped('sun:updated', { sun: this.sunConfig });
  }
  
  /**
   * Update or create ground plane
   */
  updateGroundPlane(bounds: { sw: [number, number]; ne: [number, number] }): void {
    if (!this.isInitialized || !this.sceneManager) return;
    
    // Remove old ground plane
    if (this.groundPlane) {
      this.sceneManager.removeFromGroup('terrain', this.groundPlane);
      this.groundPlane.geometry.dispose();
      if (this.groundPlane.material instanceof THREE.Material) {
        this.groundPlane.material.dispose();
      }
      this.groundPlane = null;
    }
    
    // Create new ground plane
    this.groundPlane = createGroundPlane(bounds, {
      color: '#f0f0f0',
      receiveShadow: true
    });
    
    if (this.groundPlane) {
      this.sceneManager.addToGroup('terrain', this.groundPlane);
      
      console.log('🟩 [ShadowRenderingManager] Ground plane updated');
      this.emitTyped('terrain:updated', { vertices: 4 });
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): RenderConfig {
    return { ...this.config };
  }
  
  /**
   * Get current sun configuration
   */
  getSunConfig(): SunConfig {
    return { ...this.sunConfig };
  }
  
  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics | undefined {
    return this.performanceMonitor?.getMetrics();
  }
  
  /**
   * Get scene manager (for advanced use)
   */
  getSceneManager(): SceneGraphManager | null {
    return this.sceneManager;
  }
  
  /**
   * Get lighting manager (for advanced use)
   */
  getLightingManager(): LightingManager | null {
    return this.lightingManager;
  }
  
  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Type-safe event emitter
   */
  private emitTyped<T extends RenderingEventType>(
    event: T,
    payload: RenderingEventPayloads[T]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(payload));
    }
  }
  
  /**
   * Type-safe event listener
   */
  onTyped<T extends RenderingEventType>(
    event: T,
    listener: RenderingEventListener<T>
  ): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
    return this;
  }
  
  /**
   * Type-safe event listener (once)
   */
  onceTyped<T extends RenderingEventType>(
    event: T,
    listener: RenderingEventListener<T>
  ): this {
    const onceWrapper = (payload: RenderingEventPayloads[T]) => {
      listener(payload);
      this.offTyped(event, onceWrapper as RenderingEventListener<T>);
    };
    return this.onTyped(event, onceWrapper as RenderingEventListener<T>);
  }
  
  /**
   * Remove event listener
   */
  offTyped<T extends RenderingEventType>(
    event: T,
    listener: RenderingEventListener<T>
  ): this {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
  }
  
  /**
   * Add trees to the scene using Phase 2 TreeRenderPipeline
   * Uses advanced instanced rendering for optimal performance
   * @param treeData Array of GeoJSON features with tree data
   */
  addTrees(treeData: any[]): void {
    if (!this.isInitialized || !this.treeRenderPipeline) {
      console.warn('⚠️ [ShadowRenderingManager] Cannot add trees - not initialized');
      return;
    }

    console.log(`🌳 [ShadowRenderingManager] Adding ${treeData.length} trees using TreeRenderPipeline`);
    
    // Transform GeoJSON features to TreeData format for pipeline
    const transformedTrees = treeData.map((feature, index) => {
      if (!feature.geometry || !feature.properties) return null;
      
      const [lng, lat] = feature.geometry.coordinates;
      const height = feature.properties.Height_m || feature.properties.height_m || 10;
      const species = feature.properties.botanical_name || feature.properties.common_name || 'default';
      
      // Convert geo coordinates to Mercator world position
      const worldPos = geoToWorld(lng, lat, 0);
      
      // CRITICAL: Get the scale factor to convert meters to Mercator units at this latitude
      // fromLngLat with NO altitude parameter (undefined) gives ground-level reference
      const mercatorRef = MercatorCoordinate.fromLngLat([lng, lat]);
      const mercatorScale = mercatorRef.meterInMercatorCoordinateUnits();
      
      // Log first few trees for debugging
      if (index < 3) {
        console.log(`🌳 Tree ${index}: [${lng.toFixed(4)}, ${lat.toFixed(4)}] → World: [${worldPos.x.toFixed(8)}, ${worldPos.y.toFixed(8)}, ${worldPos.z.toFixed(8)}], height: ${height}m, scale: ${mercatorScale.toExponential(3)}`);
      }
      
      return {
        id: feature.properties.id?.toString() || `tree-${index}`,
        position: worldPos,
        height: height * mercatorScale,  // Scale height from meters to Mercator units
        species: species,
        visible: true
      };
    }).filter(tree => tree !== null);
    
    // Use TreeRenderPipeline for instanced rendering (Phase 2)
    this.treeRenderPipeline.clearTrees();
    this.treeRenderPipeline.addTrees(transformedTrees as any[]);
    
    const stats = this.treeRenderPipeline.getStats();
    console.log(`✅ TreeRenderPipeline: ${stats.totalTrees} trees added, ${stats.instancedGroups} instanced groups created`);
    console.log(`📊 Performance: Draw calls will be ~${stats.instancedGroups * 2} (trunk + canopy per species)`);
  }
  
  /**
   * Add buildings to the scene using Phase 2 BuildingPipeline
   * @param buildingData Array of building data with geometry
   */
  addBuildings(buildingData: any[]): void {
    if (!this.isInitialized || !this.buildingPipeline) {
      console.warn('⚠️ [ShadowRenderingManager] Cannot add buildings - not initialized');
      return;
    }

    console.log(`🏢 [ShadowRenderingManager] Adding ${buildingData.length} buildings using BuildingPipeline`);
    
    // Transform data to BuildingData format with Mercator scaling
    const transformedBuildings = buildingData.map((building, index) => {
      // Get the scale factor for the first vertex (all vertices should be roughly the same location)
      // fromLngLat with NO altitude parameter gives ground-level reference for correct scale
      const firstV = building.vertices?.[0];
      const mercatorRef = firstV ? MercatorCoordinate.fromLngLat([firstV.lng, firstV.lat]) : null;
      const mercatorScale = mercatorRef ? mercatorRef.meterInMercatorCoordinateUnits() : 1e-6; // fallback
      
      // Convert vertices from geo to Mercator world coordinates
      const worldVertices = building.vertices?.map((v: any) => {
        const worldPos = geoToWorld(v.lng, v.lat, 0);
        // Use the unified X,Y,Z from geoToWorld (X east, Y altitude, Z north)
        return new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
      }) || [];
      
      // Debug first few buildings
      if (index < 2) {
        console.log(`🏢 Building ${index}:`, {
          id: building.id,
          vertices: worldVertices.length,
          height: building.height,
          heightScaled: (building.height * mercatorScale).toExponential(3),
          firstVertex: worldVertices[0],
          scale: mercatorScale.toExponential(3)
        });
      }
      
      return {
        id: building.id || `building-${index}`,
        vertices: worldVertices,
        height: (building.height || 15) * mercatorScale,  // Scale height from meters to Mercator units
        type: building.type || 'default',
        feature: null as any,
      };
    });
    
    // Use BuildingPipeline (Phase 2)
    this.buildingPipeline.clearBuildings();
    this.buildingPipeline.addBuildings(transformedBuildings);
    
    const stats = this.buildingPipeline.getStats();
    console.log(`✅ BuildingPipeline: ${stats.totalBuildings} buildings added, ${stats.cachedGeometries} geometries cached`);
  }
  
  /**
   * Dispose all resources
   */
  dispose(): void {
    if (!this.isInitialized) return;
    
    console.log('🧹 [ShadowRenderingManager] Disposing...');
    
    try {
      // Dispose sub-managers
      this.sceneManager?.dispose();
      this.lightingManager?.dispose();
      this.performanceMonitor?.dispose();
      
      // Dispose Phase 2 Pipelines
      console.log('🧹 [ShadowRenderingManager] Disposing rendering pipelines...');
      this.treeRenderPipeline?.dispose();
      this.buildingPipeline?.dispose();
      this.terrainPipeline?.dispose();
      
      // Dispose ground plane
      if (this.groundPlane) {
        this.groundPlane.geometry.dispose();
        if (this.groundPlane.material instanceof THREE.Material) {
          this.groundPlane.material.dispose();
        }
      }
      
      // Dispose renderer
      this.renderer?.dispose();
      
      // Clear references
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.map = null;
      this.sceneManager = null;
      this.lightingManager = null;
      this.performanceMonitor = null;
      this.treeRenderPipeline = null;
      this.buildingPipeline = null;
      this.terrainPipeline = null;
      this.groundPlane = null;
      this.performanceMonitor = null;
      this.groundPlane = null;
      
      // Reset state
      this.isInitialized = false;
      this.frameCount = 0;
      
      this.emitTyped('disposed', undefined);
      
      console.log('✅ [ShadowRenderingManager] Disposed successfully');
      
    } catch (error) {
      console.error('❌ [ShadowRenderingManager] Disposal error:', error);
      this.emitTyped('error', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'disposal'
      });
    }
  }
  
  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (ShadowRenderingManager.instance) {
      ShadowRenderingManager.instance.dispose();
      ShadowRenderingManager.instance = null;
    }
  }
}
