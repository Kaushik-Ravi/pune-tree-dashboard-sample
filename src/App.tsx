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
import { TourSteps } from './components/tour/tourSteps'; // CORRECTED: Added this import

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
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [shadowQuality, setShadowQuality] = useState<ShadowQuality>('high');
  const [showTreeShadows, setShowTreeShadows] = useState(true);
  const [showBuildingShadows, setShowBuildingShadows] = useState(true);
  const [renderMode, setRenderMode] = useState<'basic' | 'realistic'>('basic'); // Toggle between rendering modes

  const { cityStats } = useTreeStore();
  const [isLoading, setIsLoading] = useState(true);
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const tourAdvancementRef = useRef<{ nextStep: number | null }>({ nextStep: null });

  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('hasCompletedTour');
    if (cityStats) {
      setIsLoading(false);
      if (!hasCompletedTour) {
        setRunTour(true);
      }
    }
  }, [cityStats]);

  const handleTourControl = useCallback((action: TourControlAction, payload?: any) => {
    const nextStepIndex = tourStepIndex + 1;
    const nextStepKey = payload;
    let sidebarActionRequired: 'open' | 'close' | 'none' = 'none';

    switch (action) {
      case 'NEXT_STEP': {
        if (
          (nextStepKey === 'dashboardTabs' ||
           nextStepKey === 'knowYourNeighbourhood' ||
           nextStepKey === 'plantingAdvisor' ||
           nextStepKey === 'mapLayers') && !sidebarOpen
        ) {
          sidebarActionRequired = 'open';
        } else if (
          (nextStepKey === 'drawingTools' || nextStepKey === 'threeDMode') && sidebarOpen
        ) {
          sidebarActionRequired = 'close';
        }
        
        if (sidebarActionRequired !== 'none') {
          tourAdvancementRef.current.nextStep = nextStepIndex;
          setSidebarOpen(sidebarActionRequired === 'open');
        } else {
          setTourStepIndex(nextStepIndex);
        }

        // Set active tab immediately if sidebar is already in the correct state
        if (sidebarActionRequired === 'none' || (sidebarActionRequired === 'open' && sidebarOpen) || (sidebarActionRequired === 'close' && !sidebarOpen)) {
            if (nextStepKey === 'plantingAdvisor') setActiveTabIndex(2);
            else if (nextStepKey === 'mapLayers') setActiveTabIndex(3);
            else if (nextStepKey === 'knowYourNeighbourhood') setActiveTabIndex(0);
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
        setSidebarOpen(false);
        break;
      }
      default:
        break;
    }
  }, [tourStepIndex, sidebarOpen]);

  useEffect(() => {
    const sidebarElement = sidebarRef.current;
    if (!sidebarElement) return;

    const handleTransitionEnd = () => {
      if (tourAdvancementRef.current.nextStep !== null) {
        const nextStepKey = (Object.entries(TourSteps).find(([, step]) => 
            step === (window.innerWidth < 768 ? TourSteps.openDashboardMobile : TourSteps.openDashboardDesktop)
        ) || [])[0];

        // Set active tab after transition, right before showing the step
        const stepToAdvanceTo = tourAdvancementRef.current.nextStep;
        if (stepToAdvanceTo !== null) {
            const steps = window.innerWidth < 768
                ? [TourSteps.welcome, TourSteps.openDashboardMobile, TourSteps.dashboardTabs, TourSteps.drawingTools, TourSteps.knowYourNeighbourhood, TourSteps.plantingAdvisor, TourSteps.mapLayers, TourSteps.threeDMode, TourSteps.finish]
                : [TourSteps.welcome, TourSteps.openDashboardDesktop, TourSteps.dashboardTabs, TourSteps.drawingTools, TourSteps.knowYourNeighbourhood, TourSteps.plantingAdvisor, TourSteps.mapLayers, TourSteps.threeDMode, TourSteps.finish];
            
            const nextStepDetails = steps[stepToAdvanceTo];
            const nextStepTarget = nextStepDetails.target;

            if (nextStepTarget === '[data-tour-id="tab-planting-advisor"]') setActiveTabIndex(2);
            else if (nextStepTarget === '[data-tour-id="tab-map-layers"]') setActiveTabIndex(3);
            else if (nextStepTarget === '[data-tour-id="know-your-neighbourhood"]') setActiveTabIndex(0);
        }

        setTourStepIndex(tourAdvancementRef.current.nextStep);
        tourAdvancementRef.current.nextStep = null;
      }
    };

    sidebarElement.addEventListener('transitionend', handleTransitionEnd);
    return () => {
      sidebarElement.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, []);

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
          shadowsEnabled={shadowsEnabled}
        />

        {sidebarOpen && (
          <div
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black bg-opacity-30 z-20 md:hidden"
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