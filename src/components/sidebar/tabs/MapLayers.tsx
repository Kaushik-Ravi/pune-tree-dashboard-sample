// src/components/sidebar/tabs/MapLayers.tsx
import React, { useState } from 'react';
import { Layers as LayersIcon, Thermometer, Zap } from 'lucide-react';
import { LightConfig } from './LightAndShadowControl';
import LightAndShadowControl from './LightAndShadowControl';

export type ShadowQuality = 'low' | 'medium' | 'high' | 'ultra';

interface MapLayersProps {
  baseMap: string;
  changeBaseMap: (mapType: string) => void;
  showLSTOverlay: boolean;
  toggleLSTOverlay: () => void;
  lstMinValue: number;
  lstMaxValue: number;
  onLightChange: (config: LightConfig | null) => void;
  is3D: boolean;
  shadowsEnabled: boolean;
  onShadowsToggle: (enabled: boolean) => void;
  shadowQuality?: ShadowQuality;
  onShadowQualityChange?: (quality: ShadowQuality) => void;
  showTreeShadows?: boolean;
  onTreeShadowsToggle?: (enabled: boolean) => void;
  showBuildingShadows?: boolean;
  onBuildingShadowsToggle?: (enabled: boolean) => void;
}

const MapLayers: React.FC<MapLayersProps> = ({
  baseMap,
  changeBaseMap,
  showLSTOverlay,
  toggleLSTOverlay,
  lstMinValue,
  lstMaxValue,
  onLightChange,
  is3D,
  shadowsEnabled,
  onShadowsToggle,
  shadowQuality = 'high',
  onShadowQualityChange,
  showTreeShadows = true,
  onTreeShadowsToggle,
  showBuildingShadows = true,
  onBuildingShadowsToggle,
}) => {
  const [showAdvancedShadows, setShowAdvancedShadows] = useState(false);

  const lstLegendGradient = 'linear-gradient(to right, #0D1282, #00A9FF, #00E0C7, #90F1AC, #FFF80A, #FFB344, #FF4A4A, #D72323)';

  const qualityDescriptions = {
    low: '512px - Best Performance',
    medium: '1024px - Balanced',
    high: '2048px - High Quality',
    ultra: '4096px - Maximum Detail'
  };

  return (
    <div className="space-y-6">

      {/* 2D Layers Card */}
      <div className="card">
        <div className="card-header"><h3 className="font-medium">Map Visualization</h3></div>
        <div className="card-body">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              <LayersIcon size={14} className="mr-1" />
              Base Map Style
            </label>
            <div className="grid grid-cols-2 gap-2" data-tour-id="basemap-options">
              {['light', 'dark', 'satellite', 'streets'].map((style) => (
                <button
                  key={style}
                  onClick={() => changeBaseMap(style)}
                  className={`px-3 py-2 text-sm rounded-md border transition-all ${baseMap === style
                      ? 'bg-primary-50 border-primary-500 text-primary-700 font-medium ring-1 ring-primary-500'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {is3D && (
        <div className="card ring-2 ring-primary-100 border-primary-200">
          <div className="card-header bg-gradient-to-r from-primary-50 to-white border-b border-primary-100">
            <h3 className="font-medium flex items-center justify-between text-primary-900">
              <span className="flex items-center gap-2">
                <Zap size={16} className="text-primary-600" />
                Environment & Lighting
              </span>
              <button
                onClick={() => setShowAdvancedShadows(!showAdvancedShadows)}
                className="text-xs text-primary-600 hover:text-primary-700 underline decoration-dotted"
              >
                {showAdvancedShadows ? 'Hide Details' : 'Show Details'}
              </button>
            </h3>
          </div>
          <div className="card-body space-y-4">

            {/* MASTER TOGGLE */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center">
                <div>
                  <div className="font-medium text-gray-900">Enable 3D Shadows</div>
                  <div className="text-xs text-gray-500">Realistic sun & building physics</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={shadowsEnabled}
                  onChange={(e) => onShadowsToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* UNIFIED CONTROLS - Controlled by shadowsEnabled */}
            {shadowsEnabled && (
              <div className="space-y-4 animate-fade-in">

                {/* 1. Time & Date Control (Only visible when shadows are ON) */}
                <LightAndShadowControl
                  onLightChange={onLightChange}
                  is3D={is3D}
                  enabled={shadowsEnabled} // Pass master state
                />

                {/* 2. Advanced Quality Settings */}
                {showAdvancedShadows && (
                  <div className="pt-4 border-t border-gray-100 space-y-4">
                    <div className="space-y-2">
                      {/* Quality Selector */}
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rendering Quality</label>
                      <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-md">
                        {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
                          <button
                            key={q}
                            onClick={() => onShadowQualityChange?.(q)}
                            className={`py-1.5 text-xs rounded transition-all font-medium ${shadowQuality === q
                                ? 'bg-white text-primary-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                              }`}
                            title={qualityDescriptions[q]}
                          >
                            {q.charAt(0).toUpperCase() + q.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 italic text-right">
                        {qualityDescriptions[shadowQuality || 'high']}
                      </p>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Casting Options</label>
                      <label className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                        <span className="text-sm text-gray-700">Cast Tree Shadows</span>
                        <input type="checkbox" checked={showTreeShadows} onChange={(e) => onTreeShadowsToggle?.(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500" />
                      </label>
                      <label className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                        <span className="text-sm text-gray-700">Cast Building Shadows</span>
                        <input type="checkbox" checked={showBuildingShadows} onChange={(e) => onBuildingShadowsToggle?.(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500" />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* LST Overlay Card */}
      <div className="card">
        <div className="card-header"><h3 className="font-medium">Map Overlays</h3></div>
        <div className="card-body"><div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Thermometer size={18} className="text-gray-500 mr-2" />
              <div><div className="font-medium">Land Surface Temp.</div><div className="text-xs text-gray-500">Show LST overlay & legend</div></div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={showLSTOverlay} onChange={toggleLSTOverlay} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div></div>
      </div>

      {/* Legend Card */}
      <div className="card">
        <div className="card-header"><h3 className="font-medium">Legend</h3></div>
        <div className="card-body space-y-3">
          <div className="flex items-center">
            <div
              className="h-4 w-4 rounded-full mr-2 border-2 border-white shadow-md"
              style={{ backgroundColor: '#2E7D32' }}
            ></div>
            <div className="text-sm">Tree Location</div>
          </div>

          <div className="flex items-center">
            <div className="h-4 w-4 rounded-sm border border-primary-600 bg-primary-50 mr-2"></div>
            <div className="text-sm">Selected Area (Drawn)</div>
          </div>
          <div className="flex items-center">
            <div className="h-4 w-4 rounded-full bg-[#4ade80] mr-2 border border-white shadow-sm"></div>
            <div className="text-sm">Simulated Planting Location</div>
          </div>

          {showLSTOverlay && (
            <div className="pt-3 mt-3 border-t border-gray-200">
              <h4 className="font-semibold text-sm mb-2 flex items-center"><Thermometer size={16} className="mr-1 text-red-500" />Land Surface Temperature (C)</h4>
              <div className="w-full h-3 rounded-sm" style={{ background: lstLegendGradient }}></div>
              <div className="flex justify-between text-xs mt-1 text-gray-600 px-0.5"><span>{lstMinValue.toFixed(1)}</span><span>{lstMaxValue.toFixed(1)}</span></div>
              <p className="text-xs text-gray-500 mt-1 text-center">(Colors approximate 'Turbo' colormap)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapLayers;