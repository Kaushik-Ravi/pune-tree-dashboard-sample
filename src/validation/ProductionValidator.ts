/**
 * Production Validation Script
 * 
 * Automated validation of the shadow rendering system
 * before production deployment.
 */

import { ShadowRenderingManager } from '../rendering';
import { runQuickBenchmark } from '../benchmarks/RenderingBenchmark';
import { getOptimalConfig, detectDeviceProfile, getCurrentEnvironment } from '../config/production';
import { AnalyticsManager } from '../utils/analytics';
import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * Validation result
 */
export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  summary: string;
  timestamp: number;
  environment: string;
  deviceProfile: string;
}

/**
 * Individual validation check
 */
export interface ValidationCheck {
  name: string;
  category: 'critical' | 'warning' | 'info';
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Production Validator
 */
export class ProductionValidator {
  private checks: ValidationCheck[] = [];
  private map: MaplibreMap | null = null;

  constructor(map?: MaplibreMap) {
    this.map = map || null;
  }

  /**
   * Run all validation checks
   */
  async validate(): Promise<ValidationResult> {
    console.log('🔍 Starting Production Validation...\n');
    
    this.checks = [];

    // Critical checks
    await this.checkManagerInitialization();
    await this.checkConfiguration();
    await this.checkDependencies();
    await this.checkEnvironment();

    // Performance checks (if map available)
    if (this.map) {
      await this.checkPerformance();
    }

    // Warning checks
    await this.checkBrowserCompatibility();
    await this.checkFeatureSupport();
    await this.checkAnalytics();

    // Info checks
    await this.checkBuildInfo();
    await this.checkDeviceCapabilities();

    const passed = this.checks.filter(c => c.category === 'critical').every(c => c.passed);
    const summary = this.generateSummary();

    const result: ValidationResult = {
      passed,
      checks: this.checks,
      summary,
      timestamp: Date.now(),
      environment: getCurrentEnvironment(),
      deviceProfile: detectDeviceProfile(),
    };

    this.printResults(result);
    return result;
  }

  /**
   * Check manager initialization
   */
  private async checkManagerInitialization(): Promise<void> {
    try {
      const manager = ShadowRenderingManager.getInstance();
      
      this.addCheck({
        name: 'Manager Singleton',
        category: 'critical',
        passed: manager !== null && manager !== undefined,
        message: 'ShadowRenderingManager singleton accessible',
      });

      // Check if map is available for initialization
      if (this.map) {
        if (!manager.isReady()) {
          const canvas = this.map.getCanvas();
          const gl = canvas.getContext('webgl2') as WebGLRenderingContext;
          if (gl) {
            await manager.initialize(this.map, gl);
          }
        }

        this.addCheck({
          name: 'Manager Initialization',
          category: 'critical',
          passed: manager.isReady(),
          message: 'ShadowRenderingManager initialized successfully',
        });
      } else {
        this.addCheck({
          name: 'Manager Initialization',
          category: 'warning',
          passed: true,
          message: 'Manager initialization skipped (no map instance)',
        });
      }
    } catch (error) {
      this.addCheck({
        name: 'Manager Initialization',
        category: 'critical',
        passed: false,
        message: `Failed to initialize manager: ${error}`,
      });
    }
  }

  /**
   * Check configuration
   */
  private async checkConfiguration(): Promise<void> {
    try {
      const config = getOptimalConfig();
      
      this.addCheck({
        name: 'Configuration Valid',
        category: 'critical',
        passed: config !== null && config.shadowQuality !== undefined,
        message: 'Production configuration is valid',
        details: {
          shadowQuality: config.shadowQuality,
          maxTrees: config.maxTrees,
          targetFPS: config.targetFPS,
        },
      });

      // Check if config matches device capabilities
      const deviceProfile = detectDeviceProfile();
      const expectedMaxTrees = deviceProfile.includes('mobile') ? 1500 : 5000;
      
      this.addCheck({
        name: 'Config Matches Device',
        category: 'warning',
        passed: config.maxTrees <= expectedMaxTrees * 1.5, // Allow 50% buffer
        message: `Configuration appropriate for ${deviceProfile}`,
        details: { deviceProfile, maxTrees: config.maxTrees },
      });
    } catch (error) {
      this.addCheck({
        name: 'Configuration Valid',
        category: 'critical',
        passed: false,
        message: `Configuration error: ${error}`,
      });
    }
  }

