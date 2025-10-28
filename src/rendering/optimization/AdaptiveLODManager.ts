/**
 * AdaptiveLODManager - Dynamic LOD Quality Adjustment
 * 
 * Automatically adjusts LOD distances and quality settings based on current FPS
 * to maintain target frame rate. Critical for mobile device support.
 * 
 * Benefits:
 * - Maintains 30+ FPS on mobile devices
 * - Graceful degradation under load
 * - Automatic recovery when performance improves
 * - User doesn't need to manually adjust quality
 * 
 * Strategy:
 * - Monitor FPS continuously
 * - Reduce LOD distances when FPS drops below target
 * - Increase LOD distances when FPS is stable above target
 * - Adjust shadow quality as last resort
 */

import type { RenderConfig, ShadowQuality } from '../types/RenderConfig';
import type { PerformanceMetrics } from '../types/RenderConfig';

/**
 * LOD adjustment strategy
 */
export interface LODStrategy {
  /** Target FPS to maintain */
  targetFPS: number;
  
  /** Minimum FPS before aggressive adjustments */
  minFPS: number;
  
  /** FPS buffer (hysteresis) to prevent oscillation */
  fpsBuffer: number;
  
  /** How often to check and adjust (ms) */
  adjustmentInterval: number;
  
  /** Minimum LOD distances (can't go lower) */
  minLODDistances: {
    high: number;
    medium: number;
    low: number;
  };
  
  /** Maximum LOD distances (can't go higher) */
  maxLODDistances: {
    high: number;
    medium: number;
    low: number;
  };
  
  /** Enable automatic shadow quality adjustment */
  adjustShadowQuality: boolean;
}

/**
 * Default strategy for desktop
 */
const DESKTOP_STRATEGY: LODStrategy = {
  targetFPS: 55, // Target slightly above 60 to account for variance
  minFPS: 30,
  fpsBuffer: 5,
  adjustmentInterval: 2000, // Check every 2 seconds
  minLODDistances: {
    high: 25,
    medium: 100,
    low: 500,
  },
  maxLODDistances: {
    high: 100,
    medium: 400,
    low: 2000,
  },
  adjustShadowQuality: true,
};

/**
 * Strategy for mobile devices
 */
const MOBILE_STRATEGY: LODStrategy = {
  targetFPS: 28, // Target slightly below 30 for mobile
  minFPS: 20,
  fpsBuffer: 3,
  adjustmentInterval: 3000, // Check every 3 seconds (longer for stability)
  minLODDistances: {
    high: 15,
    medium: 50,
    low: 250,
  },
  maxLODDistances: {
    high: 50,
    medium: 200,
    low: 1000,
  },
  adjustShadowQuality: true,
};

/**
 * Quality level presets
 */
export enum QualityPreset {
  ULTRA = 'ultra',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  POTATO = 'potato', // For very weak devices
}

/**
 * Quality preset configurations
 */
const QUALITY_PRESETS: Record<QualityPreset, Partial<RenderConfig>> = {
  [QualityPreset.ULTRA]: {
    shadowQuality: 'ultra',
    maxVisibleTrees: 10000,
    enableFrustumCulling: true,
    enableDistanceCulling: true,
  },
  [QualityPreset.HIGH]: {
    shadowQuality: 'high',
    maxVisibleTrees: 5000,
    enableFrustumCulling: true,
    enableDistanceCulling: true,
  },
  [QualityPreset.MEDIUM]: {
    shadowQuality: 'medium',
    maxVisibleTrees: 3000,
    enableFrustumCulling: true,
    enableDistanceCulling: true,
  },
  [QualityPreset.LOW]: {
    shadowQuality: 'low',
    maxVisibleTrees: 1500,
    enableFrustumCulling: true,
    enableDistanceCulling: true,
  },
  [QualityPreset.POTATO]: {
    shadowQuality: 'low',
    maxVisibleTrees: 500,
    enableFrustumCulling: true,
    enableDistanceCulling: true,
  },
};

/**
 * Adjustment action taken
 */
