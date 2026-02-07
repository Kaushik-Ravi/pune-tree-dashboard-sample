// src/components/map/RasterOverlay.tsx
/**
 * RASTER OVERLAY COMPONENT
 * ========================
 * 
 * Renders Cloud Optimized GeoTIFFs (COGs) as continuous heatmap overlays.
 * Uses GeoTIFF.js for reading raster data with HTTP range requests.
 * Supports polygon analysis for custom area statistics.
 * 
 * Available layers:
 * - Tree Probability (2019, 2025) - Continuous 0-100%
 * - Tree Change (2019-2025) - Percentage change
 * - NDVI - Vegetation index
 * - Land Cover Classification
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import * as GeoTIFF from 'geotiff';

// ============================================================================
// TYPES
// ============================================================================

export type RasterLayerType = 
  | 'tree_probability_2025'
  | 'tree_probability_2019'
  | 'tree_change'
  | 'tree_loss_gain'
  | 'ndvi'
  | 'landcover';

export interface RasterOverlayConfig {
  visible: boolean;
  layer: RasterLayerType;
  opacity: number;
  year?: number; // For time-series layers
}

interface RasterOverlayProps {
  config: RasterOverlayConfig;
  onPolygonAnalysis?: (stats: PolygonStats) => void;
  analysisPolygon?: GeoJSON.Polygon | null;
}

export interface PolygonStats {
  layer: RasterLayerType;
  mean: number;
  min: number;
  max: number;
  std: number;
  pixelCount: number;
  areaHa: number;
  histogram?: { value: number; count: number }[];
}

// ============================================================================
// LAYER CONFIGURATIONS
// ============================================================================

interface LayerConfig {
  url: string;
  name: string;
  unit: string;
  colorScale: { value: number; color: string }[];
  noDataValue?: number;
  valueRange: [number, number];
  description: string;
}

const BASE_URL = import.meta.env.DEV 
  ? '/rasters' 
  : 'https://pub-6a88122430ec4e08bc70cf4abd6d1f58.r2.dev/rasters';

const LAYER_CONFIGS: Record<RasterLayerType, LayerConfig> = {
  tree_probability_2025: {
    url: `${BASE_URL}/pune_tree_probability_2025.tif`,
    name: 'Tree Cover 2025',
    unit: '%',
    description: 'Probability of tree/forest cover from Dynamic World',
    valueRange: [0, 100],
    colorScale: [
      { value: 0, color: '#f7fcf5' },
      { value: 10, color: '#c7e9c0' },
      { value: 20, color: '#74c476' },
      { value: 35, color: '#31a354' },
      { value: 50, color: '#006d2c' },
      { value: 100, color: '#00441b' },
    ],
  },
  tree_probability_2019: {
    url: `${BASE_URL}/pune_tree_probability_2019.tif`,
    name: 'Tree Cover 2019',
    unit: '%',
    description: 'Historical tree cover probability',
    valueRange: [0, 100],
    colorScale: [
      { value: 0, color: '#f7fcf5' },
      { value: 10, color: '#c7e9c0' },
      { value: 20, color: '#74c476' },
      { value: 35, color: '#31a354' },
      { value: 50, color: '#006d2c' },
      { value: 100, color: '#00441b' },
    ],
  },
  tree_change: {
    url: `${BASE_URL}/pune_tree_change_2019_2025_pct.tif`,
    name: 'Tree Cover Change',
    unit: '% change',
    description: 'Change in tree probability from 2019 to 2025',
    valueRange: [-50, 50],
    colorScale: [
      { value: -50, color: '#67001f' },  // Dark red - severe loss
      { value: -20, color: '#d6604d' },  // Red - significant loss
      { value: -5, color: '#f4a582' },   // Light red - moderate loss
      { value: 0, color: '#f7f7f7' },    // White - no change
      { value: 5, color: '#92c5de' },    // Light blue - moderate gain
      { value: 20, color: '#4393c3' },   // Blue - significant gain
      { value: 50, color: '#053061' },   // Dark blue - high gain
    ],
  },
  tree_loss_gain: {
    url: `${BASE_URL}/pune_tree_loss_gain_2019_2025.tif`,
    name: 'Tree Loss/Gain',
    unit: '',
    description: 'Binary: -1 = loss, 0 = no change, 1 = gain',
    valueRange: [-1, 1],
    noDataValue: 0,
    colorScale: [
      { value: -1, color: '#d73027' },  // Red - loss
      { value: 0, color: '#ffffbf' },   // Yellow - no change
      { value: 1, color: '#1a9850' },   // Green - gain
    ],
  },
  ndvi: {
    url: `${BASE_URL}/pune_ndvi_2025.tif`,
    name: 'NDVI 2025',
    unit: '',
    description: 'Normalized Difference Vegetation Index',
    valueRange: [-0.2, 0.8],
    colorScale: [
      { value: -0.2, color: '#d73027' },  // Red - no vegetation
      { value: 0, color: '#fee08b' },     // Yellow - bare/sparse
      { value: 0.2, color: '#d9ef8b' },   // Light green
      { value: 0.4, color: '#91cf60' },   // Green
      { value: 0.6, color: '#1a9850' },   // Dark green
      { value: 0.8, color: '#006837' },   // Very dark green
    ],
  },
  landcover: {
    url: `${BASE_URL}/pune_landcover_2025.tif`,
    name: 'Land Cover 2025',
    unit: '',
    description: 'Dynamic World classification',
    valueRange: [0, 8],
    colorScale: [
      { value: 0, color: '#419bdf' },  // Water
      { value: 1, color: '#397d49' },  // Trees
      { value: 2, color: '#88b053' },  // Grass
      { value: 3, color: '#7a87c6' },  // Flooded vegetation
      { value: 4, color: '#e49635' },  // Crops
      { value: 5, color: '#dfc35a' },  // Shrub/Scrub
      { value: 6, color: '#c4281b' },  // Built
      { value: 7, color: '#a59b8f' },  // Bare
      { value: 8, color: '#b39fe1' },  // Snow/Ice
    ],
  },
};

// Land cover class names
const LANDCOVER_CLASSES = [
  'Water', 'Trees', 'Grass', 'Flooded Vegetation', 'Crops',
  'Shrub/Scrub', 'Built Area', 'Bare Ground', 'Snow/Ice'
];

// ============================================================================
// COLOR UTILITIES
// ============================================================================

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [128, 128, 128];
}

function interpolateColor(
  value: number,
  colorScale: { value: number; color: string }[]
): [number, number, number, number] {
  // Find surrounding colors
  let lower = colorScale[0];
  let upper = colorScale[colorScale.length - 1];
  
  for (let i = 0; i < colorScale.length - 1; i++) {
    if (value >= colorScale[i].value && value <= colorScale[i + 1].value) {
      lower = colorScale[i];
      upper = colorScale[i + 1];
      break;
    }
  }
  
  // Interpolate
  const range = upper.value - lower.value;
  const t = range === 0 ? 0 : (value - lower.value) / range;
  
  const lowerRgb = hexToRgb(lower.color);
  const upperRgb = hexToRgb(upper.color);
  
  return [
    Math.round(lowerRgb[0] + (upperRgb[0] - lowerRgb[0]) * t),
    Math.round(lowerRgb[1] + (upperRgb[1] - lowerRgb[1]) * t),
    Math.round(lowerRgb[2] + (upperRgb[2] - lowerRgb[2]) * t),
    255
  ];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const RasterOverlay: React.FC<RasterOverlayProps> = ({
  config,
  onPolygonAnalysis,
  analysisPolygon
}) => {
  const [imageData, setImageData] = useState<{
    canvas: HTMLCanvasElement;
    bounds: [[number, number], [number, number]];
  } | null>(null);
  const [_loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const tiffRef = useRef<GeoTIFF.GeoTIFF | null>(null);
  const imageRef = useRef<GeoTIFF.GeoTIFFImage | null>(null);

  const layerConfig = LAYER_CONFIGS[config.layer];

  // Load and render the raster
  useEffect(() => {
    if (!config.visible || !layerConfig) return;

    const loadRaster = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`[RasterOverlay] Loading ${config.layer}...`);
        
        // Open the COG with HTTP range requests
        const tiff = await GeoTIFF.fromUrl(layerConfig.url, {
          allowFullFile: false, // Force range requests for COG
        });
        tiffRef.current = tiff;

        // Get the first image
        const image = await tiff.getImage();
        imageRef.current = image;

        const width = image.getWidth();
        const height = image.getHeight();
        const bbox = image.getBoundingBox();
        
        console.log(`[RasterOverlay] Image size: ${width}x${height}, bbox:`, bbox);

        // Read the raster data
        const rasterData = await image.readRasters();
        const data = rasterData[0] as Float32Array | Int8Array | Uint8Array;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) throw new Error('Failed to get canvas context');

        // Create image data
        const imgData = ctx.createImageData(width, height);
        
        // Map values to colors
        for (let i = 0; i < data.length; i++) {
          const value = data[i];
          const pixelIndex = i * 4;
          
          // Handle no data
          if (isNaN(value) || value === layerConfig.noDataValue) {
            imgData.data[pixelIndex] = 0;
            imgData.data[pixelIndex + 1] = 0;
            imgData.data[pixelIndex + 2] = 0;
            imgData.data[pixelIndex + 3] = 0; // Transparent
            continue;
          }
          
          // Clamp value to range
          const clampedValue = Math.max(
            layerConfig.valueRange[0],
            Math.min(layerConfig.valueRange[1], value)
          );
          
          const [r, g, b, a] = interpolateColor(clampedValue, layerConfig.colorScale);
          imgData.data[pixelIndex] = r;
          imgData.data[pixelIndex + 1] = g;
          imgData.data[pixelIndex + 2] = b;
          imgData.data[pixelIndex + 3] = a;
        }
        
        ctx.putImageData(imgData, 0, 0);
        
        // Store for rendering
        setImageData({
          canvas,
          bounds: [[bbox[0], bbox[1]], [bbox[2], bbox[3]]]
        });
        
        console.log(`[RasterOverlay] Loaded successfully`);
      } catch (err) {
        console.error('[RasterOverlay] Failed to load:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadRaster();
    
    return () => {
      // Cleanup
      tiffRef.current = null;
      imageRef.current = null;
    };
  }, [config.visible, config.layer, layerConfig]);

  // Analyze polygon when provided
  useEffect(() => {
    const analyzePolygon = async () => {
      if (!analysisPolygon || !imageRef.current || !onPolygonAnalysis) return;
      
      try {
        const image = imageRef.current;
        const bbox = image.getBoundingBox();
        const width = image.getWidth();
        const height = image.getHeight();
        
        // Calculate pixel coordinates for polygon bounds
        const polyBbox = calculatePolygonBounds(analysisPolygon);
        
        // Read a window of the raster
        const rasterData = await image.readRasters({
          window: [
            Math.floor((polyBbox[0] - bbox[0]) / (bbox[2] - bbox[0]) * width),
            Math.floor((bbox[3] - polyBbox[3]) / (bbox[3] - bbox[1]) * height),
            Math.ceil((polyBbox[2] - bbox[0]) / (bbox[2] - bbox[0]) * width),
            Math.ceil((bbox[3] - polyBbox[1]) / (bbox[3] - bbox[1]) * height)
          ]
        });
        
        const data = rasterData[0] as Float32Array;
        
        // Calculate statistics
        const values = Array.from(data).filter(v => !isNaN(v) && v !== layerConfig.noDataValue);
        
        if (values.length === 0) {
          return;
        }
        
        const stats: PolygonStats = {
          layer: config.layer,
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          std: calculateStd(values),
          pixelCount: values.length,
          areaHa: values.length * 100 / 10000, // 10m pixels = 100m², convert to ha
        };
        
        onPolygonAnalysis(stats);
      } catch (err) {
        console.error('[RasterOverlay] Polygon analysis failed:', err);
      }
    };
    
    analyzePolygon();
  }, [analysisPolygon, config.layer, layerConfig, onPolygonAnalysis]);

  // Convert canvas to data URL for MapLibre image source
  const imageUrl = useMemo(() => {
    if (!imageData) return null;
    return imageData.canvas.toDataURL('image/png');
  }, [imageData]);

  if (!config.visible || !imageData || !imageUrl) {
    return null;
  }

  // Render as MapLibre image layer
  return (
    <Source
      id="raster-overlay-source"
      type="image"
      url={imageUrl}
      coordinates={[
        [imageData.bounds[0][0], imageData.bounds[1][1]], // top-left
        [imageData.bounds[1][0], imageData.bounds[1][1]], // top-right
        [imageData.bounds[1][0], imageData.bounds[0][1]], // bottom-right
        [imageData.bounds[0][0], imageData.bounds[0][1]], // bottom-left
      ]}
    >
      <Layer
        id="raster-overlay-layer"
        type="raster"
        paint={{
          'raster-opacity': config.opacity,
          'raster-fade-duration': 0
        }}
      />
    </Source>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculatePolygonBounds(polygon: GeoJSON.Polygon): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const ring of polygon.coordinates) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  
  return [minX, minY, maxX, maxY];
}

function calculateStd(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default RasterOverlay;
export { LAYER_CONFIGS, LANDCOVER_CLASSES };
export type { LayerConfig };
