// src/store/TreeStore.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Feature, Polygon, MultiPolygon } from 'geojson';
import * as turf from '@turf/turf'; // For turf.helpers.Position type

export type DrawnGeoJson = Feature<Polygon | MultiPolygon> | null;

// --- Tree Species Data Structure for Planting Advisor ---
export interface TreeSpeciesData {
  id: string; 
  common_name: string;
  botanical_name: string; 
  mean_cooling_effect_celsius: number; 
  p90_cooling_effect_celsius: number;  // Added for 90th percentile cooling
  p10_cooling_effect_celsius: number;  // Added for 10th percentile cooling
  height_m_min: number;
  height_m_max: number;
  girth_cm_min: number;
  girth_cm_max: number;
  canopy_dia_m_min: number;
  canopy_dia_m_max: number; 
  co2_seq_kg_min: number;
  co2_seq_kg_max: number;
}

// --- Mock Data Generation ---
const mockTreesRaw = Array(100).fill(null).map((_, index) => ({
  id: `tree_${index + 1}`,
  latitude: 18.52 + (Math.random() * 0.1 - 0.05),
  longitude: 73.85 + (Math.random() * 0.1 - 0.05),
  botanical_name_short: `Tree Species ${index % 8 + 1}`,
  common_name: `Common Name ${index % 8 + 1}`,
  CO2_sequestered_kg: 50 + Math.random() * 100,
  ward: String(Math.floor(Math.random() * 15) + 1) 
}));

const mockTreeDetailsFull = mockTreesRaw.map(tree => ({
  ...tree, 
  height_m: 5 + Math.random() * 10,
  girth_cm: 30 + Math.random() * 100,
  canopy_dia_m: 3 + Math.random() * 5,
  wood_density: 0.4 + Math.random() * 0.5, // Wood density is in treeDetails
  economic_i: ['Timber', 'Fruit', 'Medicinal', 'Ornamental', 'Shade'][Math.floor(Math.random() * 5)],
  flowering: ['Spring', 'Summer', 'Monsoon', 'Winter', 'Year-round'][Math.floor(Math.random() * 5)],
}));

const distinctWards = [...new Set(mockTreesRaw.map(t => t.ward))].sort((a,b) => parseInt(a) - parseInt(b));

const aggregatedWardCO2Data = distinctWards.map(wardId => {
  const treesInWard = mockTreesRaw.filter(t => t.ward === wardId);
  const totalCO2 = treesInWard.reduce((sum, tree) => sum + tree.CO2_sequestered_kg, 0);
  return { ward: wardId, co2_kg: totalCO2 };
});

const aggregatedWardTreeCountData = distinctWards.map(wardId => {
  const treesInWard = mockTreesRaw.filter(t => t.ward === wardId);
  return { ward: wardId, tree_count: treesInWard.length };
});

const calculatedCityStats = {
  total_trees: mockTreesRaw.length,
  total_co2_annual_kg: mockTreesRaw.reduce((sum, tree) => sum + tree.CO2_sequestered_kg, 0),
};

interface WardBoundaryFeatureCollection { type: "FeatureCollection"; features: Array<{ type: "Feature"; properties: any; geometry: any; }>; }
const mockWardBoundariesPlaceholder: WardBoundaryFeatureCollection | null = null; 

// UPDATED MOCK SPECIES DATA with P90 and P10 cooling
const speciesNamesForMock = [
  { common: "Neem", botanical: "Azadirachta indica" },
  { common: "Peepal", botanical: "Ficus religiosa" },
  { common: "Banyan", botanical: "Ficus benghalensis" },
  { common: "Mango", botanical: "Mangifera indica" },
  { common: "Tamarind", botanical: "Tamarindus indica" },
  { common: "Gulmohar", botanical: "Delonix regia" },
  { common: "Copperpod", botanical: "Peltophorum pterocarpum" },
  { common: "Rain Tree", botanical: "Samanea saman" },
];

const mockSpeciesDataList: TreeSpeciesData[] = speciesNamesForMock.map((species, index) => {
  const meanCooling = parseFloat((2.0 + Math.random() * 3.0).toFixed(1)); // e.g., 2.0 to 5.0 °C avg cooling
  const p10Cooling = parseFloat(Math.max(0.5, meanCooling - (0.5 + Math.random() * 1.0)).toFixed(1)); // P10 typically lower, but positive
  const p90Cooling = parseFloat((meanCooling + 0.5 + Math.random() * 2.5).toFixed(1)); // P90 typically higher
  
  return {
    id: `species_${index + 1}`,
    common_name: species.common,
    botanical_name: species.botanical,
    mean_cooling_effect_celsius: meanCooling, 
    p90_cooling_effect_celsius: p90Cooling,
    p10_cooling_effect_celsius: p10Cooling,
    height_m_min: 5 + Math.floor(Math.random() * 5), 
    height_m_max: 15 + Math.floor(Math.random() * 10), 
    girth_cm_min: 50 + Math.floor(Math.random() * 50), 
    girth_cm_max: 150 + Math.floor(Math.random() * 150),
    canopy_dia_m_min: 3 + Math.floor(Math.random() * 4), 
    canopy_dia_m_max: 8 + Math.floor(Math.random() * 7),  
    co2_seq_kg_min: 20 + Math.floor(Math.random() * 30), 
    co2_seq_kg_max: 80 + Math.floor(Math.random() * 70), 
  };
});


