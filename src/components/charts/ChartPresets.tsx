// src/components/charts/ChartPresets.tsx
// Quick preset chart chips for dashboard
import React from 'react';

export type ChartPresetKey =
  | 'treesByWard'
  | 'co2ByWard'
  | 'topSpecies'
  | 'byPurpose'
  | 'heightDist'
  | 'streetVsNonStreet'
  | 'floweringStatus'
  | 'topCO2Species';

export const CHART_PRESETS: { key: ChartPresetKey; label: string; icon: React.ReactNode; }[] = [
  { key: 'treesByWard', label: 'Trees by Ward', icon: '🏘️' },
  { key: 'co2ByWard', label: 'CO₂ by Ward', icon: '🌍' },
  { key: 'topSpecies', label: 'Top 10 Species', icon: '🌳' },
  { key: 'byPurpose', label: 'By Purpose', icon: '💰' },
  { key: 'heightDist', label: 'Height Distribution', icon: '📏' },
  { key: 'streetVsNonStreet', label: 'Street vs Non-Street', icon: '🛣️' },
  { key: 'floweringStatus', label: 'Flowering Status', icon: '🌸' },
  { key: 'topCO2Species', label: 'Top CO₂ Contributors', icon: '🏆' },
];

interface ChartPresetsProps {
  selected: ChartPresetKey;
  onSelect: (key: ChartPresetKey) => void;
}

const ChartPresets: React.FC<ChartPresetsProps> = ({ selected, onSelect }) => (
  <div className="flex flex-wrap gap-2 pb-2">
    {CHART_PRESETS.map(preset => (
      <button
        key={preset.key}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${selected === preset.key ? 'bg-primary-100 border-primary-500 text-primary-700' : 'bg-white border-gray-300 text-gray-700 hover:border-primary-300'}`}
        onClick={() => onSelect(preset.key)}
        type="button"
      >
        <span>{preset.icon}</span>
        {preset.label}
      </button>
    ))}
  </div>
);

export default ChartPresets;
