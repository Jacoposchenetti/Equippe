import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import DocumentiProfessioneForm from '@/components/DocumentiProfessioneForm';
import { ProfessioneConDocumenti } from '@/types/equippe';
import { PROFESSIONI_DISPONIBILI } from '@/lib/professioni';

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    professioniConDocumenti: [] as ProfessioneConDocumenti[],
    indirizzo: '',
    coordinate: null as { lat: number; lng: number } | null,
    disponibilità: '',
  });
  
  // Stati per la gestione delle professioni
  const [selectedProfessione, setSelectedProfessione] = useState('');
  const [showDocumentiForm, setShowDocumentiForm] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const toggleArray = (array: string[], item: string) => {
    return array.includes(item) ? array.filter(i => i !== item) : [...array, item];
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
    console.log('✅ Professione completata in app/onboarding:', data);
    setFormData({
      ...formData,
      professioniConDocumenti: [...formData.professioniConDocumenti, data]
    });
    setShowDocumentiForm(false);
    setSelectedProfessione('');
    setError('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.professioniConDocumenti.length === 0) {
      setError('Aggiungi almeno una professione con i relativi documenti');
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
      
      // Costruisci lista specializzazioni per retrocompatibilità
      const specializzazioni = formData.professioniConDocumenti.map(p => p.professione);
      
      // Aggrega tematiche ed esperienza da tutte le professioni per retrocompatibilità
      const tematicheAggregate = Array.from(new Set(
        formData.professioniConDocumenti.flatMap(p => p.tematiche || [])
      ));
      const esperienzaAggregata = formData.professioniConDocumenti.find(p => p.anniEsperienza)?.anniEsperienza || '';
      
      await setDoc(doc(db, 'users', user!.uid), {
        uid: user!.uid,
        email: user!.email,
        profile: {
          nome: user!.displayName || '',
          albo: '', // Campo deprecato
          specializzazioni: specializzazioni, // Per retrocompatibilità
          professioniConDocumenti: formData.professioniConDocumenti, // NUOVO
          tematiche: tematicheAggregate, // Aggregate da professioni per retrocompatibilità
          esperienza: esperienzaAggregata, // Presa da professioni per retrocompatibilità
          location: { 
            lat: formData.coordinate?.lat || 0, 
            lng: formData.coordinate?.lng || 0, 
            città: città, 
            provincia: provincia,
            indirizzo: formData.indirizzo 
          },
          disponibilità: formData.disponibilità,
          verified: false,
          verificationInfo: {
            status: 'pending',
            submittedAt: Timestamp.now()
          }
        },
        teams: [],
        stats: { referralsSent: 0, referralsReceived: 0 },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      navigate('/dashboard');
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

        <form onSubmit={handleSubmit} className="space-y-6">

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
