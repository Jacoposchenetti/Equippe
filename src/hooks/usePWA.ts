import { useEffect, useState } from 'react';

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  useEffect(() => {
    // Verifica se l'app è installata
    const checkInstallation = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isIOSInstalled = isIOS && (navigator as any).standalone;
      
      setIsInstalled(isStandalone || isIOSInstalled);
    };

    checkInstallation();
    window.addEventListener('resize', checkInstallation);

    // Gestione aggiornamenti service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setIsUpdateAvailable(true);
              }
            });
          }
        });

        // Controlla aggiornamenti ogni ora
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      });
    }

    return () => {
      window.removeEventListener('resize', checkInstallation);
    };
  }, []);

  const updateApp = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      });
      
      // Ricarica la pagina per applicare l'aggiornamento
      window.location.reload();
    }
  };

  return {
    isInstalled,
    isUpdateAvailable,
    updateApp
  };
}
