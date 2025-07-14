// src/App.tsx
import React, { useState } from 'react';
import Header from './components/Header';
import MapView from './components/map/MapView';
import Sidebar from './components/sidebar/Sidebar';
import TemperaturePredictionChart from './components/common/TemperaturePredictionChart';
import { TreeSpeciesData } from './store/TreeStore';
import { Map as MapLibreMap } from 'maplibre-gl';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);

  // LST state is preserved for the TemperaturePredictionChart feature
  const [showTemperatureChart, setShowTemperatureChart] = useState(false);
  const [activeSpeciesCooling, setActiveSpeciesCooling] = useState<{ p90: number; p10: number; commonName: string } | null>(null);
  const LST_MIN_VALUE_FOR_LEGEND_AND_CHART = 22.5; 
  const LST_MAX_VALUE_FOR_LEGEND_AND_CHART = 43.0;
  const LST_80TH_PERCENTILE_APPROX = LST_MIN_VALUE_FOR_LEGEND_AND_CHART + 0.8 * (LST_MAX_VALUE_FOR_LEGEND_AND_CHART - LST_MIN_VALUE_FOR_LEGEND_AND_CHART);
  const LST_60TH_PERCENTILE_APPROX = LST_MIN_VALUE_FOR_LEGEND_AND_CHART + 0.6 * (LST_MAX_VALUE_FOR_LEGEND_AND_CHART - LST_MIN_VALUE_FOR_LEGEND_AND_CHART);

  const toggleSidebar = () => setSidebarOpen(prevOpen => !prevOpen);
  
  const handleTreeSelect = (treeId: string) => { 
    setSelectedTreeId(treeId); 
    setActiveTabIndex(1);
    if (!sidebarOpen) setSidebarOpen(true); 
  };
  
  const handleActiveSpeciesChangeForChart = (speciesDetails: TreeSpeciesData | null) => {
    if (speciesDetails) {
      setActiveSpeciesCooling({ p90: speciesDetails.p90_cooling_effect_celsius, p10: speciesDetails.p10_cooling_effect_celsius, commonName: speciesDetails.common_name });
    } else { setActiveSpeciesCooling(null); }
  };

  return (
    <div className="dashboard-layout">
      <Header />
      <div className="dashboard-content">
        <MapView 
          onTreeSelect={handleTreeSelect}
          setMapInstance={setMapInstance}
        />
        <Sidebar 
          isOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          selectedTreeId={selectedTreeId}
          activeTabIndex={activeTabIndex}
          setActiveTabIndex={setActiveTabIndex}
          mapInstance={mapInstance}
          baseMap={'streets'} 
          showLSTOverlay={false}
          lstMinValue={LST_MIN_VALUE_FOR_LEGEND_AND_CHART} 
          lstMaxValue={LST_MAX_VALUE_FOR_LEGEND_AND_CHART}
          setShowTemperatureChart={setShowTemperatureChart} 
          onActiveSpeciesChangeForChart={handleActiveSpeciesChangeForChart}
        />
      </div>

      {showTemperatureChart && activeSpeciesCooling && (
        <div 
          className="absolute bottom-0 left-0 z-20 bg-white border-t-2 border-gray-300 shadow-top-lg"
          style={{ right: sidebarOpen ? 'var(--sidebar-width)' : '0px' }}
        >
           <TemperaturePredictionChart 
              showChart={showTemperatureChart}
              onClose={() => setShowTemperatureChart(false)}
              baselineLSTMax={LST_MAX_VALUE_FOR_LEGEND_AND_CHART}
              baselineLST80thPercentile={LST_80TH_PERCENTILE_APPROX}
              baselineLST60thPercentile={LST_60TH_PERCENTILE_APPROX}
              speciesCoolingP90={activeSpeciesCooling.p90}
              speciesCoolingP10={activeSpeciesCooling.p10}
              speciesName={activeSpeciesCooling.commonName}
            />
        </div>
      )}
    </div>
  );
}
export default App;