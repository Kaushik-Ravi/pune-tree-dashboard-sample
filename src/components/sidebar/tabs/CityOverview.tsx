import React, { useState, useEffect } from 'react';
import { Info, ScissorsSquare, XCircle } from 'lucide-react';
import { Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import { useTreeStore } from '../../../store/TreeStore';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const CityOverview: React.FC = () => {
  const { 
    cityStats, 
    fetchCityStats,
    wardCO2Data,
    fetchWardCO2Data,
    selectedArea,
    setSelectedArea
  } = useTreeStore();
  
  const [selectionActive, setSelectionActive] = useState(false);
  const [areaStats, setAreaStats] = useState<{
    size: number;
    treeCount: number;
    totalCO2: number;
  } | null>(null);

  useEffect(() => {
    fetchCityStats();
    fetchWardCO2Data();
  }, [fetchCityStats, fetchWardCO2Data]);

  const activateAreaSelection = () => {
    // This would trigger the map selection tool
    setSelectionActive(true);
    // In a real implementation, this would communicate with the map component
  };

  const clearSelection = () => {
    setSelectionActive(false);
    setSelectedArea(null);
    setAreaStats(null);
  };

  // Mock function to simulate area statistics calculation
  useEffect(() => {
    if (selectedArea) {
      // In a real implementation, this would calculate based on the actual selection
      setAreaStats({
        size: 120000, // 120,000 sq meters
        treeCount: Math.floor(cityStats.total_trees * 0.08), // 8% of total trees
        totalCO2: cityStats.total_co2_annual_kg * 0.07 / 1000 // 7% of total CO2, converted to tons
      });
    }
  }, [selectedArea, cityStats]);

  // Line chart data for ward CO2 sequestration
  const lineChartData = {
    labels: wardCO2Data.map(ward => `Ward ${ward.ward}`),
    datasets: [
      {
        label: 'CO₂ Sequestered (tons)',
        data: wardCO2Data.map(ward => ward.co2_kg / 1000), // Convert kg to tons
        fill: true,
        backgroundColor: 'rgba(46, 125, 50, 0.2)',
        borderColor: 'rgba(46, 125, 50, 1)',
        tension: 0.4
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `CO₂: ${context.raw.toFixed(2)} tons`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'CO₂ Sequestered (tons)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Ward'
        }
      }
    }
  };

  // Pie chart data for tree comparison
  const treePieData = areaStats ? {
    labels: ['Selected Area', 'Rest of Pune'],
    datasets: [
      {
        data: [areaStats.treeCount, cityStats.total_trees - areaStats.treeCount],
        backgroundColor: ['#2E7D32', '#90CAF9'],
        borderColor: ['#1B5E20', '#1976D2'],
        borderWidth: 1
      }
    ]
  } : null;

  // Pie chart data for CO2 comparison
  const co2PieData = areaStats ? {
    labels: ['Selected Area', 'Rest of Pune'],
    datasets: [
      {
        data: [areaStats.totalCO2, cityStats.total_co2_annual_kg / 1000 - areaStats.totalCO2],
        backgroundColor: ['#FF8F00', '#FFE082'],
        borderColor: ['#E65100', '#FFC107'],
        borderWidth: 1
      }
    ]
  } : null;

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.raw;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${value.toFixed(2)} (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium">Dashboard Metrics</h3>
        </div>
        <div className="card-body grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <span className="text-sm text-gray-500">Total Trees</span>
            <div className="text-2xl font-bold text-primary-600">
              {selectionActive && areaStats 
                ? areaStats.treeCount.toLocaleString() 
                : cityStats.total_trees.toLocaleString()}
            </div>
            {selectionActive && areaStats && (
              <div className="text-xs text-gray-500">
                in selected area
              </div>
            )}
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            <span className="text-sm text-gray-500">Total CO₂ Sequestered</span>
            <div className="text-2xl font-bold text-accent-600">
              {selectionActive && areaStats 
                ? `${areaStats.totalCO2.toFixed(2)}` 
                : `${(cityStats.total_co2_annual_kg / 1000).toFixed(2)}`}
              <span className="text-sm font-normal"> tons</span>
            </div>
            {selectionActive && areaStats && (
              <div className="text-xs text-gray-500">
                in selected area
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium">CO₂ Sequestration by Ward</h3>
        </div>
        <div className="card-body">
          <div style={{ height: '250px' }}>
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3 className="text-lg font-medium">Know Your Neighbourhood</h3>
          <button 
            className="text-gray-500 hover:text-primary-600"
            title="How to use this feature"
          >
            <Info size={18} />
          </button>
        </div>
        <div className="card-body">
          {!selectionActive ? (
            <div className="text-center py-4">
              <button 
                className="btn btn-primary flex items-center mx-auto"
                onClick={activateAreaSelection}
              >
                <ScissorsSquare size={18} className="mr-2" />
                Snip Out Your Neighbourhood
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Draw a rectangle on the map to analyze a specific area
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {areaStats && (
                <>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <span className="text-sm text-gray-500">Selected Area Size</span>
                    <div className="text-xl font-semibold">
                      {(areaStats.size).toLocaleString()} m²
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="card">
                      <div className="card-header">
                        <h4 className="text-sm font-medium">Tree Count</h4>
                      </div>
                      <div className="card-body" style={{ height: '180px' }}>
                        {treePieData && <Pie data={treePieData} options={pieChartOptions} />}
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-header">
                        <h4 className="text-sm font-medium">CO₂ Sequestered</h4>
                      </div>
                      <div className="card-body" style={{ height: '180px' }}>
                        {co2PieData && <Pie data={co2PieData} options={pieChartOptions} />}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <button 
                      className="btn btn-outline flex items-center mx-auto"
                      onClick={clearSelection}
                    >
                      <XCircle size={18} className="mr-2" />
                      Clear Selection
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CityOverview;