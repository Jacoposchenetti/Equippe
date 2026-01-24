import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { useCanInteract } from '@/hooks/useCanInteract';
import { collection, addDoc, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateEncryptionKey, exportKey, encryptData } from '@/lib/encryption';
import { User, Team } from '@/types/equippe';

const PROFESSIONI = [
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
  'Neuropsicomotricista',
  'Infermiere',
  'Medico di Base',
  'Medico Specialista',
  'Neurologo',
  'Neuropsichiatra Infantile'
];

export default function ReferralCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canInteract, message } = useCanInteract();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [professionisti, setProfessionisti] = useState<User[]>([]);
  const [allProfessionisti, setAllProfessionisti] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  const [filters, setFilters] = useState({
    professionista: '',
    teamId: ''
  });
  
  const [formData, setFormData] = useState({
    receiverId: '',
    patientName: '',
    patientAge: '',
    patientContact: '',
    diagnosis: '',
    notes: '',
    urgency: 'normal' as 'low' | 'normal' | 'high',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadProfessionisti();
    loadTeams();
  }, [user]);

  useEffect(() => {
    filterProfessionisti();
  }, [filters, allProfessionisti, teams]);

  const loadProfessionisti = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));
      const filteredUsers = users.filter(u => u.uid !== user?.uid);
      setAllProfessionisti(filteredUsers);
      setProfessionisti(filteredUsers);
    } catch (error) {
      console.error('Errore caricamento professionisti:', error);
    }
  };

  const loadTeams = async () => {
    try {
      if (!user) return;
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('memberIds', 'array-contains', user.uid));
      const snapshot = await getDocs(q);
      const userTeams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Team));
      setTeams(userTeams);
    } catch (error) {
      console.error('Errore caricamento team:', error);
    }
  };

  const filterProfessionisti = () => {
    let filtered = [...allProfessionisti];

    if (filters.professionista) {
      filtered = filtered.filter(prof => 
        prof.profile?.specializzazioni?.some(spec => 
          spec.toLowerCase().includes(filters.professionista.toLowerCase())
        )
      );
    }

    if (filters.teamId) {
      const selectedTeam = teams.find(t => t.id === filters.teamId);
      if (selectedTeam?.memberIds) {
        filtered = filtered.filter(prof => 
          selectedTeam.memberIds!.includes(prof.uid)
        );
      }
    }

    setProfessionisti(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canInteract) {
      setError(message || 'Non puoi creare referral al momento');
      return;
    }
    
    setError('');

    if (!formData.receiverId) {
      setError('Seleziona un destinatario');
      return;
    }

    if (!formData.patientName.trim()) {
      setError('Inserisci il nome del paziente');
      return;
    }

    if (!formData.diagnosis.trim()) {
      setError('Inserisci la diagnosi o motivo del referral');
      return;
    }

    setLoading(true);

    try {
      if (!user) return;

      // Genera chiave di crittografia
      const encryptionKey = await generateEncryptionKey();
      const keyString = await exportKey(encryptionKey);

      // Cripta i dati sensibili del paziente
      const patientData = JSON.stringify({
        name: formData.patientName,
        age: formData.patientAge,
        contact: formData.patientContact,
      });

      const { encrypted: encryptedPatient, iv: patientIv } = await encryptData(patientData, encryptionKey);
      const { encrypted: encryptedDiagnosis, iv: diagnosisIv } = await encryptData(formData.diagnosis, encryptionKey);
      const { encrypted: encryptedNotes, iv: notesIv } = await encryptData(formData.notes, encryptionKey);

      // Crea il referral
      const referralData = {
        senderUid: user.uid,
        receiverUid: formData.receiverId,
        encryptedPatient,
        patientIv,
        encryptedDiagnosis,
        diagnosisIv,
        encryptedNotes,
        notesIv,
        encryptionKey: keyString,
        urgency: formData.urgency,
        status: 'pending' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'referrals'), referralData);
      navigate('/referrals');
    } catch (err: any) {
      console.error('Errore creazione referral:', err);
      setError(err.message || 'Errore durante la creazione del referral');
    } finally {
      setLoading(false);
    }
  };

  if (!canInteract) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Creazione referral non disponibile</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-blue-600">
              La tua documentazione verrà verificata entro 48 ore. Riceverai una notifica appena sarai abilitato.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Torna alla Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to="/referrals" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna ai Referral
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Crea Nuovo Referral
        </h1>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg mb-6 flex items-start gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8 space-y-6">
          {/* Filtri di Ricerca */}
          <div className="bg-blue-50 p-6 rounded-lg space-y-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtri di Ricerca
            </h3>
            
            {/* Filtro Professionista */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-blue-800">Tipo di Professionista</label>
              <select
                value={filters.professionista}
                onChange={(e) => setFilters({ ...filters, professionista: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
              >
                <option value="">Tutti i professionisti</option>
                {PROFESSIONI.map(prof => (
                  <option key={prof} value={prof.toLowerCase()}>{prof}</option>
                ))}
              </select>
            </div>

            {/* Filtro Équipe */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-blue-800">Équipe di Provenienza</label>
              <select
                value={filters.teamId}
                onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
              >
                <option value="">Tutte le équipe</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.nome || team.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span><strong>Risultati trovati:</strong> {professionisti.length} professionisti</span>
                {(filters.professionista || filters.teamId) && (
                  <button
                    type="button"
                    onClick={() => setFilters({ professionista: '', teamId: '' })}
                    className="text-xs bg-white text-blue-700 px-3 py-1 rounded-lg border border-blue-300 hover:bg-blue-50 font-medium"
                  >
                    Resetta filtri
                  </button>
                )}
              </div>
              {professionisti.length === 0 && (filters.professionista || filters.teamId) && (
                <div className="mt-2 text-orange-700 bg-orange-100 p-2 rounded-lg">
                  ⚠️ Nessun professionista trovato con i filtri selezionati. Prova a modificare i criteri di ricerca.
                </div>
              )}
            </div>
          </div>

          {/* Destinatario */}
          <div>
            <label className="block text-sm font-semibold mb-2">Invia a *</label>
            {professionisti.length === 0 && (filters.professionista || filters.teamId) && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <strong>💡 Suggerimento:</strong> Rimuovi alcuni filtri per vedere più professionisti disponibili.
              </div>
            )}
            <select
              value={formData.receiverId}
              onChange={(e) => setFormData({ ...formData, receiverId: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
              required
            >
              <option value="">Seleziona professionista...</option>
              {professionisti.length === 0 ? (
                <option value="" disabled>Nessun professionista trovato con i filtri selezionati</option>
              ) : (
                professionisti.map((prof) => (
                  <option key={prof.uid} value={prof.uid}>
                    {prof.profile?.nome || 'Nome non disponibile'} - {prof.profile?.specializzazioni?.join(', ') || 'N/D'} 
                    {prof.profile?.location?.città ? ` (${prof.profile.location.città})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Urgenza */}
          <div>
            <label className="block text-sm font-semibold mb-2">Urgenza</label>
            <div className="flex gap-4">
              {[
                { value: 'low', label: 'Bassa', color: 'bg-green-100 text-green-800 border-green-300' },
                { value: 'normal', label: 'Normale', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                { value: 'high', label: 'Alta', color: 'bg-red-100 text-red-800 border-red-300' },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData({ ...formData, urgency: value as any })}
                  className={`flex-1 py-2 rounded-lg border-2 font-semibold ${
                    formData.urgency === value ? color : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Dati Paziente */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Dati Paziente (Criptografati)
            </h3>
            
            <div className="space-y-4">
              {/* Nome Paziente */}
              <div>
                <label className="block text-sm font-semibold mb-2">Nome Paziente *</label>
                <input
                  type="text"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Nome completo del paziente"
                  required
                />
              </div>

              {/* Età */}
              <div>
                <label className="block text-sm font-semibold mb-2">Età</label>
                <input
                  type="text"
                  value={formData.patientAge}
                  onChange={(e) => setFormData({ ...formData, patientAge: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="es. 45 anni"
                />
              </div>

              {/* Contatto */}
              <div>
                <label className="block text-sm font-semibold mb-2">Contatto Paziente</label>
                <input
                  type="text"
                  value={formData.patientContact}
                  onChange={(e) => setFormData({ ...formData, patientContact: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Telefono o email"
                />
              </div>

              {/* Diagnosi */}
              <div>
                <label className="block text-sm font-semibold mb-2">Diagnosi / Motivo Referral *</label>
                <textarea
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  rows={3}
                  placeholder="Descrivi la diagnosi e il motivo della segnalazione"
                  required
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-semibold mb-2">Note Cliniche</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  rows={4}
                  placeholder="Informazioni aggiuntive rilevanti per il collega"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div>
                    <strong>🔒 Privacy e Sicurezza:</strong> Tutti i dati sensibili del paziente saranno crittografati 
                    end-to-end prima dell'invio, in conformità con il GDPR. Solo il professionista destinatario potrà 
                    decriptare e visualizzare queste informazioni.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pulsanti */}
          <div className="flex gap-4 pt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold text-base"
            >
              {loading ? 'Invio in corso...' : 'Invia Referral'}
            </button>
            <Link
              to="/referrals"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-center flex items-center"
            >
              Annulla
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
