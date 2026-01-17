'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import LocationAutocomplete from '@/components/LocationAutocomplete';

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

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    albo: '',
    specializzazioni: [] as string[],
    tematiche: [] as string[],
    esperienza: '',
    indirizzo: '',
    coordinate: null as { lat: number; lng: number } | null,
    disponibilità: '',
  });

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  const toggleArray = (array: string[], item: string) => {
    return array.includes(item) ? array.filter(i => i !== item) : [...array, item];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.specializzazioni.length === 0) {
      setError('Seleziona almeno una specializzazione');
      return;
    }
    if (formData.tematiche.length === 0) {
      setError('Seleziona almeno una tematica');
      return;
    }
    if (!formData.indirizzo.trim()) {
      setError('L\'indirizzo è obbligatorio');
      return;
    }

    setLoading(true);
    try {
      // Estrai città e provincia dall'indirizzo
      let città = '';
      let provincia = '';
      const parts = formData.indirizzo.split(',');
      if (parts.length >= 2) {
        città = parts[parts.length - 2].trim();
        const lastPart = parts[parts.length - 1].trim();
        const provinciaMatch = lastPart.match(/\b([A-Z]{2})\b/);
        if (provinciaMatch) {
          provincia = provinciaMatch[1];
        }
      }
      
      await setDoc(doc(db, 'users', user!.uid), {
        uid: user!.uid,
        email: user!.email,
        profile: {
          nome: user!.displayName || '',
          albo: formData.albo,
          specializzazioni: formData.specializzazioni,
          tematiche: formData.tematiche,
          esperienza: formData.esperienza,
          location: { 
            lat: formData.coordinate?.lat || 0, 
            lng: formData.coordinate?.lng || 0, 
            città: città, 
            provincia: provincia,
            indirizzo: formData.indirizzo 
          },
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-2">Completa il tuo profilo</h1>
        <p className="text-gray-600 mb-8">Fornisci le tue informazioni professionali</p>

        {error && <div className="bg-red-50 p-4 rounded mb-6 text-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
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
            <LocationAutocomplete
              value={formData.indirizzo}
              onChange={(address, coords) => {
                setFormData({ 
                  ...formData, 
                  indirizzo: address,
                  coordinate: coords || null
                });
                console.log('📍 Coordinate onboarding:', coords);
              }}
              placeholder="Via, Città, Zona..."
              label="Indirizzo o Zona di Lavoro *"
            />
            <p className="text-xs text-gray-500 mt-1">
              Inserisci l'indirizzo o la zona principale dove lavori
            </p>
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
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : 'Completa registrazione'}
          </button>
        </form>
      </div>
    </div>
  );
}
