// src/components/sidebar/tabs/PlantingAdvisor.tsx
import React, { useState, useEffect } from 'react';
import { TreeDeciduous, Info, Thermometer, Scaling, Bot, MapPin, PlayCircle, XCircle } from 'lucide-react';
import { useTreeStore, TreeSpeciesData, DrawnGeoJson } from '../../../store/TreeStore';
import * as turf from '@turf/turf';
import InfoPopover from '../../common/InfoPopover';

// Helper function (generateTreeCentersJS - THIS MUST BE THE FULL, WORKING VERSION FROM YOUR PROJECT)
// I am including the last known good version based on our successful simulation tests.
const generateTreeCentersJS = (
  polygonFeature: turf.Feature<turf.Polygon | turf.MultiPolygon>,
  canopyDiameterMeters: number,
  boundaryBufferMeters: number,
  treeSpacingBufferMeters: number
): turf.helpers.Position[] => {
  console.log("--- generateTreeCentersJS START ---");
  console.log("Inputs:", { 
    canopyDiameterMeters, 
    boundaryBufferMeters, 
    treeSpacingBufferMeters 
  });

  if (!polygonFeature || !polygonFeature.geometry || !polygonFeature.geometry.coordinates || 
      (polygonFeature.geometry.type === "Polygon" && polygonFeature.geometry.coordinates.length === 0) ||
      (polygonFeature.geometry.type === "MultiPolygon" && polygonFeature.geometry.coordinates.length === 0) ) {
    console.error("generateTreeCentersJS: Invalid polygon feature (no geometry or coordinates).");
    return [];
  }

  const canopyRadiusMeters = canopyDiameterMeters / 2.0;
  const effectiveRadiusMeters = canopyRadiusMeters + treeSpacingBufferMeters;
  const totalInsetMeters = boundaryBufferMeters + effectiveRadiusMeters;
  console.log("Calculated (meters):", { canopyRadiusMeters, effectiveRadiusMeters, totalInsetMeters });

  if (totalInsetMeters < 0) { 
      console.warn("generateTreeCentersJS: Total inset is negative. This could lead to unexpected buffer results.");
  }
   if (canopyDiameterMeters <= 0 || effectiveRadiusMeters <=0) {
    console.error("generateTreeCentersJS: Canopy diameter or effective radius is zero or negative.");
    return [];
  }

  let plantingZone: turf.Feature<turf.Polygon | turf.MultiPolygon> | null = null;
  try {
    let validGeoJsonToBuffer: turf.Feature<turf.Polygon | turf.MultiPolygon>;
    if (polygonFeature.geometry.type === "Polygon") {
        validGeoJsonToBuffer = turf.polygon(polygonFeature.geometry.coordinates, polygonFeature.properties || {});
    } else if (polygonFeature.geometry.type === "MultiPolygon") {
        validGeoJsonToBuffer = turf.multiPolygon(polygonFeature.geometry.coordinates, polygonFeature.properties || {});
    } else {
        console.error("generateTreeCentersJS: Unsupported geometry type for buffering:", polygonFeature.geometry.type);
        return [];
    }
    
    const originalArea = turf.area(validGeoJsonToBuffer);
    console.log("Original polygon area (sq m, calculated by Turf):", originalArea);
    if (originalArea === 0 && totalInsetMeters > 0) { 
        console.warn("generateTreeCentersJS: Original polygon area is 0, cannot apply negative buffer.");
        return []; 
    }

    if (totalInsetMeters !== 0) { 
        plantingZone = turf.buffer(validGeoJsonToBuffer, -Math.abs(totalInsetMeters), { units: 'meters' });
    } else {
        plantingZone = validGeoJsonToBuffer; 
    }

  } catch (error) {
    console.error("generateTreeCentersJS: Error during turf.buffer:", error);
    return [];
  }
  
  if (!plantingZone || !plantingZone.geometry || (plantingZone.geometry.coordinates && plantingZone.geometry.coordinates.length === 0) || turf.area(plantingZone) === 0) {
    console.log("generateTreeCentersJS: Planting zone is empty or too small after buffering.");
    console.log("Total Inset (m):", totalInsetMeters);
    if(plantingZone && plantingZone.geometry) console.log("Buffered planting zone (GeoJSON geometry):", JSON.stringify(plantingZone.geometry));
    else if(plantingZone) console.log("Buffered planting zone was not null, but geometry might be invalid or area 0.");
    else console.log("Planting zone was null after buffer attempt.");
    return [];
  }
  console.log("generateTreeCentersJS: Planting zone created. Area (sq m, calculated by Turf):", turf.area(plantingZone));

  const dxMeters = 2 * effectiveRadiusMeters;
  const dyMeters = Math.sqrt(3) * effectiveRadiusMeters; 
  console.log("generateTreeCentersJS: Hex grid spacing (dxMeters, dyMeters):", dxMeters, dyMeters);

  if (dxMeters <= 1e-6 || dyMeters <= 1e-6) { 
    console.error("generateTreeCentersJS: Effective radius or spacing parameters result in zero or negligible grid steps.");
    return [];
  }

  const plantingZoneBounds = turf.bbox(plantingZone); 
  const treeCenters: turf.helpers.Position[] = [];
  console.log("generateTreeCentersJS: Planting zone bounds (degrees Lon/Lat):", plantingZoneBounds);

  const avgLat = (plantingZoneBounds[1] + plantingZoneBounds[3]) / 2;
  const metersPerDegreeLat = 111132.954 - 559.822 * Math.cos(2 * avgLat * (Math.PI/180)) + 1.175 * Math.cos(4 * avgLat * (Math.PI/180)) - 0.00229 * Math.cos(6 * avgLat * (Math.PI/180));
  const metersPerDegreeLon = (Math.PI/180) * 6378137 * Math.cos(avgLat * Math.PI/180) / Math.sqrt(1 - 0.00669437999014 * Math.pow(Math.sin(avgLat * Math.PI/180), 2));

  const dxDeg = dxMeters / metersPerDegreeLon;
  const dyDeg = dyMeters / metersPerDegreeLat; 

  console.log("generateTreeCentersJS: Approx degree steps (dxDeg, dyDeg):", dxDeg, dyDeg);

  if (!isFinite(dxDeg) || !isFinite(dyDeg) || dxDeg <= 1e-9 || dyDeg <= 1e-9 ) { 
      console.error("generateTreeCentersJS: Calculated degree steps are zero, too small, or invalid, aborting grid generation. dxDeg:", dxDeg, "dyDeg:", dyDeg);
      return [];
  }

  let row = 0;
  for (let y = plantingZoneBounds[1]; y <= plantingZoneBounds[3]; y += dyDeg) {
    const xOffsetInDegrees = (row % 2 === 0) ? 0 : (0.5 * dxDeg); 
    for (let x = plantingZoneBounds[0] + xOffsetInDegrees; x <= plantingZoneBounds[2]; x += dxDeg) {
      const candidatePointCoords: turf.helpers.Position = [x, y]; 
      if (turf.booleanPointInPolygon(candidatePointCoords, plantingZone)) {
        treeCenters.push(candidatePointCoords);
      }
    }
    row++;
  }
  
  console.log("generateTreeCentersJS: Generated tree centers:", treeCenters.length);
  if (treeCenters.length > 0 && treeCenters.length < 10) console.log("First few centers (Lon,Lat):", treeCenters); 
  console.log("--- generateTreeCentersJS END ---");
  return treeCenters;
};


