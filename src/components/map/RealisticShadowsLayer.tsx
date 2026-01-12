/**
 * RealisticShadowsLayer - Production-grade shadow rendering for MapLibre
 * 
 * Features:
 * - MapLibre Custom Layer with Three.js integration
 * - Progressive loading (viewport-based, zoom-based LOD)
 * - Dynamic sun position from LightAndShadowControl
 * - Handles 1.79M trees + all buildings efficiently
 * - Quality presets (low/medium/high)
 * 
 * Architecture:
 * - Uses CustomLayerInterface to share WebGL context with MapLibre
 * - Loads only visible buildings/trees based on viewport bounds
 * - Implements zoom-based limits (800-8000 entities like ThreeDTreesLayer)
 * - Debounces fetches to avoid request storms
 * - Unloads off-screen geometry to manage memory
 */

import * as THREE from 'three';
import type { Map as MapLibreMap, CustomLayerInterface } from 'maplibre-gl';
import { MercatorCoordinate } from 'maplibre-gl';
import axios from 'axios';
import type { LightConfig } from '../sidebar/tabs/LightAndShadowControl';
import type { ShadowQuality } from '../sidebar/tabs/MapLayers';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

interface ShadowLayerOptions {
  id: string;
  lightConfig: LightConfig | null;
  shadowQuality: ShadowQuality;
  showTreeShadows: boolean;
  showBuildingShadows: boolean;
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Production-quality shadow rendering layer
 * Implements MapLibre's CustomLayerInterface for deep WebGL integration
 */
export class RealisticShadowsLayer implements CustomLayerInterface {
  id: string;
  type = 'custom' as const;
  renderingMode = '3d' as const; // Share depth buffer with MapLibre

  private map!: MapLibreMap;
  private camera!: THREE.Camera;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private light!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private ground!: THREE.Mesh;
  
  // Geometry groups
  private buildingGroup!: THREE.Group;
  private treeGroup!: THREE.Group;
  
  // State
  private options: ShadowLayerOptions;
  private currentBounds: { sw: [number, number]; ne: [number, number] } | null = null;
  private currentZoom: number = 0;
  private fetchDebounceTimer: number | null = null;
  
  // Performance tracking
  private buildingCount: number = 0;
  private treeCount: number = 0;

  constructor(options: ShadowLayerOptions) {
    this.id = options.id;
    this.options = options;
  }

  /**
   * Called when layer is added to map
   * Initialize Three.js scene using MapLibre's WebGL context
   */
  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    try {
      this.map = map;
      console.log('🎬 [RealisticShadows] Initializing shadow system...');

      // Create camera (will be synced with MapLibre's camera)
      this.camera = new THREE.PerspectiveCamera();

      // Create scene
      this.scene = new THREE.Scene();

      // Create renderer using MapLibre's WebGL context
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl as WebGL2RenderingContext,
        antialias: true,
      });
      this.renderer.autoClear = false; // Don't clear MapLibre's render

      // Configure shadows based on quality
      this.configureShadows();

      // Setup lighting
      this.setupLighting();

    // Create ground plane to receive shadows
    this.setupGround();

    // Create geometry groups
    this.buildingGroup = new THREE.Group();
    this.buildingGroup.name = 'buildings';
    this.scene.add(this.buildingGroup);

    this.treeGroup = new THREE.Group();
    this.treeGroup.name = 'trees';
    this.scene.add(this.treeGroup);

      console.log('✅ [RealisticShadows] Shadow system initialized');
      
