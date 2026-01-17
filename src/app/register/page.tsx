'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '@/lib/firebase';
import { Studio } from '@/types/equippe';
import { CITTA_ITALIANE, PROVINCE_ITALIANE } from '@/lib/comuni';
import AddressAutocomplete from '@/components/AddressAutocomplete';

const SPECIALIZZAZIONI = [
  'Psicologo',
  'Psicoterapeuta',
  'Psichiatra',
  'Nutrizionista',
  'Dietista',
  'Dietologo',
  'Assistente Sociale',
  'Educatore Professionale',
  'Logopedista',
  'Fisioterapista',
  'Terapista Occupazionale',
  'Infermiere',
  'Medico di Base',
  'Medico Specialista',
  'Ginecologo',
  'Andrologo',
  'Sessuologo'
];

const TEMATICHE = [
  'Disturbi d\'ansia',
  'Depressione',
  'Disturbi alimentari',
  'Trauma e PTSD',
  'Dipendenze',
  'Disturbi di personalità',
  'Autismo',
  'ADHD',
  'Disturbi dell\'umore',
  'Terapia di coppia',
  'Terapia familiare',
  'Neuropsicologia',
  'Psicologia dello sport',
  'Psicologia giuridica'
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nome: '',
    dataNascita: '',
    albo: '',
    specializzazioni: [] as string[],
    tematiche: [] as string[],
    esperienza: '',
    città: '', // Mantieni per backward compatibility
    disponibilità: '',
    studi: [] as Studio[],
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

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

    // Validazione consensi obbligatori GDPR
    if (!consents.termini || !consents.privacy) {
      setError('Devi accettare i Termini di Servizio e l\'Informativa Privacy per procedere');
      return;
    }

    if (formData.specializzazioni.length === 0) {
      setError('Seleziona almeno una specializzazione');
      return;
    }

    if (formData.tematiche.length === 0) {
      setError('Seleziona almeno una tematica');
      return;
    }

    if (formData.studi.length === 0) {
      setError('Aggiungi almeno uno studio o seleziona "Lavoro da remoto"');
      return;
    }

    setLoading(true);

    try {
      await signUp(formData.email, formData.password, formData.nome);
      
      // L'utente è ora autenticato, ottieni il currentUser
      const currentUser = auth.currentUser;
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
      
      // Salva profilo completo in Firestore
      const profileData: any = {
        uid: currentUser.uid,
        email: formData.email,
        profile: {
          nome: formData.nome,
          dataNascita: formData.dataNascita,
          albo: formData.albo,
          specializzazioni: formData.specializzazioni,
          tematiche: formData.tematiche,
          esperienza: formData.esperienza,
          location: { lat: 0, lng: 0, città: formData.città }, // Legacy
          studi: formData.studi, // Nuovo campo multi-studio
          disponibilità: formData.disponibilità,
          verified: false,
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
      };
      
      // Aggiungi photoURL solo se presente
      if (photoURL) {
        profileData.profile.photoURL = photoURL;
      }
      
      await setDoc(doc(db, 'users', currentUser.uid), profileData);
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Errore registrazione:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Questa email è già registrata. Usa il login o un\'altra email.');
      } else if (err.code === 'auth/weak-password') {
        setError('La password deve essere di almeno 6 caratteri.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Email non valida.');
      } else {
        setError(err.message || 'Errore durante la registrazione');
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
          <h2 className="mt-4 text-2xl font-bold">Registrati come professionista</h2>
          <p className="mt-2 text-sm text-gray-600">
            Hai già un account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-500">Accedi</Link>
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <div className={`h-2 w-20 rounded ${step >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`h-2 w-20 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          {error && <div className="bg-red-50 p-4 rounded mb-6 text-red-800">{error}</div>}

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Dati di accesso</h3>
              
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
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Profilo professionale</h3>
                <button type="button" onClick={() => setStep(1)} className="text-sm text-blue-600">← Indietro</button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Numero albo *</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border rounded"
                  placeholder="es. AA_12345"
                  value={formData.albo}
                  onChange={(e) => setFormData({ ...formData, albo: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Specializzazioni *</label>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALIZZAZIONI.map((s) => (
                    <label key={s} className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.specializzazioni.includes(s)}
                        onChange={() => setFormData({ ...formData, specializzazioni: toggleArray(formData.specializzazioni, s) })}
                        className="mr-2"
                      />
                      <span className="text-sm">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tematiche *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMATICHE.map((t) => (
                    <label key={t} className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.tematiche.includes(t)}
                        onChange={() => setFormData({ ...formData, tematiche: toggleArray(formData.tematiche, t) })}
                        className="mr-2"
                      />
                      <span className="text-sm">{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Anni di esperienza *</label>
                <select
                  required
                  className="w-full px-3 py-2 border rounded"
                  value={formData.esperienza}
                  onChange={(e) => setFormData({ ...formData, esperienza: e.target.value })}
                >
                  <option value="">Seleziona...</option>
                  <option value="0-2 anni">0-2 anni</option>
                  <option value="3-5 anni">3-5 anni</option>
                  <option value="6-10 anni">6-10 anni</option>
                  <option value="10+ anni">10+ anni</option>
                </select>
              </div>

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
                    <Link href="/legal/termini" className="text-blue-600 underline hover:text-blue-800" target="_blank">
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
                    <Link href="/legal/privacy" className="text-blue-600 underline hover:text-blue-800" target="_blank">
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
                    <Link href="/legal/privacy#marketing" className="text-blue-600 underline hover:text-blue-800" target="_blank">
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
          )}
        </div>
      </div>
    </div>
  );
}
