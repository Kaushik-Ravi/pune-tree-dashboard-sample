// src/components/sidebar/tabs/GreenCoverMonitor.tsx
/**
 * PUNE GREEN COVER MONITOR
 * =========================
 * 
 * A user-friendly dashboard for monitoring Pune's green cover changes.
 * Inspired by Global Forest Watch, Tree Equity Score, and Resource Watch.
 * 
 * SECTIONS:
 * 1. OVERVIEW - City-wide green score and key metrics (always visible)
 * 2. INSIGHTS - Key findings and historical timeline (expanded by default)
 * 3. WARD ANALYSIS - Leaderboard table with expandable rows + map controls
 * 4. DETAILED LAND ANALYSIS - High-resolution satellite raster layers
 * 
 * Features:
 * - Ward Green Score (0-100 composite score)
 * - Expandable ward rows with ward-specific details + map layer controls
 * - Ward dimming on map when a ward is selected
 * - Info buttons explaining use cases for different user types
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TreePine,
  Building2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Download,
  Map,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Flame,
  Target,
  Layers,
  Palette,
  Thermometer,
  Image,
  Leaf,
  Loader2,
  HelpCircle,
  MapPin,
  Satellite,
  Users,
  Briefcase,
  X,
  Focus,
  LayoutGrid
} from 'lucide-react';
import { useGreenCoverStore } from '../../../store/GreenCoverStore';
import { useLayerLoadingStore, rasterLayerToStoreType } from '../../../store/LayerLoadingStore';

// ============================================================================
// GREEN SCORE CALCULATION
// ============================================================================

/**
 * Calculate Ward Green Score (0-100)
 * 
 * Formula combines:
 * - Tree cover % (40% weight) - higher is better
 * - Built-up % (30% weight) - lower is better (inverted)
 * - Change trend (20% weight) - positive change is better
 * - Census tree density (10% weight) - bonus for tree-rich areas
 */
function calculateGreenScore(
  treesPct: number,
  builtPct: number,
  netChangePct: number,
  treeDensity: number // trees per hectare
): number {
  // Normalize tree cover (0-30% range typical for urban areas)
  const treeScore = Math.min(100, (treesPct / 25) * 100);
  
  // Invert built-up (higher built = lower score)
  const builtScore = Math.max(0, 100 - (builtPct / 90) * 100);
  
  // Change score (range roughly -10 to +10%)
  const changeScore = 50 + (netChangePct * 5); // Center at 50, adjust by change
  const normalizedChange = Math.max(0, Math.min(100, changeScore));
  
  // Tree density bonus (0-500 trees/ha is typical range)
  const densityScore = Math.min(100, (treeDensity / 300) * 100);
  
  // Weighted combination
  const score = (
    treeScore * 0.40 +
    builtScore * 0.30 +
    normalizedChange * 0.20 +
    densityScore * 0.10
  );
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e'; // Green - Good
  if (score >= 50) return '#eab308'; // Yellow - Moderate
  if (score >= 30) return '#f97316'; // Orange - At Risk
  return '#ef4444'; // Red - Critical
}

function getScoreLabel(score: number): string {
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'At Risk';
  return 'Critical';
}

function getScoreEmoji(score: number): string {
  if (score >= 70) return '🌳';
  if (score >= 50) return '🌿';
  if (score >= 30) return '⚠️';
  return '🚨';
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Score Ring Component
const ScoreRing: React.FC<{
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}> = ({ score, size = 'md', showLabel = true }) => {
  const sizes = {
    sm: { ring: 48, stroke: 4, text: 'text-sm' },
    md: { ring: 80, stroke: 6, text: 'text-xl' },
    lg: { ring: 120, stroke: 8, text: 'text-3xl' }
  };
  
  const { ring, stroke, text } = sizes[size];
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={ring} height={ring} className="transform -rotate-90">
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${text} font-bold`} style={{ color }}>{score}</span>
        {showLabel && size !== 'sm' && (
          <span className="text-xs text-gray-500">{getScoreLabel(score)}</span>
        )}
      </div>
    </div>
  );
};

// Timeline Slider Component
const TimelineSlider: React.FC<{
  years: number[];
  selectedYear: number;
  onChange: (year: number) => void;
  playing?: boolean;
  onPlayToggle?: () => void;
}> = ({ years, selectedYear, onChange, playing = false, onPlayToggle }) => {
  const currentIndex = years.indexOf(selectedYear);
  
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Year: {selectedYear}</span>
        {onPlayToggle && (
          <button
            onClick={onPlayToggle}
            className={`px-2 py-1 rounded text-xs ${
              playing ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => currentIndex > 0 && onChange(years[currentIndex - 1])}
          disabled={currentIndex === 0}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="range"
          min={0}
          max={years.length - 1}
          value={currentIndex}
          onChange={(e) => onChange(years[parseInt(e.target.value)])}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
        />
        <button
          onClick={() => currentIndex < years.length - 1 && onChange(years[currentIndex + 1])}
          disabled={currentIndex === years.length - 1}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-400">
        {years.map(year => (
          <span 
            key={year} 
            className={year === selectedYear ? 'text-green-600 font-medium' : ''}
          >
            {year}
          </span>
        ))}
      </div>
    </div>
  );
};

// Key Insight Component
const KeyInsight: React.FC<{
  icon: React.ReactNode;
  text: string;
  type: 'info' | 'warning' | 'success' | 'danger';
}> = ({ icon, text, type }) => {
  const colors = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    danger: 'bg-red-50 text-red-800 border-red-200'
  };
  
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border ${colors[type]}`}>
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
};

// Trend Chart (simple inline sparkline)
const TrendSparkline: React.FC<{
  values: number[];
  color: string;
  height?: number;
}> = ({ values, color, height = 32 }) => {
  if (values.length < 2) return null;
  
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width="100%" height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Highlight last point */}
      <circle
        cx={100}
        cy={height - ((values[values.length - 1] - min) / range) * height}
        r={3}
        fill={color}
      />
    </svg>
  );
};

// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================================================

interface SectionInfoContent {
  title: string;
  description: string;
  useCases: Array<{
    icon: React.ReactNode;
    userType: string;
    description: string;
  }>;
}

const SECTION_INFO: Record<string, SectionInfoContent> = {
  insights: {
    title: 'Key Insights & Timeline',
    description: 'Executive summary of Pune\'s green cover transformation from 2019-2025. View critical statistics like net tree gain/loss in hectares, built-up expansion, and yearly trends through an interactive timeline chart.',
    useCases: [
      { icon: <Briefcase size={14} />, userType: 'Policy Makers', description: 'Review city-wide environmental KPIs and 6-year trends for strategic planning' },
      { icon: <Users size={14} />, userType: 'Researchers', description: 'Access aggregated time-series data for academic analysis and publications' },
      { icon: <MapPin size={14} />, userType: 'Journalists', description: 'Find headline-worthy statistics and visual data for environmental reporting' },
    ]
  },
  wardAnalysis: {
    title: 'Ward-Level Analysis',
    description: 'Interactive leaderboard ranking all 77 wards by composite Green Score (0-100). Score factors: Tree Cover (40%), Built-up Inverse (30%), Change Trend (20%), Tree Density (10%). Click any ward to reveal map controls and fly to that location.',
    useCases: [
      { icon: <Briefcase size={14} />, userType: 'Urban Planners', description: 'Identify lowest-scoring wards for targeted greening interventions' },
      { icon: <Users size={14} />, userType: 'Municipal Officers', description: 'Monitor ward performance and track improvements in your jurisdiction' },
      { icon: <MapPin size={14} />, userType: 'Citizens & NGOs', description: 'Check your ward\'s health and compare with neighboring wards' },
    ]
  },
  detailedAnalysis: {
    title: 'Satellite Land Analysis',
    description: 'Explore 10-meter resolution satellite imagery derived from Sentinel-2 data. Toggle between: Tree Probability (2019/2025), Tree Change, NDVI, and Land Cover (showing trees, shrubs, built-up, etc.). Each layer has its own color legend.',
    useCases: [
      { icon: <TreePine size={14} />, userType: 'Tree Planters', description: 'Identify bare patches and low-tree zones suitable for new plantations' },
      { icon: <Target size={14} />, userType: 'Field Surveyors', description: 'Cross-verify satellite data against ground truth observations' },
      { icon: <Satellite size={14} />, userType: 'GIS Analysts', description: 'Analyze pixel-level vegetation patterns and land cover classification' },
    ]
  }
};

// Info Tooltip Component
const InfoTooltip: React.FC<{
  sectionKey: string;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ sectionKey, isOpen, onToggle }) => {
  const info = SECTION_INFO[sectionKey];
  if (!info) return null;

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
        title="What is this section for?"
      >
        <HelpCircle size={14} className="text-gray-400" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-6 z-50 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-800 text-sm">{info.title}</h4>
            <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-0.5 hover:bg-gray-100 rounded">
              <X size={14} className="text-gray-400" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mb-3">{info.description}</p>
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Who uses this:</p>
            {info.useCases.map((useCase, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className="text-blue-500 mt-0.5">{useCase.icon}</span>
                <div>
                  <span className="font-medium text-gray-700">{useCase.userType}:</span>
                  <span className="text-gray-600 ml-1">{useCase.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  showInfo?: boolean;
  badge?: React.ReactNode;
  className?: string;
}> = ({ id, title, icon, isExpanded, onToggle, children, showInfo = false, badge, className = '' }) => {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden bg-white ${className}`}>
      <button
        className="w-full p-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-600">{icon}</span>
          <span className="font-medium text-gray-700">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-1">
          {showInfo && (
            <InfoTooltip 
              sectionKey={id} 
              isOpen={infoOpen} 
              onToggle={() => setInfoOpen(!infoOpen)} 
            />
          )}
          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-3 border-t bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// WARD LEADERBOARD - Stock Market Style Unified Table with Expandable Rows
// ============================================================================

type SortColumn = 'rank' | 'ward' | 'score' | 'trees' | 'built' | 'ratio' | 'change';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'critical' | 'at-risk' | 'moderate' | 'good' | 'gaining' | 'losing';

// Hotspot configuration type (moved here for WardLeaderboard access)
export interface HotspotConfig {
  lossThreshold: number;
  colorScheme: 'red' | 'orange' | 'heatmap';
  opacity: number;
  showLabels: boolean;
  pulseAnimation: boolean;
}

// Land Cover Overlay configuration (moved here for WardLeaderboard access)
interface LandCoverOverlayConfigLocal {
  visible: boolean;
  mode: 'green' | 'built' | 'bivariate' | 'change';
  year: number;
  opacity: number;
  showLabels: boolean;
  greenColorScale: [string, string];
  builtColorScale: [string, string];
}

interface WardLeaderboardProps {
  wardScores: Array<{
    ward_number: number;
    treesPct: number;
    builtPct: number;
    score: number;
    netChangeHa: number;
    builtChangeHa: number;
    changePct: number;
    censusTreeCount: number;
    censusSpecies: number;
  }>;
  onWardClick: (wardNumber: number) => void;
  selectedYear: number;
  // Map layer control props
  showWardBoundaries?: boolean;
  onWardBoundariesToggle?: (enabled: boolean) => void;
  colorBy?: 'green_score' | 'trees_pct' | 'change';
  onColorByChange?: (colorBy: 'green_score' | 'trees_pct' | 'change') => void;
  showDeforestationHotspots?: boolean;
  onDeforestationHotspotsToggle?: (enabled: boolean) => void;
  landCoverConfig?: LandCoverOverlayConfigLocal;
  onLandCoverConfigChange?: (config: LandCoverOverlayConfigLocal) => void;
  // Loading states
  isWardOverlayLoading?: boolean;
  isDeforestationHotspotsLoading?: boolean;
}

