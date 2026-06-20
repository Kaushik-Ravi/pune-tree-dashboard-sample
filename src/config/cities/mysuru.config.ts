import { CityConfig } from './pune.config';

export const MysuruConfig: CityConfig = {
  id: 'mysuru',
  name: 'Mysuru',
  center: [76.6413, 12.3051],
  defaultZoom: 13,
  boundingBox: [76.5700, 12.2400, 76.7200, 12.3700], // Approximate bounding box
  facts: [
    { stat: 'Scale Up', label: 'Preparing tree census data', icon: 'TreePine' },
    { stat: 'UHI', label: 'Heat Island tracking activated', icon: 'ThermometerSun' },
    { stat: 'Heritage', label: 'Mapping heritage city canopy', icon: 'Map' }
  ],
  tables: {
    trees: 'trees',
    wards: 'ward_polygons',
    landCover: 'land_cover_stats'
  }
};
