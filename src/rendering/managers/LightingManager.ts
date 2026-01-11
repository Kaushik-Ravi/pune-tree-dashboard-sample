// src/rendering/managers/LightingManager.ts

/**
 * Lighting and shadow management
 * Handles directional lights (sun), ambient lights, and shadow configuration
 * 
 * Features:
 * - Dynamic sun position updates
 * - Real-time shadow quality adjustments
 * - Shadow camera frustum management
 * - Multiple light types support
 */

import * as THREE from 'three';
import type { SunConfig, AmbientLightConfig, ShadowQuality } from '../types/RenderConfig';
import { SHADOW_MAP_SIZES } from '../types/RenderConfig';

export class LightingManager {
  private scene: THREE.Scene;
  private directionalLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  
  // Current configurations
  private currentSunConfig: SunConfig;
  private currentAmbientConfig: AmbientLightConfig;
  private currentShadowQuality: ShadowQuality;
  
  // Shadow camera helper (for debugging)
  private shadowCameraHelper?: THREE.CameraHelper;
  
  /**
   * Initialize lighting manager
   */
  constructor(scene: THREE.Scene, initialConfig?: {
    sun?: Partial<SunConfig>;
    ambient?: Partial<AmbientLightConfig>;
    shadowQuality?: ShadowQuality;
  }) {
    this.scene = scene;
    
    // Set default configurations
    this.currentSunConfig = {
      position: initialConfig?.sun?.position || [0, 100, 100],
      intensity: initialConfig?.sun?.intensity || 1.0,
      color: initialConfig?.sun?.color || '#ffffff',
      castShadow: initialConfig?.sun?.castShadow ?? true
    };
    
    this.currentAmbientConfig = {
      intensity: initialConfig?.ambient?.intensity || 0.3,
      color: initialConfig?.ambient?.color || '#ffffff'
    };
    
    this.currentShadowQuality = initialConfig?.shadowQuality || 'high';
    
    // Create lights
    this.ambientLight = this.createAmbientLight();
    this.directionalLight = this.createDirectionalLight();
    
    // Add to scene
    this.scene.add(this.ambientLight);
    this.scene.add(this.directionalLight);
    
    console.log('✅ [LightingManager] Initialized', {
      sunPosition: this.currentSunConfig.position,
      shadowQuality: this.currentShadowQuality,
      shadowMapSize: SHADOW_MAP_SIZES[this.currentShadowQuality]
    });
  }
  
  /**
   * Create ambient light
   */
  private createAmbientLight(): THREE.AmbientLight {
    const light = new THREE.AmbientLight(
      this.currentAmbientConfig.color,
      this.currentAmbientConfig.intensity
    );
    light.name = 'ambient-light';
    return light;
  }
  
  /**
   * Create directional light (sun) with shadows
   */
  private createDirectionalLight(): THREE.DirectionalLight {
    const light = new THREE.DirectionalLight(
      this.currentSunConfig.color,
      this.currentSunConfig.intensity
    );
    
    light.name = 'directional-light-sun';
    light.position.set(...this.currentSunConfig.position);
    light.castShadow = this.currentSunConfig.castShadow;
    
    // Configure shadow properties
    this.configureShadows(light, this.currentShadowQuality);
    
    return light;
  }
  
  /**
   * Configure shadow properties for a light
   */
  private configureShadows(light: THREE.DirectionalLight, quality: ShadowQuality): void {
    const shadowMapSize = SHADOW_MAP_SIZES[quality];
    
    // Shadow map resolution
    light.shadow.mapSize.width = shadowMapSize;
    light.shadow.mapSize.height = shadowMapSize;
    
    // CRITICAL: Shadow camera must use MERCATOR UNITS, not meters!
    // We're rendering in Mercator coordinate space (0-1 for entire world)
    // For Mercator Z (altitude), 1 unit = World Circumference.
    // 600m altitude is roughly 1.5e-5 units.
    
    // Frustum Size: Needs to cover the viewable city block. 
    // INCREASED from 0.0005 to 0.002 (~8km) to ensure shadows are visible
    // at typical zoom levels (zoom 15-18 = ~1-4km viewport)
    const frustumSize = 0.002; 
    
    light.shadow.camera.left = -frustumSize;
    light.shadow.camera.right = frustumSize;
    light.shadow.camera.top = frustumSize;
    light.shadow.camera.bottom = -frustumSize;
    
    // Near/Far planes: Must be valid ranges for Mercator Z
    // Near: Close to the light source (which we place "high up" relatively)
    // Far: Must reach past the ground.
    light.shadow.camera.near = 1e-6; // Very close to light
    light.shadow.camera.far = 2.0;   // Covers entire depth range (0 to 1+)
    
    // Shadow bias (prevents shadow acne)
    light.shadow.bias = -0.000001; // Tighter bias for tighter frustum
    light.shadow.normalBias = 0.002;
    
    // Shadow radius (PCF soft shadows)
    light.shadow.radius = quality === 'ultra' ? 2 : 1;
    
    console.log(`🔧 [LightingManager] Shadow quality: ${quality} (${shadowMapSize}px), frustum: ±${frustumSize} Mercator units`);
  }
  
