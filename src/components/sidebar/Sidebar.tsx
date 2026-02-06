// src/components/sidebar/Sidebar.tsx
import React, { forwardRef } from 'react';
import {
  BarChartBig,
  Trees as TreeIcon,
  Scaling as SeedlingIcon,
  Layers as LayersIcon,
  Map as MapAnalysisIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Github,
  Linkedin,
  Globe,
} from 'lucide-react';
import CityOverview from './tabs/CityOverview';
import TreeDetails from './tabs/TreeDetails';
import PlantingAdvisor from './tabs/PlantingAdvisor';
import MapLayers, { ShadowQuality } from './tabs/MapLayers';
import GreenCoverMonitor from './tabs/GreenCoverMonitor';
import { TreeFilterBar } from '../filters';
import { ArchetypeData } from '../../store/TreeStore';
import { LightConfig } from './tabs/LightAndShadowControl';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  selectedTreeId: string | null;
  activeTabIndex: number;
  setActiveTabIndex: (index: number) => void;
  baseMap: string;
  changeBaseMap: (mapType: string) => void;
  showLSTOverlay: boolean;
  toggleLSTOverlay: () => void;
  lstMinValue: number;
  lstMaxValue: number;
  setShowTemperatureChart: (show: boolean) => void;
  onActiveSpeciesChangeForChart: (speciesDetails: ArchetypeData | null) => void;
  onLightChange: (config: LightConfig | null) => void;
  is3D: boolean;
  shadowsEnabled: boolean;
  onShadowsToggle: (enabled: boolean) => void;
  shadowQuality?: ShadowQuality;
  onShadowQualityChange?: (quality: ShadowQuality) => void;
  showTreeShadows?: boolean;
  onTreeShadowsToggle?: (enabled: boolean) => void;
  showBuildingShadows?: boolean;
  onBuildingShadowsToggle?: (enabled: boolean) => void;
  /** When true, raises z-index above Joyride overlay so spotlight reveals this element */
  tourFocusMode?: boolean;
  // Green Cover Monitor props
  showWardBoundaries?: boolean;
  onWardBoundariesToggle?: (enabled: boolean) => void;
  greenCoverYear?: number;
  onGreenCoverYearChange?: (year: number) => void;
  wardColorBy?: 'green_score' | 'trees_pct' | 'change';
  onWardColorByChange?: (colorBy: 'green_score' | 'trees_pct' | 'change') => void;
  // Deforestation Hotspots props
  showDeforestationHotspots?: boolean;
  onDeforestationHotspotsToggle?: (enabled: boolean) => void;
  hotspotConfig?: {
    lossThreshold: number;
    colorScheme: 'red' | 'orange' | 'heatmap';
    opacity: number;
    showLabels: boolean;
    pulseAnimation: boolean;
  };
  onHotspotConfigChange?: (config: {
    lossThreshold: number;
    colorScheme: 'red' | 'orange' | 'heatmap';
    opacity: number;
    showLabels: boolean;
    pulseAnimation: boolean;
  }) => void;
}