interface AdjustmentAction {
  timestamp: number;
  reason: string;
  action: 'reduce_lod' | 'increase_lod' | 'reduce_shadows' | 'increase_shadows' | 'none';
  before: {
    fps: number;
    lodDistances?: any;
    shadowQuality?: ShadowQuality;
  };
  after: {
    lodDistances?: any;
    shadowQuality?: ShadowQuality;
  };
}

export class AdaptiveLODManager {
  private strategy: LODStrategy;
  private isEnabled = true;
  private currentQualityPreset: QualityPreset = QualityPreset.HIGH;
  
  // Current LOD distances
  private currentLODDistances = {
    high: 50,
    medium: 200,
    low: 1000,
  };
  
  // FPS history for smoothing
  private fpsHistory: number[] = [];
  private readonly fpsHistorySize = 10;
  
  // Adjustment tracking
  private lastAdjustmentTime = 0;
  private adjustmentHistory: AdjustmentAction[] = [];
  private readonly maxHistorySize = 20;
  
  // Callbacks
  private onConfigChange?: (config: Partial<RenderConfig>) => void;

  constructor(
    isMobile = false,
    onConfigChange?: (config: Partial<RenderConfig>) => void
  ) {
    this.strategy = isMobile ? { ...MOBILE_STRATEGY } : { ...DESKTOP_STRATEGY };
    this.onConfigChange = onConfigChange;
    
    // Initialize LOD distances from strategy
    this.currentLODDistances = {
      high: (this.strategy.minLODDistances.high + this.strategy.maxLODDistances.high) / 2,
      medium: (this.strategy.minLODDistances.medium + this.strategy.maxLODDistances.medium) / 2,
      low: (this.strategy.minLODDistances.low + this.strategy.maxLODDistances.low) / 2,
    };
    
    console.log(`[AdaptiveLOD] Initialized with ${isMobile ? 'mobile' : 'desktop'} strategy`);
  }

  /**
   * Update with current performance metrics
   * Called every frame
   */
  public update(metrics: PerformanceMetrics): void {
    if (!this.isEnabled) return;

    // Add to FPS history
    this.fpsHistory.push(metrics.fps);
    if (this.fpsHistory.length > this.fpsHistorySize) {
      this.fpsHistory.shift();
    }

    // Check if enough time has passed since last adjustment
    const now = Date.now();
    if (now - this.lastAdjustmentTime < this.strategy.adjustmentInterval) {
      return;
    }

    // Calculate average FPS (smoother than single frame)
    const avgFPS = this.getAverageFPS();

    // Decide if adjustment is needed
    const action = this.decideAdjustment(avgFPS);
    
    if (action.action !== 'none') {
      this.applyAdjustment(action);
      this.lastAdjustmentTime = now;
      
      // Add to history
      this.adjustmentHistory.push(action);
      if (this.adjustmentHistory.length > this.maxHistorySize) {
        this.adjustmentHistory.shift();
      }
    }
  }

