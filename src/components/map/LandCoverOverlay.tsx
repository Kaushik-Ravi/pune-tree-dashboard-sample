// src/components/map/LandCoverOverlay.tsx
/**
 * LAND COVER OVERLAY
 * ==================
 * 
 * Shows Built vs Green cover on the map with:
 * - Time slider for historical comparison (2019-2025)
 * - Color mode toggle (Green only, Built only, or Bivariate)
 * - Customizable color gradients
 * - Interactive hover tooltips
 * 
 * Uses react-map-gl declarative components for better integration
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre';
import type { FillLayerSpecification } from 'maplibre-gl';
import { useGreenCoverStore } from '../../store/GreenCoverStore';

// API base URL
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

export interface LandCoverOverlayConfig {
  visible: boolean;
  mode: 'green' | 'built' | 'bivariate' | 'change';
  year: number;
  opacity: number;
  showLabels: boolean;
  greenColorScale: [string, string]; // [low, high]
  builtColorScale: [string, string]; // [low, high]
}

interface LandCoverOverlayProps {
  config: LandCoverOverlayConfig;
}

// Ward boundary feature type
interface WardBoundaryFeature {
  type: 'Feature';
  properties: {
    ward_number: number;
    ward_office?: string;
    prabhag_name?: string;
    zone?: number;
    // Added dynamically
    fillColor?: string;
    trees_pct?: number;
    built_pct?: number;
    grass_pct?: number;
    bare_pct?: number;
    net_change_pct?: number;
    trees_area_ha?: string;
    built_area_ha?: string;
  };
  geometry: GeoJSON.Geometry;
}

interface WardBoundaryGeoJSON {
  type: 'FeatureCollection';
  features: WardBoundaryFeature[];
}

// Helper: hex to rgb
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Generate color based on percentage
function getColorForValue(value: number, colorScale: [string, string]): string {
  const [lowColor, highColor] = colorScale;
  const t = Math.min(1, Math.max(0, value / 30)); // Normalize to 30% max for green
  
  const low = hexToRgb(lowColor);
  const high = hexToRgb(highColor);
  
  if (!low || !high) return lowColor;
  
  const r = Math.round(low.r + (high.r - low.r) * t);
  const g = Math.round(low.g + (high.g - low.g) * t);
  const b = Math.round(low.b + (high.b - low.b) * t);
  
  return `rgb(${r}, ${g}, ${b})`;
}

// Bivariate color matrix (green on Y axis, built on X axis)
const BIVARIATE_COLORS = [
  ['#e8e8e8', '#ace4e4', '#5ac8c8'], // Low built
  ['#dfb0d6', '#a5add3', '#5698b9'], // Medium built
  ['#be64ac', '#8c62aa', '#3b4994'], // High built
];

function getBivariateColor(greenPct: number, builtPct: number): string {
  const greenBin = greenPct < 10 ? 0 : greenPct < 20 ? 1 : 2;
  const builtBin = builtPct < 40 ? 0 : builtPct < 60 ? 1 : 2;
  return BIVARIATE_COLORS[builtBin][greenBin];
}

// Change color based on net change percentage
function getChangeColor(changePct: number): string {
  if (changePct <= -5) return '#d73027';
  if (changePct <= -2) return '#fc8d59';
  if (changePct < 0) return '#fee08b';
  if (changePct === 0) return '#ffffbf';
  if (changePct < 2) return '#d9ef8b';
  if (changePct < 5) return '#91cf60';
  return '#1a9850';
}

const LandCoverOverlay: React.FC<LandCoverOverlayProps> = ({ config }) => {
  const { current: map } = useMap();
  const [geojsonData, setGeojsonData] = useState<WardBoundaryGeoJSON | null>(null);
  const [hoveredWard, setHoveredWard] = useState<WardBoundaryFeature | null>(null);
  const [popupCoords, setPopupCoords] = useState<{ lng: number; lat: number } | null>(null);
  
  const { wardData, comparisonData } = useGreenCoverStore();
  
  // Debug logging
  useEffect(() => {
    console.log('[LandCoverOverlay] State:', {
      visible: config.visible,
      mode: config.mode,
      year: config.year,
      geojsonFeatures: geojsonData?.features?.length || 0,
      wardDataCount: wardData?.length || 0,
      comparisonDataCount: comparisonData?.length || 0
    });
  }, [config, geojsonData, wardData, comparisonData]);
  
  // Fetch ward boundaries
  useEffect(() => {
    if (!config.visible) return;
    
    console.log('[LandCoverOverlay] Fetching ward boundaries...');
    fetch(`${API_BASE}/api/ward-boundaries`)
      .then(res => res.json())
      .then((data: WardBoundaryGeoJSON) => {
        console.log('[LandCoverOverlay] Ward boundaries loaded:', data.features?.length || 0);
        if (data.features && data.features.length > 0) {
          setGeojsonData(data);
        }
      })
      .catch(err => console.error('[LandCoverOverlay] Failed to fetch ward boundaries:', err));
  }, [config.visible]);
  
  // Process and enhance GeoJSON with land cover data
  const enhancedGeojson = useMemo<WardBoundaryGeoJSON | null>(() => {
    if (!geojsonData || !wardData) {
      console.log('[LandCoverOverlay] Cannot create enhanced geojson:', {
        hasGeojson: !!geojsonData,
        hasWardData: !!wardData,
        wardDataLength: wardData?.length
      });
      return null;
    }
    
    console.log('[LandCoverOverlay] Processing', geojsonData.features.length, 'features with', wardData.length, 'ward data records for year', config.year);
    
    // Debug: check the first few ward data items
    if (wardData.length > 0) {
      console.log('[LandCoverOverlay] Sample ward data:', wardData.slice(0, 3));
    }
    
    const features = geojsonData.features.map(feature => {
      const wardNumber = feature.properties.ward_number;
      
      // Find land cover data for this ward and year
      const yearData = wardData.find(
        w => w.ward_number === wardNumber && w.year === config.year
      );
      
      // Debug first feature
      if (wardNumber === 1) {
        console.log('[LandCoverOverlay] Ward 1 lookup - config.year:', config.year, 'typeof:', typeof config.year);
        console.log('[LandCoverOverlay] Ward 1 yearData found:', yearData);
      }
      
      // Find change data
      const changeData = comparisonData?.find(w => w.ward_number === wardNumber);
      
      // Calculate fill color based on mode
      let fillColor = '#cccccc';
      
      if (yearData) {
        const greenPct = typeof yearData.trees_pct === 'string' 
          ? parseFloat(yearData.trees_pct) 
          : yearData.trees_pct || 0;
        const builtPct = typeof yearData.built_pct === 'string'
          ? parseFloat(yearData.built_pct)
          : yearData.built_pct || 0;
        
        switch (config.mode) {
          case 'green':
            fillColor = getColorForValue(greenPct, config.greenColorScale);
            break;
          case 'built':
            fillColor = getColorForValue(builtPct * 0.3, config.builtColorScale); // Scale for built
            break;
          case 'bivariate':
            fillColor = getBivariateColor(greenPct, builtPct);
            break;
          case 'change':
            if (changeData) {
              const netChange = typeof changeData.net_tree_change_m2 === 'string'
                ? parseFloat(changeData.net_tree_change_m2)
                : 0;
              const totalArea = typeof yearData.total_area_m2 === 'string'
                ? parseFloat(yearData.total_area_m2)
                : yearData.total_area_m2 || 1;
              const changePct = (netChange / totalArea) * 100;
              fillColor = getChangeColor(changePct);
            }
            break;
        }
      }
      
      // Extract values for properties
      const treesAreaM2 = yearData 
        ? (typeof yearData.trees_area_m2 === 'string' 
            ? parseFloat(yearData.trees_area_m2) 
            : yearData.trees_area_m2 || 0)
        : 0;
      const builtAreaM2 = yearData
        ? (typeof yearData.built_area_m2 === 'string'
            ? parseFloat(yearData.built_area_m2)
            : yearData.built_area_m2 || 0)
        : 0;
      const totalArea = yearData
        ? (typeof yearData.total_area_m2 === 'string'
            ? parseFloat(yearData.total_area_m2)
            : yearData.total_area_m2 || 1)
        : 1;
      const netChangeM2 = changeData
        ? (typeof changeData.net_tree_change_m2 === 'string'
            ? parseFloat(changeData.net_tree_change_m2)
            : 0)
        : 0;
      
      return {
        ...feature,
        properties: {
          ...feature.properties,
          fillColor,
          trees_pct: yearData ? (typeof yearData.trees_pct === 'string' ? parseFloat(yearData.trees_pct) : yearData.trees_pct) : 0,
          built_pct: yearData ? (typeof yearData.built_pct === 'string' ? parseFloat(yearData.built_pct) : yearData.built_pct) : 0,
          grass_pct: yearData ? (typeof yearData.grass_pct === 'string' ? parseFloat(yearData.grass_pct) : yearData.grass_pct) : 0,
          bare_pct: yearData ? (typeof yearData.bare_pct === 'string' ? parseFloat(yearData.bare_pct) : yearData.bare_pct) : 0,
          net_change_pct: totalArea > 0 ? ((netChangeM2 / totalArea) * 100) : 0,
          trees_area_ha: (treesAreaM2 / 10000).toFixed(1),
          built_area_ha: (builtAreaM2 / 10000).toFixed(1)
        }
      };
    });
    
    // Debug: log a sample feature with geometry
    if (features.length > 0) {
      console.log('[LandCoverOverlay] Sample enhanced feature:', {
        ward: features[0].properties.ward_number,
        fillColor: features[0].properties.fillColor,
        hasGeometry: !!features[0].geometry,
        geometryType: features[0].geometry?.type
      });
    }
    
    return {
      type: 'FeatureCollection',
      features
    };
  }, [geojsonData, wardData, comparisonData, config.year, config.mode, config.greenColorScale, config.builtColorScale]);
  
  // Layer style
  const layerStyle: Omit<FillLayerSpecification, 'source'> = {
    id: 'land-cover-overlay',
    type: 'fill',
    paint: {
      'fill-color': ['coalesce', ['get', 'fillColor'], '#888888'],
      'fill-opacity': config.opacity,
      'fill-outline-color': '#333333'
    }
  };
  
  // Set up hover handlers
  useEffect(() => {
    if (!map || !config.visible) return;
    
    const onMouseMove = (e: any) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0] as WardBoundaryFeature;
        setHoveredWard(feature);
        setPopupCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        map.getCanvas().style.cursor = 'pointer';
      }
    };
    
    const onMouseLeave = () => {
      setHoveredWard(null);
      setPopupCoords(null);
      map.getCanvas().style.cursor = '';
    };
    
    map.on('mousemove', 'land-cover-overlay', onMouseMove);
    map.on('mouseleave', 'land-cover-overlay', onMouseLeave);
    
    return () => {
      map.off('mousemove', 'land-cover-overlay', onMouseMove);
      map.off('mouseleave', 'land-cover-overlay', onMouseLeave);
    };
  }, [map, config.visible]);
  
  if (!config.visible || !enhancedGeojson) {
    console.log('[LandCoverOverlay] Not rendering:', { visible: config.visible, hasEnhancedGeojson: !!enhancedGeojson });
    return null;
  }
  
  console.log('[LandCoverOverlay] Rendering with', enhancedGeojson.features.length, 'features');
  
  return (
    <>
      <Source id="land-cover-source" type="geojson" data={enhancedGeojson}>
        <Layer
          {...layerStyle}
        />
      </Source>
      
      {hoveredWard && popupCoords && (
        <Popup
          longitude={popupCoords.lng}
          latitude={popupCoords.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={[0, -10] as [number, number]}
        >
          <div className="font-sans p-1 min-w-[160px]">
            <div className="font-semibold text-sm border-b border-gray-200 pb-1 mb-2">
              Ward {hoveredWard.properties.ward_number}
              <span className="font-normal text-gray-500 text-xs ml-1">({config.year})</span>
            </div>
            
            {config.mode === 'green' && (
              <>
                <div 
                  className="h-1.5 rounded my-1"
                  style={{ background: `linear-gradient(90deg, ${config.greenColorScale[0]}, ${config.greenColorScale[1]})` }}
                />
                <div className="text-lg font-bold text-green-600">
                  {(hoveredWard.properties.trees_pct || 0).toFixed(1)}% Green Cover
                </div>
                <div className="text-xs text-gray-500">
                  {hoveredWard.properties.trees_area_ha} hectares of tree cover
                </div>
              </>
            )}
            
            {config.mode === 'built' && (
              <>
                <div 
                  className="h-1.5 rounded my-1"
                  style={{ background: `linear-gradient(90deg, ${config.builtColorScale[0]}, ${config.builtColorScale[1]})` }}
                />
                <div className="text-lg font-bold text-red-600">
                  {(hoveredWard.properties.built_pct || 0).toFixed(1)}% Built-up
                </div>
                <div className="text-xs text-gray-500">
                  {hoveredWard.properties.built_area_ha} hectares of built area
                </div>
              </>
            )}
            
            {config.mode === 'bivariate' && (
              <>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="text-center p-1 bg-green-50 rounded">
                    <div className="text-base font-bold text-green-600">
                      {(hoveredWard.properties.trees_pct || 0).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Green</div>
                  </div>
                  <div className="text-center p-1 bg-red-50 rounded">
                    <div className="text-base font-bold text-red-600">
                      {(hoveredWard.properties.built_pct || 0).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Built</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Ratio: 1:{((hoveredWard.properties.built_pct || 1) / (hoveredWard.properties.trees_pct || 1)).toFixed(1)}
                </div>
              </>
            )}
            
            {config.mode === 'change' && (
              <>
                <div className={`text-lg font-bold ${(hoveredWard.properties.net_change_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(hoveredWard.properties.net_change_pct || 0) >= 0 ? '↑' : '↓'} 
                  {(hoveredWard.properties.net_change_pct || 0) >= 0 ? '+' : ''}
                  {(hoveredWard.properties.net_change_pct || 0).toFixed(2)}% Change
                </div>
                <div className="text-xs text-gray-500">
                  Green cover change since 2019
                </div>
              </>
            )}
          </div>
        </Popup>
      )}
    </>
  );
};

export default LandCoverOverlay;
