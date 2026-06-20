import { PuneConfig } from './pune.config';
import { MysuruConfig } from './mysuru.config';
import type { CityConfig } from './pune.config';

export const cities: Record<string, CityConfig> = {
  pune: PuneConfig,
  mysuru: MysuruConfig,
};

export const defaultCityId = 'pune';

export type { CityConfig };
