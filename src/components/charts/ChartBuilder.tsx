// src/components/charts/ChartBuilder.tsx
// Advanced custom chart builder UI
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';

const CHART_TYPES = [
  { key: 'bar', label: 'Bar' },
  { key: 'line', label: 'Line' },
  { key: 'pie', label: 'Pie' },
  { key: 'horizontalBar', label: 'Horizontal Bar' },
  { key: 'area', label: 'Area' },
  { key: 'scatter', label: 'Scatter' },
];

const GROUP_BY_OPTIONS = [
  { key: 'ward', label: 'Ward' },
  { key: 'species', label: 'Species' },
  { key: 'economic_i', label: 'Purpose' },
  { key: 'flowering', label: 'Flowering' },
  { key: 'location_type', label: 'Location Type' },
  { key: 'height_category', label: 'Height Category' },
  { key: 'canopy_category', label: 'Canopy Category' },
  { key: 'co2_category', label: 'CO₂ Category' },
];

const METRIC_OPTIONS = [
  { key: 'count', label: 'Tree Count' },
  { key: 'sum_co2', label: 'CO₂ Sequestered' },
  { key: 'avg_height', label: 'Avg Height' },
  { key: 'avg_canopy', label: 'Avg Canopy' },
  { key: 'avg_girth', label: 'Avg Girth' },
];

const SORT_OPTIONS = [
  { key: 'label', label: 'Label' },
  { key: 'value', label: 'Value' },
];

const LIMIT_OPTIONS = [10, 20, 50];

interface ChartBuilderProps {
  value: any;
  onChange: (config: any) => void;
}

const ChartBuilder: React.FC<ChartBuilderProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2 text-sm font-medium text-gray-700"
      >
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-gray-500" />
          <span>Custom Chart Builder</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="mt-3 space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chart Type</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={value.type}
                onChange={e => onChange({ ...value, type: e.target.value })}
              >
                {CHART_TYPES.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Group By (X-Axis)</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={value.groupBy}
                onChange={e => onChange({ ...value, groupBy: e.target.value })}
              >
                {GROUP_BY_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Metric (Y-Axis)</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={value.metric}
                onChange={e => onChange({ ...value, metric: e.target.value })}
              >
                {METRIC_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sort By</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={value.sortBy}
                onChange={e => onChange({ ...value, sortBy: e.target.value })}
              >
                {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Limit</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={value.limit ?? ''}
                onChange={e => onChange({ ...value, limit: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">All</option>
                {LIMIT_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={!!value.showValues}
                onChange={e => onChange({ ...value, showValues: e.target.checked })}
              />
              Show values on chart
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={!!value.descending}
                onChange={e => onChange({ ...value, descending: e.target.checked })}
              />
              Descending order
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartBuilder;
