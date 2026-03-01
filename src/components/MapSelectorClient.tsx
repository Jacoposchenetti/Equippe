'use client';

import { useEffect, useState, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { useModal } from '@/contexts/ModalContext';

// Import dinamici per evitare SSR
let MapContainer: any;
let TileLayer: any;
let Circle: any;
let Marker: any;
let useMapEvents: any;
let useMap: any;
let L: any;

interface MapSelectorProps {
  coordinate?: { lat: number; lng: number } | null;
  raggioKm?: number;
  indirizzo?: string;
  onCoordinateChange?: (coord: { lat: number; lng: number }) => void;
  onIndirizzoChange?: (addr: string) => void;
  onRaggioChange?: (raggio: number) => void;
  // Nuove props per compatibilità
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onLocationSelect?: (location: { coordinate: { lat: number; lng: number }; address: string }) => void;
  selectedLocation?: { coordinate: { lat: number; lng: number }; address: string };
}

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

export default function MapSelector({
  coordinate,
  raggioKm = 10,
  indirizzo = '',
  onCoordinateChange,
  onIndirizzoChange,
  onRaggioChange,
  // Nuove props
  initialCenter,
  initialZoom,
  onLocationSelect,
  selectedLocation,
}: MapSelectorProps) {
  const { showToast } = useModal();
  const [isClient, setIsClient] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  
  // Usa le nuove props se disponibili, altrimenti le vecchie
  const effectiveCoordinate = selectedLocation?.coordinate || coordinate || initialCenter || { lat: 41.9028, lng: 12.4964 };
  const effectiveIndirizzo = selectedLocation?.address || indirizzo;
  const effectiveRaggio = raggioKm;
  
  // Wrapper per compatibilità
  const handleCoordinateChange = (coord: { lat: number; lng: number }) => {
    if (onLocationSelect) {
      onLocationSelect({ coordinate: coord, address: effectiveIndirizzo });
    }
    if (onCoordinateChange) {
      onCoordinateChange(coord);
    }
  };
  
  const handleIndirizzoChange = (addr: string) => {
    if (onLocationSelect && effectiveCoordinate) {
      onLocationSelect({ coordinate: effectiveCoordinate, address: addr });
    }
    if (onIndirizzoChange) {
      onIndirizzoChange(addr);
    }
  };
  const [searchAddress, setSearchAddress] = useState(indirizzo);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const isInputFocused = useRef(false);
  
  // Default coordinates (Rome center) if no coordinates provided
  const currentCoordinate = effectiveCoordinate;

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
      
      // Fix per i marker di Leaflet
      if (typeof window !== 'undefined') {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
      }
      
      setIsMapReady(true);
    }).catch(error => {
      console.error('Error loading map components:', error);
    });
  }, []);

  // Debounced autocomplete con Mapbox
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchAddress.trim().length > 2 && isInputFocused.current) {
        fetchMapboxSuggestions(searchAddress);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchAddress]);

  const fetchMapboxSuggestions = async (query: string) => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
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
    handleCoordinateChange({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    handleIndirizzoChange(suggestion.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
  };

  const geocodeAddress = async () => {
    if (!searchAddress.trim()) return;
    
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      showToast('Token Mapbox non configurato', 'error');
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
        handleCoordinateChange({ lat, lng });
        handleIndirizzoChange(feature.place_name);
        setSearchAddress(feature.place_name);
      } else {
        showToast('Indirizzo non trovato. Prova a essere più specifico.', 'warning');
      }
    } catch (error) {
      console.error('Errore geocoding:', error);
      showToast('Errore durante la ricerca dell\'indirizzo', 'error');
    } finally {
      setIsGeocoding(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=it&limit=1&access_token=${token}`
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const address = data.features[0].place_name;
        setSearchAddress(address);
        handleIndirizzoChange(address);
      }
    } catch (error) {
      console.error('Errore reverse geocoding:', error);
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

  const defaultCenter = currentCoordinate; // Use current coordinate or Rome default

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

  const MapUpdater = ({ coordinate, raggioKm }: { coordinate: { lat: number; lng: number }; raggioKm: number }) => {
    if (!useMap) return null;
    const map = useMap();
    
    useEffect(() => {
      if (map) {
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
      {/* Search bar */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { isInputFocused.current = true; if (suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => { isInputFocused.current = false; setTimeout(() => setShowSuggestions(false), 200); }}
            placeholder="Cerca indirizzo, città o zona..."
            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={geocodeAddress}
            disabled={isGeocoding}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium whitespace-nowrap"
          >
            {isGeocoding ? '...' : 'Cerca'}
          </button>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-[1100] w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.place_id}
                type="button"
                className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0 ${
                  index === selectedSuggestionIndex ? 'bg-blue-50' : ''
                }`}
                onClick={() => selectSuggestion(suggestion)}
              >
                {suggestion.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="w-full h-64 border rounded-lg overflow-hidden relative">
        <MapContainer
          center={[defaultCenter.lat, defaultCenter.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater coordinate={currentCoordinate} raggioKm={raggioKm} />
          <MapClickHandler
            onLocationSelect={(lat, lng) => {
              console.log('🖱️ Click sulla mappa:', { lat, lng });
              handleCoordinateChange({ lat, lng });
              reverseGeocode(lat, lng);
            }}
          />
          {console.log('✅ Rendering marker at:', currentCoordinate)}
          <Marker position={[currentCoordinate.lat, currentCoordinate.lng]} />
          <Circle
            center={[currentCoordinate.lat, currentCoordinate.lng]}
            radius={raggioKm * 1000}
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
          />
        </MapContainer>
        
        <div className="absolute top-2 left-2 bg-white px-3 py-2 rounded shadow-lg text-sm z-[1000] pointer-events-none opacity-80">
          <p className="font-medium text-gray-700">Clicca sulla mappa o cerca un indirizzo</p>
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
