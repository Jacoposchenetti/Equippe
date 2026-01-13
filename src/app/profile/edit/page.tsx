'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Header from '@/components/Header';
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
  'Medico Specialista'
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

export default function EditProfilePage() {
  const { user, userProfile, refreshProfile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [specializzazioni, setSpecializzazioni] = useState<string[]>([]);
  const [tematiche, setTematiche] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [telefono, setTelefono] = useState('');
  const [indirizzo, setIndirizzo] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (userProfile) {
      setNome(userProfile.profile.nome || '');
      
      // Normalizza specializzazioni esistenti
      const normalizedSpecs = userProfile.profile.specializzazioni
        .map(spec => {
          const map: Record<string, string> = {
            'Psicologia': 'Psicologo',
            'Psicoterapia': 'Psicoterapeuta',
            'Psichiatria': 'Psichiatra',
            'Nutrizione': 'Nutrizionista',
          };
          return map[spec] || spec;
        })
        .filter((spec, index, self) => self.indexOf(spec) === index); // Rimuovi duplicati
      
      setSpecializzazioni(normalizedSpecs);
      
      // Normalizza tematiche esistenti e rimuovi quelle obsolete
      const normalizedTematiche = userProfile.profile.tematiche
        .filter(tema => tema !== 'Dolore cronico' && tema !== 'Riabilitazione' && tema !== 'Riabilitazione motoria' && tema !== 'Geriatria' && tema !== 'Pediatria')
        .map(tema => {
          const map: Record<string, string> = {
            'DCA (Disturbi del Comportamento Alimentare)': 'Disturbi alimentari',
            'Ansia e stress': 'Disturbi d\'ansia',
            'Obesità': 'Disturbi alimentari',
            'Diabete': 'Disturbi alimentari',
          };
          return map[tema] || tema;
        })
        .filter((t, index, self) => self.indexOf(t) === index); // Rimuovi duplicati
      
      setTematiche(normalizedTematiche);
      
      setBio(userProfile.profile.bio || '');
      setLinkedin(userProfile.profile.linkedin || '');
      setWebsite(userProfile.profile.website || '');
      setTelefono(userProfile.profile.telefono || '');
      setIndirizzo(userProfile.profile.location?.indirizzo || '');
    }
  }, [user, userProfile]);

  const handleSpecChange = (spec: string) => {
    if (specializzazioni.includes(spec)) {
      setSpecializzazioni(specializzazioni.filter(s => s !== spec));
    } else {
      setSpecializzazioni([...specializzazioni, spec]);
    }
  };

  const handleTemaChange = (tema: string) => {
    if (tematiche.includes(tema)) {
      setTematiche(tematiche.filter(t => t !== tema));
    } else {
      setTematiche([...tematiche, tema]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !userProfile) return;

    if (!nome.trim()) {
      alert('Il nome è obbligatorio');
      return;
    }

    if (!indirizzo.trim()) {
      alert('L\'indirizzo è obbligatorio');
      return;
    }

    if (specializzazioni.length === 0) {
      alert('Seleziona almeno una specializzazione');
      return;
    }

    setLoading(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Estrai città e provincia dall'indirizzo per salvarle in background
      let città = '';
      let provincia = '';
      const parts = indirizzo.split(',');
      if (parts.length >= 2) {
        città = parts[parts.length - 2].trim();
        const lastPart = parts[parts.length - 1].trim();
        const provinciaMatch = lastPart.match(/\b([A-Z]{2})\b/);
        if (provinciaMatch) {
          provincia = provinciaMatch[1];
        }
      }
      
      await updateDoc(userRef, {
        'profile.nome': nome.trim(),
        'profile.specializzazioni': specializzazioni,
        'profile.tematiche': tematiche,
        'profile.bio': bio.trim(),
        'profile.linkedin': linkedin.trim(),
        'profile.website': website.trim(),
        'profile.telefono': telefono.trim(),
        'profile.location.indirizzo': indirizzo.trim(),
        'profile.location.città': città,
        'profile.location.provincia': provincia,
        updatedAt: new Date()
      });

      await refreshProfile();
      alert('Profilo aggiornato con successo!');
      router.push('/dashboard');
    } catch (error) {
      console.error('Errore aggiornamento profilo:', error);
      alert('Errore durante l\'aggiornamento del profilo');
    } finally {
      setLoading(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Modifica Profilo</h1>
          <p className="text-gray-600 mt-2">Aggiorna le tue informazioni professionali</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Informazioni base */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Informazioni Base</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={userProfile.email}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">L'email non può essere modificata</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefono
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+39 123 456 7890"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Localizzazione */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Localizzazione</h2>
            
            <LocationAutocomplete
              value={indirizzo}
              onChange={(address) => {
                setIndirizzo(address);
              }}
              placeholder="Via, Città, Zona..."
              label="Indirizzo o Zona di Lavoro *"
            />
            <p className="text-xs text-gray-500 mt-2">
              Inserisci l'indirizzo o la zona principale dove lavori
            </p>
          </div>

          {/* Specializzazioni */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Specializzazioni *</h2>
            <p className="text-gray-600 mb-4">Seleziona le tue aree professionali</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SPECIALIZZAZIONI.map((spec) => (
                <label
                  key={spec}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition ${
                    specializzazioni.includes(spec)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={specializzazioni.includes(spec)}
                    onChange={() => handleSpecChange(spec)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-medium">{spec}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tematiche */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Tematiche di Interesse</h2>
            <p className="text-gray-600 mb-4">Seleziona le tematiche su cui lavori</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TEMATICHE.map((tema) => (
                <label
                  key={tema}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition ${
                    tematiche.includes(tema)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tematiche.includes(tema)}
                    onChange={() => handleTemaChange(tema)}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm font-medium">{tema}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Bio</h2>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={6}
              placeholder="Raccontaci di te, della tua esperienza e del tuo approccio professionale..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Link social */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Link Professionali</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LinkedIn
                </label>
                <input
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/tuoprofilo"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sito Web
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://tuosito.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Bottoni azione */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
            
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-8 py-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
