import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Verifica se è già installata
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInstalled = isStandalone || (isIOS && (navigator as any).standalone);

    if (isInstalled) {
      return;
    }

    // Ascolta l'evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Mostra il prompt dopo 30 secondi dall'apertura
      setTimeout(() => {
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        const dismissedDate = dismissed ? new Date(dismissed) : null;
        const daysSinceDismissed = dismissedDate 
          ? (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24) 
          : Infinity;

        // Mostra il prompt se non è stato dismissato negli ultimi 7 giorni
        if (daysSinceDismissed > 7) {
          setShowPrompt(true);
        }
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installata con successo');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    setShowPrompt(false);
  };

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md bg-white rounded-xl shadow-2xl border-2 border-blue-500 z-50 overflow-hidden animate-slide-up">
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <img 
              src="/icon-72x72.png" 
              alt="Equipé" 
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
              Installa Equipé
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Installa l'app sul tuo dispositivo per un accesso rapido e un'esperienza migliore
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm text-sm touch-friendly"
              >
                Installa
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition text-sm touch-friendly"
              >
                Non ora
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition"
            aria-label="Chiudi"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
