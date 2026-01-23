// src/components/sidebar/tabs/CityOverview.tsx
import React, { useState, useEffect } from 'react';
import { XCircle, BarChartBig, Filter } from 'lucide-react';
import CityOverviewCharts from './CityOverviewCharts';
import { useTreeStore } from '../../../store/TreeStore';
import { useFilters } from '../../../store/FilterStore';
import { ActiveFilterChips } from '../../filters';
import InfoPopover from '../../common/InfoPopover';



const CityOverview: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3 className="text-lg font-medium">Charts</h3>
        </div>
        <div className="card-body space-y-4">
          <CityOverviewCharts />
        </div>
      </div>
    </div>
  );
};
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

      <div className="card">
        <div className="card-header flex justify-between items-center"><h3 className="text-lg font-medium">Ward Statistics</h3> <BarChartBig size={20} className="text-gray-400"/></div>
        <div className="card-body space-y-3">
          <div><select value={selectedChartView} onChange={e => setSelectedChartView(e.target.value as ChartViewType)} className="input text-sm py-1.5 px-3 pr-8 rounded-md border-gray-300 focus:ring-primary-500 focus:border-primary-500 w-full sm:w-auto" aria-label="Select chart data view"><option value="co2">CO₂ Sequestered</option><option value="trees">Number of Trees</option></select></div>
          <div style={{ height: '280px' }}>{(wardCO2Data.length > 0 || wardTreeCountData.length > 0) ? (<Line data={lineChartData} options={lineChartOptions} />) : (<p className="text-center text-gray-500">Loading chart data...</p>)}</div>
        </div>
      </div>

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
                    {neighbourhoodTreePieData ? <Pie data={neighbourhoodTreePieData} options={pieChartOptions} /> : null}
                  </div>
                </div>
                <div className="card border">
                  <div className="card-header"><h4 className="text-sm font-medium text-center">CO₂ Sequestered Comparison</h4></div>
                  <div className="card-body" style={{ height: '200px' }}>
                    {neighbourhoodCO2PieData ? <Pie data={neighbourhoodCO2PieData} options={pieChartOptions} /> : null}
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