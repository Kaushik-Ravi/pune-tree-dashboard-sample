// src/components/sidebar/tabs/CityOverviewCharts.tsx
// New chart system for CityOverview
import React, { useState, useEffect } from 'react';
import { ChartPresets, ChartBuilder, DynamicChart } from '../../charts';
import { fetchChartData } from '../../../api/chart';
import { ChartConfig } from '../../../types/charts';

const DEFAULT_PRESET_CONFIGS: Record<string, ChartConfig> = {
  treesByWard: { type: 'bar', groupBy: 'ward', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: 20 },
  co2ByWard: { type: 'bar', groupBy: 'ward', metric: 'sum_co2', sortBy: 'value', sortOrder: 'desc', limit: 20 },
  topSpecies: { type: 'horizontalBar', groupBy: 'species', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: 10 },
  byPurpose: { type: 'pie', groupBy: 'economic_i', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: null },
  heightDist: { type: 'bar', groupBy: 'height_category', metric: 'count', sortBy: 'label', sortOrder: 'asc', limit: null },
  streetVsNonStreet: { type: 'pie', groupBy: 'location_type', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: null },
  floweringStatus: { type: 'pie', groupBy: 'flowering', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: null },
  topCO2Species: { type: 'horizontalBar', groupBy: 'species', metric: 'sum_co2', sortBy: 'value', sortOrder: 'desc', limit: 10 },
};

const CityOverviewCharts: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState('treesByWard');
  const [customConfig, setCustomConfig] = useState<ChartConfig>({ ...DEFAULT_PRESET_CONFIGS.treesByWard });
  const [useCustom, setUseCustom] = useState(false);
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // For now, no filter integration. Later, add per-chart filters.
  useEffect(() => {
    setLoading(true);
    const config = useCustom ? customConfig : DEFAULT_PRESET_CONFIGS[selectedPreset];
    fetchChartData(config, {}).then(data => {
      setChartData(data);
      setLoading(false);
    });
  }, [selectedPreset, customConfig, useCustom]);

  return (
    <div>
      <ChartPresets selected={selectedPreset as any} onSelect={k => { setSelectedPreset(k); setUseCustom(false); }} />
      <ChartBuilder value={customConfig} onChange={cfg => { setCustomConfig(cfg); setUseCustom(true); }} />
      <div className="mt-4">
        {loading ? <div>Loading chart...</div> : chartData && <DynamicChart config={useCustom ? customConfig : DEFAULT_PRESET_CONFIGS[selectedPreset]} data={chartData} />}
      </div>
    </div>
  );
};

export default CityOverviewCharts;
