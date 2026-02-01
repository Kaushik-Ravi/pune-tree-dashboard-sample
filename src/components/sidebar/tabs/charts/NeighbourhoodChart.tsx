// src/components/sidebar/tabs/charts/NeighbourhoodChart.tsx
// Pie chart for neighbourhood comparison using Recharts (for consistency)

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
    { name: restLabel, value: restValue, fill: '#E0E0E0' },
  ];

  // Format value for display
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  };

  // Calculate percentage
  const percentage = totalValue > 0 ? ((selectedValue / totalValue) * 100).toFixed(1) : 0;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={35}
          outerRadius={60}
          paddingAngle={2}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value) => {
            const numValue = typeof value === 'number' ? value : 0;
            return [`${formatValue(numValue)}${unit}`, 'Value'];
          }}
        />
        <Legend 
          verticalAlign="bottom"
          height={30}
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span className="text-xs text-gray-600">{value}</span>
          )}
        />
        {/* Center text showing percentage */}
        <text
          x="50%"
          y="40%"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-sm font-semibold"
          fill="#374151"
        >
          {percentage}%
        </text>
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-xs"
          fill="#9CA3AF"
        >
          selected
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default NeighbourhoodChart;
