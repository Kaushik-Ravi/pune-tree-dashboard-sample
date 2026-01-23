import React, { useState } from 'react';

const CHART_TYPES = [
  { key: 'bar', label: 'Bar' },
  { key: 'line', label: 'Line' },
  { key: 'pie', label: 'Pie/Donut' },
  { key: 'horizontalBar', label: 'Horizontal Bar' },
  { key: 'area', label: 'Area' },
  { key: 'scatter', label: 'Scatter' },
];
const GROUP_BYS = [
  { key: 'ward', label: 'Ward' },
  { key: 'species', label: 'Species' },
  { key: 'economic_i', label: 'Purpose' },
  { key: 'flowering', label: 'Flowering' },
  { key: 'location_type', label: 'Location Type' },
  { key: 'height_category', label: 'Height Category' },
  { key: 'canopy_category', label: 'Canopy Category' },
  { key: 'co2_category', label: 'CO₂ Category' },
];
const METRICS = [
  { key: 'count', label: 'Tree Count' },
  { key: 'sum_co2', label: 'CO₂ (Sum)' },
  { key: 'avg_height', label: 'Avg Height' },
  { key: 'avg_canopy', label: 'Avg Canopy' },
  { key: 'avg_girth', label: 'Avg Girth' },
];

const ChartBuilder: React.FC<{ onBuild: (config: any) => void }> = ({ onBuild }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [chartType, setChartType] = useState('bar');
  const [groupBy, setGroupBy] = useState('ward');
  const [metric, setMetric] = useState('count');
  const [sortBy, setSortBy] = useState('value');
  const [sortOrder, setSortOrder] = useState('desc');
  const [limit, setLimit] = useState(10);

  const buildConfig = () => {
    onBuild({ chartType, groupBy, metric, sortBy, sortOrder, limit });
  };

  return (
    <div className="border rounded-md bg-gray-50">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-700 focus:outline-none"
        onClick={() => setIsOpen((v) => !v)}
      >
        <span>⚙️ Custom Chart Builder</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="p-4 space-y-3 animate-fade-in">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Chart Type</label>
              <select value={chartType} onChange={e => setChartType(e.target.value)} className="rounded border px-2 py-1">
                {CHART_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">X-Axis (Group By)</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="rounded border px-2 py-1">
                {GROUP_BYS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Y-Axis (Metric)</label>
              <select value={metric} onChange={e => setMetric(e.target.value)} className="rounded border px-2 py-1">
                {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Sort By</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded border px-2 py-1">
                <option value="value">Value</option>
                <option value="label">Label</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Order</label>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="rounded border px-2 py-1">
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Limit</label>
              <input type="number" min={1} max={100} value={limit} onChange={e => setLimit(Number(e.target.value))} className="rounded border px-2 py-1 w-16" />
            </div>
          </div>
          <button
            type="button"
            className="mt-2 px-4 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700"
            onClick={buildConfig}
          >
            Build Chart
          </button>
        </div>
      )}
    </div>
  );
};

export default ChartBuilder;
