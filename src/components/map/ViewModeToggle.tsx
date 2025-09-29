// src/components/map/ViewModeToggle.tsx
import React from 'react';
import { View, Box } from 'lucide-react';

interface ViewModeToggleProps {
  is3D: boolean;
  onToggle: () => void;
  zoom: number;
}

const MIN_3D_ZOOM = 17;

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ is3D, onToggle, zoom }) => {
  const isEnabled = is3D || zoom >= MIN_3D_ZOOM;
  const title = is3D 
    ? 'Switch to 2D View' 
    : isEnabled 
      ? 'Switch to 3D View' 
      : `Zoom in to level ${MIN_3D_ZOOM} to enable 3D View`;

  return (
    // MODIFIED: Changed positioning from top-right to top-left, below other controls.
    <div className="absolute top-[170px] left-[10px] z-10">
      <button
        onClick={onToggle}
        className={`bg-white shadow-md rounded-md flex items-center justify-center w-10 h-10 transition-colors
          ${isEnabled ? 'hover:bg-gray-100 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        aria-label={title}
        title={title}
        disabled={!isEnabled}
      >
        {is3D ? <View size={20} /> : <Box size={20} />}
      </button>
    </div>
  );
};

export default ViewModeToggle;