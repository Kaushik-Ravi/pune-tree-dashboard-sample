
import MultiSelect from '../../filters/MultiSelect';
import RangeSlider from '../../filters/RangeSlider';
import { useFilters } from '../../filters/../../store/FilterStore';

const PRESET_CONFIGS: Record<string, any> = {
  trees_by_ward: { chartType: 'bar', groupBy: 'ward', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: 20 },
  co2_by_ward: { chartType: 'bar', groupBy: 'ward', metric: 'sum_co2', sortBy: 'value', sortOrder: 'desc', limit: 20 },
  top_species: { chartType: 'horizontalBar', groupBy: 'species', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: 10 },
  by_purpose: { chartType: 'pie', groupBy: 'economic_i', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: 10 },
  height_dist: { chartType: 'bar', groupBy: 'height_category', metric: 'count', sortBy: 'label', sortOrder: 'asc', limit: 10 },
  street_vs_nonstreet: { chartType: 'pie', groupBy: 'location_type', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: 2 },
  flowering_status: { chartType: 'pie', groupBy: 'flowering', metric: 'count', sortBy: 'value', sortOrder: 'desc', limit: 2 },
  top_co2_species: { chartType: 'horizontalBar', groupBy: 'species', metric: 'sum_co2', sortBy: 'value', sortOrder: 'desc', limit: 10 },
};

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

const CityOverviewCharts: React.FC = () => {
  const [preset, setPreset] = useState<string | null>('trees_by_ward');
  const [customConfig, setCustomConfig] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-chart filter state
  const { filterMetadata } = useFilters();
  const [species, setSpecies] = useState<string[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [economicImportance, setEconomicImportance] = useState<string | null>(null);
  const [height, setHeight] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [canopy, setCanopy] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [girth, setGirth] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [co2, setCO2] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });

  // Only one chart config is active at a time
  const activeConfig = preset ? PRESET_CONFIGS[preset] : customConfig;

  // Compose filters for API
  const chartFilters = {
    species,
    wards,
    economicImportance,
    height,
    canopyDiameter: canopy,
    girth,
    co2Sequestered: co2,
  };

  useEffect(() => {
    if (!activeConfig) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/chart-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupBy: activeConfig.groupBy,
        metric: activeConfig.metric,
        sortBy: activeConfig.sortBy,
        sortOrder: activeConfig.sortOrder,
        limit: activeConfig.limit,
        filters: chartFilters,
        type: activeConfig.chartType,
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch chart data');
        return res.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeConfig, JSON.stringify(chartFilters)]);

  const handlePresetSelect = (key: string) => {
    setPreset(key);
    setCustomConfig(null);
  };

  const handleBuild = (config: any) => {
    setPreset(null);
    setCustomConfig(config);
  };

  // Reset chart filters when preset/custom changes
  useEffect(() => {
    setSpecies([]);
    setWards([]);
    setEconomicImportance(null);
    setHeight({ min: null, max: null });
    setCanopy({ min: null, max: null });
    setGirth({ min: null, max: null });
    setCO2({ min: null, max: null });
  }, [activeConfig]);

  return (
    <div className="space-y-4">
      <ChartPresets onPresetSelect={handlePresetSelect} selected={preset} />
      <ChartBuilder onBuild={handleBuild} />
      {/* Per-chart filter controls */}
      {filterMetadata && (
        <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-3 rounded-md border">
          <MultiSelect
            label="Species"
            options={filterMetadata.species}
            selected={species}
            onChange={setSpecies}
            placeholder="All species"
            maxDisplayItems={2}
          />
          <MultiSelect
            label="Ward"
            options={filterMetadata.wards}
            selected={wards}
            onChange={setWards}
            placeholder="All wards"
            sortType="natural"
            itemPrefix="Ward"
            maxDisplayItems={2}
          />
          <MultiSelect
            label="Purpose"
            options={filterMetadata.economicImportanceOptions}
            selected={economicImportance ? [economicImportance] : []}
            onChange={arr => setEconomicImportance(arr[0] || null)}
            placeholder="All purposes"
            maxDisplayItems={1}
          />
          <RangeSlider
            label="Height"
            unit="m"
            min={filterMetadata.heightRange.min}
            max={filterMetadata.heightRange.max}
            value={height}
            onChange={setHeight}
            step={0.5}
          />
          <RangeSlider
            label="Canopy"
            unit="m"
            min={filterMetadata.canopyRange.min}
            max={filterMetadata.canopyRange.max}
            value={canopy}
            onChange={setCanopy}
            step={0.5}
          />
          <RangeSlider
            label="Girth"
            unit="cm"
            min={filterMetadata.girthRange.min}
            max={filterMetadata.girthRange.max}
            value={girth}
            onChange={setGirth}
            step={10}
          />
          <RangeSlider
            label="CO₂"
            unit="kg"
            min={filterMetadata.co2Range.min}
            max={filterMetadata.co2Range.max}
            value={co2}
            onChange={setCO2}
            step={100}
            formatValue={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()}
          />
        </div>
      )}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading chart...</div>
      ) : error ? (
        <div className="text-center text-red-500 py-12">{error}</div>
      ) : (
        activeConfig && <DynamicChart config={activeConfig} data={data} />
      )}
    </div>
  );
};

export default CityOverviewCharts;