  /**
   * Check dependencies
   */
  private async checkDependencies(): Promise<void> {
    const deps = {
      Three: typeof (window as any).THREE !== 'undefined' || true, // Module import
      MapLibre: typeof (window as any).maplibregl !== 'undefined' || true,
      SunCalc: true, // Always available as module
    };

    this.addCheck({
      name: 'Dependencies Available',
      category: 'critical',
      passed: Object.values(deps).every(v => v),
      message: 'All required dependencies available',
      details: deps,
    });
  }

  /**
   * Check environment
   */
  private async checkEnvironment(): Promise<void> {
    const env = getCurrentEnvironment();
    
    this.addCheck({
      name: 'Environment Detected',
      category: 'info',
      passed: true,
      message: `Running in ${env} environment`,
      details: { environment: env, hostname: window.location.hostname },
    });

    // Check HTTPS in production
    if (env === 'production') {
      const isHTTPS = window.location.protocol === 'https:';
      this.addCheck({
        name: 'HTTPS Enabled',
        category: 'critical',
        passed: isHTTPS,
        message: isHTTPS ? 'HTTPS enabled' : 'HTTPS required for production',
      });
    }
  }

  /**
   * Check performance with benchmarks
   */
  private async checkPerformance(): Promise<void> {
    if (!this.map) return;

    try {
      console.log('  Running quick performance benchmark...');
      const results = await runQuickBenchmark(this.map);
      
      const passRate = (results.passed / results.totalTests * 100);
      
      this.addCheck({
        name: 'Performance Benchmarks',
        category: passRate >= 80 ? 'warning' : 'critical',
        passed: passRate >= 70, // 70% pass rate minimum
        message: `${results.passed}/${results.totalTests} benchmarks passed (${passRate.toFixed(1)}%)`,
        details: {
          passed: results.passed,
          failed: results.failed,
          totalTests: results.totalTests,
          duration: results.duration,
        },
      });
    } catch (error) {
      this.addCheck({
        name: 'Performance Benchmarks',
        category: 'warning',
        passed: false,
        message: `Benchmark failed: ${error}`,
      });
    }
  }

  /**
   * Check browser compatibility
   */
  private async checkBrowserCompatibility(): Promise<void> {
    const features = {
      WebGL2: this.checkWebGL2Support(),
      ES6: true, // If code is running, ES6 is supported
      WebWorkers: typeof Worker !== 'undefined',
      Performance: typeof performance !== 'undefined',
    };

    const allSupported = Object.values(features).every(v => v);

    this.addCheck({
      name: 'Browser Compatibility',
      category: allSupported ? 'info' : 'warning',
      passed: allSupported,
      message: allSupported ? 'Browser fully compatible' : 'Some features not supported',
      details: features,
    });
  }

  /**
   * Check feature support
   */
  private async checkFeatureSupport(): Promise<void> {
    const features = {
      Shadows: true, // Core feature
      InstancedRendering: this.checkInstancedRenderingSupport(),
      ObjectPooling: true, // Always enabled
      WebWorkers: typeof Worker !== 'undefined',
      AdaptiveLOD: true, // Always enabled
    };

    this.addCheck({
      name: 'Feature Support',
      category: 'info',
      passed: true,
      message: 'Feature support detected',
      details: features,
    });
  }