const WardLeaderboard: React.FC<WardLeaderboardProps> = ({
  wardScores,
  onWardClick,
  selectedYear,
  // Map layer controls
  showWardBoundaries = false,
  onWardBoundariesToggle,
  colorBy = 'green_score',
  onColorByChange,
  showDeforestationHotspots = false,
  onDeforestationHotspotsToggle,
  landCoverConfig,
  onLandCoverConfigChange,
  // Loading states
  isWardOverlayLoading = false,
  isDeforestationHotspotsLoading = false,
}) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showAllRows, setShowAllRows] = useState(false);
  const [hoveredWard, setHoveredWard] = useState<number | null>(null);
  const [expandedWard, setExpandedWard] = useState<number | null>(null);
  const [showMapLayersDropdown, setShowMapLayersDropdown] = useState(false);
  
  // Handle ward row click - fly to ward AND toggle expanded state
  const handleWardRowClick = (wardNumber: number) => {
    if (expandedWard === wardNumber) {
      setExpandedWard(null); // Collapse if already expanded
    } else {
      setExpandedWard(wardNumber);
      onWardClick(wardNumber); // Fly to ward on map
    }
  };
  
  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      // Default direction based on column type
      setSortDirection(column === 'change' || column === 'score' || column === 'trees' || column === 'ratio' ? 'desc' : 'asc');
    }
  };
  
  // Filter wards based on selected filter
  const filteredWards = useMemo(() => {
    switch (filterType) {
      case 'critical': return wardScores.filter(w => w.score < 30);
      case 'at-risk': return wardScores.filter(w => w.score >= 30 && w.score < 50);
      case 'moderate': return wardScores.filter(w => w.score >= 50 && w.score < 70);
      case 'good': return wardScores.filter(w => w.score >= 70);
      case 'gaining': return wardScores.filter(w => w.changePct > 2);
      case 'losing': return wardScores.filter(w => w.changePct < -2);
      default: return wardScores;
    }
  }, [wardScores, filterType]);
  
  // Sort wards
  const sortedWards = useMemo(() => {
    const sorted = [...filteredWards].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case 'ward':
          comparison = a.ward_number - b.ward_number;
          break;
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'trees':
          comparison = a.treesPct - b.treesPct;
          break;
        case 'built':
          comparison = a.builtPct - b.builtPct;
          break;
        case 'ratio':
          const ratioA = a.builtPct > 0 ? a.treesPct / a.builtPct : 0;
          const ratioB = b.builtPct > 0 ? b.treesPct / b.builtPct : 0;
          comparison = ratioA - ratioB;
          break;
        case 'change':
          comparison = a.changePct - b.changePct;
          break;
        default:
          comparison = a.score - b.score;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredWards, sortColumn, sortDirection]);
  
  // Display count
  const displayedWards = showAllRows ? sortedWards : sortedWards.slice(0, 10);
  
  // Quick stats
  const quickStats = useMemo(() => {
    const critical = wardScores.filter(w => w.score < 30).length;
    const gaining = wardScores.filter(w => w.changePct > 2).length;
    const losing = wardScores.filter(w => w.changePct < -2).length;
    return { critical, gaining, losing };
  }, [wardScores]);
  
  // Column header component
  const ColumnHeader: React.FC<{
    column: SortColumn;
    label: string;
    icon?: React.ReactNode;
    className?: string;
  }> = ({ column, label, icon, className = '' }) => (
    <button
      onClick={() => handleSort(column)}
      className={`flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors ${className}`}
    >
      {icon}
      <span>{label}</span>
      {sortColumn === column && (
        sortDirection === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
      )}
    </button>
  );
  
  // Get row background based on performance
  const getRowBg = (ward: typeof wardScores[0], isHovered: boolean) => {
    if (isHovered) return 'bg-blue-50';
    if (ward.changePct < -5) return 'bg-red-50/50';
    if (ward.changePct > 5) return 'bg-green-50/50';
    return 'bg-white';
  };
  
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" />
            <span className="font-semibold text-gray-800">Ward Leaderboard</span>
          </div>
          <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border">
            {selectedYear}
          </span>
        </div>
        
        {/* Quick Stats Pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterType(filterType === 'all' ? 'all' : 'all')}
            className={`px-2 py-1 text-xs rounded-full transition-colors ${
              filterType === 'all' 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All {wardScores.length}
          </button>
          <button
            onClick={() => setFilterType(filterType === 'critical' ? 'all' : 'critical')}
            className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
              filterType === 'critical' 
                ? 'bg-red-100 text-red-700 border border-red-300' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Flame size={10} /> Critical {quickStats.critical}
          </button>
          <button
            onClick={() => setFilterType(filterType === 'losing' ? 'all' : 'losing')}
            className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
              filterType === 'losing' 
                ? 'bg-orange-100 text-orange-700 border border-orange-300' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <TrendingDown size={10} /> Losing {quickStats.losing}
          </button>
          <button
            onClick={() => setFilterType(filterType === 'gaining' ? 'all' : 'gaining')}
            className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
              filterType === 'gaining' 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <TrendingUp size={10} /> Gaining {quickStats.gaining}
          </button>
        </div>
      </div>
      
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-gray-50 border-b text-xs sticky top-0">
        <ColumnHeader column="rank" label="#" className="col-span-1 justify-center" />
        <ColumnHeader column="ward" label="Ward" className="col-span-2" />
        <ColumnHeader column="score" label="Score" icon={<Target size={10} />} className="col-span-2 justify-center" />
        <ColumnHeader column="trees" label="Trees" icon={<TreePine size={10} />} className="col-span-2 justify-center" />
        <ColumnHeader column="built" label="Built" icon={<Building2 size={10} />} className="col-span-2 justify-center" />
        <ColumnHeader column="change" label="Δ2019" icon={<TrendingUp size={10} />} className="col-span-3 justify-center" />
      </div>
      
      {/* Table Body */}
      <div className="max-h-96 overflow-y-auto">
        {displayedWards.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No wards match the current filter
          </div>
        ) : (
          displayedWards.map((ward) => {
            const rank = sortedWards.indexOf(ward) + 1;
            const isHovered = hoveredWard === ward.ward_number;
            const isExpanded = expandedWard === ward.ward_number;
            
            return (
              <div key={ward.ward_number} className="border-b border-gray-100">
                {/* Main Row - Clickable */}
                <button
                  onClick={() => handleWardRowClick(ward.ward_number)}
                  onMouseEnter={() => setHoveredWard(ward.ward_number)}
                  onMouseLeave={() => setHoveredWard(null)}
                  className={`w-full grid grid-cols-12 gap-1 px-3 py-2 transition-all hover:shadow-sm cursor-pointer text-left ${
                    isExpanded ? 'bg-blue-50 border-l-4 border-l-blue-500' : getRowBg(ward, isHovered)
                  }`}
                >
                  {/* Rank */}
                  <div className="col-span-1 flex items-center justify-center">
                    <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                      rank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {rank}
                    </span>
                  </div>
                  
                  {/* Ward Number + Expand indicator */}
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="font-medium text-sm text-gray-800">W{ward.ward_number}</span>
                    {isExpanded ? (
                      <ChevronUp size={12} className="text-blue-500" />
                    ) : (
                      <ChevronDown size={12} className="text-gray-400" />
                    )}
                  </div>
                  
                  {/* Green Score with ring */}
                  <div className="col-span-2 flex items-center justify-center">
                    <div className="relative w-8 h-8">
                      <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="12" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                        <circle
                          cx="16" cy="16" r="12" fill="none"
                          stroke={getScoreColor(ward.score || 0)}
                          strokeWidth="3"
                          strokeDasharray={`${((ward.score || 0) / 100) * 75.4} 75.4`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: getScoreColor(ward.score || 0) }}>
                        {isNaN(ward.score) || ward.score == null ? '–' : ward.score}
                      </span>
                    </div>
                  </div>
                  
                  {/* Trees % */}
                  <div className="col-span-2 flex flex-col items-center justify-center">
                    <span className="text-sm font-medium text-green-700">{isNaN(ward.treesPct) ? '–' : ward.treesPct.toFixed(1)}%</span>
                    <div className="w-full h-1 bg-gray-200 rounded-full mt-0.5">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${Math.min(100, (ward.treesPct || 0) * 4)}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Built % */}
                  <div className="col-span-2 flex flex-col items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">{isNaN(ward.builtPct) ? '–' : ward.builtPct.toFixed(1)}%</span>
                    <div className="w-full h-1 bg-gray-200 rounded-full mt-0.5">
                      <div
                        className="h-full bg-gray-500 rounded-full"
                        style={{ width: `${Math.min(100, ward.builtPct || 0)}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Change */}
                  <div className="col-span-3 flex items-center justify-center gap-1">
                    {isNaN(ward.changePct) || ward.changePct == null ? (
                      <span className="text-sm font-medium text-gray-400">–</span>
                    ) : (
                      <span className={`flex items-center gap-0.5 text-sm font-medium ${
                        ward.changePct > 0 ? 'text-green-600' : ward.changePct < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {ward.changePct > 0 ? <TrendingUp size={12} /> : ward.changePct < 0 ? <TrendingDown size={12} /> : null}
                        {ward.changePct > 0 ? '+' : ''}{ward.changePct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </button>
                
                {/* Expanded Content - Ward Details + Map Controls */}
                {isExpanded && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-3 border-l-4 border-l-blue-500 animate-in slide-in-from-top-2 duration-200">
                    {/* Ward Details */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs text-gray-500">Census Trees</p>
                        <p className="text-lg font-bold text-green-700">{ward.censusTreeCount.toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs text-gray-500">Tree Species</p>
                        <p className="text-lg font-bold text-blue-700">{ward.censusSpecies}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs text-gray-500">Net Tree Change</p>
                        <p className={`text-lg font-bold ${ward.netChangeHa >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {ward.netChangeHa >= 0 ? '+' : ''}{ward.netChangeHa.toFixed(1)} ha
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs text-gray-500">Built-up Change</p>
                        <p className="text-lg font-bold text-gray-700">+{ward.builtChangeHa.toFixed(1)} ha</p>
                      </div>
                    </div>
                    
                    {/* Map Layer Controls */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                        <Map size={12} /> Visualize on Map:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {/* Ward Boundaries Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onWardBoundariesToggle?.(!showWardBoundaries);
                          }}
                          disabled={isWardOverlayLoading}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-all ${
                            showWardBoundaries
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                          } ${isWardOverlayLoading ? 'opacity-75 cursor-wait' : ''}`}
                        >
                          {isWardOverlayLoading ? <Loader2 size={12} className="animate-spin" /> : <LayoutGrid size={12} />}
                          Ward Boundaries
                        </button>
                        
                        {/* Land Cover Overlay Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLandCoverConfigChange?.({ ...landCoverConfig!, visible: !landCoverConfig?.visible });
                          }}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-all ${
                            landCoverConfig?.visible
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <Layers size={12} />
                          Land Cover
                        </button>
                        
                        {/* Fly to Ward Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onWardClick(ward.ward_number);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-all"
                        >
                          <Focus size={12} />
                          Center on Map
                        </button>
                      </div>
                      
                      {/* Color By selector when ward boundaries are visible */}
                      {showWardBoundaries && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <p className="text-xs text-gray-500 mb-1">Color wards by:</p>
                          <div className="flex rounded-lg overflow-hidden border border-gray-200">
                            <button
                              onClick={(e) => { e.stopPropagation(); onColorByChange?.('green_score'); }}
                              className={`flex-1 px-2 py-1 text-xs ${colorBy === 'green_score' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-500'}`}
                            >
                              Score
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onColorByChange?.('trees_pct'); }}
                              className={`flex-1 px-2 py-1 text-xs ${colorBy === 'trees_pct' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-500'}`}
                            >
                              Trees %
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onColorByChange?.('change'); }}
                              className={`flex-1 px-2 py-1 text-xs ${colorBy === 'change' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-500'}`}
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Show More/Less Footer */}
      {sortedWards.length > 10 && (
        <div className="p-2 border-t bg-gray-50">
          <button
            onClick={() => setShowAllRows(!showAllRows)}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-700 py-1 hover:bg-blue-50 rounded transition-colors"
          >
            {showAllRows ? 'Show Top 10' : `Show All ${sortedWards.length} Wards`}
          </button>
        </div>
      )}
      
      {/* Global Map Controls Footer */}
      <div className="px-3 py-3 bg-gradient-to-r from-slate-50 to-gray-50 border-t space-y-2">
        <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
          <Map size={12} /> Quick Ward Visualizations:
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onWardBoundariesToggle?.(!showWardBoundaries)}
            disabled={isWardOverlayLoading}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
              showWardBoundaries
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            } ${isWardOverlayLoading ? 'opacity-75 cursor-wait' : ''}`}
          >
            {isWardOverlayLoading ? <Loader2 size={14} className="animate-spin" /> : <LayoutGrid size={14} />}
            {showWardBoundaries ? 'Hide Boundaries' : 'Show Boundaries'}
          </button>
          
          <button
            onClick={() => onLandCoverConfigChange?.({ ...landCoverConfig!, visible: !landCoverConfig?.visible })}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
              landCoverConfig?.visible
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Layers size={14} />
            {landCoverConfig?.visible ? 'Hide Land Cover' : 'Land Cover Overlay'}
          </button>
          
          <button
            onClick={() => onDeforestationHotspotsToggle?.(!showDeforestationHotspots)}
            disabled={isDeforestationHotspotsLoading}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
              showDeforestationHotspots
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            } ${isDeforestationHotspotsLoading ? 'opacity-75 cursor-wait' : ''}`}
          >
            {isDeforestationHotspotsLoading ? <Loader2 size={14} className="animate-spin" /> : <Flame size={14} />}
            {showDeforestationHotspots ? 'Hide Hotspots' : 'Deforestation Hotspots'}
          </button>
        </div>
      </div>
      
      {/* Info footer */}
      <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-t text-xs text-gray-500 flex items-center gap-2">
        <Info size={12} />
        <span>Click any row to expand details and map options. Sort by column headers.</span>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Land Cover Overlay configuration
interface LandCoverOverlayConfig {
  visible: boolean;
  mode: 'green' | 'built' | 'bivariate' | 'change';
  year: number;
  opacity: number;
  showLabels: boolean;
  greenColorScale: [string, string];
  builtColorScale: [string, string];
}

// Raster Overlay configuration (continuous heatmap)
type RasterLayerType = 'tree_probability_2025' | 'tree_probability_2019' | 'tree_change' | 'tree_loss_gain' | 'ndvi' | 'landcover';

interface RasterOverlayConfig {
  visible: boolean;
  layer: RasterLayerType;
  opacity: number;
}

interface GreenCoverMonitorProps {
  // Map integration props - controlled from parent
  showWardBoundaries?: boolean;
  onWardBoundariesToggle?: (enabled: boolean) => void;
  selectedYear?: number;
  onYearChange?: (year: number) => void;
  colorBy?: 'green_score' | 'trees_pct' | 'change';
  onColorByChange?: (colorBy: 'green_score' | 'trees_pct' | 'change') => void;
  // Deforestation hotspots layer
  showDeforestationHotspots?: boolean;
  onDeforestationHotspotsToggle?: (enabled: boolean) => void;
  hotspotConfig?: HotspotConfig;
  onHotspotConfigChange?: (config: HotspotConfig) => void;
  // Land Cover Overlay
  landCoverConfig?: LandCoverOverlayConfig;
  onLandCoverConfigChange?: (config: LandCoverOverlayConfig) => void;
  // Raster Overlay (continuous heatmap)
  rasterConfig?: RasterOverlayConfig;
  onRasterConfigChange?: (config: RasterOverlayConfig) => void;
}

const GreenCoverMonitor: React.FC<GreenCoverMonitorProps> = ({
  showWardBoundaries = false,
  onWardBoundariesToggle,
  selectedYear: externalYear,
  onYearChange,
  colorBy = 'green_score',
  onColorByChange,
  showDeforestationHotspots = false,
  onDeforestationHotspotsToggle,
  hotspotConfig = { lossThreshold: 0.1, colorScheme: 'red', opacity: 0.6, showLabels: true, pulseAnimation: true },
  onHotspotConfigChange,
  landCoverConfig = { 
    visible: false, 
    mode: 'bivariate', 
    year: 2025, 
    opacity: 0.7, 
    showLabels: true, 
    greenColorScale: ['#f7fcf5', '#00441b'],
    builtColorScale: ['#fff5f0', '#67000d']
  },
  onLandCoverConfigChange,
  rasterConfig = {
    visible: false,
    layer: 'tree_probability_2025',
    opacity: 0.7
  },
  onRasterConfigChange,
}) => {
  // Use Zustand store for data (cached in localStorage)
  const {
    timelineData,
    wardData,
    comparisonData,
    wardStats,
    isLoading: loading,
    error,
    fetchAllData,
    flyToWard
  } = useGreenCoverStore();
  
  // Layer loading states for UI feedback
  const isWardOverlayLoading = useLayerLoadingStore(state => state.isLoading('ward_overlay'));
  const isDeforestationHotspotsLoading = useLayerLoadingStore(state => state.isLoading('deforestation_hotspots'));
  const isAnyRasterLoading = useLayerLoadingStore(state => state.isAnyRasterLoading());
  const isCurrentRasterLoading = useLayerLoadingStore(state => 
    rasterConfig?.layer ? state.isLoading(rasterLayerToStoreType(rasterConfig.layer)) : false
  );
  
  // Fetch data on mount (uses cache if fresh)
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);
  
  // Handle ward click - fly to ward on map and enable boundaries if needed
  const handleWardClick = (wardNumber: number) => {
    // Enable ward boundaries if not already visible
    if (!showWardBoundaries && onWardBoundariesToggle) {
      onWardBoundariesToggle(true);
    }
    // Trigger map fly to ward
    flyToWard(wardNumber);
  };
  
  // UI State - use external year if provided, otherwise use internal state
  const [internalYear, setInternalYear] = useState(2025);
  const selectedYear = externalYear ?? internalYear;
  const handleYearChange = (year: number) => {
    if (onYearChange) {
      onYearChange(year);
    } else {
      setInternalYear(year);
    }
  };
  
  const [viewMode, setViewMode] = useState<'current' | 'change'>('current');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [playing, setPlaying] = useState(false);
  
  // Section expansion state - Overview is always visible, others are collapsible
  const [sectionsExpanded, setSectionsExpanded] = useState({
    insights: true,      // Expanded by default per user request
    wardAnalysis: true,  // Expanded by default per user request
    detailedAnalysis: false,  // Collapsed by default for granular/advanced users
  });
  
  const toggleSection = useCallback((section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);
  
  // Years for timeline
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  
  // Animation playback
  useEffect(() => {
    if (!playing) return;
    
    const interval = setInterval(() => {
      const currentIndex = years.indexOf(selectedYear);
      if (currentIndex >= years.length - 1) {
        setPlaying(false);
        handleYearChange(years[0]);
      } else {
        handleYearChange(years[currentIndex + 1]);
      }
    }, 1500);
    
    return () => clearInterval(interval);
  }, [playing, selectedYear]);
  
  // Calculate city-wide green score
  const cityGreenScore = useMemo(() => {
    if (!timelineData?.years?.length) return 0;
    
    const latestYear = timelineData.years.find(y => y.year === 2025) || timelineData.years[timelineData.years.length - 1];
    const treesPct = parseFloat(latestYear.avg_trees_pct);
    const builtPct = parseFloat(latestYear.avg_built_pct);
    
    const netChange = timelineData.overall_2019_2025 
      ? parseFloat(timelineData.overall_2019_2025.net_tree_change_ha) 
      : 0;
    const totalArea = parseFloat(latestYear.total_trees_area_ha) + parseFloat(latestYear.total_built_area_ha);
    const changePct = (netChange / totalArea) * 100;
    
    // Safely handle wardStats - ensure it's an array
    const statsArray = Array.isArray(wardStats) ? wardStats : [];
    const totalTrees = statsArray.reduce((sum, w) => sum + (w.tree_count || 0), 0);
    const treeDensity = totalArea > 0 ? totalTrees / (totalArea / 100) : 0; // trees per ha
    
    return calculateGreenScore(treesPct, builtPct, changePct, treeDensity);
  }, [timelineData, wardStats]);
  
  // Ward scores with rankings
  const wardScores = useMemo(() => {
    // Ensure wardData is an array
    const wardDataArray = Array.isArray(wardData) ? wardData : [];
    const currentYearData = wardDataArray.filter(w => w.year === selectedYear);
    
    // Ensure wardStats is an array
    const statsArray = Array.isArray(wardStats) ? wardStats : [];
    const comparisonArray = Array.isArray(comparisonData) ? comparisonData : [];
    
    return currentYearData.map(ward => {
      const comparison = comparisonArray.find(c => c.ward_number === ward.ward_number);
      const census = statsArray.find(s => s.ward_number === ward.ward_number);
      
      // Parse all values to numbers (API returns strings)
      const treesPct = ward.trees_pct != null 
        ? (typeof ward.trees_pct === 'string' ? parseFloat(ward.trees_pct) : ward.trees_pct)
        : 0;
      const builtPct = ward.built_pct != null
        ? (typeof ward.built_pct === 'string' ? parseFloat(ward.built_pct) : ward.built_pct)
        : 0;
      const totalAreaM2 = ward.total_area_m2 != null
        ? (typeof ward.total_area_m2 === 'string' ? parseFloat(ward.total_area_m2) : ward.total_area_m2)
        : 1; // Avoid division by zero
      
      const netChange = comparison ? parseFloat(comparison.net_tree_change_m2) / 10000 : 0;
      const builtChangeHa = comparison ? parseFloat(comparison.built_gained_m2) / 10000 : 0;
      const totalArea = totalAreaM2 / 10000 || 1; // Ensure non-zero
      const changePct = isNaN(netChange) || isNaN(totalArea) ? 0 : (netChange / totalArea) * 100;
      const treeDensity = census ? census.tree_count / totalArea : 0;
      
      const score = calculateGreenScore(
        treesPct,
        builtPct,
        changePct,
        treeDensity
      );
      
      return {
        ...ward,
        treesPct, // parsed number
        builtPct, // parsed number
        score,
        netChangeHa: netChange,
        builtChangeHa, // built-up change in hectares
        changePct,
        censusTreeCount: census?.tree_count || 0,
        censusSpecies: census?.species_count || 0
      };
    }).sort((a, b) => b.score - a.score);
  }, [wardData, selectedYear, comparisonData, wardStats]);
  
  // Tree cover trend values for sparkline
  const treesTrend = useMemo(() => {
    if (!timelineData?.years) return [];
    return timelineData.years.map(y => parseFloat(y.avg_trees_pct));
  }, [timelineData]);
  
  // Critical wards count
  const criticalWardsCount = useMemo(() => {
    return wardScores.filter(w => w.score < 30).length;
  }, [wardScores]);
  
  // Key insights
  const insights = useMemo(() => {
    if (!timelineData?.overall_2019_2025) return [];
    
    const overall = timelineData.overall_2019_2025;
    const netChange = parseFloat(overall.net_tree_change_ha);
    const treesLost = parseFloat(overall.total_trees_lost_ha);
    const builtGained = parseFloat(overall.total_built_gained_ha);
    
    const result = [];
    
    if (netChange > 0) {
      result.push({
        icon: <TrendingUp size={16} />,
        text: `Pune gained ${netChange.toFixed(0)} hectares of green cover since 2019`,
        type: 'success' as const
      });
    } else {
      result.push({
        icon: <TrendingDown size={16} />,
        text: `Pune lost ${Math.abs(netChange).toFixed(0)} hectares of green cover since 2019`,
        type: 'danger' as const
      });
    }
    
    if (criticalWardsCount > 0) {
      result.push({
        icon: <AlertCircle size={16} />,
        text: `${criticalWardsCount} wards are in critical condition (score < 30)`,
        type: 'warning' as const
      });
    }
    
    result.push({
      icon: <Building2 size={16} />,
      text: `${builtGained.toFixed(0)} hectares of new construction since 2019`,
      type: 'info' as const
    });
    
    if (treesLost > 100) {
      result.push({
        icon: <AlertTriangle size={16} />,
        text: `${treesLost.toFixed(0)} hectares of tree cover converted to other uses`,
        type: 'warning' as const
      });
    }
    
    return result;
  }, [timelineData, criticalWardsCount]);
  
  // Loading state - Engaging tree-themed animation
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4 px-4">
        {/* Animated tree growing effect */}
        <div className="relative">
          {/* Background pulse */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-green-100 rounded-full animate-ping opacity-30"></div>
          </div>
          
          {/* Main icon with bounce */}
          <div className="relative z-10 flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full shadow-lg">
            <TreePine className="text-white animate-bounce" size={32} />
          </div>
          
          {/* Orbiting leaf */}
          <div className="absolute -top-2 -right-2 animate-spin" style={{ animationDuration: '3s' }}>
            <div className="w-6 h-6 bg-green-200 rounded-full flex items-center justify-center">
              <Leaf className="text-green-600" size={14} />
            </div>
          </div>
        </div>
        
        {/* Loading text with rotating messages */}
        <div className="text-center space-y-2">
          <p className="font-medium text-gray-700">Loading Green Cover Monitor</p>
          <p className="text-sm text-gray-500 animate-pulse">
            Analyzing satellite data for {wardData.length > 0 ? wardData.length : 77} wards...
          </p>
        </div>
        
        {/* Progress indicator */}
        <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-loading-bar"></div>
        </div>
        
        {/* Fun fact */}
        <div className="text-xs text-gray-400 text-center max-w-xs mt-2">
          💡 Pune has over 1.7 million cataloged trees spanning 77 administrative wards
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg text-red-700">
        <p className="font-medium flex items-center gap-2">
          <AlertTriangle size={18} />
          Error loading data
        </p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <TreePine className="text-green-600" size={20} />
            Pune Green Cover Monitor
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Satellite analysis • 2019-2025
          </p>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`p-1.5 rounded-lg transition-colors ${
            showAdvanced ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100'
          }`}
          title="Advanced Options"
        >
          <Settings2 size={18} />
        </button>
      </div>
      
      {/* City Green Score - Hero Section */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
        <div className="flex items-center gap-4">
          <ScoreRing score={cityGreenScore} size="lg" />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800">City Green Score</h4>
            <p className="text-sm text-gray-600 mt-1">
              {getScoreEmoji(cityGreenScore)} Pune's overall green health is <strong>{getScoreLabel(cityGreenScore).toLowerCase()}</strong>
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1">
                <TreePine size={12} className="text-green-600" />
                {timelineData?.years.find(y => y.year === 2025)?.avg_trees_pct || '0'}% tree cover
              </span>
              <span className="flex items-center gap-1">
                <Building2 size={12} className="text-red-500" />
                {timelineData?.years.find(y => y.year === 2025)?.avg_built_pct || '0'}% built-up
              </span>
            </div>
          </div>
        </div>
        
        {/* Mini trend */}
        {treesTrend.length > 0 && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Tree Cover Trend (2019-2025)</span>
              <span className="font-medium text-green-600">{treesTrend[treesTrend.length - 1].toFixed(1)}%</span>
            </div>
            <TrendSparkline values={treesTrend} color="#22c55e" height={24} />
          </div>
        )}
      </div>
      
      {/* ========== SECTION 2: INSIGHTS ========== */}
      <CollapsibleSection
        id="insights"
        title="Insights & Timeline"
        icon={<Info size={16} />}
        isExpanded={sectionsExpanded.insights}
        onToggle={() => toggleSection('insights')}
        showInfo={true}
        badge={criticalWardsCount > 0 ? (
          <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{criticalWardsCount} critical</span>
        ) : undefined}
      >
        {/* Key Insights */}
        <div className="space-y-2 mb-4">
          {insights.map((insight, i) => (
            <KeyInsight key={i} {...insight} />
          ))}
        </div>
        
        {/* Timeline */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          <TimelineSlider
            years={years}
            selectedYear={selectedYear}
            onChange={handleYearChange}
            playing={playing}
            onPlayToggle={() => setPlaying(!playing)}
          />
          
          {/* Year stats */}
          {timelineData?.years && (
            <div className="grid grid-cols-2 gap-2 text-center">
              {(() => {
                const yearData = timelineData.years.find(y => y.year === selectedYear);
                if (!yearData) return null;
                return (
                  <>
                    <div className="bg-white rounded-lg p-2 border">
                      <p className="text-lg font-bold text-green-700">{parseFloat(yearData.avg_trees_pct).toFixed(1)}%</p>
                      <p className="text-xs text-green-600">Tree Cover</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <p className="text-lg font-bold text-red-700">{parseFloat(yearData.avg_built_pct).toFixed(1)}%</p>
                      <p className="text-xs text-red-600">Built-up</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <p className="text-lg font-bold text-blue-700">{parseFloat(yearData.total_trees_area_ha).toLocaleString()}</p>
                      <p className="text-xs text-blue-600">Tree Area (ha)</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <p className="text-lg font-bold text-gray-700">{yearData.ward_count}</p>
                      <p className="text-xs text-gray-600">Wards Analyzed</p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </CollapsibleSection>
      
      {/* ========== SECTION 3: WARD ANALYSIS ========== */}
      <CollapsibleSection
        id="wardAnalysis"
        title="Ward Analysis"
        icon={<BarChart3 size={16} />}
        isExpanded={sectionsExpanded.wardAnalysis}
        onToggle={() => toggleSection('wardAnalysis')}
        showInfo={true}
        badge={<span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{wardScores.length} wards</span>}
      >
        <WardLeaderboard
          wardScores={wardScores}
          onWardClick={handleWardClick}
          selectedYear={selectedYear}
          // Map layer control props
          showWardBoundaries={showWardBoundaries}
          onWardBoundariesToggle={onWardBoundariesToggle}
          colorBy={colorBy}
          onColorByChange={onColorByChange}
          showDeforestationHotspots={showDeforestationHotspots}
          onDeforestationHotspotsToggle={onDeforestationHotspotsToggle}
          landCoverConfig={landCoverConfig}
          onLandCoverConfigChange={onLandCoverConfigChange}
          // Loading states
          isWardOverlayLoading={isWardOverlayLoading}
          isDeforestationHotspotsLoading={isDeforestationHotspotsLoading}
        />
      </CollapsibleSection>
      
      {/* Advanced Mode */}
      {showAdvanced && (
        <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
          <h4 className="font-medium text-gray-700 flex items-center gap-2">
            <Settings2 size={16} />
            Advanced Options
          </h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">View Mode</span>
              <div className="flex rounded-lg overflow-hidden border">
                <button
                  className={`px-3 py-1 ${viewMode === 'current' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600'}`}
                  onClick={() => setViewMode('current')}
                >
                  Current State
                </button>
                <button
                  className={`px-3 py-1 ${viewMode === 'change' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600'}`}
                  onClick={() => setViewMode('change')}
                >
                  Change Map
                </button>
              </div>
            </div>
            
            <button className="w-full flex items-center justify-center gap-2 p-2 bg-white border rounded-lg hover:bg-gray-100 transition-colors">
              <Download size={16} />
              Export Data (CSV)
            </button>
          </div>
          
          <div className="text-xs text-gray-500 border-t pt-3 mt-3">
            <p className="font-medium mb-1">Data Sources & Methodology</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Land cover: Google Dynamic World V1 (10m resolution)</li>
              <li>Tree census: PMC Survey 2019 (1.79M trees)</li>
              <li>Ward boundaries: PMC Electoral Wards</li>
              <li>Green Score: Composite of tree%, built%, change, density</li>
            </ul>
          </div>
        </div>
      )}
      
      {/* ========== SECTION 4: DETAILED LAND ANALYSIS ========== */}
      <CollapsibleSection
        id="detailedAnalysis"
        title="Detailed Land Analysis"
        icon={<Satellite size={16} />}
        isExpanded={sectionsExpanded.detailedAnalysis}
        onToggle={() => toggleSection('detailedAnalysis')}
        showInfo={true}
        badge={<span className="px-1.5 py-0.5 text-xs bg-cyan-100 text-cyan-700 rounded-full">10m satellite</span>}
      >
        {/* Note: Ward-based visualizations (Boundaries, Land Cover Overlay, Deforestation Hotspots)
           are now accessible through the Ward Analysis section above via expandable rows */}
        
        {/* High-Resolution Raster / Satellite Layer */}
        <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-lg p-4 border border-cyan-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Satellite size={18} className="text-cyan-600" />
              <div>
                <span className="font-medium text-gray-800">Satellite Raster</span>
                <p className="text-xs text-gray-500">10m resolution continuous heatmap</p>
              </div>
            </div>
            <button
              onClick={() => onRasterConfigChange?.({ ...rasterConfig, visible: !rasterConfig.visible })}
              disabled={isCurrentRasterLoading}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                rasterConfig.visible
                  ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              } ${isCurrentRasterLoading ? 'opacity-75 cursor-wait' : ''}`}
            >
              {isCurrentRasterLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : rasterConfig.visible ? (
                <EyeOff size={14} />
              ) : (
                <Eye size={14} />
              )}
              {isCurrentRasterLoading 
                ? 'Loading...' 
                : rasterConfig.visible 
                  ? 'Hide Raster' 
                  : 'Show Raster'}
            </button>
          </div>
          
          {rasterConfig.visible && (
            <div className="space-y-3">
              {/* Layer Selection */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Select layer:</p>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    className={`px-2 py-2 text-xs rounded-lg transition-colors flex flex-col items-center gap-1 ${
                      rasterConfig.layer === 'tree_probability_2025'
                        ? 'bg-green-100 text-green-700 font-medium ring-2 ring-green-400'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                    onClick={() => onRasterConfigChange?.({ ...rasterConfig, layer: 'tree_probability_2025' })}
                  >
                    <TreePine size={14} />
                    <span>Tree 2025</span>
                  </button>
                  <button
                    className={`px-2 py-2 text-xs rounded-lg transition-colors flex flex-col items-center gap-1 ${
                      rasterConfig.layer === 'tree_probability_2019'
                        ? 'bg-green-100 text-green-700 font-medium ring-2 ring-green-400'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                    onClick={() => onRasterConfigChange?.({ ...rasterConfig, layer: 'tree_probability_2019' })}
                  >
                    <TreePine size={14} />
                    <span>Tree 2019</span>
                  </button>
                  <button
                    className={`px-2 py-2 text-xs rounded-lg transition-colors flex flex-col items-center gap-1 ${
                      rasterConfig.layer === 'tree_change'
                        ? 'bg-amber-100 text-amber-700 font-medium ring-2 ring-amber-400'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                    onClick={() => onRasterConfigChange?.({ ...rasterConfig, layer: 'tree_change' })}
                  >
                    <TrendingUp size={14} />
                    <span>Tree Change</span>
                  </button>
                  <button
                    className={`px-2 py-2 text-xs rounded-lg transition-colors flex flex-col items-center gap-1 ${
                      rasterConfig.layer === 'ndvi'
                        ? 'bg-lime-100 text-lime-700 font-medium ring-2 ring-lime-400'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                    onClick={() => onRasterConfigChange?.({ ...rasterConfig, layer: 'ndvi' })}
                  >
                    <Thermometer size={14} />
                    <span>NDVI</span>
                  </button>
                  <button
                    className={`px-2 py-2 text-xs rounded-lg transition-colors flex flex-col items-center gap-1 ${
                      rasterConfig.layer === 'landcover'
                        ? 'bg-purple-100 text-purple-700 font-medium ring-2 ring-purple-400'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                    onClick={() => onRasterConfigChange?.({ ...rasterConfig, layer: 'landcover' })}
                  >
                    <Layers size={14} />
                    <span>Land Cover</span>
                  </button>
                </div>
                
                {/* Loading indicator */}
                {isCurrentRasterLoading && (
                  <div className="flex items-center justify-center gap-2 py-2 text-cyan-600">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs font-medium">Loading satellite imagery...</span>
                  </div>
                )}
              </div>
              
              {/* Opacity Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">Opacity:</span>
                  <span className="text-gray-700 font-medium">{Math.round(rasterConfig.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={rasterConfig.opacity * 100}
                  onChange={(e) => onRasterConfigChange?.({ 
                    ...rasterConfig, 
                    opacity: parseInt(e.target.value) / 100 
                  })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
              
              {/* Legend */}
              <div className="bg-white rounded-lg p-2 border border-gray-200">
                <p className="text-xs text-gray-500 mb-2 font-medium">Color Legend</p>
                
                {(rasterConfig.layer === 'tree_probability_2025' || rasterConfig.layer === 'tree_probability_2019') && (
                  <div>
                    <div className="h-3 rounded" style={{ 
                      background: 'linear-gradient(90deg, #f7fcf5, #c7e9c0, #74c476, #31a354, #006d2c, #00441b)' 
                    }}></div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-center">Tree Cover Probability</p>
                  </div>
                )}
                
                {rasterConfig.layer === 'tree_change' && (
                  <div>
                    <div className="h-3 rounded" style={{ 
                      background: 'linear-gradient(90deg, #67001f, #d6604d, #f4a582, #f7f7f7, #92c5de, #4393c3, #053061)' 
                    }}></div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>-50%</span>
                      <span>0</span>
                      <span>+50%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-center">Tree Cover Change 2019-2025</p>
                  </div>
                )}
                
                {rasterConfig.layer === 'ndvi' && (
                  <div>
                    <div className="h-3 rounded" style={{ 
                      background: 'linear-gradient(90deg, #d73027, #fee08b, #d9ef8b, #91cf60, #1a9850, #006837)' 
                    }}></div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>-0.2</span>
                      <span>0.4</span>
                      <span>0.8</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-center">Vegetation Index</p>
                  </div>
                )}
                
                {rasterConfig.layer === 'landcover' && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ background: '#419bdf' }}></div>
                        <span className="text-gray-600">Water</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ background: '#397d49' }}></div>
                        <span className="text-gray-600">Trees</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ background: '#88b053' }}></div>
                        <span className="text-gray-600">Grass</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ background: '#e49635' }}></div>
                        <span className="text-gray-600">Crops</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ background: '#dfc35a' }}></div>
                        <span className="text-gray-600">Shrubs</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ background: '#c4281b' }}></div>
                        <span className="text-gray-600">Built</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ background: '#a59b8f' }}></div>
                        <span className="text-gray-600">Bare</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-center">Land Cover Classes</p>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-cyan-600 flex items-center gap-1">
                <Info size={12} />
                Satellite imagery shows continuous land cover at 10m resolution
              </p>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};

// Inside WardLeaderboard component, continued from main parent file:
// This file is getting too long - consider breaking WardLeaderboard into a separate file

// Export the main component
export default GreenCoverMonitor;
