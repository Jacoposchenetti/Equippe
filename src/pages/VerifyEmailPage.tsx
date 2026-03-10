import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { auth, functions } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';

export default function VerifyEmailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    if (!auth.currentUser) {
      // Non autenticato: chiedi all'utente di rifare il login
      navigate('/login');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const sendVerification = httpsCallable(functions, 'sendCustomVerificationEmail');
      await sendVerification();
      setSent(true);
      setCooldown(60); // 60 secondi di cooldown
      setTimeout(() => setSent(false), 5000);
    } catch (err: any) {
      console.error('Errore invio email di verifica:', err);
      
      // Gestisci errori specifici
      if (err.code === 'auth/too-many-requests') {
        setError('Troppe richieste. Attendi qualche minuto prima di provare di nuovo.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Utente non trovato. Riprova ad effettuare il login.');
        setTimeout(() => navigate('/login'), 2000);
      } else if (err.code === 'auth/network-request-failed') {
        setError('Errore di connessione. Controlla la tua connessione internet.');
      } else {
        setError('Errore nell\'invio dell\'email. Riprova più tardi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold mb-4">Verifica la tua email</h1>
          <p className="mb-4 text-gray-700">Abbiamo inviato un'email di verifica a <strong>{user?.email}</strong>. Clicca sul link nella email per verificare il tuo account.</p>

          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                {error}
              </div>
            )}
            
            <div>
              <button
                onClick={handleResend}
                disabled={loading || sent || cooldown > 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Invio...' : cooldown > 0 ? `Attendi ${cooldown}s` : 'Rimanda email di verifica'}
              </button>
              {sent && <span className="ml-3 text-sm text-green-600">✓ Email inviata! Controlla la tua casella di posta</span>}
              {cooldown > 0 && !sent && (
                <div className="mt-2 text-sm text-gray-600">
                  Puoi inviare un'altra email tra {cooldown} secondi
                </div>
              )}
            </div>

            <div>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md mr-3"
              >Torna alla home</button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >Esci</button>
            </div>

            <div className="text-sm text-gray-500">
              Se non ricevi l'email controlla la cartella spam o attendi qualche minuto. Se il problema persiste, contatta il supporto.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
