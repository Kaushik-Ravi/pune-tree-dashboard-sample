// src/App.tsx
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import MapView from './components/map/MapView';
import Sidebar from './components/sidebar/Sidebar';
import TemperaturePredictionChart from './components/common/TemperaturePredictionChart';
import { ArchetypeData, useTreeStore } from './store/TreeStore';
import { LightConfig } from './components/sidebar/tabs/LightAndShadowControl';
import TourGuide, { TourControlAction } from './components/tour/TourGuide';

const LoadingOverlay: React.FC = () => (
  <div className="fixed inset-0 bg-white bg-opacity-90 z-[20000] flex flex-col items-center justify-center">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-600"></div>
    <p className="mt-4 text-lg text-gray-700 font-medium">Preparing Your Dashboard...</p>
  </div>
);

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [baseMap, setBaseMap] = useState('light');
  const [showLSTOverlay, setShowLSTOverlay] = useState(false);
  
  const [is3D, setIs3D] = useState(false);
  const [lightConfig, setLightConfig] = useState<LightConfig | null>(null);

  // --- START: Final & Corrected Tour Logic ---
  const { cityStats } = useTreeStore();
  const [isLoading, setIsLoading] = useState(true);
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  // This effect correctly handles the initial loading state and tour start.
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('hasCompletedTour');
    if (cityStats) {
      setIsLoading(false);
      if (!hasCompletedTour) {
        // We ensure the sidebar is correctly set for the first step on desktop.
        if (window.innerWidth >= 768) {
          setSidebarOpen(true);
        }
        setRunTour(true);
      }
    }
  }, [cityStats]);

  const handleTourControl = useCallback((action: TourControlAction, payload?: any) => {
    // This function is the definitive orchestrator.
    const TRANSITION_DELAY = 350; // A guaranteed delay > CSS transition (300ms)

    switch (action) {
      case 'NEXT_STEP': {
        const nextStepIndex = tourStepIndex + 1;
        let requiresDelay = false;

        // Stage 1: Perform UI state changes required for the NEXT step.
        const nextStepKey = payload;
        if (nextStepKey === 'dashboardTabs' || nextStepKey === 'knowYourNeighbourhood') {
          if (!sidebarOpen) {
            setSidebarOpen(true);
            requiresDelay = true;
          }
          setActiveTabIndex(0);
        } else if (nextStepKey === 'plantingAdvisor') {
          if (!sidebarOpen) {
            setSidebarOpen(true);
            requiresDelay = true;
          }
          setActiveTabIndex(2);
        } else if (nextStepKey === 'mapLayers') {
          if (!sidebarOpen) {
            setSidebarOpen(true);
            requiresDelay = true;
          }
          setActiveTabIndex(3);
        } else if (nextStepKey === 'drawingTools' || nextStepKey === 'threeDMode') {
          if (sidebarOpen) {
            setSidebarOpen(false);
            requiresDelay = true;
          }
        }
        
        // Stage 2: Advance the tour step, respecting any required animation delay.
        if (requiresDelay) {
          setTimeout(() => setTourStepIndex(nextStepIndex), TRANSITION_DELAY);
        } else {
          setTourStepIndex(nextStepIndex);
        }
        break;
      }
      case 'PREV_STEP': {
        setTourStepIndex(tourStepIndex - 1);
        break;
      }
      case 'RESTART': {
        setTourStepIndex(0);
        setRunTour(false);
        localStorage.setItem('hasCompletedTour', 'true');
        if (window.innerWidth < 768) setSidebarOpen(false);
        break;
      }
      default:
        break;
    }
  }, [tourStepIndex, sidebarOpen]);
  // --- END: Final & Corrected Tour Logic ---

  const handleLightChange = useCallback((newLightConfig: LightConfig | null) => {
    setLightConfig(newLightConfig);
  }, []);
  
  const handleToggle3D = useCallback(() => {
    setIs3D(prev => !prev);
  }, []);

  const LST_MIN_VALUE_FOR_LEGEND_AND_CHART = 22.5;
  const LST_MAX_VALUE_FOR_LEGEND_AND_CHART = 43.0;
  const LST_80TH_PERCENTILE_APPROX = LST_MIN_VALUE_FOR_LEGEND_AND_CHART + 0.8 * (LST_MAX_VALUE_FOR_LEGEND_AND_CHART - LST_MIN_VALUE_FOR_LEGEND_AND_CHART);
  const LST_60TH_PERCENTILE_APPROX = LST_MIN_VALUE_FOR_LEGEND_AND_CHART + 0.6 * (LST_MAX_VALUE_FOR_LEGEND_AND_CHART - LST_MIN_VALUE_FOR_LEGEND_AND_CHART);

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
      {isLoading && <LoadingOverlay />}
      <TourGuide
        run={runTour}
        stepIndex={tourStepIndex}
        handleTourControl={handleTourControl}
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
          toggleLSTOverlay={handleToggleLSTOverlay}
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