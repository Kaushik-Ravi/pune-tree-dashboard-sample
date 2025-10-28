/**
 * RenderingBenchmark - Performance Benchmarking Suite
 * 
 * Comprehensive benchmarks for the shadow rendering system.
 * Tests performance under various conditions and validates
 * that the system meets world-class performance standards.
 * 
 * Target Performance:
 * - Desktop: 60 FPS with 5,000 trees
 * - Desktop: 30 FPS with 10,000 trees
 * - Mobile: 30 FPS with 1,000 trees
 * - Shadow Update: < 16ms per frame
 * - Memory: < 500MB for 10,000 trees
 */

import { ShadowRenderingManager } from '../rendering';
import type { PerformanceMetrics, RenderConfig } from '../rendering';
import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * Benchmark result for a single test
 */
export interface BenchmarkResult {
  name: string;
  passed: boolean;
  metrics: {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    averageFrameTime: number;
    drawCalls: number;
    triangles: number;
    objectCount: number;
    memoryUsed?: number;
  };
  duration: number; // milliseconds
  threshold: {
    minFPS: number;
    maxFrameTime: number;
  };
  details?: string;
}

/**
 * Complete benchmark suite results
 */
export interface BenchmarkSuiteResult {
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  results: BenchmarkResult[];
  summary: string;
  timestamp: number;
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  duration: number; // Test duration in milliseconds
  warmupDuration: number; // Warmup before measuring
  sampleInterval: number; // Metrics collection interval
}

/**
 * Default benchmark configuration
 */
const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  duration: 10000, // 10 seconds per test
  warmupDuration: 2000, // 2 second warmup
  sampleInterval: 100, // Sample every 100ms
};

/**
 * Performance benchmarking suite
 */
