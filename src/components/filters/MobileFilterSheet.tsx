// src/components/filters/MobileFilterSheet.tsx
// Full-screen filter modal for mobile devices

import React, { useEffect } from 'react';
import { X, Filter, RotateCcw, Trees, MapPin, Layers } from 'lucide-react';
import { useFilters } from '../../store/FilterStore';
import RangeSlider from './RangeSlider';
import MultiSelect from './MultiSelect';
import ToggleGroup from './ToggleGroup';
import ActiveFilterChips from './ActiveFilterChips';
import { LocationFilterType } from '../../types/filters';

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({ isOpen, onClose }) => {
  const {
    filters,
    updateFilter,
    resetFilters,
    removeFilter,
    hasActiveFilters,
    activeFiltersCount,
    activeFilterChips,
    filterMetadata,
    isLoadingMetadata,
    filteredStats,
    isLoadingStats,
  } = useFilters();

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const metadata = filterMetadata || {
    species: [],
    wards: [],
    heightRange: { min: 0, max: 30 },
    canopyRange: { min: 0, max: 20 },
    girthRange: { min: 0, max: 500 },
    co2Range: { min: 0, max: 10000 },
    economicImportanceOptions: [],
  };

  const locationOptions = [
    { value: 'all' as LocationFilterType, label: 'All Trees', icon: <Layers size={14} /> },
    { value: 'street' as LocationFilterType, label: 'Street', icon: <MapPin size={14} /> },
    { value: 'non-street' as LocationFilterType, label: 'Non-Street', icon: <Trees size={14} /> },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] md:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 top-12 bg-white rounded-t-2xl shadow-2xl flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Filters</h2>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <RotateCcw size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Stats Preview */}
        {hasActiveFilters && (
          <div className="px-4 py-3 bg-primary-50 border-b border-primary-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-700">
                {isLoadingStats ? (
                  'Updating...'
                ) : filteredStats ? (
                  `${filteredStats.totalTrees.toLocaleString()} trees match`
                ) : (
                  'Calculating...'
                )}
              </span>
            </div>
          </div>
        )}

        {/* Scrollable Filter Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoadingMetadata ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto mb-3"></div>
              <p className="text-gray-500">Loading filter options...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Location Type Toggle */}
              <ToggleGroup
                label="Location Type"
                options={locationOptions}
                value={filters.locationType}
                onChange={(value) => updateFilter('locationType', value)}
              />

              {/* Species */}
              <div className="relative">
                <MultiSelect
                  label="Species"
                  options={metadata.species}
                  selected={filters.species}
                  onChange={(selected) => updateFilter('species', selected)}
                  placeholder="Select species..."
                />
              </div>

              {/* Ward */}
              <div className="relative">
                <MultiSelect
                  label="Ward"
                  options={metadata.wards}
                  selected={filters.wards}
                  onChange={(selected) => updateFilter('wards', selected)}
                  placeholder="Select wards..."
                />
              </div>

              {/* Range Filters */}
              <RangeSlider
                label="Height"
                unit="m"
                min={metadata.heightRange.min}
                max={metadata.heightRange.max}
                step={0.5}
                value={filters.height}
                onChange={(range) => updateFilter('height', range)}
              />

              <RangeSlider
                label="Canopy Diameter"
                unit="m"
                min={metadata.canopyRange.min}
                max={metadata.canopyRange.max}
                step={0.5}
                value={filters.canopyDiameter}
                onChange={(range) => updateFilter('canopyDiameter', range)}
              />

              <RangeSlider
                label="Girth"
                unit="cm"
                min={metadata.girthRange.min}
                max={metadata.girthRange.max}
                step={10}
                value={filters.girth}
                onChange={(range) => updateFilter('girth', range)}
              />

              <RangeSlider
                label="CO₂ Sequestered"
                unit="kg"
                min={metadata.co2Range.min}
                max={metadata.co2Range.max}
                step={100}
                value={filters.co2Sequestered}
                onChange={(range) => updateFilter('co2Sequestered', range)}
                formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()}
              />

              {/* Flowering Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Flowering Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateFilter('flowering', filters.flowering === true ? null : true)}
                    className={`flex-1 px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                      filters.flowering === true
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    🌸 Flowering
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFilter('flowering', filters.flowering === false ? null : false)}
                    className={`flex-1 px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                      filters.flowering === false
                        ? 'bg-gray-100 border-gray-400 text-gray-700'
                        : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    🌿 Non-Flowering
                  </button>
                </div>
              </div>

              {/* Economic Importance */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Economic Importance</label>
                <select
                  value={filters.economicImportance || ''}
                  onChange={(e) => updateFilter('economicImportance', e.target.value || null)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  {metadata.economicImportanceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">Active Filters</span>
                    <button
                      onClick={resetFilters}
                      className="text-sm text-primary-600 hover:text-primary-800"
                    >
                      Clear all
                    </button>
                  </div>
                  <ActiveFilterChips
                    chips={activeFilterChips}
                    onRemove={removeFilter}
                  />
                </div>
              )}

              {/* Bottom padding for safe area */}
              <div className="h-6" />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-4 border-t border-gray-200 bg-white safe-area-bottom">
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Apply Filters
            {hasActiveFilters && ` (${filteredStats?.totalTrees.toLocaleString() || '...'} trees)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileFilterSheet;
