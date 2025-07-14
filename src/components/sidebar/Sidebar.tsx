// src/components/sidebar/Sidebar.tsx
import React, { useRef } from 'react';
import { 
  BarChartBig, TreeDeciduous as TreeIcon, Sprout as SeedlingIcon, Layers as LayersIcon, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen 
} from 'lucide-react'; 
import CityOverview from './tabs/CityOverview';
import TreeDetails from './tabs/TreeDetails';
import PlantingAdvisor from './tabs/PlantingAdvisor';
import MapLayers from './tabs/MapLayers';
import { TreeSpeciesData } from '../../store/TreeStore';
import { Map as MapLibreMap } from 'maplibre-gl';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  selectedTreeId: string | null;
  activeTabIndex: number;
  setActiveTabIndex: (index: number) => void;
  mapInstance: MapLibreMap | null;
  baseMap: string;
  showLSTOverlay: boolean;
  lstMinValue: number; 
  lstMaxValue: number; 
  setShowTemperatureChart: (show: boolean) => void;
  onActiveSpeciesChangeForChart: (speciesDetails: TreeSpeciesData | null) => void;
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const { 
    isOpen, toggleSidebar, selectedTreeId, activeTabIndex, setActiveTabIndex, mapInstance,
    baseMap, showLSTOverlay, lstMinValue, lstMaxValue, setShowTemperatureChart, onActiveSpeciesChangeForChart
  } = props;

  const tabs = [
    { id: 'city-overview', label: 'City Overview', icon: <BarChartBig size={18} /> },
    { id: 'tree-details', label: 'Tree Details', icon: <TreeIcon size={18} /> },
    { id: 'planting-advisor', label: 'Planting Advisor', icon: <SeedlingIcon size={18} /> },
    { id: 'map-layers', label: 'Map Layers', icon: <LayersIcon size={18} /> }
  ];

  const tabContainerRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabContainerRef.current) {
      tabContainerRef.current.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' });
    }
  };

  const renderTabContent = () => {
    switch (activeTabIndex) {
      case 0: return <CityOverview map={mapInstance} />;
      case 1: return <TreeDetails treeId={selectedTreeId} />;
      case 2: return <PlantingAdvisor setShowTemperatureChart={setShowTemperatureChart} onSpeciesChangeForChart={onActiveSpeciesChangeForChart} />;
      case 3: return <MapLayers baseMap={baseMap} changeBaseMap={() => {}} showLSTOverlay={showLSTOverlay} toggleLSTOverlay={() => {}} lstMinValue={lstMinValue} lstMaxValue={lstMaxValue} />; 
      default: return <CityOverview map={mapInstance} />;
    }
  };

  return (
    <>
        <button 
            onClick={toggleSidebar} 
            className={`absolute top-1/2 transform -translate-y-1/2 z-[1010] bg-white p-2 shadow-xl hover:bg-gray-100 transition-all duration-300 ease-in-out border-t border-b border-gray-300 ${isOpen ? 'right-[var(--sidebar-width)] rounded-l-md border-l' : 'right-0 rounded-r-md border-r'}`}
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
            {isOpen ? <ChevronRight size={20} className="text-gray-700"/> : <ChevronLeft size={20} className="text-gray-700"/>}
        </button>

        <div className={`sidebar ${!isOpen ? 'sidebar-collapsed' : 'sidebar-open'}`}>
            <div className="flex justify-between items-center bg-gray-100 p-3 border-b border-gray-200 h-[var(--header-height)]">
                <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
            </div>
            <div className="bg-gray-50 border-b border-gray-200 relative h-[var(--sidebar-tabs-height)] flex items-center">
                <button onClick={() => scrollTabs('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 text-gray-500 hover:text-gray-800"><ChevronLeft size={20} /></button>
                <div ref={tabContainerRef} className="flex overflow-x-auto hide-scrollbar mx-8 flex-nowrap h-full">
                {tabs.map((tab, index) => (
                    <button key={tab.id} className={`flex-shrink-0 px-4 flex items-center space-x-2 whitespace-nowrap transition-colors focus:outline-none h-full ${activeTabIndex === index ? 'bg-white text-primary-600 border-b-2 border-primary-600 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-primary-500'}`} onClick={() => setActiveTabIndex(index)}>
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
                </div>
                <button onClick={() => scrollTabs('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 text-gray-500 hover:text-gray-800"><ChevronRight size={20} /></button>
            </div>
            <div className="sidebar-content-area p-4">
                {renderTabContent()}
            </div>
        </div>
    </>
  );
};
export default Sidebar;