// src/components/filters/ActiveFilterChips.tsx
// Displays active filters as removable chips

import React from 'react';
import { X } from 'lucide-react';
import { ActiveFilter } from '../../types/filters';

interface ActiveFilterChipsProps {
  chips: ActiveFilter[];
  onRemove: (chip: ActiveFilter) => void;
  onClearAll?: () => void;
  compact?: boolean;
}

const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  chips,
  onRemove,
  onClearAll,
  compact = false,
}) => {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'items-center' : ''}`}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className={`inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full border border-primary-200 transition-colors hover:bg-primary-100 ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          <span className="max-w-[150px] truncate">{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemove(chip)}
            className="flex-shrink-0 p-0.5 rounded-full hover:bg-primary-200 transition-colors"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X size={compact ? 12 : 14} />
          </button>
        </span>
      ))}

      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className={`text-gray-500 hover:text-gray-700 hover:underline ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          Clear all
        </button>
      )}
    </div>
  );
};

export default ActiveFilterChips;
