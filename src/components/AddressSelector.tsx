// Componente MapSelector semplificato senza mappa
'use client';

import { useEffect, useState } from 'react';

interface LocationResult {
  indirizzo?: string;
  coordinate?: { lat: number; lng: number };
}

interface MapSelectorProps {
  value: string;
  coordinate?: { lat: number; lng: number } | null;
  onChange: (location: LocationResult) => void;
  placeholder?: string;
  className?: string;
  showMap?: boolean; // Opzione per nascondere la mappa
}

interface MapboxFeature {
  place_name: string;
  center: [number, number]; // [lng, lat] formato Mapbox
  context: Array<{ id: string; text: string }>;
}

export default function MapSelector({ 
  value, 
  coordinate, 
  onChange, 
  placeholder = "Inserisci un indirizzo...",
  className = "",
  showMap = false // Di default non mostra la mappa
}: MapSelectorProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Sincronizza con il valore esterno
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim().length > 2) {
        searchAddresses(inputValue);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  const searchAddresses = async (query: string) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token non configurato');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `country=it&limit=5&language=it&types=address,place&access_token=${token}`
      );
      
      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Errore nella ricerca degli indirizzi:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectAddress = (feature: MapboxFeature) => {
    const selectedAddress = feature.place_name;
    const [lng, lat] = feature.center;
    
    setInputValue(selectedAddress);
    setShowSuggestions(false);
    
    onChange({
      indirizzo: selectedAddress,
      coordinate: { lat, lng }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Se l'utente cancella tutto, reset delle coordinate
    if (!newValue.trim()) {
      onChange({
        indirizzo: '',
        coordinate: undefined
      });
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Ritarda la chiusura per permettere il click sui suggerimenti
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {coordinate && (
          <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
            <div className="text-green-500" title="Indirizzo geolocalizzato">
              📍
            </div>
          </div>
        )}
      </div>

      {/* Dropdown suggerimenti */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((feature, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-blue-50"
              onClick={() => selectAddress(feature)}
            >
              <div className="font-medium text-gray-900">
                {feature.place_name}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}