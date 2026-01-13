// src/App.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import MapView from './components/map/MapView';
import Sidebar from './components/sidebar/Sidebar';
import TemperaturePredictionChart from './components/common/TemperaturePredictionChart';
import { ArchetypeData, useTreeStore } from './store/TreeStore';
import { LightConfig } from './components/sidebar/tabs/LightAndShadowControl';
import { ShadowQuality } from './components/sidebar/tabs/MapLayers';
import TourGuide, { TourControlAction } from './components/tour/TourGuide';
import { getStepRequirements } from './components/tour/tourConfig';

const LoadingOverlay: React.FC = () => (
  <div className="fixed inset-0 bg-white bg-opacity-90 z-[20000] flex flex-col items-center justify-center">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-600"></div>
    <p className="mt-4 text-lg text-gray-700 font-medium">Preparing Your Dashboard...</p>
  </div>
);

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [baseMap, setBaseMap] = useState('light');
  const [showLSTOverlay, setShowLSTOverlay] = useState(false);
  
  const [is3D, setIs3D] = useState(false);
  const [lightConfig, setLightConfig] = useState<LightConfig | null>(null);
  // Shadow system disabled - requires MapTiler Buildings tileset (paid feature)
  const [shadowsEnabled, setShadowsEnabled] = useState(false);
  const [shadowQuality, setShadowQuality] = useState<ShadowQuality>('high');
  const [showTreeShadows, setShowTreeShadows] = useState(false);
  const [showBuildingShadows, setShowBuildingShadows] = useState(false);

  const { cityStats } = useTreeStore();
  const [isLoading, setIsLoading] = useState(true);
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [isPreparingStep, setIsPreparingStep] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mapReadyRef = useRef(false);

  // Improved tour initialization - wait for map to be ready
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('hasCompletedTour');
    if (cityStats) {
      setIsLoading(false);
      // Delay tour start to ensure map and controls are mounted
      if (!hasCompletedTour) {
        setTimeout(() => {
          mapReadyRef.current = true;
          setRunTour(true);
        }, 1500); // Give map time to load
      }
    }
  }, [cityStats]);

  // Helper function to wait for sidebar transition
  const waitForSidebarTransition = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const sidebarElement = sidebarRef.current;
      const isMobile = window.innerWidth < 768;
      
      if (!sidebarElement) {
        // If no sidebar element, just use a fixed delay
        setTimeout(resolve, isMobile ? 400 : 300);
        return;
      }

      let transitionEnded = false;
      
      const handleTransitionEnd = (e: TransitionEvent) => {
        // Only respond to transform or translate transitions (the main sidebar animation)
        if (e.propertyName === 'transform' || e.propertyName === 'translate') {
          transitionEnded = true;
          sidebarElement.removeEventListener('transitionend', handleTransitionEnd);
          // Small delay to ensure content is rendered
          setTimeout(resolve, 150);
        }
      };

      sidebarElement.addEventListener('transitionend', handleTransitionEnd);
      
      // Fallback timeout in case transition doesn't fire
      setTimeout(() => {
        if (!transitionEnded) {
          sidebarElement.removeEventListener('transitionend', handleTransitionEnd);
          resolve();
        }
      }, isMobile ? 600 : 500);
    });
  }, []);

  // Pre-step orchestration: prepare UI state before advancing tour
  const executePreStepActions = useCallback(async (stepKey: string): Promise<void> => {
    const requirements = getStepRequirements(stepKey);
    if (!requirements) return;

    setIsPreparingStep(true);

    try {
      const isMobile = window.innerWidth < 768;
      
      // Handle sidebar state changes
      if (requirements.requiresSidebar === 'open' && !sidebarOpen) {
        setSidebarOpen(true);
        await waitForSidebarTransition();
      } else if (requirements.requiresSidebar === 'closed' && sidebarOpen) {
        setSidebarOpen(false);
        // On mobile, give extra time for overlay to fade out
        await waitForSidebarTransition();
        if (isMobile) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Handle tab switching (after sidebar is in correct state)
      if (requirements.requiresTab !== undefined && requirements.requiresSidebar === 'open') {
        setActiveTabIndex(requirements.requiresTab);
        // Wait for tab content to render
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Handle 3D mode if needed
      if (requirements.requires3D && !is3D) {
        setIs3D(true);
        await new Promise(resolve => setTimeout(resolve, 300));
      } else if (requirements.requires3D === false && is3D) {
        setIs3D(false);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Final delay to ensure everything is stable
      await new Promise(resolve => setTimeout(resolve, 150));
    } finally {
      setIsPreparingStep(false);
    }
  }, [sidebarOpen, is3D, waitForSidebarTransition]);

  const handleTourControl = useCallback(async (action: TourControlAction, payload?: any) => {
    const stepKey = payload;

    switch (action) {
      case 'NEXT_STEP': {
        if (stepKey) {
          // Execute pre-step actions BEFORE advancing step index
          await executePreStepActions(stepKey);
        }
        setTourStepIndex(prev => prev + 1);
        break;
      }
      case 'PREV_STEP': {
        // For backward navigation, we need to prepare the PREVIOUS step's state
        if (stepKey) {
          await executePreStepActions(stepKey);
        }
        setTourStepIndex(prev => Math.max(0, prev - 1));
        break;
      }
      case 'SKIP_STEP': {
        setTourStepIndex(prev => prev + 1);
        break;
      }
      case 'RESTART': {
        setTourStepIndex(0);
        setRunTour(false);
        setIsPreparingStep(false);
        localStorage.setItem('hasCompletedTour', 'true');
        setSidebarOpen(false);
        break;
      }
      default:
        break;
    }
  }, [executePreStepActions]);

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
        isPreparingStep={isPreparingStep}
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
          shadowsEnabled={shadowsEnabled}
          shadowQuality={shadowQuality}
          showTreeShadows={showTreeShadows}
          showBuildingShadows={showBuildingShadows}
        />

        {/* Mobile overlay - only show when sidebar is open AND tour is not running or is preparing */}
        {sidebarOpen && (!runTour || isPreparingStep) && (
          <div
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black bg-opacity-30 z-20 md:hidden transition-opacity duration-300"
            aria-hidden="true"
          />
        )}

        <Sidebar
          ref={sidebarRef}
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
          shadowsEnabled={shadowsEnabled}
          onShadowsToggle={setShadowsEnabled}
          shadowQuality={shadowQuality}
          onShadowQualityChange={setShadowQuality}
          showTreeShadows={showTreeShadows}
          onTreeShadowsToggle={setShowTreeShadows}
          showBuildingShadows={showBuildingShadows}
          onBuildingShadowsToggle={setShowBuildingShadows}
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