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

  // Calculate sun position based on Pune coordinates and selected time
  const sunPosition = useSunPosition({
    latitude: 18.5204,
    longitude: 73.8567,
    date: sunDate,
    enabled: true
  });

  // Fetch tree data when bounds change
  useEffect(() => {
    if (!bounds) return;

    const fetchTrees = async () => {
      try {
        onLoadingChange?.(true);
        
        const response = await axios.post(`${API_BASE_URL}/api/trees-in-bounds`, {
          bounds: {
            swLng: bounds.sw[0],
            swLat: bounds.sw[1],
            neLng: bounds.ne[0],
            neLat: bounds.ne[1]
          },
          limit: 5000 // Limit for performance
        });

        setTreeData(response.data.features || []);
        onLoadingChange?.(false);
      } catch (error) {
        console.error('Error fetching trees for shadows:', error);
        onLoadingChange?.(false);
      }
    };

    fetchTrees();
  }, [bounds, onLoadingChange]);

  // Create and add Three.js custom layer
  useEffect(() => {
    if (!map) return;
    
    const mapInstance = map.getMap();
    if (!mapInstance || isLayerAdded) return;

    // Shadow map size based on quality setting
    const shadowMapSizes = {
      low: 512,
      medium: 1024,
      high: 2048,
      ultra: 4096
    };

    // Create custom Three.js layer
    const customLayer: ThreeJSCustomLayer = {
      id: layerIdRef.current,
      type: 'custom',
      renderingMode: '3d',
      
      onAdd: function(map: MapLibreMap, gl: WebGL2RenderingContext) {
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
        const shadowMapSize = shadowMapSizes[shadowQuality];
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
          this.groundPlane = createGroundPlane(bounds, {
            color: '#f0f0f0',
            receiveShadow: true
          });
          this.scene.add(this.groundPlane);
        }

        // Initialize WebGL renderer with shadow mapping enabled
        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true,
          alpha: true // Transparent background
        });

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
        this.renderer.autoClear = false; // Don't clear MapLibre's rendering
        
        // Initialize tree objects array
        this.treeObjects = [];

        console.log('✅ Three.js Shadow Layer initialized');
      },

      render: function(_gl, projectionMatrix) {
        if (!this.camera || !this.scene || !this.renderer) return;

        // Sync Three.js camera with MapLibre camera
        const m = projectionMatrix as any;
        const l = new THREE.Matrix4().fromArray(m);
        this.camera.projectionMatrix = l;

        // Update sun position
        if (this.directionalLight) {
          this.directionalLight.position.set(...sunPosition.position);
          this.directionalLight.intensity = sunPosition.intensity;
        }

        // Update shadow visibility based on props
        if (this.directionalLight) {
          this.directionalLight.castShadow = showTreeShadows || showBuildingShadows;
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
        
        console.log('🧹 Three.js Shadow Layer cleaned up');
      }
    };

    // Add the custom layer to the map
    try {
      mapInstance.addLayer(customLayer);
      setIsLayerAdded(true);
      console.log('✅ Three.js layer added to map');
    } catch (error) {
      console.error('Error adding Three.js layer:', error);
    }

    // Cleanup on unmount
    return () => {
      if (mapInstance.getLayer(layerIdRef.current)) {
        mapInstance.removeLayer(layerIdRef.current);
        setIsLayerAdded(false);
      }
    };
  }, [map, isLayerAdded, sunPosition, shadowQuality, showBuildingShadows, showTreeShadows, bounds, onPerformanceUpdate]);

    // Add trees to the scene when data changes
  useEffect(() => {
    if (!map || !isLayerAdded || treeData.length === 0) return;

    const mapInstance = map.getMap();
    if (!mapInstance) return;
    
    const layer = mapInstance.getLayer(layerIdRef.current) as unknown as ThreeJSCustomLayer;
    if (!layer || !layer.scene || !layer.treeObjects) return;

    // Clear existing trees
    layer.treeObjects.forEach((obj: THREE.Group) => {
      layer.scene!.remove(obj);
    });
    layer.treeObjects = [];

    // Add new trees
    treeData.forEach((feature) => {
      const props = feature.properties;
      if (!props) return;

      const treeGeometry = createTreeGeometry(feature, {
        heightM: props.height_m || 10,
        girthCm: props.girth_cm || 50,
        canopyDiaM: props.canopy_dia_m || 5
      });

      layer.scene!.add(treeGeometry);
      layer.treeObjects!.push(treeGeometry);
    });

    // Trigger map repaint
    mapInstance.triggerRepaint();

    console.log(`✅ Added ${treeData.length} trees to Three.js scene`);
  }, [map, isLayerAdded, treeData]);  // This component doesn't render anything directly (custom layer handles rendering)
  return null;
};

export default ThreeJSShadowLayer;
