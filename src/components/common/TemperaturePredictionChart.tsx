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
  baselineLST80thPercentile: number; // Still needed for the *old* logic if we switch back, or if new logic might use it
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
  baselineLST80thPercentile, // Keep for now, even if new logic doesn't directly use it
  baselineLST60thPercentile,
  speciesCoolingP90,
  speciesCoolingP10,
  speciesName = "Selected Species"
}) => {
  
  // Baseline LST Data (random oscillation between 60th and Max) - NO CHANGE TO THIS LOGIC
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

  // Generate Simulated Cooled Temperature Data - NEW INTERPOLATION LOGIC
  const simulatedCooledData = useMemo(() => {
    if (!showChart || baselineLSTData.length === 0) return [];

    const tempRangeBaseline = baselineLSTMax - baselineLST60thPercentile;

    return baselineLSTData.map(baseTemp => {
      let coolingEffectToApply = 0;

      if (tempRangeBaseline <= 0) { // Avoid division by zero if max and 60th are same or inverted
        // If no range, or inverted, apply an average or a specific percentile cooling.
        // For simplicity, let's say P10 applies if baseline is at/below 60th, P90 if at/above max.
        // This edge case should ideally not happen if LST_MAX > LST_60TH.
        if (baseTemp >= baselineLSTMax) {
            coolingEffectToApply = speciesCoolingP90;
        } else if (baseTemp <= baselineLST60thPercentile) {
            coolingEffectToApply = speciesCoolingP10;
        } else { // Should not be reached if tempRangeBaseline is 0
            coolingEffectToApply = (speciesCoolingP90 + speciesCoolingP10) / 2;
        }
      } else {
        // Determine how far 'baseTemp' is along the scale from 60th percentile to Max
        // Normalize baseTemp to a 0-1 scale within the [60th_percentile, MaxLST] range
        let proportion = (baseTemp - baselineLST60thPercentile) / tempRangeBaseline;
        
        // Clamp proportion to be between 0 and 1
        proportion = Math.max(0, Math.min(1, proportion));

        // Linearly interpolate the cooling effect:
        // When proportion is 0 (baseTemp is at 60th percentile), cooling = P10_cooling
        // When proportion is 1 (baseTemp is at MaxLST), cooling = P90_cooling
        coolingEffectToApply = speciesCoolingP10 + proportion * (speciesCoolingP90 - speciesCoolingP10);
      }
      
      let cooledTemp = baseTemp - coolingEffectToApply;

      // Safety net: Ensure cooled temperature is not unrealistically low
      // For instance, not lower than the minimum LST value minus the maximum possible cooling.
      // Or ensure it doesn't drop by more than the max cooling effect from its baseline.
      const maxPossibleSingleCooling = Math.max(speciesCoolingP10, speciesCoolingP90);
      // Ensure temp doesn't drop below a certain floor, e.g., 5 degrees below the min LST value,
      // or ensure it does not go below (baselineLST60thPercentile - maxPossibleSingleCooling)
      const realisticFloor = baselineLST60thPercentile - maxPossibleSingleCooling - 2; // Arbitrary floor
      cooledTemp = Math.max(realisticFloor, cooledTemp); 
      
      return parseFloat(cooledTemp.toFixed(1));
    });
  }, [showChart, baselineLSTData, baselineLSTMax, baselineLST60thPercentile, speciesCoolingP90, speciesCoolingP10]);

  if (!showChart) { return null; }

  const chartData = { /* ... (same as before, using new simulatedCooledData) ... */ };
  const chartOptions: ChartOptions<'line'> = { /* ... (same as before) ... */ };
  
  // --- For absolute clarity, re-pasting the chartData and chartOptions that should remain ---
  // --- from the last working version. The only change above is the simulatedCooledData logic. ---
  const actualChartData = {
    labels: Array.from({ length: LST_DATA_POINTS }, (_, i) => `P${i + 1}`),
    datasets: [
      {
        label: 'Baseline LST (°C)', data: baselineLSTData,
        borderColor: 'rgba(239, 68, 68, 0.9)', backgroundColor: 'rgba(254, 202, 202, 0.3)',
        tension: 0.4, fill: false, pointRadius: 2, pointHoverRadius: 4, yAxisID: 'yTemp',
      },
      {
        label: `Cooled LST (${speciesName}) (°C)`, data: simulatedCooledData, // Uses the NEW logic
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
      tooltip: { mode: 'index' as const, animation: {duration: 0}, intersect: false, bodySpacing: 4, itemSort: (a, b) => b.datasetIndex - a.datasetIndex, }
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