interface PlantingAdvisorProps {
  setShowTemperatureChart: (show: boolean) => void; 
  onSpeciesChangeForChart: (speciesDetails: TreeSpeciesData | null) => void;
}

const PlantingAdvisor: React.FC<PlantingAdvisorProps> = ({ setShowTemperatureChart, onSpeciesChangeForChart }) => {
  const { 
    treeSpeciesData, 
    selectedArea, 
    setSelectedArea, 
    setSimulatedPlantingPoints 
  } = useTreeStore();
  
  const [topPerformers, setTopPerformers] = useState<TreeSpeciesData[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>('');
  const [selectedSpeciesDetails, setSelectedSpeciesDetails] = useState<TreeSpeciesData | null>(null);
  const [canopyDiameterInput, setCanopyDiameterInput] = useState<number>(8); 
  const [boundaryBufferInput, setBoundaryBufferInput] = useState<number>(2); 
  const [treeSpacingBufferInput, setTreeSpacingBufferInput] = useState<number>(1); 
  const [isAreaDefinedForPlanting, setIsAreaDefinedForPlanting] = useState(false);
  const [showSimulationResults, setShowSimulationResults] = useState(false);
  const [simulationCount, setSimulationCount] = useState(0);

  useEffect(() => {
    if (treeSpeciesData.length > 0) {
      const sortedByCooling = [...treeSpeciesData].sort((a, b) => b.mean_cooling_effect_celsius - a.mean_cooling_effect_celsius);
      setTopPerformers(sortedByCooling.slice(0, 3));
    }
  }, [treeSpeciesData]);

  useEffect(() => {
    let speciesDetailsUpdate: TreeSpeciesData | null = null;
    if (selectedSpeciesId) {
      const foundSpecies = treeSpeciesData.find(s => s.id === selectedSpeciesId);
      if (foundSpecies) {
        speciesDetailsUpdate = foundSpecies;
        setCanopyDiameterInput(foundSpecies.canopy_dia_m_max); 
      }
    }
    setSelectedSpeciesDetails(speciesDetailsUpdate);
    onSpeciesChangeForChart(speciesDetailsUpdate);
  }, [selectedSpeciesId, treeSpeciesData, onSpeciesChangeForChart]);
  
  useEffect(() => {
    if (selectedArea && selectedArea.type === 'geojson' && selectedArea.geojsonData) {
      setIsAreaDefinedForPlanting(true);
    } else {
      setIsAreaDefinedForPlanting(false);
      setShowSimulationResults(false); 
      setSimulatedPlantingPoints([]); 
      setSimulationCount(0);
      setShowTemperatureChart(false); 
      onSpeciesChangeForChart(null); 
    }
  }, [selectedArea, setSimulatedPlantingPoints, setShowTemperatureChart, onSpeciesChangeForChart]);

  const handleSpeciesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSpeciesId(e.target.value); 
    setShowSimulationResults(false); 
    setSimulatedPlantingPoints([]); 
    setSimulationCount(0);
    setShowTemperatureChart(false); 
  };
  
  const handleSimulatePlanting = () => {
    if (!isAreaDefinedForPlanting || !selectedArea?.geojsonData ) {
        alert("Please draw an area on the map first using the drawing tools (top-left)."); return;
    }
    if (!selectedSpeciesDetails) {
        alert("Please select a tree species first."); return;
    }
    const polygonFeature = selectedArea.geojsonData as turf.Feature<turf.Polygon | turf.MultiPolygon>;
    const centers = generateTreeCentersJS( polygonFeature, canopyDiameterInput, boundaryBufferInput, treeSpacingBufferInput );
    setSimulatedPlantingPoints(centers); 
    setSimulationCount(centers.length); 
    setShowSimulationResults(true);
    if (centers.length > 0) { setShowTemperatureChart(true); } else { setShowTemperatureChart(false); }
    console.log(`Simulation complete: ${centers.length} trees can be planted.`);
  };
  
  const handleClearSimulation = () => {
      setShowSimulationResults(false); setSimulatedPlantingPoints([]); setSimulationCount(0); setShowTemperatureChart(false); 
  };

  const plantingSimulationInfo = (
    <>
      <p>1. Select a tree species above to pre-fill its maximum canopy diameter.</p>
      <p>2. Use drawing tools on the map (top-left) to define a planting area.</p>
      <p>3. Adjust canopy diameter, boundary buffer (distance from area edge to canopy edge), and tree spacing buffer (gap between canopies) as needed.</p>
      <p>4. Click "Simulate" to estimate tree placement using a hexagonal grid pattern.</p>
    </>
  );

  const p90p10Info = (
    <div className="text-sm text-gray-700 space-y-2">
      <p>
        These values estimate the cooling impact of this tree species, based on Land Surface Temperature (LST) data:
      </p>
      <div className="pl-2 space-y-1">
        <p className="text-xs">
          <strong className="font-semibold">P90 Cooling (High Potential):</strong> This is the temperature difference between the hottest 10% of non-vegetated areas (within a 500m buffer around typical tree locations) and the temperature directly under this tree species during those hot conditions. It indicates strong cooling during peak heat.
        </p>
        <p className="text-xs">
          <strong className="font-semibold">P10 Cooling (Moderate/Consistent):</strong> This is the temperature difference between the 10th percentile of non-vegetated LST (representing milder warm conditions within a 500m buffer) and the temperature directly under this tree species during those conditions. It suggests a more consistent cooling effect.
        </p>
      </div>
      <p className="text-xs mt-2 italic">
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Performing Species Section */}
      {topPerformers.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium flex items-center"><TreeDeciduous size={20} className="mr-2 text-primary-600" />Top 3 Species for Cooling</h3></div>
          <div className="card-body space-y-3">
            {topPerformers.map((species, index) => (
              <div key={species.id} className="p-3 bg-gray-50 rounded-md hover:bg-primary-50 transition-colors cursor-pointer" onClick={() => setSelectedSpeciesId(species.id)}>
                <div className="flex justify-between items-center">
                  <div><span className="font-semibold text-primary-700">#{index + 1} {species.common_name}</span><p className="text-xs text-gray-500 italic">{species.botanical_name}</p></div>
                  <div className="text-right"><p className="text-lg font-bold text-blue-600">{typeof species.mean_cooling_effect_celsius === 'number' ? species.mean_cooling_effect_celsius.toFixed(1) : 'N/A'}°C</p><p className="text-xs text-gray-500">Avg. Cooling</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Species Selection Dropdown */}
      <div className="card">
        <div className="card-header"><h3 className="text-lg font-medium">Explore Tree Species</h3></div>
        <div className="card-body">
          <label htmlFor="species-select" className="block text-sm font-medium text-gray-700 mb-1">Select a Species:</label>
          <select id="species-select" className="input" value={selectedSpeciesId} onChange={handleSpeciesChange}>
            <option value="">-- Select a Species --</option>
            {treeSpeciesData.sort((a,b) => a.common_name.localeCompare(b.common_name)).map(species => (
              <option key={species.id} value={species.id}>{species.common_name} ({species.botanical_name})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Species Details Section */}
      {selectedSpeciesDetails && (
        <div className="card animate-fade-in">
          <div className="card-header bg-primary-50"><h3 className="text-xl font-semibold text-primary-700">{selectedSpeciesDetails.common_name}</h3><p className="text-sm text-primary-600 italic">{selectedSpeciesDetails.botanical_name}</p></div>
          <div className="card-body space-y-4">
            {/* Cooling Effect Potential Section - WITH ALIGNMENT FIX */}
            <div> 
              <div className="flex justify-between items-center mb-2"><h4 className="font-medium text-gray-700 flex items-center"><Thermometer size={18} className="mr-2 text-blue-500" /> Cooling Effect Potential</h4><InfoPopover titleContent="Cooling Percentiles Explained" iconSize={16} popoverWidthClass="w-80 sm:w-96" >{p90p10Info}</InfoPopover></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-red-50 p-3 rounded-md text-center ring-1 ring-red-200">
                  <p className="text-xs text-red-700 font-medium min-h-[2.25rem] flex items-center justify-center">P90 Cooling (High)</p>
                  <p className="text-xl font-bold text-red-600 mt-1">{typeof selectedSpeciesDetails.p90_cooling_effect_celsius === 'number' ? selectedSpeciesDetails.p90_cooling_effect_celsius.toFixed(1) : 'N/A'}°C</p>
                </div>
                <div className="bg-sky-50 p-3 rounded-md text-center ring-1 ring-sky-200">
                  <p className="text-xs text-sky-700 font-medium min-h-[2.25rem] flex items-center justify-center">P10 Cooling (Moderate)</p>
                  <p className="text-xl font-bold text-sky-600 mt-1">{typeof selectedSpeciesDetails.p10_cooling_effect_celsius === 'number' ? selectedSpeciesDetails.p10_cooling_effect_celsius.toFixed(1) : 'N/A'}°C</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-md text-center ring-1 ring-blue-200">
                  <p className="text-xs text-blue-700 font-medium min-h-[2.25rem] flex items-center justify-center">Mean Cooling</p>
                  <p className="text-xl font-bold text-blue-600 mt-1">{typeof selectedSpeciesDetails.mean_cooling_effect_celsius === 'number' ? selectedSpeciesDetails.mean_cooling_effect_celsius.toFixed(1) : 'N/A'}°C</p>
                </div>
              </div>
            </div>
            
            {/* Typical Dimensions Section - WITH ALIGNMENT FIX */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2 flex items-center"><Scaling size={18} className="mr-2 text-green-500" /> Typical Dimensions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 p-2 rounded-md text-center">
                  <p className="font-semibold text-gray-600 min-h-[2rem] flex items-center justify-center">Height</p> 
                  <p className="mt-0.5">{selectedSpeciesDetails.height_m_min ?? 'N/A'} - {selectedSpeciesDetails.height_m_max ?? 'N/A'} m</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-md text-center">
                  <p className="font-semibold text-gray-600 min-h-[2rem] flex items-center justify-center">Girth</p>
                  <p className="mt-0.5">{selectedSpeciesDetails.girth_cm_min ?? 'N/A'} - {selectedSpeciesDetails.girth_cm_max ?? 'N/A'} cm</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-md text-center">
                  <p className="font-semibold text-gray-600 min-h-[2rem] flex items-center justify-center">Canopy Diameter</p>
                  <p className="mt-0.5">{selectedSpeciesDetails.canopy_dia_m_min ?? 'N/A'} - {selectedSpeciesDetails.canopy_dia_m_max ?? 'N/A'} m</p>
                </div>
              </div>
            </div>

            {/* CO2 Sequestration Section */}
            <div><h4 className="font-medium text-gray-700 mb-2 flex items-center"><Bot size={18} className="mr-2 text-teal-500" /> CO₂ Sequestration</h4><div className="bg-teal-50 p-3 rounded-md"><p className="text-lg font-semibold text-teal-700 text-center">{(selectedSpeciesDetails.co2_seq_kg_min ?? 'N/A')} - {(selectedSpeciesDetails.co2_seq_kg_max ?? 'N/A')} kg/year (approx.)</p></div></div>
            <div className="mt-3 text-xs text-gray-400">Note: All values are typical ranges or averages for the species. Actual values can vary.</div>
          </div>
        </div>
      )}

      {/* Planting Simulation Section */}
      <div className="card">
        <div className="card-header flex justify-between items-center"><h3 className="text-lg font-medium flex items-center"><MapPin size={20} className="mr-2 text-green-600" />Planting Area Simulation</h3><InfoPopover titleContent="Planting Simulation Help">{plantingSimulationInfo}</InfoPopover></div>
        <div className="card-body space-y-4">
          {!isAreaDefinedForPlanting && (<div className="p-4 bg-yellow-50 border border-yellow-300 rounded-md text-center"><p className="text-sm text-yellow-700">Please draw an area on the map using the drawing tools (top-left) to enable simulation.</p></div>)}
          {isAreaDefinedForPlanting && !selectedSpeciesDetails && (<div className="p-4 bg-orange-50 border border-orange-300 rounded-md text-center"><p className="text-sm text-orange-700">Please select a tree species above to set a canopy diameter for the simulation.</p></div>)}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 items-start">
            <div className="flex flex-col"><label htmlFor="canopy-diameter" className="block text-xs font-medium text-gray-700 mb-0.5 truncate" title="Maximum Canopy Diameter (m)">Max Canopy Dia. (m)</label><input type="number" id="canopy-diameter" className="input text-sm w-full" value={canopyDiameterInput} onChange={e => setCanopyDiameterInput(parseFloat(e.target.value))} step="0.5" min="1" /></div>
            <div className="flex flex-col"><label htmlFor="boundary-buffer" className="block text-xs font-medium text-gray-700 mb-0.5">Boundary Buffer (m)</label><input type="number" id="boundary-buffer" className="input text-sm w-full" value={boundaryBufferInput} onChange={e => setBoundaryBufferInput(parseFloat(e.target.value))} step="0.5" min="0"/></div>
            <div className="flex flex-col"><label htmlFor="tree-spacing" className="block text-xs font-medium text-gray-700 mb-0.5 truncate" title="Tree Spacing Buffer (m)">Tree Spacing (m)</label><input type="number" id="tree-spacing" className="input text-sm w-full" value={treeSpacingBufferInput} onChange={e => setTreeSpacingBufferInput(parseFloat(e.target.value))} step="0.5" min="0"/></div>
          </div>
          <button className="btn btn-primary w-full flex items-center justify-center" onClick={handleSimulatePlanting} disabled={!isAreaDefinedForPlanting || !selectedSpeciesDetails}><PlayCircle size={18} className="mr-2" /> Simulate Planting Layout</button>
          {showSimulationResults && (
            <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-md animate-fade-in">
              <h4 className="text-md font-semibold text-green-700 mb-2">Simulation Results:</h4>
              <p className="text-sm text-green-600">Based on the selected area and parameters, approximately <span className="font-bold">{simulationCount}</span> trees of <span className="font-bold">{selectedSpeciesDetails?.common_name || 'the selected species'}</span> could be planted.</p>
              <p className="text-xs text-gray-500 mt-1">Simulated tree locations are displayed on the map.</p>
              <button className="btn btn-outline btn-sm mt-3 text-xs" onClick={handleClearSimulation}><XCircle size={16} className="mr-1" /> Clear Simulation & Map Markers</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlantingAdvisor;