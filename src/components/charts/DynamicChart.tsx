// src/components/charts/DynamicChart.tsx
// Renders a Nivo chart based on config and data
import React from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

// ...existing code for helpers, export, etc. will be added as we wire up the API and data

interface DynamicChartProps {
  config: any;
  data: any;
}

const DynamicChart: React.FC<DynamicChartProps> = ({ config, data }) => {
  // This is a stub. We'll expand this to handle all chart types and export options.
  if (config.type === 'bar') {
    return <div style={{ height: 400 }}><ResponsiveBar data={data} keys={[config.metric]} indexBy={config.groupBy} /></div>;
  }
  if (config.type === 'pie') {
    return <div style={{ height: 400 }}><ResponsivePie data={data} id={config.groupBy} value={config.metric} /></div>;
  }
  if (config.type === 'line') {
    return <div style={{ height: 400 }}><ResponsiveLine data={data} xScale={{ type: 'point' }} yScale={{ type: 'linear' }} /></div>;
  }
  if (config.type === 'scatter') {
    return <div style={{ height: 400 }}><ResponsiveScatterPlot data={data} /></div>;
  }
  // ...other chart types
  return <div>Unsupported chart type</div>;
};

export default DynamicChart;
