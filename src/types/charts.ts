// src/types/charts.ts
export type ChartType = 'bar' | 'line' | 'pie' | 'horizontalBar' | 'area' | 'scatter';
export type GroupByKey = 'ward' | 'species' | 'economic_i' | 'flowering' | 'location_type' | 'height_category' | 'canopy_category' | 'co2_category';
export type MetricKey = 'count' | 'sum_co2' | 'avg_height' | 'avg_canopy' | 'avg_girth';

export interface ChartConfig {
  type: ChartType;
  groupBy: GroupByKey;
  metric: MetricKey;
  sortBy: 'label' | 'value';
  sortOrder: 'asc' | 'desc';
  limit: number | null;
  showValues?: boolean;
  descending?: boolean;
}
