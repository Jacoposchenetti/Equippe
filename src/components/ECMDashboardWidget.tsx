import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useECMSearch, ECMEvent, SITE_TO_AGENAS } from '@/hooks/useECMSearch';
import ECMEventCard from './ECMEventCard';

export default function ECMDashboardWidget() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { events, loading, error, search } = useECMSearch();
  const [attempted, setAttempted] = useState(false);

  // Auto-ricerca basata sulla professione dell'utente
  useEffect(() => {
    if (attempted) return;

    const userProfessioni = userProfile?.profile?.specializzazioni;
    if (!userProfessioni?.length) {
      setAttempted(true);
      search({});
      return;
    }

    // Cerca la prima professione dell'utente che ha un mapping AGENAS
    const agenasId = userProfessioni
      .map((p: string) => SITE_TO_AGENAS[p])
      .find((id: string | undefined) => id);

    setAttempted(true);
    search(agenasId ? { professione: agenasId } : {});
  }, [userProfile, attempted, search]);

  // Non mostrare il widget se c'è errore o se non ci sono risultati dopo il tentativo
  if (error || (attempted && !loading && events.length === 0)) {
    return null;
  }

  const displayedEvents = events.slice(0, 4);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">📚</span>
          <h2 className="text-lg font-semibold text-gray-800">Corsi ECM</h2>
        </div>
        <button
          onClick={() => navigate('/ecm')}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          Vedi tutti
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
              <div className="flex justify-between mb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-green-100 rounded-full w-14" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Risultati */}
      {!loading && displayedEvents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayedEvents.map((event: ECMEvent, index: number) => (
            <ECMEventCard key={`${event.id}-${index}`} event={event} compact />
          ))}
        </div>
      )}

      {/* Footer */}
      {!loading && events.length > 4 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            +{events.length - 4} altri corsi disponibili • Dati AGENAS
          </p>
        </div>
      )}
    </div>
  );
}
