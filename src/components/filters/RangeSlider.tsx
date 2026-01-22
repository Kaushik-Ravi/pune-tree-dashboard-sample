// src/components/filters/RangeSlider.tsx
// A dual-handle range slider for numeric filtering with smooth dragging

import React, { useCallback, useState, useEffect } from 'react';
import { RangeFilter } from '../../types/filters';

interface RangeSliderProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  value: RangeFilter;
  onChange: (range: RangeFilter) => void;
  formatValue?: (value: number) => string;
}

const RangeSlider: React.FC<RangeSliderProps> = ({
  label,
  unit,
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue = (v) => v.toLocaleString(),
}) => {
  // Local state for smooth dragging (doesn't trigger API until release)
  const [localMin, setLocalMin] = useState<number>(value.min ?? min);
  const [localMax, setLocalMax] = useState<number>(value.max ?? max);
  const [isDragging, setIsDragging] = useState(false);

  // Sync local state with external value changes (when filters reset, etc.)
  useEffect(() => {
    if (!isDragging) {
      setLocalMin(value.min ?? min);
      setLocalMax(value.max ?? max);
    }
  }, [value.min, value.max, min, max, isDragging]);

  // Calculate percentage positions for the track fill
  const minPercent = ((localMin - min) / (max - min)) * 100;
  const maxPercent = ((localMax - min) / (max - min)) * 100;

  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMin = parseFloat(e.target.value);
      const constrainedMin = Math.min(newMin, localMax - step);
      setLocalMin(Math.max(constrainedMin, min));
    },
    [localMax, min, step]
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMax = parseFloat(e.target.value);
      const constrainedMax = Math.max(newMax, localMin + step);
      setLocalMax(Math.min(constrainedMax, max));
    },
    [localMin, max, step]
  );

  // Called when user starts dragging
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Called when user finishes dragging - triggers the actual filter change
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    // Only trigger onChange if values actually changed from original
    const newMin = localMin <= min ? null : localMin;
    const newMax = localMax >= max ? null : localMax;
    
    if (newMin !== value.min || newMax !== value.max) {
      onChange({ min: newMin, max: newMax });
    }
  }, [localMin, localMax, min, max, value.min, value.max, onChange]);

  const handleReset = useCallback(() => {
    setLocalMin(min);
    setLocalMax(max);
    onChange({ min: null, max: null });
  }, [min, max, onChange]);

  const isModified = value.min !== null || value.max !== null;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {isModified && (
          <button
            onClick={handleReset}
            className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Value display */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {formatValue(localMin)} {unit}
        </span>
        <span>
          {formatValue(localMax)} {unit}
        </span>
      </div>

      {/* Slider container */}
      <div className="relative h-6">
        {/* Track background */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200 rounded-full" />

        {/* Active track */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-primary-500 rounded-full transition-all duration-75"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />

        {/* Min slider */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localMin}
          onChange={handleMinChange}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
          className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-500 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
        />

        {/* Max slider */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localMax}
          onChange={handleMaxChange}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
          className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-500 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
        />
      </div>

      {/* Min/Max labels */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
};

export default RangeSlider;
