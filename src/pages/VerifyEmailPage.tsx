import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      
      // Gestisci errori specifici - httpsCallable wrappa il codice in functions/
      const code = err?.code || '';
      const message = err?.message || '';
      
      if (code === 'functions/resource-exhausted' || message.includes('Troppe richieste') || message.includes('TOO_MANY')) {
        setCooldown(300); // 5 minuti
        setError('Troppe richieste. Riprova tra 5 minuti.');
      } else if (code === 'auth/too-many-requests') {
        setCooldown(300);
        setError('Troppe richieste. Riprova tra 5 minuti.');
      } else if (code === 'auth/user-not-found') {
        setError('Utente non trovato. Riprova ad effettuare il login.');
        setTimeout(() => navigate('/login'), 2000);
      } else if (code === 'auth/network-request-failed') {
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Logo header minimal, nessuna navigazione */}
      <div className="py-6 flex justify-center">
        <span className="text-2xl font-bold text-teal-600">tuaequipe</span>
      </div>

      <div className="flex-1 flex items-start justify-center px-6 pt-8">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-1.5 w-10 rounded-full bg-teal-600" />
            <div className="h-1.5 w-10 rounded-full bg-teal-600" />
            <div className="h-1.5 w-10 rounded-full bg-teal-600" />
          </div>

          <h1 className="text-2xl font-bold mb-2 text-center">Verifica la tua email</h1>
          <p className="mb-6 text-gray-600 text-center text-sm">Abbiamo inviato un link di verifica a <strong>{user?.email}</strong>. Clicca sul link per attivare il tuo account.</p>

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
                className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed font-medium text-sm"
              >
                {loading ? 'Invio...' : cooldown > 0 ? `Attendi ${Math.floor(cooldown / 60)}:${(cooldown % 60).toString().padStart(2, '0')}` : 'Rimanda email di verifica'}
              </button>
              {sent && <span className="ml-3 text-sm text-green-600">✓ Email inviata! Controlla la tua casella di posta</span>}
              {cooldown > 0 && !sent && (
                <div className="mt-2 text-sm text-gray-600">
                  Puoi inviare un'altra email tra {Math.floor(cooldown / 60)}:{(cooldown % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >Esci</button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Non hai ricevuto l'email? Controlla la cartella spam o attendi qualche minuto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
