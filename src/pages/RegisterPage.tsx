import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth, functions } from '@/lib/firebase';
import { Studio } from '@/types/equippe';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { httpsCallable } from 'firebase/functions';
import { PROFESSIONI_DISPONIBILI, CONFIGURAZIONI_PROFESSIONI } from '@/lib/professioni';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const isGoogleProvider = searchParams.get('provider') === 'google';
  const [step, setStep] = useState(isGoogleProvider ? 2 : 0);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nome: '',
    telefono: '',
    professione: '',
    numeroAlbo: '',
    studi: [] as Studio[],
  });
  const [consents, setConsents] = useState({
    termini: false,
    privacy: false,
    marketing: false
  });
  const [currentStudio, setCurrentStudio] = useState<Studio>({
    indirizzo: '',
    città: '',
    provincia: '',
    remoto: false,
    coordinate: undefined,
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // honeypot anti-bot
  const { signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // Label dinamica del campo albo in base alla professione selezionata
  const alboConfig = formData.professione
    ? CONFIGURAZIONI_PROFESSIONI[formData.professione]?.documentiRichiesti?.find(d => d.tipo === 'albo' && d.obbligatorio)
    : null;

  // Se l'utente arriva da Google, pre-compila i dati dal profilo Google
  useEffect(() => {
    if (isGoogleProvider && auth.currentUser) {
      const googleUser = auth.currentUser;
      setFormData(prev => ({
        ...prev,
        email: googleUser.email || '',
        nome: googleUser.displayName || '',
      }));
    }
  }, [isGoogleProvider]);

  const addStudio = () => {
    if (!currentStudio.indirizzo || !currentStudio.coordinate) {
      setError('Seleziona un indirizzo valido dal suggeritore per procedere');
      return;
    }
    setFormData({
      ...formData,
      studi: [...formData.studi, { ...currentStudio }],
    });
    setCurrentStudio({
      indirizzo: '',
      città: '',
      provincia: '',
      remoto: false,
      coordinate: undefined
    });
    setError('');
  };

  const removeStudio = (index: number) => {
    setFormData({
      ...formData,
      studi: formData.studi.filter((_, i) => i !== index),
    });
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    if (formData.password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Honeypot: se compilato, è un bot — finge successo e naviga via
    if (honeypot) {
      navigate('/verify-email');
      return;
    }

    // Per utenti Google: verifica che nome sia compilato
    if (isGoogleProvider && !formData.nome.trim()) {
      setError('Il nome è obbligatorio');
      return;
    }

    // Validazione consensi obbligatori GDPR
    if (!consents.termini || !consents.privacy) {
      setError('Devi accettare i Termini di Servizio e l\'Informativa Privacy per procedere');
      return;
    }

    if (!formData.professione) {
      setError('Seleziona una professione');
      return;
    }

    if (!formData.numeroAlbo.trim()) {
      setError('Il numero di iscrizione all\'albo è obbligatorio');
      return;
    }

    if (!formData.telefono.trim()) {
      setError('Il numero di telefono è obbligatorio');
      return;
    }

    if (formData.studi.length === 0) {
      setError('Aggiungi almeno uno studio');
      return;
    }

    setLoading(true);

    try {
      let currentUser;
      
      if (isGoogleProvider && auth.currentUser) {
        currentUser = auth.currentUser;
      } else {
        currentUser = await signUp(formData.email, formData.password, formData.nome);
      }
      
      if (!currentUser) {
        throw new Error('User not authenticated after signup');
      }

      // Costruisci professionePending minimale con solo il documento albo
      const alboDocConfig = CONFIGURAZIONI_PROFESSIONI[formData.professione]?.documentiRichiesti?.find(d => d.tipo === 'albo' && d.obbligatorio);
      const professionePending = {
        professione: formData.professione,
        documenti: [{
          tipo: 'albo' as const,
          nome: alboDocConfig?.nome || 'Numero iscrizione albo',
          valore: formData.numeroAlbo.trim(),
        }],
      };

      // Salva profilo minimale in Firestore
      const profileData = {
        uid: currentUser.uid,
        email: formData.email,
        profile: {
          nome: formData.nome,
          albo: '', // Campo deprecato
          specializzazioni: [formData.professione], // Per retrocompatibilità
          professioniPending: [professionePending],
          tematiche: [] as string[],
          esperienza: '',
          location: { lat: 0, lng: 0, città: 'Italia' }, // Legacy
          studi: formData.studi,
          disponibilità: '',
          telefono: formData.telefono.trim(),
          verified: false,
          verificationInfo: {
            status: 'pending' as const,
            submittedAt: Timestamp.now()
          }
        },
        teams: [] as string[],
        stats: { referralsSent: 0, referralsReceived: 0 },
        consents: {
          termini: { accepted: consents.termini, timestamp: Timestamp.now() },
          privacy: { accepted: consents.privacy, timestamp: Timestamp.now() },
          marketing: { accepted: consents.marketing, timestamp: Timestamp.now() }
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        authProvider: isGoogleProvider ? 'google' : 'email',
      };

      // Per utenti Google: usa foto Google come fallback
      if (isGoogleProvider && auth.currentUser?.photoURL) {
        (profileData.profile as any).photoURL = auth.currentUser.photoURL;
      }

      console.log('💾 Salvataggio profilo in Firestore per utente:', currentUser.uid);
      
      try {
        await setDoc(doc(db, 'users', currentUser.uid), profileData);
        console.log('✅ Profilo salvato con successo');
      } catch (firestoreError: any) {
        console.error('❌ ERRORE FIRESTORE setDoc:', firestoreError);
        throw firestoreError;
      }

      // Invia email di verifica solo per registrazione email/password
      if (!isGoogleProvider) {
        try {
          const sendVerification = httpsCallable(functions, 'sendCustomVerificationEmail');
          await sendVerification();
          console.log('📧 Email di verifica inviata tramite Resend');
        } catch (emailErr) {
          console.error('⚠️ Errore invio email verifica (non bloccante):', emailErr);
        }
      }

      // In dev mode o Google: vai diretto alla dashboard
      // In produzione con email: vai alla pagina di verifica email
      if (isGoogleProvider || import.meta.env.DEV) {
        navigate('/dashboard');
      } else {
        navigate('/verify-email');
      }
    } catch (err: any) {
      console.error('❌ Errore registrazione:', err);
      
      if (err.code === 'auth/email-already-in-use') {
        setError('Questa email è già registrata. Usa il login o un\'altra email.');
      } else if (err.code === 'auth/weak-password') {
        setError('La password deve essere di almeno 6 caratteri.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Email non valida.');
      } else if (err.message?.includes('not authenticated')) {
        setError('Errore di autenticazione. Riprova.');
      } else if (err.message?.includes('permission-denied')) {
        setError('Errore di permessi nel database. Contatta il supporto.');
      } else {
        setError(err.message || 'Errore durante la registrazione. Riprova.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight"><span className="text-blue-600">tua</span><span className="text-green-600">equipe</span><span className="text-orange-500">.it</span></h1>
          {step === 0 ? (
            <h2 className="mt-6 text-2xl font-extrabold text-gray-900">Come vuoi registrarti?</h2>
          ) : (
            <h2 className="mt-4 text-2xl font-bold">Registrati come professionista</h2>
          )}
          <p className="mt-2 text-sm text-gray-600">
            Hai già un account?{' '}
            <button
              type="button"
              onClick={async () => {
                if (isGoogleProvider && auth.currentUser) {
                  const { signOut } = await import('firebase/auth');
                  await signOut(auth);
                }
                window.location.href = '/login';
              }}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Accedi
            </button>
          </p>
          {step > 0 && (
            <div className="mt-4 flex justify-center gap-2">
              <div className={`h-2 w-20 rounded ${step >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`h-2 w-20 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          {error && <div className="bg-red-50 p-4 rounded mb-6 text-red-800">{error}</div>}

          {step === 0 ? (
            <div className="space-y-4">
              {/* Opzione Email */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full flex items-center justify-between px-6 py-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-base font-medium text-gray-900">Usa la mail</span>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Opzione Google */}
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setGoogleLoading(true);
                  try {
                    const { user: googleUser, isNewUser } = await signInWithGoogle();
                    if (isNewUser) {
                      setFormData(prev => ({
                        ...prev,
                        email: googleUser.email || '',
                        nome: googleUser.displayName || '',
                      }));
                      navigate('/register?provider=google', { replace: true });
                      setStep(2);
                    } else {
                      navigate('/dashboard');
                    }
                  } catch (err: any) {
                    if (err.code === 'auth/popup-closed-by-user') {
                      // Utente ha chiuso il popup
                    } else if (err.code === 'auth/account-exists-with-different-credential') {
                      setError('Esiste già un account con questa email. Accedi con email e password.');
                    } else {
                      setError('Errore durante la registrazione con Google. Riprova.');
                    }
                  } finally {
                    setGoogleLoading(false);
                  }
                }}
                disabled={googleLoading}
                className="w-full flex items-center justify-between px-6 py-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  <span className="text-base font-medium text-gray-900">
                    {googleLoading ? 'Registrazione in corso...' : 'Registrati con Google'}
                  </span>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Dati di accesso</h3>
                <button type="button" onClick={() => setStep(0)} className="text-sm text-blue-600">← Indietro</button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nome completo *</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border rounded"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 border rounded"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password (min. 8 caratteri) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border rounded"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Conferma password *</label>
                <input
                  type="password"
                  required
                  className="w-full px-3 py-2 border rounded"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>

              <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Avanti
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Informazioni professionali</h3>
                {!isGoogleProvider && (
                  <button type="button" onClick={() => setStep(1)} className="text-sm text-blue-600">&larr; Indietro</button>
                )}
              </div>

              {/* Per utenti Google: mostra nome modificabile */}
              {isGoogleProvider && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <p className="text-sm text-blue-800">
                    ✅ Accesso con Google effettuato.
                  </p>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome completo *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border rounded"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Honeypot anti-bot */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
                <label htmlFor="company">Company</label>
                <input id="company" type="text" name="company" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              </div>

              {/* Professione */}
              <div>
                <label className="block text-sm font-medium mb-1">Professione *</label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={formData.professione}
                  onChange={(e) => setFormData({ ...formData, professione: e.target.value, numeroAlbo: '' })}
                  required
                >
                  <option value="">-- Seleziona una professione --</option>
                  {PROFESSIONI_DISPONIBILI.map(prof => (
                    <option key={prof} value={prof}>{prof}</option>
                  ))}
                </select>
              </div>

              {/* Numero iscrizione albo — label dinamica */}
              {formData.professione && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {alboConfig?.nome || 'Numero iscrizione albo'} *
                  </label>
                  {alboConfig?.descrizione && (
                    <p className="text-xs text-gray-500 mb-1">{alboConfig.descrizione}</p>
                  )}
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border rounded"
                    placeholder={alboConfig?.placeholder || 'es. 12345'}
                    value={formData.numeroAlbo}
                    onChange={(e) => setFormData({ ...formData, numeroAlbo: e.target.value })}
                  />
                </div>
              )}

              {/* Telefono */}
              <div>
                <label className="block text-sm font-medium mb-1">Telefono *</label>
                <input
                  type="tel"
                  required
                  className="w-full px-3 py-2 border rounded"
                  placeholder="es. 333 1234567"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>

              {/* Studi */}
              <div>
                <label className="block text-sm font-medium mb-2">Indirizzo studio *</label>
                
                {formData.studi.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {formData.studi.map((studio, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded">
                        <div className="text-sm">
                          <div className="font-medium">{studio.indirizzo}</div>
                          {studio.coordinate && (
                            <div className="text-xs text-green-600">
                              📍 Geo: {studio.coordinate.lat.toFixed(4)}, {studio.coordinate.lng.toFixed(4)}
                            </div>
                          )}
                          {studio.remoto && <div className="text-blue-600">Lavoro da remoto</div>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStudio(index)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border rounded p-4 space-y-3">
                  <div>
                    <AddressAutocomplete
                      value={currentStudio.indirizzo}
                      coordinate={currentStudio.coordinate}
                      onChange={(location) => {
                        setCurrentStudio({
                          ...currentStudio,
                          indirizzo: location.indirizzo || '',
                          coordinate: location.coordinate,
                          città: '',
                          provincia: ''
                        });
                      }}
                      placeholder="es. Via Roma 123, Milano MI"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Seleziona l'indirizzo dal suggeritore per la geolocalizzazione
                    </p>
                  </div>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={currentStudio.remoto}
                      onChange={(e) => setCurrentStudio({ ...currentStudio, remoto: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">Lavoro da remoto disponibile</span>
                  </label>

                  <button
                    type="button"
                    onClick={addStudio}
                    className="w-full py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                  >
                    + Aggiungi Studio
                  </button>
                </div>
              </div>

              {/* Consensi GDPR */}
              <div className="space-y-4 p-5 bg-gray-50 rounded-lg border">
                <h3 className="font-semibold text-gray-900">Consensi Privacy</h3>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents.termini}
                    onChange={(e) => setConsents({...consents, termini: e.target.checked})}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm leading-relaxed">
                    Ho letto e accetto i{' '}
                    <Link to="/legal/termini" className="text-blue-600 underline hover:text-blue-800" target="_blank">
                      Termini e Condizioni di Servizio
                    </Link>{' '}
                    <span className="text-red-500">*</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents.privacy}
                    onChange={(e) => setConsents({...consents, privacy: e.target.checked})}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm leading-relaxed">
                    Ho letto e accetto l'
                    <Link to="/legal/privacy" className="text-blue-600 underline hover:text-blue-800" target="_blank">
                      Informativa Privacy
                    </Link>{' '}
                    <span className="text-red-500">*</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents.marketing}
                    onChange={(e) => setConsents({...consents, marketing: e.target.checked})}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm leading-relaxed">
                    Vorrei ricevere comunicazioni informative sui nuovi servizi{' '}
                    <span className="text-gray-400">(facoltativo)</span>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !consents.termini || !consents.privacy}
                className="w-full py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Registrazione in corso...' : 'Registrati'}
              </button>

              {(!consents.termini || !consents.privacy) && (
                <p className="text-sm text-red-600 text-center">
                  Accetta i consensi obbligatori per completare la registrazione
                </p>
              )}
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Potrai completare il tuo profilo dopo la registrazione
        </p>
      </div>
    </div>
  );
}
