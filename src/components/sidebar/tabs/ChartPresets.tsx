
import React from 'react';

const PRESETS = [
  { key: 'trees_by_ward', label: '🏘️ Trees by Ward' },
  { key: 'co2_by_ward', label: '🌍 CO₂ by Ward' },
  { key: 'top_species', label: '🌳 Top 10 Species' },
  { key: 'by_purpose', label: '💰 By Purpose' },
  { key: 'height_dist', label: '📏 Height Distribution' },
  { key: 'street_vs_nonstreet', label: '🛣️ Street vs Non-Street' },
  { key: 'flowering_status', label: '🌸 Flowering Status' },
  { key: 'top_co2_species', label: '🏆 Top CO₂ Contributors' },
];

const ChartPresets: React.FC<{
  onPresetSelect: (preset: string) => void;
  selected?: string | null;
}> = ({ onPresetSelect, selected }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            selected === preset.key
              ? 'bg-primary-600 text-white border-primary-600 shadow'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-primary-50'
          }`}
          onClick={() => onPresetSelect(preset.key)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
};

export default ChartPresets;
