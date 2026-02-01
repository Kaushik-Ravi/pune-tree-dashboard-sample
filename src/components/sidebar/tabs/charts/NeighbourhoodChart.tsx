// src/components/sidebar/tabs/charts/NeighbourhoodChart.tsx
// Enterprise-grade donut chart for neighbourhood comparison using Recharts
// Follows IBM Carbon Design System guidelines for circular charts

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface NeighbourhoodChartProps {
  selectedValue: number;
  totalValue: number;
  selectedLabel: string;
  restLabel: string;
  selectedColor: string;
  unit?: string;
}

const NeighbourhoodChart: React.FC<NeighbourhoodChartProps> = ({
  selectedValue,
  totalValue,
  selectedLabel,
  restLabel,
  selectedColor,
  unit = '',
}) => {
  const restValue = Math.max(0, totalValue - selectedValue);
  
  const data = [
    { name: selectedLabel, value: selectedValue, fill: selectedColor },
    { name: restLabel, value: restValue, fill: '#E5E7EB' },
  ];

  // Format value for display - handles large numbers gracefully
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  };

  // Calculate percentage with proper handling
  const percentage = totalValue > 0 ? ((selectedValue / totalValue) * 100) : 0;
  const percentageDisplay = percentage >= 10 ? percentage.toFixed(0) : percentage.toFixed(1);

  // Custom center label component for better SVG text rendering
  const CenterLabel = () => (
    <g>
      {/* Percentage - primary KPI */}
      <text
        x="50%"
        y="42%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: '18px',
          fontWeight: 600,
          fill: '#111827',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {percentageDisplay}%
      </text>
      {/* Descriptor label */}
      <text
        x="50%"
        y="56%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: '10px',
          fontWeight: 400,
          fill: '#6B7280',
          fontFamily: 'Inter, system-ui, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        selected
      </text>
    </g>
  );

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={38}
          outerRadius={58}
          paddingAngle={3}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.fill}
              style={{ filter: index === 0 ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' : 'none' }}
            />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value) => {
            const numValue = typeof value === 'number' ? value : 0;
            return [`${formatValue(numValue)}${unit}`, ''];
          }}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            padding: '8px 12px',
          }}
          itemStyle={{
            color: '#374151',
            fontSize: '13px',
            fontWeight: 500,
          }}
          labelStyle={{
            color: '#6B7280',
            fontSize: '11px',
            marginBottom: '4px',
          }}
        />
        {/* Center KPI display */}
        <CenterLabel />
        <Legend 
          verticalAlign="bottom"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{
            paddingTop: '8px',
          }}
          formatter={(value: string) => (
            <span style={{ 
              fontSize: '11px', 
              color: '#4B5563',
              fontWeight: 500,
            }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default NeighbourhoodChart;
