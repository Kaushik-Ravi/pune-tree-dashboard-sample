// src/components/map/MapView.tsx
import React, { useState, useRef, useCallback } from 'react';
import Map, { MapRef, Source, Layer, MapLayerMouseEvent, NavigationControl, FullscreenControl, ScaleControl, GeolocateControl, MapProps } from 'react-map-gl';
import MapLibreGeocoder from './MapLibreGeocoder';
import DrawControl from './DrawControl';
import { useTreeStore } from '../../store/TreeStore';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

// !!! IMPORTANT: Replace this with the TileJSON URL from your MapTiler account !!!
const TILE_JSON_URL = "https://api.maptiler.com/tiles/0197f37a-c205-7e6f-8c64-151bca4d9195/tiles.json?key=mR1XGymeKBveWLadgW0A"; 

// !!! IMPORTANT: Replace this with your actual MapTiler API Key !!!
const MAPTILER_API_KEY = "mR1XGymeKBveWLadgW0A";

interface MapViewProps {
  onTreeSelect: (treeId: string) => void;
  setMapInstance: (map: maplibregl.Map | null) => void;
}

const treeLayerStyle: any = {
  id: 'trees-layer',
  type: 'circle',
  paint: {
    'circle-radius': [ 'interpolate', ['linear'], ['zoom'], 10, 2, 18, 8 ],
    'circle-color': '#00BCD4',
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff'
  }
};

const MapView: React.FC<MapViewProps> = ({ onTreeSelect, setMapInstance }) => {
  const mapRef = useRef<MapRef>(null);
  const { setSelectedArea: setGlobalSelectedArea } = useTreeStore();

  const [cursor, setCursor] = useState<string>('grab');
  const onMouseEnter = useCallback(() => setCursor('pointer'), []);
  const onMouseLeave = useCallback(() => setCursor('grab'), []);
  
  const initialViewState = {
    longitude: 73.8567, latitude: 18.5204, zoom: 11, pitch: 0, bearing: 0
  };

  const handleMapClick = (event: MapLayerMouseEvent) => {
    if (event.features && event.features.length > 0) {
      const treeFeature = event.features.find(f => f.layer.id === 'trees-layer');
      if (treeFeature) {
        const treeId = treeFeature.properties?.Tree_ID;
        if (treeId) {
          console.log("Clicked Tree ID:", treeId);
          onTreeSelect(String(treeId));
        }
      }
    }
  };
  
  const onDrawCreate = useCallback((e: any) => {
    const geoJson = e.features[0];
    setGlobalSelectedArea({ type: 'geojson', geojsonData: geoJson });
  }, [setGlobalSelectedArea]);

  const onDrawUpdate = useCallback((e: any) => {
    if (e.features.length > 0) {
      const geoJson = e.features[0];
      setGlobalSelectedArea({ type: 'geojson', geojsonData: geoJson });
    }
  }, [setGlobalSelectedArea]);
  
  const onDrawDelete = useCallback(() => {
    setGlobalSelectedArea(null);
  }, [setGlobalSelectedArea]);

  const maplibreMapProps: MapProps = {
    ref: mapRef,
    initialViewState: initialViewState,
    style: { width: '100%', height: '100%' },
    mapStyle: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
    interactiveLayerIds: ['trees-layer'],
    onMouseEnter: onMouseEnter,
    onMouseLeave: onMouseLeave,
    onClick: handleMapClick,
    cursor: cursor,
    onLoad: (evt) => {
        setMapInstance(evt.target);
    }
  };

  return (
    <div className="map-container">
      <Map {...maplibreMapProps}>
        <GeolocateControl position="top-left" />
        <FullscreenControl position="top-left" />
        <NavigationControl position="top-left" />
        <ScaleControl />
        <MapLibreGeocoder apiKey={MAPTILER_API_KEY} />
        
        <DrawControl
          position="top-left"
          onDrawCreate={onDrawCreate}
          onDrawUpdate={onDrawUpdate}
          onDrawDelete={onDrawDelete}
        />
        
        <Source id="pune-trees-source" type="vector" url={TILE_JSON_URL}>
          <Layer {...treeLayerStyle} source-layer="trees" />
        </Source>
      </Map>
    </div>
  );
};

export default MapView;