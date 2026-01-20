// src/components/Header.tsx
import React from 'react';
import { Leaf, PlayCircle } from 'lucide-react';
import InfoPopover from './common/InfoPopover';

interface HeaderProps {
  onStartTour?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onStartTour }) => {
  const headerInfoContent = (
    <>
      <p>This dashboard visualizes urban tree data for Pune, including:</p>
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
        <h1 className="text-xl font-bold">Pune Urban Tree Dashboard</h1>

        <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
          {/* Tour Button */}
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

          {/* Info Popover */}
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