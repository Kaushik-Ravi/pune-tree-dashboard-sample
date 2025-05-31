import React, { useState } from 'react';
import Header from './components/Header';
import MapView from './components/map/MapView';
import Sidebar from './components/sidebar/Sidebar';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleTreeSelect = (treeId: string) => {
    setSelectedTreeId(treeId);
    setActiveTabIndex(1); // Switch to Tree Details tab
    if (!sidebarOpen) {
      setSidebarOpen(true);
    }
  };

  return (
    <div className="dashboard-layout">
      <Header />
      
      <div className="dashboard-content">
        <div className="map-container">
          <MapView 
            onTreeSelect={handleTreeSelect}
            sidebarOpen={sidebarOpen}
            toggleSidebar={toggleSidebar}
          />
        </div>
        
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          selectedTreeId={selectedTreeId}
          activeTabIndex={activeTabIndex}
          setActiveTabIndex={setActiveTabIndex}
        />
      </div>
    </div>
  );
}

export default App;