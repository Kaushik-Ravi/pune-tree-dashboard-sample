import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Mock data for trees
const mockTrees = Array(100).fill(null).map((_, index) => ({
  id: `tree_${index + 1}`,
  latitude: 18.52 + (Math.random() * 0.1 - 0.05),
  longitude: 73.85 + (Math.random() * 0.1 - 0.05),
  botanical_name_short: `Sample Tree ${index % 5 + 1}`,
  common_name: `Common Tree ${index % 5 + 1}`,
  CO2_sequestered_kg: 50 + Math.random() * 100
}));

// Mock data for tree details
const mockTreeDetails = mockTrees.map(tree => ({
  ...tree,
  height_m: 5 + Math.random() * 10,
  girth_cm: 30 + Math.random() * 100,
  canopy_dia_m: 3 + Math.random() * 5,
  wood_density: 0.4 + Math.random() * 0.5,
  economic_i: ['Timber', 'Fruit', 'Medicinal', 'Ornamental', 'Shade'][Math.floor(Math.random() * 5)],
  flowering: ['Spring', 'Summer', 'Monsoon', 'Winter', 'Year-round'][Math.floor(Math.random() * 5)],
  ward: String(Math.floor(Math.random() * 15) + 1)
}));

// Mock ward CO2 data
const mockWardCO2Data = Array(15).fill(null).map((_, index) => ({
  ward: String(index + 1),
  co2_kg: 100000 + Math.random() * 400000
}));

// Mock city stats
const mockCityStats = {
  total_trees: 10000,
  total_co2_annual_kg: 5000000,
};

// Mock ward boundaries
const mockWardBoundaries = {
  type: 'FeatureCollection',
  features: Array(15).fill(null).map((_, index) => ({
    type: 'Feature',
    properties: {
      WARD_NO_PROPERTY: String(index + 1),
      WARD_NAME_PROPERTY: `Ward ${index + 1}`
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [73.85 + (Math.random() * 0.05 - 0.025), 18.52 + (Math.random() * 0.05 - 0.025)],
        [73.85 + (Math.random() * 0.05 - 0.025), 18.52 + (Math.random() * 0.05 - 0.025)],
        [73.85 + (Math.random() * 0.05 - 0.025), 18.52 + (Math.random() * 0.05 - 0.025)],
        [73.85 + (Math.random() * 0.05 - 0.025), 18.52 + (Math.random() * 0.05 - 0.025)],
        [73.85 + (Math.random() * 0.05 - 0.025), 18.52 + (Math.random() * 0.05 - 0.025)]
      ]]
    }
  }))
};

// Mock tree archetypes
const mockArchetypes = Array(20).fill(null).map((_, index) => {
  const seasons = ['Summer', 'Monsoon', 'Post-Monsoon', 'Winter', 'All Seasons'];
  const season = seasons[index % 5];
  const sizeCategories = ['Shortest', 'Short', 'Medium', 'Tall', 'Tallest'];
  const sizeCategory = sizeCategories[index % 5];
  const botanicalName = `Species ${index % 10 + 1}`;
  
  return {
    Archetype_Display_Name: `${botanicalName} - Arch${index + 1} (${sizeCategory} Height)`,
    Archetype_Dropdown_Name: `${botanicalName} (${sizeCategory})`,
    Season: season,
    botanical_name_short: botanicalName,
    common_name: `Common ${botanicalName}`,
    CoolEff_P90NV_mean: 3 + Math.random() * 4,
    CoolEff_P90NV_std: 0.5 + Math.random() * 1,
    HeatRelief_P10NV_Abs_mean: 1 + Math.random() * 3,
    HeatRelief_P10NV_Abs_std: 0.3 + Math.random() * 0.8,
    CoolEff_MaxNV_mean: 5 + Math.random() * 5,
    CoolEff_MaxNV_std: 1 + Math.random() * 2,
    HeatRelief_MinNV_Abs_mean: 2 + Math.random() * 3,
    HeatRelief_MinNV_Abs_std: 0.5 + Math.random() * 1,
    height_m_min_range: 3 + (index % 5) * 2,
    height_m_max_range: 6 + (index % 5) * 2,
    CO2_Seq_Min_kg: 20 + Math.random() * 30,
    CO2_Seq_Max_kg: 60 + Math.random() * 40,
    wood_density: 0.4 + Math.random() * 0.6
  };
});

interface TreeStoreContextType {
  trees: typeof mockTrees;
  fetchTrees: () => void;
  getTreeDetails: (id: string) => typeof mockTreeDetails[0] | null;
  wardCO2Data: typeof mockWardCO2Data;
  fetchWardCO2Data: () => void;
  cityStats: typeof mockCityStats;
  fetchCityStats: () => void;
  wardBoundaries: typeof mockWardBoundaries | null;
  fetchWardBoundaries: () => void;
  treeArchetypes: typeof mockArchetypes;
  fetchTreeArchetypes: () => void;
  selectedArea: { bounds: number[][] } | null;
  setSelectedArea: (area: { bounds: number[][] } | null) => void;
}

const TreeStoreContext = createContext<TreeStoreContextType | undefined>(undefined);

export const TreeStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [trees, setTrees] = useState<typeof mockTrees>([]);
  const [wardCO2Data, setWardCO2Data] = useState<typeof mockWardCO2Data>([]);
  const [cityStats, setCityStats] = useState<typeof mockCityStats>(mockCityStats);
  const [wardBoundaries, setWardBoundaries] = useState<typeof mockWardBoundaries | null>(null);
  const [treeArchetypes, setTreeArchetypes] = useState<typeof mockArchetypes>([]);
  const [selectedArea, setSelectedArea] = useState<{ bounds: number[][] } | null>(null);

  const fetchTrees = useCallback(() => {
    // In a real implementation, this would be an API call
    setTrees(mockTrees);
  }, []);

  const getTreeDetails = useCallback((id: string) => {
    // In a real implementation, this would be an API call
    const treeDetail = mockTreeDetails.find(tree => tree.id === id);
    return treeDetail || null;
  }, []);

  const fetchWardCO2Data = useCallback(() => {
    // In a real implementation, this would be an API call
    setWardCO2Data(mockWardCO2Data);
  }, []);

  const fetchCityStats = useCallback(() => {
    // In a real implementation, this would be an API call
    setCityStats(mockCityStats);
  }, []);

  const fetchWardBoundaries = useCallback(() => {
    // In a real implementation, this would be an API call
    setWardBoundaries(mockWardBoundaries);
  }, []);

  const fetchTreeArchetypes = useCallback(() => {
    // In a real implementation, this would be an API call
    setTreeArchetypes(mockArchetypes);
  }, []);

  return (
    <TreeStoreContext.Provider
      value={{
        trees,
        fetchTrees,
        getTreeDetails,
        wardCO2Data,
        fetchWardCO2Data,
        cityStats,
        fetchCityStats,
        wardBoundaries,
        fetchWardBoundaries,
        treeArchetypes,
        fetchTreeArchetypes,
        selectedArea,
        setSelectedArea
      }}
    >
      {children}
    </TreeStoreContext.Provider>
  );
};

export const useTreeStore = () => {
  const context = useContext(TreeStoreContext);
  if (context === undefined) {
    throw new Error('useTreeStore must be used within a TreeStoreProvider');
  }
  return context;
};