// src/components/map/MapView.tsx
import React, { useState, useRef, useEffect } from 'react';
import L, { Map as LeafletMap, FeatureGroup as LeafletFeatureGroup, LatLngBoundsExpression, Layer } from 'leaflet';
import { MapContainer, TileLayer, ScaleControl, FeatureGroup, ImageOverlay } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import MapTreeLayer from './MapTreeLayer';
import LeafletGeocoder from './LeafletGeocoder'; 
// WardBoundaries import was removed
import SimulatedTreesLayer from './SimulatedTreesLayer';
import { useTreeStore } from '../../store/TreeStore';

interface MapViewProps {
  onTreeSelect: (treeId: string) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  baseMap: string; 
  // showWardBoundaries prop was removed
  showLSTOverlay: boolean; 
  lstMinValueForDisplay: number; 
  lstMaxValueForDisplay: number; 
}

const MapView: React.FC<MapViewProps> = ({ 
  onTreeSelect, 
  sidebarOpen, 
  toggleSidebar,
  baseMap, 
  // showWardBoundaries, // Removed
  showLSTOverlay 
  // lstMinValueForDisplay, // These were from my last suggestion, not your baseline
  // lstMaxValueForDisplay  
}) => {
  const lstImageBounds: LatLngBoundsExpression = [
    [18.41668612, 73.7606651], 
    [18.62786903, 73.96308303]  
  ];
  const lstImageUrl = './lst_pune.png'; 

  const initialMapCenter = L.latLngBounds(lstImageBounds).getCenter();
  const initialMapZoom = 15; // As per your provided file

  const mapRef = useRef<LeafletMap | null>(null); 

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.fitBounds(lstImageBounds, { paddingTopLeft: [0,0], paddingBottomRight: [0,0] }); 
    }
  }, [lstImageBounds]); // This effect was in your provided file

  const featureGroupRef = useRef<LeafletFeatureGroup | null>(null);
  const [isFeatureGroupReady, setIsFeatureGroupReady] = useState(false);
  const { setSelectedArea: setGlobalSelectedArea } = useTreeStore(); 
  const onFeatureGroupReady = (reactFGref: LeafletFeatureGroup | null) => { if (reactFGref) { featureGroupRef.current = reactFGref; setIsFeatureGroupReady(true); } else { featureGroupRef.current = null; setIsFeatureGroupReady(false); } };
  const handleDrawCreated = (e: any) => { const layer = e.layer as L.Layer; if (featureGroupRef.current) { featureGroupRef.current.clearLayers(); featureGroupRef.current.addLayer(layer); } const geoJson = layer.toGeoJSON(); setGlobalSelectedArea({ type: 'geojson', geojsonData: geoJson as any }); };
  const handleDrawEdited = (e: any) => { e.layers.eachLayer((layer: L.Layer) => { const geoJson = layer.toGeoJSON(); setGlobalSelectedArea({ type: 'geojson', geojsonData: geoJson as any }); }); };
  const handleDrawDeleted = () => { 
    setGlobalSelectedArea(null); 
    if (featureGroupRef.current) { 
        featureGroupRef.current.clearLayers();
    }
  };

  return (
    <div className="map-container"> 
      <MapContainer 
        center={initialMapCenter} 
        zoom={initialMapZoom} 
        zoomControl={false} 
        style={{ height: '100%', width: '100%' }}
        whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
      >
        {baseMap === 'streets' && (<TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />)}
        {baseMap === 'satellite' && (<TileLayer attribution='© Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />)}
        {baseMap === 'light' && (<TileLayer attribution='© OpenStreetMap' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />)}
        {baseMap === 'dark' && (<TileLayer attribution='© OpenStreetMap' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />)}

        <ScaleControl position="bottomleft" />
        <MapTreeLayer onTreeClick={onTreeSelect} />
        <LeafletGeocoder /> 
        <SimulatedTreesLayer />

        {showLSTOverlay && (
          <ImageOverlay url={lstImageUrl} bounds={lstImageBounds} opacity={0.65} zIndex={150} />
        )}
        
        <FeatureGroup ref={onFeatureGroupReady as any}>
          {isFeatureGroupReady && featureGroupRef.current && (
            <EditControl
                position="topleft" 
                onCreated={handleDrawCreated} 
                onEdited={handleDrawEdited} 
                onDeleted={handleDrawDeleted}
                draw={{ 
                    polygon: true, 
                    // --- ONLY CHANGE IS HERE and below ---
                    rectangle: {
                        shapeOptions: {
                            // These are typical defaults, explicitly stated
                            stroke: true,
                            color: '#3388ff',
                            weight: 4,
                            opacity: 0.5,
                            fill: true,
                            fillColor: undefined, // Or same as color: '#3388ff',
                            fillOpacity: 0.2,
                            clickable: true
                        },
                        showArea: true, // Keep showing area if it wasn't the cause
                        metric: false // TRY SETTING metric TO FALSE to use imperial units
                                      // This might bypass the part of readableArea causing "type is not defined"
                    }, 
                    // --- END OF CHANGE ---
                    circle: false, 
                    circlemarker: false, 
                    marker: false, 
                    polyline: false 
                }}
                edit={{ featureGroup: featureGroupRef.current }}
            />
          )}
        </FeatureGroup>
      </MapContainer>

      <button className={`absolute top-1/2 transform -translate-y-1/2 z-[1010] bg-white p-2 shadow-xl hover:bg-gray-100 transition-all duration-300 ease-in-out border-t border-b border-l border-gray-300 rounded-l-md ${sidebarOpen ? 'right-[var(--sidebar-width)]' : 'right-0'}`} onClick={toggleSidebar} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}> {sidebarOpen ? <ChevronRight size={20} className="text-gray-700" /> : <ChevronLeft size={20} className="text-gray-700" />} </button>
    </div>
  );
};

export default MapView;