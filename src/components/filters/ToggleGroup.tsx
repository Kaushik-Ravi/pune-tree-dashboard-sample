// src/components/filters/ToggleGroup.tsx
// A 3-way toggle for location type selection (All / Street / Non-Street)

import React from 'react';
import { LocationFilterType } from '../../types/filters';

interface ToggleOption {
  value: LocationFilterType;
  label: string;
  icon?: React.ReactNode;
}

interface ToggleGroupProps {
  label: string;
  options: ToggleOption[];
  value: LocationFilterType;
  onChange: (value: LocationFilterType) => void;
}

const ToggleGroup: React.FC<ToggleGroupProps> = ({ label, options, value, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex bg-gray-100 rounded-lg p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all ${
              value === option.value
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ToggleGroup;
