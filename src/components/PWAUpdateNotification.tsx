import { usePWA } from '@/hooks/usePWA';

export default function PWAUpdateNotification() {
  const { isUpdateAvailable, updateApp } = usePWA();

  if (!isUpdateAvailable) {
    return null;
  }

  return (
    <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md bg-blue-600 text-white rounded-lg shadow-2xl z-50 overflow-hidden animate-slide-up">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold mb-1">
              Aggiornamento Disponibile
            </h3>
            <p className="text-sm text-blue-100 mb-3">
              È disponibile una nuova versione di Equipé con miglioramenti e correzioni
            </p>
            <button
              onClick={updateApp}
              className="w-full px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition shadow-sm text-sm touch-friendly"
            >
              Aggiorna Ora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
