export interface CityConfig {
  id: string;
  name: string;
  center: [number, number];
  defaultZoom: number;
  boundingBox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  facts: { stat: string; label: string; icon: string }[];
  tables: {
    trees: string;
    wards: string;
    landCover: string;
  };
}

export const PuneConfig: CityConfig = {
  id: 'pune',
  name: 'Pune',
  center: [73.8567, 18.5204],
  defaultZoom: 12,
  boundingBox: [73.7, 18.4, 74.0, 18.6], // Approximate
  facts: [
    { stat: '1.79 Million', label: 'Trees cataloged in Pune', icon: 'TreePine' },
    { stat: '33%', label: 'Current green cover', icon: 'Leaf' },
    { stat: '77', label: 'Municipal wards mapped', icon: 'Map' }
  ],
  tables: {
    trees: 'trees',
    wards: 'ward_polygons',
    landCover: 'land_cover_stats'
  }
};
