// src/components/sidebar/tabs/PlantingAdvisor.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { TreeDeciduous, Thermometer, Scaling, Bot, MapPin, PlayCircle, XCircle, CheckCircle } from 'lucide-react';
import { useTreeStore, TreeSpeciesData, ArchetypeData } from '../../../store/TreeStore';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

// The generateTreeCentersJS helper function remains unchanged and is included here for completeness.
const generateTreeCentersJS = (
  polygonFeature: Feature<Polygon | MultiPolygon>,
  canopyDiameterMeters: number,
  boundaryBufferMeters: number,
  treeSpacingBufferMeters: number
): [number, number][] => {
  if (!polygonFeature || !polygonFeature.geometry) return [];
  const canopyRadiusMeters = canopyDiameterMeters / 2.0;
  const effectiveRadiusMeters = canopyRadiusMeters + treeSpacingBufferMeters;
  const totalInsetMeters = boundaryBufferMeters + effectiveRadiusMeters;
  if (canopyDiameterMeters <= 0 || effectiveRadiusMeters <=0) return [];
  let plantingZone: Feature<Polygon | MultiPolygon> | null | undefined = null;
  try {
    plantingZone = turf.buffer(polygonFeature, -Math.abs(totalInsetMeters), { units: 'meters' });
  } catch (error) { return []; }
  if (!plantingZone || !plantingZone.geometry || turf.area(plantingZone) === 0) return [];
  const dxMeters = 2 * effectiveRadiusMeters;
  const dyMeters = Math.sqrt(3) * effectiveRadiusMeters;
  if (dxMeters <= 1e-6 || dyMeters <= 1e-6) return [];
  const plantingZoneBounds = turf.bbox(plantingZone);
  const treeCenters: [number, number][] = [];
  const avgLat = (plantingZoneBounds[1] + plantingZoneBounds[3]) / 2;
  const metersPerDegreeLat = 111132.954 - 559.822 * Math.cos(2 * avgLat * (Math.PI/180)) + 1.175 * Math.cos(4 * avgLat * (Math.PI/180));
  const metersPerDegreeLon = (Math.PI/180) * 6378137 * Math.cos(avgLat * Math.PI/180);
  const dxDeg = dxMeters / metersPerDegreeLon;
  const dyDeg = dyMeters / metersPerDegreeLat;
  if (!isFinite(dxDeg) || !isFinite(dyDeg) || dxDeg <= 1e-9 || dyDeg <= 1e-9 ) return [];
  let row = 0;
  for (let y = plantingZoneBounds[1]; y <= plantingZoneBounds[3]; y += dyDeg) {
    const xOffsetInDegrees = (row % 2 === 0) ? 0 : (0.5 * dxDeg);
    for (let x = plantingZoneBounds[0] + xOffsetInDegrees; x <= plantingZoneBounds[2]; x += dxDeg) {
      if (turf.booleanPointInPolygon([x, y], plantingZone)) treeCenters.push([x, y]);
    }
    row++;
  }
  return treeCenters;
};


interface PlantingAdvisorProps {
  setShowTemperatureChart: (show: boolean) => void; 
  onSpeciesChangeForChart: (speciesDetails: ArchetypeData | null) => void;
}

