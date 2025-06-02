// src/App.tsx
import React, { useState } from 'react';
import Header from './components/Header';
import MapView from './components/map/MapView';
import Sidebar from './components/sidebar/Sidebar';
import TemperaturePredictionChart from './components/common/TemperaturePredictionChart';
import { TreeSpeciesData } from './store/TreeStore';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [baseMap, setBaseMap] = useState('light'); 
  const [showLSTOverlay, setShowLSTOverlay] = useState(false); 

  const LST_MIN_VALUE_FOR_LEGEND_AND_CHART = 22.5; 
  const LST_MAX_VALUE_FOR_LEGEND_AND_CHART = 43.0;
  const LST_80TH_PERCENTILE_APPROX = LST_MIN_VALUE_FOR_LEGEND_AND_CHART + 0.8 * (LST_MAX_VALUE_FOR_LEGEND_AND_CHART - LST_MIN_VALUE_FOR_LEGEND_AND_CHART);
  const LST_60TH_PERCENTILE_APPROX = LST_MIN_VALUE_FOR_LEGEND_AND_CHART + 0.6 * (LST_MAX_VALUE_FOR_LEGEND_AND_CHART - LST_MIN_VALUE_FOR_LEGEND_AND_CHART);

  const [showTemperatureChart, setShowTemperatureChart] = useState(false);
  const [activeSpeciesCooling, setActiveSpeciesCooling] = useState<{ p90: number; p10: number; commonName: string } | null>(null);

  const toggleSidebar = () => setSidebarOpen(prevOpen => !prevOpen);
  const handleTreeSelect = (treeId: string) => { setSelectedTreeId(treeId); setActiveTabIndex(1); if (!sidebarOpen) setSidebarOpen(true); };
  const handleChangeBaseMap = (mapType: string) => setBaseMap(mapType);
  const handleToggleLSTOverlay = () => setShowLSTOverlay(prev => !prev);
  const handleActiveSpeciesChangeForChart = (speciesDetails: TreeSpeciesData | null) => {
    if (speciesDetails) {
      setActiveSpeciesCooling({ p90: speciesDetails.p90_cooling_effect_celsius, p10: speciesDetails.p10_cooling_effect_celsius, commonName: speciesDetails.common_name });
    } else { setActiveSpeciesCooling(null); }
  };

  return (
    <div className="dashboard-layout"> {/* flex flex-col h-full */}
      <Header /> {/* Fixed height: var(--header-height) */}
      
      {/* Main content area (map + sidebar) */}
      <div className="dashboard-content"> {/* flex flex-1 relative overflow-hidden */}
        <MapView 
          onTreeSelect={handleTreeSelect} sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar}
          baseMap={baseMap} showLSTOverlay={showLSTOverlay} 
          lstMinValueForDisplay={LST_MIN_VALUE_FOR_LEGEND_AND_CHART} 
          lstMaxValueForDisplay={LST_MAX_VALUE_FOR_LEGEND_AND_CHART}
        />
        <Sidebar 
          isOpen={sidebarOpen} selectedTreeId={selectedTreeId} activeTabIndex={activeTabIndex} setActiveTabIndex={setActiveTabIndex}
          baseMap={baseMap} changeBaseMap={handleChangeBaseMap}
          showLSTOverlay={showLSTOverlay} toggleLSTOverlay={handleToggleLSTOverlay}
          lstMinValue={LST_MIN_VALUE_FOR_LEGEND_AND_CHART} lstMaxValue={LST_MAX_VALUE_FOR_LEGEND_AND_CHART}
          setShowTemperatureChart={setShowTemperatureChart} 
          onActiveSpeciesChangeForChart={handleActiveSpeciesChangeForChart}
        />
      </div>

      {/* Conditionally render the Temperature Prediction Chart at the bottom */}
      {/* This div will be positioned absolutely relative to dashboard-layout or another suitable positioned ancestor */}
      {showTemperatureChart && activeSpeciesCooling && (
        <div 
          className="absolute bottom-0 left-0 z-20 bg-white border-t-2 border-gray-300 shadow-top-lg"
          // When sidebar is open, chart's right edge aligns with sidebar's left edge.
          // When sidebar is closed, chart's right edge aligns with viewport's right edge.
          style={{ 
            right: sidebarOpen ? 'var(--sidebar-width)' : '0px',
            // Height can be fixed or calculated if needed, e.g., calc(200px + env(safe-area-inset-bottom))
            // For now, TemperaturePredictionChart component controls its internal height.
          }}
        >
           <TemperaturePredictionChart 
              showChart={showTemperatureChart} // Prop for conditional rendering inside if needed
              onClose={() => setShowTemperatureChart(false)} // Pass close handler
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