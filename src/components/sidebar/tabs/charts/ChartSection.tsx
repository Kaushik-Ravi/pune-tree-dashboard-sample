// src/components/sidebar/tabs/charts/ChartSection.tsx
// Main chart section component with presets, builder, and chart display

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart3, Download, Settings2, ChevronDown, ChevronUp, Image, FileSpreadsheet } from 'lucide-react';
import axios from 'axios';
import { toPng } from 'html-to-image';
import ChartPresets from './ChartPresets';
import ChartBuilder from './ChartBuilder';
import DynamicChart from './DynamicChart';
import { 
  ChartConfig, 
  ChartDataPoint, 
  CHART_PRESETS,
  GroupByField,
  MetricField,
  SortBy,
  SortOrder,
  ChartType
} from '../../../../types/charts';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

interface ChartSectionProps {
  className?: string;
}

const ChartSection: React.FC<ChartSectionProps> = ({ className = '' }) => {
  // State
  const [activePresetId, setActivePresetId] = useState<string>('trees-by-ward');
  const [chartConfig, setChartConfig] = useState<ChartConfig>(CHART_PRESETS[0].config);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const chartRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch chart data when config changes
  const fetchChartData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/chart-data`, {
        groupBy: chartConfig.groupBy,
        metric: chartConfig.metric,
        sortBy: chartConfig.sortBy,
        sortOrder: chartConfig.sortOrder,
        limit: chartConfig.limit,
      });
      
      setChartData(response.data.data || []);
    } catch (err) {
      console.error('Error fetching chart data:', err);
      setError('Failed to load chart data. Please try again.');
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [chartConfig]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // Handle preset selection
  const handlePresetSelect = (presetId: string) => {
    const preset = CHART_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setActivePresetId(presetId);
      setChartConfig(preset.config);
      setIsBuilderOpen(false); // Close builder when preset selected
    }
  };

  // Handle custom config change from builder
  const handleConfigChange = (newConfig: Partial<ChartConfig>) => {
    setActivePresetId(''); // Clear preset when custom config is used
    setChartConfig(prev => ({ ...prev, ...newConfig }));
  };

  // Handle individual config field changes
  const handleFieldChange = (field: keyof ChartConfig, value: ChartType | GroupByField | MetricField | SortBy | SortOrder | number | null | boolean | string) => {
    handleConfigChange({ [field]: value });
  };

  // Export to PNG
  const handleExportPNG = async () => {
    if (!chartRef.current) return;
    
    try {
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2, // Higher quality
      });
      
      const link = document.createElement('a');
      link.download = `${chartConfig.title.replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting PNG:', err);
    }
    setIsExportMenuOpen(false);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (chartData.length === 0) return;
    
    // Build CSV content
    const headers = ['Name', chartConfig.metric === 'count' ? 'Count' : 'Value'];
    const rows = chartData.map(d => [d.name, d.value.toString()]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chartConfig.title.replace(/[^a-z0-9]/gi, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };

  return (
    <div className={`card ${className}`}>
      {/* Header */}
      <div className="card-header flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-primary-600" />
          <h3 className="text-lg font-medium">Charts</h3>
        </div>
        
        {/* Export Button */}
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            title="Export chart"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
          </button>
          
          {isExportMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px] py-1">
              <button
                onClick={handleExportPNG}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Image size={16} className="text-gray-500" />
                Export as PNG
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileSpreadsheet size={16} className="text-gray-500" />
                Export as CSV
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card-body space-y-4">
        {/* Preset Chips */}
        <ChartPresets
          activePresetId={activePresetId}
          onPresetSelect={handlePresetSelect}
        />

        {/* Chart Display */}
        <div 
          ref={chartRef}
          className="bg-gray-50 rounded-lg p-4"
          style={{ minHeight: '320px' }}
        >
          {/* Chart Title */}
          <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">
            {chartConfig.title}
          </h4>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto mb-3"></div>
                <p className="text-sm text-gray-500">Loading chart...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-500">
                <p className="text-sm">{error}</p>
                <button
                  onClick={fetchChartData}
                  className="mt-2 text-sm text-primary-600 hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-gray-500">No data available</p>
            </div>
          ) : (
            <DynamicChart
              data={chartData}
              config={chartConfig}
            />
          )}
        </div>

        {/* Advanced Builder Toggle */}
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setIsBuilderOpen(!isBuilderOpen)}
            className="flex items-center justify-between w-full py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={16} className="text-gray-500" />
              <span>Custom Chart Builder</span>
              {activePresetId === '' && (
                <span className="px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded">
                  Custom
                </span>
              )}
            </div>
            {isBuilderOpen ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>

          {isBuilderOpen && (
            <ChartBuilder
              config={chartConfig}
              onFieldChange={handleFieldChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
