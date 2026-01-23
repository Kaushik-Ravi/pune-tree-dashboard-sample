// src/components/charts/ChartPresets.tsx
// Quick preset chart chips for Pune Tree Dashboard
import React from 'react';

export interface ChartPreset {
  key: string;
  label: string;
  icon: React.ReactNode;
  config: any; // Chart config for builder
}

const presets: ChartPreset[] = [
  { key: 'trees_by_ward', label: 'Trees by Ward', icon: '🏘️', config: { groupBy: 'ward', metric: 'count', type: 'bar', sortBy: 'value', sortOrder: 'desc', limit: 20 } },
  { key: 'co2_by_ward', label: 'CO₂ by Ward', icon: '🌍', config: { groupBy: 'ward', metric: 'sum_co2', type: 'bar', sortBy: 'value', sortOrder: 'desc', limit: 20 } },
  { key: 'top_species', label: 'Top 10 Species', icon: '🌳', config: { groupBy: 'species', metric: 'count', type: 'bar', sortBy: 'value', sortOrder: 'desc', limit: 10 } },
  { key: 'by_purpose', label: 'By Purpose', icon: '💰', config: { groupBy: 'economic_i', metric: 'count', type: 'pie', sortBy: 'value', sortOrder: 'desc' } },
  { key: 'height_dist', label: 'Height Distribution', icon: '📏', config: { groupBy: 'height_category', metric: 'count', type: 'bar', sortBy: 'label', sortOrder: 'asc' } },
  { key: 'street_vs_non', label: 'Street vs Non-Street', icon: '🛣️', config: { groupBy: 'location_type', metric: 'count', type: 'pie', sortBy: 'value', sortOrder: 'desc' } },
  { key: 'flowering', label: 'Flowering Status', icon: '🌸', config: { groupBy: 'flowering', metric: 'count', type: 'pie', sortBy: 'value', sortOrder: 'desc' } },
  { key: 'top_co2_species', label: 'Top CO₂ Contributors', icon: '🏆', config: { groupBy: 'species', metric: 'sum_co2', type: 'bar', sortBy: 'value', sortOrder: 'desc', limit: 10 } },
];

const ChartPresets: React.FC<{ onSelect: (config: any) => void, activeKey?: string | null }> = ({ onSelect, activeKey }) => (
  <div className="flex flex-wrap gap-2 py-2">
    {presets.map(preset => (
      <button
        key={preset.key}
        className={`px-3 py-1 rounded-full border text-sm flex items-center gap-1 transition-colors ${activeKey === preset.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-primary-50'}`}
        onClick={() => onSelect(preset.config)}
        aria-pressed={activeKey === preset.key}
      >
        <span>{preset.icon}</span> {preset.label}
      </button>
    ))}
  </div>
);

export default ChartPresets;
