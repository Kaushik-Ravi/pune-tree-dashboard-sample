// src/api/chart.ts
// API helper for chart data
import axios from 'axios';
import { ChartConfig } from '../types/charts';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

export async function fetchChartData(config: ChartConfig, filters: any) {
  const res = await axios.post(`${API_BASE_URL}/api/chart-data`, { ...config, filters });
  return res.data;
}
