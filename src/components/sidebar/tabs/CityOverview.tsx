// src/components/sidebar/tabs/CityOverview.tsx
import React, { useState, useEffect } from 'react';
import { XCircle, BarChartBig, Filter } from 'lucide-react';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler, ChartOptions
} from 'chart.js';
import { useTreeStore } from '../../../store/TreeStore';
import { useFilters } from '../../../store/FilterStore';
import { ActiveFilterChips } from '../../filters';
import InfoPopover from '../../common/InfoPopover';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler
);

type ChartViewType = 'co2' | 'trees';

const CityOverview: React.FC = () => {
  const {
    cityStats,
    wardCO2Data,
    wardTreeCountData,
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

  const [selectedChartView, setSelectedChartView] = useState<ChartViewType>('co2'); 
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
  const wardLabels = wardCO2Data.length > 0 ? wardCO2Data.map(d => d.ward) : (wardTreeCountData.length > 0 ? wardTreeCountData.map(d => d.ward) : []);
  const lineChartData = {
    labels: wardLabels,
    datasets: [
        selectedChartView === 'co2'
        ? {
            label: 'CO₂ Sequestered (tons)',
            data: wardCO2Data.map(w => w.co2_kg / 1000), // convert kg to tons
            borderColor: 'rgba(46, 125, 50, 1)',
            backgroundColor: 'rgba(46, 125, 50, 0.2)',
            yAxisID: 'y',
          }
        : {
            label: 'Number of Trees',
            data: wardTreeCountData.map(w => w.tree_count),
            borderColor: 'rgba(25, 118, 210, 1)',
            backgroundColor: 'rgba(25, 118, 210, 0.2)',
            yAxisID: 'y',
          }
    ].map(ds => ({...ds, tension: 0.4, fill: true}))
  };

  const lineChartOptions: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false, },
    plugins: { legend: { display: false, },
        tooltip: { callbacks: { label: (ctx) => { let l = ctx.dataset.label || ''; if (l) { l += ': '; } if (ctx.parsed.y !== null) { l += ctx.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 1 }); if (selectedChartView === 'co2') { l += ' tons'; } else { l += ' trees'; } } return l; } } }
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: selectedChartView === 'co2' ? 'CO₂ Sequestered (tons)' : 'Number of Trees', font: { size: 12 } }, ticks: { font: { size: 10 } } }, x: { title: { display: true, text: 'Ward', font: { size: 12 } }, ticks: { font: { size: 10 }, autoSkip: true, maxTicksLimit: 15 } } }
  };

  const neighbourhoodTreePieData = cityStats ? {
    labels: ['In Selected Area', 'Rest of City'],
    datasets: [{ data: [neighbourhoodTreeCount, Math.max(0, cityStats.total_trees - neighbourhoodTreeCount)], backgroundColor: ['#4CAF50', '#E0E0E0'], borderColor: ['#FFFFFF', '#FFFFFF'], borderWidth: 2, }],
  } : null;

  const neighbourhoodCO2PieData = cityStats ? {
    labels: ['In Selected Area', 'Rest of City'],
    datasets: [{ data: [neighbourhoodCO2, Math.max(0, (cityStats.total_co2_annual_kg / 1000) - neighbourhoodCO2)], backgroundColor: ['#FFC107', '#E0E0E0'], borderColor: ['#FFFFFF', '#FFFFFF'], borderWidth: 2, }],
  } : null;
  
  const pieChartOptions: ChartOptions<'pie'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const, labels: { boxWidth:15, font:{size:10} } }, tooltip: { callbacks: { label: (context) => { const value = context.raw as number; let label = context.label || ''; if(label){label+=': ';} label+= value.toLocaleString('en-US', {maximumFractionDigits: 1}); return label; } } } } };

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