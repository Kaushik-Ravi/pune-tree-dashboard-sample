// src/components/sidebar/Sidebar.tsx
import React, { useState } from 'react';
import {
  BarChartBig,
  Trees as TreeIcon,
  Scaling as SeedlingIcon,
  Layers as LayersIcon,
  ChevronDown,
  X as XIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
} from 'lucide-react';
import CityOverview from './tabs/CityOverview';
import TreeDetails from './tabs/TreeDetails';
import PlantingAdvisor from './tabs/PlantingAdvisor';
import MapLayers from './tabs/MapLayers';
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
}

const Sidebar: React.FC<SidebarProps> = ({
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
  is3D
}) => {
  const [isPeeking, setIsPeeking] = useState(false);
  const [isTabDropdownOpen, setTabDropdownOpen] = useState(false);

  const tabs = [
    { id: 'city-overview', label: 'City Overview', icon: <BarChartBig size={18} /> },
    { id: 'tree-details', label: 'Tree Details', icon: <TreeIcon size={18} /> },
    { id: 'planting-advisor', label: 'Planting Advisor', icon: <SeedlingIcon size={18} /> },
    { id: 'map-layers', label: 'Map Layers', icon: <LayersIcon size={18} /> }
  ];

  const handleTabSelect = (index: number) => {
    setActiveTabIndex(index);
    setTabDropdownOpen(false);
  };

  const handlePeekToggle = () => {
    setIsPeeking(prev => !prev);
  }

  const renderTabContent = () => {
    switch (activeTabIndex) {
      case 0: return <CityOverview />;
      case 1: return <TreeDetails treeId={selectedTreeId} />;
      case 2:
        return <PlantingAdvisor
                  setShowTemperatureChart={setShowTemperatureChart}
                  onSpeciesChangeForChart={onActiveSpeciesChangeForChart}
               />;
      case 3: return (
        <MapLayers
          baseMap={baseMap}
          changeBaseMap={changeBaseMap}
          showLSTOverlay={showLSTOverlay}
          toggleLSTOverlay={toggleLSTOverlay}
          lstMinValue={lstMinValue}
          lstMaxValue={lstMaxValue}
          onLightChange={onLightChange}
          is3D={is3D}
        />
      );
      default: return <CityOverview />;
    }
  };

  const sidebarClasses = isOpen
    ? (isPeeking ? 'sidebar-peek' : 'sidebar-open')
    : '';

  return (
    <div className={`sidebar ${sidebarClasses}`}>
      <div className="flex justify-between items-center bg-gray-100 p-3 border-b border-gray-200 h-[var(--header-height)]">
        <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
        <div className="flex items-center space-x-2 md:hidden">
          {isPeeking ? (
            <button onClick={handlePeekToggle} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Show sidebar"><EyeOffIcon size={22} /></button>
          ) : (
            <>
              <button onClick={handlePeekToggle} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Peek map"><EyeIcon size={22} /></button>
              <button onClick={toggleSidebar} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Close sidebar"><XIcon size={24} /></button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Tab Navigation: Dropdown */}
      <div className="md:hidden bg-gray-50 border-b border-gray-200 relative h-[var(--sidebar-tabs-height)] flex items-center px-4">
        <button onClick={() => setTabDropdownOpen(!isTabDropdownOpen)} className="w-full flex justify-between items-center p-2 rounded-md bg-white border border-gray-300">
          <div className="flex items-center space-x-2">
            {tabs[activeTabIndex].icon}
            <span className="font-medium text-gray-700">{tabs[activeTabIndex].label}</span>
          </div>
          <ChevronDown size={20} className={`text-gray-500 transform transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {isTabDropdownOpen && (
          <div className="absolute top-full left-0 right-0 z-40 p-2 bg-gray-50">
            <div className="bg-white rounded-md shadow-lg border border-gray-200">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabSelect(index)}
                  className="w-full text-left px-4 py-3 flex items-center space-x-3 hover:bg-gray-100 text-gray-700"
                >
                  {tab.icon} <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Tab Navigation: Flex Row */}
      <div className="hidden md:flex bg-gray-50 border-b border-gray-200 relative h-[var(--sidebar-tabs-height)] items-center overflow-x-auto">
         {tabs.map((tab, index) => (
            <button
              key={tab.id}
              className={`flex-shrink-0 px-4 flex items-center space-x-2 whitespace-nowrap transition-colors focus:outline-none h-full ${ activeTabIndex === index ? 'bg-white text-primary-600 border-b-2 border-primary-600 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-primary-500'}`}
              onClick={() => setActiveTabIndex(index)}
            >
              {tab.icon}<span>{tab.label}</span>
            </button>
          ))}
      </div>
      <div className="sidebar-content-area p-4">{renderTabContent()}</div>
    </div>
  );
};
export default Sidebar;