/**
 * RealisticShadowLayer - Production-Ready Shadow Rendering Component
 * 
 * Clean React wrapper for the ShadowRenderingManager system.
 * Replaces the old ThreeJSShadowLayer with world-class architecture.
 * 
 * Features:
 * - Zero race conditions (singleton pattern)
 * - Proper lifecycle management
 * - Error boundary support
 * - Performance monitoring
 * - Type-safe props
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Map as MaplibreMap, CustomLayerInterface, CustomRenderMethodInput } from 'maplibre-gl';
import axios from 'axios';
import { useRenderingManager } from '../../hooks/useRenderingManager';
import { useSunPosition } from '../../hooks/useSunPosition';
import type { RenderConfig, ShadowQuality } from '../../rendering';

// API Base URL: localhost in development, empty (relative) in production
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

/**
 * Component props
 */
export interface RealisticShadowLayerProps {
  /** MapLibre map instance */
  map: MaplibreMap | null;
  
  /** Whether shadow rendering is enabled */
  enabled?: boolean;
  
  /** Shadow quality level */
  shadowQuality?: ShadowQuality;
  
  /** Maximum visible trees */
  maxVisibleTrees?: number;
  
  /** Enable frustum culling */
  enableFrustumCulling?: boolean;
  
  /** User's latitude */
  latitude?: number;
  
  /** User's longitude */
  longitude?: number;
  
  /** Date/time for sun position */
  dateTime?: Date;
  
  /** Callback when initialization completes */
  onInitialized?: () => void;
  
  /** Callback when error occurs */
  onError?: (error: Error) => void;
  
  /** Callback on performance metrics update */
  onPerformanceUpdate?: (fps: number) => void;
}

/**
 * RealisticShadowLayer Component
 * 
 * Usage:
 * ```tsx
 * <RealisticShadowLayer
 *   map={mapInstance}
 *   enabled={true}
 *   shadowQuality="high"
 *   maxVisibleTrees={5000}
 *   latitude={18.5204}
 *   longitude={73.8567}
 *   dateTime={new Date()}
 *   onInitialized={() => console.log('Shadows ready!')}
 * />
 * ```
 */
