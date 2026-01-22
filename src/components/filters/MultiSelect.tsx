// src/components/filters/MultiSelect.tsx
// A searchable multi-select dropdown for species and ward selection

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  maxDisplayItems?: number;
  searchable?: boolean;
  /** Sort type: 'alpha' for alphabetical, 'natural' for numeric-aware sorting */
  sortType?: 'alpha' | 'natural';
  /** Optional prefix for display in flat list (e.g., "Ward" for "Ward 1") */
  itemPrefix?: string;
}

// Natural sort comparator - handles numeric strings properly (1, 2, 10 instead of 1, 10, 2)
const naturalSort = (a: string, b: string): number => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  maxDisplayItems = 3,
  searchable = true,
  sortType = 'alpha',
  itemPrefix = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort options based on sortType
  const sortedOptions = [...filteredOptions].sort(
    sortType === 'natural' ? naturalSort : (a, b) => a.localeCompare(b)
  );

  // Group options by first letter for better navigation (only for alphabetical sort)
  // For natural/numeric sorting (like wards), we use a flat list for proper 1, 2, 3... order
  const useGrouping = sortType !== 'natural';
  
  const groupedOptions = useGrouping 
    ? sortedOptions.reduce((acc, option) => {
        const firstLetter = option.charAt(0).toUpperCase();
        if (!acc[firstLetter]) {
          acc[firstLetter] = [];
        }
        acc[firstLetter].push(option);
        return acc;
      }, {} as Record<string, string[]>)
    : {}; // Empty when using flat list

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const toggleOption = useCallback(
    (option: string) => {
      if (selected.includes(option)) {
        onChange(selected.filter((s) => s !== option));
      } else {
        onChange([...selected, option]);
      }
    },
    [selected, onChange]
  );

  const removeOption = useCallback(
    (option: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(selected.filter((s) => s !== option));
    },
    [selected, onChange]
  );

  const clearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange]
  );

  const displayedItems = selected.slice(0, maxDisplayItems);
  const remainingCount = selected.length - maxDisplayItems;

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[38px] px-3 py-2 flex items-center justify-between gap-2 bg-white border rounded-md text-left transition-colors ${
          isOpen
            ? 'border-primary-500 ring-1 ring-primary-500'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {selected.length === 0 ? (
            <span className="text-gray-400 text-sm">{placeholder}</span>
          ) : (
            <>
              {displayedItems.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full"
                >
                  {item}
                  <X
                    size={12}
                    className="cursor-pointer hover:text-primary-900"
                    onClick={(e) => removeOption(item, e)}
                  />
                </span>
              ))}
              {remainingCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  +{remainingCount} more
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <X
              size={16}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
              onClick={clearAll}
            />
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-hidden">
          {/* Search input */}
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="overflow-y-auto max-h-48">
            {sortedOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No options found
              </div>
            ) : useGrouping ? (
              // Grouped view for alphabetical sorting (species, etc.)
              Object.entries(groupedOptions)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([letter, items]) => (
                  <div key={letter}>
                    <div className="px-3 py-1 text-xs font-medium text-gray-400 bg-gray-50 sticky top-0">
                      {letter}
                    </div>
                    {items.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleOption(option)}
                        className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-gray-50 ${
                          selected.includes(option) ? 'bg-primary-50' : ''
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            selected.includes(option)
                              ? 'bg-primary-500 border-primary-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {selected.includes(option) && (
                            <Check size={12} className="text-white" />
                          )}
                        </div>
                        <span className={selected.includes(option) ? 'font-medium' : ''}>
                          {option}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
            ) : (
              // Flat list for natural/numeric sorting (wards: 1, 2, 3, 4...)
              sortedOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleOption(option)}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-gray-50 ${
                    selected.includes(option) ? 'bg-primary-50' : ''
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selected.includes(option)
                        ? 'bg-primary-500 border-primary-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {selected.includes(option) && (
                      <Check size={12} className="text-white" />
                    )}
                  </div>
                  <span className={selected.includes(option) ? 'font-medium' : ''}>
                    {itemPrefix ? `${itemPrefix} ${option}` : option}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Selected count footer */}
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
              {selected.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