// --- Context Interface ---
interface TreeStoreContextType {
  trees: typeof mockTreesRaw;
  fetchTrees: () => void;
  getTreeDetails: (id: string) => typeof mockTreeDetailsFull[0] | null;
  wardCO2Data: typeof aggregatedWardCO2Data;
  fetchWardCO2Data: () => void;
  wardTreeCountData: typeof aggregatedWardTreeCountData; 
  fetchWardTreeCountData: () => void;      
  cityStats: typeof calculatedCityStats;
  fetchCityStats: () => void;
  wardBoundaries: WardBoundaryFeatureCollection | null; 
  fetchWardBoundaries: () => void;
  treeSpeciesData: TreeSpeciesData[]; 
  fetchTreeSpeciesData: () => void;   
  selectedArea: { type: 'geojson', geojsonData: DrawnGeoJson } | null;
  setSelectedArea: (area: { type: 'geojson', geojsonData: DrawnGeoJson } | null) => void;
  simulatedPlantingPoints: turf.helpers.Position[];
  setSimulatedPlantingPoints: (points: turf.helpers.Position[]) => void;
}

// --- Context Creation ---
const TreeStoreContext = createContext<TreeStoreContextType | undefined>(undefined);

// --- Provider Component ---
export const TreeStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [trees, setTrees] = useState<typeof mockTreesRaw>([]);
  const [treeDetails, setTreeDetails] = useState<typeof mockTreeDetailsFull>([]);
  const [wardCO2Data, setWardCO2Data] = useState<typeof aggregatedWardCO2Data>([]);
  const [wardTreeCountData, setWardTreeCountData] = useState<typeof aggregatedWardTreeCountData>([]);
  const [cityStats, setCityStats] = useState<typeof calculatedCityStats>(calculatedCityStats); 
  const [wardBoundaries, setWardBoundaries] = useState<WardBoundaryFeatureCollection | null>(mockWardBoundariesPlaceholder);
  const [treeSpeciesData, setTreeSpeciesData] = useState<TreeSpeciesData[]>([]);
  const [selectedArea, setSelectedArea] = useState<{ type: 'geojson', geojsonData: DrawnGeoJson } | null>(null);
  const [simulatedPlantingPoints, setSimulatedPlantingPoints] = useState<turf.helpers.Position[]>([]);

  const fetchTrees = useCallback(() => { setTrees(mockTreesRaw); setTreeDetails(mockTreeDetailsFull); }, []);
  const getTreeDetails = useCallback((id: string) => treeDetails.find(tree => tree.id === id) || null, [treeDetails]);
  const fetchWardCO2Data = useCallback(() => { setWardCO2Data(aggregatedWardCO2Data); }, []);
  const fetchWardTreeCountData = useCallback(() => { setWardTreeCountData(aggregatedWardTreeCountData); }, []);
  const fetchCityStats = useCallback(() => { setCityStats(calculatedCityStats); }, []);
  const fetchWardBoundaries = useCallback(() => { /* Placeholder */ }, []); 
  const fetchTreeSpeciesData = useCallback(() => { setTreeSpeciesData(mockSpeciesDataList); }, []);

  useEffect(() => {
    fetchTrees(); 
    fetchCityStats(); 
    fetchWardCO2Data(); 
    fetchWardTreeCountData(); 
    fetchWardBoundaries(); 
    fetchTreeSpeciesData(); 
  }, [fetchTrees, fetchCityStats, fetchWardCO2Data, fetchWardTreeCountData, fetchWardBoundaries, fetchTreeSpeciesData]);

  return (
    <TreeStoreContext.Provider
      value={{
        trees, fetchTrees, getTreeDetails,
        wardCO2Data, fetchWardCO2Data,
        wardTreeCountData, fetchWardTreeCountData, 
        cityStats, fetchCityStats,
        wardBoundaries, fetchWardBoundaries,
        treeSpeciesData, fetchTreeSpeciesData, 
        selectedArea, setSelectedArea, 
        simulatedPlantingPoints, setSimulatedPlantingPoints 
      }}
    >
      {children}
    </TreeStoreContext.Provider>
  );
};

// --- Custom Hook to use Store ---
export const useTreeStore = () => {
  const context = useContext(TreeStoreContext);
  if (context === undefined) { 
    throw new Error('useTreeStore must be used within a TreeStoreProvider'); 
  }
  return context;
};