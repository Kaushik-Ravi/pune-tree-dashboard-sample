import React, { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LayerProps } from 'react-map-gl/maplibre';
import { useTreeStore } from '../../store/TreeStore';
import { FeatureCollection, Point } from 'geojson';

const simulatedTreesLayerStyle: LayerProps = {
  id: 'simulated-trees',
  type: 'circle',
  paint: {
    'circle-radius': 4,
    'circle-color': '#4ade80',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1,
    'circle-opacity': 0.9,
  },
};

const SimulatedTreesLayer: React.FC = () => {
  const { simulatedPlantingPoints } = useTreeStore();

  const geojson: FeatureCollection<Point> = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: simulatedPlantingPoints.map((point, index) => ({
        type: 'Feature',
        properties: {
          id: `sim-tree-${index}`,
          label: `Simulated Tree #${index + 1}`,
        },
        geometry: {
          type: 'Point',
          coordinates: point, // Already in [longitude, latitude] format
        },
      })),
    };
  }, [simulatedPlantingPoints]);

  if (!simulatedPlantingPoints || simulatedPlantingPoints.length === 0) {
    return null;
  }

  return (
    <Source id="simulated-trees-source" type="geojson" data={geojson}>
      <Layer {...simulatedTreesLayerStyle} />
    </Source>
  );
};

export default SimulatedTreesLayer;