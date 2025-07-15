// src/store/TreeStore.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Feature, Polygon, MultiPolygon } from 'geojson';
import * as turf from '@turf/turf';
import { type Position } from 'geojson';

// --- Type definitions remain unchanged, ensuring component compatibility ---
export type DrawnGeoJson = Feature<Polygon | MultiPolygon> | null;

// This interface is now for the *full detail* view of a tree.
export interface TreeDetails {
  id: string;
  botanical_name: string;
  common_name: string;
  height_m?: number;
  girth_cm?: number;
  canopy_dia_m?: number;
  co2_sequestered_kg?: number; // Corrected name
  ward?: string;
  economic_i?: string;
  flowering?: string;
  wood_density?: number;
  [key: string]: any; 
}

// TreeSpeciesData for the Planting Advisor remains unchanged.
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

// --- Mock data for species advisor remains for feature integrity ---
const speciesNamesForMock = [ { common: "Neem", botanical: "Azadirachta indica" }, { common: "Peepal", botanical: "Ficus religiosa" }, { common: "Banyan", botanical: "Ficus benghalensis" }, { common: "Mango", botanical: "Mangifera indica" }, { common: "Tamarind", botanical: "Tamarindus indica" }, { common: "Gulmohar", botanical: "Delonix regia" }, { common: "Copperpod", botanical: "Peltophorum pterocarpum" }, { common: "Rain Tree", botanical: "Samanea saman" }, ];
const mockSpeciesDataList: TreeSpeciesData[] = speciesNamesForMock.map((species, index) => { const meanCooling = parseFloat((2.0 + Math.random() * 3.0).toFixed(1)); const p10Cooling = parseFloat(Math.max(0.5, meanCooling - (0.5 + Math.random() * 1.0)).toFixed(1)); const p90Cooling = parseFloat((meanCooling + 0.5 + Math.random() * 2.5).toFixed(1)); return { id: `species_${index + 1}`, common_name: species.common, botanical_name: species.botanical, mean_cooling_effect_celsius: meanCooling, p90_cooling_effect_celsius: p90Cooling, p10_cooling_effect_celsius: p10Cooling, height_m_min: 5 + Math.floor(Math.random() * 5), height_m_max: 15 + Math.floor(Math.random() * 10), girth_cm_min: 50 + Math.floor(Math.random() * 50), girth_cm_max: 150 + Math.floor(Math.random() * 150), canopy_dia_m_min: 3 + Math.floor(Math.random() * 4), canopy_dia_m_max: 8 + Math.floor(Math.random() * 7), co2_seq_kg_min: 20 + Math.floor(Math.random() * 30), co2_seq_kg_max: 80 + Math.floor(Math.random() * 70) }; });


// --- Context Interface (Updated for the new async architecture) ---
interface TreeStoreContextType {
  getTreeDetails: (id: string) => Promise<TreeDetails | null>;
  wardCO2Data: { ward: string; co2_kg: number }[];
  wardTreeCountData: { ward: string; tree_count: number }[];
  cityStats: { total_trees: number; total_co2_annual_kg: number } | null;
  treeSpeciesData: TreeSpeciesData[];
  selectedArea: { type: 'geojson', geojsonData: DrawnGeoJson } | null;
  setSelectedArea: (area: { type: 'geojson', geojsonData: DrawnGeoJson } | null) => void;
  simulatedPlantingPoints: Position[];
  setSimulatedPlantingPoints: (points: Position[]) => void;
}

const TreeStoreContext = createContext<TreeStoreContextType | undefined>(undefined);

export const TreeStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wardCO2Data, setWardCO2Data] = useState<{ ward: string; co2_kg: number }[]>([]);
  const [wardTreeCountData, setWardTreeCountData] = useState<{ ward: string; tree_count: number }[]>([]);
  const [cityStats, setCityStats] = useState<{ total_trees: number; total_co2_annual_kg: number } | null>(null);
  const [treeSpeciesData, setTreeSpeciesData] = useState<TreeSpeciesData[]>([]);
  const [selectedArea, setSelectedArea] = useState<{ type: 'geojson', geojsonData: DrawnGeoJson } | null>(null);
  const [simulatedPlantingPoints, setSimulatedPlantingPoints] = useState<Position[]>([]);

  // This effect now fetches the pre-aggregated summary data on initial load.
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const statsResponse = await fetch('/.netlify/functions/get-city-stats');
        if (!statsResponse.ok) {
        console.error("Failed to fetch city stats from API", statsResponse.statusText);
        throw new Error("city-stats API call failed.");
        }
        const statsData = await statsResponse.json();
        setCityStats(statsData.city_wide);
        const formattedWardData = statsData.by_ward.map((d: any) => ({
        ...d,
        co2_kg: parseFloat(d.co2_kg),
        tree_count: parseInt(d.tree_count, 10)
        }));
        setWardCO2Data(formattedWardData);
        setWardTreeCountData(formattedWardData);
        console.log("City-wide stats loaded successfully from API.");

        // Planting advisor data remains mock, preserving feature integrity.
        setTreeSpeciesData(mockSpeciesDataList);
        console.log("Mock species data loaded.");
      } catch (error) {
        console.error("Failed to load initial data. The dashboard might not show summary stats.", error);
        // Fallback to empty data to prevent crashes.
        setCityStats({ total_trees: 0, total_co2_annual_kg: 0 });
        setWardCO2Data([]);
        setWardTreeCountData([]);
      }
    };
    fetchInitialData();
  }, []);

  // getTreeDetails is now an async function that fetches a single tree's details.
  const getTreeDetails = useCallback(async (id: string): Promise<TreeDetails | null> => {
    if (!id) return null;
    try {
      const response = await fetch(`/.netlify/functions/get-tree?id=${id}`);
      if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
        const errorData = await response.json();
        console.error('Error details:', errorData.error);
        throw new Error(`Details for tree ${id} not found.`);
      }
      const data: TreeDetails = await response.json();
      return data;
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);

  // The context provides the exact same functions and state shapes as before, where possible.
  return (
    <TreeStoreContext.Provider
      value={{
        getTreeDetails,
        wardCO2Data,
        wardTreeCountData,
        cityStats,
        treeSpeciesData,
        selectedArea,
        setSelectedArea,
        simulatedPlantingPoints,
        setSimulatedPlantingPoints
      }}
    >
      {children}
    </TreeStoreContext.Provider>
  );
};

// The hook remains unchanged.
export const useTreeStore = () => {
  const context = useContext(TreeStoreContext);
  if (context === undefined) {
    throw new Error('useTreeStore must be used within a TreeStoreProvider');
  }
  return context;
};