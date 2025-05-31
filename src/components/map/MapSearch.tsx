import React, { useState } from 'react';
import { useMap } from 'react-leaflet';
import { Search } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Mock locations for demonstration
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
  const map = useMap();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.length > 2) {
      // Filter locations based on search term
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
    // Center map on selected location
    map.setView([location.latitude, location.longitude], 15);
    setSearchTerm(location.name);
    setShowResults(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="search-icon" size={16} />
        <input
          type="text"
          placeholder="Search locations in Pune..."
          value={searchTerm}
          onChange={handleSearch}
          className="search-input"
          onFocus={() => searchTerm.length > 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
        />
      </div>
      
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg z-20 animate-fade-in">
          <ul className="py-1">
            {results.map(location => (
              <li 
                key={location.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onMouseDown={() => handleLocationSelect(location)}
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