import React, { useState } from 'react';
import { useMap } from 'react-leaflet';
import { Layers, MapPin } from 'lucide-react';

interface MapControlsProps {
  showWardBoundaries: boolean;
  toggleWardBoundaries: () => void;
  baseMap: string;
  changeBaseMap: (mapType: string) => void;
}

const MapControls: React.FC<MapControlsProps> = ({
  showWardBoundaries,
  toggleWardBoundaries,
  baseMap,
  changeBaseMap
}) => {
  const [showBasemaps, setShowBasemaps] = useState(false);
  const map = useMap();
  
  const toggleBasemapsMenu = () => {
    setShowBasemaps(!showBasemaps);
  };
  
  const handleBaseMapChange = (mapType: string) => {
    changeBaseMap(mapType);
    setShowBasemaps(false);
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
      {/* Basemap control */}
      <div className="relative">
        <button 
          className="map-controls flex items-center justify-center w-10 h-10"
          onClick={toggleBasemapsMenu}
          aria-label="Change basemap"
        >
          <Layers size={20} />
        </button>
        
        {showBasemaps && (
          <div className="absolute top-12 right-0 map-controls w-36 animate-fade-in">
            <h4 className="font-medium text-sm mb-2">Basemap</h4>
            <ul className="space-y-1">
              <li>
                <button 
                  className={`text-sm w-full text-left px-2 py-1 rounded ${baseMap === 'streets' ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'}`}
                  onClick={() => handleBaseMapChange('streets')}
                >
                  Streets
                </button>
              </li>
              <li>
                <button 
                  className={`text-sm w-full text-left px-2 py-1 rounded ${baseMap === 'satellite' ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'}`}
                  onClick={() => handleBaseMapChange('satellite')}
                >
                  Satellite
                </button>
              </li>
              <li>
                <button 
                  className={`text-sm w-full text-left px-2 py-1 rounded ${baseMap === 'light' ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'}`}
                  onClick={() => handleBaseMapChange('light')}
                >
                  Light
                </button>
              </li>
              <li>
                <button 
                  className={`text-sm w-full text-left px-2 py-1 rounded ${baseMap === 'dark' ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'}`}
                  onClick={() => handleBaseMapChange('dark')}
                >
                  Dark
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
      
      {/* Ward boundaries toggle */}
      <button 
        className={`map-controls flex items-center justify-center w-10 h-10 ${showWardBoundaries ? 'bg-primary-100' : ''}`}
        onClick={toggleWardBoundaries}
        aria-label={showWardBoundaries ? "Hide ward boundaries" : "Show ward boundaries"}
        title={showWardBoundaries ? "Hide ward boundaries" : "Show ward boundaries"}
      >
        <MapPin size={20} className={showWardBoundaries ? 'text-primary-600' : ''} />
      </button>
    </div>
  );
};

export default MapControls;