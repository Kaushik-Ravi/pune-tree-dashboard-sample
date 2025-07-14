// src/components/sidebar/tabs/CityOverview.tsx
import React, { useState, useEffect } from 'react';
import { ScissorsSquare, XCircle } from 'lucide-react';
import { Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler, ChartOptions } from 'chart.js';
import { useTreeStore } from '../../../store/TreeStore';
import InfoPopover from '../../common/InfoPopover';
import { Map as MapLibreMap } from 'maplibre-gl';
import * as turf from '@turf/turf';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

interface CityOverviewProps {
  map: MapLibreMap | null;
}

const CityOverview: React.FC<CityOverviewProps> = ({ map }) => {
  const { cityStats, wardCO2Data, wardTreeCountData, selectedArea, setSelectedArea } = useTreeStore();
  const [chartView, setChartView] = useState<'co2' | 'trees'>('co2');
  const [showNeighbourhoodStats, setShowNeighbourhoodStats] = useState(false);
  const [neighbourhoodTreeCount, setNeighbourhoodTreeCount] = useState(0);
  const [neighbourhoodCO2, setNeighbourhoodCO2] = useState(0);

  useEffect(() => {
    if (selectedArea?.geojsonData && map) {
      const drawnPolygon = selectedArea.geojsonData;
      const featuresInPolygon = map.queryRenderedFeatures({ layers: ['trees-layer'] })
        .filter(f => f.geometry.type === 'Point' && turf.booleanPointInPolygon(f.geometry, drawnPolygon));
      
      const uniqueIds = new Set();
      let co2InPolygon = 0.0;
      
      featuresInPolygon.forEach(feature => {
        const id = feature.properties.Tree_ID;
        if (!uniqueIds.has(id)) {
          co2InPolygon += feature.properties.CO2_Sequestration_kg_yr || 0;
          uniqueIds.add(id);
        }
      });
      
      const countInPolygon = uniqueIds.size;
      
      console.log(`Features found in drawn area: ${countInPolygon}`);
      setNeighbourhoodTreeCount(countInPolygon);
      setNeighbourhoodCO2(co2InPolygon / 1000); // convert to tons
      setShowNeighbourhoodStats(true);
    } else {
      setShowNeighbourhoodStats(false);
    }
  }, [selectedArea, map]);

  const clearDrawnSelection = () => setSelectedArea(null);
  
  const lineChartData = {
      labels: chartView === 'co2' ? wardCO2Data.map(d => d.ward) : wardTreeCountData.map(d => d.ward),
      datasets: [{
          label: chartView === 'co2' ? 'CO₂ Sequestered (tons/yr)' : 'Number of Trees',
          data: chartView === 'co2' ? wardCO2Data.map(w => w.co2_kg / 1000) : wardTreeCountData.map(w => w.tree_count),
          borderColor: chartView === 'co2' ? 'rgba(46, 125, 50, 1)' : 'rgba(25, 118, 210, 1)',
          backgroundColor: chartView === 'co2' ? 'rgba(46, 125, 50, 0.2)' : 'rgba(25, 118, 210, 0.2)',
          tension: 0.4, fill: true,
      }],
  };
  const lineChartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: chartView === 'co2' ? 'CO₂ Sequestered (tons/yr)' : 'Number of Trees' } }, x: { title: { display: true, text: 'Ward' } } } };
  
  const neighbourhoodTreePieData = cityStats ? { labels: ['In Selected Area', 'Rest of City'], datasets: [{ data: [neighbourhoodTreeCount, Math.max(0, cityStats.total_trees - neighbourhoodTreeCount)], backgroundColor: ['#4CAF50', '#E0E0E0'] }] } : null;
  const neighbourhoodCO2PieData = cityStats ? { labels: ['In Selected Area', 'Rest of City'], datasets: [{ data: [neighbourhoodCO2, Math.max(0, (cityStats.total_co2_annual_kg / 1000) - neighbourhoodCO2)], backgroundColor: ['#FFC107', '#E0E0E0'] }] } : null;
  const pieChartOptions: ChartOptions<'pie'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 15, font: { size: 10 } } } } };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header"><h3 className="text-lg font-medium">Summary</h3></div>
        <div className="card-body space-y-4">
          <div><span className="text-base text-gray-600 block mb-1">Number of Trees</span><div className="text-4xl font-bold text-primary-700">{cityStats ? cityStats.total_trees.toLocaleString() : 'Loading...'}</div></div>
          <hr className="border-gray-200" />
          <div><span className="text-base text-gray-600 block mb-1">Total CO₂ Sequestered</span><div className="text-4xl font-bold text-accent-700">{cityStats ? (cityStats.total_co2_annual_kg / 1000).toFixed(2) : 'Loading...'}<span className="text-xl font-medium"> tons/yr</span></div></div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="text-lg font-medium">Ward Statistics</h3></div>
        <div className="card-body space-y-3">
          <select value={chartView} onChange={(e) => setChartView(e.target.value as 'co2' | 'trees')} className="input text-sm py-1.5 px-3 pr-8 rounded-md w-full sm:w-auto"><option value="co2">CO₂ Sequestered</option><option value="trees">Number of Trees</option></select>
          <div style={{ height: '280px' }}><Line data={lineChartData} options={lineChartOptions} /></div>
        </div>
      </div>
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3 className="text-lg font-medium">Know Your Neighbourhood</h3>
          <InfoPopover titleContent="How to Use This Section"><p>Use the drawing tools on the map (top-left) to select an area of interest. This section will then display pie charts comparing the tree count and CO₂ sequestration within your selected area against the rest of the city.</p></InfoPopover>
        </div>
        <div className="card-body">
          {!selectedArea?.geojsonData && (
            <div className="text-center py-4"><p className="text-sm text-gray-500 mt-2">Use the drawing tools on the map to select an area.</p></div>
          )}
          {showNeighbourhoodStats && selectedArea?.geojsonData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card border"><div className="card-header"><h4 className="text-sm font-medium text-center">Tree Count Comparison</h4></div><div className="card-body" style={{ height: '200px' }}>{neighbourhoodTreePieData && <Pie data={neighbourhoodTreePieData} options={pieChartOptions} />}</div></div>
                  <div className="card border"><div className="card-header"><h4 className="text-sm font-medium text-center">CO₂ Sequestered Comparison</h4></div><div className="card-body" style={{ height: '200px' }}>{neighbourhoodCO2PieData && <Pie data={neighbourhoodCO2PieData} options={pieChartOptions} />}</div></div>
              </div>
              <div className="text-center mt-4"><button className="btn btn-outline flex items-center mx-auto" onClick={clearDrawnSelection}><XCircle size={18} className="mr-2" />Clear Selection</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default CityOverview;