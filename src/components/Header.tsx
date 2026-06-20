// src/components/Header.tsx
import React from 'react';
import { Leaf, PlayCircle, MapPin } from 'lucide-react';
import InfoPopover from './common/InfoPopover';
import { useCityStore } from '../store/CityStore';
import { cities } from '../config/cities';

interface HeaderProps {
  onStartTour?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onStartTour }) => {
  const { activeCityId, setCity, getActiveCity } = useCityStore();
  const activeCityConfig = getActiveCity();
  const hasMultipleCities = Object.keys(cities).length > 1;

  const headerInfoContent = (
    <>
      <p>This dashboard visualizes urban tree data for {activeCityConfig.name}, including:</p>
      <ul className="list-disc list-inside pl-2 mt-1 space-y-1">
        <li>CO₂ sequestration levels</li>
        <li>Tree locations and details</li>
        <li>Ward-wise statistics</li>
      </ul>
      <p className="mt-2">You can explore tree details, analyze specific neighborhoods using drawing tools, and get planting advice.</p>
    </>
  );

  return (
    <header className="bg-primary-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center">
        <Leaf size={24} className="mr-2" />
        <h1 className="text-xl font-bold">{activeCityConfig.name} Urban Tree Dashboard</h1>

        <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
          {hasMultipleCities && (
            <div className="flex items-center bg-primary-700/50 rounded-md px-2 py-1 hover:bg-primary-700 transition-colors">
              <MapPin size={16} className="mr-2 text-primary-200" />
              <select
                value={activeCityId}
                onChange={(e) => setCity(e.target.value)}
                className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer appearance-none pr-4"
                style={{ backgroundImage: 'none' }}
                title="Select City"
              >
                {Object.entries(cities).map(([id, config]) => (
                  <option key={id} value={id} className="text-gray-900 bg-white">
                    {config.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {onStartTour && (
            <button
              onClick={onStartTour}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-white/15 hover:bg-white/25 rounded-md transition-all text-sm font-medium"
              title="Take a tour of the dashboard"
            >
              <PlayCircle size={16} />
              <span className="hidden sm:inline">Tour</span>
            </button>
          )}

          <InfoPopover
            titleContent="About This Dashboard"
            iconSize={20}
            className="text-white hover:text-gray-200"
          >
            {headerInfoContent}
          </InfoPopover>
        </div>
      </div>
    </header>
  );
};

export default Header;
