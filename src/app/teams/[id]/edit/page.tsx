'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Team } from '@/types/equippe';
import Link from 'next/link';
import Header from '@/components/Header';

const SPECIALIZZAZIONI = [
  'Psicologia', 'Psicoterapia', 'Psichiatria', 'Nutrizione', 'Dietologia', 'Fisioterapia',
  'Logopedia', 'Terapia occupazionale', 'Assistenza sociale', 'Educazione professionale'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Inserisci il nome dell\'Equipé');
      return;
    }

    if (formData.specializations.length === 0) {
      setError('Seleziona almeno una specializzazione');
      return;
    }

    setSaving(true);

    try {
      await updateDoc(doc(db, 'teams', teamId), {
        name: formData.name,
        description: formData.description,
        specializations: formData.specializations,
        updatedAt: Timestamp.now(),
      });

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

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8">\n          <div className="mb-6">\n            <label className="block text-sm font-semibold text-gray-700 mb-2">Nome Equipé *</label>
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

          {/* Specializzazioni */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Specializzazioni Richieste *</label>
            <div className="grid grid-cols-2 gap-2">
              {SPECIALIZZAZIONI.map((spec) => (
                <label key={spec} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.specializations.includes(spec)}
                    onChange={() => handleSpecChange(spec)}
                    className="mr-2"
                  />
                  <span className="text-sm">{spec}</span>
                </label>
              ))}
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