  /**
   * Update sun configuration
   * Allows real-time sun position and intensity changes
   */
  updateSun(config: Partial<SunConfig>): void {
    const hasChanges = 
      config.position !== undefined ||
      config.intensity !== undefined ||
      config.color !== undefined ||
      config.castShadow !== undefined;
    
    if (!hasChanges) return;
    
    // Update stored config
    this.currentSunConfig = {
      ...this.currentSunConfig,
      ...config
    };
    
    // Apply position
    if (config.position) {
      console.log('🔧 [LightingManager] Sun position:', config.position);
      this.directionalLight.position.set(...config.position);
    }
    
    // Apply intensity
    if (config.intensity !== undefined) {
      this.directionalLight.intensity = config.intensity;
    }
    
    // Apply color
    if (config.color) {
      this.directionalLight.color.setStyle(config.color);
    }
    
    // Apply shadow casting
    if (config.castShadow !== undefined) {
      this.directionalLight.castShadow = config.castShadow;
    }

    // DYNAMIC TARGET TRACKING:
    // Instead of hardcoding to Pune center, we should ideally track the camera center.
    // For now, we update the target to match the light's X/Z but at ground level (Y=0)
    // This ensures the light always points "down" relative to its new position.
    
    const lightPos = this.directionalLight.position;
    this.directionalLight.target.position.set(
        lightPos.x, 
        0, // Always look at ground level
        lightPos.z
    );
    this.directionalLight.target.updateMatrixWorld();
    
    console.log('☀️ [LightingManager] Sun updated', {
      position: this.currentSunConfig.position,
      intensity: this.currentSunConfig.intensity
    });
  }
  
  /**
   * Update ambient light configuration
   */
  updateAmbient(config: Partial<AmbientLightConfig>): void {
    if (config.intensity !== undefined) {
      this.ambientLight.intensity = config.intensity;
      this.currentAmbientConfig.intensity = config.intensity;
    }
    
    if (config.color) {
      this.ambientLight.color.setStyle(config.color);
      this.currentAmbientConfig.color = config.color;
    }
    
    console.log('💡 [LightingManager] Ambient light updated', this.currentAmbientConfig);
  }
  
  /**
   * Update shadow quality
   * Dynamically adjusts shadow map resolution
   */
  updateShadowQuality(quality: ShadowQuality): void {
    if (quality === this.currentShadowQuality) return;
    
    const oldSize = SHADOW_MAP_SIZES[this.currentShadowQuality];
    const newSize = SHADOW_MAP_SIZES[quality];
    
    // Update shadow map size
    this.directionalLight.shadow.mapSize.width = newSize;
    this.directionalLight.shadow.mapSize.height = newSize;
    
    // Dispose old shadow map to free GPU memory
    if (this.directionalLight.shadow.map) {
      this.directionalLight.shadow.map.dispose();
      this.directionalLight.shadow.map = null;
    }
    
    // Update shadow radius for quality
    this.directionalLight.shadow.radius = quality === 'ultra' ? 2 : 1;
    
    this.currentShadowQuality = quality;
    
    console.log(`🔄 [LightingManager] Shadow quality changed: ${oldSize}px → ${newSize}px`);
  }
  
  /**
   * Update shadow camera frustum to match viewport
   * Call when map bounds change
   */
  updateShadowCameraFrustum(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const size = Math.max(width, height) / 2;
    
    const camera = this.directionalLight.shadow.camera;
    camera.left = -size;
    camera.right = size;
    camera.top = size;
    camera.bottom = -size;
    camera.updateProjectionMatrix();
    
    console.log('📐 [LightingManager] Shadow camera frustum updated', { size });
  }
  
  /**
   * Enable shadow camera helper for debugging
   */
  enableShadowCameraHelper(enabled: boolean): void {
    if (enabled && !this.shadowCameraHelper) {
      this.shadowCameraHelper = new THREE.CameraHelper(this.directionalLight.shadow.camera);
      this.scene.add(this.shadowCameraHelper);
      console.log('🔍 [LightingManager] Shadow camera helper enabled');
    } else if (!enabled && this.shadowCameraHelper) {
      this.scene.remove(this.shadowCameraHelper);
      this.shadowCameraHelper.dispose();
      this.shadowCameraHelper = undefined;
      console.log('🔍 [LightingManager] Shadow camera helper disabled');
    }
  }
  
  /**
   * Update lighting system (should be called every frame)
   */
  update(): void {
    // Update shadow camera helper if enabled
    if (this.shadowCameraHelper) {
      this.shadowCameraHelper.update();
    }
  }
  
  /**
   * Get current sun configuration
   */
  getSunConfig(): SunConfig {
    return { ...this.currentSunConfig };
  }
  
  /**
   * Get current ambient light configuration
   */
  getAmbientConfig(): AmbientLightConfig {
    return { ...this.currentAmbientConfig };
  }
  
  /**
   * Get directional light reference (for advanced use)
   */
  getDirectionalLight(): THREE.DirectionalLight {
    return this.directionalLight;
  }
  
  /**
   * Get ambient light reference (for advanced use)
   */
  getAmbientLight(): THREE.AmbientLight {
    return this.ambientLight;
  }
  
  /**
   * Dispose all lighting resources
   */
  dispose(): void {
    console.log('🧹 [LightingManager] Disposing...');
    
    // Remove from scene
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);
    
    // Dispose shadow camera helper
    if (this.shadowCameraHelper) {
      this.scene.remove(this.shadowCameraHelper);
      this.shadowCameraHelper.dispose();
    }
    
    // Dispose shadow map
    if (this.directionalLight.shadow.map) {
      this.directionalLight.shadow.map.dispose();
    }
    
    console.log('✅ [LightingManager] Disposed');
  }
}
