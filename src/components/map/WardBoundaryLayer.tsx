// src/components/map/WardBoundaryLayer.tsx
/**
 * WARD BOUNDARY LAYER
 * ===================
 * 
 * Displays ward boundaries on the map with choropleth coloring based on Green Score.
 * Integrates with the Green Cover Monitor component for time-based visualization.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { LayerProps, MapLayerMouseEvent, MapLayerTouchEvent } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import * as turf from '@turf/turf';
import { useGreenCoverStore } from '../../store/GreenCoverStore';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Types
interface WardBoundaryFeature {
  type: 'Feature';
  properties: {
    ward_number: number;
    ward_office: string;
    prabhag_name: string;
    zone: number;
    tree_count: number;
    // Added dynamically from land cover data
    green_score?: number;
    trees_pct?: number;
    built_pct?: number;
    net_change_ha?: number;
  };
  geometry: GeoJSON.Geometry;
}

interface WardBoundaryGeoJSON {
  type: 'FeatureCollection';
  features: WardBoundaryFeature[];
}

interface WardLandCover {
  ward_number: number;
  year: number;
  trees_pct: string | number;
  built_pct: string | number;
}

interface WardComparison {
  ward_number: number;
  net_tree_change_m2: string;
}

interface WardBoundaryLayerProps {
  mapRef: React.RefObject<MapRef>;
  visible: boolean;
  selectedYear: number;
  colorBy: 'green_score' | 'trees_pct' | 'change';
  opacity?: number;
  onWardClick?: (wardNumber: number) => void;
  onWardHover?: (wardNumber: number | null) => void;
}

// Calculate Green Score (simplified version)
function calculateGreenScore(treesPct: number, builtPct: number): number {
  const treeScore = Math.min(100, (treesPct / 25) * 100);
  const builtScore = Math.max(0, 100 - (builtPct / 90) * 100);
  const score = treeScore * 0.6 + builtScore * 0.4;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// Get color for score (Green-Yellow-Red scale)
function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e'; // Green - Good
  if (score >= 50) return '#eab308'; // Yellow - Moderate
  if (score >= 30) return '#f97316'; // Orange - Poor
  return '#ef4444'; // Red - Critical
}

// Get color for tree percentage
function getTreesPctColor(pct: number): string {
  if (pct >= 20) return '#14532d'; // Dark green
  if (pct >= 15) return '#22c55e'; // Green
  if (pct >= 10) return '#84cc16'; // Light green
  if (pct >= 5) return '#eab308';  // Yellow
  return '#ef4444'; // Red
}

// Get color for change
function getChangeColor(changeHa: number): string {
  if (changeHa > 50) return '#14532d';  // Large gain - Dark green
  if (changeHa > 10) return '#22c55e';  // Gain - Green
  if (changeHa > -10) return '#eab308'; // Neutral - Yellow
  if (changeHa > -50) return '#f97316'; // Loss - Orange
  return '#ef4444'; // Large loss - Red
}

const WardBoundaryLayer: React.FC<WardBoundaryLayerProps> = ({
  mapRef,
  visible,
  selectedYear,
  colorBy = 'green_score',
  opacity = 0.6,
  onWardClick,
  onWardHover,
}) => {
  const [wardBoundaries, setWardBoundaries] = useState<WardBoundaryGeoJSON | null>(null);
  const [landCoverData, setLandCoverData] = useState<WardLandCover[]>([]);
  const [comparisonData, setComparisonData] = useState<WardComparison[]>([]);
  const [hoveredWard, setHoveredWard] = useState<number | null>(null);
  const [popupInfo, setPopupInfo] = useState<{
    longitude: number;
    latitude: number;
    ward: WardBoundaryFeature['properties'];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to fly-to-ward requests from the store
  const { selectedWardNumber, flyToWardTrigger } = useGreenCoverStore();

  // Fly to selected ward when triggered
  useEffect(() => {
    if (!selectedWardNumber || !wardBoundaries || !mapRef.current) return;

    // Find the ward feature
    const wardFeature = wardBoundaries.features.find(
      f => f.properties.ward_number === selectedWardNumber
    );

    if (!wardFeature) {
      console.warn(`Ward ${selectedWardNumber} not found in boundaries`);
      return;
    }

    try {
      // Calculate bounding box of the ward
      const bbox = turf.bbox(wardFeature as any) as [number, number, number, number];
      
      const map = mapRef.current.getMap();
      
      // Fly to the ward with a nice animation
      map.fitBounds(bbox, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 1500,
        maxZoom: 14,
      });

      // Set this ward as hovered to highlight it
      setHoveredWard(selectedWardNumber);

      // Show popup at center of ward
      const center = turf.center(wardFeature as any);
      if (center && center.geometry) {
        const yearData = landCoverData.filter(d => d.year === selectedYear);
        const landCover = yearData.find(d => d.ward_number === selectedWardNumber);
        const comparison = comparisonData.find(d => d.ward_number === selectedWardNumber);

        const treesPct = landCover 
          ? (typeof landCover.trees_pct === 'string' ? parseFloat(landCover.trees_pct) : landCover.trees_pct)
          : 0;
        const builtPct = landCover
          ? (typeof landCover.built_pct === 'string' ? parseFloat(landCover.built_pct) : landCover.built_pct)
          : 0;
        const netChangeHa = comparison 
          ? parseFloat(comparison.net_tree_change_m2) / 10000 
          : 0;

        setPopupInfo({
          longitude: center.geometry.coordinates[0],
          latitude: center.geometry.coordinates[1],
          ward: {
            ...wardFeature.properties,
            green_score: calculateGreenScore(treesPct, builtPct),
            trees_pct: treesPct,
            built_pct: builtPct,
            net_change_ha: netChangeHa,
          }
        });
      }

      // Clear selection after animation (optional - keeps highlight until user clicks elsewhere)
      // setTimeout(() => clearSelectedWard(), 3000);

    } catch (err) {
      console.error('Error flying to ward:', err);
    }
  }, [selectedWardNumber, flyToWardTrigger, wardBoundaries, mapRef, landCoverData, comparisonData, selectedYear]);

  // Fetch ward boundaries and land cover data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [boundariesRes, landCoverRes, comparisonRes] = await Promise.all([
          fetch(`${API_BASE}/api/ward-boundaries`),
          fetch(`${API_BASE}/api/land-cover/wards`),
          fetch(`${API_BASE}/api/land-cover/comparison?from_year=2019&to_year=2025`)
        ]);

        const [boundaries, landCover, comparison] = await Promise.all([
          boundariesRes.json(),
          landCoverRes.json(),
          comparisonRes.json()
        ]);

        setWardBoundaries(boundaries);
        setLandCoverData(landCover.data || []);
        setComparisonData(comparison.data || []);
      } catch (err) {
        console.error('Error fetching ward data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Combine boundary data with land cover data
  const enrichedGeoJSON = useMemo(() => {
    if (!wardBoundaries) return null;

    const yearData = landCoverData.filter(d => d.year === selectedYear);

    return {
      ...wardBoundaries,
      features: wardBoundaries.features.map(feature => {
        const wardNum = feature.properties.ward_number;
        const landCover = yearData.find(d => d.ward_number === wardNum);
        const comparison = comparisonData.find(d => d.ward_number === wardNum);

        const treesPct = landCover 
          ? (typeof landCover.trees_pct === 'string' ? parseFloat(landCover.trees_pct) : landCover.trees_pct)
          : 0;
        const builtPct = landCover
          ? (typeof landCover.built_pct === 'string' ? parseFloat(landCover.built_pct) : landCover.built_pct)
          : 0;
        const netChangeHa = comparison 
          ? parseFloat(comparison.net_tree_change_m2) / 10000 
          : 0;

        const greenScore = calculateGreenScore(treesPct, builtPct);

        // Determine fill color based on colorBy mode
        let fillColor: string;
        switch (colorBy) {
          case 'trees_pct':
            fillColor = getTreesPctColor(treesPct);
            break;
          case 'change':
            fillColor = getChangeColor(netChangeHa);
            break;
          default:
            fillColor = getScoreColor(greenScore);
        }

        return {
          ...feature,
          properties: {
            ...feature.properties,
            green_score: greenScore,
            trees_pct: treesPct,
            built_pct: builtPct,
            net_change_ha: netChangeHa,
            fill_color: fillColor,
          }
        };
      })
    };
  }, [wardBoundaries, landCoverData, comparisonData, selectedYear, colorBy]);

  // Handle mouse events - use mousemove for smoother tracking
  const handleMouseMove = (e: MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const wardNum = feature.properties?.ward_number;
      
      // Only update if ward changed to avoid unnecessary re-renders
      if (wardNum !== hoveredWard) {
        setHoveredWard(wardNum);
        onWardHover?.(wardNum);
      }

      // Always update popup position for smooth tracking
      if (e.lngLat) {
        setPopupInfo({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          ward: feature.properties as WardBoundaryFeature['properties']
        });
      }
    }
  };

  const handleMouseLeave = () => {
    setHoveredWard(null);
    setPopupInfo(null);
    onWardHover?.(null);
  };

  const handleClick = (e: MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const wardNum = feature.properties?.ward_number;
      onWardClick?.(wardNum);
    }
  };

  // Handle touch events for mobile - separate handler with correct types
  const handleTouchStart = useCallback((e: MapLayerTouchEvent) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const wardNum = feature.properties?.ward_number;
      
      setHoveredWard(wardNum);
      onWardHover?.(wardNum);

      if (e.lngLat) {
        setPopupInfo({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          ward: feature.properties as WardBoundaryFeature['properties']
        });
      }
    }
  }, [onWardHover]);

  const handleTouchEnd = useCallback((e: MapLayerTouchEvent) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const wardNum = feature.properties?.ward_number;
      onWardClick?.(wardNum);
    }
  }, [onWardClick]);

  // Set up event listeners on map
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !visible) return;

    // Use mousemove for smoother hover experience
    map.on('mousemove', 'ward-fill', handleMouseMove);
    map.on('mouseleave', 'ward-fill', handleMouseLeave);
    map.on('click', 'ward-fill', handleClick);
    
    // Touch support for mobile devices
    map.on('touchstart', 'ward-fill', handleTouchStart as any);
    map.on('touchend', 'ward-fill', handleTouchEnd as any);
    
    // Change cursor on hover
    map.on('mouseenter', 'ward-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'ward-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    return () => {
      map.off('mousemove', 'ward-fill', handleMouseMove);
      map.off('mouseleave', 'ward-fill', handleMouseLeave);
      map.off('click', 'ward-fill', handleClick);
      map.off('touchstart', 'ward-fill', handleTouchStart as any);
      map.off('touchend', 'ward-fill', handleTouchEnd as any);
      map.off('mouseenter', 'ward-fill', () => {});
      map.off('mouseleave', 'ward-fill', () => {});
    };
  }, [mapRef, visible, onWardClick, onWardHover, hoveredWard, handleTouchStart, handleTouchEnd]);

  if (!visible || loading || !enrichedGeoJSON) {
    return null;
  }

  // Layer styles
  const fillLayer: LayerProps = {
    id: 'ward-fill',
    type: 'fill',
    paint: {
      'fill-color': ['get', 'fill_color'],
      'fill-opacity': [
        'case',
        ['==', ['get', 'ward_number'], hoveredWard ?? -1],
        opacity + 0.2,
        opacity
      ],
    },
  };

  const lineLayer: LayerProps = {
    id: 'ward-line',
    type: 'line',
    paint: {
      'line-color': '#374151',
      'line-width': [
        'case',
        ['==', ['get', 'ward_number'], hoveredWard ?? -1],
        3,
        1.5
      ],
      'line-opacity': 0.8,
    },
  };

  const labelLayer: LayerProps = {
    id: 'ward-label',
    type: 'symbol',
    layout: {
      'text-field': ['concat', 'W', ['get', 'ward_number']],
      'text-size': 11,
      'text-anchor': 'center',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#1f2937',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  };

  return (
    <>
      <Source id="ward-boundaries" type="geojson" data={enrichedGeoJSON}>
        <Layer {...fillLayer} />
        <Layer {...lineLayer} />
        <Layer {...labelLayer} />
      </Source>

      {/* Popup on hover - follows cursor smoothly, touch-friendly */}
      {popupInfo && (
        <Popup
          longitude={popupInfo.longitude}
          latitude={popupInfo.latitude}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          className="ward-popup touch-action-none"
          offset={[0, -10] as [number, number]}
          maxWidth="280px"
        >
          <div 
            className="p-3 min-w-[200px] max-w-[260px] bg-white rounded-lg shadow-lg"
            onTouchStart={(e) => e.stopPropagation()}
          >
            <h4 className="font-bold text-gray-800 text-base mb-0.5">
              Ward {popupInfo.ward.ward_number}
            </h4>
            <p className="text-xs text-gray-500 mb-3">{popupInfo.ward.prabhag_name}</p>
            
            <div className="space-y-2 text-sm">
              {/* Green Score - prominent */}
              <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                <span className="text-gray-600 font-medium">Green Score</span>
                <span 
                  className="font-bold text-lg"
                  style={{ color: getScoreColor(popupInfo.ward.green_score || 0) }}
                >
                  {popupInfo.ward.green_score || 0}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-green-50 rounded">
                  <p className="text-xs text-gray-500">Tree Cover</p>
                  <p className="font-bold text-green-700">
                    {(popupInfo.ward.trees_pct || 0).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-2 bg-gray-100 rounded">
                  <p className="text-xs text-gray-500">Built-up</p>
                  <p className="font-bold text-gray-700">
                    {(popupInfo.ward.built_pct || 0).toFixed(1)}%
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-gray-600">Green Cover Change</span>
                <span className={`font-bold ${(popupInfo.ward.net_change_ha || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(popupInfo.ward.net_change_ha || 0) >= 0 ? '+' : ''}{(popupInfo.ward.net_change_ha || 0).toFixed(1)} ha
                </span>
              </div>
              <p className="text-xs text-gray-400 text-right">2019 → 2025</p>
              
              <div className="flex justify-between items-center text-xs text-gray-500 pt-1 border-t">
                <span>Census Trees</span>
                <span className="font-medium">
                  {(popupInfo.ward.tree_count || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
};

export default WardBoundaryLayer;
