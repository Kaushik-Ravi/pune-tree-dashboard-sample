import React, { useEffect, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import { useTreeStore } from '../../store/TreeStore';

const WardBoundaries: React.FC = () => {
  const map = useMap();
  const { wardBoundaries, fetchWardBoundaries } = useTreeStore();
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  useEffect(() => {
    fetchWardBoundaries();
  }, [fetchWardBoundaries]);

  useEffect(() => {
    if (wardBoundaries) {
      setGeoJsonData(wardBoundaries);
    }
  }, [wardBoundaries]);

  const onEachFeature = (feature: any, layer: any) => {
    // Create a popup with ward name
    if (feature.properties && feature.properties.WARD_NAME_PROPERTY) {
      layer.bindPopup(`<b>Ward:</b> ${feature.properties.WARD_NAME_PROPERTY}`);
    }

    // Add hover effect
    layer.on({
      mouseover: (e: any) => {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: '#1976D2',
          dashArray: '',
          fillOpacity: 0.3
        });
        layer.bringToFront();
      },
      mouseout: (e: any) => {
        const layer = e.target;
        geoJsonRef.current?.resetStyle(layer);
      },
      click: (e: any) => {
        map.fitBounds(e.target.getBounds());
      }
    });
  };

  const geoJsonRef = React.useRef<any>(null);
  
  const geoJsonStyle = {
    color: '#607D8B',
    weight: 2,
    opacity: 0.6,
    dashArray: '3',
    fillOpacity: 0.1,
    fillColor: '#90A4AE'
  };

  if (!geoJsonData) return null;

  return (
    <GeoJSON 
      data={geoJsonData}
      style={geoJsonStyle}
      onEachFeature={onEachFeature}
      ref={geoJsonRef}
    />
  );
};

export default WardBoundaries;