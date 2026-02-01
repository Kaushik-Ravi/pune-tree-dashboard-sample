// src/types/charts.ts
// Type definitions for the chart builder system

export type ChartType = 'bar' | 'line' | 'pie' | 'horizontalBar' | 'area';

export type GroupByField = 
  | 'ward' 
  | 'species' 
  | 'economic_importance' 
  | 'flowering' 
  | 'location_type' 
  | 'height_category' 
  | 'canopy_category';

export type MetricField = 
  | 'count' 
  | 'sum_co2' 
  | 'avg_height' 
  | 'avg_canopy' 
  | 'avg_girth';

export type SortBy = 'label' | 'value';
export type SortOrder = 'asc' | 'desc';

export interface ChartConfig {
  chartType: ChartType;
  groupBy: GroupByField;
  metric: MetricField;
  sortBy: SortBy;
  sortOrder: SortOrder;
  limit: number | null;
  showDataLabels: boolean;
  title: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
}

export interface ChartPreset {
  id: string;
  name: string;
  icon: string;
  config: ChartConfig;
}

export interface ChartDataRequest {
  groupBy: GroupByField;
  metric: MetricField;
  sortBy: SortBy;
  sortOrder: SortOrder;
  limit: number | null;
}

export interface ChartDataResponse {
  data: ChartDataPoint[];
  total: number;
  groupBy: string;
  metric: string;
}

// Color palette for charts
export const CHART_COLORS = {
  primary: '#2E7D32',    // Green - primary brand
  secondary: '#1976D2',  // Blue
  accent: '#FFC107',     // Amber/Yellow
  tertiary: '#9C27B0',   // Purple
  quaternary: '#FF5722', // Deep Orange
  neutral: '#607D8B',    // Blue Grey
};

export const CHART_COLOR_PALETTE = [
  '#2E7D32', // Green
  '#1976D2', // Blue
  '#FFC107', // Amber
  '#9C27B0', // Purple
  '#FF5722', // Deep Orange
  '#00BCD4', // Cyan
  '#E91E63', // Pink
  '#4CAF50', // Light Green
  '#FF9800', // Orange
  '#3F51B5', // Indigo
];

// Preset configurations
export const CHART_PRESETS: ChartPreset[] = [
  {
    id: 'trees-by-ward',
    name: 'Trees by Ward',
    icon: '🏘️',
    config: {
      chartType: 'bar',
      groupBy: 'ward',
      metric: 'count',
      sortBy: 'value',
      sortOrder: 'desc',
      limit: null,
      showDataLabels: false,
      title: 'Number of Trees by Ward',
    },
  },
  {
    id: 'co2-by-ward',
    name: 'CO₂ by Ward',
    icon: '🌍',
    config: {
      chartType: 'bar',
      groupBy: 'ward',
      metric: 'sum_co2',
      sortBy: 'value',
      sortOrder: 'desc',
      limit: null,
      showDataLabels: false,
      title: 'CO₂ Sequestered by Ward (tons)',
    },
  },
  {
    id: 'top-species',
    name: 'Top Species',
    icon: '🌳',
    config: {
      chartType: 'horizontalBar',
      groupBy: 'species',
      metric: 'count',
      sortBy: 'value',
      sortOrder: 'desc',
      limit: 10,
      showDataLabels: true,
      title: 'Top 10 Tree Species',
    },
  },
  {
    id: 'by-purpose',
    name: 'By Purpose',
    icon: '💰',
    config: {
      chartType: 'pie',
      groupBy: 'economic_importance',
      metric: 'count',
      sortBy: 'value',
      sortOrder: 'desc',
      limit: null,
      showDataLabels: true,
      title: 'Trees by Economic Importance',
    },
  },
  {
    id: 'height-distribution',
    name: 'By Height',
    icon: '📏',
    config: {
      chartType: 'bar',
      groupBy: 'height_category',
      metric: 'count',
      sortBy: 'label',
      sortOrder: 'asc',
      limit: null,
      showDataLabels: false,
      title: 'Tree Height Distribution',
    },
  },
  {
    id: 'street-vs-nonstreet',
    name: 'Street/Non-Street',
    icon: '🛣️',
    config: {
      chartType: 'pie',
      groupBy: 'location_type',
      metric: 'count',
      sortBy: 'value',
      sortOrder: 'desc',
      limit: null,
      showDataLabels: true,
      title: 'Street vs Non-Street Trees',
    },
  },
  {
    id: 'flowering-status',
    name: 'Flowering',
    icon: '🌸',
    config: {
      chartType: 'pie',
      groupBy: 'flowering',
      metric: 'count',
      sortBy: 'value',
      sortOrder: 'desc',
      limit: null,
      showDataLabels: true,
      title: 'Flowering Status Distribution',
    },
  },
  {
    id: 'top-co2-contributors',
    name: 'Top CO₂',
    icon: '🏆',
    config: {
      chartType: 'horizontalBar',
      groupBy: 'species',
      metric: 'sum_co2',
      sortBy: 'value',
      sortOrder: 'desc',
      limit: 10,
      showDataLabels: true,
      title: 'Top 10 CO₂ Contributing Species (tons)',
    },
  },
];

// Labels for UI
export const GROUP_BY_LABELS: Record<GroupByField, string> = {
  ward: 'Ward',
  species: 'Species',
  economic_importance: 'Economic Importance',
  flowering: 'Flowering Status',
  location_type: 'Location Type',
  height_category: 'Height Category',
  canopy_category: 'Canopy Size',
};

export const METRIC_LABELS: Record<MetricField, string> = {
  count: 'Number of Trees',
  sum_co2: 'Total CO₂ (tons)',
  avg_height: 'Avg Height (m)',
  avg_canopy: 'Avg Canopy (m)',
  avg_girth: 'Avg Girth (cm)',
};

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar Chart',
  line: 'Line Chart',
  pie: 'Pie Chart',
  horizontalBar: 'Horizontal Bar',
  area: 'Area Chart',
};
