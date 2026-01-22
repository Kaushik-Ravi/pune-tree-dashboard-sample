// src/store/FilterStore.tsx
// Zustand-based filter state management with React context integration

import React, { createContext, useContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import {
  TreeFilters,
  FilterMetadata,
  FilteredStats,
  DEFAULT_FILTERS,
  hasActiveFilters,
  countActiveFilters,
  getActiveFilterChips,
  ActiveFilter,
  RangeFilter,
  LocationFilterType,
} from '../types/filters';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

// Zustand store for filter state (persisted to localStorage)
interface FilterState {
  filters: TreeFilters;
  setFilters: (filters: TreeFilters) => void;
  updateFilter: <K extends keyof TreeFilters>(key: K, value: TreeFilters[K]) => void;
  resetFilters: () => void;
  removeFilter: (chip: ActiveFilter) => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set, get) => ({
      filters: DEFAULT_FILTERS,
      
      setFilters: (filters: TreeFilters) => set({ filters }),
      
      updateFilter: <K extends keyof TreeFilters>(key: K, value: TreeFilters[K]) => {
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        }));
      },
      
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      
      removeFilter: (chip: ActiveFilter) => {
        const { filters } = get();
        const newFilters = { ...filters };
        
        switch (chip.type) {
          case 'locationType':
            newFilters.locationType = 'all';
            break;
          case 'species':
            newFilters.species = filters.species.filter((s) => s !== chip.value);
            break;
          case 'height':
            newFilters.height = { min: null, max: null };
            break;
          case 'canopyDiameter':
            newFilters.canopyDiameter = { min: null, max: null };
            break;
          case 'girth':
            newFilters.girth = { min: null, max: null };
            break;
          case 'co2Sequestered':
            newFilters.co2Sequestered = { min: null, max: null };
            break;
          case 'wards':
            newFilters.wards = filters.wards.filter((w) => w !== chip.value);
            break;
          case 'flowering':
            newFilters.flowering = null;
            break;
          case 'economicImportance':
            newFilters.economicImportance = null;
            break;
        }
        
        set({ filters: newFilters });
      },
    }),
    {
      name: 'pune-tree-filters',
    }
  )
);

// Context for filter-related data and actions
interface FilterContextType {
  // Current filters
  filters: TreeFilters;
  
  // Filter actions
  setFilters: (filters: TreeFilters) => void;
  updateFilter: <K extends keyof TreeFilters>(key: K, value: TreeFilters[K]) => void;
  resetFilters: () => void;
  removeFilter: (chip: ActiveFilter) => void;
  
  // Derived state
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  activeFilterChips: ActiveFilter[];
  
  // Filter metadata (for dropdowns, ranges, etc.)
  filterMetadata: FilterMetadata | null;
  isLoadingMetadata: boolean;
  metadataRetryCount: number;
  isRetrying: boolean;
  
  // Filtered stats
  filteredStats: FilteredStats | null;
  isLoadingStats: boolean;
  
  // Refresh functions
  refreshFilteredStats: () => Promise<void>;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

// Provider component
export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { filters, setFilters, updateFilter, resetFilters, removeFilter } = useFilterStore();
  
