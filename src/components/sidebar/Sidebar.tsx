import React from 'react';
import { ChevronRight, BarChartBig, Trees as Tree, Scaling as Seedling, Layers } from 'lucide-react';
import CityOverview from './tabs/CityOverview';
import TreeDetails from './tabs/TreeDetails';
import PlantingAdvisor from './tabs/PlantingAdvisor';
import MapLayers from './tabs/MapLayers';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTreeId: string | null;
  activeTabIndex: number;
  setActiveTabIndex: (index: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose,
  selectedTreeId,
  activeTabIndex,
  setActiveTabIndex
}) => {
  // Tab configuration
  const tabs = [
    { id: 'city-overview', label: 'City Overview', icon: <BarChartBig size={18} /> },
    { id: 'tree-details', label: 'Tree Details', icon: <Tree size={18} /> },
    { id: 'planting-advisor', label: 'Planting Advisor', icon: <Seedling size={18} /> },
    { id: 'map-layers', label: 'Map Layers', icon: <Layers size={18} /> }
  ];

  // Render the active tab content
  const renderTabContent = () => {
    switch (activeTabIndex) {
      case 0:
        return <CityOverview />;
      case 1:
        return <TreeDetails treeId={selectedTreeId} />;
      case 2:
        return <PlantingAdvisor />;
      case 3:
        return <MapLayers />;
      default:
        return <CityOverview />;
    }
  };

  return (
    <div className={`sidebar ${!isOpen ? 'sidebar-collapsed' : ''} z-10`}>
      <div className="flex justify-between items-center bg-gray-100 p-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close sidebar"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Tab navigation */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              className={`px-4 py-3 flex items-center space-x-2 whitespace-nowrap transition-colors ${
                activeTabIndex === index 
                  ? 'bg-white text-primary-600 border-b-2 border-primary-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTabIndex(index)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 overflow-y-auto" style={{ height: 'calc(100% - 109px)' }}>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Sidebar;