// src/components/sidebar/tabs/CityOverview.tsx
import React, { useState, useEffect } from 'react';
import { XCircle, Filter } from 'lucide-react';
import { useTreeStore } from '../../../store/TreeStore';
import { useFilters } from '../../../store/FilterStore';
import { ActiveFilterChips } from '../../filters';
import InfoPopover from '../../common/InfoPopover';
import { ChartSection, NeighbourhoodChart } from './charts';

const CityOverview: React.FC = () => {
  const {
    cityStats,
    selectedArea,
    setSelectedArea,
    getStatsForPolygon,
  } = useTreeStore();

  const {
    hasActiveFilters,
    activeFilterChips,
    filteredStats,
    isLoadingStats,
    removeFilter,
    resetFilters,
  } = useFilters();

  const [isCalculating, setIsCalculating] = useState(false);
  const [neighbourhoodTreeCount, setNeighbourhoodTreeCount] = useState(0);
  const [neighbourhoodCO2, setNeighbourhoodCO2] = useState(0);

  useEffect(() => {
    const calculateStats = async () => {
        if (selectedArea && selectedArea.type === 'geojson' && selectedArea.geojsonData) {
            setIsCalculating(true);
            const polygonStats = await getStatsForPolygon(selectedArea.geojsonData);
            if (polygonStats) {
                setNeighbourhoodTreeCount(polygonStats.tree_count);
                setNeighbourhoodCO2(polygonStats.co2_kg / 1000); // Convert kg to tons
            } else {
                setNeighbourhoodTreeCount(0);
                setNeighbourhoodCO2(0);
            }
            setIsCalculating(false);
        }
    };
    calculateStats();
  }, [selectedArea, getStatsForPolygon]);

  const clearDrawnSelection = () => {
    setSelectedArea(null); 
    setNeighbourhoodTreeCount(0);
    setNeighbourhoodCO2(0);
  };

  // Determine display values - use filtered stats if filters are active
  const displayTreeCount = hasActiveFilters && filteredStats 
    ? filteredStats.totalTrees 
    : cityStats?.total_trees || 0;
  
  const displayCO2 = hasActiveFilters && filteredStats 
    ? filteredStats.totalCO2Kg 
    : cityStats?.total_co2_annual_kg || 0;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3 className="text-lg font-medium">Summary</h3>
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
              <Filter size={12} />
              <span>Filtered</span>
            </div>
          )}
        </div>
        <div className="card-body space-y-4">
          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Filters</span>
                <button
                  onClick={resetFilters}
                  className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
                >
                  Clear all
                </button>
              </div>
              <ActiveFilterChips
                chips={activeFilterChips}
                onRemove={removeFilter}
                compact
              />
            </div>
          )}

          {(!cityStats && !hasActiveFilters) ? (
            <div className="text-center text-gray-500">Loading city stats...</div>
          ) : isLoadingStats ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Updating stats...</p>
            </div>
          ) : (
            <>
              <div>
                <span className="text-base text-gray-600 block mb-1">
                  Number of Trees
                  {hasActiveFilters && <span className="text-xs text-gray-400 ml-1">(filtered)</span>}
                </span>
                <div className="text-4xl font-bold text-primary-700">
                  {displayTreeCount.toLocaleString()}
                </div>
                {hasActiveFilters && cityStats && (
                  <span className="text-sm text-gray-400">
                    of {cityStats.total_trees.toLocaleString()} total
                  </span>
                )}
              </div>
              <hr className="border-gray-200" />
              <div>
                <span className="text-base text-gray-600 block mb-1">
                  Total CO₂ Sequestered
                  {hasActiveFilters && <span className="text-xs text-gray-400 ml-1">(filtered)</span>}
                </span>
                <div className="text-4xl font-bold text-accent-700">
                  {(displayCO2 / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  <span className="text-xl font-medium"> tons (lifetime)</span>
                </div>
                {hasActiveFilters && cityStats && (
                  <span className="text-sm text-gray-400">
                    of {(cityStats.total_co2_annual_kg / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })} total
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Charts Section - with presets and custom builder */}
      <ChartSection />

      {/* ADDED data-tour-id */}
      <div className="card" data-tour-id="know-your-neighbourhood">
        <div className="card-header flex justify-between items-center">
          <h3 className="text-lg font-medium">Know Your Neighbourhood</h3>
          <InfoPopover titleContent="How to Use This Section">
            <p>Use the drawing tools on the map (top-left) to select an area of interest. This section will then display pie charts comparing the tree count and CO₂ sequestration within your selected area against the rest of the city.</p>
          </InfoPopover>
        </div>
        <div className="card-body">
          {!selectedArea?.geojsonData ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mt-2">Use the drawing tools on the map to analyze a specific area.</p>
            </div>
          ) : isCalculating ? (
            <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Calculating stats for selected area...</p>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card border">
                  <div className="card-header"><h4 className="text-sm font-medium text-center">Tree Count Comparison</h4></div>
                  <div className="card-body" style={{ height: '200px' }}>
                    {cityStats && (
                      <NeighbourhoodChart
                        selectedValue={neighbourhoodTreeCount}
                        totalValue={cityStats.total_trees}
                        selectedLabel="In Selected Area"
                        restLabel="Rest of City"
                        selectedColor="#4CAF50"
                      />
                    )}
                  </div>
                </div>
                <div className="card border">
                  <div className="card-header"><h4 className="text-sm font-medium text-center">CO₂ Sequestered Comparison</h4></div>
                  <div className="card-body" style={{ height: '200px' }}>
                    {cityStats && (
                      <NeighbourhoodChart
                        selectedValue={neighbourhoodCO2}
                        totalValue={cityStats.total_co2_annual_kg / 1000}
                        selectedLabel="In Selected Area"
                        restLabel="Rest of City"
                        selectedColor="#FFC107"
                        unit=" tons"
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="text-center mt-4">
                <button className="btn btn-outline flex items-center mx-auto" onClick={clearDrawnSelection}>
                  <XCircle size={18} className="mr-2" /> Clear Selected Area
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CityOverview;