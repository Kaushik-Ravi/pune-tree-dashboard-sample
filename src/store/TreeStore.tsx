// src/store/TreeStore.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Feature, Polygon, MultiPolygon, FeatureCollection, Point } from 'geojson';
import * as turf from '@turf/turf'; // For turf.helpers.Position type

export type DrawnGeoJson = Feature<Polygon | MultiPolygon> | null;

// --- Data Type Interfaces (MODIFIED to reflect live data) ---
export interface Tree {
  id: string;
  latitude: number;
  longitude: number;
  botanical_name_short: string;
  common_name: string;
  CO2_sequestered_kg: number;
  ward?: string;
}

export interface TreeDetails extends Tree {
  height_m?: number;
  girth_cm?: number;
  canopy_dia_m?: number;
  wood_density?: number;
  economic_i?: string;
  flowering?: string;
}

// --- Tree Species Data Structure for Planting Advisor (Unchanged) ---
export interface TreeSpeciesData {
  id: string; 
  common_name: string;
  botanical_name: string; 
  mean_cooling_effect_celsius: number; 
  p90_cooling_effect_celsius: number;
  p10_cooling_effect_celsius: number;
  height_m_min: number;
  height_m_max: number;
  girth_cm_min: number;
  girth_cm_max: number;
  canopy_dia_m_min: number;
  canopy_dia_m_max: number; 
  co2_seq_kg_min: number;
  co2_seq_kg_max: number;
}

// --- Mock Data Generation (Unchanged - preserved as requested) ---
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
  wood_density: 0.4 + Math.random() * 0.5,
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

const speciesNamesForMock = [
  { common: "Neem", botanical: "Azadirachta indica" }, { common: "Peepal", botanical: "Ficus religiosa" },
  { common: "Banyan", botanical: "Ficus benghalensis" }, { common: "Mango", botanical: "Mangifera indica" },
  { common: "Tamarind", botanical: "Tamarindus indica" }, { common: "Gulmohar", botanical: "Delonix regia" },
  { common: "Copperpod", botanical: "Peltophorum pterocarpum" }, { common: "Rain Tree", botanical: "Samanea saman" },
];

const mockSpeciesDataList: TreeSpeciesData[] = speciesNamesForMock.map((species, index) => {
  const meanCooling = parseFloat((2.0 + Math.random() * 3.0).toFixed(1));
  const p10Cooling = parseFloat(Math.max(0.5, meanCooling - (0.5 + Math.random() * 1.0)).toFixed(1));
  const p90Cooling = parseFloat((meanCooling + 0.5 + Math.random() * 2.5).toFixed(1));
  return { id: `species_${index + 1}`, common_name: species.common, botanical_name: species.botanical, mean_cooling_effect_celsius: meanCooling, p90_cooling_effect_celsius: p90Cooling, p10_cooling_effect_celsius: p10Cooling, height_m_min: 5 + Math.floor(Math.random() * 5), height_m_max: 15 + Math.floor(Math.random() * 10), girth_cm_min: 50 + Math.floor(Math.random() * 50), girth_cm_max: 150 + Math.floor(Math.random() * 150), canopy_dia_m_min: 3 + Math.floor(Math.random() * 4), canopy_dia_m_max: 8 + Math.floor(Math.random() * 7), co2_seq_kg_min: 20 + Math.floor(Math.random() * 30), co2_seq_kg_max: 80 + Math.floor(Math.random() * 70) };
});


// --- Context Interface (Unchanged) ---
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

// --- Context Creation (Unchanged) ---
const TreeStoreContext = createContext<TreeStoreContextType | undefined>(undefined);

