import React, { useState } from 'react';
// useMap is not used here if we remove the toggleWardBoundaries functionality,
// but it's fine to keep if other controls might need it later.
// For now, let's remove it if not strictly needed by remaining functionality.
// import { useMap } from 'react-leaflet';
import { Layers } from 'lucide-react'; // MapPin is no longer needed

interface MapControlsProps {
  // showWardBoundaries: boolean; // REMOVE
  // toggleWardBoundaries: () => void; // REMOVE
  baseMap: string;
  changeBaseMap: (mapType: string) => void;
}

const MapControls: React.FC<MapControlsProps> = ({
  // showWardBoundaries, // REMOVE
  // toggleWardBoundaries, // REMOVE
  baseMap,
  changeBaseMap
}) => {
  const [showBasemaps, setShowBasemaps] = useState(false);
  // const map = useMap(); // REMOVE if not used by other parts of this component

  const toggleBasemapsMenu = () => {
    setShowBasemaps(!showBasemaps);
  };
  
  const handleBaseMapChange = (mapType: string) => {
    changeBaseMap(mapType);
    setShowBasemaps(false);
  };

  return (
    <div className="absolute top-4 right-4 z-[1002] flex flex-col space-y-2">
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
      
      {/* Ward boundaries toggle button has been removed from here */}
    </div>
  );
};

export default MapControls;