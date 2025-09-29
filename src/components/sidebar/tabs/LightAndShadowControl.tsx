// src/components/sidebar/tabs/LightAndShadowControl.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Light } from 'maplibre-gl'; // --- FIX: Correct import from 'maplibre-gl' ---
import SunCalc from 'suncalc';
import { Sun, Moon, Clock, Calendar, Globe, Power, PowerOff, Play, Pause } from 'lucide-react';

// --- FIX: Moved LightConfig type here to decouple from App.tsx and exported it ---
export interface LightConfig {
  directional: Light;
  ambientIntensity: number;
}

const PUNE_COORDS = { lat: 18.5204, lon: 73.8567 };

interface LightAndShadowControlProps {
  onLightChange: (config: LightConfig | null) => void;
  is3D: boolean;
}

type TimeControlMode = 'picker' | 'current';

const LightAndShadowControl: React.FC<LightAndShadowControlProps> = ({ onLightChange, is3D }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [mode, setMode] = useState<TimeControlMode>('picker');
  const [isAnimating, setIsAnimating] = useState(false);
  const [date, setDate] = useState(() => new Date()); // Default to today
  const [timeMinutes, setTimeMinutes] = useState(new Date().getHours() * 60 + new Date().getMinutes());
  
  const animationFrameRef = useRef<number>();

  const { sunrise, sunset } = useMemo(() => {
    const times = SunCalc.getTimes(date, PUNE_COORDS.lat, PUNE_COORDS.lon);
    return {
      sunrise: times.sunrise.getHours() * 60 + times.sunrise.getMinutes(),
      sunset: times.sunset.getHours() * 60 + times.sunset.getMinutes(),
    };
  }, [date]);

  // --- FIX: Centralized light calculation and callback logic with corrected intensity ---
  const updateLight = useCallback((currentDate: Date, currentMinutes: number) => {
    const newDate = new Date(currentDate);
    newDate.setHours(Math.floor(currentMinutes / 60));
    newDate.setMinutes(currentMinutes % 60);

    const sunPos = SunCalc.getPosition(newDate, PUNE_COORDS.lat, PUNE_COORDS.lon);
    
    const directionalIntensity = Math.max(0, Math.sin(sunPos.altitude)); // Clamp to [0, 1]
    const ambientIntensity = Math.max(0.1, Math.sin(sunPos.altitude) * 0.4) + 0.1; // Lower ambient for contrast

    const lightConfig: LightConfig = {
      directional: {
        anchor: 'map',
        position: [1.5, 180 + sunPos.azimuth * 180 / Math.PI, 90 - sunPos.altitude * 180 / Math.PI],
        intensity: directionalIntensity,
      },
      ambientIntensity: ambientIntensity
    };
    onLightChange(lightConfig);
  }, [onLightChange]);
  
  // Effect for handling "Current" time mode
  useEffect(() => {
    if (!isEnabled || !is3D || mode !== 'current' || isAnimating) {
      return;
    }
    const intervalId = window.setInterval(() => {
      const now = new Date();
      setDate(now);
      setTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);

    const now = new Date();
    setDate(now);
    setTimeMinutes(now.getHours() * 60 + now.getMinutes());
    
    return () => clearInterval(intervalId);
  }, [mode, isEnabled, is3D, isAnimating]);

  // Effect for managing the animation loop
  useEffect(() => {
    if (isAnimating) {
      const animate = () => {
        setTimeMinutes(prev => (prev + 2) % 1440);
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating]);

  // --- FIX: Central effect to push light updates whenever time changes, preventing infinite loop ---
  useEffect(() => {
    if (isEnabled && is3D) {
      updateLight(date, timeMinutes);
    } else {
      onLightChange(null);
    }
  }, [isEnabled, is3D, date, timeMinutes, updateLight, onLightChange]);


  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month, day] = e.target.value.split('-').map(Number);
    const newDate = new Date(year, month - 1, day);
    setDate(newDate);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeMinutes(Number(e.target.value));
  };
  
  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const toggleEnable = () => {
    setIsEnabled(prev => !prev);
    if (isEnabled) {
      setIsAnimating(false);
    }
  };
  
  if (!is3D) {
    return (
      <div className="card">
        <div className="card-header"><h3 className="font-medium">Light & Shadow</h3></div>
        <div className="card-body text-center text-sm text-gray-500">
          <p>Switch to 3D View on the map to enable lighting controls.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card transition-opacity ${!is3D ? 'opacity-50' : ''}`}>
      <div className="card-header flex justify-between items-center">
        <h3 className="font-medium">Light & Shadow</h3>
        <button onClick={toggleEnable} className={`p-1 rounded-full ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`} title={isEnabled ? "Disable Lighting" : "Enable Lighting"}>
          {isEnabled ? <Power size={18} /> : <PowerOff size={18} />}
        </button>
      </div>
      <div className={`card-body space-y-4 transition-opacity ${!isEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 flex items-center mb-1"><Calendar size={14} className="mr-1"/> Date</label>
            <input type="date" value={date.toISOString().split('T')[0]} onChange={handleDateChange} className="input text-sm" disabled={mode !== 'picker' || isAnimating}/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 flex items-center mb-1"><Clock size={14} className="mr-1"/> Time</label>
            <input type="text" value={formatTime(timeMinutes)} readOnly className="input text-sm text-center bg-gray-50" disabled={mode !== 'picker'}/>
          </div>
        </div>
        <div className="space-y-2">
            <input type="range" min="0" max="1439" step="1" value={timeMinutes} onChange={handleTimeChange} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" disabled={mode !== 'picker' || isAnimating}/>
            <div className="flex justify-between text-xs text-gray-500 px-1">
              <span className="flex items-center"><Moon size={12} className="mr-1"/>{formatTime(sunrise)}</span>
              <span className="flex items-center">{formatTime(sunset)}<Sun size={12} className="ml-1"/></span>
            </div>
        </div>
        <div className="text-xs font-medium text-gray-500 flex items-center"><Globe size={14} className="mr-1"/> Timezone: Asia/Kolkata</div>
        <div className="border-t border-gray-200 pt-3 flex justify-around items-center">
          <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="time-mode" value="picker" checked={mode === 'picker'} onChange={() => { setMode('picker'); setIsAnimating(false); }} className="text-primary-600 focus:ring-primary-500"/><span>Pick Time</span></label>
          <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="time-mode" value="current" checked={mode === 'current'} onChange={() => { setMode('current'); setIsAnimating(false); }} className="text-primary-600 focus:ring-primary-500"/><span>Current</span></label>
          <button onClick={() => { setMode('picker'); setIsAnimating(!isAnimating); }} disabled={mode === 'current'} className="flex items-center space-x-2 text-sm p-1 rounded-md disabled:text-gray-400 hover:bg-gray-100">
            {isAnimating ? <Pause size={14} /> : <Play size={14} />} <span>Animate</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LightAndShadowControl;