const PlantingAdvisor: React.FC<PlantingAdvisorProps> = ({ setShowTemperatureChart, onSpeciesChangeForChart }) => {
  const { 
    treeSpeciesData, 
    selectedArea, 
    setSimulatedPlantingPoints 
  } = useTreeStore();
  
  const [selectedSpecies, setSelectedSpecies] = useState<TreeSpeciesData | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeData | null>(null);

  const [canopyDiameterInput, setCanopyDiameterInput] = useState<number>(8); 
  const [boundaryBufferInput, setBoundaryBufferInput] = useState<number>(2); 
  const [treeSpacingBufferInput, setTreeSpacingBufferInput] = useState<number>(1); 
  
  const [showSimulationResults, setShowSimulationResults] = useState(false);
  const [simulationCount, setSimulationCount] = useState(0);

  const isAreaDefinedForPlanting = useMemo(() => !!(selectedArea && selectedArea.type === 'geojson' && selectedArea.geojsonData), [selectedArea]);
  const topPerformers = useMemo(() => treeSpeciesData.slice(0, 3), [treeSpeciesData]);

  // Effect to update the details displayed when an archetype is selected
  useEffect(() => {
    if (selectedArchetype) {
        setCanopyDiameterInput(selectedArchetype.canopy_dia_m_max);
        onSpeciesChangeForChart(selectedArchetype);
    } else {
        onSpeciesChangeForChart(null);
    }
  }, [selectedArchetype, onSpeciesChangeForChart]);

  // Effect to reset state when the drawn area is cleared
  useEffect(() => {
    if (!isAreaDefinedForPlanting) {
      setShowSimulationResults(false); 
      setSimulatedPlantingPoints([]); 
      setSimulationCount(0);
      setShowTemperatureChart(false); 
    }
  }, [isAreaDefinedForPlanting, setSimulatedPlantingPoints, setShowTemperatureChart]);

  const handleSpeciesSelect = (botanicalName: string | null) => {
    const species = treeSpeciesData.find(s => s.botanical_name === botanicalName) || null;
    setSelectedSpecies(species);
    // When species changes, clear the selected archetype
    setSelectedArchetype(null);
    setShowSimulationResults(false);
    setSimulatedPlantingPoints([]);
    setSimulationCount(0);
    setShowTemperatureChart(false);
  };

  const handleArchetypeSelect = (archetype: ArchetypeData) => {
    setSelectedArchetype(archetype);
    setShowSimulationResults(false);
    setSimulatedPlantingPoints([]);
    setSimulationCount(0);
    setShowTemperatureChart(false);
  }

  // Auto-select the best archetype when clicking a "Top 3" species
  const handleTopPerformerClick = (species: TreeSpeciesData) => {
    setSelectedSpecies(species);
    setSelectedArchetype(species.representative_archetype);
  };

  const handleSimulatePlanting = () => {
    if (!isAreaDefinedForPlanting || !selectedArea?.geojsonData) return alert("Please draw an area on the map.");
    if (!selectedArchetype) return alert("Please select a tree species and an archetype.");
    
    const polygonFeature = selectedArea.geojsonData as Feature<Polygon | MultiPolygon>;
    const centers = generateTreeCentersJS(polygonFeature, canopyDiameterInput, boundaryBufferInput, treeSpacingBufferInput);
    
    setSimulatedPlantingPoints(centers); 
    setSimulationCount(centers.length); 
    setShowSimulationResults(true);
    if (centers.length > 0) setShowTemperatureChart(true);
  };
  
  const handleClearSimulation = () => {
    setShowSimulationResults(false); 
    setSimulatedPlantingPoints([]); 
    setSimulationCount(0); 
    setShowTemperatureChart(false); 
  };

  return (
    <div className="space-y-6">
      {/* Top Performing Species */}
      <div className="card">
        <div className="card-header"><h3 className="text-lg font-medium flex items-center"><TreeDeciduous size={20} className="mr-2 text-primary-600" />Top 3 Species for Cooling (Summer)</h3></div>
        <div className="card-body space-y-3">
          {topPerformers.map((species, index) => (
            <div key={species.botanical_name} className="p-3 bg-gray-50 rounded-md hover:bg-primary-50 transition-colors cursor-pointer" onClick={() => handleTopPerformerClick(species)}>
              <div className="flex justify-between items-center">
                <div><span className="font-semibold text-primary-700">#{index + 1} {species.common_name}</span><p className="text-xs text-gray-500 italic">{species.botanical_name}</p></div>
                <div className="text-right"><p className="text-lg font-bold text-red-600">{species.representative_archetype.p90_cooling_effect_celsius.toFixed(1)}°C</p><p className="text-xs text-gray-500">P90 Cooling</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Species Selection */}
      <div className="card">
        <div className="card-header"><h3 className="text-lg font-medium">Explore & Select Tree Profiles</h3></div>
        <div className="card-body">
          <label htmlFor="species-select" className="block text-sm font-medium text-gray-700 mb-1">1. Select a Species:</label>
          <select id="species-select" className="input" value={selectedSpecies?.botanical_name || ''} onChange={e => handleSpeciesSelect(e.target.value)}>
            <option value="">-- Select a Species --</option>
            {treeSpeciesData.map(species => (
              <option key={species.botanical_name} value={species.botanical_name}>{species.common_name} ({species.botanical_name})</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* NEW: Archetype Selection Section */}
      {selectedSpecies && (
        <div className="card animate-fade-in">
          <div className="card-header bg-gray-50">
            <h3 className="text-md font-medium">2. Select a Growth Profile for <span className="text-primary-700">{selectedSpecies.common_name}</span></h3>
          </div>
          <div className="card-body space-y-2">
            {selectedSpecies.archetypes.map(archetype => (
              <div key={archetype.id} onClick={() => handleArchetypeSelect(archetype)}
                   className={`p-3 rounded-md cursor-pointer border transition-all ${selectedArchetype?.id === archetype.id ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-200' : 'bg-white hover:bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-800">{archetype.archetype_name}</p>
                    <p className="text-xs text-gray-500">Max Height: {archetype.height_m_max}m • Max Girth: {archetype.girth_cm_max}cm</p>
                  </div>
                  {selectedArchetype?.id === archetype.id && <CheckCircle size={20} className="text-primary-600 ml-3" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Archetype Details Section */}
      {selectedArchetype && (
        <div className="card animate-fade-in">
          <div className="card-header bg-primary-50">
            <h3 className="text-xl font-semibold text-primary-700">{selectedArchetype.common_name}</h3>
            <p className="text-sm text-primary-600 italic">{selectedArchetype.archetype_name}</p>
          </div>
          {/* ... (The rest of the details card JSX can be copied from your previous version) ... */}
          <div className="card-body space-y-4">
            <div> <h4 className="font-medium text-gray-700 flex items-center mb-2"><Thermometer size={18} className="mr-2 text-blue-500" /> Cooling Effect Potential</h4><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-red-50 p-3 rounded-md text-center ring-1 ring-red-200"><p className="text-xs text-red-700 font-medium">P90 Cooling</p><p className="text-xl font-bold text-red-600 mt-1">{selectedArchetype.p90_cooling_effect_celsius.toFixed(1)}°C</p></div>
              <div className="bg-sky-50 p-3 rounded-md text-center ring-1 ring-sky-200"><p className="text-xs text-sky-700 font-medium">P10 Cooling</p><p className="text-xl font-bold text-sky-600 mt-1">{selectedArchetype.p10_cooling_effect_celsius.toFixed(1)}°C</p></div>
              <div className="bg-blue-50 p-3 rounded-md text-center ring-1 ring-blue-200"><p className="text-xs text-blue-700 font-medium">Mean Cooling</p><p className="text-xl font-bold text-blue-600 mt-1">{selectedArchetype.mean_cooling_effect_celsius.toFixed(1)}°C</p></div>
            </div></div>
            <div><h4 className="font-medium text-gray-700 mb-2 flex items-center"><Scaling size={18} className="mr-2 text-green-500" /> Dimensions</h4><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 p-2 rounded-md text-center"><p className="font-semibold text-gray-600">Height</p><p className="mt-0.5">{selectedArchetype.height_m_min} - {selectedArchetype.height_m_max} m</p></div>
                <div className="bg-gray-50 p-2 rounded-md text-center"><p className="font-semibold text-gray-600">Girth</p><p className="mt-0.5">{selectedArchetype.girth_cm_min} - {selectedArchetype.girth_cm_max} cm</p></div>
                <div className="bg-gray-50 p-2 rounded-md text-center"><p className="font-semibold text-gray-600">Canopy</p><p className="mt-0.5">{selectedArchetype.canopy_dia_m_min} - {selectedArchetype.canopy_dia_m_max} m</p></div>
            </div></div>
            <div><h4 className="font-medium text-gray-700 mb-2 flex items-center"><Bot size={18} className="mr-2 text-teal-500" /> CO₂ Sequestration</h4><div className="bg-teal-50 p-3 rounded-md"><p className="text-lg font-semibold text-teal-700 text-center">{selectedArchetype.co2_seq_kg_min.toFixed(1)} - {selectedArchetype.co2_seq_kg_max.toFixed(1)} kg/tree</p></div></div>
          </div>
        </div>
      )}
      
      {/* Planting Simulation Section */}
      <div className="card">
        <div className="card-header flex justify-between items-center"><h3 className="text-lg font-medium flex items-center"><MapPin size={20} className="mr-2 text-green-600" />Planting Area Simulation</h3></div>
        <div className="card-body space-y-4">
          {!isAreaDefinedForPlanting && (<div className="p-4 bg-yellow-50 border border-yellow-300 rounded-md text-center"><p className="text-sm text-yellow-700">Please draw an area on the map to enable simulation.</p></div>)}
          {isAreaDefinedForPlanting && !selectedArchetype && (<div className="p-4 bg-orange-50 border border-orange-300 rounded-md text-center"><p className="text-sm text-orange-700">Please select a species and profile above.</p></div>)}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 items-start">
            <div className="flex flex-col"><label htmlFor="canopy-diameter" className="block text-xs font-medium text-gray-700 mb-0.5">Canopy Dia. (m)</label><input type="number" id="canopy-diameter" className="input text-sm w-full" value={canopyDiameterInput} onChange={e => setCanopyDiameterInput(parseFloat(e.target.value))} step="0.5" min="1" disabled={!selectedArchetype} /></div>
            <div className="flex flex-col"><label htmlFor="boundary-buffer" className="block text-xs font-medium text-gray-700 mb-0.5">Boundary (m)</label><input type="number" id="boundary-buffer" className="input text-sm w-full" value={boundaryBufferInput} onChange={e => setBoundaryBufferInput(parseFloat(e.target.value))} step="0.5" min="0" disabled={!selectedArchetype}/></div>
            <div className="flex flex-col"><label htmlFor="tree-spacing" className="block text-xs font-medium text-gray-700 mb-0.5">Spacing (m)</label><input type="number" id="tree-spacing" className="input text-sm w-full" value={treeSpacingBufferInput} onChange={e => setTreeSpacingBufferInput(parseFloat(e.target.value))} step="0.5" min="0" disabled={!selectedArchetype}/></div>
          </div>
          <button className="btn btn-primary w-full flex items-center justify-center" onClick={handleSimulatePlanting} disabled={!isAreaDefinedForPlanting || !selectedArchetype}><PlayCircle size={18} className="mr-2" /> Simulate Planting</button>
          {showSimulationResults && (
            <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-md animate-fade-in">
              <h4 className="text-md font-semibold text-green-700 mb-2">Simulation Results:</h4>
              <p className="text-sm text-green-600">Based on the area and parameters, approximately <span className="font-bold">{simulationCount}</span> trees of <span className="font-bold">{selectedArchetype?.common_name || ''}</span> could be planted.</p>
              <button className="btn btn-outline btn-sm mt-3 text-xs" onClick={handleClearSimulation}><XCircle size={16} className="mr-1" /> Clear Simulation</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlantingAdvisor;