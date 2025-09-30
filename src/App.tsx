// src/App.tsx
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import MapView from './components/map/MapView';
import Sidebar from './components/sidebar/Sidebar';
import TemperaturePredictionChart from './components/common/TemperaturePredictionChart';
import { ArchetypeData } from './store/TreeStore';
import { LightConfig } from './components/sidebar/tabs/LightAndShadowControl';
import UserTour from './components/tour/UserTour'; // NEW: Import the tour component

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start with sidebar closed on mobile
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [baseMap, setBaseMap] = useState('light');
  const [showLSTOverlay, setShowLSTOverlay] = useState(false);
  
  const [is3D, setIs3D] = useState(false);
  const [lightConfig, setLightConfig] = useState<LightConfig | null>(null);

  const handleLightChange = useCallback((newLightConfig: LightConfig | null) => {
    setLightConfig(newLightConfig);
  }, []);
  
  const handleToggle3D = useCallback(() => {
    setIs3D(prev => !prev);
  }, []);

  const LST_MIN_VALUE_FOR_LEGEND_AND_CHART = 22.5;
  const LST_MAX_VALUE_FOR_LEGEND_AND_CHART = 43.0;
  const LST_80TH_PERCENTILE_APPROX = LST_MIN_VALUE_FOR_LEGEND_AND_CHART + 0.8 * (LST_MAX_VALUE_FOR_LEGEND_AND_CHART - LST_MAX_VALUE_FOR_LEGEND_AND_CHART);
  const LST_60TH_PERCENTILE_APPROX = LST_MIN_VALUE_FOR_LEGEND_AND_CHART + 0.6 * (LST_MAX_VALUE_FOR_LEGEND_AND_CHART - LST_MAX_VALUE_FOR_LEGEND_AND_CHART);

  const [showTemperatureChart, setShowTemperatureChart] = useState(false);
  const [activeSpeciesCooling, setActiveSpeciesCooling] = useState<{ p90: number; p10: number; commonName: string } | null>(null);

  const toggleSidebar = useCallback(() => setSidebarOpen(prevOpen => !prevOpen), []);
  
  const handleTreeSelect = useCallback((treeId: string) => {
    setSelectedTreeId(treeId);
    setActiveTabIndex(1);
    setSidebarOpen(true);
  }, []);

  const handleChangeBaseMap = useCallback((mapType: string) => {
    setBaseMap(mapType);
  }, []);

  const handleToggleLSTOverlay = useCallback(() => setShowLSTOverlay(prev => !prev), []);
  
  const handleActiveSpeciesChangeForChart = useCallback((archetypeDetails: ArchetypeData | null) => {
    if (archetypeDetails) {
      setActiveSpeciesCooling({ 
        p90: archetypeDetails.p90_cooling_effect_celsius, 
        p10: archetypeDetails.p10_cooling_effect_celsius, 
        commonName: archetypeDetails.common_name 
      });
    } else {
      setActiveSpeciesCooling(null);
    }
  }, []);

  return (
    <div className="dashboard-layout">
      {/* NEW: Integrate the UserTour component */}
      <UserTour 
        setSidebarOpen={setSidebarOpen}
        setActiveTabIndex={setActiveTabIndex}
      />
      
      <Header />
      <div className="dashboard-content">
        <MapView 
          onTreeSelect={handleTreeSelect} 
          sidebarOpen={sidebarOpen} 
          toggleSidebar={toggleSidebar} 
          baseMap={baseMap} 
          changeBaseMap={handleChangeBaseMap}
          showLSTOverlay={showLSTOverlay}
          selectedTreeId={selectedTreeId}
          is3D={is3D}
          onToggle3D={handleToggle3D}
          lightConfig={lightConfig}
        />

        {/* --- ADDED: Mobile overlay for dismissing the bottom sheet --- */}
        {sidebarOpen && (
          <div
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black bg-opacity-30 z-20 md:hidden"
            aria-hidden="true"
          />
        )}

        <Sidebar
          isOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          selectedTreeId={selectedTreeId}
          activeTabIndex={activeTabIndex}
          setActiveTabIndex={setActiveTabIndex}
          baseMap={baseMap}
          changeBaseMap={handleChangeBaseMap}
          showLSTOverlay={showLSTOverlay}
          toggleLSTOverlay={toggleLSTOverlay}
          lstMinValue={LST_MIN_VALUE_FOR_LEGEND_AND_CHART}
          lstMaxValue={LST_MAX_VALUE_FOR_LEGEND_AND_CHART}
          setShowTemperatureChart={setShowTemperatureChart}
          onActiveSpeciesChangeForChart={handleActiveSpeciesChangeForChart}
          onLightChange={handleLightChange}
          is3D={is3D}
        />
      </div>
      {showTemperatureChart && activeSpeciesCooling && (
        <div 
          className={`chart-container ${sidebarOpen ? 'chart-container-sidebar-open' : ''}`}
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