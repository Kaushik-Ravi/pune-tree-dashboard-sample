// src/components/sidebar/Sidebar.tsx
import React, { useRef } from 'react';
import { 
  BarChartBig, 
  Trees as TreeIcon, 
  Scaling as SeedlingIcon, 
  Layers as LayersIcon,
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react'; 
import CityOverview from './tabs/CityOverview';
import TreeDetails from './tabs/TreeDetails';
import PlantingAdvisor from './tabs/PlantingAdvisor';
import MapLayers from './tabs/MapLayers';
import { TreeSpeciesData } from '../../store/TreeStore'; // Import type

interface SidebarProps {
  isOpen: boolean;
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
  onActiveSpeciesChangeForChart: (speciesDetails: TreeSpeciesData | null) => void; // NEW PROP
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
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
  onActiveSpeciesChangeForChart // Destructure new prop
}) => {
  const tabs = [
    { id: 'city-overview', label: 'City Overview', icon: <BarChartBig size={18} /> },
    { id: 'tree-details', label: 'Tree Details', icon: <TreeIcon size={18} /> },
    { id: 'planting-advisor', label: 'Planting Advisor', icon: <SeedlingIcon size={18} /> },
    { id: 'map-layers', label: 'Map Layers', icon: <LayersIcon size={18} /> }
  ];

  const tabContainerRef = useRef<HTMLDivElement>(null);

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
      case 2: 
        return <PlantingAdvisor 
                  setShowTemperatureChart={setShowTemperatureChart} 
                  onSpeciesChangeForChart={onActiveSpeciesChangeForChart} // Pass the new callback
               />;
      case 3: return (
        <MapLayers 
          baseMap={baseMap}
          changeBaseMap={changeBaseMap}
          showLSTOverlay={showLSTOverlay} 
          toggleLSTOverlay={toggleLSTOverlay}
          lstMinValue={lstMinValue} 
          lstMaxValue={lstMaxValue} 
        />
      ); 
      default: return <CityOverview />;
    }
  };

  return (
    <div className={`sidebar ${!isOpen ? 'sidebar-collapsed' : 'sidebar-open'}`}>
      <div className="flex justify-between items-center bg-gray-100 p-3 border-b border-gray-200 h-[var(--header-height)]">
        <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
      </div>
      <div className="bg-gray-50 border-b border-gray-200 relative h-[var(--sidebar-tabs-height)] flex items-center">
        <button 
          onClick={() => scrollTabs('left')} 
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 text-gray-500 hover:text-gray-800"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft size={20} />
        </button>
        <div ref={tabContainerRef} className="flex overflow-x-auto hide-scrollbar mx-8 flex-nowrap h-full">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              className={`flex-shrink-0 px-4 flex items-center space-x-2 whitespace-nowrap transition-colors focus:outline-none h-full
                ${ activeTabIndex === index 
                    ? 'bg-white text-primary-600 border-b-2 border-primary-600 font-medium' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-primary-500'
                }`}
              onClick={() => setActiveTabIndex(index)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <button 
          onClick={() => scrollTabs('right')} 
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 text-gray-500 hover:text-gray-800"
          aria-label="Scroll tabs right"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="sidebar-content-area p-4">
        {renderTabContent()}
      </div>
    </div>
  );
};
export default Sidebar;