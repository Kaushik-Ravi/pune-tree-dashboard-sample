// src/store/LayerLoadingStore.ts
/**
 * LAYER LOADING STORE
 * ====================
 * 
 * Centralized state management for map layer loading states.
 * Used to show loading indicators on UI controls when layers are loading.
 * 
 * Features:
 * - Track loading state for each layer type
 * - Automatically clear loading state on timeout (safety net)
 * - Provides loading status for UI components
 */

import { create } from 'zustand';

// Layer types that can have loading states
export type LayerType = 
  | 'raster_tree_probability_2025'
  | 'raster_tree_probability_2019'
  | 'raster_tree_change'
  | 'raster_tree_loss_gain'
  | 'raster_ndvi'
  | 'raster_landcover'
  | 'ward_overlay'
  | 'deforestation_hotspots'
  | 'lst_overlay';

interface LayerLoadingState {
  // Map of layer type to loading status
  loadingLayers: Set<LayerType>;
  
  // Actions
  setLoading: (layer: LayerType, isLoading: boolean) => void;
  isLoading: (layer: LayerType) => boolean;
  isAnyRasterLoading: () => boolean;
  clearAll: () => void;
}

// Safety timeout - auto-clear loading state after 30s (in case of errors)
const LOADING_TIMEOUT_MS = 30000;
const layerTimeouts = new Map<LayerType, NodeJS.Timeout>();

export const useLayerLoadingStore = create<LayerLoadingState>((set, get) => ({
  loadingLayers: new Set(),
  
  setLoading: (layer: LayerType, isLoading: boolean) => {
    // Clear any existing timeout for this layer
    const existingTimeout = layerTimeouts.get(layer);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      layerTimeouts.delete(layer);
    }
    
    if (isLoading) {
      // Set a safety timeout to auto-clear loading state
      const timeout = setTimeout(() => {
        console.warn(`[LayerLoadingStore] Auto-clearing stuck loading state for ${layer}`);
        set(state => {
          const newSet = new Set(state.loadingLayers);
          newSet.delete(layer);
          return { loadingLayers: newSet };
        });
        layerTimeouts.delete(layer);
      }, LOADING_TIMEOUT_MS);
      layerTimeouts.set(layer, timeout);
      
      set(state => {
        const newSet = new Set(state.loadingLayers);
        newSet.add(layer);
        return { loadingLayers: newSet };
      });
    } else {
      set(state => {
        const newSet = new Set(state.loadingLayers);
        newSet.delete(layer);
        return { loadingLayers: newSet };
      });
    }
  },
  
  isLoading: (layer: LayerType) => {
    return get().loadingLayers.has(layer);
  },
  
  isAnyRasterLoading: () => {
    const layers = get().loadingLayers;
    return Array.from(layers).some(l => l.startsWith('raster_'));
  },
  
  clearAll: () => {
    // Clear all timeouts
    layerTimeouts.forEach(timeout => clearTimeout(timeout));
    layerTimeouts.clear();
    
    set({ loadingLayers: new Set() });
  },
}));

// Helper to convert raster layer type to store layer type
export function rasterLayerToStoreType(rasterLayer: string): LayerType {
  return `raster_${rasterLayer}` as LayerType;
}