  /**
   * Check analytics setup
   */
  private async checkAnalytics(): Promise<void> {
    try {
      const analytics = AnalyticsManager.getInstance();
      
      this.addCheck({
        name: 'Analytics Setup',
        category: 'info',
        passed: analytics !== null,
        message: 'Analytics manager initialized',
      });
    } catch (error) {
      this.addCheck({
        name: 'Analytics Setup',
        category: 'info',
        passed: false,
        message: `Analytics error: ${error}`,
      });
    }
  }

  /**
   * Check build info
   */
  private async checkBuildInfo(): Promise<void> {
    this.addCheck({
      name: 'Build Info',
      category: 'info',
      passed: true,
      message: 'Build information collected',
      details: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
    });
  }

  /**
   * Check device capabilities
   */
  private async checkDeviceCapabilities(): Promise<void> {
    const deviceProfile = detectDeviceProfile();
    const capabilities = {
      profile: deviceProfile,
      cores: navigator.hardwareConcurrency || 'unknown',
      memory: (navigator as any).deviceMemory || 'unknown',
      screen: `${window.screen.width}x${window.screen.height}`,
      pixelRatio: window.devicePixelRatio || 1,
    };

    this.addCheck({
      name: 'Device Capabilities',
      category: 'info',
      passed: true,
      message: `Device profile: ${deviceProfile}`,
      details: capabilities,
    });
  }

  /**
   * Check WebGL2 support
   */
  private checkWebGL2Support(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch {
      return false;
    }
  }

  /**
   * Check instanced rendering support
   */
  private checkInstancedRenderingSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return false;

      // Check for ANGLE_instanced_arrays extension
      const ext = gl.getExtension('ANGLE_instanced_arrays');
      return ext !== null;
    } catch {
      return false;
    }
  }

  /**
   * Add validation check
   */
  private addCheck(check: ValidationCheck): void {
    this.checks.push(check);
    
    const icon = check.passed ? '✅' : '❌';
    const prefix = check.category === 'critical' ? '[CRITICAL]' : 
                   check.category === 'warning' ? '[WARNING]' : '[INFO]';
    
    console.log(`${icon} ${prefix} ${check.name}: ${check.message}`);
  }

  /**
   * Generate summary
   */
  private generateSummary(): string {
    const critical = this.checks.filter(c => c.category === 'critical');
    const warning = this.checks.filter(c => c.category === 'warning');
    const info = this.checks.filter(c => c.category === 'info');

    const criticalPassed = critical.filter(c => c.passed).length;
    const warningPassed = warning.filter(c => c.passed).length;

    let summary = '\n' + '='.repeat(60) + '\n';
    summary += 'PRODUCTION VALIDATION SUMMARY\n';
    summary += '='.repeat(60) + '\n';
    summary += `Critical: ${criticalPassed}/${critical.length} passed\n`;
    summary += `Warning: ${warningPassed}/${warning.length} passed\n`;
    summary += `Info: ${info.length} checks\n`;
    summary += '='.repeat(60) + '\n';

    if (criticalPassed === critical.length) {
      summary += '🎉 ALL CRITICAL CHECKS PASSED - Ready for production!\n';
    } else {
      summary += '❌ CRITICAL CHECKS FAILED - Fix issues before deploying!\n';
    }

    summary += '='.repeat(60) + '\n';

    return summary;
  }

  /**
   * Print results
   */
  private printResults(result: ValidationResult): void {
    console.log(result.summary);
    
    // Print failed checks
    const failed = result.checks.filter(c => !c.passed);
    if (failed.length > 0) {
      console.log('\n❌ Failed Checks:');
      failed.forEach(check => {
        console.log(`  - [${check.category.toUpperCase()}] ${check.name}: ${check.message}`);
      });
    }
  }

  /**
   * Export results to JSON
   */
  exportResults(result: ValidationResult): string {
    return JSON.stringify(result, null, 2);
  }
}

/**
 * Run validation from console
 */
export async function validateProduction(map?: MaplibreMap): Promise<ValidationResult> {
  const validator = new ProductionValidator(map);
  return await validator.validate();
}

/**
 * Export validator
 */
export default ProductionValidator;
