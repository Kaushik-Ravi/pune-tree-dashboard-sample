import React from 'react';
import { Leaf } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-primary-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center">
        <Leaf size={24} className="mr-2" />
        <h1 className="text-xl font-bold">Pune Urban Tree Dashboard</h1>
        
        <div className="ml-auto flex items-center space-x-4">
          <button 
            className="text-white hover:text-accent-300 transition-colors"
            aria-label="Information"
            title="About this dashboard"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="lucide lucide-info"
            >
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;