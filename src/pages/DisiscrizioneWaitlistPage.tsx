import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const UNSUBSCRIBE_URL = 'https://europe-west1-equippe-271f5.cloudfunctions.net/unsubscribeFromWaitlist';

export default function DisiscrizioneWaitlistPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const token = searchParams.get('t');
    if (!token) {
      setStatus('error');
      return;
    }

    fetch(`${UNSUBSCRIBE_URL}?t=${encodeURIComponent(token)}`)
      .then(res => {
        if (res.ok) setStatus('success');
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center">
        <a href="https://tuaequipe.it">
          <img
            src="/logo-equipe.png"
            alt="tuaequipe.it"
            className="h-16 mx-auto mb-6"
          />
        </a>

        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Elaborazione in corso...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Disiscrizione confermata</h1>
            <p className="text-gray-600 mb-6">
              La tua email è stata rimossa dalla nostra lista. Non riceverai più comunicazioni dalla waitlist di tuaequipe.it.
            </p>
            <a
              href="https://tuaequipe.it"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Torna al sito
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-400 text-5xl mb-4">✕</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Link non valido</h1>
            <p className="text-gray-600 mb-6">
              Il link di disiscrizione non è valido o è già stato utilizzato. Se hai bisogno di assistenza, contattaci a{' '}
              <a href="mailto:info@tuaequipe.it" className="text-blue-600 underline">
                info@tuaequipe.it
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
