'use client';

import { useState } from 'react';
import MapSelector from './MapSelector';

export type SearchType = 'professionista' | 'equipé';

export interface SearchFilters {
  type: SearchType;
  specializzazione?: string;
  coordinate?: { lat: number; lng: number } | null;
  raggioKm?: number;
  indirizzo?: string;
  remoto: boolean;
}

interface EnhancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  availableSpecializations?: string[];
}

export default function EnhancedSearch({ onSearch, availableSpecializations = [] }: EnhancedSearchProps) {
  const [searchType, setSearchType] = useState<SearchType>('professionista');
  const [specializzazione, setSpecializzazione] = useState<string>('');
  const [coordinate, setCoordinate] = useState<{ lat: number; lng: number } | null>(null);
  const [raggioKm, setRaggioKm] = useState<number>(10);
  const [indirizzo, setIndirizzo] = useState<string>('');
  const [remoto, setRemoto] = useState<boolean>(false);

  const handleSearch = () => {
    onSearch({
      type: searchType,
      specializzazione: specializzazione || undefined,
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
    'Dietista',
    'Dietologo',
    'Assistente Sociale',
    'Educatore Professionale',
    'Logopedista',
    'Fisioterapista',
    'Terapista Occupazionale',
    'Infermiere',
    'Medico di Base',
    'Medico Specialista'
  ];

  // Tipologie di equipé (basate sulle specializzazioni dei membri)
  const equipéSpecs = [
    'Legale-Fiscale',
    'Tecnico-Progettuale',
    'Sanitaria',
    'Finanziaria',
    'Multidisciplinare',
    'Altro',
  ];

  const currentSpecs = searchType === 'professionista' 
    ? professionistaSpecs 
    : equipéSpecs;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <h2 className="text-lg sm:text-xl font-bold mb-4">Ricerca Avanzata</h2>

      {/* Toggle Professionista/Equipé */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <button
          onClick={() => {
            setSearchType('professionista');
            setSpecializzazione('');
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
            setSearchType('equipé');
            setSpecializzazione('');
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
            searchType === 'equipé'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Cerca Equipé
        </button>
      </div>

      {/* Specializzazione */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {searchType === 'professionista' ? 'Specializzazione' : 'Tipologia Equipé'}
        </label>
        <select
          value={specializzazione}
          onChange={(e) => setSpecializzazione(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tutte</option>
          {currentSpecs.map((spec) => (
            <option key={spec} value={spec}>
              {spec}
            </option>
          ))}
        </select>
      </div>

      {/* Località con Mappa */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          📍 Zona di interesse
        </label>
        <div className="overflow-hidden rounded-lg">
          <MapSelector
            coordinate={coordinate}
            raggioKm={raggioKm}
            indirizzo={indirizzo}
            onCoordinateChange={setCoordinate}
            onIndirizzoChange={setIndirizzo}
            onRaggioChange={setRaggioKm}
          />
        </div>
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

      {/* Bottone Cerca */}
      <button
        onClick={handleSearch}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors text-base"
      >
        Cerca
      </button>

      {searchType === 'equipé' && (
        <p className="text-xs sm:text-sm text-gray-500 mt-2">
          * Vengono mostrate solo le equipé con posti disponibili
        </p>
      )}
    </div>
  );
}
