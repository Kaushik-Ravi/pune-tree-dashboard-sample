// src/components/map/MapLibreGeocoder.tsx
import { useControl } from 'react-map-gl';
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
import * as maplibregl from 'maplibre-gl';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';

interface GeocoderControlProps {
  apiKey: string;
}

function MapLibreGeocoder({ apiKey }: GeocoderControlProps) {
  useControl(() => {
    const geocoder = new MaplibreGeocoder({
      maplibregl: maplibregl as any,
      apiKey: apiKey,
    }, {
      showResultsWhileTyping: true,
    });
    return geocoder;
  }, {
    position: 'top-right'
  });

  return null;
}

export default MapLibreGeocoder;