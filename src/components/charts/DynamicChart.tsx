// src/components/charts/DynamicChart.tsx
// Renders a Nivo chart based on config and data
import React from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';



// Use a valid Nivo color scheme (see https://nivo.rocks/guides/colors/)
const nivoScheme = 'nivo' as const;

const DynamicChart: React.FC<{ type: string, data: any, xLabel?: string, yLabel?: string }> = ({ type, data, xLabel, yLabel }) => {
  if (type === 'bar') {
    return <div style={{ height: 350 }}><ResponsiveBar data={data} keys={['value']} indexBy="label" margin={{ top: 30, right: 30, bottom: 60, left: 60 }} colors={{ scheme: nivoScheme }} axisBottom={{ legend: xLabel, legendPosition: 'middle', legendOffset: 40 }} axisLeft={{ legend: yLabel, legendPosition: 'middle', legendOffset: -50 }} /></div>;
  }
  if (type === 'pie') {
    return <div style={{ height: 350 }}><ResponsivePie data={data} margin={{ top: 30, right: 30, bottom: 60, left: 60 }} colors={{ scheme: nivoScheme }} innerRadius={0.5} padAngle={1} cornerRadius={3} /></div>;
  }
  if (type === 'line') {
    return <div style={{ height: 350 }}><ResponsiveLine data={[{ id: yLabel || 'Value', data: data.map((d: any) => ({ x: d.label, y: d.value })) }]} margin={{ top: 30, right: 30, bottom: 60, left: 60 }} colors={{ scheme: nivoScheme }} xScale={{ type: 'point' }} yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }} axisBottom={{ legend: xLabel, legendPosition: 'middle', legendOffset: 40 }} axisLeft={{ legend: yLabel, legendPosition: 'middle', legendOffset: -50 }} /></div>;
  }
  if (type === 'scatter') {
    return <div style={{ height: 350 }}><ResponsiveScatterPlot data={data} margin={{ top: 30, right: 30, bottom: 60, left: 60 }} colors={{ scheme: nivoScheme }} xScale={{ type: 'linear', min: 'auto', max: 'auto' }} yScale={{ type: 'linear', min: 'auto', max: 'auto' }} axisBottom={{ legend: xLabel, legendPosition: 'middle', legendOffset: 40 }} axisLeft={{ legend: yLabel, legendPosition: 'middle', legendOffset: -50 }} /></div>;
  }
  return <div>Unsupported chart type</div>;
};

export default DynamicChart;
