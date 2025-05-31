import React, { useState } from 'react';
import { MapPin, Layers, Thermometer } from 'lucide-react';

const MapLayers: React.FC = () => {
  const [baseMap, setBaseMap] = useState('streets');
  const [showWardBoundaries, setShowWardBoundaries] = useState(false);
  const [showCoolingOverlay, setShowCoolingOverlay] = useState(false);

  const handleBaseMapChange = (map: string) => {
    setBaseMap(map);
    // In a real implementation, this would communicate with the map component
  };

  const toggleWardBoundaries = () => {
    setShowWardBoundaries(!showWardBoundaries);
    // In a real implementation, this would communicate with the map component
  };

  const toggleCoolingOverlay = () => {
    setShowCoolingOverlay(!showCoolingOverlay);
    // In a real implementation, this would communicate with the map component
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="font-medium flex items-center">
            <Layers size={18} className="mr-2 text-gray-500" />
            Basemap Options
          </h3>
        </div>
        <div className="card-body">
          <div className="space-y-2">
            <div 
              className={`p-3 rounded-md flex items-center cursor-pointer ${baseMap === 'streets' ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'}`}
              onClick={() => handleBaseMapChange('streets')}
            >
              <div className="h-10 w-10 bg-gray-200 rounded mr-3 overflow-hidden">
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundColor: '#E5E7EB', backgroundImage: 'linear-gradient(to right, #D1D5DB 25%, transparent 25%, transparent 50%, #D1D5DB 50%, #D1D5DB 75%, transparent 75%, transparent 100%)' }}></div>
              </div>
              <div>
                <div className="font-medium">Streets</div>
                <div className="text-xs text-gray-500">Standard OpenStreetMap view</div>
              </div>
            </div>
            
            <div 
              className={`p-3 rounded-md flex items-center cursor-pointer ${baseMap === 'satellite' ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'}`}
              onClick={() => handleBaseMapChange('satellite')}
            >
              <div className="h-10 w-10 bg-gray-700 rounded mr-3 overflow-hidden">
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundColor: '#374151', backgroundImage: 'radial-gradient(#4B5563 15%, transparent 16%), radial-gradient(#4B5563 15%, transparent 16%)' }}></div>
              </div>
              <div>
                <div className="font-medium">Satellite</div>
                <div className="text-xs text-gray-500">Aerial imagery</div>
              </div>
            </div>
            
            <div 
              className={`p-3 rounded-md flex items-center cursor-pointer ${baseMap === 'light' ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'}`}
              onClick={() => handleBaseMapChange('light')}
            >
              <div className="h-10 w-10 bg-gray-100 rounded mr-3 overflow-hidden">
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundColor: '#F3F4F6', backgroundImage: 'linear-gradient(to right, #E5E7EB 25%, transparent 25%, transparent 50%, #E5E7EB 50%, #E5E7EB 75%, transparent 75%, transparent 100%)' }}></div>
              </div>
              <div>
                <div className="font-medium">Light</div>
                <div className="text-xs text-gray-500">Minimal light theme</div>
              </div>
            </div>
            
            <div 
              className={`p-3 rounded-md flex items-center cursor-pointer ${baseMap === 'dark' ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'}`}
              onClick={() => handleBaseMapChange('dark')}
            >
              <div className="h-10 w-10 bg-gray-900 rounded mr-3 overflow-hidden">
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundColor: '#1F2937', backgroundImage: 'linear-gradient(to right, #374151 25%, transparent 25%, transparent 50%, #374151 50%, #374151 75%, transparent 75%, transparent 100%)' }}></div>
              </div>
              <div>
                <div className="font-medium">Dark</div>
                <div className="text-xs text-gray-500">Dark theme for low light</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header">
          <h3 className="font-medium">Map Overlays</h3>
        </div>
        <div className="card-body">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <MapPin size={18} className="text-gray-500 mr-2" />
                <div>
                  <div className="font-medium">Ward Boundaries</div>
                  <div className="text-xs text-gray-500">Show Pune's administrative ward boundaries</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={showWardBoundaries}
                  onChange={toggleWardBoundaries}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Thermometer size={18} className="text-gray-500 mr-2" />
                <div>
                  <div className="font-medium">Cooling Simulation</div>
                  <div className="text-xs text-gray-500">Show conceptual cooling impact visualization</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={showCoolingOverlay}
                  onChange={toggleCoolingOverlay}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header">
          <h3 className="font-medium">Legend</h3>
        </div>
        <div className="card-body">
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="h-4 w-4 rounded-full bg-primary-600 mr-2"></div>
              <div className="text-sm">Tree Location</div>
            </div>
            <div className="flex items-center">
              <div className="h-4 w-4 border-2 border-dashed border-gray-500 rounded-sm mr-2"></div>
              <div className="text-sm">Ward Boundary</div>
            </div>
            <div className="flex items-center">
              <div className="h-4 w-6 bg-gradient-to-r from-orange-500 to-blue-500 mr-2 rounded-sm"></div>
              <div className="text-sm">Temperature Gradient (Warm to Cool)</div>
            </div>
            <div className="flex items-center">
              <div className="h-4 w-4 rounded-sm border border-primary-600 bg-primary-50 mr-2"></div>
              <div className="text-sm">Selected Area</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapLayers;