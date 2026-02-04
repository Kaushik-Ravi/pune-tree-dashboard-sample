// src/components/sidebar/tabs/LandAnalysis.tsx
/**
 * LAND ANALYSIS TAB - Concrete vs Trees Analysis
 * ===============================================
 * 
 * This component provides:
 * - City-wide land cover breakdown (trees, built, grass, bare)
 * - Ward-level statistics with sorting and filtering
 * - Historical comparison (2019 vs current)
 * - Census validation status
 * 
 * Data sources:
 * - Tree census data (PostgreSQL)
 * - Dynamic World satellite classification (GEE)
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Trees,
  Leaf,
  Mountain,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

// Types
interface WardLandCover {
  ward_number: number;
  year: number;
  trees_pct: number;
  built_pct: number;
  grass_pct: number;
  bare_pct: number;
  is_sample?: boolean;
}

interface WardChange {
  ward_number: number;
  trees_lost_m2: number;
  trees_gained_m2: number;
  net_tree_change_m2: number;
  built_gained_m2: number;
  trees_to_built_m2: number;
}

interface WardStats {
  ward_number: number;
  tree_count: number;
  species_count: number;
  avg_canopy_m: number;
  total_canopy_area_ha: number;
}

interface LandCoverResponse {
  source: 'database' | 'pending';
  data?: WardLandCover[];
  sampleData?: WardLandCover[];
  message?: string;
  instructions?: string[];
}

interface WardStatsResponse {
  data: WardStats[];
  total_wards: number;
  summary: {
    total_trees: number;
    total_canopy_area_ha: string;
  };
}

// API base URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Color palette for land cover classes
const LAND_COVER_COLORS = {
  trees: '#397d49',
  built: '#c4281b',
  grass: '#88b053',
  bare: '#a59b8f',
  water: '#419bdf'
};

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  trend?: 'up' | 'down' | null;
}> = ({ icon, label, value, subValue, color, trend }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-start gap-3">
    <div 
      className="p-2 rounded-lg" 
      style={{ backgroundColor: `${color}20` }}
    >
      <span style={{ color }}>{icon}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 truncate">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-lg font-semibold text-gray-900">{value}</p>
        {trend === 'up' && <TrendingUp size={14} className="text-green-500" />}
        {trend === 'down' && <TrendingDown size={14} className="text-red-500" />}
      </div>
      {subValue && <p className="text-xs text-gray-400">{subValue}</p>}
    </div>
  </div>
);

// Progress Bar Component
const LandCoverBar: React.FC<{
  trees: number;
  built: number;
  grass: number;
  bare: number;
}> = ({ trees, built, grass, bare }) => (
  <div className="h-4 rounded-full overflow-hidden flex">
    <div 
      style={{ width: `${trees}%`, backgroundColor: LAND_COVER_COLORS.trees }}
      title={`Trees: ${trees.toFixed(1)}%`}
    />
    <div 
      style={{ width: `${built}%`, backgroundColor: LAND_COVER_COLORS.built }}
      title={`Built: ${built.toFixed(1)}%`}
    />
    <div 
      style={{ width: `${grass}%`, backgroundColor: LAND_COVER_COLORS.grass }}
      title={`Grass: ${grass.toFixed(1)}%`}
    />
    <div 
      style={{ width: `${bare}%`, backgroundColor: LAND_COVER_COLORS.bare }}
      title={`Bare: ${bare.toFixed(1)}%`}
    />
  </div>
);

// Ward Row Component
const WardRow: React.FC<{
  ward: WardLandCover;
  censusData?: WardStats;
  expanded: boolean;
  onToggle: () => void;
}> = ({ ward, censusData, expanded, onToggle }) => (
  <div className="border-b border-gray-100 last:border-0">
    <button
      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      onClick={onToggle}
    >
      <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
        {ward.ward_number}
      </span>
      <div className="flex-1">
        <LandCoverBar 
          trees={ward.trees_pct} 
          built={ward.built_pct}
          grass={ward.grass_pct}
          bare={ward.bare_pct}
        />
      </div>
      <span className="text-xs text-gray-500 w-12 text-right">
        {ward.trees_pct.toFixed(1)}%
      </span>
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
    
    {expanded && (
      <div className="px-3 py-3 bg-gray-50 text-sm space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: LAND_COVER_COLORS.trees }} />
            <span className="text-gray-600">Trees:</span>
            <span className="font-medium">{ward.trees_pct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: LAND_COVER_COLORS.built }} />
            <span className="text-gray-600">Built:</span>
            <span className="font-medium">{ward.built_pct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: LAND_COVER_COLORS.grass }} />
            <span className="text-gray-600">Grass:</span>
            <span className="font-medium">{ward.grass_pct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: LAND_COVER_COLORS.bare }} />
            <span className="text-gray-600">Bare:</span>
            <span className="font-medium">{ward.bare_pct.toFixed(1)}%</span>
          </div>
        </div>
        
        {censusData && (
          <div className="pt-2 border-t border-gray-200 mt-2">
            <p className="text-xs text-gray-500 mb-1">Census Data (2019):</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Trees: <span className="font-medium">{censusData.tree_count.toLocaleString()}</span></div>
              <div>Species: <span className="font-medium">{censusData.species_count}</span></div>
              <div>Avg Canopy: <span className="font-medium">{censusData.avg_canopy_m}m</span></div>
              <div>Canopy Area: <span className="font-medium">{censusData.total_canopy_area_ha} ha</span></div>
            </div>
          </div>
        )}
        
        {ward.is_sample && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle size={12} />
            Sample data - run GEE export for real values
          </p>
        )}
      </div>
    )}
  </div>
);

// Main Component
const LandAnalysis: React.FC = () => {
  const [landCoverData, setLandCoverData] = useState<WardLandCover[]>([]);
  const [wardStats, setWardStats] = useState<WardStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'pending' | 'sample'>('pending');
  const [expandedWard, setExpandedWard] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'ward' | 'trees' | 'built'>('trees');
  const [sortDesc, setSortDesc] = useState(true);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch land cover data
        const lcResponse = await fetch(`${API_BASE}/api/land-cover/wards`);
        const lcData: LandCoverResponse = await lcResponse.json();
        
        if (lcData.source === 'database' && lcData.data) {
          setLandCoverData(lcData.data);
          setDataSource('database');
        } else if (lcData.sampleData) {
          setLandCoverData(lcData.sampleData);
          setDataSource('sample');
        }
        
        // Fetch census ward stats
        const statsResponse = await fetch(`${API_BASE}/api/ward-stats`);
        const statsData: WardStatsResponse = await statsResponse.json();
        setWardStats(statsData.data || []);
        
      } catch (err) {
        console.error('Error fetching land analysis data:', err);
        setError('Failed to load data. Check API connection.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Calculate city-wide averages
  const cityAverages = React.useMemo(() => {
    if (landCoverData.length === 0) return null;
    
    const sum = landCoverData.reduce((acc, w) => ({
      trees: acc.trees + w.trees_pct,
      built: acc.built + w.built_pct,
      grass: acc.grass + w.grass_pct,
      bare: acc.bare + w.bare_pct
    }), { trees: 0, built: 0, grass: 0, bare: 0 });
    
    const count = landCoverData.length;
    return {
      trees: sum.trees / count,
      built: sum.built / count,
      grass: sum.grass / count,
      bare: sum.bare / count
    };
  }, [landCoverData]);

  // Sort wards
  const sortedWards = React.useMemo(() => {
    const sorted = [...landCoverData].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'ward':
          comparison = a.ward_number - b.ward_number;
          break;
        case 'trees':
          comparison = a.trees_pct - b.trees_pct;
          break;
        case 'built':
          comparison = a.built_pct - b.built_pct;
          break;
      }
      return sortDesc ? -comparison : comparison;
    });
    return sorted;
  }, [landCoverData, sortBy, sortDesc]);

  // Get census data for a ward
  const getWardCensusData = (wardNum: number): WardStats | undefined => {
    return wardStats.find(w => w.ward_number === wardNum);
  };

  // Total census trees
  const totalCensusTrees = React.useMemo(() => {
    return wardStats.reduce((sum, w) => sum + w.tree_count, 0);
  }, [wardStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400" size={24} />
        <span className="ml-2 text-gray-500">Loading land analysis...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg text-red-700">
        <p className="font-medium">Error loading data</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Land Cover Analysis</h3>
        {dataSource === 'sample' && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Sample Data
          </span>
        )}
      </div>

      {/* Data Source Notice */}
      {dataSource !== 'database' && (
        <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Satellite data not yet imported</p>
              <p className="text-xs mt-1">
                Run the Google Earth Engine export scripts to get real land cover data.
                <a 
                  href="https://code.earthengine.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-600 hover:underline inline-flex items-center gap-0.5"
                >
                  Open GEE <ExternalLink size={10} />
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* City-wide Stats */}
      {cityAverages && (
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={<Trees size={18} />}
            label="Tree Cover"
            value={`${cityAverages.trees.toFixed(1)}%`}
            subValue="City average"
            color={LAND_COVER_COLORS.trees}
          />
          <StatCard
            icon={<Building2 size={18} />}
            label="Built-up"
            value={`${cityAverages.built.toFixed(1)}%`}
            subValue="City average"
            color={LAND_COVER_COLORS.built}
          />
          <StatCard
            icon={<Leaf size={18} />}
            label="Grass/Vegetation"
            value={`${cityAverages.grass.toFixed(1)}%`}
            subValue="City average"
            color={LAND_COVER_COLORS.grass}
          />
          <StatCard
            icon={<Mountain size={18} />}
            label="Bare Ground"
            value={`${cityAverages.bare.toFixed(1)}%`}
            subValue="City average"
            color={LAND_COVER_COLORS.bare}
          />
        </div>
      )}

      {/* Census Summary */}
      <div className="p-3 bg-green-50 rounded-lg">
        <p className="text-xs text-green-700 font-medium mb-1">2019 Census Data</p>
        <p className="text-lg font-semibold text-green-900">
          {totalCensusTrees.toLocaleString()} trees
        </p>
        <p className="text-xs text-green-600">
          Across {wardStats.length} wards
        </p>
      </div>

      {/* City-wide Land Cover Bar */}
      {cityAverages && (
        <div>
          <p className="text-xs text-gray-500 mb-1">City Land Cover Breakdown</p>
          <LandCoverBar 
            trees={cityAverages.trees}
            built={cityAverages.built}
            grass={cityAverages.grass}
            bare={cityAverages.bare}
          />
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded" style={{ backgroundColor: LAND_COVER_COLORS.trees }} />
              Trees
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded" style={{ backgroundColor: LAND_COVER_COLORS.built }} />
              Built
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded" style={{ backgroundColor: LAND_COVER_COLORS.grass }} />
              Grass
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded" style={{ backgroundColor: LAND_COVER_COLORS.bare }} />
              Bare
            </span>
          </div>
        </div>
      )}

      {/* Ward List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Ward Breakdown</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Sort:</span>
            <button
              className={`px-2 py-0.5 rounded ${sortBy === 'trees' ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}
              onClick={() => { setSortBy('trees'); setSortDesc(true); }}
            >
              Trees ↓
            </button>
            <button
              className={`px-2 py-0.5 rounded ${sortBy === 'built' ? 'bg-red-100 text-red-700' : 'text-gray-500'}`}
              onClick={() => { setSortBy('built'); setSortDesc(true); }}
            >
              Built ↓
            </button>
            <button
              className={`px-2 py-0.5 rounded ${sortBy === 'ward' ? 'bg-gray-100 text-gray-700' : 'text-gray-500'}`}
              onClick={() => { setSortBy('ward'); setSortDesc(false); }}
            >
              Ward #
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
          {sortedWards.map(ward => (
            <WardRow
              key={ward.ward_number}
              ward={ward}
              censusData={getWardCensusData(ward.ward_number)}
              expanded={expandedWard === ward.ward_number}
              onToggle={() => setExpandedWard(
                expandedWard === ward.ward_number ? null : ward.ward_number
              )}
            />
          ))}
        </div>
      </div>

      {/* Methodology Note */}
      <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">
        <p className="font-medium mb-1">Data Sources & Methodology</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Land cover: Google Dynamic World V1 (10m resolution)</li>
          <li>Tree census: PMC Survey 2019 (1.79M trees)</li>
          <li>Ward boundaries: PMC Electoral Wards 2012</li>
        </ul>
      </div>
    </div>
  );
};

export default LandAnalysis;
