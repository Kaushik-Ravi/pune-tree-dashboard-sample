// src/hooks/useSunPosition.ts
import { useMemo } from 'react';
import * as SunCalc from 'suncalc';

export interface SunPosition {
  azimuth: number;      // Horizontal angle (radians) from north
  altitude: number;     // Vertical angle (radians) above horizon
  intensity: number;    // Light intensity (0-1) based on altitude
  position: [number, number, number]; // Three.js DirectionalLight position [x, y, z]
}

interface UseSunPositionParams {
  latitude: number;
  longitude: number;
  date: Date;
  enabled?: boolean;
}

/**
 * Calculates realistic sun position based on geographic coordinates and time
 * Returns data formatted for Three.js DirectionalLight positioning
 * 
 * @example
 * const sunPos = useSunPosition({ 
 *   latitude: 18.5204, 
 *   longitude: 73.8567, 
 *   date: new Date() 
 * });
 * 
 * directionalLight.position.set(...sunPos.position);
 * directionalLight.intensity = sunPos.intensity;
 */
export const useSunPosition = ({
  latitude,
  longitude,
  date,
  enabled = true
}: UseSunPositionParams): SunPosition => {
  
  return useMemo(() => {
    if (!enabled) {
      // Default overhead sun when disabled
      return {
        azimuth: 0,
        altitude: Math.PI / 3, // 60 degrees
        intensity: 1,
        position: [1, 2, 1]
      };
    }

    // Calculate sun position using SunCalc library
    const sunPosition = SunCalc.getPosition(date, latitude, longitude);
    
    // SunCalc returns:
    // - altitude: angle above horizon (-π/2 to π/2)
    // - azimuth: direction from north (0 to 2π, clockwise)
    
    const altitude = sunPosition.altitude;
    const azimuth = sunPosition.azimuth;
    
    // Calculate light intensity based on sun altitude
    // Full intensity when sun is high (noon), dimmer at sunrise/sunset
    const intensity = Math.max(0, Math.min(1, (Math.sin(altitude) + 0.5) / 1.5));
    
    // Convert spherical coordinates to Three.js Cartesian position
    // We want the light to come FROM the sun position
    // Distance from origin (arbitrary, shadows don't depend on distance for directional light)
    const distance = 1000;
    
    // Three.js coordinate system:
    // X: East-West (positive = east)
    // Y: Up-Down (positive = up)
    // Z: North-South (positive = south/towards viewer)
    
    // Convert azimuth/altitude to Three.js coordinates
    const x = distance * Math.cos(altitude) * Math.sin(azimuth);
    const y = distance * Math.sin(altitude);
    const z = distance * Math.cos(altitude) * Math.cos(azimuth);
    
    return {
      azimuth,
      altitude,
      intensity,
      position: [x, y, z]
    };
  }, [latitude, longitude, date, enabled]);
};

/**
 * Helper function to get sun times for a given date and location
 * Useful for UI display of sunrise, sunset, solar noon, etc.
 */
export const getSunTimes = (date: Date, latitude: number, longitude: number) => {
  const times = SunCalc.getTimes(date, latitude, longitude);
  
  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    solarNoon: times.solarNoon,
    dawn: times.dawn,
    dusk: times.dusk,
    nightEnd: times.nightEnd,
    night: times.night,
    goldenHourEnd: times.goldenHourEnd,
    goldenHour: times.goldenHour
  };
};

/**
 * Calculate if it's currently daytime based on sun altitude
 */
export const isDaytime = (altitude: number): boolean => {
  return altitude > -0.104719755; // -6 degrees (civil twilight)
};

/**
 * Get descriptive time of day based on sun position
 */
export const getTimeOfDay = (altitude: number): string => {
  const deg = altitude * (180 / Math.PI);
  
  if (deg > 50) return '☀️ High Noon';
  if (deg > 20) return '🌤️ Daytime';
  if (deg > 0) return '🌅 Morning/Evening';
  if (deg > -6) return '🌆 Civil Twilight';
  if (deg > -12) return '🌃 Nautical Twilight';
  return '🌙 Night';
};
