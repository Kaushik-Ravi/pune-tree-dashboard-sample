// src/components/sidebar/tabs/charts/DynamicChart.tsx
// Renders different chart types based on configuration using Recharts

import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from 'recharts';
import { ChartConfig, ChartDataPoint, CHART_COLOR_PALETTE } from '../../../../types/charts';

interface DynamicChartProps {
  data: ChartDataPoint[];
  config: ChartConfig;
}

// Custom tooltip component for consistent styling
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-sm text-gray-600">
          {payload[0].value.toLocaleString('en-US', { maximumFractionDigits: 1 })}
        </p>
      </div>
    );
  }
  return null;
};

// Custom pie label - uses explicit typing to match Recharts PieLabelRenderProps
const renderCustomizedPieLabel = (props: { percent?: number }) => {
  const percent = props.percent ?? 0;
  if (percent < 0.03) return null; // Don't show labels for slices < 3%
  return `${(percent * 100).toFixed(0)}%`;
};

const DynamicChart: React.FC<DynamicChartProps> = ({ data, config }) => {
  const { chartType, showDataLabels, metric } = config;

  // Add colors to data
  const coloredData = data.map((item, index) => ({
    ...item,
    fill: CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length],
  }));

  // Format value for display
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  };

  // Formatter for LabelList (handles Recharts type requirements)
  const labelFormatter = (value: unknown) => {
    if (typeof value === 'number') return formatValue(value);
    return String(value ?? '');
  };

  // Truncate long labels
  const truncateLabel = (label: string, maxLength: number = 15) => {
    if (label.length <= maxLength) return label;
    return label.substring(0, maxLength - 2) + '...';
  };

  // Common axis props
  const xAxisProps = {
    dataKey: 'name',
    tick: { fontSize: 11, fill: '#6B7280' },
    tickLine: false,
    axisLine: { stroke: '#E5E7EB' },
  };

  const yAxisProps = {
    tick: { fontSize: 11, fill: '#6B7280' },
    tickLine: false,
    axisLine: { stroke: '#E5E7EB' },
    tickFormatter: formatValue,
  };

  // Render based on chart type
  switch (chartType) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={coloredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis 
              {...xAxisProps} 
              angle={-45} 
              textAnchor="end" 
              height={60}
              tickFormatter={(value) => truncateLabel(String(value), 10)}
              interval={data.length > 20 ? Math.floor(data.length / 15) : 0}
            />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
              {coloredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              {showDataLabels && (
                <LabelList 
                  dataKey="value" 
                  position="top" 
                  formatter={labelFormatter}
                  style={{ fontSize: 10, fill: '#6B7280' }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case 'horizontalBar':
      return (
        <ResponsiveContainer width="100%" height={Math.max(260, data.length * 35)}>
          <BarChart 
            data={coloredData} 
            layout="vertical" 
            margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
            <XAxis type="number" {...yAxisProps} />
            <YAxis 
              type="category" 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#374151' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              width={75}
              tickFormatter={(value) => truncateLabel(String(value), 12)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={30}>
              {coloredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              {showDataLabels && (
                <LabelList 
                  dataKey="value" 
                  position="right" 
                  formatter={labelFormatter}
                  style={{ fontSize: 10, fill: '#6B7280' }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line':
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={coloredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              {...xAxisProps} 
              angle={-45} 
              textAnchor="end" 
              height={60}
              tickFormatter={(value) => truncateLabel(String(value), 10)}
              interval={data.length > 20 ? Math.floor(data.length / 15) : 0}
            />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={CHART_COLOR_PALETTE[0]} 
              strokeWidth={2}
              dot={{ fill: CHART_COLOR_PALETTE[0], strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={coloredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              {...xAxisProps} 
              angle={-45} 
              textAnchor="end" 
              height={60}
              tickFormatter={(value) => truncateLabel(String(value), 10)}
              interval={data.length > 20 ? Math.floor(data.length / 15) : 0}
            />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={CHART_COLOR_PALETTE[0]} 
              fill={CHART_COLOR_PALETTE[0]}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={coloredData}
              cx="50%"
              cy="45%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
              label={showDataLabels ? renderCustomizedPieLabel : undefined}
              labelLine={showDataLabels}
            >
              {coloredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => {
                const numValue = typeof value === 'number' ? value : 0;
                return [formatValue(numValue), metric === 'count' ? 'Trees' : 'Value'];
              }}
            />
            <Legend 
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={10}
              formatter={(value: string) => (
                <span className="text-xs text-gray-600">{truncateLabel(value, 20)}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      );

    default:
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>Unknown chart type: {chartType}</p>
        </div>
      );
  }
};

export default DynamicChart;
