import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function PazienteRegistratiPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gdpr, setGdpr] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!gdpr) {
      setError('Devi accettare la Privacy Policy per continuare.');
      return;
    }
    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri.');
      return;
    }
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      await setDoc(doc(db, 'patients', cred.user.uid), {
        uid: cred.user.uid,
        nome: nome.trim(),
        cognome: cognome.trim(),
        email: normalizedEmail,
        createdAt: Timestamp.now(),
      });

      // Collega gli appuntamenti prenotati in precedenza con questa email
      const existingAppts = await getDocs(
        query(collection(db, 'appointments'), where('patientEmail', '==', normalizedEmail))
      );
      if (!existingAppts.empty) {
        const batch = writeBatch(db);
        existingAppts.docs.forEach(apptDoc => {
          if (!apptDoc.data().pazienteUid) {
            batch.update(apptDoc.ref, { pazienteUid: cred.user.uid });
          }
        });
        await batch.commit();
      }

      navigate('/paziente/appuntamenti');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        setError('Questa email è già in uso. Prova ad accedere.');
      } else if (code === 'auth/invalid-email') {
        setError('Email non valida.');
      } else if (code === 'auth/weak-password') {
        setError('Password troppo debole. Usa almeno 8 caratteri.');
      } else {
        setError('Errore durante la registrazione. Riprova.');
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
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Crea il tuo account</h1>
            <p className="text-gray-600 text-sm mb-6">
              Gratuito. Tieni traccia dei tuoi appuntamenti in un solo posto.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    required
                    placeholder="Mario"
                    autoComplete="given-name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                  <input
                    type="text"
                    value={cognome}
                    onChange={e => setCognome(e.target.value)}
                    required
                    placeholder="Rossi"
                    autoComplete="family-name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
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
                    autoComplete="new-password"
                    placeholder="min. 8 caratteri"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gdpr}
                  onChange={e => setGdpr(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  Accetto la{' '}
                  <Link to="/legal/privacy" target="_blank" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </Link>
                  {' '}e i{' '}
                  <Link to="/legal/termini" target="_blank" className="text-blue-600 hover:underline">
                    Termini di Servizio
                  </Link>
                  .
                </span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-60"
              >
                {loading ? 'Registrazione in corso…' : 'Crea account gratuito'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center space-y-3">
              <p className="text-sm text-gray-600">
                Hai già un account?{' '}
                <Link to="/paziente/login" className="text-blue-600 font-semibold hover:underline">
                  Accedi
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
