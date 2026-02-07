// src/hooks/useRasterPixelValue.ts
/**
 * RASTER PIXEL VALUE HOOK
 * =======================
 * 
 * Reads pixel values from Cloud Optimized GeoTIFFs (COGs) at a given coordinate.
 * Uses HTTP range requests to efficiently read only the needed data.
 * Supports debouncing for smooth hover interaction.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as GeoTIFF from 'geotiff';
import { RasterLayerType, LAYER_CONFIGS, LANDCOVER_CLASSES } from '../components/map/RasterOverlay';

// ============================================================================
// TYPES
// ============================================================================

export interface RasterPixelInfo {
  /** Layer type being queried */
  layer: RasterLayerType;
  /** Layer display name */
  layerName: string;
  /** Raw pixel value */
  value: number;
  /** Formatted value string (with unit) */
  formattedValue: string;
  /** Unit of measurement */
  unit: string;
  /** For landcover: class name */
  className?: string;
  /** Color for the value */
  color: string;
  /** Description of what this value means */
  description: string;
  /** Coordinates where the value was read */
  coordinates: { lng: number; lat: number };
  /** Whether this is a no-data pixel */
  isNoData: boolean;
}

interface UseRasterPixelValueOptions {
  /** Current raster layer config */
  layer: RasterLayerType | null;
  /** Whether the raster layer is visible */
  visible: boolean;
  /** Debounce delay in ms (default: 100) */
  debounceMs?: number;
}

// ============================================================================
// CACHE FOR GEOTIFF INSTANCES
// ============================================================================

const tiffCache = new Map<string, {
  tiff: GeoTIFF.GeoTIFF;
  image: GeoTIFF.GeoTIFFImage;
  bbox: number[];
  width: number;
  height: number;
}>();

// ============================================================================
// UTILITY FUNCTIONS
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
): string {
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
  
  const r = Math.round(lowerRgb[0] + (upperRgb[0] - lowerRgb[0]) * t);
  const g = Math.round(lowerRgb[1] + (upperRgb[1] - lowerRgb[1]) * t);
  const b = Math.round(lowerRgb[2] + (upperRgb[2] - lowerRgb[2]) * t);
  
  return `rgb(${r}, ${g}, ${b})`;
}

