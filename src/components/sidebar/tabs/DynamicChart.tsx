import React, { useRef } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';
import Papa from 'papaparse';
import htmlToImage from 'html-to-image';

// Helper: compute linear regression (least squares) and R²
function computeRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = meanY - slope * meanX;
  // R²
  let ssTot = 0, ssRes = 0;
  for (const p of points) {
    const yPred = slope * p.x + intercept;
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - yPred) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

const DynamicChart: React.FC<{ config: any; data: any[] }> = ({ config, data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Export as PNG
  const handleExportPNG = async () => {
    if (chartRef.current) {
      const dataUrl = await htmlToImage.toPng(chartRef.current, { backgroundColor: 'white' });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'chart.png';
      link.click();
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chart.csv';
    link.click();
    URL.revokeObjectURL(url);
  };


  let chartElem = null;
  let scatterR2: number | null = null;
  // Scatter plot enhancements
  if (config.chartType === 'scatter' && Array.isArray(data) && data.length > 0 && data[0].data) {
    // Nivo expects: [{ id, data: [{ x, y }, ...] }]
    const points = data[0].data.filter((d: any) => typeof d.x === 'number' && typeof d.y === 'number');
    let regression: { slope: number; intercept: number; r2: number } | null = null;
    if (points.length >= 2) {
      regression = computeRegression(points);
    }
    scatterR2 = regression ? regression.r2 : null;
    // Overlay regression line as a separate series
    let regressionSeries: { id: string; data: { x: number; y: number }[] }[] = [];
    if (regression) {
      // Get min/max x for line endpoints
      const xs = points.map((p: any) => p.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      regressionSeries = [{
        id: 'Correlation',
        data: [
          { x: minX, y: regression.slope * minX + regression.intercept },
          { x: maxX, y: regression.slope * maxX + regression.intercept },
        ],
      }];
    }
    chartElem = (
      <ResponsiveScatterPlot
        data={regression && regressionSeries.length > 0 ? [data[0], ...regressionSeries] : data}
        margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
        xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        axisBottom={{ legend: config.xLabel || 'X', legendPosition: 'middle', legendOffset: 40 }}
        axisLeft={{ legend: config.yLabel || 'Y', legendPosition: 'middle', legendOffset: -40 }}
        colors={({ serieId }) => serieId === 'Correlation' ? '#EF4444' : '#3b82f6'}
        nodeSize={8}
        legends={[]}
        enableGridX={true}
        enableGridY={true}
        // Style regression line
        layers={['grid', 'axes', 'nodes', 'markers', 'mesh', 'legends',
          (props: any) => {
            // Custom layer: highlight regression line
            if (!regression || regressionSeries.length === 0) return null;
            const { xScale, yScale } = props;
            const [p1, p2] = regressionSeries[0].data;
            return (
              <g>
                <line
                  x1={xScale(p1.x)}
                  y1={yScale(p1.y)}
                  x2={xScale(p2.x)}
                  y2={yScale(p2.y)}
                  stroke="#EF4444"
                  strokeWidth={3}
                  strokeDasharray="6 4"
                />
              </g>
            );
          }
        ]}
      />
    );
  } else if (config.chartType === 'bar' || config.preset === 'trees_by_ward' || config.preset === 'co2_by_ward') {
    // Support horizontal/vertical bar, dynamic axis labels, responsive padding
    const isHorizontal = config.orientation === 'horizontal';
    chartElem = (
      <ResponsiveBar
        data={data}
        keys={['value']}
        indexBy="label"
        margin={isHorizontal ? { top: 30, right: 100, bottom: 30, left: 100 } : { top: 30, right: 30, bottom: 60, left: 60 }}
        padding={0.25}
        layout={isHorizontal ? 'horizontal' : 'vertical'}
        colors={{ scheme: 'nivo' }}
        axisBottom={isHorizontal ? null : { tickRotation: 45, legend: config.xLabel || 'Category', legendPosition: 'middle', legendOffset: 40 }}
        axisLeft={isHorizontal ? { legend: config.metric || 'Value', legendPosition: 'middle', legendOffset: -60 } : { legend: config.metric || 'Value', legendPosition: 'middle', legendOffset: -40 }}
        enableLabel={false}
        labelSkipWidth={16}
        labelSkipHeight={16}
        borderRadius={3}
        borderWidth={1}
        borderColor={{ from: 'color', modifiers: [['darker', 1.2]] }}
        theme={{
          axis: { legend: { text: { fontSize: 14, fontWeight: 600 } } },
        }}
      />
    );
  } else if (config.chartType === 'pie' || config.preset === 'by_purpose' || config.preset === 'street_vs_nonstreet' || config.preset === 'flowering_status') {
    chartElem = (
      <ResponsivePie
        data={data}
        margin={{ top: 30, right: 30, bottom: 30, left: 30 }}
        innerRadius={0.5}
        padAngle={1.5}
        cornerRadius={4}
        colors={{ scheme: 'nivo' }}
        borderWidth={1}
        borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
        enableArcLabels={true}
        arcLinkLabelsSkipAngle={10}
        arcLinkLabelsTextColor="#374151"
        arcLinkLabelsThickness={2}
        arcLinkLabelsColor={{ from: 'color' }}
        arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
        legends={[
          {
            anchor: 'bottom',
            direction: 'row',
            justify: false,
            translateY: 36,
            itemWidth: 80,
            itemHeight: 18,
            itemsSpacing: 8,
            symbolSize: 14,
            symbolShape: 'circle',
            effects: [
              {
                on: 'hover',
                style: {
                  itemTextColor: '#000',
                },
              },
            ],
          },
        ]}
      />
    );
  } else if (config.chartType === 'line') {
    // Area/line toggle, point size, color polish
    const showArea = !!config.showArea;
    chartElem = (
      <ResponsiveLine
        data={data}
        margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
        axisBottom={{ tickRotation: 45, legend: config.xLabel || 'Category', legendPosition: 'middle', legendOffset: 40 }}
        axisLeft={{ legend: config.metric || 'Value', legendPosition: 'middle', legendOffset: -40 }}
        colors={{ scheme: 'nivo' }}
        enablePoints={true}
        pointSize={8}
        pointColor={{ theme: 'background' }}
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        enableArea={showArea}
        areaOpacity={0.15}
        useMesh={true}
        theme={{
          axis: { legend: { text: { fontSize: 14, fontWeight: 600 } } },
        }}
      />
    );
  } else {
    chartElem = <div className="text-gray-400">Chart type not implemented yet.</div>;
  }

  return (
    <div className="relative w-full">
      <div
        className="absolute right-0 top-0 flex gap-2 z-10 p-2"
        style={{ flexDirection: 'row', flexWrap: 'wrap' }}
        aria-label="Chart export controls"
      >
        <button
          onClick={handleExportPNG}
          className="px-3 py-2 text-xs bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[90px] mb-1 md:mb-0"
          aria-label="Export chart as PNG"
          tabIndex={0}
        >
          Export PNG
        </button>
        <button
          onClick={handleExportCSV}
          className="px-3 py-2 text-xs bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[90px] mb-1 md:mb-0"
          aria-label="Export chart as CSV"
          tabIndex={0}
        >
          Export CSV
        </button>
      </div>
      {/* Usage hints and documentation */}
      <div className="absolute left-4 top-2 z-10 max-w-[60%]">
        <div className="text-xs bg-white/90 px-2 py-1 rounded shadow text-gray-700 mb-1">
          <span className="font-semibold">Chart Tips:</span> Use the filter controls above to customize your chart. Export as PNG or CSV using the buttons at top right. For scatter plots, a red dashed line shows the best-fit correlation, with R² displayed here.
        </div>
        {/* Show R² for scatter plots if available */}
        {scatterR2 !== null && (
          <div className="text-xs bg-white/80 px-2 py-1 rounded shadow text-rose-700 font-semibold mt-1">
            R² = {scatterR2.toFixed(3)}
          </div>
        )}
      </div>
      <div
        ref={chartRef}
        style={{ height: 400, minWidth: 300, maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        role="region"
        aria-label="Data chart area"
        tabIndex={0}
        className="w-full"
      >
        {chartElem}
      </div>
      {/* Responsive tweaks: stack buttons on mobile */}
      <style>{`
        @media (max-width: 640px) {
          .z-10.flex {
            flex-direction: column !important;
            align-items: flex-end !important;
            gap: 0.5rem !important;
          }
          .min-w-[90px] {
            min-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DynamicChart;
