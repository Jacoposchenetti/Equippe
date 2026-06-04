'use client';

import { useState, useEffect } from 'react';
import MapSelector from './MapSelector';
import LocationAutocomplete from './LocationAutocomplete';
import { getConfigurazioneProfessione } from '../lib/professioni';
import type { MapMarker } from './MapSelectorClient';

export type SearchType = 'professionista' | 'equipe';

export interface SearchFilters {
  type: SearchType;
  specializzazione?: string;
  areaInteresse?: string;
  coordinate?: { lat: number; lng: number } | null;
  raggioKm?: number;
  indirizzo?: string;
  remoto: boolean;
  lingua?: string;
  anniEsperienzaMin?: number;
}

interface EnhancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  availableSpecializations?: string[];
  initialAddress?: string;
  initialCoordinate?: { lat: number; lng: number } | null;
  mapMarkers?: MapMarker[];
}

export default function EnhancedSearch({ onSearch, availableSpecializations = [], initialAddress, initialCoordinate, mapMarkers = [] }: EnhancedSearchProps) {
  const [searchType, setSearchType] = useState<SearchType>('professionista');
  const [specializzazione, setSpecializzazione] = useState<string>('');
  const [areaInteresse, setAreaInteresse] = useState<string>('');
  const [coordinate, setCoordinate] = useState<{ lat: number; lng: number } | null>(initialCoordinate || null);
  const [raggioKm, setRaggioKm] = useState<number>(5);
  const [indirizzo, setIndirizzo] = useState<string>(initialAddress || '');
  const [remoto, setRemoto] = useState<boolean>(false);
  const [lingua, setLingua] = useState<string>('');
  const [anniEsperienzaMin, setAnniEsperienzaMin] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Reset area interesse quando cambia specializzazione
  useEffect(() => {
    setAreaInteresse('');
  }, [specializzazione]);

  // Auto-search su qualsiasi cambio filtro
  useEffect(() => {
    onSearch({
      type: searchType,
      specializzazione: specializzazione || undefined,
      areaInteresse: areaInteresse || undefined,
      coordinate,
      raggioKm,
      indirizzo: indirizzo || undefined,
      remoto,
      lingua: lingua || undefined,
      anniEsperienzaMin: anniEsperienzaMin > 0 ? anniEsperienzaMin : undefined,
    });
  }, [searchType, specializzazione, areaInteresse, coordinate, raggioKm, indirizzo, remoto, lingua, anniEsperienzaMin]);

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
    <div className="surface-lifted rounded-3xl p-4 sm:p-6">
      {/* Toggle Professionista/equipe */}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        <button
          onClick={() => {
            setSearchType('professionista');
            setSpecializzazione('');
            // La ricerca si aggiornerà automaticamente tramite useEffect
          }}
          className={`py-3 px-4 rounded-xl font-semibold transition-colors text-sm sm:text-base ${
            searchType === 'professionista'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }`}
        >
          Professionista
        </button>
        <button
          onClick={() => {
            setSearchType('equipe');
            setSpecializzazione('');
            // La ricerca si aggiornerà automaticamente tramite useEffect
          }}
          className={`py-3 px-4 rounded-xl font-semibold transition-colors text-sm sm:text-base ${
            searchType === 'equipe'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }`}
        >
          Equipe
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
              className={`w-full border border-slate-200 rounded-xl px-3 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                searchType === 'equipe' ? 'bg-slate-100 cursor-not-allowed text-slate-400' : 'bg-white'
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
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="h-[280px] lg:h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <MapSelector
                coordinate={coordinate}
                raggioKm={raggioKm}
                indirizzo={indirizzo}
                readOnly
                markers={mapMarkers}
              />
            </div>
          </div>
        )}
      </div>

      {/* Toggle Ricerca Avanzata */}
      <div className="mt-2">
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Ricerca avanzata
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
            {/* Lingua parlata */}
            {searchType === 'professionista' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lingua parlata
                </label>
                <select
                  value={lingua}
                  onChange={(e) => setLingua(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tutte le lingue</option>
                  {[
                    'Italiano', 'Inglese', 'Francese', 'Spagnolo', 'Tedesco', 'Portoghese',
                    'Russo', 'Cinese', 'Giapponese', 'Arabo', 'Olandese', 'Polacco',
                    'Rumeno', 'Greco', 'Turco', 'Hindi', 'Coreano', 'Svedese', 'Norvegese',
                    'Danese', 'Finlandese', 'Ungherese', 'Ceco', 'Slovacco', 'Croato',
                    'Serbo', 'Bulgaro', 'Ucraino', 'Ebraico', 'Persiano', 'LIS', 'Altro'
                  ].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Anni di esperienza minimi */}
            {searchType === 'professionista' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Esperienza minima: <strong>{anniEsperienzaMin > 0 ? `${anniEsperienzaMin} anni` : 'qualsiasi'}</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={anniEsperienzaMin}
                  onChange={(e) => setAnniEsperienzaMin(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Qualsiasi</span>
                  <span>15 anni</span>
                  <span>30+ anni</span>
                </div>
              </div>
            )}

            {/* Remoto */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={remoto}
                  onChange={(e) => setRemoto(e.target.checked)}
                  className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                />
                <span className="text-sm sm:text-base font-medium text-gray-700">
                  Lavora da remoto
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {searchType === 'equipe' && (
        <p className="text-xs sm:text-sm text-gray-500 mt-2">
          * Vengono mostrate solo le equipe con posti disponibili
        </p>
      )}
    </div>
  );
}
