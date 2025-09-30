// src/components/sidebar/tabs/PlantingAdvisor.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { TreeDeciduous, Info, Thermometer, Scaling, Bot, MapPin, PlayCircle, XCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { useTreeStore, TreeSpeciesData, ArchetypeData } from '../../../store/TreeStore';
import * as turf from '@turf/turf';
import InfoPopover from '../../common/InfoPopover';

// Helper function remains unchanged
const generateTreeCentersJS = (polygonFeature: turf.Feature<turf.Polygon | turf.MultiPolygon>, canopyDiameterMeters: number, boundaryBufferMeters: number, treeSpacingBufferMeters: number): turf.helpers.Position[] => {
  if (!polygonFeature || !polygonFeature.geometry) return [];
  const canopyRadiusMeters = canopyDiameterMeters / 2.0;
  const effectiveRadiusMeters = canopyRadiusMeters + treeSpacingBufferMeters;
  const totalInsetMeters = boundaryBufferMeters + effectiveRadiusMeters;
  if (canopyDiameterMeters <= 0 || effectiveRadiusMeters <=0) return [];
  let plantingZone: turf.Feature<turf.Polygon | turf.MultiPolygon> | null = null;
  try {
    plantingZone = turf.buffer(polygonFeature, -Math.abs(totalInsetMeters), { units: 'meters' });
  } catch (error) { return []; }
  if (!plantingZone || !plantingZone.geometry || turf.area(plantingZone) === 0) return [];
  const dxMeters = 2 * effectiveRadiusMeters;
  const dyMeters = Math.sqrt(3) * effectiveRadiusMeters;
  if (dxMeters <= 1e-6 || dyMeters <= 1e-6) return [];
  const plantingZoneBounds = turf.bbox(plantingZone);
  const treeCenters: turf.helpers.Position[] = [];
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

// Reusable Collapsible Section Component
const CollapsibleSection: React.FC<{ title: React.ReactNode; children: React.ReactNode; isOpen: boolean; onToggle: () => void; }> = ({ title, children, isOpen, onToggle }) => (
  <div className="card">
    <div className="card-header">
      <button onClick={onToggle} className="collapsible-trigger">
        <h3 className="text-lg font-medium flex items-center">{title}</h3>
        <ChevronDown size={20} className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
    <div className={`collapsible-content ${!isOpen ? 'collapsible-content-closed' : ''}`} style={{ maxHeight: isOpen ? '1000px' : '0' }}>
      <div className="card-body">
        {children}
      </div>
    </div>
  </div>
);

interface PlantingAdvisorProps {
  setShowTemperatureChart: (show: boolean) => void;
  onSpeciesChangeForChart: (speciesDetails: ArchetypeData | null) => void;
}

const PlantingAdvisor: React.FC<PlantingAdvisorProps> = ({ setShowTemperatureChart, onSpeciesChangeForChart }) => {
  const { treeSpeciesData, selectedArea, setSimulatedPlantingPoints } = useTreeStore();

  const [openSections, setOpenSections] = useState({ top: true, select: true, details: false, simulate: true });
  const toggleSection = (section: keyof typeof openSections) => setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));

  const [selectedSpecies, setSelectedSpecies] = useState<TreeSpeciesData | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeData | null>(null);

  const [canopyDiameterInput, setCanopyDiameterInput] = useState<number>(8);
  const [boundaryBufferInput, setBoundaryBufferInput] = useState<number>(2);
  const [treeSpacingBufferInput, setTreeSpacingBufferInput] = useState<number>(1);

  const [showSimulationResults, setShowSimulationResults] = useState(false);
  const [simulationCount, setSimulationCount] = useState(0);

  const isAreaDefinedForPlanting = useMemo(() => !!(selectedArea && selectedArea.type === 'geojson' && selectedArea.geojsonData), [selectedArea]);
  const topPerformers = useMemo(() => treeSpeciesData.slice(0, 3), [treeSpeciesData]);

  useEffect(() => {
    if (selectedArchetype) {
      setCanopyDiameterInput(selectedArchetype.canopy_dia_m_max);
      onSpeciesChangeForChart(selectedArchetype);
      setOpenSections(prev => ({ ...prev, details: true, simulate: true })); // Auto-open details
    } else {
      onSpeciesChangeForChart(null);
    }
  }, [selectedArchetype, onSpeciesChangeForChart]);

  useEffect(() => {
    if (!isAreaDefinedForPlanting) {
      setShowSimulationResults(false);
      setSimulatedPlantingPoints([]);
      setSimulationCount(0);
      setShowTemperatureChart(false);
    }
  }, [isAreaDefinedForPlanting, setSimulatedPlantingPoints, setShowTemperatureChart]);

  const resetSimulation = () => {
    setShowSimulationResults(false);
    setSimulatedPlantingPoints([]);
    setSimulationCount(0);
    setShowTemperatureChart(false);
  };

  const handleSpeciesSelect = (botanicalName: string | null) => {
    const species = treeSpeciesData.find(s => s.botanical_name === botanicalName) || null;
    setSelectedSpecies(species);
    setSelectedArchetype(null);
    setOpenSections(prev => ({ ...prev, details: false }));
    resetSimulation();
  };

  const handleArchetypeSelect = (archetype: ArchetypeData) => {
    setSelectedArchetype(archetype);
    resetSimulation();
  }

  const handleTopPerformerClick = (species: TreeSpeciesData) => {
    setSelectedSpecies(species);
    setSelectedArchetype(species.representative_archetype);
    setOpenSections(prev => ({ top: false, select: false, details: true, simulate: true }));
  };

  const handleSimulatePlanting = () => {
    if (!isAreaDefinedForPlanting || !selectedArea?.geojsonData) return;
    if (!selectedArchetype) return;

    const polygonFeature = selectedArea.geojsonData as turf.Feature<turf.Polygon | turf.MultiPolygon>;
    const centers = generateTreeCentersJS(polygonFeature, canopyDiameterInput, boundaryBufferInput, treeSpacingBufferInput);

    setSimulatedPlantingPoints(centers);
    setSimulationCount(centers.length);
    setShowSimulationResults(true);
    if (centers.length > 0) setShowTemperatureChart(true);
  };

  return (
    <div className="space-y-4">
      <CollapsibleSection
        title={<><TreeDeciduous size={20} className="mr-2 text-primary-600" />Top 3 Species for Cooling</>}
        isOpen={openSections.top}
        onToggle={() => toggleSection('top')}
      >
        <div className="space-y-3">
          {topPerformers.map((species, index) => (
            <div key={species.botanical_name} className="p-3 bg-gray-50 rounded-md hover:bg-primary-50 transition-colors cursor-pointer" onClick={() => handleTopPerformerClick(species)}>
              <div className="flex justify-between items-center">
                <div><span className="font-semibold text-primary-700">#{index + 1} {species.common_name}</span><p className="text-xs text-gray-500 italic">{species.botanical_name}</p></div>
                <div className="text-right"><p className="text-lg font-bold text-red-600">{species.representative_archetype.p90_cooling_effect_celsius.toFixed(1)}°C</p><p className="text-xs text-gray-500">P90 Cooling</p></div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Explore & Select Profiles"
        isOpen={openSections.select}
        onToggle={() => toggleSection('select')}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="species-select" className="block text-sm font-medium text-gray-700 mb-1">1. Select a Species:</label>
            <select id="species-select" className="input" value={selectedSpecies?.botanical_name || ''} onChange={e => handleSpeciesSelect(e.target.value)}>
              <option value="">-- Select a Species --</option>
              {treeSpeciesData.map(species => (
                <option key={species.botanical_name} value={species.botanical_name}>{species.common_name} ({species.botanical_name})</option>
              ))}
            </select>
          </div>
          {selectedSpecies && (
            <div className="animate-fade-in">
              <h3 className="text-sm font-medium text-gray-700 mb-1">2. Select a Growth Profile:</h3>
              <div className="space-y-2">
                {selectedSpecies.archetypes.map(archetype => (
                  <div key={archetype.id} onClick={() => handleArchetypeSelect(archetype)}
                       className={`p-3 rounded-md cursor-pointer border transition-all ${selectedArchetype?.id === archetype.id ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-200' : 'bg-white hover:bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-800">{archetype.archetype_name}</p>
                        <p className="text-xs text-gray-500">Max H: {archetype.height_m_max}m • Max G: {archetype.girth_cm_max}cm</p>
                      </div>
                      {selectedArchetype?.id === archetype.id && <CheckCircle size={20} className="text-primary-600 ml-3" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {selectedArchetype && (
        <CollapsibleSection
          title={
            <div className="flex flex-col">
              <span className="text-primary-700">{selectedArchetype.common_name}</span>
              <span className="text-sm font-normal text-gray-500 italic">{selectedArchetype.archetype_name}</span>
            </div>
          }
          isOpen={openSections.details}
          onToggle={() => toggleSection('details')}
        >
          <div className="space-y-4">
            <div> <h4 className="font-medium text-gray-700 flex items-center mb-2"><Thermometer size={18} className="mr-2 text-blue-500" /> Cooling Effect</h4><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-red-50 p-3 rounded-md text-center ring-1 ring-red-200"><p className="text-xs text-red-700 font-medium">P90 Cooling</p><p className="text-xl font-bold text-red-600 mt-1">{selectedArchetype.p90_cooling_effect_celsius.toFixed(1)}°C</p></div>
              <div className="bg-sky-50 p-3 rounded-md text-center ring-1 ring-sky-200"><p className="text-xs text-sky-700 font-medium">P10 Cooling</p><p className="text-xl font-bold text-sky-600 mt-1">{selectedArchetype.p10_cooling_effect_celsius.toFixed(1)}°C</p></div>
              <div className="bg-blue-50 p-3 rounded-md text-center ring-1 ring-blue-200"><p className="text-xs text-blue-700 font-medium">Mean</p><p className="text-xl font-bold text-blue-600 mt-1">{selectedArchetype.mean_cooling_effect_celsius.toFixed(1)}°C</p></div>
            </div></div>
            <div><h4 className="font-medium text-gray-700 mb-2 flex items-center"><Scaling size={18} className="mr-2 text-green-500" /> Dimensions</h4><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 p-2 rounded-md text-center"><p className="font-semibold text-gray-600">Height</p><p className="mt-0.5">{selectedArchetype.height_m_min}-{selectedArchetype.height_m_max} m</p></div>
                <div className="bg-gray-50 p-2 rounded-md text-center"><p className="font-semibold text-gray-600">Girth</p><p className="mt-0.5">{selectedArchetype.girth_cm_min}-{selectedArchetype.girth_cm_max} cm</p></div>
                <div className="bg-gray-50 p-2 rounded-md text-center"><p className="font-semibold text-gray-600">Canopy</p><p className="mt-0.5">{selectedArchetype.canopy_dia_m_min}-{selectedArchetype.canopy_dia_m_max} m</p></div>
            </div></div>
            <div><h4 className="font-medium text-gray-700 mb-2 flex items-center"><Bot size={18} className="mr-2 text-teal-500" /> CO₂ Sequestration</h4><div className="bg-teal-50 p-3 rounded-md"><p className="text-lg font-semibold text-teal-700 text-center">{selectedArchetype.co2_seq_kg_min.toFixed(1)} - {selectedArchetype.co2_seq_kg_max.toFixed(1)} kg/tree</p></div></div>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={<><MapPin size={20} className="mr-2 text-green-600" />Planting Simulation</>}
        isOpen={openSections.simulate}
        onToggle={() => toggleSection('simulate')}
      >
        <div className="space-y-4">
          {!isAreaDefinedForPlanting && (<div className="p-4 bg-yellow-50 border border-yellow-300 rounded-md text-center"><p className="text-sm text-yellow-700">Draw an area on the map to enable simulation.</p></div>)}
          {isAreaDefinedForPlanting && !selectedArchetype && (<div className="p-4 bg-orange-50 border border-orange-300 rounded-md text-center"><p className="text-sm text-orange-700">Select a species and profile above.</p></div>)}
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
              <button className="btn btn-outline text-xs py-1 px-2 mt-3" onClick={resetSimulation}><XCircle size={16} className="mr-1" /> Clear Simulation</button>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};

export default PlantingAdvisor;