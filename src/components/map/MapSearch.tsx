// src/components/map/MapSearch.tsx
import React, { useState } from 'react';
import { useMap } from 'react-leaflet';
import { Search } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

const mockLocations: Location[] = [
  { id: '1', name: 'Shivajinagar, Pune', latitude: 18.5308, longitude: 73.8475 },
  { id: '2', name: 'Kothrud, Pune', latitude: 18.5089, longitude: 73.8076 },
  { id: '3', name: 'Viman Nagar, Pune', latitude: 18.5679, longitude: 73.9143 },
  { id: '4', name: 'Baner, Pune', latitude: 18.5590, longitude: 73.7868 },
  { id: '5', name: 'Hadapsar, Pune', latitude: 18.5089, longitude: 73.9260 }
];

const MapSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<Location[]>([]);
  const map = useMap(); // This hook means MapSearch MUST be a child of MapContainer

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.length > 2) {
      const filtered = mockLocations.filter(location => 
        location.name.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const handleLocationSelect = (location: Location) => {
    map.setView([location.latitude, location.longitude], 15);
    setSearchTerm(location.name);
    setShowResults(false);
  };

  return (
    // MODIFIED LINE: Added absolute positioning, z-index, top, left, transform for centering, and width
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1001] w-96"> 
      <div className="relative"> {/* This inner relative div is good for the icon positioning */}
        <Search className="search-icon" size={18} /> {/* Adjusted icon size slightly */}
        <input
          type="text"
          placeholder="Search locations or coordinates..." // Updated placeholder
          value={searchTerm}
          onChange={handleSearch}
          className="search-input" // Existing class handles bg, shadow, padding etc.
          onFocus={() => searchTerm.length > 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)} // Keep the blur handler
        />
      </div>
      
      {showResults && results.length > 0 && (
        // This dropdown should position correctly relative to the input now
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg z-20 animate-fade-in">
          <ul className="py-1 max-h-60 overflow-y-auto"> {/* Added max-h and overflow for long lists */}
            {results.map(location => (
              <li 
                key={location.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onMouseDown={() => handleLocationSelect(location)} // use onMouseDown to fire before onBlur
              >
                {location.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MapSearch;