import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Email di recupero inviata! Controlla la tua casella di posta (anche lo spam).');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setResetError('Nessun account trovato con questa email.');
      } else if (err.code === 'auth/invalid-email') {
        setResetError('Indirizzo email non valido.');
      } else if (err.code === 'auth/too-many-requests') {
        setResetError('Troppi tentativi. Riprova più tardi.');
      } else {
        setResetError('Errore durante l\'invio. Riprova.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      
      // Verifica che l'email sia stata verificata
      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.emailVerified) {
        try {
          await sendEmailVerification(currentUser);
        } catch (e) {
          console.error('Errore invio email di verifica:', e);
        }
        // Mantieni l'utente autenticato temporaneamente e reindirizza alla pagina di verifica
        navigate('/verify-email');
        setLoading(false);
        return;
      }

      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Email o password errati. Riprova.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Troppi tentativi falliti. Riprova più tardi.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Indirizzo email non valido.');
      } else {
        setError('Errore durante il login. Riprova.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-center text-blue-600">
            Equipe
          </h1>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accedi al tuo account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Non hai un account?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Registrati
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10"
                placeholder="La tua email"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10"
                placeholder="La tua password"
              />
            </div>
          </div>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setResetMode(true);
                setResetEmail(email);
                setResetError('');
                setResetMessage('');
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Password dimenticata?
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </div>
        </form>

        {/* Modale recupero password */}
        {resetMode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Recupera password
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Inserisci il tuo indirizzo email e ti invieremo un link per reimpostare la password.
              </p>

              <form onSubmit={handlePasswordReset} className="space-y-4">
                {resetError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-600">{resetError}</p>
                  </div>
                )}

                {resetMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-sm text-green-700">{resetMessage}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="La tua email"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(false);
                      setResetError('');
                      setResetMessage('');
                    }}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? 'Invio...' : 'Invia email'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
