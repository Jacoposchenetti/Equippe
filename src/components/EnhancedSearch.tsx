'use client';

import { useState, useEffect } from 'react';
import MapSelector from './MapSelector';
import LocationAutocomplete from './LocationAutocomplete';
import { getConfigurazioneProfessione } from '../lib/professioni';

export type SearchType = 'professionista' | 'equipe';

export interface SearchFilters {
  type: SearchType;
  specializzazione?: string;
  areaInteresse?: string;
  coordinate?: { lat: number; lng: number } | null;
  raggioKm?: number;
  indirizzo?: string;
  remoto: boolean;
}

interface EnhancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  availableSpecializations?: string[];
  initialAddress?: string;
  initialCoordinate?: { lat: number; lng: number } | null;
}

export default function EnhancedSearch({ onSearch, availableSpecializations = [], initialAddress, initialCoordinate }: EnhancedSearchProps) {
  const [searchType, setSearchType] = useState<SearchType>('professionista');
  const [specializzazione, setSpecializzazione] = useState<string>('');
  const [areaInteresse, setAreaInteresse] = useState<string>('');
  const [coordinate, setCoordinate] = useState<{ lat: number; lng: number } | null>(initialCoordinate || null);
  const [raggioKm, setRaggioKm] = useState<number>(5);
  const [indirizzo, setIndirizzo] = useState<string>(initialAddress || '');
  const [remoto, setRemoto] = useState<boolean>(false);

  // Aggiorna automaticamente quando cambia il tipo di ricerca
  useEffect(() => {
    handleSearch();
  }, [searchType]);

  // Reset area interesse quando cambia specializzazione
  useEffect(() => {
    setAreaInteresse('');
  }, [specializzazione]);

  // Aggiorna automaticamente quando si resettano i filtri aggiuntivi
  useEffect(() => {
    if (!specializzazione && !indirizzo && !coordinate && !remoto) {
      handleSearch();
    }
  }, [specializzazione, indirizzo, coordinate, remoto]);

  const handleSearch = () => {
    onSearch({
      type: searchType,
      specializzazione: specializzazione || undefined,
      areaInteresse: areaInteresse || undefined,
      coordinate,
      raggioKm,
      indirizzo: indirizzo || undefined,
      remoto,
    });
  };

  // Specializzazioni per professionisti
  const professionistaSpecs = [
    'Psicologo',
    'Psicoterapeuta',
    'Psichiatra',
    'Nutrizionista',
    'Dietologo',
    'Logopedista',
    'Neuropsicomotricista',
    'Fisioterapista'
  ];

  // Tipologie di equipe (basate sulle specializzazioni dei membri)
  const equipeSpecs = [
    'Legale-Fiscale',
    'Tecnico-Progettuale',
    'Sanitaria',
    'Finanziaria',
    'Multidisciplinare',
    'Altro',
  ];

  const currentSpecs = searchType === 'professionista' 
    ? professionistaSpecs 
    : equipeSpecs;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <h2 className="text-lg sm:text-xl font-bold mb-4">Ricerca Avanzata</h2>

      {/* Toggle Professionista/equipe */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <button
          onClick={() => {
            setSearchType('professionista');
            setSpecializzazione('');
            // La ricerca si aggiornerà automaticamente tramite useEffect
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
            searchType === 'professionista'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Cerca Professionista
        </button>
        <button
          onClick={() => {
            setSearchType('equipe');
            setSpecializzazione('');
            // La ricerca si aggiornerà automaticamente tramite useEffect
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
            searchType === 'equipe'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Cerca equipe
        </button>
      </div>

      {/* Filtri + Mappa side by side */}
      <div className={`flex flex-col ${coordinate ? 'lg:flex-row' : ''} gap-4 mb-4`}>
        {/* Left: all filter fields */}
        <div className={`space-y-4 ${coordinate ? 'lg:w-1/2' : 'w-full'}`}>
          {/* Specializzazione */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {searchType === 'professionista' ? 'Specializzazione' : 'Tipologia equipe'}
            </label>
            <select
              value={searchType === 'equipe' ? '' : specializzazione}
              onChange={(e) => setSpecializzazione(e.target.value)}
              disabled={searchType === 'equipe'}
              className={`w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                searchType === 'equipe' ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Tutte</option>
              {searchType === 'professionista' && currentSpecs.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>

          {/* Area d'interesse */}
          {specializzazione && searchType === 'professionista' && (() => {
            const config = getConfigurazioneProfessione(specializzazione);
            const tematiche = config?.tematiche || [];
            if (tematiche.length === 0) return null;
            return (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Area d'interesse
                </label>
                <select
                  value={areaInteresse}
                  onChange={(e) => setAreaInteresse(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tutte le aree</option>
                  {tematiche.map((tema) => (
                    <option key={tema} value={tema}>
                      {tema}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* Zona di interesse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zona di interesse
            </label>
            <LocationAutocomplete
              value={indirizzo}
              onChange={(address, coords) => {
                setIndirizzo(address);
                if (coords) {
                  setCoordinate(coords);
                }
              }}
              placeholder="es. Via Roma 123, Milano"
            />
          </div>

          {/* Selettore raggio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raggio di copertura: <strong>{raggioKm} km</strong>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={raggioKm}
              onChange={(e) => setRaggioKm(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 km</span>
              <span>25 km</span>
              <span>50 km</span>
            </div>
          </div>
        </div>

        {/* Right: map (only when a location is selected) */}
        {coordinate && (
          <div className="lg:w-1/2">
            <div className="h-full min-h-[280px] rounded-lg overflow-hidden border">
              <MapSelector
                coordinate={coordinate}
                raggioKm={raggioKm}
                indirizzo={indirizzo}
                readOnly
              />
            </div>
          </div>
        )}
      </div>

      {/* Remoto */}
      <div className="mb-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={remoto}
            onChange={(e) => setRemoto(e.target.checked)}
            className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-sm sm:text-base font-medium text-gray-700">
            Include lavoro da remoto
          </span>
        </label>
      </div>

      {/* Bottone Cerca - mostrato solo se ci sono filtri aggiuntivi */}
      {(specializzazione || indirizzo || coordinate || remoto) && (
        <button
          onClick={handleSearch}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors text-base"
        >
          Cerca
        </button>
      )}

      {searchType === 'equipe' && (
        <p className="text-xs sm:text-sm text-gray-500 mt-2">
          * Vengono mostrate solo le equipe con posti disponibili
        </p>
      )}
    </div>
  );
}
