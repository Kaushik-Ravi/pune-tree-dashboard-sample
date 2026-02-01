// src/components/sidebar/tabs/charts/DynamicChart.tsx
// Enterprise-grade chart rendering with Recharts
// Follows IBM Carbon Design System and Storytelling with Data best practices

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
  Label,
} from 'recharts';
import { 
  ChartConfig, 
  ChartDataPoint, 
  CHART_COLOR_PALETTE,
  METRIC_LABELS,
  GROUP_BY_LABELS,
} from '../../../../types/charts';

interface DynamicChartProps {
  data: ChartDataPoint[];
  config: ChartConfig;
}

// Get unit suffix based on metric
const getMetricUnit = (metric: string): string => {
  switch (metric) {
    case 'count': return ' trees';
    case 'sum_co2': return ' tons';
    case 'avg_height': return 'm';
    case 'avg_canopy': return 'm';
    case 'avg_girth': return 'cm';
    default: return '';
  }
};

// Get Y-axis label based on metric
const getYAxisLabel = (metric: string): string => {
  return METRIC_LABELS[metric as keyof typeof METRIC_LABELS] || 'Value';
};

// Enterprise-grade custom tooltip component
const CustomTooltip = ({ 
  active, 
  payload, 
  label,
  metric,
  groupBy,
}: { 
  active?: boolean; 
  payload?: { value: number; name: string; payload?: { name: string } }[]; 
  label?: string;
  metric: string;
  groupBy: string;
}) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const unit = getMetricUnit(metric);
    const groupLabel = GROUP_BY_LABELS[groupBy as keyof typeof GROUP_BY_LABELS] || groupBy;
    
    // Format large numbers with proper precision
    const formatTooltipValue = (val: number) => {
      if (metric === 'count') {
        return val.toLocaleString('en-US');
      }
      if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
      return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    return (
      <div 
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          padding: '12px 16px',
          minWidth: '140px',
        }}
      >
        <p style={{ 
          fontSize: '11px', 
          color: '#6B7280', 
          marginBottom: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 500,
        }}>
          {groupLabel}
        </p>
        <p style={{ 
          fontSize: '14px', 
          fontWeight: 600, 
          color: '#111827',
          marginBottom: '8px',
        }}>
          {label || payload[0].payload?.name}
        </p>
        <div style={{ 
          borderTop: '1px solid #F3F4F6', 
          paddingTop: '8px',
        }}>
          <span style={{ 
            fontSize: '20px', 
            fontWeight: 700, 
            color: '#059669',
          }}>
            {formatTooltipValue(value)}
          </span>
          <span style={{ 
            fontSize: '12px', 
            color: '#6B7280',
            marginLeft: '4px',
          }}>
            {unit}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom pie label with better visibility
