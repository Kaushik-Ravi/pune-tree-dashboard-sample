// src/components/map/SimulatedTreesLayer.tsx
import React from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { useTreeStore } from '../../store/TreeStore';
import L from 'leaflet'; // For L.LatLngExpression
// turf is not needed here as points are already [lon, lat] from the store

const SimulatedTreesLayer: React.FC = () => {
  const { simulatedPlantingPoints } = useTreeStore();

  if (!simulatedPlantingPoints || simulatedPlantingPoints.length === 0) {
    return null;
  }

  return (
    <>
      {simulatedPlantingPoints.map((point, index) => {
        // Turf.js Position is [longitude, latitude]
        // Leaflet LatLngExpression is [latitude, longitude]
        const position: L.LatLngExpression = [point[1], point[0]]; 
        
        // Define lat and lon here for use in the Tooltip
        const longitude = point[0].toFixed(5); // Corrected variable name
        const latitude = point[1].toFixed(5);  // Corrected variable name

        return (
          <CircleMarker
            key={`simulated-tree-${index}`}
            center={position}
            radius={4} 
            pathOptions={{
              color: '#ffffff',       
              weight: 1,            
              fillColor: '#4ade80', 
              fillOpacity: 0.8,
            }}
          >
            <Tooltip>
              <div>Simulated Tree #{index + 1}</div>
              <div>Lat: {latitude}, Lon: {longitude}</div> {/* USED CORRECTED VARIABLES HERE */}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default SimulatedTreesLayer;