const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(({
  isOpen,
  toggleSidebar,
  selectedTreeId,
  activeTabIndex,
  setActiveTabIndex,
  baseMap,
  changeBaseMap,
  showLSTOverlay,
  toggleLSTOverlay,
  lstMinValue,
  lstMaxValue,
  setShowTemperatureChart,
  onActiveSpeciesChangeForChart,
  onLightChange,
  is3D,
  shadowsEnabled,
  onShadowsToggle,
  shadowQuality,
  onShadowQualityChange,
  showTreeShadows,
  onTreeShadowsToggle,
  showBuildingShadows,
  onBuildingShadowsToggle,
  tourFocusMode,
  showWardBoundaries,
  onWardBoundariesToggle,
  greenCoverYear,
  onGreenCoverYearChange,
  wardColorBy,
  onWardColorByChange,
  showDeforestationHotspots,
  onDeforestationHotspotsToggle,
  hotspotConfig,
  onHotspotConfigChange,
}, ref) => {
  const tabs = [
    { id: 'city-overview', label: 'City Overview', icon: <BarChartBig size={18} /> },
    { id: 'tree-details', label: 'Tree Details', icon: <TreeIcon size={18} /> },
    { id: 'green-cover', label: 'Green Cover', icon: <MapAnalysisIcon size={18} />, tourId: 'tab-green-cover' },
    { id: 'planting-advisor', label: 'Planting Advisor', icon: <SeedlingIcon size={18} />, tourId: 'tab-planting-advisor' },
    { id: 'map-layers', label: 'Map Layers', icon: <LayersIcon size={18} />, tourId: 'tab-map-layers' }
  ];

  const tabContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabContainerRef.current) {
      const scrollAmount = direction === 'left' ? -150 : 150;
      tabContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const renderTabContent = () => {
    switch (activeTabIndex) {
      case 0: return <CityOverview />;
      case 1: return <TreeDetails treeId={selectedTreeId} />;
      case 2: return (
        <GreenCoverMonitor
          showWardBoundaries={showWardBoundaries}
          onWardBoundariesToggle={onWardBoundariesToggle}
          selectedYear={greenCoverYear}
          onYearChange={onGreenCoverYearChange}
          colorBy={wardColorBy}
          onColorByChange={onWardColorByChange}
          showDeforestationHotspots={showDeforestationHotspots}
          onDeforestationHotspotsToggle={onDeforestationHotspotsToggle}
          hotspotConfig={hotspotConfig}
          onHotspotConfigChange={onHotspotConfigChange}
        />
      );
      case 3:
        return <PlantingAdvisor
          setShowTemperatureChart={setShowTemperatureChart}
          onSpeciesChangeForChart={onActiveSpeciesChangeForChart}
        />;
      case 4: return (
        <MapLayers
          baseMap={baseMap}
          changeBaseMap={changeBaseMap}
          showLSTOverlay={showLSTOverlay}
          toggleLSTOverlay={toggleLSTOverlay}
          lstMinValue={lstMinValue}
          lstMaxValue={lstMaxValue}
          onLightChange={onLightChange}
          is3D={is3D}
          shadowsEnabled={shadowsEnabled}
          onShadowsToggle={onShadowsToggle}
          shadowQuality={shadowQuality}
          onShadowQualityChange={onShadowQualityChange}
          showTreeShadows={showTreeShadows}
          onTreeShadowsToggle={onTreeShadowsToggle}
          showBuildingShadows={showBuildingShadows}
          onBuildingShadowsToggle={onBuildingShadowsToggle}
        />
      );
      default: return <CityOverview />;
    }
  };

  return (
    <div
      ref={ref}
      className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-collapsed'} ${tourFocusMode ? 'z-[10001] !transform-none' : ''}`}
    >
      {/* Mobile-only Grab Handle */}
      <div className="md:hidden w-full flex justify-center pt-3 pb-2">
        <div className="w-10 h-1.5 bg-gray-300 rounded-full"></div>
      </div>

      <div className="flex justify-between items-center bg-gray-100 p-3 border-b border-gray-200 h-[var(--header-height)]">
        <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
        <button
          onClick={toggleSidebar}
          className="p-1 text-gray-500 rounded-full hover:bg-gray-200 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Close sidebar"
        >
          <X size={24} />
        </button>
      </div>

      {/* Tree Filter Bar - Collapsible */}
      <TreeFilterBar />

      <div data-tour-id="sidebar-tabs" className="bg-gray-50 border-b border-gray-200 relative h-[var(--sidebar-tabs-height)] flex items-center">
        {/* Desktop-only scroll buttons */}
        <button onClick={() => scrollTabs('left')} className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 text-gray-500 hover:text-gray-800" aria-label="Scroll tabs left"><ChevronLeft size={20} /></button>

        <div ref={tabContainerRef} className="flex overflow-x-auto hide-scrollbar mx-2 md:mx-8 flex-nowrap h-full">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              data-tour-id={tab.tourId}
              className={`flex-shrink-0 px-4 flex items-center space-x-2 whitespace-nowrap transition-colors focus:outline-none h-full ${activeTabIndex === index ? 'bg-white text-primary-600 border-b-2 border-primary-600 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-primary-500'}`}
              onClick={() => setActiveTabIndex(index)}
            >
              {tab.icon}<span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Desktop-only scroll buttons */}
        <button onClick={() => scrollTabs('right')} className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 text-gray-500 hover:text-gray-800" aria-label="Scroll tabs right"><ChevronRight size={20} /></button>
      </div>

      <div className="sidebar-content-area p-4 flex-1 overflow-y-auto">{renderTabContent()}</div>

      {/* Creator Attribution - Fixed at Bottom */}
      <div className="border-t border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 flex justify-between items-center z-20">
        <div className="flex items-center space-x-1">
          <span>Built by</span>
          <a
            href="https://www.kaushikravi.tech/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-700 hover:text-primary-600 transition-colors flex items-center gap-1"
          >
            Kaushik
            <Globe size={12} className="inline opacity-0 md:group-hover:opacity-100 transition-opacity" />
          </a>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="https://github.com/Kaushik-Ravi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-900 transition-colors"
            title="GitHub"
          >
            <Github size={14} />
          </a>
          <a
            href="https://www.linkedin.com/in/kaushik2002/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title="LinkedIn"
          >
            <Linkedin size={14} />
          </a>
        </div>
      </div>
    </div>
  );
});

export default Sidebar;