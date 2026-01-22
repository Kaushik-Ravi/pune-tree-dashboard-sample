// src/components/filters/TreeFilterBar.tsx
// Main collapsible filter bar component

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, RotateCcw, Trees, MapPin, Layers } from 'lucide-react';
import { useFilters } from '../../store/FilterStore';
import RangeSlider from './RangeSlider';
import MultiSelect from './MultiSelect';
import ToggleGroup from './ToggleGroup';
import ActiveFilterChips from './ActiveFilterChips';
import MobileFilterSheet from './MobileFilterSheet';
import { LocationFilterType } from '../../types/filters';

interface TreeFilterBarProps {
  className?: string;
}

const TreeFilterBar: React.FC<TreeFilterBarProps> = ({ className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  
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
  } = useFilters();

  // Default metadata if not loaded yet
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

  // Mobile view - simplified header that opens full-screen sheet
  const MobileFilterHeader = () => (
    <div className="md:hidden bg-white border-b border-gray-200">
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsMobileSheetOpen(true)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-gray-700">
            <Filter size={16} className="text-primary-600" />
            <span className="font-medium text-sm">Filters</span>
          </div>
          
          {hasActiveFilters && (
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
              {activeFiltersCount} active
            </span>
          )}
        </div>

        <ChevronDown size={18} className="text-gray-400" />
      </div>

      {/* Active filter chips - visible when has filters */}
      {hasActiveFilters && (
        <div className="px-4 pb-2 overflow-x-auto hide-scrollbar">
          <ActiveFilterChips
            chips={activeFilterChips}
            onRemove={removeFilter}
            compact
          />
        </div>
      )}

      {/* Mobile Filter Sheet */}
      <MobileFilterSheet
        isOpen={isMobileSheetOpen}
        onClose={() => setIsMobileSheetOpen(false)}
      />
    </div>
  );

  // Desktop view - collapsible inline filter bar
  const DesktopFilterBar = () => (
    <div className={`hidden md:block bg-white border-b border-gray-200 relative ${className}`}>
      {/* Collapsed header - always visible */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-gray-700">
            <Filter size={16} className="text-primary-600" />
            <span className="font-medium text-sm">Filters</span>
          </div>
          
          {hasActiveFilters && (
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
              {activeFiltersCount} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetFilters();
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Reset all filters"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </div>
      </div>

      {/* Active filter chips - visible when collapsed and has filters */}
      {!isExpanded && hasActiveFilters && (
        <div className="px-4 pb-2 overflow-x-auto hide-scrollbar">
          <ActiveFilterChips
            chips={activeFilterChips}
            onRemove={removeFilter}
            compact
          />
        </div>
      )}

      {/* Expanded filter panel - overlays on top of content below */}
      {isExpanded && (
        <div className="absolute left-0 right-0 top-full z-50 bg-white border-b border-gray-200 shadow-lg px-4 pb-4 border-t border-gray-100 animate-fade-in max-h-[60vh] overflow-y-auto">
          {isLoadingMetadata ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading filter options...</p>
            </div>
          ) : (
            <div className="space-y-6 pt-4">
              {/* Location Type Toggle */}
              <ToggleGroup
                label="Location Type"
                options={locationOptions}
                value={filters.locationType}
                onChange={(value) => updateFilter('locationType', value)}
              />

              {/* Species Multi-select */}
              <div className="relative">
                <MultiSelect
                  label="Species"
                  options={metadata.species}
                  selected={filters.species}
                  onChange={(selected) => updateFilter('species', selected)}
                  placeholder="Select species..."
                />
              </div>

              {/* Ward Multi-select */}
              <div className="relative">
                <MultiSelect
                  label="Ward"
                  options={metadata.wards}
                  selected={filters.wards}
                  onChange={(selected) => updateFilter('wards', selected)}
                  placeholder="Select wards..."
                />
              </div>

              {/* Range Filters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Height Range */}
                <RangeSlider
                  label="Height"
                  unit="m"
                  min={metadata.heightRange.min}
                  max={metadata.heightRange.max}
                  step={0.5}
                  value={filters.height}
                  onChange={(range) => updateFilter('height', range)}
                />

                {/* Canopy Diameter Range */}
                <RangeSlider
                  label="Canopy Diameter"
                  unit="m"
                  min={metadata.canopyRange.min}
                  max={metadata.canopyRange.max}
                  step={0.5}
                  value={filters.canopyDiameter}
                  onChange={(range) => updateFilter('canopyDiameter', range)}
                />

                {/* Girth Range */}
                <RangeSlider
                  label="Girth"
                  unit="cm"
                  min={metadata.girthRange.min}
                  max={metadata.girthRange.max}
                  step={10}
                  value={filters.girth}
                  onChange={(range) => updateFilter('girth', range)}
                />

                {/* CO2 Sequestered Range */}
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
              </div>

              {/* Additional Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Flowering Toggle */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Flowering Status</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateFilter('flowering', filters.flowering === true ? null : true)}
                      className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                        filters.flowering === true
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      🌸 Flowering
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFilter('flowering', filters.flowering === false ? null : false)}
                      className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                        filters.flowering === false
                          ? 'bg-gray-100 border-gray-400 text-gray-700'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      🌿 Non-Flowering
                    </button>
                  </div>
                </div>

                {/* Economic Importance Dropdown */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Economic Importance</label>
                  <select
                    value={filters.economicImportance || ''}
                    onChange={(e) => updateFilter('economicImportance', e.target.value || null)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">All</option>
                    {metadata.economicImportanceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active filters display */}
              {hasActiveFilters && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Active Filters</span>
                    <button
                      onClick={resetFilters}
                      className="text-sm text-primary-600 hover:text-primary-800 hover:underline"
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
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render both mobile and desktop versions
  return (
    <>
      <MobileFilterHeader />
      <DesktopFilterBar />
    </>
  );
};

export default TreeFilterBar;
