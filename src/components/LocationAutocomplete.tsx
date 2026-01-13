'use client';

import { useEffect, useState, useRef } from 'react';

interface LocationAutocompleteProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
}

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Cerca un indirizzo...',
  label,
}: LocationAutocompleteProps) {
  const [searchText, setSearchText] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchText(value);
  }, [value]);

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.trim().length > 2) {
        fetchSuggestions(searchText);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Click fuori per chiudere suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        suggestionsRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (query: string) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token non configurato');
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?country=it&limit=5&language=it&types=address,place&access_token=${token}`
      );
      const data = await response.json();

      if (data.features) {
        const suggestions = data.features.map((feature: any) => ({
          display_name: feature.place_name,
          lat: feature.center[1].toString(),
          lon: feature.center[0].toString(),
          place_id: feature.id,
        }));
        setSuggestions(suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Errore fetching suggestions:', error);
    }
  };

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    setSearchText(suggestion.display_name);
    onChange(suggestion.display_name, {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
    });
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchText(newValue);
    onChange(newValue);
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {/* Icona search */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Dropdown suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.place_id}
              onClick={() => selectSuggestion(suggestion)}
              className={`px-4 py-3 cursor-pointer transition ${
                index === selectedIndex
                  ? 'bg-blue-50 text-blue-900'
                  : 'hover:bg-gray-50'
              } ${index > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-sm text-gray-900">{suggestion.display_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