function formatValue(value: number, layer: RasterLayerType, config: typeof LAYER_CONFIGS[RasterLayerType]): string {
  if (layer === 'landcover') {
    // Return class index as is
    return LANDCOVER_CLASSES[Math.round(value)] || `Class ${value}`;
  }
  
  if (layer === 'ndvi') {
    return value.toFixed(3);
  }
  
  if (layer === 'tree_loss_gain') {
    if (value < -0.5) return 'Tree Loss';
    if (value > 0.5) return 'Tree Gain';
    return 'No Change';
  }
  
  if (layer === 'tree_change') {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}${config.unit}`;
  }
  
  // Default: tree probability
  return `${value.toFixed(1)}${config.unit}`;
}

function getValueDescription(value: number, layer: RasterLayerType): string {
  switch (layer) {
    case 'tree_probability_2025':
    case 'tree_probability_2019':
      if (value >= 70) return 'Dense tree cover';
      if (value >= 40) return 'Moderate tree cover';
      if (value >= 20) return 'Sparse tree cover';
      if (value >= 5) return 'Very sparse vegetation';
      return 'No/minimal tree cover';
      
    case 'tree_change':
      if (value >= 20) return 'Significant tree gain';
      if (value >= 5) return 'Moderate tree gain';
      if (value >= -5) return 'Relatively stable';
      if (value >= -20) return 'Moderate tree loss';
      return 'Significant tree loss';
      
    case 'tree_loss_gain':
      if (value < -0.5) return 'Area lost tree cover since 2019';
      if (value > 0.5) return 'Area gained tree cover since 2019';
      return 'No significant change in tree cover';
      
    case 'ndvi':
      if (value >= 0.6) return 'Very healthy/dense vegetation';
      if (value >= 0.4) return 'Healthy vegetation';
      if (value >= 0.2) return 'Moderate vegetation';
      if (value >= 0) return 'Sparse/stressed vegetation';
      return 'No vegetation / water / built-up';
      
    case 'landcover':
      return `Land classified as ${LANDCOVER_CLASSES[Math.round(value)] || 'Unknown'}`;
      
    default:
      return '';
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useRasterPixelValue(options: UseRasterPixelValueOptions) {
  const { layer, visible, debounceMs = 100 } = options;
  
  const [pixelInfo, setPixelInfo] = useState<RasterPixelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load/cache the GeoTIFF for the current layer
  useEffect(() => {
    if (!layer || !visible) return;
    
    const loadTiff = async () => {
      const config = LAYER_CONFIGS[layer];
      if (!config) return;
      
      // Check cache
      if (tiffCache.has(config.url)) {
        console.log(`[RasterPixelValue] Using cached TIFF for ${layer}`);
        return;
      }
      
      try {
        console.log(`[RasterPixelValue] Loading TIFF for ${layer}...`);
        const tiff = await GeoTIFF.fromUrl(config.url, {
          allowFullFile: false,
        });
        const image = await tiff.getImage();
        
        tiffCache.set(config.url, {
          tiff,
          image,
          bbox: image.getBoundingBox(),
          width: image.getWidth(),
          height: image.getHeight(),
        });
        
        console.log(`[RasterPixelValue] Cached TIFF for ${layer}`);
      } catch (err) {
        console.error(`[RasterPixelValue] Failed to load TIFF:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load raster');
      }
    };
    
    loadTiff();
  }, [layer, visible]);

  // Read pixel value at coordinates
  const readPixelValue = useCallback(async (lng: number, lat: number) => {
    if (!layer || !visible) {
      setPixelInfo(null);
      return;
    }
    
    const config = LAYER_CONFIGS[layer];
    if (!config) return;
    
    const cached = tiffCache.get(config.url);
    if (!cached) {
      // TIFF not loaded yet
      return;
    }
    
    const { image, bbox, width, height } = cached;
    
    // Check if coordinate is within bounds
    if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) {
      setPixelInfo(null);
      return;
    }
    
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    
    try {
      // Convert coordinates to pixel position
      const pixelX = Math.floor((lng - bbox[0]) / (bbox[2] - bbox[0]) * width);
      const pixelY = Math.floor((bbox[3] - lat) / (bbox[3] - bbox[1]) * height);
      
      // Read a small window (1x1 pixel)
      const rasterData = await image.readRasters({
        window: [pixelX, pixelY, pixelX + 1, pixelY + 1],
        signal: abortControllerRef.current.signal,
      });
      
      const value = (rasterData[0] as Float32Array | Int8Array | Uint8Array)[0];
      
      // Check for no data
      const isNoData = isNaN(value) || value === config.noDataValue;
      
      if (isNoData) {
        setPixelInfo({
          layer,
          layerName: config.name,
          value: NaN,
          formattedValue: 'No data',
          unit: '',
          color: '#808080',
          description: 'No data available at this location',
          coordinates: { lng, lat },
          isNoData: true,
        });
      } else {
        // Get color for this value
        const color = layer === 'landcover'
          ? config.colorScale[Math.round(value)]?.color || '#808080'
          : interpolateColor(value, config.colorScale);
        
        setPixelInfo({
          layer,
          layerName: config.name,
          value,
          formattedValue: formatValue(value, layer, config),
          unit: config.unit,
          className: layer === 'landcover' ? LANDCOVER_CLASSES[Math.round(value)] : undefined,
          color,
          description: getValueDescription(value, layer),
          coordinates: { lng, lat },
          isNoData: false,
        });
      }
      
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignore abort errors
        return;
      }
      console.error('[RasterPixelValue] Failed to read pixel:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [layer, visible]);

  // Debounced version for hover events
  const readPixelValueDebounced = useCallback((lng: number, lat: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      readPixelValue(lng, lat);
    }, debounceMs);
  }, [readPixelValue, debounceMs]);

  // Clear pixel info
  const clearPixelInfo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setPixelInfo(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    pixelInfo,
    isLoading,
    error,
    readPixelValue: readPixelValueDebounced,
    readPixelValueImmediate: readPixelValue,
    clearPixelInfo,
  };
}

export default useRasterPixelValue;
