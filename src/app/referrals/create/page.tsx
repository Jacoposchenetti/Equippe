import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, Timestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Team } from '@/types/equippe';
import { generateEncryptionKey, exportKey, encryptData } from '@/lib/encryption';
import { Link } from 'react-router-dom';
import { notifyReferralReceived } from '@/lib/notifications';

export default function CreatePazientePage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
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

    // Filtra per tipo di professionista
    if (filters.professionista) {
      filtered = filtered.filter(prof => 
        prof.profile.specializzazioni.some(spec => 
          spec.toLowerCase().includes(filters.professionista.toLowerCase())
        )
      );
    }

    // Filtra per team di appartenenza
    if (filters.teamId) {
      const selectedTeam = teams.find(t => t.id === filters.teamId);
      if (selectedTeam && selectedTeam.memberIds) {
        filtered = filtered.filter(prof => 
          selectedTeam.memberIds!.includes(prof.uid)
        );
      }
    }

    setProfessionisti(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.receiverId) {
      setError('Seleziona un destinatario');
      return;
    }

    if (!formData.patientName.trim()) {
      setError('Inserisci il nome del paziente');
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

      // Crea il paziente
      const referralData = {
        senderUid: user.uid,
        receiverUid: formData.receiverId,
        encryptedPatient,
        patientIv,
        encryptedDiagnosis,
        diagnosisIv,
        encryptedNotes,
        notesIv,
        encryptionKey: keyString, // In produzione, questa chiave dovrebbe essere condivisa tramite un canale sicuro separato
        urgency: formData.urgency,
        status: 'pending' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const referralRef = await addDoc(collection(db, 'referrals'), referralData);

      // Notifica il destinatario del nuovo paziente
      const senderName = user.displayName || user.email || 'Un professionista';
      const senderPhoto = userProfile?.profile?.photoURL || user.photoURL;
      await notifyReferralReceived(
        formData.receiverId,
        user.uid,
        senderName,
        senderPhoto,
        formData.patientName,
        referralRef.id
      );

      navigate('/referrals');
    } catch (err: any) {
      console.error('Errore creazione paziente:', err);
      setError(err.message || 'Errore durante la creazione del paziente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-blue-600">Equipé</h1>
          <Link to="/referrals" className="text-sm sm:text-base text-blue-600 hover:underline">← Torna ai Pazienti</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">Crea Nuovo Paziente</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow space-y-6">
          {/* Filtri */}
          <div className="bg-blue-50 p-4 sm:p-6 rounded-lg space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-4">Filtri di Ricerca</h3>
            
            {/* Filtro Professionista */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-blue-800">Tipo di Professionista</label>
              <select
                value={filters.professionista}
                onChange={(e) => setFilters({ ...filters, professionista: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Tutti i professionisti</option>
                <option value="psicologo">Psicologo</option>
                <option value="psicoterapeuta">Psicoterapeuta</option>
                <option value="nutrizionista">Nutrizionista</option>
                <option value="dietologo">Dietologo</option>
                <option value="logopedista">Logopedista</option>
                <option value="neuropsicomotricista">Neuropsicomotricista</option>
                <option value="psichiatra">Psichiatra</option>
                <option value="neurologo">Neurologo</option>
                <option value="neuropsichiatra">Neuropsichiatra Infantile</option>
              </select>
            </div>

            {/* Filtro Équipe */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-blue-800">Équipe di Provenienza</label>
              <select
                value={filters.teamId}
                onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Tutte le équipe</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.nome || team.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded">
              <div className="flex items-center justify-between">
                <span><strong>Risultati trovati:</strong> {professionisti.length} professionisti</span>
                {(filters.professionista || filters.teamId) && (
                  <button
                    type="button"
                    onClick={() => setFilters({ professionista: '', teamId: '' })}
                    className="text-xs bg-white text-blue-700 px-2 py-1 rounded border border-blue-300 hover:bg-blue-50"
                  >
                    Resetta filtri
                  </button>
                )}
              </div>
              {professionisti.length === 0 && (filters.professionista || filters.teamId) && (
                <div className="mt-2 text-orange-700 bg-orange-100 p-2 rounded">
                  Nessun professionista trovato con i filtri selezionati. Prova a modificare i criteri di ricerca.
                </div>
              )}
            </div>
          </div>

          {/* Destinatario */}
          <div>
            <label className="block text-sm font-semibold mb-2">Invia a *</label>
            {professionisti.length === 0 && (filters.professionista || filters.teamId) && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                <strong>Suggerimento:</strong> Rimuovi alcuni filtri per vedere più professionisti disponibili.
              </div>
            )}
            <select
              value={formData.receiverId}
              onChange={(e) => setFormData({ ...formData, receiverId: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Seleziona professionista...</option>
              {professionisti.length === 0 ? (
                <option value="" disabled>Nessun professionista trovato con i filtri selezionati</option>
              ) : (
                professionisti.map((prof) => (
                  <option key={prof.uid} value={prof.uid}>
                    {prof.profile.nome} - {prof.profile.specializzazioni.join(', ')}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Urgenza */}
          <div>
            <label className="block text-sm font-semibold mb-2">Urgenza</label>
            <select
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="low">Bassa</option>
              <option value="normal">Normale</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4">Dati Paziente (Crittografati)</h3>
            
            {/* Nome Paziente */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Nome Paziente *</label>
              <input
                type="text"
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Nome completo del paziente"
                required
              />
            </div>

            {/* Età */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Età</label>
              <input
                type="text"
                value={formData.patientAge}
                onChange={(e) => setFormData({ ...formData, patientAge: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="es. 45 anni"
              />
            </div>

            {/* Contatto */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Contatto Paziente</label>
              <input
                type="text"
                value={formData.patientContact}
                onChange={(e) => setFormData({ ...formData, patientContact: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Telefono o email"
              />
            </div>

            {/* Diagnosi */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Diagnosi / Motivo Invio *</label>
              <textarea
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Descrivi la diagnosi e il motivo della segnalazione"
                required
              />
            </div>

            {/* Note */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Note Cliniche</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={4}
                placeholder="Informazioni aggiuntive rilevanti per il collega"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
              <strong>Privacy e Sicurezza:</strong> Tutti i dati sensibili del paziente saranno protetti 
              prima dell'invio, in conformità con il GDPR.
            </div>
          </div>

          {/* Pulsanti */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
            >
              {loading ? 'Invio in corso...' : 'Invia Paziente'}
            </button>
            <Link
              to="/referrals"
              className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-center flex items-center justify-center"
            >
              Annulla
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