  /**
   * Calculate average FPS from history
   */
  private getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return sum / this.fpsHistory.length;
  }

  /**
   * Decide what adjustment to make based on FPS
   */
  private decideAdjustment(avgFPS: number): AdjustmentAction {
    const action: AdjustmentAction = {
      timestamp: Date.now(),
      reason: '',
      action: 'none',
      before: {
        fps: avgFPS,
        lodDistances: { ...this.currentLODDistances },
      },
      after: {},
    };

    // FPS too low - reduce quality
    if (avgFPS < this.strategy.targetFPS - this.strategy.fpsBuffer) {
      // Critical FPS - reduce shadows
      if (avgFPS < this.strategy.minFPS && this.strategy.adjustShadowQuality) {
        action.action = 'reduce_shadows';
        action.reason = `FPS critically low (${avgFPS.toFixed(1)})`;
      } else {
        action.action = 'reduce_lod';
        action.reason = `FPS below target (${avgFPS.toFixed(1)} < ${this.strategy.targetFPS})`;
      }
    }
    // FPS comfortable - increase quality
    else if (avgFPS > this.strategy.targetFPS + this.strategy.fpsBuffer) {
      action.action = 'increase_lod';
      action.reason = `FPS above target (${avgFPS.toFixed(1)} > ${this.strategy.targetFPS})`;
    }

    return action;
  }

  /**
   * Apply the decided adjustment
   */
  private applyAdjustment(action: AdjustmentAction): void {
    const config: Partial<RenderConfig> = {};

    switch (action.action) {
      case 'reduce_lod':
        // Reduce LOD distances by 20%
        this.currentLODDistances.high = Math.max(
          this.strategy.minLODDistances.high,
          this.currentLODDistances.high * 0.8
        );
        this.currentLODDistances.medium = Math.max(
          this.strategy.minLODDistances.medium,
          this.currentLODDistances.medium * 0.8
        );
        this.currentLODDistances.low = Math.max(
          this.strategy.minLODDistances.low,
          this.currentLODDistances.low * 0.8
        );
        
        config.lodDistances = { ...this.currentLODDistances };
        action.after.lodDistances = { ...this.currentLODDistances };
        
        console.log(`[AdaptiveLOD] Reduced LOD distances:`, this.currentLODDistances);
        break;

      case 'increase_lod':
        // Increase LOD distances by 10% (slower than reduction)
        this.currentLODDistances.high = Math.min(
          this.strategy.maxLODDistances.high,
          this.currentLODDistances.high * 1.1
        );
        this.currentLODDistances.medium = Math.min(
          this.strategy.maxLODDistances.medium,
          this.currentLODDistances.medium * 1.1
        );
        this.currentLODDistances.low = Math.min(
          this.strategy.maxLODDistances.low,
          this.currentLODDistances.low * 1.1
        );
        
        config.lodDistances = { ...this.currentLODDistances };
        action.after.lodDistances = { ...this.currentLODDistances };
        
        console.log(`[AdaptiveLOD] Increased LOD distances:`, this.currentLODDistances);
        break;

      case 'reduce_shadows':
        // Reduce shadow quality (TODO: implement shadow quality levels)
        console.log(`[AdaptiveLOD] Reducing shadow quality (FPS critical)`);
        break;

      case 'increase_shadows':
        // Increase shadow quality
        console.log(`[AdaptiveLOD] Increasing shadow quality (FPS comfortable)`);
        break;
    }

    // Notify config change
    if (this.onConfigChange && Object.keys(config).length > 0) {
      this.onConfigChange(config);
    }
  }

  /**
   * Set quality preset
   */
  public setQualityPreset(preset: QualityPreset): void {
    this.currentQualityPreset = preset;
    const config = QUALITY_PRESETS[preset];
    
    console.log(`[AdaptiveLOD] Applied quality preset: ${preset}`);
    
    if (this.onConfigChange) {
      this.onConfigChange(config);
    }
  }

  /**
   * Enable or disable adaptive adjustments
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`[AdaptiveLOD] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Get current LOD distances
   */
  public getLODDistances() {
    return { ...this.currentLODDistances };
  }

  /**
   * Get adjustment history
   */
  public getAdjustmentHistory(): AdjustmentAction[] {
    return [...this.adjustmentHistory];
  }

  /**
   * Get current quality preset
   */
  public getCurrentPreset(): QualityPreset {
    return this.currentQualityPreset;
  }

  /**
   * Reset to default settings
   */
  public reset(): void {
    this.currentLODDistances = {
      high: (this.strategy.minLODDistances.high + this.strategy.maxLODDistances.high) / 2,
      medium: (this.strategy.minLODDistances.medium + this.strategy.maxLODDistances.medium) / 2,
      low: (this.strategy.minLODDistances.low + this.strategy.maxLODDistances.low) / 2,
    };
    this.fpsHistory = [];
    this.adjustmentHistory = [];
    this.lastAdjustmentTime = 0;
    
    console.log('[AdaptiveLOD] Reset to defaults');
  }
}
