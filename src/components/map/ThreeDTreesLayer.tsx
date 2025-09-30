// src/components/map/ThreeDTreesLayer.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LayerProps } from 'react-map-gl/maplibre';
import axios from 'axios';
import * as turf from '@turf/turf';
import type { FeatureCollection, Point, Feature, Polygon } from 'geojson';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

// --- Helper: Create an empty FeatureCollection ---
const emptyFeatureCollection = (): FeatureCollection<Polygon> => ({
  type: 'FeatureCollection',
  features: [],
});

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
  is3D: boolean;
}

const ThreeDTreesLayer: React.FC<ThreeDTreesLayerProps> = ({ bounds, selectedTreeId, is3D }) => {
  // FIX: Initialize with an empty FeatureCollection, not null.
  const [treeData, setTreeData] = useState<ThreeDGeoJSON>({ type: 'FeatureCollection', features: [] });

  // --- Style objects are now INSIDE the component and wrapped in useMemo ---
  const trunkLayerStyle: LayerProps = useMemo(() => ({
    id: 'tree-trunks-3d',
    type: 'fill-extrusion',
    layout: { visibility: is3D ? 'visible' : 'none' },
    paint: {
      'fill-extrusion-color': '#8B4513',
      'fill-extrusion-height': ['get', 'trunkHeight'],
      'fill-extrusion-base': 0,
    }
  }), [is3D]);

  const canopyLayerStyle: LayerProps = useMemo(() => ({
    id: 'tree-canopies-3d',
    type: 'fill-extrusion',
    layout: { visibility: is3D ? 'visible' : 'none' },
    paint: {
      'fill-extrusion-color': '#2E7D32',
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base'],
    }
  }), [is3D]);

  const highlightedTrunkLayerStyle: LayerProps = useMemo(() => ({
      id: 'tree-trunks-3d-highlight',
      type: 'fill-extrusion',
      layout: { visibility: is3D ? 'visible' : 'none' },
      paint: {
          'fill-extrusion-color': '#ffc107',
          'fill-extrusion-height': ['get', 'trunkHeight'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
      }
  }), [is3D]);

  const highlightedCanopyLayerStyle: LayerProps = useMemo(() => ({
      id: 'tree-canopies-3d-highlight',
      type: 'fill-extrusion',
      layout: { visibility: is3D ? 'visible' : 'none' },
      paint: {
          'fill-extrusion-color': '#ffeb3b',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 1,
      }
  }), [is3D]);


  useEffect(() => {
    // FIX: Only fetch data if we are in 3D mode AND have bounds.
    if (bounds && is3D) {
      const fetchTreeData = async () => {
        try {
          const response = await axios.post(`${API_BASE_URL}/api/trees-in-bounds`, { bounds });
          setTreeData(response.data);
        } catch (error) {
          console.error('Failed to fetch 3D tree data:', error);
          setTreeData({ type: 'FeatureCollection', features: [] });
        }
      };
      fetchTreeData();
    } else if (!is3D) {
      // When switching to 2D, clear the data but don't set to null
      setTreeData({ type: 'FeatureCollection', features: [] });
    }
  }, [bounds, is3D]);

  const { trunkFeatures, canopyFeatures } = useMemo(() => {
    // FIX: If there's no data, return empty collections, not null.
    if (!treeData || !treeData.features || treeData.features.length === 0) {
      return { trunkFeatures: emptyFeatureCollection(), canopyFeatures: emptyFeatureCollection() };
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
    if (!selectedTreeId || !trunkFeatures || trunkFeatures.features.length === 0) {
      return { highlightedTrunk: null, highlightedCanopy: null };
    }
    const trunk = trunkFeatures.features.find(f => f.properties?.id === selectedTreeId);
    const canopySegments = canopyFeatures.features.filter(f => f.properties?.id === selectedTreeId);
    
    return {
        highlightedTrunk: trunk ? { type: 'FeatureCollection', features: [trunk] } as FeatureCollection<Polygon> : null,
        highlightedCanopy: canopySegments.length > 0 ? { type: 'FeatureCollection', features: canopySegments } as FeatureCollection<Polygon> : null
    };
  }, [selectedTreeId, trunkFeatures, canopyFeatures]);

  // FIX: The guard clause that caused unmounting has been removed.

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