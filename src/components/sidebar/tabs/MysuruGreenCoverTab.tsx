// src/components/sidebar/tabs/MysuruGreenCoverTab.tsx
// Lightweight Green Cover tab for Mysuru. Pune uses the rich GreenCoverMonitor
// (timelines, ward leaderboards, deforestation hotspots) — that requires the
// per-ward land_cover_stats aggregations Mysuru doesn't have yet. This tab
// gives Mysuru a usable subset: raster overlay toggles + year picker + ward
// boundary visibility.
import React from 'react';
import { Layers, TreePine, Leaf, Map as MapIcon, TrendingDown, ThermometerSun, Info } from 'lucide-react';

type RasterLayer =
  | 'tree_probability_2025'
  | 'tree_probability_2019'
  | 'tree_change'
  | 'tree_loss_gain'
  | 'ndvi'
  | 'landcover'
  | 'lst';

interface RasterConfig {
  visible: boolean;
  layer: RasterLayer;
  opacity: number;
  year?: number;
}

interface MysuruGreenCoverTabProps {
  rasterConfig?: RasterConfig;
  onRasterConfigChange?: (config: RasterConfig) => void;
  showWardBoundaries?: boolean;
  onWardBoundariesToggle?: (enabled: boolean) => void;
}

interface LayerOption {
  key: RasterLayer;
  label: string;
  icon: React.ReactNode;
  defaultYear?: number;
  yearRange?: number[];
  description: string;
}

const LAYER_OPTIONS: LayerOption[] = [
  {
    key: 'tree_probability_2025',
    label: 'Tree Cover',
    icon: <TreePine size={16} className="text-green-700" />,
    defaultYear: 2025,
    yearRange: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    description: 'Dynamic World tree probability for the selected year (0-100%).',
  },
  {
    key: 'ndvi',
    label: 'NDVI (Greenness)',
    icon: <Leaf size={16} className="text-green-600" />,
    defaultYear: 2025,
    yearRange: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    description: 'Sentinel-2 winter (Dec-Feb) median NDVI. Same-season comparison so seasonal leaf-shed does not look like deforestation.',
  },
  {
    key: 'landcover',
    label: 'Landcover Classes',
    icon: <MapIcon size={16} className="text-amber-600" />,
    defaultYear: 2025,
    yearRange: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    description: 'Dynamic World 9-class landcover (trees, built, water, crops, grass, …).',
  },
  {
    key: 'tree_change',
    label: 'Tree Change 2019→2025',
    icon: <TrendingDown size={16} className="text-orange-600" />,
    description: 'Δ tree probability between 2019 and 2025. Red = loss, blue = gain.',
  },
  {
    key: 'lst',
    label: 'Land Surface Temperature',
    icon: <ThermometerSun size={16} className="text-red-600" />,
    description: 'Landsat 8/9 LST 2024 annual mean (°C). Higher values = urban heat island.',
  },
];

const MysuruGreenCoverTab: React.FC<MysuruGreenCoverTabProps> = ({
  rasterConfig,
  onRasterConfigChange,
  showWardBoundaries = false,
  onWardBoundariesToggle,
}) => {
  const activeLayer = rasterConfig?.layer;
  const activeYear = rasterConfig?.year;
  const opacity = rasterConfig?.opacity ?? 0.7;

  const setLayer = (opt: LayerOption) => {
    const turningOff = rasterConfig?.visible && activeLayer === opt.key;
    onRasterConfigChange?.({
      visible: !turningOff,
      layer: opt.key,
      opacity,
      year: opt.defaultYear,
    });
  };

  const setYear = (year: number) => {
    if (!rasterConfig || !activeLayer) return;
    onRasterConfigChange?.({ ...rasterConfig, year });
  };

  const setOpacity = (value: number) => {
    if (!rasterConfig) return;
    onRasterConfigChange?.({ ...rasterConfig, opacity: value });
  };

  const activeOption = LAYER_OPTIONS.find(o => o.key === activeLayer);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Layers size={18} className="text-primary-600" />
          <h3 className="text-lg font-medium">Mysuru Green Cover</h3>
        </div>
        <div className="card-body space-y-3">
          <p className="text-sm text-gray-600">
            Toggle a raster layer to see it on the map. Hover any pixel for its value.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LAYER_OPTIONS.map(opt => {
              const isActive = rasterConfig?.visible && activeLayer === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setLayer(opt)}
                  title={opt.description}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors ${
                    isActive
                      ? 'bg-primary-50 border-primary-500 text-primary-800 font-medium'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Year picker — visible only for layers that have yearly variants */}
          {activeOption?.yearRange && rasterConfig?.visible && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Year</span>
                <span className="text-xs text-gray-400">{activeYear ?? activeOption.defaultYear}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {activeOption.yearRange.map(year => (
                  <button
                    key={year}
                    onClick={() => setYear(year)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      year === (activeYear ?? activeOption.defaultYear)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opacity */}
          {rasterConfig?.visible && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Opacity</span>
                <span className="text-xs text-gray-400">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          {/* Description of active layer */}
          {activeOption && rasterConfig?.visible && (
            <div className="pt-3 mt-2 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-500">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <p>{activeOption.description}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-medium">Map Layers</h3>
        </div>
        <div className="card-body">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-700">Show ward boundaries (65 wards)</span>
            <input
              type="checkbox"
              checked={showWardBoundaries}
              onChange={(e) => onWardBoundariesToggle?.(e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded"
            />
          </label>
        </div>
      </div>

      <div className="card bg-amber-50 border-amber-200">
        <div className="card-body text-xs text-amber-800">
          <strong className="block mb-1">Coming next:</strong>
          Per-ward green-cover stats, deforestation hotspots, and the Pune-style
          year-over-year timeline once we run the spatial-zonal aggregation
          (Dynamic World × ward polygons) and populate <code>mysuru_land_cover_stats</code>.
        </div>
      </div>
    </div>
  );
};

export default MysuruGreenCoverTab;
