// src/components/map/DeforestationHotspotsLayer.tsx
/**
 * DEFORESTATION HOTSPOTS LAYER
 * ============================
 * 
 * Visualizes areas with significant green cover loss as map hotspots.
 * Derived from ward-level land cover change data.
 * 
 * Features:
 * - Shows wards with significant tree loss as red-tinted hotspots
 * - Hover tooltips with deforestation details
 * - Customizable threshold and color intensity
 * - Integrates with Green Cover Monitor sidebar controls
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { useGreenCoverStore } from '../../store/GreenCoverStore';
import { useLayerLoadingStore } from '../../store/LayerLoadingStore';

// API base URL - empty string in production uses relative URLs
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

// Types
interface WardBoundaryFeature {
  type: 'Feature';
  properties: {
    ward_number: number;
    ward_office?: string;
    prabhag_name?: string;
    zone?: number;
    // Added dynamically
    trees_lost_ha?: number;
    net_change_pct?: number;
    trees_pct?: number;
    built_gained_ha?: number;
    is_hotspot?: boolean;
    severity?: 'severe' | 'moderate' | 'minor';
  };
  geometry: GeoJSON.Geometry;
}

interface WardBoundaryGeoJSON {
  type: 'FeatureCollection';
  features: WardBoundaryFeature[];
}

// Hotspot configuration
export interface HotspotConfig {
  // Threshold for considering a ward as a hotspot (% loss)
  lossThreshold: number;
  // Color scheme
  colorScheme: 'red' | 'orange' | 'heatmap';
  // Opacity 0-1
  opacity: number;
  // Show labels on hotspots
  showLabels: boolean;
  // Pulse animation for severe hotspots
  pulseAnimation: boolean;
}

export const DEFAULT_HOTSPOT_CONFIG: HotspotConfig = {
  lossThreshold: 0.1, // 0.1% or more loss marks a hotspot
  colorScheme: 'red',
  opacity: 0.6,
  showLabels: true,
  pulseAnimation: true,
};

// Get severity color
function getSeverityColor(netChangePct: number, scheme: string): string {
  const severity = Math.abs(netChangePct);
  
  if (scheme === 'heatmap') {
    // Heat map style: yellow -> orange -> red (scaled for actual data ~0.01-0.5%)
    if (severity >= 0.3) return '#dc2626'; // Red - Severe
    if (severity >= 0.2) return '#ea580c'; // Orange - High
    if (severity >= 0.1) return '#f59e0b';  // Amber - Moderate
    return '#fbbf24'; // Yellow - Minor
  }
  
  if (scheme === 'orange') {
    if (severity >= 0.3) return '#ea580c';
    if (severity >= 0.2) return '#f97316';
    if (severity >= 0.1) return '#fb923c';
    return '#fdba74';
  }
  
  // Default: Red scheme (scaled for actual data ~0.01-0.5%)
  if (severity >= 0.3) return '#991b1b'; // Dark red - Severe
  if (severity >= 0.2) return '#dc2626'; // Red - High
  if (severity >= 0.1) return '#ef4444';  // Light red - Moderate
  return '#fca5a5'; // Pale red - Minor
}

// Get severity level
function getSeverityLevel(netChangePct: number): 'severe' | 'moderate' | 'minor' {
  const severity = Math.abs(netChangePct);
  if (severity >= 0.25) return 'severe';
  if (severity >= 0.15) return 'moderate';
  return 'minor';
}

interface DeforestationHotspotsLayerProps {
  mapRef: React.RefObject<MapRef>;
  visible: boolean;
  config?: HotspotConfig;
  onHotspotClick?: (wardNumber: number) => void;
  onHotspotHover?: (wardNumber: number | null, details?: HotspotDetails) => void;
}

export interface HotspotDetails {
  wardNumber: number;
  treesLostHa: number;
  netChangePct: number;
  builtGainedHa: number;
  currentTreesPct: number;
  severity: 'severe' | 'moderate' | 'minor';
}

const DeforestationHotspotsLayer: React.FC<DeforestationHotspotsLayerProps> = ({
  mapRef,
  visible,
  config = DEFAULT_HOTSPOT_CONFIG,
  onHotspotClick,
  onHotspotHover,
}) => {
  const [geojsonData, setGeojsonData] = useState<WardBoundaryGeoJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredWard, setHoveredWard] = useState<number | null>(null);
  const [popupInfo, setPopupInfo] = useState<{
    longitude: number;
    latitude: number;
    wardNumber: number;
    details: HotspotDetails;
  } | null>(null);

  // Get data from store AND the fetchAllData action
  const { wardData, comparisonData, fetchAllData, isInitialized } = useGreenCoverStore();
  
  // Global loading store for UI feedback
  const setGlobalLoading = useLayerLoadingStore(state => state.setLoading);
  
  // Ensure data is loaded when layer becomes visible
  useEffect(() => {
    if (visible && !isInitialized) {
      console.log('[DeforestationHotspots] Triggering data fetch - store not initialized');
      fetchAllData();
    }
  }, [visible, isInitialized, fetchAllData]);

  // Fetch ward boundaries
  useEffect(() => {
    if (!visible) {
      setGlobalLoading('deforestation_hotspots', false);
      return;
    }
    
    const fetchBoundaries = async () => {
      setLoading(true);
      setGlobalLoading('deforestation_hotspots', true);
      try {
        const response = await fetch(`${API_BASE}/api/ward-boundaries`);
        if (!response.ok) throw new Error('Failed to fetch ward boundaries');
        const data: WardBoundaryGeoJSON = await response.json();
        setGeojsonData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Failed to fetch ward boundaries:', err);
      } finally {
        setLoading(false);
        setGlobalLoading('deforestation_hotspots', false);
      }
    };
    
    fetchBoundaries();
    
    return () => {
      setGlobalLoading('deforestation_hotspots', false);
    };
  }, [visible, setGlobalLoading]);

  // Enrich GeoJSON with hotspot data
  const enrichedData = useMemo(() => {
    if (!geojsonData || !comparisonData) {
      console.log('[DeforestationHotspots] Missing data:', { 
        hasGeojson: !!geojsonData, 
        hasComparison: !!comparisonData,
        comparisonLength: comparisonData?.length 
      });
      return null;
    }
    
    console.log('[DeforestationHotspots] Processing with', geojsonData.features.length, 'features and', comparisonData.length, 'comparison records');
    
    const wardDataByNumber = new Map(
      (Array.isArray(wardData) ? wardData : [])
        .filter(w => w.year === 2025)
        .map(w => [w.ward_number, w])
    );
    
    const comparisonByNumber = new Map(
      (Array.isArray(comparisonData) ? comparisonData : [])
        .map(c => [c.ward_number, c])
    );
    
    const enrichedFeatures = geojsonData.features.map(feature => {
      const wardNum = feature.properties.ward_number;
      const comparison = comparisonByNumber.get(wardNum);
      const currentData = wardDataByNumber.get(wardNum);
      
      // Calculate metrics
      const treesLostM2 = comparison ? parseFloat(comparison.trees_lost_m2 || '0') : 0;
      const treesGainedM2 = comparison ? parseFloat(comparison.trees_gained_m2 || '0') : 0;
      const netChangeM2 = treesGainedM2 - treesLostM2;
      const builtGainedM2 = comparison ? parseFloat(comparison.built_gained_m2 || '0') : 0;
      
      const treesLostHa = treesLostM2 / 10000;
      const netChangeHa = netChangeM2 / 10000;
      const builtGainedHa = builtGainedM2 / 10000;
      
      // Calculate percentage change based on total area
      const totalAreaM2 = currentData ? 
        (typeof currentData.total_area_m2 === 'string' ? parseFloat(currentData.total_area_m2) : currentData.total_area_m2 || 1) 
        : 1;
      const netChangePct = (netChangeM2 / totalAreaM2) * 100;
      
      const currentTreesPct = currentData ?
        (typeof currentData.trees_pct === 'string' ? parseFloat(currentData.trees_pct) : currentData.trees_pct || 0)
        : 0;
      
      // Determine if this is a hotspot (net loss exceeds threshold)
      const isHotspot = netChangePct < -config.lossThreshold;
      const severity = getSeverityLevel(netChangePct);
      
      return {
        ...feature,
        properties: {
          ...feature.properties,
          trees_lost_ha: treesLostHa,
          net_change_ha: netChangeHa,
          net_change_pct: netChangePct,
          built_gained_ha: builtGainedHa,
          trees_pct: currentTreesPct,
          is_hotspot: isHotspot,
          severity: severity,
        },
      };
    });
    
    // Filter to only hotspots
    const hotspotFeatures = enrichedFeatures.filter(f => f.properties.is_hotspot);
    
    console.log('[DeforestationHotspots] Found', hotspotFeatures.length, 'hotspots with threshold', config.lossThreshold + '%. Net change range:', 
      Math.min(...enrichedFeatures.map(f => f.properties.net_change_pct)).toFixed(2) + '% to',
      Math.max(...enrichedFeatures.map(f => f.properties.net_change_pct)).toFixed(2) + '%'
    );
    
    return {
      type: 'FeatureCollection' as const,
      features: hotspotFeatures,
    };
  }, [geojsonData, wardData, comparisonData, config.lossThreshold]);

  // Handle mouse events
  const handleMouseMove = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    if (!event.features?.length) {
      setHoveredWard(null);
      setPopupInfo(null);
      onHotspotHover?.(null);
      return;
    }

    const feature = event.features[0];
    const props = feature.properties;
    const wardNum = props.ward_number;
    
    setHoveredWard(wardNum);
    
    // Get centroid for popup
    const [lng, lat] = event.lngLat.toArray();
    
    const details: HotspotDetails = {
      wardNumber: wardNum,
      treesLostHa: props.trees_lost_ha || 0,
      netChangePct: props.net_change_pct || 0,
      builtGainedHa: props.built_gained_ha || 0,
      currentTreesPct: props.trees_pct || 0,
      severity: props.severity || 'minor',
    };
    
    setPopupInfo({
      longitude: lng,
      latitude: lat,
      wardNumber: wardNum,
      details,
    });
    
    onHotspotHover?.(wardNum, details);
  }, [onHotspotHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredWard(null);
    setPopupInfo(null);
    onHotspotHover?.(null);
  }, [onHotspotHover]);

  const handleClick = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    if (!event.features?.length) return;
    const wardNum = event.features[0].properties.ward_number;
    onHotspotClick?.(wardNum);
  }, [onHotspotClick]);

  // Setup event listeners
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !visible || !enrichedData) return;

    // Wait for layer to be added
    const setupListeners = () => {
      if (!map.getLayer('deforestation-hotspots-fill')) return;
      
      map.on('mousemove', 'deforestation-hotspots-fill', handleMouseMove);
      map.on('mouseleave', 'deforestation-hotspots-fill', handleMouseLeave);
      map.on('click', 'deforestation-hotspots-fill', handleClick);
      
      // Change cursor on hover
      map.on('mouseenter', 'deforestation-hotspots-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'deforestation-hotspots-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    };

    // Try immediately, then retry after a short delay
    setupListeners();
    const timeout = setTimeout(setupListeners, 500);

    return () => {
      clearTimeout(timeout);
      if (map.getLayer('deforestation-hotspots-fill')) {
        map.off('mousemove', 'deforestation-hotspots-fill', handleMouseMove);
        map.off('mouseleave', 'deforestation-hotspots-fill', handleMouseLeave);
        map.off('click', 'deforestation-hotspots-fill', handleClick);
      }
    };
  }, [mapRef, visible, enrichedData, handleMouseMove, handleMouseLeave, handleClick]);

  if (!visible || loading || error || !enrichedData) return null;

  // Build color expression based on severity
  const fillColorExpression: maplibregl.ExpressionSpecification = [
    'case',
    ['==', ['get', 'severity'], 'severe'],
    getSeverityColor(-15, config.colorScheme),
    ['==', ['get', 'severity'], 'moderate'],
    getSeverityColor(-7, config.colorScheme),
    getSeverityColor(-3, config.colorScheme),
  ];

  return (
    <>
      <Source
        id="deforestation-hotspots"
        type="geojson"
        data={enrichedData}
      >
        {/* Fill layer */}
        <Layer
          id="deforestation-hotspots-fill"
          type="fill"
          paint={{
            'fill-color': fillColorExpression,
            'fill-opacity': [
              'case',
              ['==', ['get', 'ward_number'], hoveredWard],
              Math.min(1, config.opacity + 0.2),
              config.opacity,
            ],
          }}
        />
        
        {/* Border layer */}
        <Layer
          id="deforestation-hotspots-border"
          type="line"
          paint={{
            'line-color': [
              'case',
              ['==', ['get', 'ward_number'], hoveredWard],
              '#ffffff',
              '#ef4444',
            ],
            'line-width': [
              'case',
              ['==', ['get', 'ward_number'], hoveredWard],
              3,
              1.5,
            ],
            'line-opacity': 0.8,
          }}
        />
        
        {/* Labels for severe hotspots */}
        {config.showLabels && (
          <Layer
            id="deforestation-hotspots-labels"
            type="symbol"
            filter={['==', ['get', 'severity'], 'severe']}
            layout={{
              'text-field': ['concat', 'W', ['to-string', ['get', 'ward_number']]],
              'text-size': 12,
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-anchor': 'center',
            }}
            paint={{
              'text-color': '#ffffff',
              'text-halo-color': '#991b1b',
              'text-halo-width': 1.5,
            }}
          />
        )}
      </Source>

      {/* Popup on hover */}
      {popupInfo && (
        <Popup
          longitude={popupInfo.longitude}
          latitude={popupInfo.latitude}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={10}
          className="deforestation-popup"
        >
          <div className="p-2 min-w-48">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-red-700">
                ⚠️ Ward {popupInfo.wardNumber}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                popupInfo.details.severity === 'severe' 
                  ? 'bg-red-100 text-red-700' 
                  : popupInfo.details.severity === 'moderate'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {popupInfo.details.severity.toUpperCase()}
              </span>
            </div>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Green Cover Change:</span>
                <span className="font-medium text-red-600">
                  {popupInfo.details.netChangePct.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trees Lost:</span>
                <span className="font-medium">
                  {popupInfo.details.treesLostHa.toFixed(1)} ha
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Built-up Gained:</span>
                <span className="font-medium text-gray-700">
                  +{popupInfo.details.builtGainedHa.toFixed(1)} ha
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Tree Cover:</span>
                <span className="font-medium text-green-600">
                  {popupInfo.details.currentTreesPct.toFixed(1)}%
                </span>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2 border-t pt-2">
              Click to fly to this ward
            </p>
          </div>
        </Popup>
      )}
    </>
  );
};

export default DeforestationHotspotsLayer;
