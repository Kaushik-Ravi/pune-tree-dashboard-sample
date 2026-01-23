// src/components/sidebar/tabs/CityOverviewCharts.tsx
// Chart area for CityOverview - Nivo-based, surgical replacement only

import React, { useState, useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { Download, SlidersHorizontal } from 'lucide-react';
import { useTreeStore } from '../../../store/TreeStore';
import { saveAs } from 'file-saver';

// --- Preset Configs ---
const chartPresets = [
  { key: 'treesByWard', label: '🏘️ Trees by Ward', type: 'bar' },
  { key: 'co2ByWard', label: '🌍 CO₂ by Ward', type: 'bar' },
  { key: 'topSpecies', label: '🌳 Top 10 Species', type: 'horizontalBar' },
  { key: 'byPurpose', label: '💰 By Purpose', type: 'pie' },
  { key: 'heightDist', label: '📏 Height Distribution', type: 'bar' },
  { key: 'streetVsNonStreet', label: '🛣️ Street vs Non-Street', type: 'pie' },
  { key: 'flowering', label: '🌸 Flowering Status', type: 'pie' },
  { key: 'topCO2Species', label: '🏆 Top CO₂ Contributors', type: 'horizontalBar' },
];

const CityOverviewCharts: React.FC = () => {
  const [activePreset, setActivePreset] = useState('treesByWard');
  const [showBuilder, setShowBuilder] = useState(false);
  // TODO: Add advanced builder state

  // --- Data hooks ---
  const { wardCO2Data, wardTreeCountData, cityStats, treeSpeciesData } = useTreeStore();

  // --- Data preparation for each preset ---
  const chartData = useMemo(() => {
    switch (activePreset) {
      case 'treesByWard':
        return wardTreeCountData.map(w => ({ label: w.ward, value: w.tree_count }));
      case 'co2ByWard':
        return wardCO2Data.map(w => ({ label: w.ward, value: Math.round(w.co2_kg / 1000) }));
      case 'topSpecies':
        return treeSpeciesData.slice(0, 10).map(s => ({ label: s.common_name, value: s.representative_archetype ? s.representative_archetype.co2_seq_kg_max : 0 }));
      case 'byPurpose': {
        // Aggregate by economic importance from all archetypes
        const econMap: Record<string, number> = {};
        treeSpeciesData.forEach(s => {
          s.archetypes.forEach(a => {
            const cat = (a as any).economic_i || 'Other';
            econMap[cat] = (econMap[cat] || 0) + 1;
          });
        });
        return Object.entries(econMap).map(([label, value]) => ({ label, value }));
      }
      case 'heightDist':
        // Example: group by height category
        return [
          { label: 'Short (<5m)', value: 0 },
          { label: 'Medium (5-10m)', value: 0 },
          { label: 'Tall (10-15m)', value: 0 },
          { label: 'Very Tall (>15m)', value: 0 },
        ]; // TODO: Fill with real data
      case 'streetVsNonStreet': {
        // Fallback: use wardTreeCountData if cityStats has no location info
        // (cityStats does not have locationCounts in current type)
        // For now, just show 0s (or you can fetch from a new API if needed)
        return [
          { label: 'Street', value: 0 },
          { label: 'Non-Street', value: 0 },
        ];
      }
      case 'flowering':
        return [
          { label: 'Flowering', value: 0 },
          { label: 'Non-Flowering', value: 0 },
        ]; // TODO: Fill with real data
      case 'topCO2Species':
        return treeSpeciesData
          .slice(0, 10)
          .map(s => ({ label: s.common_name, value: s.representative_archetype?.co2_seq_kg_max || 0 }));
      default:
        return [];
    }
  }, [activePreset, wardCO2Data, wardTreeCountData, cityStats, treeSpeciesData]);

  // --- Chart rendering ---
  const renderChart = () => {
    const preset = chartPresets.find(p => p.key === activePreset);
    if (!preset) return null;
    if (preset.type === 'bar') {
      return (
        <div style={{ height: 320 }}>
          <ResponsiveBar
            data={chartData}
            keys={['value']}
            indexBy="label"
            margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
            padding={0.3}
            colors={{ scheme: 'greens' }}
            axisBottom={{ tickRotation: 45 }}
            axisLeft={{ legend: 'Count', legendPosition: 'middle', legendOffset: -40 }}
            enableLabel={false}
          />
        </div>
      );
    }
    if (preset.type === 'horizontalBar') {
      return (
        <div style={{ height: 320 }}>
          <ResponsiveBar
            data={chartData}
            keys={['value']}
            indexBy="label"
            layout="horizontal"
            margin={{ top: 30, right: 30, bottom: 60, left: 120 }}
            padding={0.3}
            colors={{ scheme: 'greens' }}
            axisLeft={{ legend: '', legendPosition: 'middle', legendOffset: -60 }}
            axisBottom={{ legend: 'Value', legendPosition: 'middle', legendOffset: 40 }}
            enableLabel={false}
          />
        </div>
      );
    }
    if (preset.type === 'pie') {
      return (
        <div style={{ height: 320 }}>
          <ResponsivePie
            data={chartData}
            margin={{ top: 30, right: 30, bottom: 30, left: 30 }}
            innerRadius={0.5}
            padAngle={1}
            cornerRadius={3}
            colors={{ scheme: 'greens' }}
            borderWidth={1}
            borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
            arcLabelsSkipAngle={10}
            arcLabelsTextColor="#333333"
            animate
          />
        </div>
      );
    }
    // TODO: Add scatter/line support for advanced builder
    return null;
  };

  // --- Export handlers (PNG/CSV) ---
  const handleExportPNG = () => {
    // TODO: Implement PNG export (Nivo supports via ref/canvas)
    alert('PNG export coming soon!');
  };
  const handleExportCSV = () => {
    // Simple CSV export
    const csv = [
      'Label,Value',
      ...chartData.map(d => `${d.label},${d.value}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${activePreset}.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Preset Chips */}
      <div className="flex flex-wrap gap-2 pb-2">
        {chartPresets.map(preset => (
          <button
            key={preset.key}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${activePreset === preset.key ? 'bg-green-600 text-white border-green-700' : 'bg-white text-green-700 border-green-200 hover:bg-green-50'}`}
            onClick={() => setActivePreset(preset.key)}
          >
            {preset.label}
          </button>
        ))}
        <button
          className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50"
          onClick={() => setShowBuilder(v => !v)}
        >
          <SlidersHorizontal size={16} /> Advanced
        </button>
      </div>
      {/* Chart Area */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-end gap-2 pb-2">
          <button onClick={handleExportPNG} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 bg-gray-50 hover:bg-gray-100">
            <Download size={14} /> PNG
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 bg-gray-50 hover:bg-gray-100">
            <Download size={14} /> CSV
          </button>
        </div>
        {renderChart()}
      </div>
      {/* Advanced Chart Builder (collapsible) */}
      {showBuilder && (
        <div className="mt-2 p-4 border rounded-lg bg-gray-50">
          <div className="text-sm font-semibold mb-2">Custom Chart Builder (coming soon)</div>
          {/* TODO: Advanced builder UI */}
        </div>
      )}
    </div>
  );
};

export default CityOverviewCharts;
