// src/components/map/Geocoder.tsx
/**
 * GEOCODER / LOCATION SEARCH COMPONENT
 * =====================================
 * 
 * A floating search bar for geocoding (place search) using MapTiler API.
 * 
 * Features:
 * - Debounced input (300ms) to minimize API calls
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Click outside to close suggestions
 * - Responsive design (desktop/mobile)
 * - Search restricted to Maharashtra/Pune region
 * - Loading and empty states
 * - Clear button
 * - Accessibility (ARIA labels, keyboard support)
 * 
 * Uses MapTiler Geocoding API free tier (100k requests/month)
 * https://docs.maptiler.com/cloud/api/geocoding/
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, MapPin, Loader2, Navigation } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

// ============================================================================
// TYPES
// ============================================================================

interface GeocoderResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  text: string;
  context?: Array<{
    id: string;
    text: string;
  }>;
  properties?: {
    category?: string;
  };
}

interface GeocoderProps {
  onSelect: (lng: number, lat: number, placeName: string, zoom?: number) => void;
  placeholder?: string;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_KEY;

// Bounding box for Maharashtra region [minLng, minLat, maxLng, maxLat]
// Covers Pune and surrounding areas
const MAHARASHTRA_BBOX = '72.5,15.5,81.0,22.5';

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 300;

// Minimum characters before triggering search
const MIN_QUERY_LENGTH = 2;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get appropriate zoom level based on place type
 */
function getZoomForPlaceType(placeTypes: string[]): number {
  if (placeTypes.includes('address') || placeTypes.includes('poi')) {
    return 17;
  }
  if (placeTypes.includes('neighbourhood') || placeTypes.includes('locality')) {
    return 15;
  }
  if (placeTypes.includes('place') || placeTypes.includes('city')) {
    return 13;
  }
  if (placeTypes.includes('district') || placeTypes.includes('region')) {
    return 11;
  }
  return 14; // Default zoom
}

/**
 * Get icon for place type
 */
function getPlaceTypeIcon(placeTypes: string[]): React.ReactNode {
  if (placeTypes.includes('address') || placeTypes.includes('poi')) {
    return <MapPin size={14} className="text-red-500" />;
  }
  if (placeTypes.includes('neighbourhood') || placeTypes.includes('locality')) {
    return <Navigation size={14} className="text-blue-500" />;
  }
  return <MapPin size={14} className="text-gray-500" />;
}

/**
 * Format place name for display (shorten if too long)
 */
function formatPlaceName(result: GeocoderResult): { primary: string; secondary: string } {
  const primary = result.text || result.place_name.split(',')[0];
  
  // Get context (area, city, etc.) from the place_name
  const parts = result.place_name.split(',').slice(1, 3);
  const secondary = parts.join(',').trim();
  
  return { primary, secondary };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Geocoder: React.FC<GeocoderProps> = ({
  onSelect,
  placeholder = 'Search for a place...',
  className = ''
}) => {
  // State
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocoderResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  
  // Debounced query value
  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY);

  // ============================================================================
  // API CALL
  // ============================================================================
  
  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (!MAPTILER_API_KEY) {
      setError('MapTiler API key not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use Maharashtra bounding box for broader coverage
      // proximity biases results toward Pune center
      const params = new URLSearchParams({
        key: MAPTILER_API_KEY,
        bbox: MAHARASHTRA_BBOX,
        proximity: '73.8567,18.5204', // Pune city center
        language: 'en',
        limit: '7',
        autocomplete: 'true',
      });

      const response = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(searchQuery)}.json?${params}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }

      const data = await response.json();
      
      setResults(data.features || []);
      setIsOpen(data.features?.length > 0);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Geocoding error:', err);
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Trigger search when debounced query changes
  useEffect(() => {
    searchPlaces(debouncedQuery);
  }, [debouncedQuery, searchPlaces]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (e.target.value.length >= MIN_QUERY_LENGTH) {
      setIsOpen(true);
    }
  };

  const handleSelect = (result: GeocoderResult) => {
    const [lng, lat] = result.center;
    const zoom = getZoomForPlaceType(result.place_type);
    
    onSelect(lng, lat, result.place_name, zoom);
    setQuery(result.text);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        } else if (results.length > 0) {
          handleSelect(results[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleFocus = () => {
    if (results.length > 0) {
      setIsOpen(true);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-owns="geocoder-results"
    >
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 size={18} className="text-gray-400 animate-spin" />
          ) : (
            <Search size={18} className="text-gray-400" />
          )}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl 
                     shadow-lg text-sm text-gray-900 placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-shadow duration-200"
          aria-label="Search for a location"
          aria-autocomplete="list"
          aria-controls="geocoder-results"
          aria-activedescendant={selectedIndex >= 0 ? `geocoder-result-${selectedIndex}` : undefined}
        />
        
        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
            type="button"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          id="geocoder-results"
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl 
                     max-h-72 overflow-y-auto divide-y divide-gray-100"
        >
          {error ? (
            <li className="px-4 py-3 text-sm text-red-600">{error}</li>
          ) : results.length === 0 && !isLoading ? (
            <li className="px-4 py-3 text-sm text-gray-500">
              No results found for "{debouncedQuery}"
            </li>
          ) : (
            results.map((result, index) => {
              const { primary, secondary } = formatPlaceName(result);
              const isSelected = index === selectedIndex;
              
              return (
                <li
                  key={result.id}
                  id={`geocoder-result-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-4 py-3 cursor-pointer flex items-start gap-3 transition-colors
                    ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getPlaceTypeIcon(result.place_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {primary}
                    </p>
                    {secondary && (
                      <p className="text-xs text-gray-500 truncate">
                        {secondary}
                      </p>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};

export default Geocoder;
