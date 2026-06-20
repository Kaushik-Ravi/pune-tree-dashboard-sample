import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cities, defaultCityId, CityConfig } from '../config/cities';

interface CityState {
  activeCityId: string;
  setCity: (cityId: string) => void;
  getActiveCity: () => CityConfig;
}

export const useCityStore = create<CityState>()(
  persist(
    (set, get) => ({
      activeCityId: defaultCityId,
      setCity: (cityId: string) => {
        if (cities[cityId]) {
          set({ activeCityId: cityId });
        } else {
          console.error(`City configuration for ${cityId} not found.`);
        }
      },
      getActiveCity: () => {
        const { activeCityId } = get();
        return cities[activeCityId] || cities[defaultCityId];
      },
    }),
    {
      name: 'urban-dashboard-city-store',
    }
  )
);
