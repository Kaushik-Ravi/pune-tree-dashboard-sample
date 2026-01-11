// src/components/sidebar/tabs/MapLayers.tsx
import React, { useState } from 'react';
import { Layers as LayersIcon, Thermometer, Zap, Sun as SunIcon, ChevronDown } from 'lucide-react';
import { LightConfig } from './LightAndShadowControl'; // --- MODIFIED ---
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
      
      {is3D && (
        <div className="card shadow-md border border-gray-200">
          <div className="card-header bg-gray-50 border-b border-gray-100 flex justify-between items-center py-3">
            <h3 className="font-semibold text-gray-800 flex items-center">
              <SunIcon size={18} className="mr-2 text-amber-500" />
              Environment & Lighting
            </h3>
            
            {/* Master Toggle */}
            <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer" title="Enable/Disable Shadows">
                    <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={shadowsEnabled} 
                    onChange={(e) => onShadowsToggle(e.target.checked)} 
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
            </div>
          </div>
          
          <div className={`card-body space-y-4 p-4 transition-all duration-300 ${!shadowsEnabled ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
            {/* Unified Light Control */}
            <LightAndShadowControl onLightChange={onLightChange} is3D={is3D} />

            {/* Quality Settings (Collapsible) */}
            <div className="pt-4 border-t border-gray-100">
                <button 
                  onClick={() => setShowAdvancedShadows(!showAdvancedShadows)}
                  className="w-full flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  <span>Rendering Quality</span>
                  <ChevronDown size={14} className={`transform transition-transform ${showAdvancedShadows ? 'rotate-180' : ''}`} />
                </button>
                
                {showAdvancedShadows && (
                    <div className="mt-3 space-y-4 animate-fade-in-down">
                        <div className="space-y-2">
                        <label className="text-sm text-gray-600 flex items-center">
                            <Zap size={14} className="mr-1.5 text-gray-400" />
                            Shadow Resolution
                        </label>
                        <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-lg">
                            {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
                            <button
                                key={q}
                                onClick={() => onShadowQualityChange?.(q)}
                                className={`text-xs py-1.5 rounded-md capitalize font-medium transition-all ${
                                shadowQuality === q
                                    ? 'bg-white text-primary-700 shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                                title={qualityDescriptions[q]}
                            >
                                {q}
                            </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-400 pl-1">
                            {qualityDescriptions[shadowQuality || 'high']}
                        </p>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['low', 'medium', 'high', 'ultra'] as ShadowQuality[]).map((quality) => (
                      <button
                        key={quality}
                        onClick={() => onShadowQualityChange?.(quality)}
                        className={`p-2 rounded-md text-xs font-medium transition-all ${
                          shadowQuality === quality
                            ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {quality.charAt(0).toUpperCase() + quality.slice(1)}
                        {shadowQuality === quality && (
                          <div className="text-[10px] mt-0.5 opacity-90">
                            {qualityDescriptions[quality].split(' - ')[1]}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {qualityDescriptions[shadowQuality]}
                  </p>
                </div>

                {/* Advanced Settings */}
                {showAdvancedShadows && (
                  <div className="space-y-3 pt-3 border-t border-gray-200">
                    {/* Tree Shadows Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">Tree Shadows</div>
                        <div className="text-xs text-gray-500">Shadows from tree canopies</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={showTreeShadows} 
                          onChange={(e) => onTreeShadowsToggle?.(e.target.checked)} 
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>

                    {/* Building Shadows Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">Building Shadows</div>
                        <div className="text-xs text-gray-500">Shadows from buildings</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={showBuildingShadows} 
                          onChange={(e) => onBuildingShadowsToggle?.(e.target.checked)} 
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Info Tip */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-800">
                    <strong>💡 Tip:</strong> Shadows update in real-time based on the time you select in Light & Shadow control above. Try moving the time slider to see shadows change!
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3 className="font-medium flex items-center"><LayersIcon size={18} className="mr-2 text-gray-500" />Basemap Options</h3></div>
        <div className="card-body"><div className="space-y-2">
            <div className={`p-3 rounded-md flex items-center cursor-pointer ${baseMap === 'streets' ? 'bg-primary-50 border border-primary-200 ring-2 ring-primary-300' : 'hover:bg-gray-50 border border-transparent'}`} onClick={() => changeBaseMap('streets')}><div className="h-10 w-10 bg-gray-200 rounded mr-3 flex items-center justify-center text-xs text-gray-500">Street</div><div><div className="font-medium">Streets</div><div className="text-xs text-gray-500">Standard map view</div></div></div>
            <div className={`p-3 rounded-md flex items-center cursor-pointer ${baseMap === 'satellite' ? 'bg-primary-50 border border-primary-200 ring-2 ring-primary-300' : 'hover:bg-gray-50 border border-transparent'}`} onClick={() => changeBaseMap('satellite')}><div className="h-10 w-10 bg-gray-700 rounded mr-3 flex items-center justify-center text-xs text-gray-200">Sat</div><div><div className="font-medium">Satellite</div><div className="text-xs text-gray-500">Aerial imagery</div></div></div>
            <div className={`p-3 rounded-md flex items-center cursor-pointer ${baseMap === 'light' ? 'bg-primary-50 border border-primary-200 ring-2 ring-primary-300' : 'hover:bg-gray-50 border border-transparent'}`} onClick={() => changeBaseMap('light')}><div className="h-10 w-10 bg-gray-100 rounded mr-3 flex items-center justify-center text-xs text-gray-500">Light</div><div><div className="font-medium">Light</div><div className="text-xs text-gray-500">Minimal light theme</div></div></div>
            <div className={`p-3 rounded-md flex items-center cursor-pointer ${baseMap === 'dark' ? 'bg-primary-50 border border-primary-200 ring-2 ring-primary-300' : 'hover:bg-gray-50 border border-transparent'}`} onClick={() => changeBaseMap('dark')}><div className="h-10 w-10 bg-gray-900 rounded mr-3 flex items-center justify-center text-xs text-gray-100">Dark</div><div><div className="font-medium">Dark</div><div className="text-xs text-gray-500">Dark theme for low light</div></div></div>
        </div></div>
      </div>
      
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
              <h4 className="font-semibold text-sm mb-2 flex items-center"><Thermometer size={16} className="mr-1 text-red-500" />Land Surface Temperature (°C)</h4>
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