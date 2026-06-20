// src/components/map/MysuruWardBoundaryLayer.tsx
// Renders Mysuru ward boundary outlines from /api/ward-boundaries?cityId=mysuru.
// Default hidden. Pass `visible` from the Green Cover Monitor (or any tab that
// scopes ward-level analysis) to turn the layer on. No-op for non-Mysuru cities.
import { useEffect, useState } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FeatureCollection } from 'geojson';
import { useCityStore } from '../../store/CityStore';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

interface MysuruWardBoundaryLayerProps {
  visible?: boolean;
}

export default function MysuruWardBoundaryLayer({ visible = false }: MysuruWardBoundaryLayerProps) {
  const { activeCityId } = useCityStore();
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    if (activeCityId !== 'mysuru' || !visible) {
      setGeojson(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/ward-boundaries?cityId=mysuru`)
      .then(r => r.json())
      .then((d: FeatureCollection) => {
        if (!cancelled) setGeojson(d);
      })
      .catch(err => console.warn('[MysuruWardBoundaryLayer] fetch failed:', err));
    return () => {
      cancelled = true;
    };
  }, [activeCityId, visible]);

  if (activeCityId !== 'mysuru' || !visible || !geojson) return null;

  return (
    <Source id="mysuru-wards" type="geojson" data={geojson}>
      <Layer
        id="mysuru-wards-fill"
        type="fill"
        paint={{ 'fill-color': '#0d9488', 'fill-opacity': 0.04 }}
      />
      <Layer
        id="mysuru-wards-outline"
        type="line"
        paint={{ 'line-color': '#0f766e', 'line-width': 1.5, 'line-opacity': 0.75 }}
      />
    </Source>
  );
}
