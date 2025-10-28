// src/components/map/ThreeJSShadowLayer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import * as THREE from 'three';
import axios from 'axios';
import type { Feature, Point } from 'geojson';
import { useSunPosition } from '../../hooks/useSunPosition';
import { createTreeGeometry, createGroundPlane } from '../../utils/geometryBuilder';
import type { CustomLayerInterface, Map as MapLibreMap } from 'maplibre-gl';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

// Extended custom layer interface with Three.js properties
interface ThreeJSCustomLayer extends CustomLayerInterface {
  camera?: THREE.Camera;
  scene?: THREE.Scene;
  renderer?: THREE.WebGLRenderer;
  directionalLight?: THREE.DirectionalLight;
  ambientLight?: THREE.AmbientLight;
  groundPlane?: THREE.Mesh;
  treeObjects?: THREE.Group[];
  frameCount?: number; // For periodic logging
}

interface ThreeJSShadowLayerProps {
  bounds: { sw: [number, number]; ne: [number, number] } | null;
  sunDate: Date;
  shadowQuality?: 'low' | 'medium' | 'high' | 'ultra';
  showBuildingShadows?: boolean;
  showTreeShadows?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onPerformanceUpdate?: (fps: number, drawCalls: number) => void;
}

const ThreeJSShadowLayer: React.FC<ThreeJSShadowLayerProps> = ({
  bounds,
  sunDate,
  shadowQuality = 'high',
  showBuildingShadows = true,
  showTreeShadows = true,
  onLoadingChange,
  onPerformanceUpdate
}) => {
  const { current: map } = useMap();
  const layerIdRef = useRef<string>('threejs-shadow-layer');
  const [treeData, setTreeData] = useState<Feature<Point>[]>([]);
  const [isLayerAdded, setIsLayerAdded] = useState(false);

  // Calculate sun position FIRST before anything else
  const sunPosition = useSunPosition({
    latitude: 18.5204,
    longitude: 73.8567,
    date: sunDate,
    enabled: true
  });
  
  // Use refs to hold latest values for the render function
  const sunPositionRef = useRef(sunPosition);
  const shadowQualityRef = useRef(shadowQuality);
  const showTreeShadowsRef = useRef(showTreeShadows);
  const showBuildingShadowsRef = useRef(showBuildingShadows);
  const boundsRef = useRef(bounds);
  
  // Update refs when props change
  useEffect(() => {
    sunPositionRef.current = sunPosition;
  }, [sunPosition]);
  
  useEffect(() => {
    shadowQualityRef.current = shadowQuality;
  }, [shadowQuality]);
  
  useEffect(() => {
    showTreeShadowsRef.current = showTreeShadows;
  }, [showTreeShadows]);
  
  useEffect(() => {
    showBuildingShadowsRef.current = showBuildingShadows;
  }, [showBuildingShadows]);
  
  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  // Fetch tree data when bounds change
  useEffect(() => {
    console.log('🔍 [ThreeJSShadowLayer] Bounds changed:', bounds);
    
    if (!bounds) {
      console.warn('⚠️ [ThreeJSShadowLayer] No bounds available, skipping tree fetch');
      return;
    }

    const fetchTrees = async () => {
      try {
        console.log('📡 [ThreeJSShadowLayer] Fetching trees with bounds:', bounds);
        onLoadingChange?.(true);
        
        // Use the SAME format as ThreeDTreesLayer - API expects { bounds, limit }
        const response = await axios.post(`${API_BASE_URL}/api/trees-in-bounds`, {
          bounds,  // Already in correct format: { sw: [lng, lat], ne: [lng, lat] }
          limit: 5000
        });

        const features = response.data.features || [];
        console.log(`✅ [ThreeJSShadowLayer] Received ${features.length} trees from API`);
        console.log('📦 [ThreeJSShadowLayer] Sample tree data:', features[0]);
        
        setTreeData(features);
        onLoadingChange?.(false);
      } catch (error) {
        console.error('❌ [ThreeJSShadowLayer] Error fetching trees:', error);
        if (axios.isAxiosError(error)) {
          console.error('  Status:', error.response?.status);
          console.error('  Data:', error.response?.data);
          console.error('  Request:', error.config?.url, error.config?.data);
        }
        onLoadingChange?.(false);
      }
    };

    fetchTrees();
  }, [bounds, onLoadingChange]);

  // Create and add Three.js custom layer
  useEffect(() => {
    console.log('🎬 [ThreeJSShadowLayer] Layer initialization effect triggered');
    console.log('  - map exists:', !!map);
    console.log('  - isLayerAdded:', isLayerAdded);
    
    if (!map) {
      console.warn('⚠️ [ThreeJSShadowLayer] No map reference available');
      return;
    }
    
    const mapInstance = map.getMap();
    if (!mapInstance) {
      console.warn('⚠️ [ThreeJSShadowLayer] No MapLibre instance available');
      return;
    }
    
    if (isLayerAdded) {
      console.log('ℹ️ [ThreeJSShadowLayer] Layer already added, skipping');
      return;
    }

    // Shadow map size based on quality setting
    const shadowMapSizes = {
      low: 512,
      medium: 1024,
      high: 2048,
      ultra: 4096
    };
    
    console.log(`🎨 [ThreeJSShadowLayer] Creating custom layer with quality: ${shadowQualityRef.current} (${shadowMapSizes[shadowQualityRef.current]}px)`);

    // Create custom Three.js layer
    const customLayer: ThreeJSCustomLayer = {
      id: layerIdRef.current,
      type: 'custom',
      renderingMode: '3d',
      
      onAdd: function(map: MapLibreMap, gl: WebGL2RenderingContext) {
        console.log('🎨 [ThreeJSShadowLayer] onAdd() called - initializing Three.js scene');
        
        // Initialize Three.js camera (will sync with MapLibre camera)
        this.camera = new THREE.PerspectiveCamera();

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = null; // Transparent to show MapLibre beneath

        // Add ambient light for general illumination
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(this.ambientLight);

        // Add directional light (sun) with shadow casting
        this.directionalLight = new THREE.DirectionalLight(0xffffff, sunPosition.intensity);
        this.directionalLight.position.set(...sunPosition.position);
        this.directionalLight.castShadow = true;

        // Configure shadow properties
        const shadowMapSize = shadowMapSizes[shadowQualityRef.current];
        this.directionalLight.shadow.mapSize.width = shadowMapSize;
        this.directionalLight.shadow.mapSize.height = shadowMapSize;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 5000;
        
        // Shadow camera frustum (adjust based on viewport)
        const d = 500;
        this.directionalLight.shadow.camera.left = -d;
        this.directionalLight.shadow.camera.right = d;
        this.directionalLight.shadow.camera.top = d;
        this.directionalLight.shadow.camera.bottom = -d;
        
        // Shadow darkness/bias
        this.directionalLight.shadow.bias = -0.001;
        this.directionalLight.shadow.normalBias = 0.02;
        
        this.scene.add(this.directionalLight);

        // Add ground plane to receive shadows
        if (bounds) {
          console.log('🟩 [ThreeJSShadowLayer] Creating ground plane with bounds:', bounds);
          this.groundPlane = createGroundPlane(bounds, {
            color: '#f0f0f0',
            receiveShadow: true
          });
          if (this.groundPlane) {
            this.scene.add(this.groundPlane);
            console.log('✅ [ThreeJSShadowLayer] Ground plane added to scene');
          }
        } else {
          console.warn('⚠️ [ThreeJSShadowLayer] No bounds available for ground plane');
        }

        // Initialize WebGL renderer with shadow mapping enabled
        console.log('🖼️ [ThreeJSShadowLayer] Initializing WebGL renderer');
        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true,
          alpha: true // Transparent background
        });

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
        this.renderer.autoClear = false; // Don't clear MapLibre's rendering
        
        console.log('  - Shadow map enabled:', this.renderer.shadowMap.enabled);
        console.log('  - Shadow map type:', this.renderer.shadowMap.type);
        console.log('  - Renderer autoClear:', this.renderer.autoClear);
        
        // Initialize tree objects array
        this.treeObjects = [];

        console.log('✅ [ThreeJSShadowLayer] Three.js Shadow Layer initialized successfully');
        console.log('  - Scene children:', this.scene.children.length);
        console.log('  - Lights:', { ambient: !!this.ambientLight, directional: !!this.directionalLight });
        console.log('  - Ground plane:', !!this.groundPlane);
        console.log('  - Renderer:', !!this.renderer);
      },

      render: function(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: any) {
        // Extract projection matrix from args
        const projectionMatrix = args as number[];
        
        if (!this.camera || !this.scene || !this.renderer) {
          console.warn('⚠️ [ThreeJSShadowLayer] render() called but missing:', {
            camera: !!this.camera,
            scene: !!this.scene,
            renderer: !!this.renderer
          });
          return;
        }

        // Sync Three.js camera with MapLibre camera
        const l = new THREE.Matrix4().fromArray(projectionMatrix);
        this.camera.projectionMatrix = l;

        // Update sun position using latest ref values
        if (this.directionalLight) {
          const latestSunPos = sunPositionRef.current;
          this.directionalLight.position.set(...latestSunPos.position);
          this.directionalLight.intensity = latestSunPos.intensity;
        }

        // Update shadow visibility based on latest ref values
        if (this.directionalLight) {
          this.directionalLight.castShadow = showTreeShadowsRef.current || showBuildingShadowsRef.current;
          
          // Update shadow map quality if changed
          const currentQuality = shadowQualityRef.current;
          const shadowMapSizes = { low: 512, medium: 1024, high: 2048, ultra: 4096 };
          const newSize = shadowMapSizes[currentQuality];
          
          if (this.directionalLight.shadow.mapSize.width !== newSize) {
            this.directionalLight.shadow.mapSize.width = newSize;
            this.directionalLight.shadow.mapSize.height = newSize;
            this.directionalLight.shadow.map?.dispose();
            this.directionalLight.shadow.map = null;
            console.log(`🔄 [ThreeJSShadowLayer] Shadow quality updated to ${currentQuality} (${newSize}px)`);
          }
        }

        // Log scene contents periodically (every 60 frames = ~1 second)
        if (!this.frameCount) this.frameCount = 0;
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
          console.log('🎬 [ThreeJSShadowLayer] render() frame', this.frameCount);
          console.log('  - Scene children:', this.scene.children.length);
          console.log('  - Tree objects:', this.treeObjects?.length || 0);
          console.log('  - Sun position:', sunPositionRef.current.position);
          console.log('  - Sun intensity:', sunPositionRef.current.intensity);
        }

        // Render the scene
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);

        // Trigger performance callback
        if (onPerformanceUpdate && this.renderer.info.render) {
          const fps = 60; // TODO: Calculate actual FPS
          const drawCalls = this.renderer.info.render.calls;
          onPerformanceUpdate(fps, drawCalls);
        }
      },

      onRemove: function() {
        // Cleanup Three.js objects
        if (this.scene) {
          this.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              if (object.material instanceof THREE.Material) {
                object.material.dispose();
              }
            }
          });
        }
        
        this.camera = undefined;
        this.scene = undefined;
        this.renderer = undefined;
        
        console.log('🧹 [ThreeJSShadowLayer] Three.js Shadow Layer cleaned up');
      }
    };

    // Add the custom layer to the map
    try {
      mapInstance.addLayer(customLayer);
      setIsLayerAdded(true);
      console.log('✅ [ThreeJSShadowLayer] Three.js layer added to map');
    } catch (error) {
      console.error('❌ [ThreeJSShadowLayer] Error adding Three.js layer:', error);
    }

    // Cleanup ONLY on unmount
    return () => {
      if (mapInstance.getLayer(layerIdRef.current)) {
        mapInstance.removeLayer(layerIdRef.current);
        setIsLayerAdded(false);
        console.log('🧹 [ThreeJSShadowLayer] Layer removed from map');
      }
    };
  }, [map]); // CRITICAL FIX: Only depend on map, NOT shadowQuality

  // Add trees to the scene when data changes
  useEffect(() => {
    console.log('🌳 [ThreeJSShadowLayer] Tree data effect triggered');
    console.log('  - map:', !!map);
    console.log('  - isLayerAdded:', isLayerAdded);
    console.log('  - treeData.length:', treeData.length);
    
    if (!map) {
      console.warn('⚠️ [ThreeJSShadowLayer] No map reference, cannot add trees');
      return;
    }
    
    if (!isLayerAdded) {
      console.warn('⚠️ [ThreeJSShadowLayer] Layer not added yet, cannot add trees');
      return;
    }
    
    if (treeData.length === 0) {
      console.warn('⚠️ [ThreeJSShadowLayer] No tree data available');
      return;
    }

    // Small delay to ensure layer is fully added to map
    const timeoutId = setTimeout(() => {
      const mapInstance = map.getMap();
      if (!mapInstance) {
        console.warn('⚠️ [ThreeJSShadowLayer] No MapLibre instance');
        return;
      }
      
      const layer = mapInstance.getLayer(layerIdRef.current) as unknown as ThreeJSCustomLayer;
      if (!layer) {
        console.error('❌ [ThreeJSShadowLayer] Layer not found on map:', layerIdRef.current);
        console.error('  Available layers:', mapInstance.getStyle().layers?.map((l: any) => l.id));
        return;
      }
    
      if (!layer.scene) {
        console.error('❌ [ThreeJSShadowLayer] Layer has no scene');
        return;
      }
      
      if (!layer.treeObjects) {
        console.warn('⚠️ [ThreeJSShadowLayer] Layer has no treeObjects array, initializing');
        layer.treeObjects = [];
      }

      console.log(`🌳 [ThreeJSShadowLayer] Adding ${treeData.length} trees to scene...`);

      // Clear existing trees
      const oldTreeCount = layer.treeObjects.length;
      layer.treeObjects.forEach((obj: THREE.Group) => {
        layer.scene!.remove(obj);
      });
      layer.treeObjects = [];
      console.log(`🗑️ [ThreeJSShadowLayer] Cleared ${oldTreeCount} old trees`);

      // Add new trees
      let successCount = 0;
      let errorCount = 0;
      
      treeData.forEach((feature, index) => {
        try {
          const props = feature.properties;
          if (!props) {
            console.warn(`⚠️ [ThreeJSShadowLayer] Tree ${index} has no properties`);
            return;
          }

          const treeGeometry = createTreeGeometry(feature, {
            heightM: props.height_m || 10,
            girthCm: props.girth_cm || 50,
            canopyDiaM: props.canopy_dia_m || 5
          });

          layer.scene!.add(treeGeometry);
          layer.treeObjects!.push(treeGeometry);
          successCount++;
          
          // Log first few trees for debugging
          if (index < 3) {
            console.log(`  Tree ${index}:`, {
              coords: feature.geometry.coordinates,
              height: props.height_m,
              girth: props.girth_cm,
              canopy: props.canopy_dia_m,
              position: treeGeometry.position,
              children: treeGeometry.children.length
            });
          }
        } catch (error) {
          console.error(`❌ [ThreeJSShadowLayer] Error creating tree ${index}:`, error);
          errorCount++;
        }
      });

      console.log(`✅ [ThreeJSShadowLayer] Tree addition complete:`, {
        success: successCount,
        errors: errorCount,
        total: treeData.length,
        sceneChildren: layer.scene.children.length
      });

      // Trigger map repaint
      mapInstance.triggerRepaint();
      console.log('🔄 [ThreeJSShadowLayer] Map repaint triggered');
    }, 100); // 100ms delay to ensure layer is ready

    return () => clearTimeout(timeoutId);
  }, [map, isLayerAdded, treeData]);

  // This component doesn't render anything directly (custom layer handles rendering)
  return null;
};

export default ThreeJSShadowLayer;
