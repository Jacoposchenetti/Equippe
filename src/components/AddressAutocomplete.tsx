// Componente semplificato per la selezione indirizzi senza mappa
'use client';

import { useEffect, useState } from 'react';

interface LocationResult {
  indirizzo?: string;
  coordinate?: { lat: number; lng: number };
}

interface AddressAutocompleteProps {
  value: string;
  coordinate?: { lat: number; lng: number };
  onChange: (location: LocationResult) => void;
  placeholder?: string;
  className?: string;
  showMap?: boolean; // Per compatibilità, ma ignorata
}

interface MapboxSuggestion {
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
}

export default function AddressAutocomplete({ 
  value, 
  coordinate, 
  onChange, 
  placeholder = "Inserisci indirizzo", 
  className = "",
  showMap = true // ignorata
}: AddressAutocompleteProps) {
  const [searchValue, setSearchValue] = useState(value);
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Sincronizza valore esterno
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue.trim().length > 2) {
        fetchMapboxSuggestions(searchValue);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  const fetchMapboxSuggestions = async (query: string) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token non configurato');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=it&limit=5&language=it&types=address,place&access_token=${token}`
      );
      const data = await response.json();

      if (data.features) {
        setSuggestions(data.features);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      }
    } catch (error) {
      console.error('Errore geocoding:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectSuggestion = (suggestion: MapboxSuggestion) => {
    const address = suggestion.place_name;
    const [lng, lat] = suggestion.center;
    
    console.log('🔍 Indirizzo selezionato:', address);
    console.log('📏 Coordinate:', { lat, lng });
    
    setSearchValue(address);
    setShowSuggestions(false);
    
    onChange({
      indirizzo: address,
      coordinate: { lat, lng }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) {
        selectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            // Reset coordinate when typing
            if (e.target.value !== value) {
              onChange({
                indirizzo: e.target.value,
                coordinate: undefined
              });
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
          </div>
        )}
        
        {coordinate && (
          <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
            <div className="w-2 h-2 bg-green-500 rounded-full" title="Posizione geolocalizzata"></div>
          </div>
        )}
      </div>

      {/* Dropdown suggerimenti */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.place_name}
              onClick={() => selectSuggestion(suggestion)}
              className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                index === selectedIndex ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
              }`}
            >
              <div className="font-medium">{suggestion.place_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}