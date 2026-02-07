// src/components/map/RasterTooltip.tsx
/**
 * RASTER TOOLTIP COMPONENT
 * ========================
 * 
 * Displays raster pixel information on hover.
 * Shows layer name, value, unit, and contextual description.
 * Positioned relative to cursor position on the map.
 */

import React from 'react';
import { RasterPixelInfo } from '../../hooks/useRasterPixelValue';
import { 
  TreeDeciduous, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Layers,
  Leaf,
  Building,
  Droplets,
  Mountain,
  Wheat,
  Loader2
} from 'lucide-react';

interface RasterTooltipProps {
  pixelInfo: RasterPixelInfo | null;
  isLoading?: boolean;
  position: { x: number; y: number } | null;
}

// ============================================================================
// ICON HELPERS
// ============================================================================

function getLayerIcon(layer: string) {
  const iconProps = { size: 16, className: 'shrink-0' };
  
  switch (layer) {
    case 'tree_probability_2025':
    case 'tree_probability_2019':
      return <TreeDeciduous {...iconProps} className="text-green-600" />;
    case 'tree_change':
    case 'tree_loss_gain':
      return <TrendingUp {...iconProps} className="text-blue-600" />;
    case 'ndvi':
      return <Leaf {...iconProps} className="text-emerald-600" />;
    case 'landcover':
      return <Layers {...iconProps} className="text-purple-600" />;
    default:
      return <Layers {...iconProps} className="text-gray-600" />;
  }
}

function getLandCoverIcon(className?: string) {
  const iconProps = { size: 14, className: 'shrink-0' };
  
  switch (className) {
    case 'Water':
      return <Droplets {...iconProps} className="text-blue-500" />;
    case 'Trees':
      return <TreeDeciduous {...iconProps} className="text-green-700" />;
    case 'Grass':
      return <Leaf {...iconProps} className="text-green-500" />;
    case 'Built Area':
      return <Building {...iconProps} className="text-red-600" />;
    case 'Bare Ground':
      return <Mountain {...iconProps} className="text-amber-600" />;
    case 'Crops':
      return <Wheat {...iconProps} className="text-yellow-600" />;
    default:
      return <Layers {...iconProps} className="text-gray-500" />;
  }
}

function getChangeIndicator(value: number, layer: string) {
  const iconProps = { size: 14 };
  
  if (layer === 'tree_change') {
    if (value >= 5) return <TrendingUp {...iconProps} className="text-green-600" />;
    if (value <= -5) return <TrendingDown {...iconProps} className="text-red-600" />;
    return <Minus {...iconProps} className="text-gray-500" />;
  }
  
  if (layer === 'tree_loss_gain') {
    if (value > 0.5) return <TrendingUp {...iconProps} className="text-green-600" />;
    if (value < -0.5) return <TrendingDown {...iconProps} className="text-red-600" />;
    return <Minus {...iconProps} className="text-gray-500" />;
  }
  
  return null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const RasterTooltip: React.FC<RasterTooltipProps> = ({
  pixelInfo,
  isLoading = false,
  position
}) => {
  if (!position || (!pixelInfo && !isLoading)) {
    return null;
  }

  // Position tooltip offset from cursor
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x + 15,
    top: position.y - 10,
    zIndex: 1000,
    pointerEvents: 'none',
    maxWidth: '280px',
  };

  // Adjust if tooltip would go off screen
  if (position.x > window.innerWidth - 300) {
    tooltipStyle.left = position.x - 290;
  }
  if (position.y > window.innerHeight - 150) {
    tooltipStyle.top = position.y - 130;
  }

  if (isLoading) {
    return (
      <div style={tooltipStyle}>
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-3 py-2">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 size={14} className="animate-spin" />
            <span>Reading value...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!pixelInfo) {
    return null;
  }

  const { layer, layerName, formattedValue, value, color, description, className, isNoData } = pixelInfo;

  return (
    <div style={tooltipStyle}>
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
          {getLayerIcon(layer)}
          <span className="font-medium text-sm text-gray-800">{layerName}</span>
        </div>
        
        {/* Content */}
        <div className="px-3 py-2 space-y-2">
          {isNoData ? (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300" />
              <span className="text-sm italic">No data at this location</span>
            </div>
          ) : (
            <>
              {/* Value display */}
              <div className="flex items-center gap-2">
                {/* Color swatch */}
                <div 
                  className="w-5 h-5 rounded border border-gray-300 shadow-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                
                {/* Value */}
                <div className="flex items-center gap-1.5">
                  {layer === 'landcover' && className ? (
                    <>
                      {getLandCoverIcon(className)}
                      <span className="font-semibold text-gray-800">{className}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-gray-800 text-lg">
                        {formattedValue}
                      </span>
                      {getChangeIndicator(value, layer)}
                    </>
                  )}
                </div>
              </div>
              
              {/* Description */}
              <p className="text-xs text-gray-500 leading-relaxed">
                {description}
              </p>
              
              {/* Raw value for technical users (subtle) */}
              {layer !== 'landcover' && (
                <div className="text-[10px] text-gray-400 font-mono">
                  Raw: {typeof value === 'number' ? value.toFixed(4) : value}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Coordinates */}
        <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
          <div className="text-[10px] text-gray-400 font-mono">
            {pixelInfo.coordinates.lat.toFixed(5)}°N, {pixelInfo.coordinates.lng.toFixed(5)}°E
          </div>
        </div>
      </div>
    </div>
  );
};

export default RasterTooltip;
