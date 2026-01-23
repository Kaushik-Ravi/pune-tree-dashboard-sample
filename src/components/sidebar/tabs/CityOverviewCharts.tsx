// src/components/sidebar/tabs/CityOverviewCharts.tsx
// Integrates chart presets, builder, and dynamic chart rendering
import React, { useState, useEffect } from 'react';
import ChartPresets from '../../charts/ChartPresets';
import ChartBuilder from '../../charts/ChartBuilder';
import DynamicChart from '../../charts/DynamicChart';
import { Download, SlidersHorizontal } from 'lucide-react';
import Papa from 'papaparse';

const defaultConfig = { groupBy: 'ward', metric: 'count', type: 'bar', sortBy: 'value', sortOrder: 'desc', limit: 20 };

const CityOverviewCharts: React.FC = () => {
  const [chartConfig, setChartConfig] = useState<any>(defaultConfig);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/chart-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chartConfig),
    })
      .then(res => res.json())
      .then(data => setChartData(data))
      .finally(() => setLoading(false));
  }, [chartConfig]);

  // Export as CSV
  const handleExportCSV = () => {
    const csv = Papa.unparse(chartData.map(row => ({ ...row, value: row.value ?? row.y })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as PNG (Nivo provides a method via ref, but for now, use browser screenshot)
  // Optionally, can use html-to-image or similar for better UX

  return (
    <div>
      <ChartPresets onSelect={cfg => { setChartConfig(cfg); setShowBuilder(false); }} activeKey={undefined} />
      <div className="flex items-center gap-2 mb-2">
        <button className="btn btn-xs" onClick={() => setShowBuilder(v => !v)}>
          <SlidersHorizontal size={16} /> Advanced
        </button>
        <button className="btn btn-xs" onClick={handleExportCSV}>
          <Download size={16} /> CSV
        </button>
        {/* PNG export can be added here */}
      </div>
      {showBuilder && (
        <ChartBuilder value={chartConfig} onChange={setChartConfig} />
      )}
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading chart...</div>
        ) : (
          <DynamicChart type={chartConfig.type} data={chartData} xLabel={chartConfig.groupBy} yLabel={chartConfig.metric} />
        )}
      </div>
    </div>
  );
};

export default CityOverviewCharts;
