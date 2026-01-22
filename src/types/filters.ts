// src/types/filters.ts
// Type definitions for the tree filtering system

export type LocationFilterType = 'all' | 'street' | 'non-street';

export interface RangeFilter {
  min: number | null;
  max: number | null;
}

export interface TreeFilters {
  // Location type filter (street trees vs non-street)
  locationType: LocationFilterType;
  
  // Species filter (multi-select by common name)
  species: string[];
  
  // Height range in meters
  height: RangeFilter;
  
  // Canopy diameter range in meters
  canopyDiameter: RangeFilter;
  
  // Girth range in centimeters
  girth: RangeFilter;
  
  // CO2 sequestered range in kg
  co2Sequestered: RangeFilter;
  
  // Ward filter (multi-select)
  wards: string[];
  
  // Flowering status filter
  flowering: boolean | null;
  
  // Economic importance filter
  economicImportance: string | null;
}

export const DEFAULT_FILTERS: TreeFilters = {
  locationType: 'all',
  species: [],
  height: { min: null, max: null },
  canopyDiameter: { min: null, max: null },
  girth: { min: null, max: null },
  co2Sequestered: { min: null, max: null },
  wards: [],
  flowering: null,
  economicImportance: null,
};

// Active filter representation for chips
export interface ActiveFilter {
  id: string;
  type: keyof TreeFilters;
  label: string;
  value: any;
}

// Filter metadata for UI rendering
export interface FilterMetadata {
  species: string[];
  wards: string[];
  heightRange: { min: number; max: number };
  canopyRange: { min: number; max: number };
  girthRange: { min: number; max: number };
  co2Range: { min: number; max: number };
  economicImportanceOptions: string[];
  locationCounts?: {
    street: number;
    nonStreet: number;
    total: number;
  };
}

// Filtered stats response from API
export interface FilteredStats {
  totalTrees: number;
  totalCO2Kg: number;
  isFiltered: boolean;
  appliedFiltersCount: number;
}

// Helper function to check if any filters are active
export function hasActiveFilters(filters: TreeFilters): boolean {
  return (
    filters.locationType !== 'all' ||
    filters.species.length > 0 ||
    filters.height.min !== null ||
    filters.height.max !== null ||
    filters.canopyDiameter.min !== null ||
    filters.canopyDiameter.max !== null ||
    filters.girth.min !== null ||
    filters.girth.max !== null ||
    filters.co2Sequestered.min !== null ||
    filters.co2Sequestered.max !== null ||
    filters.wards.length > 0 ||
    filters.flowering !== null ||
    filters.economicImportance !== null
  );
}

// Helper function to count active filters
export function countActiveFilters(filters: TreeFilters): number {
  let count = 0;
  
  if (filters.locationType !== 'all') count++;
  count += filters.species.length;
  if (filters.height.min !== null || filters.height.max !== null) count++;
  if (filters.canopyDiameter.min !== null || filters.canopyDiameter.max !== null) count++;
  if (filters.girth.min !== null || filters.girth.max !== null) count++;
  if (filters.co2Sequestered.min !== null || filters.co2Sequestered.max !== null) count++;
  count += filters.wards.length;
  if (filters.flowering !== null) count++;
  if (filters.economicImportance !== null) count++;
  
  return count;
}

// Helper function to get active filters as chip data
export function getActiveFilterChips(filters: TreeFilters): ActiveFilter[] {
  const chips: ActiveFilter[] = [];
  
  if (filters.locationType !== 'all') {
    chips.push({
      id: 'locationType',
      type: 'locationType',
      label: filters.locationType === 'street' ? 'Street Trees' : 'Non-Street Trees',
      value: filters.locationType,
    });
  }
  
  filters.species.forEach((species, index) => {
    chips.push({
      id: `species-${index}`,
      type: 'species',
      label: species,
      value: species,
    });
  });
  
  if (filters.height.min !== null || filters.height.max !== null) {
    const min = filters.height.min ?? 0;
    const max = filters.height.max ?? '∞';
    chips.push({
      id: 'height',
      type: 'height',
      label: `Height: ${min}-${max}m`,
      value: filters.height,
    });
  }
  
  if (filters.canopyDiameter.min !== null || filters.canopyDiameter.max !== null) {
    const min = filters.canopyDiameter.min ?? 0;
    const max = filters.canopyDiameter.max ?? '∞';
    chips.push({
      id: 'canopyDiameter',
      type: 'canopyDiameter',
      label: `Canopy: ${min}-${max}m`,
      value: filters.canopyDiameter,
    });
  }
  
  if (filters.girth.min !== null || filters.girth.max !== null) {
    const min = filters.girth.min ?? 0;
    const max = filters.girth.max ?? '∞';
    chips.push({
      id: 'girth',
      type: 'girth',
      label: `Girth: ${min}-${max}cm`,
      value: filters.girth,
    });
  }
  
  if (filters.co2Sequestered.min !== null || filters.co2Sequestered.max !== null) {
    const min = filters.co2Sequestered.min ?? 0;
    const max = filters.co2Sequestered.max ?? '∞';
    chips.push({
      id: 'co2Sequestered',
      type: 'co2Sequestered',
      label: `CO₂: ${min}-${max}kg`,
      value: filters.co2Sequestered,
    });
  }
  
  filters.wards.forEach((ward, index) => {
    chips.push({
      id: `ward-${index}`,
      type: 'wards',
      label: `Ward: ${ward}`,
      value: ward,
    });
  });
  
  if (filters.flowering !== null) {
    chips.push({
      id: 'flowering',
      type: 'flowering',
      label: filters.flowering ? 'Flowering' : 'Non-Flowering',
      value: filters.flowering,
    });
  }
  
  if (filters.economicImportance !== null) {
    chips.push({
      id: 'economicImportance',
      type: 'economicImportance',
      label: `Economic: ${filters.economicImportance}`,
      value: filters.economicImportance,
    });
  }
  
  return chips;
}
