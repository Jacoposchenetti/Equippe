import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, functions } from '@/lib/firebase';
import { Studio, ProfessioneConDocumenti, EsperienzaProfessionale, Formazione, Certificazione } from '@/types/equippe';
import { CITTA_ITALIANE, PROVINCE_ITALIANE } from '@/lib/comuni';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { httpsCallable } from 'firebase/functions';
import DocumentiProfessioneForm from '@/components/DocumentiProfessioneForm';
import { EsperienzaAttualeRegistrazione } from '@/components/CurriculumSection';
import { PROFESSIONI_DISPONIBILI } from '@/lib/professioni';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const isGoogleProvider = searchParams.get('provider') === 'google';
  const [step, setStep] = useState(isGoogleProvider ? 2 : 0);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nome: '',
    dataNascita: '',
    città: '', // Mantieni per backward compatibility
    disponibilità: '',
    studi: [] as Studio[],
    professioniConDocumenti: [] as ProfessioneConDocumenti[],
    esperienzaAttuale: null as EsperienzaProfessionale | null,
    formazione: [] as Formazione[],
    certificazioni: [] as Certificazione[],
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
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
  
  // Stati per la gestione delle professioni
  const [selectedProfessione, setSelectedProfessione] = useState('');
  const [showDocumentiForm, setShowDocumentiForm] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // Se l'utente arriva da Google, pre-compila i dati dal profilo Google
  useEffect(() => {
    if (isGoogleProvider && auth.currentUser) {
      const googleUser = auth.currentUser;
      setFormData(prev => ({
        ...prev,
        email: googleUser.email || '',
        nome: googleUser.displayName || '',
      }));
      if (googleUser.photoURL) {
        setPhotoPreview(googleUser.photoURL);
      }
    }
  }, [isGoogleProvider]);

  // Funzione per rimuovere ricorsivamente tutti i campi undefined
  const removeUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (Array.isArray(obj)) {
      return obj
        .map(item => removeUndefined(item))
        .filter(item => item !== null && item !== undefined);
    }
    if (obj instanceof Date || obj.constructor.name === 'Timestamp') {
      return obj; // Preserva Date e Timestamp
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== undefined) {
          const cleanedValue = removeUndefined(value);
          if (cleanedValue !== null && cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        }
      });
      return Object.keys(cleaned).length > 0 ? cleaned : null;
    }
    return obj;
  };

  const addStudio = () => {
    if (!currentStudio.indirizzo || !currentStudio.coordinate) {
      setError('Seleziona un indirizzo valido dal suggeritore per procedere');
      return;
    }
    setFormData({
      ...formData,
      studi: [...formData.studi, { ...currentStudio }],
      città: formData.città || 'Italia', // Default generico
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
  
  // Gestione professioni
  const handleAddProfessione = () => {
    if (!selectedProfessione) {
      setError('Seleziona una professione');
      return;
    }
    
    // Verifica che la professione non sia già stata aggiunta
    if (formData.professioniConDocumenti.some(p => p.professione === selectedProfessione)) {
      setError('Questa professione è già stata aggiunta');
      return;
    }
    
    setError('');
    setShowDocumentiForm(true);
  };
  
  const handleProfessioneComplete = (data: ProfessioneConDocumenti) => {
    console.log('✅ Professione completata in RegisterPage:', data);
    setFormData({
      ...formData,
      professioniConDocumenti: [...formData.professioniConDocumenti, data]
    });
    setShowDocumentiForm(false);
    setSelectedProfessione('');
    setError(''); // Pulisci eventuali errori
    console.log('📋 Form aggiornato, step corrente:', step);
  };
  
  const handleProfessioneCancel = () => {
    setShowDocumentiForm(false);
    setSelectedProfessione('');
  };
  
  const removeProfessione = (index: number) => {
    setFormData({
      ...formData,
      professioniConDocumenti: formData.professioniConDocumenti.filter((_, i) => i !== index)
    });
  };

  const toggleArray = (array: string[], item: string) => {
    return array.includes(item) ? array.filter(i => i !== item) : [...array, item];
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

    // Per utenti Google: verifica che nome e data di nascita siano compilati
    if (isGoogleProvider) {
      if (!formData.nome.trim()) {
        setError('Il nome è obbligatorio');
        return;
      }
      if (!formData.dataNascita) {
        setError('La data di nascita è obbligatoria');
        return;
      }
    }

    // Validazione consensi obbligatori GDPR
    if (!consents.termini || !consents.privacy) {
      setError('Devi accettare i Termini di Servizio e l\'Informativa Privacy per procedere');
      return;
    }

    if (formData.professioniConDocumenti.length === 0) {
      setError('Aggiungi almeno una professione con i relativi documenti');
      return;
    }

    if (!formData.esperienzaAttuale || !formData.esperienzaAttuale.titolo.trim() || !formData.esperienzaAttuale.organizzazione.trim() || !formData.esperienzaAttuale.dataInizio) {
      setError('Compila l\'esperienza professionale attuale (ruolo, organizzazione e data inizio sono obbligatori)');
      return;
    }

    if (formData.studi.length === 0) {
      setError('Aggiungi almeno uno studio o seleziona "Lavoro da remoto"');
      return;
    }

    setLoading(true);

    try {
      let currentUser;
      
      if (isGoogleProvider && auth.currentUser) {
        // Utente Google: già autenticato, non serve creare l'account
        currentUser = auth.currentUser;
      } else {
        // Registrazione classica con email/password
        currentUser = await signUp(formData.email, formData.password, formData.nome);
      }
      
      if (!currentUser) {
        throw new Error('User not authenticated after signup');
      }

      // Upload foto profilo se presente
      let photoURL = '';
      if (photoFile) {
        try {
          console.log('Inizio upload foto profilo...');
          const photoRef = ref(storage, `profile-photos/${currentUser.uid}`);
          await uploadBytes(photoRef, photoFile);
          photoURL = await getDownloadURL(photoRef);
          console.log('Foto caricata con successo');
        } catch (uploadError) {
          console.error('Errore upload foto:', uploadError);
          // Continua la registrazione senza foto
        }
      }

      // Costruisci lista specializzazioni per retrocompatibilità
      const specializzazioni = formData.professioniConDocumenti.map(p => p.professione);
      
      // Aggrega tematiche ed esperienza da tutte le professioni per retrocompatibilità
      const tematicheAggregate = Array.from(new Set(
        formData.professioniConDocumenti.flatMap(p => p.tematiche || [])
      ));
      // Prendi l'esperienza maggiore tra tutte le professioni (o la prima disponibile)
      const esperienzaAggregata = formData.professioniConDocumenti.find(p => p.anniEsperienza)?.anniEsperienza || '';

      // Salva profilo completo in Firestore
      const profileData: any = {
        uid: currentUser.uid,
        email: formData.email,
        profile: {
          nome: formData.nome,
          dataNascita: formData.dataNascita,
          albo: '', // Campo deprecato, lasciato vuoto
          specializzazioni: specializzazioni, // Per retrocompatibilità
          professioniPending: formData.professioniConDocumenti, // Professioni in attesa di approvazione admin
          tematiche: tematicheAggregate, // Aggregate da professioni per retrocompatibilità
          esperienza: esperienzaAggregata, // Presa da professioni per retrocompatibilità
          location: { lat: 0, lng: 0, città: formData.città }, // Legacy
          studi: formData.studi, // Nuovo campo multi-studio
          disponibilità: formData.disponibilità,
          esperienze: formData.esperienzaAttuale ? [formData.esperienzaAttuale] : [],
          formazione: formData.formazione,
          certificazioni: formData.certificazioni,
          verified: false, // Sarà verificato manualmente dall'admin
          verificationInfo: {
            status: 'pending',
            submittedAt: Timestamp.now()
          }
        },
        teams: [],
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

      // Aggiungi photoURL: usa foto caricata, oppure foto Google come fallback
      if (photoURL) {
        profileData.profile.photoURL = photoURL;
      } else if (isGoogleProvider && auth.currentUser?.photoURL) {
        profileData.profile.photoURL = auth.currentUser.photoURL;
      }

      // Rimuovi tutti i campi undefined ricorsivamente
      const cleanProfileData = removeUndefined(profileData);

      console.log('💾 Salvataggio profilo in Firestore per utente:', currentUser.uid);
      console.log('📝 Dati profilo da salvare:', cleanProfileData);
      
      try {
        await setDoc(doc(db, 'users', currentUser.uid), cleanProfileData);
        console.log('✅ Profilo salvato con successo');
      } catch (firestoreError: any) {
        console.error('❌ ERRORE FIRESTORE setDoc:', firestoreError);
        console.error('   Codice:', firestoreError.code);
        console.error('   Messaggio:', firestoreError.message);
        throw firestoreError; // Rilancia l'errore per gestirlo nel catch esterno
      }

      // Invia email di verifica solo per registrazione email/password
      // (Google verifica l'email automaticamente)
      if (!isGoogleProvider) {
        try {
          const sendVerification = httpsCallable(functions, 'sendCustomVerificationEmail');
          await sendVerification();
          console.log('📧 Email di verifica inviata tramite Resend');
        } catch (emailErr) {
          console.error('⚠️ Errore invio email verifica (non bloccante):', emailErr);
        }
      }

      // Google: vai direttamente alla dashboard (email già verificata)
      // Email: vai alla pagina di verifica email
      if (isGoogleProvider) {
        navigate('/dashboard');
      } else {
        navigate('/verify-email');
      }
    } catch (err: any) {
      console.error('❌ Errore registrazione completo:', err);
      console.error('   Codice errore:', err.code);
      console.error('   Messaggio:', err.message);
      console.error('   Stack:', err.stack);
      
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
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600">Equipé</h1>
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
                      if (googleUser.photoURL) {
                        setPhotoPreview(googleUser.photoURL);
                      }
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
                <label className="block text-sm font-medium mb-1">Data di nascita *</label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border rounded"
                  value={formData.dataNascita}
                  onChange={(e) => setFormData({ ...formData, dataNascita: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Foto profilo</label>
                <div className="space-y-2">
                  {photoPreview && (
                    <div className="flex justify-center">
                      <img src={photoPreview} alt="Anteprima" className="w-32 h-32 rounded-full object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full px-3 py-2 border rounded"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setPhotoPreview(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
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
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Profilo professionale</h3>
                {!isGoogleProvider && (
                  <button type="button" onClick={() => setStep(1)} className="text-sm text-blue-600">&larr; Indietro</button>
                )}
              </div>

              {/* Per utenti Google: mostra nome e possibilità di modificarlo */}
              {isGoogleProvider && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 mb-3">
                    ✅ Accesso con Google effettuato. Completa il tuo profilo professionale.
                  </p>
                  <div className="space-y-3">
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
                      <label className="block text-sm font-medium mb-1">Data di nascita *</label>
                      <input
                        type="date"
                        required
                        className="w-full px-3 py-2 border rounded"
                        value={formData.dataNascita}
                        onChange={(e) => setFormData({ ...formData, dataNascita: e.target.value })}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* NUOVO: Sezione Professioni con documenti - FUORI DAL FORM */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Le tue professioni *
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Aggiungi le tue professioni e fornisci i documenti necessari per la verifica
                </p>

                {/* Lista professioni aggiunte */}
                {formData.professioniConDocumenti.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {formData.professioniConDocumenti.map((prof, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-green-900">{prof.professione}</div>
                          <div className="text-xs text-green-700">
                            {prof.documenti.length} documento/i caricato/i
                            {prof.note && ' • Con note aggiuntive'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeProfessione(index)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium ml-3"
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form per aggiungere nuova professione */}
                {!showDocumentiForm ? (
                  <div className="border rounded p-4 space-y-3 bg-gray-50">
                    <div>
                      <label className="block text-xs font-medium mb-1">Seleziona professione</label>
                      <select
                        className="w-full px-3 py-2 border rounded"
                        value={selectedProfessione}
                        onChange={(e) => setSelectedProfessione(e.target.value)}
                      >
                        <option value="">-- Seleziona una professione --</option>
                        {PROFESSIONI_DISPONIBILI.filter(
                          p => !formData.professioniConDocumenti.some(pc => pc.professione === p)
                        ).map(prof => (
                          <option key={prof} value={prof}>{prof}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddProfessione}
                      disabled={!selectedProfessione}
                      className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      + Aggiungi Professione
                    </button>
                  </div>
                ) : (
                  <DocumentiProfessioneForm
                    professione={selectedProfessione}
                    onComplete={handleProfessioneComplete}
                    onCancel={handleProfessioneCancel}
                  />
                )}
              </div>

              {/* Resto del form */}
              <form onSubmit={handleSubmit} className="space-y-6">

              {/* Esperienza professionale attuale (obbligatoria) */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Esperienza professionale attuale *
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Indica la tua posizione lavorativa attuale
                </p>
                <div className="border rounded p-4 bg-gray-50">
                  <EsperienzaAttualeRegistrazione
                    esperienza={formData.esperienzaAttuale}
                    onChange={(e) => setFormData({ ...formData, esperienzaAttuale: e })}
                  />
                </div>
              </div>

              {/* Formazione */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Formazione <span className="text-gray-400 font-normal">(facoltativo)</span>
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Lauree, master, specializzazioni e altri titoli di studio
                </p>

                {formData.formazione.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {formData.formazione.map((f, index) => (
                      <div key={f.id} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded">
                        <div className="text-sm flex-1">
                          <div className="font-medium text-purple-900">{f.titolo}</div>
                          <div className="text-purple-700">{f.istituzione} {f.annoConseguimento && `(${f.annoConseguimento})`}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, formazione: formData.formazione.filter((_, i) => i !== index) })}
                          className="text-red-600 hover:text-red-800 text-sm font-medium ml-3"
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border rounded p-4 space-y-3 bg-gray-50">
                  <input
                    type="text"
                    id="formazione-titolo"
                    placeholder="Titolo di studio (es. Laurea Magistrale in Psicologia)"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                  <input
                    type="text"
                    id="formazione-istituzione"
                    placeholder="Istituzione (es. Università degli Studi di Trento)"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                  <input
                    type="text"
                    id="formazione-anno"
                    placeholder="Anno conseguimento (es. 2020)"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const titolo = (document.getElementById('formazione-titolo') as HTMLInputElement).value.trim();
                      const istituzione = (document.getElementById('formazione-istituzione') as HTMLInputElement).value.trim();
                      const anno = (document.getElementById('formazione-anno') as HTMLInputElement).value.trim();
                      if (!titolo || !istituzione) return;
                      setFormData({
                        ...formData,
                        formazione: [...formData.formazione, { id: Date.now().toString(), titolo, istituzione, annoConseguimento: anno }]
                      });
                      (document.getElementById('formazione-titolo') as HTMLInputElement).value = '';
                      (document.getElementById('formazione-istituzione') as HTMLInputElement).value = '';
                      (document.getElementById('formazione-anno') as HTMLInputElement).value = '';
                    }}
                    className="w-full py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                  >
                    + Aggiungi Titolo di Studio
                  </button>
                </div>
              </div>

              {/* Certificazioni e Attestati */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Certificazioni e Attestati <span className="text-gray-400 font-normal">(facoltativo)</span>
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Corsi, certificazioni professionali e attestati
                </p>

                {formData.certificazioni.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {formData.certificazioni.map((c, index) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded">
                        <div className="text-sm flex-1">
                          <div className="font-medium text-amber-900">{c.titolo}</div>
                          <div className="text-amber-700">{c.istituzione} {c.anno && `(${c.anno})`}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, certificazioni: formData.certificazioni.filter((_, i) => i !== index) })}
                          className="text-red-600 hover:text-red-800 text-sm font-medium ml-3"
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border rounded p-4 space-y-3 bg-gray-50">
                  <input
                    type="text"
                    id="cert-titolo"
                    placeholder="Nome certificazione (es. Corso di Biofeedback)"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                  <input
                    type="text"
                    id="cert-istituzione"
                    placeholder="Ente rilasciante (es. Centro di Psicologia Clinica)"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                  <input
                    type="text"
                    id="cert-anno"
                    placeholder="Anno (es. 2022)"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const titolo = (document.getElementById('cert-titolo') as HTMLInputElement).value.trim();
                      const istituzione = (document.getElementById('cert-istituzione') as HTMLInputElement).value.trim();
                      const anno = (document.getElementById('cert-anno') as HTMLInputElement).value.trim();
                      if (!titolo || !istituzione) return;
                      setFormData({
                        ...formData,
                        certificazioni: [...formData.certificazioni, { id: Date.now().toString(), titolo, istituzione, anno }]
                      });
                      (document.getElementById('cert-titolo') as HTMLInputElement).value = '';
                      (document.getElementById('cert-istituzione') as HTMLInputElement).value = '';
                      (document.getElementById('cert-anno') as HTMLInputElement).value = '';
                    }}
                    className="w-full py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                  >
                    + Aggiungi Certificazione / Attestato
                  </button>
                </div>
              </div>

              {/* Studi */}
              <div>
                <label className="block text-sm font-medium mb-2">Studi professionali *</label>
                
                {/* Lista studi aggiunti */}
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

                {/* Form per aggiungere nuovo studio */}
                <div className="border rounded p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Indirizzo Studio *</label>
                    <AddressAutocomplete
                      value={currentStudio.indirizzo}
                      coordinate={currentStudio.coordinate}
                      onChange={(location) => {
                        setCurrentStudio({
                          ...currentStudio,
                          indirizzo: location.indirizzo || '',
                          coordinate: location.coordinate,
                          città: '', // Vuoto, non più usato
                          provincia: '' // Vuoto, non più usato
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

              <div>
                <label className="block text-sm font-medium mb-1">Disponibilità</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="es. Lunedì-Venerdì 9-19"
                  value={formData.disponibilità}
                  onChange={(e) => setFormData({ ...formData, disponibilità: e.target.value })}
                />
              </div>

              {/* Sezione Consensi Privacy GDPR */}
              <div className="space-y-4 p-6 bg-gray-50 rounded-lg border">
                <h3 className="font-semibold text-gray-900 text-lg">Consensi Privacy (Obbligatori)</h3>
                <p className="text-sm text-gray-600">
                  Per utilizzare Equipé è necessario accettare i seguenti consensi in conformità al GDPR:
                </p>

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
                    di Equipé <span className="text-red-500">*</span>
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
                    e autorizzo il trattamento dei miei dati professionali per le finalità del servizio <span className="text-red-500">*</span>
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
                    Vorrei ricevere comunicazioni informative sui nuovi servizi di Equipé{' '}
                    <Link to="/legal/privacy#marketing" className="text-blue-600 underline hover:text-blue-800" target="_blank">
                      (facoltativo)
                    </Link>
                  </span>
                </label>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                  <p className="text-xs text-blue-800">
                    <strong>Privacy e Sicurezza:</strong> I tuoi dati sono trattati secondo il GDPR,
                    conservati su server UE e crittografati. Non condividiamo mai informazioni con terzi
                    non autorizzati.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (!consents.termini || !consents.privacy)}
                className="w-full py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Registrazione in corso...' : 'Completa Registrazione'}
              </button>

              {(!consents.termini || !consents.privacy) && (
                <p className="text-sm text-red-600 text-center">
                  Accetta i consensi obbligatori per completare la registrazione
                </p>
              )}
            </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