export class RenderingBenchmark {
  private manager: ShadowRenderingManager | null = null;
  private map: MaplibreMap | null = null;
  private config: BenchmarkConfig;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = { ...DEFAULT_BENCHMARK_CONFIG, ...config };
  }

  /**
   * Initialize benchmark with map
   */
  async initialize(map: MaplibreMap): Promise<void> {
    this.map = map;
    this.manager = ShadowRenderingManager.getInstance();
    
    // Check if already initialized
    if (!this.manager.isReady()) {
      // Get WebGL context from map
      const canvas = map.getCanvas();
      const gl = canvas.getContext('webgl2') as WebGLRenderingContext;
      if (!gl) {
        throw new Error('Failed to get WebGL context');
      }
      await this.manager.initialize(map, gl);
    }
  }

  /**
   * Run complete benchmark suite
   */
  async runSuite(): Promise<BenchmarkSuiteResult> {
    if (!this.manager || !this.map) {
      throw new Error('Benchmark not initialized. Call initialize() first.');
    }

    console.log('🚀 Starting Rendering Benchmark Suite...');
    const suiteStartTime = Date.now();
    const results: BenchmarkResult[] = [];

    // Test 1: Desktop - 1,000 trees (baseline)
    results.push(await this.runTest({
      name: 'Desktop: 1,000 Trees (Baseline)',
      config: { maxTrees: 1000, shadowQuality: 'high' },
      threshold: { minFPS: 60, maxFrameTime: 16.67 },
    }));

    // Test 2: Desktop - 5,000 trees (standard load)
    results.push(await this.runTest({
      name: 'Desktop: 5,000 Trees (Standard)',
      config: { maxTrees: 5000, shadowQuality: 'high' },
      threshold: { minFPS: 60, maxFrameTime: 16.67 },
    }));

    // Test 3: Desktop - 10,000 trees (stress test)
    results.push(await this.runTest({
      name: 'Desktop: 10,000 Trees (Stress)',
      config: { maxTrees: 10000, shadowQuality: 'high' },
      threshold: { minFPS: 30, maxFrameTime: 33.33 },
    }));

    // Test 4: Mobile - 1,000 trees
    results.push(await this.runTest({
      name: 'Mobile: 1,000 Trees',
      config: { maxTrees: 1000, shadowQuality: 'medium' },
      threshold: { minFPS: 30, maxFrameTime: 33.33 },
    }));

    // Test 5: Ultra Quality - 2,000 trees
    results.push(await this.runTest({
      name: 'Ultra Quality: 2,000 Trees',
      config: { maxTrees: 2000, shadowQuality: 'ultra' },
      threshold: { minFPS: 45, maxFrameTime: 22.22 },
    }));

    // Test 6: Low Quality - 5,000 trees
    results.push(await this.runTest({
      name: 'Low Quality: 5,000 Trees',
      config: { maxTrees: 5000, shadowQuality: 'low' },
      threshold: { minFPS: 60, maxFrameTime: 16.67 },
    }));

    // Test 7: Culling disabled - 2,000 trees
    results.push(await this.runTest({
      name: 'No Culling: 2,000 Trees',
      config: { maxTrees: 2000, shadowQuality: 'high', enableFrustumCulling: false },
      threshold: { minFPS: 45, maxFrameTime: 22.22 },
    }));

    const suiteDuration = Date.now() - suiteStartTime;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    const suite: BenchmarkSuiteResult = {
      totalTests: results.length,
      passed,
      failed,
      duration: suiteDuration,
      results,
      summary: this.generateSummary(results, passed, failed),
      timestamp: Date.now(),
    };

    this.printResults(suite);
    return suite;
  }

  /**
   * Run a single benchmark test
   */
  private async runTest(test: {
    name: string;
    config: Partial<RenderConfig>;
    threshold: { minFPS: number; maxFrameTime: number };
  }): Promise<BenchmarkResult> {
    console.log(`\n📊 Running: ${test.name}...`);

    // Apply configuration
    this.manager!.updateConfig(test.config);

    // Warmup period
    console.log('  ⏳ Warming up...');
    await this.wait(this.config.warmupDuration);

    // Collect metrics
    console.log('  📈 Collecting metrics...');
    const samples: PerformanceMetrics[] = [];
    const startTime = Date.now();
    const endTime = startTime + this.config.duration;

    while (Date.now() < endTime) {
      const metrics = this.manager!.getMetrics();
      if (metrics) {
        samples.push({ ...metrics });
      }
      await this.wait(this.config.sampleInterval);
    }

    const duration = Date.now() - startTime;

    // Calculate statistics
    const avgFPS = this.average(samples.map(s => s.fps));
    const minFPS = Math.min(...samples.map(s => s.fps));
    const maxFPS = Math.max(...samples.map(s => s.fps));
    const avgFrameTime = this.average(samples.map(s => s.frameTime));
    const avgDrawCalls = Math.round(this.average(samples.map(s => s.drawCalls)));
    const avgTriangles = Math.round(this.average(samples.map(s => s.triangles)));
    const avgObjects = Math.round(this.average(samples.map(s => s.objectCount)));

    // Check if passed
    const passed = minFPS >= test.threshold.minFPS && avgFrameTime <= test.threshold.maxFrameTime;

    const result: BenchmarkResult = {
      name: test.name,
      passed,
      metrics: {
        averageFPS: avgFPS,
        minFPS,
        maxFPS,
        averageFrameTime: avgFrameTime,
        drawCalls: avgDrawCalls,
        triangles: avgTriangles,
        objectCount: avgObjects,
      },
      duration,
      threshold: test.threshold,
      details: passed
        ? '✅ Performance targets met'
        : `❌ Failed: Min FPS ${minFPS.toFixed(1)} < ${test.threshold.minFPS} or Avg Frame Time ${avgFrameTime.toFixed(2)}ms > ${test.threshold.maxFrameTime}ms`,
    };

    console.log(`  ${result.passed ? '✅' : '❌'} ${result.details}`);
    return result;
  }

  /**
   * Run memory benchmark
   */
  async benchmarkMemory(): Promise<{
    initialMemory: number;
    peakMemory: number;
    finalMemory: number;
    leaked: boolean;
  }> {
    if (!this.manager || !this.map) {
      throw new Error('Benchmark not initialized');
    }

    console.log('\n💾 Running Memory Benchmark...');

    // Force garbage collection if available (Node.js or Chrome with --expose-gc)
    if (typeof (globalThis as any).gc === 'function') {
      (globalThis as any).gc();
      await this.wait(1000);
    }

    const initialMemory = this.getMemoryUsage();
    console.log(`  Initial Memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

    // Stress test: Create and destroy objects
    let peakMemory = initialMemory;
    for (let i = 0; i < 5; i++) {
      // Create 10,000 trees
      this.manager.updateConfig({ maxTrees: 10000, shadowQuality: 'high' });
      await this.wait(2000);
      
      const currentMemory = this.getMemoryUsage();
      peakMemory = Math.max(peakMemory, currentMemory);
      
      // Reduce to 1,000 trees
      this.manager.updateConfig({ maxTrees: 1000 });
      await this.wait(2000);
    }

    console.log(`  Peak Memory: ${(peakMemory / 1024 / 1024).toFixed(2)} MB`);

    // Force cleanup and GC
    this.manager.updateConfig({ maxTrees: 0 });
    await this.wait(2000);
    
    if (typeof (globalThis as any).gc === 'function') {
      (globalThis as any).gc();
      await this.wait(1000);
    }

    const finalMemory = this.getMemoryUsage();
    console.log(`  Final Memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);

    const leaked = (finalMemory - initialMemory) > (50 * 1024 * 1024); // 50MB threshold
    console.log(`  ${leaked ? '❌ Memory leak detected' : '✅ No significant memory leak'}`);

    return {
      initialMemory,
      peakMemory,
      finalMemory,
      leaked,
    };
  }

  /**
   * Generate summary text
   */
  private generateSummary(results: BenchmarkResult[], passed: number, failed: number): string {
    const passRate = (passed / results.length * 100).toFixed(1);
    
    let summary = `\n${'='.repeat(60)}\n`;
    summary += `BENCHMARK SUITE SUMMARY\n`;
    summary += `${'='.repeat(60)}\n`;
    summary += `Total Tests: ${results.length}\n`;
    summary += `Passed: ${passed} (${passRate}%)\n`;
    summary += `Failed: ${failed}\n`;
    summary += `\nDetailed Results:\n`;
    
    results.forEach((result, index) => {
      summary += `\n${index + 1}. ${result.name}\n`;
      summary += `   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`;
      summary += `   Average FPS: ${result.metrics.averageFPS.toFixed(1)}\n`;
      summary += `   Min FPS: ${result.metrics.minFPS.toFixed(1)} (threshold: ${result.threshold.minFPS})\n`;
      summary += `   Frame Time: ${result.metrics.averageFrameTime.toFixed(2)}ms (threshold: ${result.threshold.maxFrameTime.toFixed(2)}ms)\n`;
      summary += `   Draw Calls: ${result.metrics.drawCalls}\n`;
      summary += `   Objects: ${result.metrics.objectCount}\n`;
    });
    
    summary += `\n${'='.repeat(60)}\n`;
    
    if (failed === 0) {
      summary += `🎉 ALL BENCHMARKS PASSED! System is production-ready.\n`;
    } else {
      summary += `⚠️  ${failed} benchmark(s) failed. Review and optimize.\n`;
    }
    
    summary += `${'='.repeat(60)}\n`;
    
    return summary;
  }

  /**
   * Print results to console
   */
  private printResults(suite: BenchmarkSuiteResult): void {
    console.log(suite.summary);
    console.log(`\nTotal Duration: ${(suite.duration / 1000).toFixed(1)}s`);
    console.log(`Timestamp: ${new Date(suite.timestamp).toISOString()}`);
  }

  /**
   * Export results to JSON
   */
  exportResults(suite: BenchmarkSuiteResult): string {
    return JSON.stringify(suite, null, 2);
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Wait utility
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.manager = null;
    this.map = null;
  }
}

/**
 * Run benchmark from browser console
 * 
 * Usage:
 * ```javascript
 * import { runBenchmark } from './benchmarks/RenderingBenchmark';
 * const results = await runBenchmark(mapInstance);
 * console.log(results.summary);
 * ```
 */
export async function runBenchmark(map: MaplibreMap): Promise<BenchmarkSuiteResult> {
  const benchmark = new RenderingBenchmark();
  await benchmark.initialize(map);
  const results = await benchmark.runSuite();
  benchmark.dispose();
  return results;
}

/**
 * Quick benchmark (shorter duration for testing)
 */
export async function runQuickBenchmark(map: MaplibreMap): Promise<BenchmarkSuiteResult> {
  const benchmark = new RenderingBenchmark({
    duration: 3000,      // 3 seconds per test
    warmupDuration: 500, // 0.5 second warmup
    sampleInterval: 100,
  });
  await benchmark.initialize(map);
  const results = await benchmark.runSuite();
  benchmark.dispose();
  return results;
}
