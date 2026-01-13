'use client';

import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';

// Import dinamici per evitare SSR
let MapContainer: any;
let TileLayer: any;
let Circle: any;
let Marker: any;
let useMapEvents: any;
let useMap: any;
let L: any;

interface MapSelectorProps {
  coordinate: { lat: number; lng: number } | null;
  raggioKm: number;
  indirizzo: string;
  onCoordinateChange: (coord: { lat: number; lng: number }) => void;
  onIndirizzoChange: (addr: string) => void;
  onRaggioChange: (raggio: number) => void;
}

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

export default function MapSelector({
  coordinate,
  raggioKm,
  indirizzo,
  onCoordinateChange,
  onIndirizzoChange,
  onRaggioChange,
}: MapSelectorProps) {
  const [isClient, setIsClient] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [searchAddress, setSearchAddress] = useState(indirizzo);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  useEffect(() => {
    setIsClient(true);
    
    // Carica dinamicamente react-leaflet e leaflet
    Promise.all([
      import('react-leaflet'),
      import('leaflet')
    ]).then(([reactLeaflet, leaflet]) => {
      MapContainer = reactLeaflet.MapContainer;
      TileLayer = reactLeaflet.TileLayer;
      Circle = reactLeaflet.Circle;
      Marker = reactLeaflet.Marker;
      useMapEvents = reactLeaflet.useMapEvents;
      useMap = reactLeaflet.useMap;
      L = leaflet.default;
      
      // Fix per i marker di Leaflet in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
      
      setIsMapReady(true);
    });
  }, []);

  // Debounced autocomplete con Mapbox
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchAddress.trim().length > 2) {
        fetchMapboxSuggestions(searchAddress);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchAddress]);

  const fetchMapboxSuggestions = async (query: string) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token non configurato');
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=it&limit=5&language=it&types=address,place&access_token=${token}`
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
    setSearchAddress(suggestion.display_name);
    onCoordinateChange({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    onIndirizzoChange(suggestion.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
  };

  const geocodeAddress = async () => {
    if (!searchAddress.trim()) return;
    
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      alert('Token Mapbox non configurato');
      return;
    }
    
    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchAddress)}.json?country=it&limit=1&language=it&access_token=${token}`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [lng, lat] = feature.center;
        console.log('📍 Geocoding trovato:', { lat, lng, address: feature.place_name });
        onCoordinateChange({ lat, lng });
        onIndirizzoChange(feature.place_name);
        setSearchAddress(feature.place_name);
      } else {
        alert('Indirizzo non trovato. Prova a essere più specifico.');
      }
    } catch (error) {
      console.error('Errore geocoding:', error);
      alert('Errore durante la ricerca dell\'indirizzo');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        selectSuggestion(suggestions[selectedSuggestionIndex]);
      } else {
        geocodeAddress();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const defaultCenter = coordinate || { lat: 41.9028, lng: 12.4964 }; // Roma di default

  // Componenti per la mappa (definiti qui per accedere agli hooks)
  const MapClickHandler = ({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) => {
    if (!useMapEvents) return null;
    const events = useMapEvents({
      click: (e: any) => {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  const MapUpdater = ({ coordinate, raggioKm }: { coordinate: { lat: number; lng: number } | null; raggioKm: number }) => {
    if (!useMap) return null;
    const map = useMap();
    
    useEffect(() => {
      if (coordinate && map) {
        let zoom = 13;
        if (raggioKm <= 2) zoom = 15;
        else if (raggioKm <= 5) zoom = 14;
        else if (raggioKm <= 10) zoom = 13;
        else if (raggioKm <= 20) zoom = 12;
        else zoom = 11;
        
        map.setView([coordinate.lat, coordinate.lng], zoom, {
          animate: true,
          duration: 1
        });
      }
    }, [coordinate, raggioKm, map]);
    
    return null;
  };

  if (!isClient || !isMapReady) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">Caricamento mappa...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Box with Autocomplete */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => {
              setSearchAddress(e.target.value);
              setSelectedSuggestionIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="es. Via Roma 123, Milano"
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            type="button"
            onClick={geocodeAddress}
            disabled={isGeocoding}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isGeocoding ? 'Cerco...' : 'Cerca'}
          </button>
        </div>
        
        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.place_id}
                onClick={() => selectSuggestion(suggestion)}
                className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${
                  index === selectedSuggestionIndex ? 'bg-blue-100' : ''
                }`}
              >
                <div className="text-sm font-medium text-gray-900">
                  {suggestion.display_name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raggio Slider */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Raggio di copertura: <strong>{raggioKm} km</strong>
        </label>
        <input
          type="range"
          min="1"
          max="50"
          value={raggioKm}
          onChange={(e) => onRaggioChange(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1 km</span>
          <span>25 km</span>
          <span>50 km</span>
        </div>
      </div>

      {/* Map */}
      <div className="w-full h-64 border rounded-lg overflow-hidden relative">
        {console.log('🗺️ Rendering map with coordinate:', coordinate, 'raggio:', raggioKm)}
        <MapContainer
          center={[defaultCenter.lat, defaultCenter.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater coordinate={coordinate} raggioKm={raggioKm} />
          <MapClickHandler
            onLocationSelect={(lat, lng) => {
              console.log('🖱️ Click sulla mappa:', { lat, lng });
              onCoordinateChange({ lat, lng });
            }}
          />
          {coordinate ? (
            <>
              {console.log('✅ Rendering marker at:', coordinate)}
              <Marker position={[coordinate.lat, coordinate.lng]} />
              <Circle
                center={[coordinate.lat, coordinate.lng]}
                radius={raggioKm * 1000}
                pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
              />
            </>
          ) : (
            console.log('❌ No coordinate, no marker')
          )}
        </MapContainer>
        
        <div className="absolute top-2 left-2 bg-white px-3 py-2 rounded shadow-lg text-sm z-[1000]">
          <p className="font-medium text-gray-700">💡 Clicca sulla mappa per selezionare la posizione</p>
        </div>
      </div>

      {coordinate && (
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
          <strong>Posizione selezionata:</strong>
          <br />
          Latitudine: {coordinate.lat.toFixed(6)}, Longitudine: {coordinate.lng.toFixed(6)}
          <br />
          Area coperta: circa {(Math.PI * raggioKm * raggioKm).toFixed(1)} km²
        </div>
      )}
    </div>
  );
}
