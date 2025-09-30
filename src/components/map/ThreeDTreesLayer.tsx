// src/components/map/ThreeDTreesLayer.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LayerProps } from 'react-map-gl/maplibre';
import axios from 'axios';
import * as turf from '@turf/turf';
import type { FeatureCollection, Point, Feature, Polygon } from 'geojson';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

interface ThreeDTreeFeatureProperties {
  id: string;
  height_m: number;
  girth_cm: number;
  canopy_dia_m: number;
}

type ThreeDTreeFeature = Feature<Point, ThreeDTreeFeatureProperties>;
type ThreeDGeoJSON = FeatureCollection<Point, ThreeDTreeFeatureProperties>;

interface ThreeDTreesLayerProps {
  bounds: { sw: [number, number]; ne: [number, number] } | null;
  selectedTreeId: string | null;
}

// --- FIX: Removed invalid 'fill-extrusion-cast-shadows' property from all styles ---
const trunkLayerStyle: LayerProps = {
  id: 'tree-trunks-3d',
  type: 'fill-extrusion',
  paint: {
    'fill-extrusion-color': '#8B4513',
    'fill-extrusion-height': ['get', 'trunkHeight'],
    'fill-extrusion-base': 0,
  }
};

const canopyLayerStyle: LayerProps = {
  id: 'tree-canopies-3d',
  type: 'fill-extrusion',
  paint: {
    'fill-extrusion-color': '#2E7D32',
    'fill-extrusion-height': ['get', 'height'],
    'fill-extrusion-base': ['get', 'base'],
  }
};

const highlightedTrunkLayerStyle: LayerProps = {
    id: 'tree-trunks-3d-highlight',
    type: 'fill-extrusion',
    paint: {
        'fill-extrusion-color': '#ffc107',
        'fill-extrusion-height': ['get', 'trunkHeight'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 1,
    }
};

const highlightedCanopyLayerStyle: LayerProps = {
    id: 'tree-canopies-3d-highlight',
    type: 'fill-extrusion',
    paint: {
        'fill-extrusion-color': '#ffeb3b',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': 1,
    }
};


const ThreeDTreesLayer: React.FC<ThreeDTreesLayerProps> = ({ bounds, selectedTreeId }) => {
  const [treeData, setTreeData] = useState<ThreeDGeoJSON | null>(null);

  useEffect(() => {
    if (bounds) {
      const fetchTreeData = async () => {
        try {
          const response = await axios.post(`${API_BASE_URL}/api/trees-in-bounds`, { bounds });
          setTreeData(response.data);
        } catch (error) {
          console.error('Failed to fetch 3D tree data:', error);
          setTreeData(null);
        }
      };
      fetchTreeData();
    } else {
      setTreeData(null);
    }
  }, [bounds]);

  const { trunkFeatures, canopyFeatures } = useMemo(() => {
    if (!treeData || !treeData.features) {
      return { trunkFeatures: null, canopyFeatures: null };
    }

    const trunks: Feature<Polygon>[] = [];
    const canopies: Feature<Polygon>[] = [];

    treeData.features.forEach((tree: ThreeDTreeFeature) => {
      const { id, height_m, girth_cm, canopy_dia_m } = tree.properties;
      const coordinates = tree.geometry.coordinates;

      if (!height_m || !girth_cm || !canopy_dia_m || height_m <= 0 || girth_cm <= 0 || canopy_dia_m <= 0) {
        return;
      }

      const trunkRadiusM = Math.max(0.15, (girth_cm / 100) / (2 * Math.PI));
      const canopyRadiusM = canopy_dia_m / 2;
      const trunkHeight = Math.min(height_m * 0.3, 4);
      const canopyHeight = height_m - trunkHeight;

      const trunkPoly = turf.circle(coordinates, trunkRadiusM, { units: 'meters' });
      trunkPoly.properties = { id: id, trunkHeight: trunkHeight };
      trunks.push(trunkPoly);

      const canopySegmentCount = 5;
      const radii = [canopyRadiusM * 0.70, canopyRadiusM * 0.95, canopyRadiusM, canopyRadiusM * 0.85, canopyRadiusM * 0.60];
      const segmentHeight = canopyHeight / canopySegmentCount;

      for (let i = 0; i < canopySegmentCount; i++) {
        const base = trunkHeight + (i * segmentHeight);
        const height = base + segmentHeight;
        const radius = radii[i];
        const canopySegmentPoly = turf.circle(coordinates, radius, { units: 'meters' });
        canopySegmentPoly.properties = { id: id, base: base, height: height };
        canopies.push(canopySegmentPoly);
      }
    });

    return {
      trunkFeatures: { type: 'FeatureCollection', features: trunks } as FeatureCollection<Polygon>,
      canopyFeatures: { type: 'FeatureCollection', features: canopies } as FeatureCollection<Polygon>,
    };
  }, [treeData]);
  
  const { highlightedTrunk, highlightedCanopy } = useMemo(() => {
    if (!selectedTreeId || !trunkFeatures || !canopyFeatures) {
      return { highlightedTrunk: null, highlightedCanopy: null };
    }
    const trunk = trunkFeatures.features.find(f => f.properties?.id === selectedTreeId);
    const canopySegments = canopyFeatures.features.filter(f => f.properties?.id === selectedTreeId);
    
    return {
        highlightedTrunk: trunk ? { type: 'FeatureCollection', features: [trunk] } as FeatureCollection<Polygon> : null,
        highlightedCanopy: canopySegments.length > 0 ? { type: 'FeatureCollection', features: canopySegments } as FeatureCollection<Polygon> : null
    };
  }, [selectedTreeId, trunkFeatures, canopyFeatures]);

  if (!trunkFeatures || !canopyFeatures) {
    return null;
  }

  return (
    <>
      <Source id="tree-trunks-3d-source" type="geojson" data={trunkFeatures}>
        <Layer {...trunkLayerStyle} />
      </Source>
      <Source id="tree-canopies-3d-source" type="geojson" data={canopyFeatures}>
        <Layer {...canopyLayerStyle} />
      </Source>
      
      {highlightedTrunk && (
        <Source id="highlight-trunk-source" type="geojson" data={highlightedTrunk}>
            <Layer {...highlightedTrunkLayerStyle} />
        </Source>
      )}
      {highlightedCanopy && (
        <Source id="highlight-canopy-source" type="geojson" data={highlightedCanopy}>
            <Layer {...highlightedCanopyLayerStyle} />
        </Source>
      )}
    </>
  );
};

export default ThreeDTreesLayer;