// src/components/sidebar/tabs/GreenCoverMonitor.tsx
/**
 * PUNE GREEN COVER MONITOR
 * =========================
 * 
 * A user-friendly dashboard for monitoring Pune's green cover changes.
 * Inspired by Global Forest Watch, Tree Equity Score, and Resource Watch.
 * 
 * Features:
 * - Ward Green Score (0-100 composite score)
 * - Deforestation/Change Alerts
 * - Historical Timeline (2019-2025)
 * - Map-ready data for visualization
 * - Advanced mode for researchers
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Award,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Download,
  Map,
  Eye,
  EyeOff,
  ArrowUpDown
} from 'lucide-react';
import { useGreenCoverStore } from '../../../store/GreenCoverStore';

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

// Alert Card Component - Enhanced with more details
const AlertCard: React.FC<{
  wardNumber: number;
  wardName?: string;
  changeHa: number;
  changePct: number;
  builtChangeHa?: number;
  treesPct?: number;
  builtPct?: number;
  type: 'loss' | 'gain';
  onClick?: () => void;
}> = ({ wardNumber, wardName, changeHa, changePct, builtChangeHa, treesPct, builtPct, type, onClick }) => {
  const isLoss = type === 'loss';
  const greenBuiltRatio = builtPct && builtPct > 0 ? (treesPct || 0) / builtPct : 0;
  
  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-lg border text-left transition-all hover:shadow-md ${
        isLoss 
          ? 'bg-red-50 border-red-200 hover:border-red-300' 
          : 'bg-green-50 border-green-200 hover:border-green-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            isLoss ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'
          }`}>
            {wardNumber}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">
              Ward {wardNumber}
            </p>
            {wardName && (
              <p className="text-xs text-gray-500 truncate max-w-[120px]">{wardName}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`flex items-center gap-1 ${isLoss ? 'text-red-600' : 'text-green-600'}`}>
            {isLoss ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            <span className="font-bold">{Math.abs(changePct).toFixed(1)}%</span>
          </div>
          <p className="text-xs text-gray-500">
            Green: {isLoss ? '-' : '+'}{Math.abs(changeHa).toFixed(1)} ha
          </p>
        </div>
      </div>
      
      {/* Additional details row */}
      <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <p className="text-gray-500">Tree Cover</p>
          <p className="font-medium text-green-600">{(treesPct ?? 0).toFixed(1)}%</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">Built-up</p>
          <p className="font-medium text-gray-600">{(builtPct ?? 0).toFixed(1)}%</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">Green:Built</p>
          <p className={`font-medium ${greenBuiltRatio >= 0.2 ? 'text-green-600' : 'text-red-600'}`}>
            1:{greenBuiltRatio > 0 ? (1/greenBuiltRatio).toFixed(1) : '∞'}
          </p>
        </div>
      </div>
      
      {builtChangeHa !== undefined && builtChangeHa !== 0 && (
        <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
          <Building2 size={10} />
          Built-up: {builtChangeHa > 0 ? '+' : ''}{builtChangeHa.toFixed(1)} ha
        </div>
      )}
    </button>
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
// MAIN COMPONENT
// ============================================================================

interface GreenCoverMonitorProps {
  // Map integration props - controlled from parent
  showWardBoundaries?: boolean;
  onWardBoundariesToggle?: (enabled: boolean) => void;
  selectedYear?: number;
  onYearChange?: (year: number) => void;
  colorBy?: 'green_score' | 'trees_pct' | 'change';
  onColorByChange?: (colorBy: 'green_score' | 'trees_pct' | 'change') => void;
}

