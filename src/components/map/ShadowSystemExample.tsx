/**
 * ShadowSystemExample - Complete Integration Example
 * 
 * Shows how to integrate all Phase 4 components together.
 * This is a reference implementation for production use.
 */

import { useState } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { RealisticShadowLayer } from './RealisticShadowLayer';
import { ShadowErrorBoundary } from '../common/ShadowErrorBoundary';
import { usePerformanceMetrics } from '../../hooks/usePerformanceMetrics';
import type { ShadowQuality } from '../../rendering';

/**
 * Example component props
 */
interface ShadowSystemExampleProps {
  map: MaplibreMap | null;
}

/**
 * Complete shadow system integration example
 */
export function ShadowSystemExample({ map }: ShadowSystemExampleProps) {
  // State for shadow configuration
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [shadowQuality, setShadowQuality] = useState<ShadowQuality>('high');
  const [maxTrees, setMaxTrees] = useState(5000);

  // Performance monitoring
  const {
    metrics,
    isCollecting,
    averageFPS,
    minFPS,
    maxFPS,
  } = usePerformanceMetrics({
    updateInterval: 1000,
    enabled: shadowsEnabled,
    trackHistory: true,
    maxHistorySize: 60,
  });

  return (
    <div>
      {/* Error Boundary wraps the shadow layer */}
      <ShadowErrorBoundary
        showDetails={true}
        enableAutoRecovery={true}
        maxRecoveryAttempts={3}
        onError={(error) => {
          console.error('Shadow rendering error:', error);
          // Could send to error tracking service (Sentry, etc.)
        }}
        onReset={() => {
          console.log('Shadow rendering reset');
        }}
      >
        {/* Main shadow rendering component */}
        <RealisticShadowLayer
          map={map}
          enabled={shadowsEnabled}
          shadowQuality={shadowQuality}
          maxVisibleTrees={maxTrees}
          enableFrustumCulling={true}
          latitude={18.5204}
          longitude={73.8567}
          dateTime={new Date()}
          onInitialized={() => {
            console.log('Shadow system ready!');
          }}
          onError={(error) => {
            console.error('Shadow layer error:', error);
          }}
          onPerformanceUpdate={(fps) => {
            // Could update UI or adjust quality based on FPS
            if (fps < 30) {
              console.warn('Low FPS detected:', fps);
            }
          }}
        />
      </ShadowErrorBoundary>

      {/* Performance UI (optional) */}
      {isCollecting && metrics && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'monospace',
            zIndex: 1000,
          }}
        >
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            Performance Metrics
          </div>
          <div>FPS: {metrics.fps.toFixed(1)}</div>
          <div>Avg: {averageFPS.toFixed(1)}</div>
          <div>Min: {minFPS.toFixed(1)} / Max: {maxFPS.toFixed(1)}</div>
          <div>Frame: {metrics.frameTime.toFixed(2)}ms</div>
          <div>Draw Calls: {metrics.drawCalls}</div>
          <div>Objects: {metrics.objectCount}</div>
        </div>
      )}

      {/* Control UI (optional) */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          zIndex: 1000,
          minWidth: '200px',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
          Shadow Settings
        </h3>

        {/* Enable/Disable Toggle */}
        <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px' }}>
          <input
            type="checkbox"
            checked={shadowsEnabled}
            onChange={(e) => setShadowsEnabled(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Enable Shadows
        </label>

        {/* Quality Selector */}
        <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px' }}>
          <div style={{ marginBottom: '4px' }}>Shadow Quality</div>
          <select
            value={shadowQuality}
            onChange={(e) => setShadowQuality(e.target.value as ShadowQuality)}
            disabled={!shadowsEnabled}
            style={{
              width: '100%',
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid #ddd',
            }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="ultra">Ultra</option>
          </select>
        </label>

        {/* Max Trees Slider */}
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>
          <div style={{ marginBottom: '4px' }}>
            Max Trees: {maxTrees.toLocaleString()}
          </div>
          <input
            type="range"
            min="500"
            max="10000"
            step="500"
            value={maxTrees}
            onChange={(e) => setMaxTrees(Number(e.target.value))}
            disabled={!shadowsEnabled}
            style={{ width: '100%' }}
          />
        </label>
      </div>
    </div>
  );
}

/**
 * Default export
 */
export default ShadowSystemExample;
