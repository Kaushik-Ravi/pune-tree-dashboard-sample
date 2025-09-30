// src/components/Header.tsx
import React from 'react';
import { Leaf } from 'lucide-react'; 
import InfoPopover from './common/InfoPopover'; // CORRECTED IMPORT PATH

const Header: React.FC = () => {
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
        
        <div className="ml-auto flex items-center space-x-4">
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