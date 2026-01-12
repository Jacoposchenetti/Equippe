'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, RoleCercato } from '@/types/equippe';
import Link from 'next/link';
import Header from '@/components/Header';
import MapSelector from '@/components/MapSelector';

const SPECIALIZZAZIONI = [
  'Psicologia', 'Psicoterapia', 'Psichiatria', 'Nutrizione', 'Dietologia', 'Fisioterapia',
  'Logopedia', 'Terapia occupazionale', 'Assistenza sociale', 'Educazione professionale'
];

export default function CreateTeamPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    remoto: false,
    indirizzo: '',
    raggioKm: 10,
    coordinate: null as { lat: number; lng: number } | null,
    selectedMembers: [] as string[],
    ruoliCercati: [] as RoleCercato[],
  });
  
  const [nuovoRuolo, setNuovoRuolo] = useState({
    specializzazione: '',
    numero: 1,
    descrizione: ''
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadUsers();
  }, [user]);

  const loadUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));
      setAllUsers(users.filter(u => u.uid !== user?.uid));
    } catch (error) {
      console.error('Errore caricamento utenti:', error);
    }
  };

  const handleMemberToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedMembers: prev.selectedMembers.includes(userId)
        ? prev.selectedMembers.filter(id => id !== userId)
        : [...prev.selectedMembers, userId]
    }));
  };

  const aggiungiRuolo = () => {
    if (!nuovoRuolo.specializzazione || nuovoRuolo.numero < 1) {
      setError('Compila specializzazione e numero');
      return;
    }

    const ruolo: RoleCercato = {
      specializzazione: nuovoRuolo.specializzazione,
      numero: nuovoRuolo.numero,
      descrizione: nuovoRuolo.descrizione || undefined,
      occupati: 0
    };

    setFormData(prev => ({
      ...prev,
      ruoliCercati: [...prev.ruoliCercati, ruolo]
    }));

    setNuovoRuolo({
      specializzazione: '',
      numero: 1,
      descrizione: ''
    });
    setError('');
  };

  const rimuoviRuolo = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ruoliCercati: prev.ruoliCercati.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Inserisci il nome dell\'Equipé');
      return;
    }

    if (!formData.coordinate || !formData.indirizzo) {
      setError('Seleziona la zona operativa sulla mappa');
      return;
    }

    if (formData.ruoliCercati.length === 0) {
      setError('Specifica almeno una figura professionale che stai cercando');
      return;
    }

    setLoading(true);

    try {
      if (!user || !userProfile) return;

      // Crea l'array dei membri con il creatore - usa uid e ruolo per compatibilità con TeamMember
      const creatorMember = {
        uid: user.uid,
        userId: user.uid,
        ruolo: 'admin' as const,
        role: 'admin' as const,
        joinedAt: Timestamp.now(),
      };

      const invitedMembers = formData.selectedMembers.map(userId => ({
        uid: userId,
        userId: userId,
        ruolo: 'member' as const,
        role: 'member' as const,
        joinedAt: Timestamp.now(),
      }));

      const allMembers = [creatorMember, ...invitedMembers];

      // Calcola totale membri richiesti
      const totaleRichiesti = formData.ruoliCercati.reduce((sum, r) => sum + r.numero, 0);
      const totaleOccupati = allMembers.length;

      // Estrai specializzazioni dai ruoli cercati
      const specializations = [...new Set(formData.ruoliCercati.map(r => r.specializzazione))];

      // Pulisci ruoli cercati da campi undefined
      const ruoliCercatiPuliti = formData.ruoliCercati.map(ruolo => {
        const ruoloPulito: any = {
          specializzazione: ruolo.specializzazione,
          numero: ruolo.numero,
          occupati: 0
        };
        if (ruolo.descrizione) {
          ruoloPulito.descrizione = ruolo.descrizione;
        }
        return ruoloPulito;
      });

      // Crea il team su Firestore - includi solo campi definiti
      const teamData: any = {
        name: formData.name,
        nome: formData.name,
        description: formData.description || '',
        specializations: specializations,
        members: allMembers,
        memberIds: [user.uid, ...formData.selectedMembers],
        createdBy: user.uid,
        adminUid: user.uid,
        remoto: formData.remoto,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        status: 'active',
        ruoliCercati: ruoliCercatiPuliti,
        completato: totaleOccupati >= totaleRichiesti + 1,
        settings: {
          slaRisposta: '48h',
          regole: '',
          tematiche: []
        }
      };

      // Aggiungi campi opzionali solo se definiti
      if (formData.indirizzo) {
        teamData.indirizzo = formData.indirizzo;
      }
      if (formData.coordinate) {
        teamData.coordinate = formData.coordinate;
      }
      if (formData.raggioKm) {
        teamData.raggioKm = formData.raggioKm;
      }

      console.log('📤 Salvando team con dati:', teamData);
      await addDoc(collection(db, 'teams'), teamData);

      router.push('/teams');
    } catch (err: any) {
      console.error('Errore creazione team:', err);
      setError(err.message || 'Errore durante la creazione dell\'Equipé');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/teams" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna alle Equipé
        </Link>

        <h2 className="text-4xl font-bold text-gray-900 mb-8">Crea Nuova Equipé</h2>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg mb-6 flex items-start gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Nome Equipé */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Nome Equipé *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="es. Equipé Salute Mentale Roma"
            />
          </div>

          {/* Descrizione */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Descrizione</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded px-3 py-2"
              rows={4}
              placeholder="Descrivi gli obiettivi e le modalità di collaborazione dell'Equipé..."
            />
          </div>

          {/* Località e Zona */}
          <div className="mb-6 border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Zona Operativa *
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Cerca il tuo studio o la zona dove opera l'Equipé e definisci il raggio di copertura
            </p>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <MapSelector
                coordinate={formData.coordinate}
                raggioKm={formData.raggioKm}
                indirizzo={formData.indirizzo}
                onCoordinateChange={(coord) => {
                  console.log('📝 onCoordinateChange chiamato con:', coord);
                  setFormData(prev => {
                    console.log('📝 Aggiornando formData da:', prev.coordinate, 'a:', coord);
                    return { ...prev, coordinate: coord };
                  });
                }}
                onIndirizzoChange={(addr) => {
                  console.log('📝 onIndirizzoChange chiamato con:', addr);
                  setFormData(prev => ({ ...prev, indirizzo: addr }));
                }}
                onRaggioChange={(raggio) => {
                  console.log('📝 onRaggioChange chiamato con:', raggio);
                  setFormData(prev => ({ ...prev, raggioKm: raggio }));
                }}
              />
            </div>

            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={formData.remoto}
                onChange={(e) => setFormData({ ...formData, remoto: e.target.checked })}
                className="mr-2"
              />
              <span>L'Equipé opera anche da remoto</span>
            </label>
          </div>

          {/* Ruoli Cercati */}
          <div className="mb-6 border-t pt-6">
            <label className="block text-sm font-semibold mb-2">Figure Cercate per l'Equipé</label>
            <p className="text-sm text-gray-600 mb-4">
              Specifica quali figure professionali stai cercando e quante
            </p>

            {/* Form per aggiungere ruolo */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Specializzazione *</label>
                  <select
                    value={nuovoRuolo.specializzazione}
                    onChange={(e) => setNuovoRuolo({...nuovoRuolo, specializzazione: e.target.value})}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Seleziona...</option>
                    {SPECIALIZZAZIONI.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Numero richiesto *</label>
                  <input
                    type="number"
                    min="1"
                    value={nuovoRuolo.numero}
                    onChange={(e) => setNuovoRuolo({...nuovoRuolo, numero: parseInt(e.target.value) || 1})}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Descrizione (opzionale)</label>
                  <input
                    type="text"
                    value={nuovoRuolo.descrizione}
                    onChange={(e) => setNuovoRuolo({...nuovoRuolo, descrizione: e.target.value})}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="es. Esperto in trauma"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={aggiungiRuolo}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition text-sm font-medium"
              >
                + Aggiungi Ruolo
              </button>
            </div>

            {/* Lista ruoli aggiunti */}
            {formData.ruoliCercati.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Ruoli da cercare:</h4>
                {formData.ruoliCercati.map((ruolo, index) => (
                  <div key={index} className="bg-white border rounded-lg p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{ruolo.specializzazione}</span>
                      <span className="text-gray-600 ml-2">× {ruolo.numero}</span>
                      {ruolo.descrizione && (
                        <p className="text-sm text-gray-500 mt-1">{ruolo.descrizione}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => rimuoviRuolo(index)}
                      className="text-red-500 hover:text-red-700 ml-4"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="bg-blue-50 p-3 rounded-lg mt-3">
                  <p className="text-sm text-blue-800">
                    <strong>Totale membri richiesti:</strong> {formData.ruoliCercati.reduce((sum, r) => sum + r.numero, 0) + 1} 
                    {" "}(compreso l'admin)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Invita Membri */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Invita Membri (opzionale)</label>
            <p className="text-sm text-gray-600 mb-3">
              Seleziona i professionisti che vuoi invitare nella tua Equipé
            </p>
            <div className="max-h-80 overflow-y-auto border rounded p-4">
              {allUsers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nessun professionista disponibile</p>
              ) : (
                <div className="space-y-3">
                  {allUsers.map((user) => (
                    <label key={user.uid} className="flex items-start p-3 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.selectedMembers.includes(user.uid)}
                        onChange={() => handleMemberToggle(user.uid)}
                        className="mr-3 mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold">{user.profile.nome}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {user.profile.specializzazioni.join(', ')}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pulsanti */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
            >
              {loading ? 'Creazione in corso...' : 'Crea Equipé'}
            </button>
            <Link
              href="/teams"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
            >
              Annulla
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
