// src/components/charts/ChartBuilder.tsx
// Advanced chart builder UI for Pune Tree Dashboard
import React, { useState } from 'react';

const groupByOptions = [
  { value: 'ward', label: 'Ward' },
  { value: 'species', label: 'Species' },
  { value: 'economic_i', label: 'Economic Importance' },
  { value: 'flowering', label: 'Flowering Status' },
  { value: 'location_type', label: 'Location Type' },
  { value: 'height_category', label: 'Height Category' },
  { value: 'canopy_category', label: 'Canopy Category' },
  { value: 'co2_category', label: 'CO₂ Category' },
];
const metricOptions = [
  { value: 'count', label: 'Tree Count' },
  { value: 'sum_co2', label: 'CO₂ Sequestered (kg)' },
  { value: 'avg_height', label: 'Avg Height (m)' },
  { value: 'avg_canopy', label: 'Avg Canopy (m)' },
  { value: 'avg_girth', label: 'Avg Girth (cm)' },
];
const typeOptions = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'pie', label: 'Pie/Donut' },
  { value: 'scatter', label: 'Scatter' },
];

const sortByOptions = [
  { value: 'value', label: 'Value' },
  { value: 'label', label: 'Label' },
];

const limitOptions = [
  { value: null, label: 'All' },
  { value: 10, label: 'Top 10' },
  { value: 20, label: 'Top 20' },
  { value: 50, label: 'Top 50' },
];

const ChartBuilder: React.FC<{ value: any, onChange: (config: any) => void }> = ({ value, onChange }) => {
  const [local, setLocal] = useState(value);
  const handleChange = (key: string, val: any) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    onChange(next);
  };
  return (
    <div className="space-y-3 p-3 border rounded-md bg-gray-50">
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Chart Type</label>
          <select value={local.type} onChange={e => handleChange('type', e.target.value)} className="input">
            {typeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">X-Axis (Group By)</label>
          <select value={local.groupBy} onChange={e => handleChange('groupBy', e.target.value)} className="input">
            {groupByOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Y-Axis (Metric)</label>
          <select value={local.metric} onChange={e => handleChange('metric', e.target.value)} className="input">
            {metricOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Sort By</label>
          <select value={local.sortBy} onChange={e => handleChange('sortBy', e.target.value)} className="input">
            {sortByOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Order</label>
          <select value={local.sortOrder} onChange={e => handleChange('sortOrder', e.target.value)} className="input">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Limit</label>
          <select value={local.limit ?? ''} onChange={e => handleChange('limit', e.target.value ? Number(e.target.value) : null)} className="input">
            {limitOptions.map(opt => <option key={String(opt.value)} value={opt.value ?? ''}>{opt.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ChartBuilder;