// --- Provider Component (Unchanged, except for the final useEffect) ---
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

  // --- All mock data callbacks are preserved as requested ---
  const fetchTrees = useCallback(() => { setTrees(mockTreesRaw); setTreeDetails(mockTreeDetailsFull); }, []);
  const getTreeDetails = useCallback((id: string) => treeDetails.find(tree => tree.id === id) || null, [treeDetails]);
  const fetchWardCO2Data = useCallback(() => { setWardCO2Data(aggregatedWardCO2Data); }, []);
  const fetchWardTreeCountData = useCallback(() => { setWardTreeCountData(aggregatedWardTreeCountData); }, []);
  const fetchCityStats = useCallback(() => { setCityStats(calculatedCityStats); }, []);
  const fetchWardBoundaries = useCallback(() => { /* Placeholder */ }, []); 
  const fetchTreeSpeciesData = useCallback(() => { setTreeSpeciesData(mockSpeciesDataList); }, []);

  // --- SURGICAL MODIFICATION: This useEffect now loads live data ---
  useEffect(() => {
    // 1. Define the async function to fetch and process live data
    const loadLiveData = async () => {
      console.log("Attempting to load live data from pune_trees_live.geojson...");
      try {
        const response = await fetch('/pune-tree-dashboard-sample/pune_trees_live.geojson');
        if (!response.ok) {
          throw new Error(`Failed to fetch live data: ${response.status} ${response.statusText}`);
        }
        const geojsonData: FeatureCollection<Point, { [name: string]: any }> = await response.json();
        
        // 2. Process the fetched GeoJSON into the formats needed by the application state
        const loadedTrees: Tree[] = [];
        const loadedTreeDetails: TreeDetails[] = [];
        const wardTreeCounts: { [key: string]: number } = {};
        const wardCO2Sums: { [key: string]: number } = {};

        for (const feature of geojsonData.features) {
          const props = feature.properties;
          const tree: Tree = {
            id: String(props.Tree_ID),
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
            common_name: props.Common_Name || 'N/A',
            botanical_name_short: props.Botanical_Name || 'N/A',
            CO2_sequestered_kg: props.CO2_Sequestration_kg_yr || 0,
            ward: props.ward,
          };
          loadedTrees.push(tree);

          loadedTreeDetails.push({
            ...tree,
            height_m: props.Height_m,
            girth_cm: props.Girth_cm,
            canopy_dia_m: props.Canopy_Diameter_m,
            economic_i: props.economic_i,
            flowering: props.flowering,
            wood_density: props.wood_density,
          });

          if (tree.ward) {
            wardTreeCounts[tree.ward] = (wardTreeCounts[tree.ward] || 0) + 1;
            wardCO2Sums[tree.ward] = (wardCO2Sums[tree.ward] || 0) + tree.CO2_sequestered_kg;
          }
        }

        // 3. Update the state with the new live data
        setTrees(loadedTrees);
        setTreeDetails(loadedTreeDetails);
        setCityStats({
          total_trees: loadedTrees.length,
          total_co2_annual_kg: loadedTrees.reduce((sum, t) => sum + t.CO2_sequestered_kg, 0),
        });

        const sortedWards = Object.keys(wardTreeCounts).sort((a,b) => parseInt(a) - parseInt(b));
        setWardTreeCountData(sortedWards.map(ward => ({ ward, tree_count: wardTreeCounts[ward] })));
        setWardCO2Data(sortedWards.map(ward => ({ ward, co2_kg: wardCO2Sums[ward] })));

        console.log(`Live data successfully loaded and processed: ${loadedTrees.length} trees.`);

      } catch (error) {
        console.error("Error loading live data, falling back to mock data.", error);
        // If fetch fails, the original mock data will remain in the state.
        fetchTrees();
        fetchCityStats();
        fetchWardCO2Data();
        fetchWardTreeCountData();
      }
    };

    // 4. Call the new function and the preserved mock data functions
    loadLiveData();
    fetchTreeSpeciesData(); // This still loads mock data as requested
    fetchWardBoundaries();   // This is a placeholder and does nothing

  }, [fetchTrees, fetchCityStats, fetchWardCO2Data, fetchWardTreeCountData, fetchWardBoundaries, fetchTreeSpeciesData]);
  // The dependency array is kept identical to your original file to be minimally invasive.

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

// --- Custom Hook to use Store (Unchanged) ---
export const useTreeStore = () => {
  const context = useContext(TreeStoreContext);
  if (context === undefined) { 
    throw new Error('useTreeStore must be used within a TreeStoreProvider'); 
  }
  return context;
};