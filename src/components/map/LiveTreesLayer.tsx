// src/components/map/LiveTreesLayer.tsx
// Renders trees fetched from /api/trees-live (Supabase-backed for Mysuru).
// Polls every 15s. No-op for Pune (which uses PMTiles for its 1.79M census).
import { useEffect, useState } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FeatureCollection, Feature, Point } from 'geojson';
import { useCityStore } from '../../store/CityStore';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const POLL_INTERVAL_MS = 15_000;

interface LiveTree {
  id: string;
  lat: number;
  lng: number;
  species_name: string;
  status: string;
  created_at: string;
  co2_sequestered_kg: number | null;
  image_url: string | null;
}

export default function LiveTreesLayer() {
  const { activeCityId } = useCityStore();
  const [features, setFeatures] = useState<Feature<Point>[]>([]);

  useEffect(() => {
    if (activeCityId === 'pune') {
      setFeatures([]);
      return;
    }

    let cancelled = false;
    const fetchTrees = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/trees-live?cityId=${activeCityId}`);
        if (!resp.ok) return;
        const data: { trees?: LiveTree[] } = await resp.json();
        if (cancelled) return;
        setFeatures(
          (data.trees ?? []).map(t => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
            properties: {
              id: t.id,
              species_name: t.species_name,
              status: t.status,
              created_at: t.created_at,
              co2_sequestered_kg: t.co2_sequestered_kg,
            },
          }))
        );
      } catch (err) {
        console.warn('[LiveTreesLayer] fetch failed:', err);
      }
    };

    fetchTrees();
    const interval = setInterval(fetchTrees, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeCityId]);

  if (activeCityId === 'pune' || features.length === 0) {
    return null;
  }

  const fc: FeatureCollection<Point> = { type: 'FeatureCollection', features };

  return (
    <Source id="live-trees" type="geojson" data={fc}>
      <Layer
        id="live-trees-circles"
        type="circle"
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 8] as never,
          'circle-color': '#22c55e',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        }}
      />
    </Source>
  );
}
