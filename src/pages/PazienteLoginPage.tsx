import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function PazienteLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      // Dual-role: se non esiste il doc paziente, crealo dai dati professionista (o errore se account sconosciuto)
      const patSnap = await getDoc(doc(db, 'patients', cred.user.uid));
      if (!patSnap.exists()) {
        const profSnap = await getDoc(doc(db, 'users', cred.user.uid));
        if (profSnap.exists()) {
          const profData = profSnap.data();
          const nomeCompleto = (profData.profile?.nome ?? cred.user.displayName ?? '').trim();
          const parts = nomeCompleto.split(' ');
          await setDoc(doc(db, 'patients', cred.user.uid), {
            uid: cred.user.uid,
            nome: parts[0] ?? '',
            cognome: parts.slice(1).join(' '),
            email: cred.user.email?.toLowerCase() ?? '',
            createdAt: Timestamp.now(),
            linkedProfessional: true,
          });
        } else {
          await auth.signOut();
          setError('Account non trovato. Registrati per continuare.');
          return;
        }
      }
      navigate('/paziente/appuntamenti');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('Email o password non corretti.');
      } else if (code === 'auth/too-many-requests') {
        setError('Troppi tentativi. Riprova più tardi.');
      } else {
        setError('Errore durante l\'accesso. Riprova.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/trova" className="flex items-center">
            <span className="text-blue-600 font-bold text-xl">tua</span>
            <span className="text-green-600 font-bold text-xl">equipe</span>
            <span className="text-orange-500 font-bold text-xl">.it</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Accedi al tuo account</h1>
            <p className="text-gray-600 text-sm mb-6">
              Visualizza e gestisci i tuoi appuntamenti.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="tua@email.it"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-60"
              >
                {loading ? 'Accesso in corso…' : 'Accedi'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center space-y-3">
              <p className="text-sm text-gray-600">
                Non hai ancora un account?{' '}
                <Link to="/paziente/registrati" className="text-blue-600 font-semibold hover:underline">
                  Registrati gratis
                </Link>
              </p>
              <p className="text-xs text-gray-400">
                Sei un professionista sanitario?{' '}
                <Link to="/login" className="text-gray-600 hover:underline">Accedi qui</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
