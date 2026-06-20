import { PuneConfig } from './pune.config';
import type { CityConfig } from './pune.config';

export const cities: Record<string, CityConfig> = {
  pune: PuneConfig,
};

export const defaultCityId = 'pune';

export type { CityConfig };
