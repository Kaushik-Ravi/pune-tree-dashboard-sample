/**
 * useRenderingManager - React Hook for ShadowRenderingManager
 * 
 * Provides access to the rendering manager with proper lifecycle management.
 * Handles initialization, cleanup, and event subscriptions.
 * 
 * Benefits:
 * - Clean React integration
 * - Automatic cleanup on unmount
 * - Type-safe event subscriptions
 * - Error handling
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import {
  ShadowRenderingManager,
  type RenderConfig,
  type SunConfig,
  type RenderingEventType,
  type RenderingEventPayloads,
} from '../rendering/index';

/**
 * Hook configuration
 */
export interface UseRenderingManagerConfig {
  /** MapLibre map instance */
  map: MaplibreMap | null;
  
  /** Initial render configuration */
  config?: Partial<RenderConfig>;
  
  /** Whether to auto-initialize on mount */
  autoInitialize?: boolean;
  
  /** Whether manager is enabled */
  enabled?: boolean;
}

/**
 * Hook return value
 */
export interface UseRenderingManagerReturn {
  /** Rendering manager instance (null if not initialized) */
  manager: ShadowRenderingManager | null;
  
  /** Whether manager is initialized */
  isInitialized: boolean;
  
  /** Whether manager is currently initializing */
  isInitializing: boolean;
  
  /** Initialization error (if any) */
  error: Error | null;
  
  /** Manually initialize the manager */
  initialize: () => Promise<void>;
  
  /** Update render configuration */
  updateConfig: (config: Partial<RenderConfig>) => void;
  
  /** Update sun position */
  updateSun: (config: SunConfig) => void;
  
  /** Subscribe to rendering events */
  subscribe: <T extends RenderingEventType>(
    event: T,
    listener: (payload: RenderingEventPayloads[T]) => void
  ) => () => void;
  
  /** Dispose the manager */
  dispose: () => void;
}

/**
 * React hook for ShadowRenderingManager
 */
export function useRenderingManager(
  config: UseRenderingManagerConfig
): UseRenderingManagerReturn {
  const { map, config: initialConfig, autoInitialize = true, enabled = true } = config;
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const managerRef = useRef<ShadowRenderingManager | null>(null);
  const isDisposedRef = useRef(false);

  /**
   * Initialize the rendering manager
   */
  const initialize = useCallback(async () => {
    if (!map || !enabled) {
      console.log('[useRenderingManager] Skipping initialization: map or enabled missing');
      return;
    }

    if (isInitializing || isInitialized) {
      console.log('[useRenderingManager] Already initialized or initializing');
      return;
    }

    if (isDisposedRef.current) {
      console.warn('[useRenderingManager] Cannot initialize: hook is disposed');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Get manager instance
      const manager = ShadowRenderingManager.getInstance();
      managerRef.current = manager;

      // Initialize with map
      // Note: Assuming manager has an async initialize method
      // If initialize is sync, remove await
      await manager.initialize(map, map.painter.context.gl);

      // Apply initial config if provided
      if (initialConfig) {
        manager.updateConfig(initialConfig);
      }

      setIsInitialized(true);
      console.log('[useRenderingManager] Initialized successfully');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useRenderingManager] Initialization failed:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [map, enabled, initialConfig, isInitializing, isInitialized]);

  /**
   * Update render configuration
   */
  const updateConfig = useCallback((newConfig: Partial<RenderConfig>) => {
    if (!managerRef.current || !isInitialized) {
      console.warn('[useRenderingManager] Cannot update config: not initialized');
      return;
    }

    try {
      managerRef.current.updateConfig(newConfig);
    } catch (err) {
      console.error('[useRenderingManager] Failed to update config:', err);
    }
  }, [isInitialized]);

  /**
   * Update sun position
   */
  const updateSun = useCallback((sunConfig: SunConfig) => {
    if (!managerRef.current || !isInitialized) {
      console.warn('[useRenderingManager] Cannot update sun: not initialized');
      return;
    }

    try {
      managerRef.current.updateSun(sunConfig);
    } catch (err) {
      console.error('[useRenderingManager] Failed to update sun:', err);
    }
  }, [isInitialized]);

  /**
   * Subscribe to rendering events
   */
  const subscribe = useCallback(<T extends RenderingEventType>(
    event: T,
    listener: (payload: RenderingEventPayloads[T]) => void
  ): (() => void) => {
    if (!managerRef.current) {
      console.warn('[useRenderingManager] Cannot subscribe: not initialized');
      return () => {};
    }

    const manager = managerRef.current;
    manager.onTyped(event, listener);

    // Return unsubscribe function
    return () => {
      if (manager) {
        manager.offTyped(event, listener);
      }
    };
  }, []);

  /**
   * Dispose the manager
   */
  const dispose = useCallback(() => {
    if (managerRef.current && isInitialized) {
      try {
        managerRef.current.dispose();
        managerRef.current = null;
        setIsInitialized(false);
        isDisposedRef.current = true;
        console.log('[useRenderingManager] Disposed successfully');
      } catch (err) {
        console.error('[useRenderingManager] Failed to dispose:', err);
      }
    }
  }, [isInitialized]);

  /**
   * Auto-initialize when map is ready
   */
  useEffect(() => {
    if (autoInitialize && map && enabled && !isInitialized && !isInitializing) {
      initialize();
    }
  }, [autoInitialize, map, enabled, isInitialized, isInitializing, initialize]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    manager: managerRef.current,
    isInitialized,
    isInitializing,
    error,
    initialize,
    updateConfig,
    updateSun,
    subscribe,
    dispose,
  };
}