const renderPieLabel = (props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) => {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
  
  if (percent < 0.05) return null; // Don't show labels for slices < 5%
  
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      style={{
        fontSize: '12px',
        fontWeight: 600,
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const DynamicChart: React.FC<DynamicChartProps> = ({ data, config }) => {
  const { chartType, showDataLabels, metric, groupBy } = config;

  // Add colors to data
  const coloredData = data.map((item, index) => ({
    ...item,
    fill: CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length],
  }));

  // Format value for axis and labels
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  // Formatter for LabelList
  const labelFormatter = (value: unknown) => {
    if (typeof value === 'number') return formatValue(value);
    return String(value ?? '');
  };

  // Truncate long labels
  const truncateLabel = (label: string, maxLength: number = 15) => {
    if (label.length <= maxLength) return label;
    return label.substring(0, maxLength - 2) + '…';
  };

  // Common axis styling (IBM Carbon-inspired)
  const axisStyle = {
    tick: { 
      fontSize: 11, 
      fill: '#4B5563',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    tickLine: { stroke: '#D1D5DB', strokeWidth: 1 },
    axisLine: { stroke: '#D1D5DB', strokeWidth: 1 },
  };

  // Grid styling
  const gridStyle = {
    strokeDasharray: '4 4',
    stroke: '#E5E7EB',
    strokeOpacity: 0.8,
  };

  // Render based on chart type
  switch (chartType) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart 
            data={coloredData} 
            margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
          >
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis 
              dataKey="name"
              {...axisStyle}
              angle={-45} 
              textAnchor="end" 
              height={60}
              tickFormatter={(value) => truncateLabel(String(value), 10)}
              interval={data.length > 20 ? Math.floor(data.length / 12) : 0}
            />
            <YAxis 
              {...axisStyle}
              tickFormatter={formatValue}
              width={55}
            >
              <Label 
                value={getYAxisLabel(metric)}
                angle={-90}
                position="insideLeft"
                style={{ 
                  textAnchor: 'middle',
                  fontSize: '11px',
                  fill: '#6B7280',
                  fontWeight: 500,
                }}
                offset={-5}
              />
            </YAxis>
            <Tooltip 
              content={<CustomTooltip metric={metric} groupBy={groupBy} />}
              cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
            />
            <Bar 
              dataKey="value" 
              radius={[4, 4, 0, 0]} 
              maxBarSize={45}
            >
              {coloredData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill}
                  style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.05))' }}
                />
              ))}
              {showDataLabels && data.length <= 15 && (
                <LabelList 
                  dataKey="value" 
                  position="top" 
                  formatter={labelFormatter}
                  style={{ 
                    fontSize: 10, 
                    fill: '#374151',
                    fontWeight: 500,
                  }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case 'horizontalBar':
      return (
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 32)}>
          <BarChart 
            data={coloredData} 
            layout="vertical" 
            margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
          >
            <CartesianGrid {...gridStyle} horizontal={false} />
            <XAxis 
              type="number" 
              {...axisStyle}
              tickFormatter={formatValue}
            >
              <Label 
                value={getYAxisLabel(metric)}
                position="bottom"
                style={{ 
                  textAnchor: 'middle',
                  fontSize: '11px',
                  fill: '#6B7280',
                  fontWeight: 500,
                }}
                offset={-5}
              />
            </XAxis>
            <YAxis 
              type="category" 
              dataKey="name" 
              {...axisStyle}
              tick={{ fontSize: 11, fill: '#374151', fontWeight: 500 }}
              width={90}
              tickFormatter={(value) => truncateLabel(String(value), 14)}
            />
            <Tooltip 
              content={<CustomTooltip metric={metric} groupBy={groupBy} />}
              cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
            />
            <Bar 
              dataKey="value" 
              radius={[0, 4, 4, 0]} 
              maxBarSize={28}
            >
              {coloredData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill}
                  style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.05))' }}
                />
              ))}
              {showDataLabels && (
                <LabelList 
                  dataKey="value" 
                  position="right" 
                  formatter={labelFormatter}
                  style={{ 
                    fontSize: 10, 
                    fill: '#374151',
                    fontWeight: 500,
                  }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line':
      return (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart 
            data={coloredData} 
            margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
          >
            <CartesianGrid {...gridStyle} />
            <XAxis 
              dataKey="name"
              {...axisStyle}
              angle={-45} 
              textAnchor="end" 
              height={60}
              tickFormatter={(value) => truncateLabel(String(value), 10)}
              interval={data.length > 20 ? Math.floor(data.length / 12) : 0}
            />
            <YAxis 
              {...axisStyle}
              tickFormatter={formatValue}
              width={55}
            >
              <Label 
                value={getYAxisLabel(metric)}
                angle={-90}
                position="insideLeft"
                style={{ 
                  textAnchor: 'middle',
                  fontSize: '11px',
                  fill: '#6B7280',
                  fontWeight: 500,
                }}
                offset={-5}
              />
            </YAxis>
            <Tooltip 
              content={<CustomTooltip metric={metric} groupBy={groupBy} />}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={CHART_COLOR_PALETTE[0]} 
              strokeWidth={2.5}
              dot={{ 
                fill: '#ffffff', 
                stroke: CHART_COLOR_PALETTE[0], 
                strokeWidth: 2, 
                r: 4 
              }}
              activeDot={{ 
                r: 6, 
                stroke: '#ffffff', 
                strokeWidth: 2,
                fill: CHART_COLOR_PALETTE[0],
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart 
            data={coloredData} 
            margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLOR_PALETTE[0]} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_COLOR_PALETTE[0]} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis 
              dataKey="name"
              {...axisStyle}
              angle={-45} 
              textAnchor="end" 
              height={60}
              tickFormatter={(value) => truncateLabel(String(value), 10)}
              interval={data.length > 20 ? Math.floor(data.length / 12) : 0}
            />
            <YAxis 
              {...axisStyle}
              tickFormatter={formatValue}
              width={55}
            >
              <Label 
                value={getYAxisLabel(metric)}
                angle={-90}
                position="insideLeft"
                style={{ 
                  textAnchor: 'middle',
                  fontSize: '11px',
                  fill: '#6B7280',
                  fontWeight: 500,
                }}
                offset={-5}
              />
            </YAxis>
            <Tooltip 
              content={<CustomTooltip metric={metric} groupBy={groupBy} />}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={CHART_COLOR_PALETTE[0]} 
              fill="url(#areaGradient)"
              strokeWidth={2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={340}>
          <PieChart>
            <Pie
              data={coloredData}
              cx="50%"
              cy="38%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              label={showDataLabels ? renderPieLabel : undefined}
              labelLine={false}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {coloredData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill}
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                />
              ))}
            </Pie>
            <Tooltip 
              content={<CustomTooltip metric={metric} groupBy={groupBy} />}
            />
            <Legend 
              verticalAlign="bottom"
              height={70}
              iconType="circle"
              iconSize={10}
              wrapperStyle={{ 
                paddingTop: '8px',
                paddingBottom: '8px',
              }}
              formatter={(value: string) => (
                <span style={{ 
                  fontSize: '11px', 
                  color: '#374151',
                  fontWeight: 500,
                  marginRight: '8px',
                }}>
                  {truncateLabel(value, 16)}
                </span>
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
