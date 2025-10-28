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

import { useEffect } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useRenderingManager } from '../../hooks/useRenderingManager';
import { useSunPosition } from '../../hooks/useSunPosition';
import type { RenderConfig, ShadowQuality } from '../../rendering';

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

  // Calculate sun position
  const sunPosition = useSunPosition({
    latitude,
    longitude,
    date: dateTime,
    enabled
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
