// src/components/sidebar/tabs/CityOverview.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ScissorsSquare, XCircle } from 'lucide-react'; // Info icon comes from InfoPopover
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler, ChartType, ChartDataset,
} from 'chart.js';
import { useTreeStore, DrawnGeoJson } from '../../../store/TreeStore';
import * as turf from '@turf/turf';
import InfoPopover from '../../common/InfoPopover'; // IMPORT THE NEW COMPONENT

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler
);

type ChartViewType = 'co2' | 'trees';

interface Tree {
  id: string;
  latitude: number;
  longitude: number;
  CO2_sequestered_kg: number;
}

const CityOverview: React.FC = () => {
  const {
    cityStats, trees,
    wardCO2Data, wardTreeCountData,
    selectedArea, setSelectedArea,
  } = useTreeStore();

  const chartRef = useRef<ChartJS<ChartType, number[], string> | null>(null);
  const [selectedChartView, setSelectedChartView] = useState<ChartViewType>('co2'); 
  const [showNeighbourhoodStats, setShowNeighbourhoodStats] = useState(false);
  const [neighbourhoodTreeCount, setNeighbourhoodTreeCount] = useState(0);
  const [neighbourhoodCO2, setNeighbourhoodCO2] = useState(0);
  const [selectedGeoJsonArea, setSelectedGeoJsonArea] = useState<DrawnGeoJson>(null);

  useEffect(() => {
    if (selectedArea && selectedArea.type === 'geojson' && selectedArea.geojsonData && trees.length > 0) {
      const drawnPolygon = selectedArea.geojsonData;
      setSelectedGeoJsonArea(drawnPolygon);
      let countInPolygon = 0;
      let co2InPolygon = 0;
      trees.forEach(tree => {
        const point = turf.point([tree.longitude, tree.latitude]);
        let isInside = false;
        if (drawnPolygon.geometry.type === 'Polygon' || drawnPolygon.geometry.type === 'MultiPolygon') {
            isInside = turf.booleanPointInPolygon(point, drawnPolygon as turf.Feature<turf.Polygon | turf.MultiPolygon>);
        }
        if (isInside) {
          countInPolygon++;
          co2InPolygon += tree.CO2_sequestered_kg;
        }
      });
      setNeighbourhoodTreeCount(countInPolygon);
      setNeighbourhoodCO2(co2InPolygon / 1000);
      setShowNeighbourhoodStats(true);
    } else {
      setShowNeighbourhoodStats(false);
      setSelectedGeoJsonArea(null);
    }
  }, [selectedArea, trees]);

  const activateAreaSelection = () => {
    if (!selectedArea) { 
        setShowNeighbourhoodStats(true); 
    }
  };

  const clearDrawnSelection = () => {
    setSelectedArea(null); 
    setShowNeighbourhoodStats(false);
  };

  const wardLabels = wardCO2Data.length > 0 ? wardCO2Data.map(d => d.ward) : (wardTreeCountData.length > 0 ? wardTreeCountData.map(d => d.ward) : []);
  const getCurrentDataset = (): ChartDataset<'line', number[]> => { 
    if (selectedChartView === 'co2') {
      return { label: 'CO₂ Sequestered (tons)', data: wardCO2Data.map(w => w.co2_kg / 1000), borderColor: 'rgba(46, 125, 50, 1)', backgroundColor: 'rgba(46, 125, 50, 0.2)', tension: 0.4, fill: true, yAxisID: 'y', };
    } else { 
      return { label: 'Number of Trees', data: wardTreeCountData.map(w => w.tree_count), borderColor: 'rgba(25, 118, 210, 1)', backgroundColor: 'rgba(25, 118, 210, 0.2)', tension: 0.4, fill: true, yAxisID: 'y', };
    }
  };
  const lineChartData = { labels: wardLabels, datasets: [getCurrentDataset()], };
  const yAxisTitle = selectedChartView === 'co2' ? 'CO₂ Sequestered (tons)' : 'Number of Trees';
  const lineChartOptions = { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index' as const, intersect: false, }, plugins: { legend: { display: false, }, tooltip: { callbacks: { label: function(ctx: any) { let l = ctx.dataset.label||''; if(l){l+=': '} if(ctx.parsed.y!==null){l+=ctx.parsed.y.toLocaleString(); if(selectedChartView==='co2'){l+=' tons'}else{l+=' trees'}} return l;}}}}, scales: { y: { type: 'linear'as const, display:true, position:'left'as const, beginAtZero:true, title:{display:true,text:yAxisTitle,font:{size:12}}, ticks:{font:{size:10}},}, x: {title:{display:true,text:'Ward',font:{size:12}}, ticks:{font:{size:10},maxRotation:0,minRotation:0}}}};
  const handleChartViewChange = (event: React.ChangeEvent<HTMLSelectElement>) => setSelectedChartView(event.target.value as ChartViewType);

  const neighbourhoodTreePieData = cityStats && showNeighbourhoodStats ? {
    labels: ['In Selected Area', 'Rest of City'],
    datasets: [{ data: [neighbourhoodTreeCount, Math.max(0, cityStats.total_trees - neighbourhoodTreeCount)], backgroundColor: ['#4CAF50', '#E0E0E0'], borderColor: ['#FFFFFF', '#FFFFFF'], borderWidth: 2, }],
  } : null;
  const neighbourhoodCO2PieData = cityStats && showNeighbourhoodStats ? {
    labels: ['In Selected Area', 'Rest of City'],
    datasets: [{ data: [neighbourhoodCO2, Math.max(0, (cityStats.total_co2_annual_kg / 1000) - neighbourhoodCO2)], backgroundColor: ['#FFC107', '#E0E0E0'], borderColor: ['#FFFFFF', '#FFFFFF'], borderWidth: 2, }],
  } : null;
  const pieChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const, labels: { boxWidth:15, font:{size:10} } }, tooltip: { callbacks: { label: function(context: any) { const value = context.raw as number; return `${context.label}: ${value.toLocaleString()}`; } } } } };

  const knowYourNeighbourhoodInfo = (
    <p>
      Use the drawing tools on the map (top-left) to select an area of interest. 
      This section will then display pie charts comparing the tree count and CO₂ sequestration 
      within your selected area against the rest of the city.
    </p>
  );

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="card">
        <div className="card-header"><h3 className="text-lg font-medium">Summary</h3></div>
        <div className="card-body space-y-4">
          <div><span className="text-base text-gray-600 block mb-1">Number of Trees</span><div className="text-4xl font-bold text-primary-700">{cityStats ? cityStats.total_trees.toLocaleString() : 'Loading...'}</div></div>
          <hr className="border-gray-200" />
          <div><span className="text-base text-gray-600 block mb-1">Total CO₂ Sequestered</span><div className="text-4xl font-bold text-accent-700">{cityStats ? (cityStats.total_co2_annual_kg / 1000).toFixed(2) : 'Loading...'}<span className="text-xl font-medium"> tons</span></div></div>
        </div>
      </div>

      {/* Ward Statistics Chart Card */}
      <div className="card">
        <div className="card-header"><h3 className="text-lg font-medium">Ward Statistics</h3></div>
        <div className="card-body space-y-3">
          <div><select value={selectedChartView} onChange={handleChartViewChange} className="input text-sm py-1.5 px-3 pr-8 rounded-md border-gray-300 focus:ring-primary-500 focus:border-primary-500 w-full sm:w-auto" aria-label="Select chart data view"><option value="co2">CO₂ Sequestered</option><option value="trees">Number of Trees</option></select></div>
          <div style={{ height: '280px' }}>{(wardCO2Data.length > 0 || wardTreeCountData.length > 0) ? (<Line ref={chartRef} data={lineChartData} options={lineChartOptions as any} />) : (<p className="text-center text-gray-500">Loading chart data...</p>)}</div>
        </div>
      </div>

      {/* Know Your Neighbourhood Card */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3 className="text-lg font-medium">Know Your Neighbourhood</h3>
          <InfoPopover titleContent="How to Use This Section">
            {knowYourNeighbourhoodInfo}
          </InfoPopover>
        </div>
        <div className="card-body">
          {!showNeighbourhoodStats && (
            <div className="text-center py-4">
              <button className="btn btn-primary flex items-center mx-auto" onClick={activateAreaSelection}>
                <ScissorsSquare size={18} className="mr-2" /> Snip Out Your Neighbourhood
              </button>
              <p className="text-sm text-gray-500 mt-2">Use the drawing tools (top-left of map) to select an area.</p>
            </div>
          )}

          {showNeighbourhoodStats && selectedArea && selectedArea.geojsonData && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-md text-center">
                <p className="text-sm text-gray-600">Displaying stats for the selected area on the map.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card border">
                  <div className="card-header"><h4 className="text-sm font-medium text-center">Tree Count Comparison</h4></div>
                  <div className="card-body" style={{ height: '200px' }}>
                    {neighbourhoodTreePieData ? <Pie data={neighbourhoodTreePieData} options={pieChartOptions as any} /> : <p className="text-center text-gray-500">No data for selected area.</p>}
                  </div>
                </div>
                <div className="card border">
                  <div className="card-header"><h4 className="text-sm font-medium text-center">CO₂ Sequestered Comparison</h4></div>
                  <div className="card-body" style={{ height: '200px' }}>
                    {neighbourhoodCO2PieData ? <Pie data={neighbourhoodCO2PieData} options={pieChartOptions as any} /> : <p className="text-center text-gray-500">No data for selected area.</p>}
                  </div>
                </div>
              </div>
              <div className="text-center mt-4">
                <button className="btn btn-outline flex items-center mx-auto" onClick={clearDrawnSelection}>
                  <XCircle size={18} className="mr-2" /> Clear Selected Area Analysis
                </button>
              </div>
            </div>
          )}
           {showNeighbourhoodStats && !(selectedArea && selectedArea.geojsonData) && (
                <p className="text-center text-gray-500 py-4">
                  Please draw an area on the map using the drawing tools (now at the top-left of the map).
                </p>
           )}
        </div>
      </div>
    </div>
  );
};

export default CityOverview;