export function RealisticShadowLayer(props: RealisticShadowLayerProps) {
  const {
    map,
    enabled = true,
    shadowQuality = 'high',
    maxVisibleTrees = 5000,
    enableFrustumCulling = true,
    latitude = 18.5204, // Pune, India
    longitude = 73.8567,
    dateTime = new Date(),
    onInitialized,
    onError,
    onPerformanceUpdate,
  } = props;

  const [treeData, setTreeData] = useState<any[]>([]);
  const [buildingData, setBuildingData] = useState<any[]>([]);
  const customLayerIdRef = useRef<string>('realistic-shadows-layer');
  const isLayerAddedRef = useRef<boolean>(false);

  // DEBUG: Log the dateTime prop to verify what time is being used
  console.log('🕐 [RealisticShadowLayer] DateTime prop:', dateTime, 'Hours:', dateTime.getHours());

  // Calculate sun position
  const sunPosition = useSunPosition({
    latitude,
    longitude,
    date: dateTime,
    enabled
  });

  // DEBUG: Log sun position calculation
  console.log('☀️ [RealisticShadowLayer] Sun position calculated:', {
    altitude: sunPosition.altitude,
    altitudeDegrees: (sunPosition.altitude * 180 / Math.PI).toFixed(2) + '°',
    azimuth: sunPosition.azimuth,
    intensity: sunPosition.intensity,
    position: sunPosition.position,
    isNight: sunPosition.altitude < 0
  });

  // Initialize rendering manager
  const {
    manager,
    isInitialized,
    error,
    updateConfig,
    updateSun,
    subscribe,
  } = useRenderingManager({
    map,
    config: {
      shadowQuality,
      maxTrees: maxVisibleTrees,
      enableFrustumCulling,
    },
    autoInitialize: true,
    enabled,
  });

  /**
   * Fetch tree data when map bounds change
   */
  const fetchTrees = useCallback(async (mapBounds: any) => {
    if (!mapBounds) return;
    
    try {
      console.log('🌳 [RealisticShadowLayer] Fetching trees for bounds:', mapBounds);
      const response = await axios.post(`${API_BASE_URL}/api/trees-in-bounds`, {
        bounds: mapBounds,
        limit: maxVisibleTrees,
      });
      
      const features = response.data.features || [];
      console.log(`✅ [RealisticShadowLayer] Fetched ${features.length} trees`);
      setTreeData(features);
    } catch (err) {
      console.error('❌ [RealisticShadowLayer] Error fetching trees:', err);
      if (onError) {
        onError(err as Error);
      }
    }
  }, [maxVisibleTrees, onError]);

  /**
   * Fetch building data from MapLibre vector tiles
   */
  const fetchBuildings = useCallback((mapInstance: MaplibreMap) => {
    if (!mapInstance) return;
    
    try {
      console.log('🏢 [RealisticShadowLayer] Fetching buildings from vector tiles...');
      
      // Dynamically detect building layers from the map style
      const style = mapInstance.getStyle();
      const buildingLayers = style?.layers?.filter((layer: any) => {
        // Look for fill-extrusion layers (3D buildings) or layers with "building" in the name
        return layer.type === 'fill-extrusion' || 
               (layer.id && /building/i.test(layer.id));
      }).map((layer: any) => layer.id) || [];
      
      console.log('🏢 [RealisticShadowLayer] Detected building layers:', buildingLayers);
      
      // Try to query features from detected layers
      let features: any[] = [];
      
      if (buildingLayers.length > 0) {
        // Query with detected layer IDs
        features = mapInstance.queryRenderedFeatures(undefined, {
          layers: buildingLayers,
          filter: ['has', 'height'] // Only buildings with height data
        });
      } else {
        // Fallback: query all features and filter by height property
        console.log('🏢 [RealisticShadowLayer] No building layers found, querying all features');
        const allFeatures = mapInstance.queryRenderedFeatures(undefined, {
          filter: ['has', 'height']
        });
        features = allFeatures.filter((f: any) => 
          f.geometry?.type === 'Polygon' && 
          (f.properties?.height || f.properties?.render_height)
        );
      }
      
      if (features.length === 0) {
        console.warn('⚠️ [RealisticShadowLayer] No buildings found. Is 3D mode enabled?');
        return;
      }
      
      // Transform MapLibre features to building data format
      const buildings = features.map((feature: any, index: number) => {
        // Get building polygon coordinates
        const geometry = feature.geometry;
        if (geometry.type !== 'Polygon') return null;
        
        // Convert coordinates to vertices
        const coordinates = geometry.coordinates[0]; // Outer ring
        const vertices = coordinates.map((coord: [number, number]) => ({
          lng: coord[0],
          lat: coord[1]
        }));
        
        // Get building properties
        const height = feature.properties.height || feature.properties.render_height || 15;
        const minHeight = feature.properties.min_height || 0;
        const buildingHeight = height - minHeight;
        
        return {
          id: feature.id || `building-${index}`,
          vertices: vertices,
          height: buildingHeight,
          type: feature.properties.type || 'building'
        };
      }).filter(Boolean);
      
      console.log(`✅ [RealisticShadowLayer] Processed ${buildings.length} buildings`);
      setBuildingData(buildings);
      
    } catch (err) {
      console.error('❌ [RealisticShadowLayer] Error fetching buildings:', err);
      if (onError) {
        onError(err as Error);
      }
    }
  }, [onError]);

  /**
   * Update bounds when map moves
   */
  useEffect(() => {
    if (!map || !enabled) return;

    const handleMoveEnd = () => {
      const mapBounds = map.getBounds();
      const sw = mapBounds.getSouthWest();
      const ne = mapBounds.getNorthEast();
      
      const newBounds = {
        sw: [sw.lng, sw.lat],
        ne: [ne.lng, ne.lat],
      };
      
      fetchTrees(newBounds);
      fetchBuildings(map); // Also fetch buildings on map move
    };

    // Initial fetch
    handleMoveEnd();

    // Listen for map movements
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, enabled, fetchTrees, fetchBuildings]);

  /**
   * Add trees to scene when data is available
   */
  useEffect(() => {
    if (!manager || !isInitialized || !treeData.length) return;

    console.log(`🎨 [RealisticShadowLayer] Adding ${treeData.length} trees to scene`);

    try {
      // Add trees using the manager
      manager.addTrees(treeData);
    } catch (err) {
      console.error('❌ [RealisticShadowLayer] Error adding trees:', err);
      if (onError) {
        onError(err as Error);
      }
    }
  }, [manager, isInitialized, treeData, onError]);

  /**
   * Add buildings to scene when data is available
   */
  useEffect(() => {
    if (!manager || !isInitialized || !buildingData.length) return;

    console.log(`🎨 [RealisticShadowLayer] Adding ${buildingData.length} buildings to scene`);

    try {
      // Add buildings using the manager
      manager.addBuildings(buildingData);
    } catch (err) {
      console.error('❌ [RealisticShadowLayer] Error adding buildings:', err);
      if (onError) {
        onError(err as Error);
      }
    }
  }, [manager, isInitialized, buildingData, onError]);

  /**
   * Add manager as custom layer to MapLibre
   * This is CRITICAL - without this, the render() method never gets called!
   */
  useEffect(() => {
    console.log('🔥🔥🔥 [RealisticShadowLayer] useEffect TRIGGERED for custom layer', {
      map: !!map,
      manager: !!manager,
      isInitialized,
      enabled,
      isLayerAddedRef: isLayerAddedRef.current
    });
    
    if (!map) {
      console.warn('⚠️ [RealisticShadowLayer] Skipping layer add: no map');
      return;
    }
    if (!manager) {
      console.warn('⚠️ [RealisticShadowLayer] Skipping layer add: no manager');
      return;
    }
    if (!isInitialized) {
      console.warn('⚠️ [RealisticShadowLayer] Skipping layer add: not initialized');
      return;
    }
    if (!enabled) {
      console.warn('⚠️ [RealisticShadowLayer] Skipping layer add: not enabled');
      return;
    }
    if (isLayerAddedRef.current) {
      console.warn('⚠️ [RealisticShadowLayer] Skipping layer add: already added');
      return;
    }

    console.log('🎨🎨🎨 [RealisticShadowLayer] ALL CHECKS PASSED - Adding custom layer to MapLibre!');

    // CRITICAL: Store manager reference that won't change
    const managerRef = manager;
    const isInitializedRef = isInitialized;

    // Create custom layer interface
    const customLayer: CustomLayerInterface = {
      id: customLayerIdRef.current,
      type: 'custom',
      renderingMode: '3d',

      onAdd: function (_mapInstance: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
        console.log('✅✅✅ [RealisticShadowLayer] Custom layer onAdd() CALLED!', {
          managerExists: !!managerRef,
          isInitialized: isInitializedRef,
          glContext: gl.constructor.name,
          glVersion: gl.getParameter(gl.VERSION)
        });
        // Manager is already initialized, no additional setup needed
      },

      // CRITICAL FIX: MapLibre v5.6.1 API signature change!
      // Old API (v2/v3): render(gl: WebGLRenderingContext, matrix: Float64Array)
      // New API (v5+):    render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput)
      render: function (
        gl: WebGLRenderingContext | WebGL2RenderingContext,
        options: CustomRenderMethodInput
      ) {
        console.log('🟢🟢🟢 [CustomLayer] render() CALLED!', {
          glContext: gl.constructor.name,
          matrixLength: options.modelViewProjectionMatrix.length,
          managerExists: !!managerRef,
          isInitialized: isInitializedRef
        });
        
        if (!managerRef) {
          console.error('❌ [CustomLayer] render() called but manager is null!');
          return;
        }
        if (!isInitializedRef) {
          console.error('❌ [CustomLayer] render() called but not initialized!');
          return;
        }
        
        // Convert mat4 (tuple of 16 numbers) to array for manager
        const matrixArray = Array.from(options.modelViewProjectionMatrix);
        managerRef.render(gl, matrixArray);
      },

      onRemove: function () {
        console.log('🗑️ [RealisticShadowLayer] Custom layer onRemove called');
        // Cleanup handled by useEffect cleanup
      },
    };

    try {
      console.log('🚀 [RealisticShadowLayer] About to call map.addLayer()...', {
        customLayerId: customLayer.id,
        customLayerType: customLayer.type,
        renderingMode: customLayer.renderingMode,
        hasOnAdd: typeof customLayer.onAdd === 'function',
        hasRender: typeof customLayer.render === 'function'
      });
      
      // Add custom layer to map
      map.addLayer(customLayer);
      isLayerAddedRef.current = true;
      
      console.log('✅✅✅ [RealisticShadowLayer] map.addLayer() completed successfully!');
      
      // IMMEDIATE verification (not delayed)
      const layer = map.getLayer(customLayerIdRef.current);
      console.log('🔍🔍🔍 [RealisticShadowLayer] IMMEDIATE Layer verification:', {
        layerExists: !!layer,
        layerId: customLayerIdRef.current,
        layerType: layer ? (layer as any).type : 'N/A',
        allLayerIds: map.getStyle()?.layers?.map(l => l.id) || []
      });
      
      // Also verify after a short delay
      setTimeout(() => {
        const delayedLayer = map.getLayer(customLayerIdRef.current);
        console.log('🔍 [RealisticShadowLayer] DELAYED Layer verification (100ms):', {
          layerExists: !!delayedLayer,
          layerId: customLayerIdRef.current
        });
        
        // Force a map repaint to trigger render()
        console.log('🔄 [RealisticShadowLayer] Forcing map repaint...');
        map.triggerRepaint();
      }, 100);
      
      // Also force immediate repaint
      console.log('🔄 [RealisticShadowLayer] Forcing IMMEDIATE map repaint...');
      map.triggerRepaint();
    } catch (err) {
      console.error('❌❌❌ [RealisticShadowLayer] FAILED to add custom layer:', err);
      console.error('❌ Error details:', {
        message: (err as Error).message,
        stack: (err as Error).stack
      });
      if (onError) onError(err as Error);
    }

    // Cleanup function
    return () => {
      if (isLayerAddedRef.current && map.getLayer(customLayerIdRef.current)) {
        try {
          map.removeLayer(customLayerIdRef.current);
          isLayerAddedRef.current = false;
          console.log('🗑️ [RealisticShadowLayer] Custom layer removed');
        } catch (err) {
          console.warn('⚠️ [RealisticShadowLayer] Failed to remove custom layer:', err);
        }
      }
    };
  }, [map, manager, isInitialized, enabled, onError]);

  /**
   * Update configuration when props change
   */
  useEffect(() => {
    if (!isInitialized) return;

    const config: Partial<RenderConfig> = {
      shadowQuality,
      maxTrees: maxVisibleTrees,
      enableFrustumCulling,
    };

    updateConfig(config);
  }, [
    isInitialized,
    shadowQuality,
    maxVisibleTrees,
    enableFrustumCulling,
    updateConfig,
  ]);

  /**
   * Update sun position when it changes
   */
  useEffect(() => {
    if (!isInitialized || !sunPosition) return;

    updateSun({
      position: sunPosition.position,
      intensity: sunPosition.intensity,
      color: '#ffffff',
      castShadow: true,
    });
  }, [isInitialized, sunPosition, updateSun]);

  /**
   * Subscribe to initialization event
   */
  useEffect(() => {
    if (!manager) return;

    const unsubscribe = subscribe('initialized', () => {
      console.log('[RealisticShadowLayer] Rendering system initialized');
      if (onInitialized) {
        onInitialized();
      }
    });

    return unsubscribe;
  }, [manager, subscribe, onInitialized]);

  /**
   * Subscribe to performance updates
   */
  useEffect(() => {
    if (!manager || !onPerformanceUpdate) return;

    const unsubscribe = subscribe('performance:update', (payload) => {
      onPerformanceUpdate(payload.metrics.fps);
    });

    return unsubscribe;
  }, [manager, subscribe, onPerformanceUpdate]);

  /**
   * Handle errors
   */
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  /**
   * Log status
   */
  useEffect(() => {
    if (isInitialized) {
      console.log('[RealisticShadowLayer] Status:', {
        enabled,
        shadowQuality,
        maxVisibleTrees,
        sunPosition,
      });
    }
  }, [isInitialized, enabled, shadowQuality, maxVisibleTrees, sunPosition]);

  // This is a controller component - no UI to render
  return null;
}

/**
 * Default export for convenience
 */
export default RealisticShadowLayer;
