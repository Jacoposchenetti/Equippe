'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Team, RoleCercato } from '@/types/equippe';
import Link from 'next/link';
import Header from '@/components/Header';
import MapSelector from '@/components/MapSelector';

const SPECIALIZZAZIONI = [
  'Avvocato',
  'Commercialista',
  'Consulente del Lavoro',
  'Notaio',
  'Architetto',
  'Ingegnere',
  'Geometra',
  'Medico',
  'Psicologo',
  'Psichiatra',
  'Psicoterapeuta',
  'Nutrizionista',
  'Fisioterapista',
  'Logopedista',
  'Consulente Finanziario',
  'Altro',
];

export default function EditTeamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;
  
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    specializations: [] as string[],
    coordinate: null as { lat: number; lng: number } | null,
    indirizzo: '',
    raggioKm: 10,
    remoto: false,
    ruoliCercati: [] as RoleCercato[],
  });
  const [nuovoRuolo, setNuovoRuolo] = useState({
    specializzazione: '',
    numero: 1,
    descrizione: '',
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadTeam();
  }, [user, teamId]);

  const loadTeam = async () => {
    try {
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (!teamDoc.exists()) {
        router.push('/teams');
        return;
      }

      const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
      
      // Verifica che l'utente sia admin
      if (teamData.createdBy !== user?.uid) {
        alert('Solo l\'amministratore può modificare le impostazioni');
        router.push(`/teams/${teamId}`);
        return;
      }

      setTeam(teamData);
      setFormData({
        name: teamData.name || '',
        description: teamData.description || '',
        specializations: teamData.specializations || [],
        coordinate: teamData.coordinate || null,
        indirizzo: teamData.indirizzo || '',
        raggioKm: teamData.raggioKm || 10,
        remoto: teamData.remoto || false,
        ruoliCercati: teamData.ruoliCercati || [],
      });
    } catch (error) {
      console.error('Errore caricamento team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpecChange = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec]
    }));
  };

  const aggiungiRuolo = () => {
    if (!nuovoRuolo.specializzazione || nuovoRuolo.numero < 1) {
      setError('Seleziona una specializzazione e inserisci un numero valido');
      return;
    }

    setFormData(prev => ({
      ...prev,
      ruoliCercati: [...prev.ruoliCercati, { ...nuovoRuolo, occupati: 0 }]
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

    if (formData.ruoliCercati.length === 0) {
      setError('Specifica almeno una figura professionale che stai cercando');
      return;
    }

    setSaving(true);

    try {
      // Pulisci ruoli cercati da campi undefined
      const ruoliCercatiPuliti = formData.ruoliCercati.map(ruolo => {
        const ruoloPulito: any = {
          specializzazione: ruolo.specializzazione,
          numero: ruolo.numero,
          occupati: ruolo.occupati || 0
        };
        if (ruolo.descrizione) {
          ruoloPulito.descrizione = ruolo.descrizione;
        }
        return ruoloPulito;
      });

      const updateData: any = {
        name: formData.name,
        nome: formData.name,
        description: formData.description,
        specializations: [...new Set(formData.ruoliCercati.map(r => r.specializzazione))],
        remoto: formData.remoto,
        ruoliCercati: ruoliCercatiPuliti,
        updatedAt: Timestamp.now(),
      };

      // Aggiungi campi opzionali solo se definiti
      if (formData.indirizzo) {
        updateData.indirizzo = formData.indirizzo;
      }
      if (formData.coordinate) {
        updateData.coordinate = formData.coordinate;
      }
      if (formData.raggioKm) {
        updateData.raggioKm = formData.raggioKm;
      }

      await updateDoc(doc(db, 'teams', teamId), updateData);

      router.push(`/teams/${teamId}`);
    } catch (err: any) {
      console.error('Errore aggiornamento team:', err);
      setError(err.message || 'Errore durante l\'aggiornamento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href={`/teams/${teamId}`} className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna all'Equipé
        </Link>

        <h2 className="text-4xl font-bold text-gray-900 mb-8">Modifica Impostazioni Equipé</h2>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg mb-6 flex items-start gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nome Equipé *</label>
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

          {/* Zona Operativa */}
          <div className="mb-6 border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Zona Operativa
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Cerca il tuo studio o la zona dove opera l'Equipé e definisci il raggio di copertura
            </p>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <MapSelector
                coordinate={formData.coordinate}
                raggioKm={formData.raggioKm}
                indirizzo={formData.indirizzo}
                onCoordinateChange={(coord) => setFormData(prev => ({ ...prev, coordinate: coord }))}
                onIndirizzoChange={(addr) => setFormData(prev => ({ ...prev, indirizzo: addr }))}
                onRaggioChange={(raggio) => setFormData(prev => ({ ...prev, raggioKm: raggio }))}
              />
            </div>

            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={formData.remoto}
                onChange={(e) => setFormData({ ...formData, remoto: e.target.checked })}
                className="mr-2 h-4 w-4 text-blue-600"
              />
              <span className="font-medium">L'Equipé opera anche da remoto</span>
            </label>
          </div>

          {/* Ruoli Cercati */}
          <div className="mb-6 border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Ruoli Cercati *</h3>
            <p className="text-sm text-gray-600 mb-4">
              Specifica le figure professionali che stai cercando per l'Equipé
            </p>

            {/* Lista ruoli esistenti */}
            {formData.ruoliCercati.length > 0 && (
              <div className="mb-4 space-y-2">
                {formData.ruoliCercati.map((ruolo, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <span className="font-semibold">{ruolo.specializzazione}</span>
                      {' - '}
                      <span className="text-gray-600">{ruolo.numero} {ruolo.numero === 1 ? 'posto' : 'posti'}</span>
                      {ruolo.descrizione && (
                        <p className="text-sm text-gray-600 mt-1">{ruolo.descrizione}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => rimuoviRuolo(index)}
                      className="text-red-600 hover:text-red-800 font-medium text-sm"
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Form aggiungi ruolo */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Specializzazione *</label>
                  <select
                    value={nuovoRuolo.specializzazione}
                    onChange={(e) => setNuovoRuolo({ ...nuovoRuolo, specializzazione: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Seleziona...</option>
                    {SPECIALIZZAZIONI.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Numero posti *</label>
                  <input
                    type="number"
                    min="1"
                    value={nuovoRuolo.numero}
                    onChange={(e) => setNuovoRuolo({ ...nuovoRuolo, numero: parseInt(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Descrizione (opzionale)</label>
                <textarea
                  value={nuovoRuolo.descrizione}
                  onChange={(e) => setNuovoRuolo({ ...nuovoRuolo, descrizione: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={2}
                  placeholder="Es: Cerchiamo un medico con esperienza in..."
                />
              </div>
              <button
                type="button"
                onClick={aggiungiRuolo}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium"
              >
                + Aggiungi Ruolo
              </button>
            </div>
          </div>

          {/* Pulsanti */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
            >
              {saving ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
            <Link
              href={`/teams/${teamId}`}
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
