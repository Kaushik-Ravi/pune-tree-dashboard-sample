// src/store/GreenCoverStore.tsx
/**
 * GREEN COVER MONITOR DATA STORE
 * ==============================
 * 
 * Zustand store for caching land cover and green cover data.
 * This eliminates the need to refetch data every time the tab is opened.
 * 
 * Pattern based on FilterStore.tsx and TreeStore.tsx
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineYear {
  year: number;
  ward_count: string;
  avg_trees_pct: string;
  avg_built_pct: string;
  total_trees_area_ha: string;
  total_built_area_ha: string;
}

export interface YearChange {
  from_year: number;
  to_year: number;
  period: string;
  total_trees_lost_m2: string;
  total_trees_gained_m2: string;
  net_tree_change_m2: string;
  net_tree_change_ha: string;
}

export interface OverallChange {
  total_trees_lost_ha: string;
  total_trees_gained_ha: string;
  net_tree_change_ha: string;
  total_built_gained_ha: string;
}

export interface TimelineData {
  source: string;
  years: TimelineYear[];
  year_over_year_changes: YearChange[];
  overall_2019_2025: OverallChange | null;
}

export interface WardLandCover {
  ward_number: number;
  year: number;
  trees_pct: string | number;
  built_pct: string | number;
  grass_pct: string | number;
  bare_pct: string | number;
  total_area_m2: string | number;
  trees_area_m2: string | number;
  built_area_m2: string | number;
}

export interface WardComparison {
  ward_number: number;
  from_year: number;
  to_year: number;
  trees_lost_m2: string;
  trees_gained_m2: string;
  net_tree_change_m2: string;
  built_gained_m2: string;
}

export interface WardStats {
  ward_number: number;
  tree_count: number;
  species_count: number;
  avg_canopy_m: number;
  total_canopy_area_ha: number;
}

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface GreenCoverState {
  // Data
  timelineData: TimelineData | null;
  wardData: WardLandCover[];
  comparisonData: WardComparison[];
  wardStats: WardStats[];
  
  // Map interaction state
  selectedWardNumber: number | null;
  flyToWardTrigger: number; // Increments to trigger map flyTo
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  lastFetchTime: number | null;
  
  // Actions
  fetchAllData: () => Promise<void>;
  refreshData: () => Promise<void>;
  clearCache: () => void;
  flyToWard: (wardNumber: number) => void;
  clearSelectedWard: () => void;
}

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

// ============================================================================
// STORE CREATION
// ============================================================================

export const useGreenCoverStore = create<GreenCoverState>()(
  persist(
    (set, get) => ({
      // Initial state
      timelineData: null,
      wardData: [],
      comparisonData: [],
      wardStats: [],
      selectedWardNumber: null,
      flyToWardTrigger: 0,
      isLoading: false,
      isInitialized: false,
      error: null,
      lastFetchTime: null,
      
      // Fetch all data (with cache check)
      fetchAllData: async () => {
        const state = get();
        
        // Check if we have fresh cached data
        if (
          state.isInitialized &&
          state.lastFetchTime &&
          Date.now() - state.lastFetchTime < CACHE_DURATION_MS &&
          state.timelineData &&
          state.wardData.length > 0
        ) {
          console.log('[GreenCoverStore] Using cached data');
          return;
        }
        
        // Fetch fresh data
        set({ isLoading: true, error: null });
        
        try {
          console.log('[GreenCoverStore] Fetching fresh data...');
          
          const [timelineRes, wardsRes, comparisonRes, statsRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/land-cover/timeline`, { timeout: 30000 }),
            axios.get(`${API_BASE_URL}/api/land-cover/wards`, { timeout: 30000 }),
            axios.get(`${API_BASE_URL}/api/land-cover/comparison?from_year=2019&to_year=2025`, { timeout: 30000 }),
            axios.get(`${API_BASE_URL}/api/ward-stats`, { timeout: 30000 }),
          ]);
          
          set({
            timelineData: timelineRes.data,
            wardData: wardsRes.data?.data || [],
            comparisonData: comparisonRes.data?.data || [],
            wardStats: statsRes.data?.data || [],
            isLoading: false,
            isInitialized: true,
            error: null,
            lastFetchTime: Date.now(),
          });
          
          console.log('[GreenCoverStore] Data loaded successfully', {
            timelineYears: timelineRes.data?.years?.length || 0,
            wardDataCount: wardsRes.data?.data?.length || 0,
            comparisonCount: comparisonRes.data?.data?.length || 0,
            wardStatsCount: statsRes.data?.data?.length || 0,
          });
        } catch (error: any) {
          console.error('[GreenCoverStore] Error fetching data:', error);
          set({
            isLoading: false,
            error: error.message || 'Failed to load green cover data',
          });
        }
      },
      
      // Force refresh (bypasses cache)
      refreshData: async () => {
        set({ lastFetchTime: null }); // Invalidate cache
        await get().fetchAllData();
      },
      
      // Clear all cached data
      clearCache: () => {
        set({
          timelineData: null,
          wardData: [],
          comparisonData: [],
          wardStats: [],
          isInitialized: false,
          lastFetchTime: null,
        });
      },
      
      // Fly to a specific ward on the map
      flyToWard: (wardNumber: number) => {
        set((state) => ({
          selectedWardNumber: wardNumber,
          flyToWardTrigger: state.flyToWardTrigger + 1,
        }));
      },
      
      // Clear the selected ward
      clearSelectedWard: () => {
        set({ selectedWardNumber: null });
      },
    }),
    {
      name: 'pune-green-cover-cache',
      // Only persist data, not loading states or map interaction state
      partialize: (state) => ({
        timelineData: state.timelineData,
        wardData: state.wardData,
        comparisonData: state.comparisonData,
        wardStats: state.wardStats,
        isInitialized: state.isInitialized,
        lastFetchTime: state.lastFetchTime,
      }),
    }
  )
);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate Green Score for a ward
 */
export function calculateGreenScore(
  treesPct: number,
  builtPct: number,
  netChangePct: number,
  treeDensity: number
): number {
  const treeScore = Math.min(100, (treesPct / 25) * 100);
  const builtScore = Math.max(0, 100 - (builtPct / 90) * 100);
  const changeScore = 50 + (netChangePct * 5);
  const normalizedChange = Math.max(0, Math.min(100, changeScore));
  const densityScore = Math.min(100, (treeDensity / 300) * 100);
  
  const score = (
    treeScore * 0.40 +
    builtScore * 0.30 +
    normalizedChange * 0.20 +
    densityScore * 0.10
  );
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Get color for a Green Score
 */
export function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

/**
 * Get label for a Green Score
 */
export function getScoreLabel(score: number): string {
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

/**
 * Get emoji for a Green Score
 */
export function getScoreEmoji(score: number): string {
  if (score >= 70) return '🌳';
  if (score >= 50) return '🌿';
  if (score >= 30) return '⚠️';
  return '🚨';
}

// ============================================================================
// INITIALIZATION HOOK
// ============================================================================

/**
 * Hook to prefetch Green Cover data on app load
 * Similar to how TreeStore fetches data on mount
 */
export function useGreenCoverInit() {
  const { fetchAllData, isInitialized } = useGreenCoverStore();
  
  // Fetch data once on app initialization
  React.useEffect(() => {
    if (!isInitialized) {
      fetchAllData();
    }
  }, [fetchAllData, isInitialized]);
}

// Need React for the hook
import React from 'react';
