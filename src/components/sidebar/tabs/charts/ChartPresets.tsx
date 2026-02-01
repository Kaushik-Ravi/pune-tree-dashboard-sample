// src/components/sidebar/tabs/charts/ChartPresets.tsx
// Quick preset chips for one-click chart selection

import React from 'react';
import { CHART_PRESETS } from '../../../../types/charts';

interface ChartPresetsProps {
  activePresetId: string;
  onPresetSelect: (presetId: string) => void;
}

const ChartPresets: React.FC<ChartPresetsProps> = ({ activePresetId, onPresetSelect }) => {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Quick Charts
      </label>
      <div className="flex flex-wrap gap-2">
        {CHART_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onPresetSelect(preset.id)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                transition-all duration-200 border
                ${isActive
                  ? 'bg-primary-50 border-primary-300 text-primary-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              title={preset.config.title}
            >
              <span className="text-base">{preset.icon}</span>
              <span className="hidden sm:inline">{preset.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChartPresets;