  const [filterMetadata, setFilterMetadata] = useState<FilterMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [metadataRetryCount, setMetadataRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const [filteredStats, setFilteredStats] = useState<FilteredStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  // Fetch filter metadata on mount with retry logic
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    
    const fetchMetadata = async () => {
      setIsLoadingMetadata(true);
      setIsRetrying(retryCount > 0);
      setMetadataRetryCount(retryCount);
      
      try {
        const response = await axios.get(`${API_BASE_URL}/api/filter-metadata`, {
          timeout: 15000, // 15 second timeout
        });
        if (response.data && response.data.species) {
          setFilterMetadata(response.data);
          setIsRetrying(false);
          console.log('[FilterStore] Metadata loaded successfully:', {
            speciesCount: response.data.species?.length || 0,
            wardsCount: response.data.wards?.length || 0,
          });
        } else {
          throw new Error('Invalid metadata response');
        }
      } catch (error) {
        console.error(`[FilterStore] Error fetching metadata (attempt ${retryCount + 1}/${maxRetries}):`, error);
        
        // Retry if we haven't exceeded max retries
        if (retryCount < maxRetries - 1) {
          retryCount++;
          setMetadataRetryCount(retryCount);
          setIsRetrying(true);
          console.log(`[FilterStore] Retrying in ${retryCount * 2} seconds...`);
          setTimeout(fetchMetadata, retryCount * 2000);
          return;
        }
        
        // Set default metadata on final failure
        console.error('[FilterStore] All retries failed, using defaults');
        setIsRetrying(false);
        setFilterMetadata({
          species: [],
          wards: [],
          heightRange: { min: 0, max: 30 },
          canopyRange: { min: 0, max: 20 },
          girthRange: { min: 0, max: 500 },
          co2Range: { min: 0, max: 10000 },
          economicImportanceOptions: [],
        });
      } finally {
        setIsLoadingMetadata(false);
      }
    };
    
    fetchMetadata();
  }, []);
  
  // Fetch filtered stats when filters change
  const refreshFilteredStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/filtered-stats`, { filters }, {
        timeout: 15000, // 15 second timeout
      });
      setFilteredStats({
        totalTrees: parseInt(response.data.total_trees, 10),
        totalCO2Kg: parseFloat(response.data.total_co2_kg),
        isFiltered: hasActiveFilters(filters),
        appliedFiltersCount: countActiveFilters(filters),
      });
    } catch (error) {
      console.error('Error fetching filtered stats:', error);
      setFilteredStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [filters]);
  
  // Auto-refresh stats when filters change
  useEffect(() => {
    refreshFilteredStats();
  }, [filters, refreshFilteredStats]);
  
  const contextValue: FilterContextType = {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    removeFilter,
    hasActiveFilters: hasActiveFilters(filters),
    activeFiltersCount: countActiveFilters(filters),
    activeFilterChips: getActiveFilterChips(filters),
    filterMetadata,
    isLoadingMetadata,
    metadataRetryCount,
    isRetrying,
    filteredStats,
    isLoadingStats,
    refreshFilteredStats,
  };
  
  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
};

// Custom hook to use filter context
export const useFilters = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

// Convenience hooks for specific filter operations
export const useLocationFilter = () => {
  const { filters, updateFilter } = useFilters();
  
  const setLocationType = useCallback(
    (type: LocationFilterType) => updateFilter('locationType', type),
    [updateFilter]
  );
  
  return {
    locationType: filters.locationType,
    setLocationType,
  };
};

export const useSpeciesFilter = () => {
  const { filters, updateFilter } = useFilters();
  
  const addSpecies = useCallback(
    (species: string) => {
      if (!filters.species.includes(species)) {
        updateFilter('species', [...filters.species, species]);
      }
    },
    [filters.species, updateFilter]
  );
  
  const removeSpecies = useCallback(
    (species: string) => {
      updateFilter('species', filters.species.filter((s) => s !== species));
    },
    [filters.species, updateFilter]
  );
  
  const setSpecies = useCallback(
    (species: string[]) => updateFilter('species', species),
    [updateFilter]
  );
  
  return {
    selectedSpecies: filters.species,
    addSpecies,
    removeSpecies,
    setSpecies,
  };
};

export const useRangeFilter = (filterKey: 'height' | 'canopyDiameter' | 'girth' | 'co2Sequestered') => {
  const { filters, updateFilter } = useFilters();
  
  const setRange = useCallback(
    (range: RangeFilter) => updateFilter(filterKey, range),
    [filterKey, updateFilter]
  );
  
  const clearRange = useCallback(
    () => updateFilter(filterKey, { min: null, max: null }),
    [filterKey, updateFilter]
  );
  
  return {
    range: filters[filterKey] as RangeFilter,
    setRange,
    clearRange,
  };
};

export const useWardFilter = () => {
  const { filters, updateFilter } = useFilters();
  
  const addWard = useCallback(
    (ward: string) => {
      if (!filters.wards.includes(ward)) {
        updateFilter('wards', [...filters.wards, ward]);
      }
    },
    [filters.wards, updateFilter]
  );
  
  const removeWard = useCallback(
    (ward: string) => {
      updateFilter('wards', filters.wards.filter((w) => w !== ward));
    },
    [filters.wards, updateFilter]
  );
  
  const setWards = useCallback(
    (wards: string[]) => updateFilter('wards', wards),
    [updateFilter]
  );
  
  return {
    selectedWards: filters.wards,
    addWard,
    removeWard,
    setWards,
  };
};
