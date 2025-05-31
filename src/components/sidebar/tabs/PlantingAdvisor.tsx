import React, { useState, useEffect } from 'react';
import { TreeDeciduous, AreaChart, Thermometer, ScissorsSquare, Map, XCircle } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useTreeStore } from '../../../store/TreeStore';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TreeArchetype {
  Archetype_Display_Name: string;
  Archetype_Dropdown_Name: string;
  Season: string;
  botanical_name_short: string;
  common_name: string;
  CoolEff_P90NV_mean: number;
  CoolEff_P90NV_std: number;
  HeatRelief_P10NV_Abs_mean: number;
  HeatRelief_P10NV_Abs_std: number;
  CoolEff_MaxNV_mean: number;
  CoolEff_MaxNV_std: number;
  HeatRelief_MinNV_Abs_mean: number;
  HeatRelief_MinNV_Abs_std: number;
  height_m_min_range: number;
  height_m_max_range: number;
  CO2_Seq_Min_kg: number;
  CO2_Seq_Max_kg: number;
  wood_density: number;
}

const PlantingAdvisor: React.FC = () => {
  const { treeArchetypes, fetchTreeArchetypes } = useTreeStore();
  
  const [selectedSeason, setSelectedSeason] = useState<string>('Summer');
  const [selectedArchetype, setSelectedArchetype] = useState<string>('');
  const [filteredArchetypes, setFilteredArchetypes] = useState<TreeArchetype[]>([]);
  const [topPerformers, setTopPerformers] = useState<TreeArchetype[]>([]);
  const [selectedArchetypeData, setSelectedArchetypeData] = useState<TreeArchetype | null>(null);
  const [topArchetypeData, setTopArchetypeData] = useState<TreeArchetype | null>(null);
  const [bufferDistance, setBufferDistance] = useState<number>(3);
  const [areaSelected, setAreaSelected] = useState<boolean>(false);
  const [showPlanting, setShowPlanting] = useState<boolean>(false);
  const [showCooling, setShowCooling] = useState<boolean>(false);
  const [treeCount, setTreeCount] = useState<number>(0);
  const [areaSize, setAreaSize] = useState<number>(0);
  
  useEffect(() => {
    fetchTreeArchetypes();
  }, [fetchTreeArchetypes]);

  useEffect(() => {
    // Filter archetypes by selected season
    const filtered = treeArchetypes.filter(arch => arch.Season === selectedSeason);
    setFilteredArchetypes(filtered);
    
    // Get top 5 performers by cooling potential
    const sorted = [...filtered].sort((a, b) => b.CoolEff_P90NV_mean - a.CoolEff_P90NV_mean);
    setTopPerformers(sorted.slice(0, 5));
    
    if (sorted.length > 0) {
      setTopArchetypeData(sorted[0]);
    }
  }, [treeArchetypes, selectedSeason]);

  const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSeason(e.target.value);
    setSelectedArchetype('');
    setSelectedArchetypeData(null);
    setShowPlanting(false);
    setShowCooling(false);
  };

  const handleArchetypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setSelectedArchetype(selected);
    
    const archetype = filteredArchetypes.find(arch => arch.Archetype_Dropdown_Name === selected);
    if (archetype) {
      setSelectedArchetypeData(archetype);
    }
    
    setShowPlanting(false);
    setShowCooling(false);
  };

  const activateAreaSelection = () => {
    // This would trigger the map selection tool
    // In a real implementation, this would communicate with the map component
    setAreaSelected(true);
    setAreaSize(8000); // Mock area size in square meters
  };

  const clearAreaSelection = () => {
    setAreaSelected(false);
    setShowPlanting(false);
    setShowCooling(false);
  };

  const resetAdvisor = () => {
    setSelectedArchetype('');
    setSelectedArchetypeData(null);
    setAreaSelected(false);
    setShowPlanting(false);
    setShowCooling(false);
  };

  const visualizePlanting = () => {
    if (!selectedArchetypeData || !areaSelected) return;
    
    // In a real implementation, this would calculate based on the actual area and archetype
    // Simple calculation for demonstration
    const canopyDiameter = 5; // Mock canopy diameter in meters
    const spacing = canopyDiameter + 1; // Add 1m buffer
    
    // Simple calculation of trees that would fit in a grid
    const areaSqrt = Math.sqrt(areaSize);
    const bufferedAreaSqrt = areaSqrt - (bufferDistance * 2);
    const treesPerRow = Math.floor(bufferedAreaSqrt / spacing);
    const rows = Math.floor(bufferedAreaSqrt / spacing);
    const calculatedTreeCount = treesPerRow * rows;
    
    setTreeCount(calculatedTreeCount);
    setShowPlanting(true);
    setShowCooling(false);
  };

  const simulateCooling = () => {
    setShowCooling(true);
  };

  const clearPlantingVisualisation = () => {
    setShowPlanting(false);
  };

  const clearCoolingSimulation = () => {
    setShowCooling(false);
  };

  // Bar chart for comparing cooling metrics
  const coolingComparisonData = selectedArchetypeData && topArchetypeData ? {
    labels: ['High Cooling Potential (P90)', 'Significant Heat Relief (P10)'],
    datasets: [
      {
        label: selectedArchetypeData.botanical_name_short,
        data: [
          selectedArchetypeData.CoolEff_P90NV_mean,
          selectedArchetypeData.HeatRelief_P10NV_Abs_mean
        ],
        backgroundColor: 'rgba(46, 125, 50, 0.7)',
      },
      {
        label: `${topArchetypeData.botanical_name_short} (Top Ranked)`,
        data: [
          topArchetypeData.CoolEff_P90NV_mean,
          topArchetypeData.HeatRelief_P10NV_Abs_mean
        ],
        backgroundColor: 'rgba(25, 118, 210, 0.7)',
      }
    ]
  } : null;

  const coolingComparisonOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.raw.toFixed(2)}°C`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Temperature Difference (°C)'
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium">Planting Advisor Tool</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-gray-600 mb-4">
            Use this tool to plan tree planting in specific areas of Pune. Follow these steps:
          </p>
          <ol className="list-decimal pl-5 text-sm text-gray-600 mb-4 space-y-1">
            <li>Define your planting area on the map</li>
            <li>Select a target season for optimization</li>
            <li>Choose a tree species and archetype</li>
            <li>Get insights on cooling potential and planting layout</li>
          </ol>
          
          <button 
            className="btn btn-primary flex items-center"
            onClick={activateAreaSelection}
            disabled={areaSelected}
          >
            <ScissorsSquare size={18} className="mr-2" />
            Define Planting Area
          </button>
          
          {areaSelected && (
            <div className="mt-3 p-3 bg-green-50 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-gray-500">Selected Area Size</span>
                  <div className="font-semibold">{areaSize.toLocaleString()} m²</div>
                </div>
                <button 
                  className="text-gray-500 hover:text-red-500"
                  onClick={clearAreaSelection}
                  title="Clear selection"
                >
                  <XCircle size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {areaSelected && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-medium">Planning Parameters</h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Season
              </label>
              <select 
                className="input"
                value={selectedSeason}
                onChange={handleSeasonChange}
              >
                <option value="Summer">Summer</option>
                <option value="Monsoon">Monsoon</option>
                <option value="Post-Monsoon">Post-Monsoon</option>
                <option value="Winter">Winter</option>
                <option value="All Seasons">All Seasons</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tree Species & Archetype
              </label>
              <select 
                className="input"
                value={selectedArchetype}
                onChange={handleArchetypeChange}
                disabled={filteredArchetypes.length === 0}
              >
                <option value="">Select an archetype...</option>
                {filteredArchetypes.map((arch, index) => (
                  <option key={index} value={arch.Archetype_Dropdown_Name}>
                    {arch.Archetype_Dropdown_Name}
                  </option>
                ))}
              </select>
            </div>
            
            <button 
              className="btn btn-secondary w-full"
              disabled={!selectedArchetype}
              onClick={() => {
                // This button would trigger more detailed analysis in a real implementation
              }}
            >
              Get Planting Insights
            </button>
          </div>
        </div>
      )}

      {/* Top performing archetypes */}
      {areaSelected && topPerformers.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-medium flex items-center">
              <AreaChart size={18} className="mr-2 text-gray-500" />
              Top Performing Archetypes for {selectedSeason}
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {topPerformers.map((arch, index) => (
                <div 
                  key={index}
                  className={`p-2 rounded-md cursor-pointer ${
                    selectedArchetype === arch.Archetype_Dropdown_Name 
                      ? 'bg-primary-50 border border-primary-200' 
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  onClick={() => {
                    setSelectedArchetype(arch.Archetype_Dropdown_Name);
                    setSelectedArchetypeData(arch);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{arch.botanical_name_short}</div>
                      <div className="text-xs text-gray-500">{arch.Archetype_Dropdown_Name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-primary-600">
                        {arch.CoolEff_P90NV_mean.toFixed(2)}°C
                      </div>
                      <div className="text-xs text-gray-500">P90 Cooling</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected archetype details */}
      {selectedArchetypeData && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-medium flex items-center">
              <TreeDeciduous size={18} className="mr-2 text-gray-500" />
              Archetype Details
            </h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <h4 className="font-medium text-primary-700">{selectedArchetypeData.botanical_name_short}</h4>
              <div className="text-sm text-gray-600">{selectedArchetypeData.common_name}</div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Height</div>
                <div>
                  {selectedArchetypeData.height_m_min_range.toFixed(2)}-{selectedArchetypeData.height_m_max_range.toFixed(2)}m
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">CO₂ Seq.</div>
                <div>
                  {selectedArchetypeData.CO2_Seq_Min_kg.toFixed(2)}-{selectedArchetypeData.CO2_Seq_Max_kg.toFixed(2)}kg
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Wood Density</div>
                <div>{selectedArchetypeData.wood_density.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-md">
              <h4 className="font-medium text-blue-700 mb-2 flex items-center">
                <Thermometer size={16} className="mr-1" />
                Cooling Performance
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <div className="text-gray-600">High Cooling Potential (P90)</div>
                  <div className="font-medium">
                    {selectedArchetypeData.CoolEff_P90NV_mean.toFixed(2)} ± {selectedArchetypeData.CoolEff_P90NV_std.toFixed(2)}°C
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Significant Heat Relief (P10)</div>
                  <div className="font-medium">
                    {selectedArchetypeData.HeatRelief_P10NV_Abs_mean.toFixed(2)} ± {selectedArchetypeData.HeatRelief_P10NV_Abs_std.toFixed(2)}°C
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Peak Cooling (MaxNV)</div>
                  <div className="font-medium">
                    {selectedArchetypeData.CoolEff_MaxNV_mean.toFixed(2)} ± {selectedArchetypeData.CoolEff_MaxNV_std.toFixed(2)}°C
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Peak Heat Relief (MinNV)</div>
                  <div className="font-medium">
                    {selectedArchetypeData.HeatRelief_MinNV_Abs_mean.toFixed(2)} ± {selectedArchetypeData.HeatRelief_MinNV_Abs_std.toFixed(2)}°C
                  </div>
                </div>
              </div>
            </div>
            
            {/* Comparative cooling chart */}
            {coolingComparisonData && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Cooling Comparison</h4>
                <div style={{ height: '200px' }}>
                  <Bar 
                    data={coolingComparisonData} 
                    options={coolingComparisonOptions} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spatial planting layout tool */}
      {selectedArchetypeData && areaSelected && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-medium flex items-center">
              <Map size={18} className="mr-2 text-gray-500" />
              Spatial Planting Layout
            </h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buffer from edge (meters)
              </label>
              <input 
                type="number" 
                className="input"
                value={bufferDistance}
                min={1}
                max={10}
                onChange={(e) => setBufferDistance(Number(e.target.value))}
              />
            </div>
            
            <div>
              <div className="text-sm text-gray-500 mb-1">
                Tree Spacing (based on max canopy diameter)
              </div>
              <div className="font-medium">
                6.0 meters
              </div>
            </div>
            
            {!showPlanting ? (
              <button 
                className="btn btn-primary w-full"
                onClick={visualizePlanting}
              >
                Visualize Planting on Map
              </button>
            ) : (
              <>
                <div className="p-3 bg-primary-50 rounded-md">
                  <div className="font-medium text-primary-800">
                    Number of Trees that Fit: {treeCount}
                  </div>
                </div>
                
                <button 
                  className="btn btn-outline w-full"
                  onClick={clearPlantingVisualisation}
                >
                  Clear Planting Visualisation
                </button>
                
                {!showCooling ? (
                  <button 
                    className="btn btn-secondary w-full"
                    onClick={simulateCooling}
                  >
                    Simulate Cooling Impact
                  </button>
                ) : (
                  <button 
                    className="btn btn-outline w-full"
                    onClick={clearCoolingSimulation}
                  >
                    Clear Cooling Simulation
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Reset button */}
      {(selectedArchetype || areaSelected) && (
        <div className="text-center">
          <button 
            className="btn btn-outline"
            onClick={resetAdvisor}
          >
            Reset Planting Advisor
          </button>
        </div>
      )}
    </div>
  );
};

export default PlantingAdvisor;