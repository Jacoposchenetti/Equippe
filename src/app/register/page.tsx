'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Studio } from '@/types/equippe';
import { CITTA_ITALIANE, PROVINCE_ITALIANE } from '@/lib/comuni';

const SPECIALIZZAZIONI = [
  'Psicologia', 'Psicoterapia', 'Psichiatria', 'Nutrizione', 'Dietologia', 'Fisioterapia',
  'Logopedia', 'Terapia occupazionale', 'Assistenza sociale', 'Educazione professionale'
];

const TEMATICHE = [
  'DCA (Disturbi del Comportamento Alimentare)', 'Ansia e stress', 'Depressione',
  'Dolore cronico', 'Riabilitazione motoria', 'Obesità', 'Diabete', 'Geriatria', 'Pediatria'
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nome: '',
    albo: '',
    specializzazioni: [] as string[],
    tematiche: [] as string[],
    esperienza: '',
    città: '', // Mantieni per backward compatibility
    disponibilità: '',
    studi: [] as Studio[],
  });
  const [currentStudio, setCurrentStudio] = useState<Studio>({
    indirizzo: '',
    città: '',
    provincia: '',
    remoto: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const addStudio = () => {
    if (!currentStudio.città || !currentStudio.provincia) {
      setError('Inserisci città e provincia');
      return;
    }
    setFormData({
      ...formData,
      studi: [...formData.studi, { ...currentStudio }],
      città: formData.città || currentStudio.città, // Aggiorna città principale
    });
    setCurrentStudio({ indirizzo: '', città: '', provincia: '', remoto: false });
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
      
      // Salva profilo completo in Firestore
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        email: formData.email,
        profile: {
          nome: formData.nome,
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
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
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
          <h1 className="text-4xl font-bold text-blue-600">Equippe</h1>
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
                          <div className="font-medium">{studio.città} ({studio.provincia})</div>
                          {studio.indirizzo && <div className="text-gray-600">{studio.indirizzo}</div>}
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Città *</label>
                      <select
                        value={currentStudio.città}
                        onChange={(e) => {
                          const selected = CITTA_ITALIANE.find(c => c.nome === e.target.value);
                          setCurrentStudio({
                            ...currentStudio,
                            città: e.target.value,
                            provincia: selected?.provincia || '',
                          });
                        }}
                        className="w-full px-2 py-1 text-sm border rounded"
                      >
                        <option value="">Seleziona città</option>
                        {CITTA_ITALIANE.map((città) => (
                          <option key={città.nome} value={città.nome}>
                            {città.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Provincia *</label>
                      <select
                        value={currentStudio.provincia}
                        onChange={(e) => setCurrentStudio({ ...currentStudio, provincia: e.target.value })}
                        className="w-full px-2 py-1 text-sm border rounded"
                      >
                        <option value="">Seleziona</option>
                        {PROVINCE_ITALIANE.map((prov) => (
                          <option key={prov} value={prov}>
                            {prov}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Indirizzo (opzionale)</label>
                    <input
                      type="text"
                      value={currentStudio.indirizzo}
                      onChange={(e) => setCurrentStudio({ ...currentStudio, indirizzo: e.target.value })}
                      className="w-full px-2 py-1 text-sm border rounded"
                      placeholder="es. Via Roma 123"
                    />
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Registrazione...' : 'Completa registrazione'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
