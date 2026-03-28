import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ECMEventCard from '@/components/ECMEventCard';
import { useECMSearch, useECMDropdowns, ECMSearchFilters, SITE_TO_AGENAS } from '@/hooks/useECMSearch';

// Professioni AGENAS disponibili (solo quelle sincronizzate)
const AGENAS_PROFESSIONI = [
  { value: '1', label: 'Medico Chirurgo' },
  { value: '5', label: 'Psicologo' },
  { value: '6', label: 'Biologo / Nutrizionista' },
  { value: '10', label: 'Dietista' },
  { value: '11', label: 'Educatore Professionale' },
  { value: '12', label: 'Fisioterapista' },
  { value: '14', label: 'Infermiere' },
  { value: '16', label: 'Logopedista' },
  { value: '29', label: 'Neuropsicomotricista (TNPEE)' },
  { value: '30', label: 'Terapista Occupazionale' },
];

const TIPOLOGIE = [
  { value: 'RES', label: 'RES - Residenziale' },
  { value: 'FAD', label: 'FAD - Formazione a Distanza' },
  { value: 'FSC', label: 'FSC - Formazione sul Campo' },
  { value: 'BLENDED', label: 'Blended (mista)' },
];

export default function ECMSearchPage() {
  const { userProfile } = useAuth();
  const { events, loading, error, hasMore, search, loadMore } = useECMSearch();
  const { dropdowns, loadDropdowns } = useECMDropdowns();

  const [filters, setFilters] = useState<ECMSearchFilters>({});
  const [hasSearched, setHasSearched] = useState(false);

  // Carica dropdown obiettivi da AGENAS (una sola volta)
  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  // Pre-seleziona professione dall'utente se disponibile
  useEffect(() => {
    if (userProfile?.profile?.specializzazioni?.length) {
      const userProfessione = userProfile.profile.specializzazioni[0];
      const agenasId = SITE_TO_AGENAS[userProfessione];
      if (agenasId) {
        setFilters(prev => ({ ...prev, professione: agenasId }));
      }
    }
  }, [userProfile]);

  const handleSearch = () => {
    setHasSearched(true);
    search(filters);
  };

  const handleReset = () => {
    setFilters({});
    setHasSearched(false);
  };

  const updateFilter = (key: keyof ECMSearchFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">
            Corsi ECM
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Cerca corsi di Educazione Continua in Medicina dalla banca dati AGENAS.
            I risultati mostrano gli eventi dei prossimi 180 giorni.
          </p>
        </div>

        {/* Filtri */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Filtri di ricerca</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Professione */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Professione</label>
              <select
                value={filters.professione || ''}
                onChange={e => updateFilter('professione', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutte le professioni</option>
                {AGENAS_PROFESSIONI.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Tipologia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipologia</label>
              <select
                value={filters.tipologia || ''}
                onChange={e => updateFilter('tipologia', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutte le tipologie</option>
                {TIPOLOGIE.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Titolo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titolo evento</label>
              <input
                type="text"
                value={filters.titolo || ''}
                onChange={e => updateFilter('titolo', e.target.value)}
                placeholder="Cerca per titolo..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Range crediti */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Crediti ECM</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={filters.creditiMinimi || ''}
                  onChange={e => updateFilter('creditiMinimi', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Min"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-400 text-sm">—</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={filters.creditiMassimi || ''}
                  onChange={e => updateFilter('creditiMassimi', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Max"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Range costo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo (€)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={filters.costoMinimo ?? ''}
                  onChange={e => updateFilter('costoMinimo', e.target.value !== '' ? Number(e.target.value) : undefined)}
                  placeholder="Min"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-400 text-sm">—</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={filters.costoMassimo ?? ''}
                  onChange={e => updateFilter('costoMassimo', e.target.value !== '' ? Number(e.target.value) : undefined)}
                  placeholder="Max"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Obiettivo formativo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Obiettivo formativo</label>
              <select
                value={filters.obiettivo || ''}
                onChange={e => updateFilter('obiettivo', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutti gli obiettivi</option>
                {dropdowns?.obiettivi?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {filters.obiettivo && (
                <p className="text-xs text-amber-600 mt-1">Ricerca live su AGENAS (può richiedere qualche secondo)</p>
              )}
            </div>
          </div>

          {/* Bottoni */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Ricerca in corso...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Cerca Corsi ECM
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
            >
              Reset filtri
            </button>
          </div>
        </div>

        {/* Errore */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">{error}</p>
              <p className="text-xs text-red-600 mt-1">
                Puoi provare a cercare direttamente su{' '}
                <a
                  href="https://ape.agenas.it/Tools/Eventi.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  AGENAS
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Risultati */}
        {hasSearched && !loading && !error && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {events.length === 0
                ? 'Nessun evento trovato'
                : `${events.length} event${events.length === 1 ? 'o' : 'i'} trovat${events.length === 1 ? 'o' : 'i'}`}
              {hasMore ? ' (mostra di più sotto)' : ''}
            </p>
            <p className="text-xs text-gray-400">
              Dati forniti da AGENAS
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-5 bg-green-100 rounded-full w-16" />
                </div>
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="flex gap-2 mb-3">
                  <div className="h-5 bg-blue-50 rounded-full w-20" />
                  <div className="h-5 bg-purple-50 rounded-full w-16" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Griglia risultati */}
        {!loading && events.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <ECMEventCard
                  key={event.id}
                  event={event}
                />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMore}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
                >
                  Carica altri risultati
                </button>
              </div>
            )}
          </>
        )}

        {/* Stato vuoto iniziale */}
        {!hasSearched && !loading && (
          <div className="text-center py-16">
            <div className="mb-4 text-6xl">📚</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Cerca corsi ECM per la tua professione
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Utilizza i filtri sopra per trovare corsi di Educazione Continua in Medicina
              dalla banca dati nazionale AGENAS. La ricerca copre un periodo massimo di 180 giorni.
            </p>
            <a
              href="https://ape.agenas.it/Tools/Eventi.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
            >
              Vai alla ricerca avanzata su AGENAS
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {/* Stato vuoto dopo ricerca */}
        {hasSearched && !loading && events.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="mb-4 text-6xl">🔍</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Nessun evento trovato
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-4">
              Prova a modificare i filtri di ricerca o amplia l'intervallo di date.
            </p>
            <a
              href="https://ape.agenas.it/Tools/Eventi.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
            >
              Prova la ricerca avanzata su AGENAS
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
