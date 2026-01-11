// src/components/sidebar/tabs/LightAndShadowControl.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SunCalc from 'suncalc';
import { Sun, Moon, Clock, Calendar, Globe, Power, Play, Pause, RefreshCw } from 'lucide-react';

// LightConfig type - compatible with MapLibre GL light configuration
export interface LightConfig {
  directional: {
    direction?: [number, number];
    position?: [number, number, number];
    color?: string;
    intensity: number;
    anchor?: 'map' | 'viewport';
  };
  ambientIntensity: number;
}

const PUNE_COORDS = { lat: 18.5204, lon: 73.8567 };

interface EnvironmentControlProps {
  onLightChange: (config: LightConfig | null) => void;
  is3D: boolean;
}

type TimeControlMode = 'manual' | 'realtime';

const EnvironmentControl: React.FC<EnvironmentControlProps> = ({ onLightChange, is3D }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [mode, setMode] = useState<TimeControlMode>('manual');
  const [isAnimating, setIsAnimating] = useState(false);
  const [date, setDate] = useState(() => new Date()); // Default to today
  
  // Store time as total minutes from midnight (0-1439)
  const [timeMinutes, setTimeMinutes] = useState(new Date().getHours() * 60 + new Date().getMinutes());
  
  const animationFrameRef = useRef<number>();

  // Calculate sun times for the selected date
  const { sunrise, sunset } = useMemo(() => {
    const times = SunCalc.getTimes(date, PUNE_COORDS.lat, PUNE_COORDS.lon);
    return {
      sunrise: times.sunrise.getHours() * 60 + times.sunrise.getMinutes(),
      sunset: times.sunset.getHours() * 60 + times.sunset.getMinutes(),
    };
  }, [date]);

  // Update light configuration based on date/time
  const updateLight = useCallback((currentDate: Date, currentMinutes: number) => {
    const newDate = new Date(currentDate);
    newDate.setHours(Math.floor(currentMinutes / 60));
    newDate.setMinutes(currentMinutes % 60);

    const sunPos = SunCalc.getPosition(newDate, PUNE_COORDS.lat, PUNE_COORDS.lon);
    
    // Intensity calculations
    // Sun is above horizon if altitude > 0
    const directionalIntensity = Math.max(0, Math.sin(sunPos.altitude)); 
    
    // Ambient light should be lower at night but not zero
    // Enhanced ambient calculation for better visuals
    const ambientIntensity = Math.max(0.1, Math.sin(sunPos.altitude) * 0.5 + 0.2);

    const lightConfig: LightConfig = {
      directional: {
        anchor: 'map',
        // Convert to MapLibre spherical coordinates or direction vector if needed.
        // [radial, azimuth (degrees), polar (degrees)]
        position: [1.5, 180 + sunPos.azimuth * 180 / Math.PI, 90 - sunPos.altitude * 180 / Math.PI],
        intensity: directionalIntensity,
        color: '#fffee0' // Slight warm tint for sunlight
      },
      ambientIntensity: ambientIntensity
    };
    onLightChange(lightConfig);
  }, [onLightChange]);

  // Handle "Real-time" mode
  useEffect(() => {
    if (!isEnabled || !is3D || mode !== 'realtime' || isAnimating) {
      return;
    }

    const updateToNow = () => {
      const now = new Date();
      setDate(now);
      setTimeMinutes(now.getHours() * 60 + now.getMinutes());
    };

    updateToNow(); // Initial update
    const intervalId = window.setInterval(updateToNow, 60000); // Update every minute
    
    return () => clearInterval(intervalId);
  }, [mode, isEnabled, is3D, isAnimating]);

  // Handle Animation Loop
  useEffect(() => {
    if (isAnimating && isEnabled && is3D) {
      const animate = () => {
        setTimeMinutes(prev => {
          const next = prev + 1; // 1 minute per frame (approx 60 mins/sec at 60fps)
          return next >= 1440 ? 0 : next;
        });
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, isEnabled, is3D]);

  // Effect to apply changes
  useEffect(() => {
    if (isEnabled && is3D) {
      updateLight(date, timeMinutes);
    } else {
      onLightChange(null);
    }
  }, [isEnabled, is3D, date, timeMinutes, updateLight, onLightChange]);

  // UI Handlers
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month, day] = e.target.value.split('-').map(Number);
    setDate(new Date(year, month - 1, day));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeMinutes(Number(e.target.value));
    setMode('manual');
    setIsAnimating(false);
  };

  const toggleEnable = () => {
    setIsEnabled(prev => !prev);
    if (!isEnabled) {
        // When enabling, maybe default to current time? Keep current state for now.
    } else {
        setIsAnimating(false);
    }
  };

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  if (!is3D) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 opacity-60">
        <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Sun size={18} /> Environment
            </h3>
        </div>
        <p className="text-xs text-gray-500">Switch to 3D mode to enable environment controls.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Sun size={18} className="text-amber-500"/> EnvironmentControl
        </h3>
        <button 
            onClick={toggleEnable}
            className={`p-1.5 rounded-full transition-colors ${isEnabled ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}
            title={isEnabled ? "Disable Environment" : "Enable Environment"}
        >
            <Power size={16} />
        </button>
      </div>

      <div className={`space-y-4 transition-all duration-200 ${!isEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        
        {/* Date Selection */}
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                 <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    <Calendar size={12} /> Date
                 </label>
                 <span className="text-xs text-gray-400">{date.toDateString()}</span>
            </div>
            <input 
                type="date" 
                value={date.toISOString().split('T')[0]}
                onChange={handleDateChange}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
            />
        </div>

        {/* Time Selection */}
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    <Clock size={12} /> Time
                </label>
                <span className="text-sm font-mono font-medium text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                    {formatTime(timeMinutes)}
                </span>
            </div>
            
            <input 
                type="range" 
                min="0" 
                max="1439" 
                value={timeMinutes} 
                onChange={handleTimeChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
                <span className="flex items-center gap-1" title="Sunrise"><Sun size={10} className="text-orange-500"/> {formatTime(sunrise)}</span>
                <span className="flex items-center gap-1" title="Sunset">{formatTime(sunset)} <Moon size={10} className="text-indigo-500"/></span>
            </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button 
                onClick={() => { setMode('realtime'); setIsAnimating(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors
                    ${mode === 'realtime' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
            >
                <RefreshCw size={12} className={mode === 'realtime' ? "animate-spin-slow" : ""} /> Live
            </button>
            
            <button 
                onClick={() => { setMode('manual'); setIsAnimating(!isAnimating); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors
                    ${isAnimating ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
            >
                {isAnimating ? <Pause size={12} /> : <Play size={12} />} 
                {isAnimating ? 'Pause' : 'Play'}
            </button>
        </div>

        {/* Info Footer */}
        <div className="text-[10px] text-gray-400 flex items-center justify-center gap-1">
             <Globe size={10} /> Punawale, Pune (IST)
        </div>

      </div>
    </div>
  );
};

export default EnvironmentControl;