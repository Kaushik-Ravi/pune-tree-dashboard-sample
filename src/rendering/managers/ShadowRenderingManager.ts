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
  
  // Ground plane
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
        alpha: true,
        powerPreference: 'high-performance',
        precision: 'highp'
      });
      
      // Configure renderer
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.autoClear = false; // Don't clear MapLibre's rendering
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      
      console.log('✅ [ShadowRenderingManager] WebGL renderer initialized');
      
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
      
      // Mark as initialized
      this.isInitialized = true;
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
   */
  render(_gl: WebGLRenderingContext, matrix: number[]): void {
    if (!this.renderer || !this.scene || !this.camera || !this.isInitialized) {
      return;
    }
    
    try {
      // Start performance tracking
      this.performanceMonitor?.startFrame();
      
      // Update camera matrix from MapLibre
      const projectionMatrix = new THREE.Matrix4().fromArray(matrix);
      this.camera.projectionMatrix = projectionMatrix;
      
      // Render scene
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      
      // End performance tracking
      this.performanceMonitor?.endFrame(this.renderer, this.scene);
      
      // Increment frame counter
      this.frameCount++;
      
      // Log every 60 frames (~1 second at 60 FPS)
      if (this.frameCount % 60 === 0) {
        const metrics = this.performanceMonitor?.getMetrics();
        console.log(`🎬 Frame ${this.frameCount}:`, {
          fps: metrics?.fps,
          objects: this.sceneManager?.getTotalObjectCount()
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
   * Add trees to the scene (simplified method for React integration)
   * @param treeData Array of GeoJSON features with tree data
   */
  addTrees(treeData: any[]): void {
    if (!this.isInitialized || !this.sceneManager) {
      console.warn('⚠️ [ShadowRenderingManager] Cannot add trees - not initialized');
      return;
    }

    console.log(`🌳 [ShadowRenderingManager] Adding ${treeData.length} trees to scene`);
    
    // Clear existing trees
    this.sceneManager.clearGroup('trees');
    
    // Add each tree as a simple mesh for now
    // In production, this should use TreeRenderPipeline for instanced rendering
    let successCount = 0;
    
    treeData.forEach((feature, index) => {
      if (!feature.geometry || !feature.properties || !this.sceneManager) return;
      
      const [lng, lat] = feature.geometry.coordinates;
      const height = feature.properties.Height_m || feature.properties.height || 10;
      
      // ✅ FIX: Use proper Mercator projection from geometryBuilder
      const worldPos = geoToWorld(lng, lat, 0);
      
      // Log first few trees for debugging
      if (index < 3) {
        console.log(`🌳 Tree ${index}: [${lng.toFixed(4)}, ${lat.toFixed(4)}] → World: [${worldPos.x.toFixed(4)}, ${worldPos.y.toFixed(4)}, ${worldPos.z.toFixed(4)}]`);
      }
      
      // Create simple tree representation (cylinder for trunk, cone for canopy)
      const trunkHeight = height * 0.3;
      const canopyHeight = height * 0.7;
      
      const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      trunk.position.set(worldPos.x, trunkHeight * 0.5, worldPos.z); // Y is up in Three.js
      
      const canopyGeometry = new THREE.ConeGeometry(height * 0.3, canopyHeight, 8);
      const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x2E7D32 });
      const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
      canopy.castShadow = true;
      canopy.receiveShadow = false; // Canopy doesn't need to receive (top of tree)
      canopy.position.set(worldPos.x, trunkHeight + (canopyHeight * 0.5), worldPos.z);
      
      // Add to scene
      this.sceneManager.addToGroup('trees', trunk);
      this.sceneManager.addToGroup('trees', canopy);
      successCount++;
    });
    
    console.log(`✅ Added ${successCount} trees successfully (${successCount * 2} meshes)`);
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
