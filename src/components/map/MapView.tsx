import React, { useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { ChevronLeft, ChevronRight, Layers, Search } from 'lucide-react';
import MapTreeLayer from './MapTreeLayer';
import MapControls from './MapControls';
import MapSearch from './MapSearch';
import WardBoundaries from './WardBoundaries';
import { useTreeStore } from '../../store/TreeStore';

interface MapViewProps {
  onTreeSelect: (treeId: string) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const MapView: React.FC<MapViewProps> = ({ 
  onTreeSelect, 
  sidebarOpen, 
  toggleSidebar 
}) => {
  const [showWardBoundaries, setShowWardBoundaries] = useState(false);
  const [baseMap, setBaseMap] = useState('streets');
  const { selectedArea, setSelectedArea } = useTreeStore();

  const handleTreeClick = (treeId: string) => {
    onTreeSelect(treeId);
  };

  const toggleWardBoundaries = () => {
    setShowWardBoundaries(!showWardBoundaries);
  };

  const changeBaseMap = (mapType: string) => {
    setBaseMap(mapType);
  };

  // Pune coordinates
  const mapCenter = [18.5204, 73.8567];
  const mapZoom = 12;

  return (
    <div className="relative h-full">
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        {baseMap === 'streets' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {baseMap === 'satellite' && (
          <TileLayer
            attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        {baseMap === 'light' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        )}
        {baseMap === 'dark' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        )}

        <ZoomControl position="bottomright" />
        
        {/* Tree data layer */}
        <MapTreeLayer onTreeClick={handleTreeClick} />
        
        {/* Conditional ward boundaries */}
        {showWardBoundaries && <WardBoundaries />}
        
        {/* Map Controls */}
        <MapControls 
          showWardBoundaries={showWardBoundaries}
          toggleWardBoundaries={toggleWardBoundaries}
          baseMap={baseMap}
          changeBaseMap={changeBaseMap}
        />

        {/* Search Control - Moved inside MapContainer */}
        <MapSearch />
      </MapContainer>

      {/* Sidebar Toggle Button */}
      <button
        className="absolute top-1/2 transform -translate-y-1/2 right-0 z-10 bg-white p-2 shadow-md rounded-l-md border-t border-b border-l border-gray-200"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </div>
  );
};

export default MapView;