const GreenCoverMonitor: React.FC<GreenCoverMonitorProps> = ({
  showWardBoundaries = false,
  onWardBoundariesToggle,
  selectedYear: externalYear,
  onYearChange,
  colorBy = 'green_score',
  onColorByChange,
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
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  
  // Sorting options for alerts and rankings
  const [alertSortBy, setAlertSortBy] = useState<'change' | 'ratio'>('change');
  const [alertSortOrder, setAlertSortOrder] = useState<'worst' | 'best'>('worst');
  const [rankingSortBy, setRankingSortBy] = useState<'score' | 'change' | 'ratio'>('score');
  const [rankingSortOrder, setRankingSortOrder] = useState<'best' | 'worst'>('best');
  const [showAllRankings, setShowAllRankings] = useState(false);
  
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
      const totalArea = totalAreaM2 / 10000;
      const changePct = (netChange / totalArea) * 100;
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
  
  // Calculate green:built ratio for sorting
  const getGreenBuiltRatio = (ward: typeof wardScores[0]) => {
    if (!ward.builtPct || ward.builtPct === 0) return 0;
    return ward.treesPct / ward.builtPct;
  };
  
  // Sorted alerts based on user selection
  const sortedAlerts = useMemo(() => {
    // Get all wards with change (not just losses)
    const allChangedWards = wardScores.filter(w => Math.abs(w.changePct) > 0.5);
    
    // Sort based on selected criteria
    let sorted = [...allChangedWards];
    
    if (alertSortBy === 'ratio') {
      // Sort by green:built ratio
      sorted = sorted.sort((a, b) => {
        const ratioA = getGreenBuiltRatio(a);
        const ratioB = getGreenBuiltRatio(b);
        return alertSortOrder === 'worst' ? ratioA - ratioB : ratioB - ratioA;
      });
    } else {
      // Sort by change percentage
      sorted = sorted.sort((a, b) => {
        return alertSortOrder === 'worst' 
          ? a.changePct - b.changePct  // Most negative first
          : b.changePct - a.changePct; // Most positive first
      });
    }
    
    return sorted;
  }, [wardScores, alertSortBy, alertSortOrder]);
  
  // Split into loss and gain for display
  const allLossWards = useMemo(() => {
    return sortedAlerts.filter(w => w.changePct < -2);
  }, [sortedAlerts]);
  
  const allGainWards = useMemo(() => {
    return sortedAlerts.filter(w => w.changePct > 2);
  }, [sortedAlerts]);
  
  // Alerts displayed (limited or all)
  const lossAlerts = showAllAlerts ? allLossWards : allLossWards.slice(0, 5);
  const gainAlerts = showAllAlerts ? allGainWards : allGainWards.slice(0, 5);
  
  // Sorted rankings based on user selection
  const sortedRankings = useMemo(() => {
    let sorted = [...wardScores];
    
    if (rankingSortBy === 'ratio') {
      sorted = sorted.sort((a, b) => {
        const ratioA = getGreenBuiltRatio(a);
        const ratioB = getGreenBuiltRatio(b);
        return rankingSortOrder === 'best' ? ratioB - ratioA : ratioA - ratioB;
      });
    } else if (rankingSortBy === 'change') {
      sorted = sorted.sort((a, b) => {
        return rankingSortOrder === 'best' 
          ? b.changePct - a.changePct  // Most positive first
          : a.changePct - b.changePct; // Most negative first
      });
    } else {
      // Sort by score (default)
      sorted = sorted.sort((a, b) => {
        return rankingSortOrder === 'best' ? b.score - a.score : a.score - b.score;
      });
    }
    
    return sorted;
  }, [wardScores, rankingSortBy, rankingSortOrder]);
  
  // Rankings displayed (limited or all) - default to 5, expandable
  const displayedRankings = showAllRankings ? sortedRankings : sortedRankings.slice(0, 5);
  
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
  
  // Section toggle
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw className="animate-spin text-green-500" size={32} />
        <span className="text-gray-500">Loading Pune Green Cover Monitor...</span>
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
      
      {/* Key Insights */}
      <div className="space-y-2">
        <h4 className="font-medium text-gray-700 text-sm flex items-center gap-1">
          <Info size={14} />
          Key Insights
        </h4>
        {insights.map((insight, i) => (
          <KeyInsight key={i} {...insight} />
        ))}
      </div>
      
      {/* Timeline Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full p-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          onClick={() => toggleSection('timeline')}
        >
          <span className="font-medium text-gray-700 flex items-center gap-2">
            <Calendar size={16} />
            Historical Timeline
          </span>
          {expandedSection === 'timeline' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {expandedSection === 'timeline' && (
          <div className="p-3 space-y-3">
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
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-700">{parseFloat(yearData.avg_trees_pct).toFixed(1)}%</p>
                        <p className="text-xs text-green-600">Tree Cover</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-red-700">{parseFloat(yearData.avg_built_pct).toFixed(1)}%</p>
                        <p className="text-xs text-red-600">Built-up</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-blue-700">{parseFloat(yearData.total_trees_area_ha).toLocaleString()}</p>
                        <p className="text-xs text-blue-600">Tree Area (ha)</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-gray-700">{yearData.ward_count}</p>
                        <p className="text-xs text-gray-600">Wards Analyzed</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Change Alerts Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full p-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          onClick={() => toggleSection('alerts')}
        >
          <span className="font-medium text-gray-700 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Change Alerts (2019→2025)
          </span>
          {expandedSection === 'alerts' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {expandedSection === 'alerts' && (
          <div className="p-3 space-y-3">
            {/* Sorting Controls */}
            <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <ArrowUpDown size={12} />
                <span>Sort by:</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setAlertSortBy('change')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    alertSortBy === 'change'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  Change %
                </button>
                <button
                  onClick={() => setAlertSortBy('ratio')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    alertSortBy === 'ratio'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  Green:Built Ratio
                </button>
              </div>
              <div className="flex gap-1 ml-auto">
                <button
                  onClick={() => setAlertSortOrder('worst')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    alertSortOrder === 'worst'
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  Worst First
                </button>
                <button
                  onClick={() => setAlertSortOrder('best')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    alertSortOrder === 'best'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  Best First
                </button>
              </div>
            </div>
            
            {lossAlerts.length > 0 && (
              <div>
                <p className="text-xs text-red-600 font-medium mb-2 flex items-center gap-1">
                  <TrendingDown size={12} />
                  Wards with Significant Green Cover Loss
                </p>
                <div className="space-y-2">
                  {lossAlerts.map(ward => (
                    <AlertCard
                      key={ward.ward_number}
                      wardNumber={ward.ward_number}
                      changeHa={ward.netChangeHa}
                      changePct={ward.changePct}
                      builtChangeHa={ward.builtChangeHa}
                      treesPct={ward.treesPct}
                      builtPct={ward.builtPct}
                      type="loss"
                      onClick={() => handleWardClick(ward.ward_number)}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {gainAlerts.length > 0 && (
              <div>
                <p className="text-xs text-green-600 font-medium mb-2 flex items-center gap-1">
                  <TrendingUp size={12} />
                  Wards with Green Cover Gains
                </p>
                <div className="space-y-2">
                  {gainAlerts.map(ward => (
                    <AlertCard
                      key={ward.ward_number}
                      wardNumber={ward.ward_number}
                      changeHa={ward.netChangeHa}
                      changePct={ward.changePct}
                      builtChangeHa={ward.builtChangeHa}
                      treesPct={ward.treesPct}
                      builtPct={ward.builtPct}
                      type="gain"
                      onClick={() => handleWardClick(ward.ward_number)}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {lossAlerts.length === 0 && gainAlerts.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No significant changes detected
              </p>
            )}
            
            {/* Show All / Show Less Button */}
            {(allLossWards.length > 5 || allGainWards.length > 5) && (
              <button
                onClick={() => setShowAllAlerts(!showAllAlerts)}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 py-2 hover:bg-blue-50 rounded transition-colors"
              >
                {showAllAlerts 
                  ? 'Show Less' 
                  : `Show All (${allLossWards.length} loss, ${allGainWards.length} gain)`
                }
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Ward Rankings Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full p-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          onClick={() => toggleSection('rankings')}
        >
          <span className="font-medium text-gray-700 flex items-center gap-2">
            <Award size={16} className="text-yellow-500" />
            Ward Rankings ({selectedYear})
          </span>
          {expandedSection === 'rankings' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {expandedSection === 'rankings' && (
          <div className="p-3">
            {/* Sorting Controls */}
            <div className="flex flex-wrap gap-2 p-2 mb-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <ArrowUpDown size={12} />
                <span>Sort by:</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setRankingSortBy('score')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    rankingSortBy === 'score'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  Green Score
                </button>
                <button
                  onClick={() => setRankingSortBy('ratio')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    rankingSortBy === 'ratio'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  Green:Built Ratio
                </button>
                <button
                  onClick={() => setRankingSortBy('change')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    rankingSortBy === 'change'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  Change %
                </button>
              </div>
              <div className="flex gap-1 ml-auto">
                <button
                  onClick={() => setRankingSortOrder('best')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    rankingSortOrder === 'best'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  Best First
                </button>
                <button
                  onClick={() => setRankingSortOrder('worst')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    rankingSortOrder === 'worst'
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  Worst First
                </button>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
              <span>Sorted by {rankingSortBy === 'score' ? 'Green Score' : rankingSortBy === 'ratio' ? 'Green:Built Ratio' : 'Change %'}</span>
              <span>Showing {displayedRankings.length} of {sortedRankings.length} wards</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {displayedRankings.map((ward, index) => {
                const greenBuiltRatio = ward.builtPct > 0 ? ward.treesPct / ward.builtPct : 0;
                return (
                <button
                  key={ward.ward_number}
                  onClick={() => handleWardClick(ward.ward_number)}
                  className="w-full flex items-center gap-2 p-2 hover:bg-green-50 rounded-lg transition-colors cursor-pointer text-left group"
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm group-hover:text-green-700">Ward {ward.ward_number}</span>
                      <span className="text-xs text-gray-400">
                        {(ward.treesPct ?? 0).toFixed(1)}% trees
                      </span>
                      {rankingSortBy === 'ratio' && (
                        <span className={`text-xs ${greenBuiltRatio >= 0.2 ? 'text-green-600' : 'text-red-600'}`}>
                          1:{greenBuiltRatio > 0 ? (1/greenBuiltRatio).toFixed(1) : '∞'}
                        </span>
                      )}
                      {rankingSortBy === 'change' && (
                        <span className={`text-xs ${ward.changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {ward.changePct >= 0 ? '+' : ''}{ward.changePct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${ward.score}%`,
                          backgroundColor: getScoreColor(ward.score)
                        }}
                      />
                    </div>
                  </div>
                  <ScoreRing score={ward.score} size="sm" showLabel={false} />
                </button>
              )})}
            </div>
            
            {/* Show More / Show Less Button */}
            {sortedRankings.length > 5 && (
              <button
                onClick={() => setShowAllRankings(!showAllRankings)}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 py-2 mt-2 hover:bg-blue-50 rounded transition-colors"
              >
                {showAllRankings 
                  ? 'Show Less' 
                  : `Show All ${sortedRankings.length} Wards`
                }
              </button>
            )}
          </div>
        )}
      </div>
      
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
      
      {/* Map Visualization Controls */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map size={18} className="text-blue-600" />
            <span className="font-medium text-gray-800">Map Visualization</span>
          </div>
          <button
            onClick={() => onWardBoundariesToggle?.(!showWardBoundaries)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              showWardBoundaries
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {showWardBoundaries ? <EyeOff size={14} /> : <Eye size={14} />}
            {showWardBoundaries ? 'Hide on Map' : 'Show on Map'}
          </button>
        </div>
        
        {showWardBoundaries && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Color wards by:</p>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
                  colorBy === 'green_score'
                    ? 'bg-green-100 text-green-700 font-medium'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => onColorByChange?.('green_score')}
              >
                Green Score
              </button>
              <button
                className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
                  colorBy === 'trees_pct'
                    ? 'bg-green-100 text-green-700 font-medium'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => onColorByChange?.('trees_pct')}
              >
                Tree Cover %
              </button>
              <button
                className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
                  colorBy === 'change'
                    ? 'bg-green-100 text-green-700 font-medium'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => onColorByChange?.('change')}
              >
                2019-25 Change
              </button>
            </div>
            
            {/* Color Legend */}
            <div className="bg-white rounded-lg p-2 border border-gray-200">
              <p className="text-xs text-gray-500 mb-2 font-medium">Color Legend</p>
              {colorBy === 'green_score' && (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                    <span>0-29 Critical</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
                    <span>30-49</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }}></div>
                    <span>50-69</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
                    <span>70+ Good</span>
                  </div>
                </div>
              )}
              {colorBy === 'trees_pct' && (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                    <span>&lt;5%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }}></div>
                    <span>5-10%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#84cc16' }}></div>
                    <span>10-15%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
                    <span>15-20%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#14532d' }}></div>
                    <span>&gt;20%</span>
                  </div>
                </div>
              )}
              {colorBy === 'change' && (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                    <span>&lt;-50ha</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
                    <span>-50 to -10</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }}></div>
                    <span>±10</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
                    <span>+10 to +50</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#14532d' }}></div>
                    <span>&gt;+50ha</span>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-xs text-blue-600 flex items-center gap-1">
              <Info size={12} />
              Hover over wards on the map to see details
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GreenCoverMonitor;