      // Initial load
      this.updateShadowGeometry();
    } catch (error) {
      console.error('❌ [RealisticShadows] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Configure shadow map quality based on settings
   */
  private configureShadows(): void {
    const qualitySettings = {
      low: { mapSize: 1024, bias: -0.0001 },
      medium: { mapSize: 2048, bias: -0.00005 },
      high: { mapSize: 4096, bias: -0.00001 },
      ultra: { mapSize: 4096, bias: -0.00001 }, // Same as high for compatibility
    };

    const quality = this.options.shadowQuality as keyof typeof qualitySettings;
    const settings = qualitySettings[quality] || qualitySettings.high;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
    
    console.log(`🎨 [RealisticShadows] Quality: ${this.options.shadowQuality} (${settings.mapSize}x${settings.mapSize})`);
  }

  /**
   * Setup directional light for sun
   */
  private setupLighting(): void {
    // Directional light (sun)
    this.light = new THREE.DirectionalLight(0xffffff, 1.5);
    this.light.castShadow = true;
    
    // Configure shadow camera (coverage area)
    const shadowCameraSize = 500; // meters
    this.light.shadow.camera.left = -shadowCameraSize;
    this.light.shadow.camera.right = shadowCameraSize;
    this.light.shadow.camera.top = shadowCameraSize;
    this.light.shadow.camera.bottom = -shadowCameraSize;
    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 2000;
    
    // Shadow map size based on quality
    const qualitySettings: Record<string, number> = {
      low: 1024,
      medium: 2048,
      high: 4096,
      ultra: 4096, // Same as high
    };
    const mapSize = qualitySettings[this.options.shadowQuality] || 4096;
    this.light.shadow.mapSize.width = mapSize;
    this.light.shadow.mapSize.height = mapSize;
    this.light.shadow.bias = -0.00005;

    this.scene.add(this.light);
    this.scene.add(this.light.target);

    // Ambient light for base visibility
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(this.ambientLight);

    // Update light from config
    this.updateLighting();
  }

  /**
   * Update light position from LightConfig (sun position)
   */
  private updateLighting(): void {
    if (!this.options.lightConfig) return;

    const { directional, ambientIntensity } = this.options.lightConfig;
    
    // Update directional light (sun)
    if (directional.position) {
      const [radial, azimuthDeg, polarDeg] = directional.position;
      
      // Convert spherical to Cartesian
      const azimuth = (azimuthDeg * Math.PI) / 180;
      const polar = (polarDeg * Math.PI) / 180;
      
      const distance = radial * 500; // Scale up for better shadows
      const x = distance * Math.sin(polar) * Math.cos(azimuth);
      const y = distance * Math.cos(polar);
      const z = distance * Math.sin(polar) * Math.sin(azimuth);
      
      this.light.position.set(x, y, z);
      this.light.intensity = directional.intensity * 1.5;
    }

    // Update ambient light
    this.ambientLight.intensity = ambientIntensity;
  }

  /**
   * Setup ground plane to receive shadows
   */
  private setupGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(20000, 20000);
    const groundMaterial = new THREE.ShadowMaterial({
      opacity: 0.5, // Shadow darkness
      transparent: true,
    });

    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2; // Lay flat
    this.ground.receiveShadow = true;
    this.ground.position.y = 0;
    
    this.scene.add(this.ground);
  }

  /**
   * Update shadow geometry based on current viewport
   * Implements progressive loading with debouncing
   */
  private updateShadowGeometry(): void {
    // Clear existing debounce timer
    if (this.fetchDebounceTimer !== null) {
      clearTimeout(this.fetchDebounceTimer);
    }

    // Debounce: wait 300ms after last call
    this.fetchDebounceTimer = window.setTimeout(() => {
      this.fetchAndBuildGeometry();
    }, 300);
  }

  /**
   * Fetch and build shadow-casting geometry
   */
  private async fetchAndBuildGeometry(): Promise<void> {
    const zoom = this.map.getZoom();
    const bounds = this.map.getBounds();
    
    // Only load at zoom 14+
    if (zoom < 14) {
      this.clearGeometry();
      return;
    }

    // Store current state
    this.currentZoom = zoom;
    this.currentBounds = {
      sw: [bounds.getWest(), bounds.getSouth()],
      ne: [bounds.getEast(), bounds.getNorth()],
    };

    this.options.onLoadingChange?.(true);

    try {
      // Load buildings and trees in parallel
      await Promise.all([
        this.options.showBuildingShadows ? this.loadBuildings() : Promise.resolve(),
        this.options.showTreeShadows ? this.loadTrees() : Promise.resolve(),
      ]);
    } catch (error) {
      console.error('❌ [RealisticShadows] Error loading geometry:', error);
    } finally {
      this.options.onLoadingChange?.(false);
    }

    console.log(`📊 [RealisticShadows] Loaded: ${this.buildingCount} buildings, ${this.treeCount} trees`);
  }

  /**
   * Load buildings from MapLibre as shadow casters
   */
  private async loadBuildings(): Promise<void> {
    // Clear existing buildings
    while (this.buildingGroup.children.length > 0) {
      const mesh = this.buildingGroup.children[0] as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.buildingGroup.remove(mesh);
    }

    try {
      // Query visible buildings
      const features = this.map.queryRenderedFeatures(undefined, {
        layers: ['3d-buildings'], // From MapView.tsx
      });

      console.log(`🏢 [RealisticShadows] Found ${features.length} building features`);

      let addedCount = 0;
      const maxBuildings = this.getMaxEntitiesForZoom();

      for (const feature of features.slice(0, maxBuildings)) {
        if (!feature.geometry || feature.geometry.type !== 'Polygon') continue;

        const height = feature.properties?.render_height || 
                      feature.properties?.height || 
                      15;

        if (height <= 0) continue;

        const coords = (feature.geometry as any).coordinates[0];
        if (!coords || coords.length < 3) continue;

        // Calculate center and dimensions
        const lngs = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

        // Convert to scene coordinates
        const centerPos = this.lngLatToScenePosition(centerLng, centerLat, height / 2);
        const minPos = this.lngLatToScenePosition(Math.min(...lngs), Math.min(...lats), 0);
        const maxPos = this.lngLatToScenePosition(Math.max(...lngs), Math.max(...lats), 0);

        const width = Math.abs(maxPos.x - minPos.x);
        const depth = Math.abs(maxPos.z - minPos.z);

        if (width <= 0 || depth <= 0 || width > 500 || depth > 500) continue;

        // Create invisible shadow-casting box
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
          color: 0x808080,
          transparent: true,
          opacity: 0, // Completely invisible
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(centerPos);
        mesh.castShadow = true;
        mesh.receiveShadow = false;

        this.buildingGroup.add(mesh);
        addedCount++;
      }

      this.buildingCount = addedCount;
      console.log(`✅ [RealisticShadows] Added ${addedCount} building shadow casters`);
    } catch (error) {
      console.error('❌ [RealisticShadows] Error loading buildings:', error);
    }
  }

  /**
   * Load trees from API as shadow casters
   */
  private async loadTrees(): Promise<void> {
    // Clear existing trees
    while (this.treeGroup.children.length > 0) {
      const mesh = this.treeGroup.children[0] as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.treeGroup.remove(mesh);
    }

    if (!this.currentBounds) return;

    try {
      const maxTrees = this.getMaxEntitiesForZoom();
      
      const response = await axios.post(`${API_BASE_URL}/api/trees-in-bounds`, {
        bounds: this.currentBounds,
        limit: maxTrees,
      });

      const treeData = response.data;
      if (!treeData || !treeData.features) return;

      console.log(`🌳 [RealisticShadows] Found ${treeData.features.length} trees`);

      let addedCount = 0;

      for (const tree of treeData.features) {
        const { height_m, girth_cm, canopy_dia_m } = tree.properties;
        const [lng, lat] = tree.geometry.coordinates;

        if (!height_m || height_m <= 0) continue;

        // Trunk
        const trunkRadius = Math.max(0.15, (girth_cm / 100) / (2 * Math.PI));
        const trunkHeight = Math.min(height_m * 0.3, 4);
        const trunkPos = this.lngLatToScenePosition(lng, lat, trunkHeight / 2);

        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({
          color: 0x8B4513,
          transparent: true,
          opacity: 0, // Invisible
        });

        const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunkMesh.position.copy(trunkPos);
        trunkMesh.castShadow = true;
        trunkMesh.receiveShadow = true;
        this.treeGroup.add(trunkMesh);

        // Canopy (sphere approximation)
        const canopyRadius = canopy_dia_m / 2;
        const canopyHeight = height_m - trunkHeight;
        const canopyPos = this.lngLatToScenePosition(lng, lat, trunkHeight + canopyHeight / 2);

        const canopyGeometry = new THREE.SphereGeometry(canopyRadius, 8, 8);
        const canopyMaterial = new THREE.MeshStandardMaterial({
          color: 0x2E7D32,
          transparent: true,
          opacity: 0, // Invisible
        });

        const canopyMesh = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopyMesh.position.copy(canopyPos);
        canopyMesh.castShadow = true;
        canopyMesh.receiveShadow = true;
        this.treeGroup.add(canopyMesh);

        addedCount++;
      }

      this.treeCount = addedCount;
      console.log(`✅ [RealisticShadows] Added ${addedCount} tree shadow casters`);
    } catch (error) {
      console.error('❌ [RealisticShadows] Error loading trees:', error);
    }
  }

  /**
   * Get max entities based on zoom (same pattern as ThreeDTreesLayer)
   */
  private getMaxEntitiesForZoom(): number {
    const zoom = this.currentZoom;
    if (zoom >= 18) return 8000;
    if (zoom >= 17) return 5000;
    if (zoom >= 16) return 3000;
    if (zoom >= 15) return 1500;
    return 800;
  }

  /**
   * Convert lng/lat to Three.js scene coordinates
   */
  private lngLatToScenePosition(lng: number, lat: number, altitude: number = 0): THREE.Vector3 {
    const centerLngLat = this.map.getCenter();
    
    const pointMerc = MercatorCoordinate.fromLngLat([lng, lat], altitude);
    const centerMerc = MercatorCoordinate.fromLngLat([centerLngLat.lng, centerLngLat.lat], 0);
    
    const scale = pointMerc.meterInMercatorCoordinateUnits();
    
    const x = (pointMerc.x - centerMerc.x) / scale;
    const z = -(pointMerc.y - centerMerc.y) / scale;
    const y = altitude / scale;
    
    return new THREE.Vector3(x, y, z);
  }

  /**
   * Clear all geometry
   */
  private clearGeometry(): void {
    while (this.buildingGroup.children.length > 0) {
      const mesh = this.buildingGroup.children[0] as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.buildingGroup.remove(mesh);
    }

    while (this.treeGroup.children.length > 0) {
      const mesh = this.treeGroup.children[0] as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.treeGroup.remove(mesh);
    }

    this.buildingCount = 0;
    this.treeCount = 0;
  }

  /**
   * Sync Three.js camera with MapLibre camera
   */
  private syncCamera(): void {
    const transform = this.map.transform;
    const fov = transform.fov ? transform.fov * (180 / Math.PI) : 28;
    
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = fov;
      this.camera.aspect = transform.width / transform.height;
      this.camera.updateProjectionMatrix();
    }

    // Position and rotation
    const center = this.map.getCenter();
    const centerMerc = MercatorCoordinate.fromLngLat([center.lng, center.lat], 0);
    const scale = centerMerc.meterInMercatorCoordinateUnits();
    
    const cameraToCenterDistance = 0.5 / Math.tan((fov / 2) * Math.PI / 180) * transform.height;
    const altitude = cameraToCenterDistance * scale;
    this.camera.position.set(0, altitude, 0);
    
    const pitch = this.map.getPitch() * (Math.PI / 180);
    const bearing = this.map.getBearing() * (Math.PI / 180);
    
    this.camera.rotation.set(-pitch, -bearing, 0, 'YXZ');
  }

  /**
   * Render method called by MapLibre
   */
  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, _matrix: any): void {
    // Update light position
    this.updateLighting();
    
    // Sync camera
    this.syncCamera();
    
    // Render Three.js scene
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    
    // Trigger map repaint
    this.map.triggerRepaint();
  }

  /**
   * Called when layer is removed
   */
  onRemove(_map: MapLibreMap, _gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    console.log('🧹 [RealisticShadows] Cleaning up...');
    
    if (this.fetchDebounceTimer !== null) {
      clearTimeout(this.fetchDebounceTimer);
    }
    
    this.clearGeometry();
    
    // Cleanup Three.js resources
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });
    
    console.log('✅ [RealisticShadows] Cleanup complete');
  }

  /**
   * Update shadow layer options
   */
  updateOptions(options: Partial<ShadowLayerOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Reconfigure if quality changed
    if (options.shadowQuality) {
      this.configureShadows();
      this.setupLighting(); // Recreate lights with new shadow map size
    }
    
    // Update lighting if config changed
    if (options.lightConfig) {
      this.updateLighting();
    }
    
    // Reload geometry if show flags changed
    if (options.showBuildingShadows !== undefined || options.showTreeShadows !== undefined) {
      this.updateShadowGeometry();
    }
  }

  /**
   * Handle map move/zoom events
   */
  onMapMove(): void {
    this.updateShadowGeometry();
  }
}
