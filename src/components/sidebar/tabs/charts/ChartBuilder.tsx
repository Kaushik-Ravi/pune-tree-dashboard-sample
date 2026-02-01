// src/components/sidebar/tabs/charts/ChartBuilder.tsx
// Advanced chart configuration builder (collapsible)

import React from 'react';
import { 
  ChartConfig, 
  ChartType,
  GroupByField, 
  MetricField, 
  SortBy, 
  SortOrder,
  GROUP_BY_LABELS,
  METRIC_LABELS,
  CHART_TYPE_LABELS
} from '../../../../types/charts';

interface ChartBuilderProps {
  config: ChartConfig;
  onFieldChange: (field: keyof ChartConfig, value: ChartType | GroupByField | MetricField | SortBy | SortOrder | number | null | boolean | string) => void;
}

const ChartBuilder: React.FC<ChartBuilderProps> = ({ config, onFieldChange }) => {
  const chartTypes: ChartType[] = ['bar', 'line', 'pie', 'horizontalBar', 'area'];
  const groupByOptions: GroupByField[] = [
    'ward', 'species', 'economic_importance', 'flowering', 'location_type', 'height_category', 'canopy_category'
  ];
  const metricOptions: MetricField[] = ['count', 'sum_co2', 'avg_height', 'avg_canopy', 'avg_girth'];
  const limitOptions = [
    { value: null, label: 'All' },
    { value: 5, label: 'Top 5' },
    { value: 10, label: 'Top 10' },
    { value: 20, label: 'Top 20' },
    { value: 50, label: 'Top 50' },
  ];

  return (
    <div className="mt-3 space-y-4 p-4 bg-gray-50 rounded-lg animate-fade-in">
      <p className="text-xs text-gray-500">
        Build your own custom chart by selecting options below
      </p>

      {/* Chart Type Selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600">Chart Type</label>
        <div className="flex flex-wrap gap-2">
          {chartTypes.map((type) => (
            <button
              key={type}
              onClick={() => onFieldChange('chartType', type)}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-md border transition-colors
                ${config.chartType === type
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }
              `}
            >
              {CHART_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Group By & Metric Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Group By (X-Axis) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">
            Group By (X-Axis)
          </label>
          <select
            value={config.groupBy}
            onChange={(e) => onFieldChange('groupBy', e.target.value as GroupByField)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            {groupByOptions.map((option) => (
              <option key={option} value={option}>
                {GROUP_BY_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        {/* Metric (Y-Axis) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">
            Metric (Y-Axis)
          </label>
          <select
            value={config.metric}
            onChange={(e) => onFieldChange('metric', e.target.value as MetricField)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            {metricOptions.map((option) => (
              <option key={option} value={option}>
                {METRIC_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sort & Limit Row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Sort By */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Sort By</label>
          <select
            value={config.sortBy}
            onChange={(e) => onFieldChange('sortBy', e.target.value as SortBy)}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            <option value="value">Value</option>
            <option value="label">Name</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Order</label>
          <select
            value={config.sortOrder}
            onChange={(e) => onFieldChange('sortOrder', e.target.value as SortOrder)}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        {/* Limit */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Limit</label>
          <select
            value={config.limit === null ? 'null' : config.limit}
            onChange={(e) => onFieldChange('limit', e.target.value === 'null' ? null : parseInt(e.target.value))}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            {limitOptions.map((opt) => (
              <option key={opt.label} value={opt.value === null ? 'null' : opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Options Row */}
      <div className="flex items-center gap-4 pt-2">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showDataLabels}
            onChange={(e) => onFieldChange('showDataLabels', e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>Show data labels</span>
        </label>
      </div>

      {/* Custom Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">Chart Title</label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => onFieldChange('title', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Enter chart title..."
        />
      </div>
    </div>
  );
};

export default ChartBuilder;
