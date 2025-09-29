// src/store/TreeStore.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Feature, Polygon, MultiPolygon } from 'geojson';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

export type DrawnGeoJson = Feature<Polygon | MultiPolygon> | null;
export type Position = [number, number];

// --- NEW Data Structures for Real Archetype Data ---

// Represents a single, processed archetype from our database
export interface ArchetypeData {
  id: string;
  archetype_name: string;
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
  season: string;
}

// Represents a species, containing its representative 'best' archetype and a list of all its archetypes
export interface TreeSpeciesData {
  common_name: string;
  botanical_name: string;
  representative_archetype: ArchetypeData;
  archetypes: ArchetypeData[];
}

// --- Unchanged Data Structures for Existing Features ---
interface CityStats {
  total_trees: number;
  total_co2_annual_kg: number;
}
interface WardData {
  ward: string;
  tree_count: number;
  co2_kg: number;
}
interface TreeDetailsData {
    id: string;
    geom: any;
    girth_cm: number;
    height_m: number;
    canopy_dia_m: number;
    botanical_name: string;
    common_name: string;
    co2_sequestered_kg: number;
    economic_i: string;
    flowering: string;
    ward: string;
    wood_density: number;
}

// --- Context Interface ---
interface TreeStoreContextType {
  getTreeDetails: (id: string) => Promise<TreeDetailsData | null>;
  wardCO2Data: { ward: string; co2_kg: number }[];
  wardTreeCountData: { ward: string; tree_count: number }[];
  cityStats: CityStats | null;
  fetchCityStats: () => void;
  fetchWardData: () => void;
  getStatsForPolygon: (polygon: DrawnGeoJson) => Promise<{ tree_count: number; co2_kg: number } | null>;

  // --- UPDATED FOR REAL DATA ---
  treeSpeciesData: TreeSpeciesData[]; // This now holds the grouped species data
  fetchTreeSpeciesData: () => void;

  // Unchanged parts for planting advisor state
  selectedArea: { type: 'geojson', geojsonData: DrawnGeoJson } | null;
  setSelectedArea: (area: { type: 'geojson', geojsonData: DrawnGeoJson } | null) => void;
  simulatedPlantingPoints: Position[];
  setSimulatedPlantingPoints: (points: Position[]) => void;
}

// --- Context Creation ---
const TreeStoreContext = createContext<TreeStoreContextType | undefined>(undefined);

// --- Provider Component ---
export const TreeStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wardCO2Data, setWardCO2Data] = useState<{ ward: string; co2_kg: number }[]>([]);
  const [wardTreeCountData, setWardTreeCountData] = useState<{ ward: string; tree_count: number }[]>([]);
  const [cityStats, setCityStats] = useState<CityStats | null>(null);
  
  // --- UPDATED STATE FOR REAL SPECIES DATA ---
  const [treeSpeciesData, setTreeSpeciesData] = useState<TreeSpeciesData[]>([]);
  
  const [selectedArea, setSelectedArea] = useState<{ type: 'geojson', geojsonData: DrawnGeoJson } | null>(null);
  const [simulatedPlantingPoints, setSimulatedPlantingPoints] = useState<Position[]>([]);

  // --- UPDATED: Fetch real species data from the new backend endpoint ---
  const fetchTreeSpeciesData = useCallback(async () => {
    try {
      const response = await axios.get<TreeSpeciesData[]>(`${API_BASE_URL}/api/tree-archetypes`);
      setTreeSpeciesData(response.data);
    } catch (error) {
      console.error('Error fetching tree species data:', error);
      setTreeSpeciesData([]); // Set to empty array on error
    }
  }, []);

  // --- NO CHANGES to existing, working functions below ---

  const getTreeDetails = useCallback(async (id: string): Promise<TreeDetailsData | null> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/trees/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching details for tree ${id}:`, error);
      return null;
    }
  }, []);

  const fetchCityStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/city-stats`);
      const stats = {
          total_trees: parseInt(response.data.total_trees, 10),
          total_co2_annual_kg: parseFloat(response.data.total_co2_annual_kg)
      };
      setCityStats(stats);
    } catch (error) {
      console.error('Error fetching city stats:', error);
    }
  }, []);
  
  const fetchWardData = useCallback(async () => {
    try {
        const response = await axios.get<WardData[]>(`${API_BASE_URL}/api/ward-data`);
        const wardsData = response.data;
        const co2Data = wardsData.map(w => ({ ward: w.ward, co2_kg: parseFloat(String(w.co2_kg)) }));
        const treeCountData = wardsData.map(w => ({ ward: w.ward, tree_count: parseInt(String(w.tree_count), 10) }));
        setWardCO2Data(co2Data);
        setWardTreeCountData(treeCountData);
    } catch (error) {
        console.error('Error fetching ward data:', error);
    }
  }, []);

  const getStatsForPolygon = useCallback(async (polygonFeature: DrawnGeoJson) => {
    if (!polygonFeature) return null;
    try {
        const response = await axios.post(`${API_BASE_URL}/api/stats-in-polygon`, {
            polygon: polygonFeature.geometry 
        });
        return {
            tree_count: parseInt(response.data.tree_count, 10),
            co2_kg: parseFloat(response.data.co2_kg)
        };
    } catch (error) {
        console.error('Error fetching stats for polygon:', error);
        return null;
    }
  }, []);

  // Initial data fetch on component mount
  useEffect(() => {
    fetchCityStats();
    fetchWardData();
    fetchTreeSpeciesData();
  }, [fetchCityStats, fetchWardData, fetchTreeSpeciesData]);

  return (
    <TreeStoreContext.Provider
      value={{
        getTreeDetails,
        wardCO2Data,
        wardTreeCountData,
        cityStats,
        fetchCityStats,
        fetchWardData,
        getStatsForPolygon,
        treeSpeciesData, 
        fetchTreeSpeciesData, 
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

// --- Custom Hook to use Store ---
export const useTreeStore = () => {
  const context = useContext(TreeStoreContext);
  if (context === undefined) { 
    throw new Error('useTreeStore must be used within a TreeStoreProvider'); 
  }
  return context;
};