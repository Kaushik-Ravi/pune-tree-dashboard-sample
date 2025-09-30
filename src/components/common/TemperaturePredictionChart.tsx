// src/components/common/TemperaturePredictionChart.tsx
import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';
import { X as CloseIcon } from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

interface TemperaturePredictionChartProps {
  showChart: boolean;
  onClose: () => void; 
  baselineLSTMax: number;
  baselineLST80thPercentile: number;
  baselineLST60thPercentile: number;
  speciesCoolingP90: number; 
  speciesCoolingP10: number; 
  speciesName?: string; 
}

const LST_DATA_POINTS = 20; 

const TemperaturePredictionChart: React.FC<TemperaturePredictionChartProps> = ({ 
  showChart,
  onClose,
  baselineLSTMax,
  baselineLST80thPercentile,
  baselineLST60thPercentile,
  speciesCoolingP90,
  speciesCoolingP10,
  speciesName = "Selected Species"
}) => {
  
  const baselineLSTData = useMemo(() => {
    if (!showChart) return [];
    const data = [];
    const lowerBound = Math.min(baselineLST60thPercentile, baselineLSTMax);
    const upperBound = Math.max(baselineLST60thPercentile, baselineLSTMax);
    for (let i = 0; i < LST_DATA_POINTS; i++) {
      let randomFactor = 0.5 + (Math.sin(i * Math.PI / (LST_DATA_POINTS / 2))) * 0.3 + (Math.random() - 0.5) * 0.2;
      randomFactor = Math.max(0, Math.min(1, randomFactor));
      const temp = lowerBound + (randomFactor * (upperBound - lowerBound));
      data.push(parseFloat(temp.toFixed(1)));
    }
    return data;
  }, [showChart, baselineLSTMax, baselineLST60thPercentile]);

  const simulatedCooledData = useMemo(() => {
    if (!showChart || baselineLSTData.length === 0) return [];

    const tempRangeBaseline = baselineLSTMax - baselineLST60thPercentile;

    return baselineLSTData.map(baseTemp => {
      let coolingEffectToApply = 0;

      if (tempRangeBaseline <= 0) {
        if (baseTemp >= baselineLSTMax) {
            coolingEffectToApply = speciesCoolingP90;
        } else if (baseTemp <= baselineLST60thPercentile) {
            coolingEffectToApply = speciesCoolingP10;
        } else {
            coolingEffectToApply = (speciesCoolingP90 + speciesCoolingP10) / 2;
        }
      } else {
        let proportion = (baseTemp - baselineLST60thPercentile) / tempRangeBaseline;
        proportion = Math.max(0, Math.min(1, proportion));
        coolingEffectToApply = speciesCoolingP10 + proportion * (speciesCoolingP90 - speciesCoolingP10);
      }
      
      let cooledTemp = baseTemp - coolingEffectToApply;
      const maxPossibleSingleCooling = Math.max(speciesCoolingP10, speciesCoolingP90);
      const realisticFloor = baselineLST60thPercentile - maxPossibleSingleCooling - 2;
      cooledTemp = Math.max(realisticFloor, cooledTemp); 
      
      return parseFloat(cooledTemp.toFixed(1));
    });
  }, [showChart, baselineLSTData, baselineLSTMax, baselineLST60thPercentile, speciesCoolingP90, speciesCoolingP10]);

  if (!showChart) { return null; }
  
  const actualChartData = {
    labels: Array.from({ length: LST_DATA_POINTS }, (_, i) => `P${i + 1}`),
    datasets: [
      {
        label: 'Baseline LST (°C)', data: baselineLSTData,
        borderColor: 'rgba(239, 68, 68, 0.9)', backgroundColor: 'rgba(254, 202, 202, 0.3)',
        tension: 0.4, fill: false, pointRadius: 2, pointHoverRadius: 4, yAxisID: 'yTemp',
      },
      {
        label: `Cooled LST (${speciesName}) (°C)`, data: simulatedCooledData,
        borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(191, 219, 254, 0.4)',
        tension: 0.4, fill: true, pointRadius: 2, pointHoverRadius: 4, yAxisID: 'yTemp',
      }
    ],
  };

  const actualChartOptions: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false, },
    plugins: {
      legend: { position: 'top' as const, labels: { boxWidth: 12, padding:10, font: { size: 11 } } },
      title: { display: false, },
      tooltip: { 
        mode: 'index' as const, 
        animation: {duration: 0}, 
        intersect: false, 
        bodySpacing: 4, 
        itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
        titleFont: { size: 12 },
        bodyFont: { size: 12 },
        padding: 8,
      }
    },
    scales: {
      yTemp: { 
        min: Math.floor(baselineLST60thPercentile - Math.max(speciesCoolingP10, speciesCoolingP90) - 3), 
        max: Math.ceil(baselineLSTMax + 3),  
        title: { display: true, text: 'Temperature (°C)', font: {size: 10} },
        ticks: { font: {size: 9}}
      },
      x: {
        title: { display: true, text: 'Transect Points / Spatial Profile', font: {size: 10} },
        ticks: { font: {size: 9}, autoSkip: true, maxTicksLimit: 10 }
      },
    },
  };

  return (
    <div className="p-3 bg-white rounded-t-lg">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold text-gray-700 pl-1">Predicted LST Change Profile</h4>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400" aria-label="Close temperature chart" title="Close chart">
          <CloseIcon size={20} />
        </button>
      </div>
      <div style={{ height: '200px' }}> 
        <Line data={actualChartData} options={actualChartOptions} />
      </div>
    </div>
  );
};

export default TemperaturePredictionChart;