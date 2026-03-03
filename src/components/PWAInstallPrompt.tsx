import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Verifica se è già installata
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isiOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInstalled = isStandalone || (isiOSDevice && (navigator as any).standalone);

    if (isInstalled) {
      return;
    }

    // Su iOS mostra il banner manuale dopo 5 secondi
    if (isiOSDevice) {
      setIsIOS(true);
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
      return;
    }

    // Su Android/Desktop ascolta l'evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
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
    setShowPrompt(false);
  };

  // Banner iOS: istruzioni manuali per "Aggiungi alla schermata Home"
  if (showPrompt && isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md bg-white rounded-xl shadow-2xl border-2 border-blue-500 z-50 overflow-hidden animate-slide-up">
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <img 
                src="/icon-72x72.png" 
                alt="Equipé" 
                className="w-12 h-12 rounded-xl"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Installa Equipé
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Per installare l'app sul tuo iPhone:
              </p>
              <ol className="text-sm text-gray-700 space-y-2 mb-3">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Tocca l'icona <span className="inline-flex items-center"><svg className="w-5 h-5 text-blue-500 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></span> in basso</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>Scorri e tocca <strong>"Aggiungi alla schermata Home"</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>Tocca <strong>"Aggiungi"</strong> in alto a destra</span>
                </li>
              </ol>
              <button
                onClick={handleDismiss}
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition text-sm"
              >
                Ho capito
              </button>
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
        {/* Freccia che punta verso il basso (verso il pulsante condividi di Safari) */}
        <div className="flex justify-center pb-2">
          <svg className="w-6 h-6 text-blue-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    );
  }

  // Banner Android/Desktop
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
