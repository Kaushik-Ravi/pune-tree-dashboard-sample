// src/rendering/managers/PerformanceMonitor.ts

/**
 * Performance monitoring and metrics collection
 * Tracks FPS, frame times, memory usage, and rendering statistics
 * 
 * Features:
 * - Rolling average for smooth FPS display
 * - Memory tracking (when available)
 * - Draw call counting
 * - Performance warnings/alerts
 */

import type { PerformanceMetrics } from '../types/RenderConfig';
import * as THREE from 'three';

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private frameStartTime = 0;
  private lastUpdateTime = 0;
  
  // Configuration
  private readonly maxSamples = 60; // 1 second at 60 FPS
  private readonly updateInterval = 1000; // Update metrics every 1 second
  
  // Metrics
  private currentMetrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    objectCount: 0
  };
  
  // Performance thresholds
  private readonly fpsWarningThreshold = 30;
  private readonly fpsErrorThreshold = 15;
  
  // Callbacks
  private onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
  private onPerformanceWarning?: (message: string) => void;
  
  /**
   * Initialize performance monitor
   */
  constructor(options?: {
    onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
    onPerformanceWarning?: (message: string) => void;
  }) {
    this.onMetricsUpdate = options?.onMetricsUpdate;
    this.onPerformanceWarning = options?.onPerformanceWarning;
    this.lastUpdateTime = performance.now();
  }
  
  /**
   * Mark the start of a frame
   * Call at the beginning of render()
   */
  startFrame(): void {
    this.frameStartTime = performance.now();
  }
  
  /**
   * Mark the end of a frame and collect metrics
   * Call at the end of render()
   */
  endFrame(renderer?: THREE.WebGLRenderer, scene?: THREE.Scene): void {
    const frameEndTime = performance.now();
    const frameDuration = frameEndTime - this.frameStartTime;
    
    // Add to rolling window
    this.frameTimes.push(frameDuration);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
    
    // Update metrics periodically
    const timeSinceUpdate = frameEndTime - this.lastUpdateTime;
    if (timeSinceUpdate >= this.updateInterval) {
      this.updateMetrics(renderer, scene);
      this.lastUpdateTime = frameEndTime;
    }
  }
  
  /**
   * Calculate and update current metrics
   */
  private updateMetrics(renderer?: THREE.WebGLRenderer, scene?: THREE.Scene): void {
    // Calculate average frame time
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    
    // Calculate FPS
    const fps = 1000 / avgFrameTime;
    
    // Get renderer info if available
    let drawCalls = 0;
    let triangles = 0;
    if (renderer) {
      const info = renderer.info;
      drawCalls = info.render.calls;
      triangles = info.render.triangles;
    }
    
    // Count scene objects
    let objectCount = 0;
    if (scene) {
      scene.traverse(() => {
        objectCount++;
      });
    }
    
    // Get memory info if available
    const memory = (performance as any).memory;
    const jsMemory = memory?.usedJSHeapSize;
    
    // Update current metrics
    this.currentMetrics = {
      fps: Math.round(fps * 10) / 10, // Round to 1 decimal
      frameTime: Math.round(avgFrameTime * 100) / 100, // Round to 2 decimals
      drawCalls,
      triangles,
      objectCount,
      jsMemory
    };
    
    // Check for performance issues
    this.checkPerformance();
    
    // Notify listeners
    if (this.onMetricsUpdate) {
      this.onMetricsUpdate(this.currentMetrics);
    }
  }
  
  /**
   * Check for performance issues and emit warnings
   */
  private checkPerformance(): void {
    if (!this.onPerformanceWarning) return;
    
    const { fps, frameTime } = this.currentMetrics;
    
    // Check FPS thresholds
    if (fps < this.fpsErrorThreshold) {
      this.onPerformanceWarning(
        `Critical: FPS dropped to ${fps.toFixed(1)} (target: 60). Consider reducing quality settings.`
      );
    } else if (fps < this.fpsWarningThreshold) {
      this.onPerformanceWarning(
        `Warning: FPS at ${fps.toFixed(1)} (target: 60). Performance may be degraded.`
      );
    }
    
    // Check frame time
    if (frameTime > 50) { // More than 50ms = less than 20 FPS
      this.onPerformanceWarning(
        `Warning: Frame time ${frameTime.toFixed(2)}ms is high. Reduce scene complexity.`
      );
    }
  }
  
  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }
  
  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.currentMetrics.fps;
  }
  
  /**
   * Get average frame time in milliseconds
   */
  getFrameTime(): number {
    return this.currentMetrics.frameTime;
  }
  
  /**
   * Check if performance is acceptable
   */
  isPerformanceGood(): boolean {
    return this.currentMetrics.fps >= this.fpsWarningThreshold;
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.frameTimes = [];
    this.currentMetrics = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      objectCount: 0
    };
  }
  
  /**
   * Get memory usage summary
   */
  getMemoryUsage(): { js?: number; gpu?: number } {
    const memory = (performance as any).memory;
    return {
      js: memory?.usedJSHeapSize,
      gpu: this.currentMetrics.gpuMemory
    };
  }
  
  /**
   * Log current metrics to console
   */
  logMetrics(): void {
    console.group('🔍 Performance Metrics');
    console.log(`FPS: ${this.currentMetrics.fps.toFixed(1)}`);
    console.log(`Frame Time: ${this.currentMetrics.frameTime.toFixed(2)}ms`);
    console.log(`Draw Calls: ${this.currentMetrics.drawCalls}`);
    console.log(`Triangles: ${this.currentMetrics.triangles.toLocaleString()}`);
    console.log(`Objects: ${this.currentMetrics.objectCount}`);
    
    const memory = this.getMemoryUsage();
    if (memory.js) {
      console.log(`JS Memory: ${(memory.js / 1024 / 1024).toFixed(2)} MB`);
    }
    
    console.groupEnd();
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.frameTimes = [];
    this.onMetricsUpdate = undefined;
    this.onPerformanceWarning = undefined;
  }
}
