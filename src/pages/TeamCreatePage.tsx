import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { useCanInteract } from '@/hooks/useCanInteract';
import { collection, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, RoleCercato } from '@/types/equippe';
import MapSelectorClient from '@/components/MapSelectorClient';
import { uploadTeamPhoto } from '@/lib/teamPhotoUpload';
import { notifyTeamInviteReceived } from '@/lib/notifications';

const SPECIALIZZAZIONI = [
  'Psicologo',
  'Psicoterapeuta',
  'Psichiatra',
  'Nutrizionista',
  'Dietologo',
  'Logopedista'
];

export default function TeamCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canInteract, message } = useCanInteract();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [teamPhotoURL, setTeamPhotoURL] = useState<string>('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  
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
      navigate('/login');
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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validazione file
    if (!file.type.startsWith('image/')) {
      setError('Seleziona un\'immagine valida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      setError('L\'immagine deve essere inferiore a 5MB');
      return;
    }

    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);
    setError('');

    try {
      const photoURL = await uploadTeamPhoto(file, user!.uid, (progress) => {
        setUploadProgress(progress);
      });
      setTeamPhotoURL(photoURL);
    } catch (error) {
      console.error('Errore upload foto:', error);
      setError('Errore durante l\'upload della foto');
      setPhotoPreview(null);
      setSelectedPhoto(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setTeamPhotoURL('');
    setPhotoPreview(null);
    setSelectedPhoto(null);
    setUploadProgress(0);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
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
      occupati: 0,
      postiTotali: nuovoRuolo.numero,
      postiOccupati: 0
    };
    
    setFormData(prev => ({
      ...prev,
      ruoliCercati: [...prev.ruoliCercati, ruolo]
    }));
    
    setNuovoRuolo({ specializzazione: '', numero: 1, descrizione: '' });
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
    
    if (!canInteract) {
      setError(message || 'Non puoi creare team al momento');
      return;
    }
    
    setError('');

    if (!formData.name.trim()) {
      setError('Inserisci il nome dell\'équipe');
      return;
    }

    if (!formData.remoto && (!formData.indirizzo || !formData.coordinate)) {
      setError('Seleziona un indirizzo sulla mappa o abilita "Lavoro da remoto"');
      return;
    }

    if (formData.ruoliCercati.length === 0) {
      setError('Aggiungi almeno un ruolo cercato');
      return;
    }

    setLoading(true);

    try {
      if (!user) return;

      // Crea membri con struttura completa (solo il creatore)
      const creatorMember = {
        uid: user.uid,
        userId: user.uid,
        ruolo: 'admin' as const,
        role: 'admin' as const,
        joinedAt: Timestamp.now(),
      };

      const allMembers = [creatorMember];

      // Calcola statistiche
      const totaleRichiesti = formData.ruoliCercati.reduce((sum, r) => sum + r.numero, 0);
      const totaleOccupati = allMembers.length;

      // Estrai specializzazioni
      const specializations = [...new Set(formData.ruoliCercati.map(r => r.specializzazione))];

      // Pulisci ruoli cercati
      const ruoliCercatiPuliti = formData.ruoliCercati.map(ruolo => {
        const ruoloPulito: any = {
          specializzazione: ruolo.specializzazione,
          numero: ruolo.numero,
          postiTotali: ruolo.numero,
          postiOccupati: 0
        };
        if (ruolo.descrizione) {
          ruoloPulito.descrizione = ruolo.descrizione;
        }
        return ruoloPulito;
      });

      const teamData: any = {
        nome: formData.name,
        name: formData.name,
        descrizione: formData.description || '',
        description: formData.description || '',
        specializations: specializations,
        members: allMembers,
        memberIds: [user.uid],
        createdBy: user.uid,
        creatorUid: user.uid,
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

      if (formData.indirizzo) {
        teamData.indirizzo = formData.indirizzo;
      }
      if (formData.coordinate) {
        teamData.coordinate = formData.coordinate;
      }
      if (formData.raggioKm) {
        teamData.raggioKm = formData.raggioKm;
      }
      if (teamPhotoURL) {
        teamData.photoURL = teamPhotoURL;
      }

      const teamRef = await addDoc(collection(db, 'teams'), teamData);

      // Crea inviti per i membri selezionati (come pending, non aggiunti direttamente)
      if (formData.selectedMembers.length > 0) {
        const senderName = user.displayName || user.email || 'Un professionista';
        const invitePromises = formData.selectedMembers.map(async (userId) => {
          const inviteRef = await addDoc(collection(db, 'teamInvites'), {
            teamId: teamRef.id,
            type: 'invite',
            fromUserId: user.uid,
            toUserId: userId,
            status: 'pending',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          await notifyTeamInviteReceived(userId, teamRef.id, formData.name, senderName, inviteRef.id, user.uid);
        });
        await Promise.all(invitePromises);
      }

      navigate('/teams');
    } catch (err: any) {
      console.error('Errore creazione team:', err);
      setError(err.message || 'Errore durante la creazione del team');
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Creazione équipe non disponibile</h2>
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
        <Link to="/teams" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna alle Équipe
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Crea Nuova Équipe
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
          {/* Foto Équipe */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Foto Équipe
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Aggiungi una foto che rappresenti la tua équipe (opzionale)
            </p>

            <div className="flex items-start gap-6">
              {/* Preview foto */}
              <div className="w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <img 
                    src={photoPreview} 
                    alt="Preview foto équipe" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-xs text-gray-500">Nessuna foto</p>
                  </div>
                )}
              </div>

              {/* Controlli upload */}
              <div className="flex-1">
                <div className="flex gap-3 mb-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {uploadingPhoto ? 'Caricamento...' : 'Scegli Foto'}
                  </button>
                  
                  {(selectedPhoto || photoPreview) && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={uploadingPhoto}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                      Rimuovi
                    </button>
                  )}
                </div>

                {uploadingPhoto && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Caricamento in corso...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Formati supportati: JPEG, PNG, WebP, GIF<br/>
                  Dimensione massima: 5MB
                </p>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Nome */}
          <div className="border-t pt-6">
            <label className="block text-sm font-semibold mb-2">Nome Équipe *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
              placeholder="es. Équipe Salute Mentale Roma"
              required
            />
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-sm font-semibold mb-2">Descrizione</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
              rows={4}
              placeholder="Descrivi gli obiettivi e le modalità di collaborazione dell'équipe..."
            />
          </div>

          {/* Località e Zona */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Zona Operativa *
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Cerca il tuo studio o la zona dove opera l'équipe e definisci il raggio di copertura
            </p>

            <div className="mb-4">
              <MapSelectorClient
                initialCenter={formData.coordinate || { lat: 41.9028, lng: 12.4964 }}
                initialZoom={12}
                raggioKm={formData.raggioKm}
                onLocationSelect={(location) => {
                  setFormData({
                    ...formData,
                    coordinate: location.coordinate,
                    indirizzo: location.address
                  });
                }}
                selectedLocation={formData.coordinate ? {
                  coordinate: formData.coordinate,
                  address: formData.indirizzo
                } : undefined}
              />
              {formData.indirizzo && (
                <p className="text-sm text-gray-600 mt-2">📍 {formData.indirizzo}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">
                Raggio di copertura: {formData.raggioKm} km
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={formData.raggioKm}
                onChange={(e) => setFormData({ ...formData, raggioKm: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>

            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={formData.remoto}
                onChange={(e) => setFormData({ ...formData, remoto: e.target.checked })}
                className="mr-2 w-4 h-4"
              />
              <span>L'équipe opera anche da remoto</span>
            </label>
          </div>

          {/* Ruoli Cercati */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-2">Figure Cercate per l'Équipe</h3>
            <p className="text-sm text-gray-600 mb-4">
              Specifica quali figure professionali stai cercando e quante
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Specializzazione *</label>
                  <select
                    value={nuovoRuolo.specializzazione}
                    onChange={(e) => setNuovoRuolo({ ...nuovoRuolo, specializzazione: e.target.value })}
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
                    onChange={(e) => setNuovoRuolo({ ...nuovoRuolo, numero: parseInt(e.target.value) || 1 })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Descrizione (opzionale)</label>
                  <input
                    type="text"
                    value={nuovoRuolo.descrizione}
                    onChange={(e) => setNuovoRuolo({ ...nuovoRuolo, descrizione: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="es. Esperto in trauma"
                  />
                </div>
              </div>
              
              <button
                type="button"
                onClick={aggiungiRuolo}
                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition text-sm font-medium"
              >
                + Aggiungi Ruolo
              </button>
            </div>

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

          {/* Membri Iniziali */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-2">Invita Membri (opzionale)</h3>
            <p className="text-sm text-gray-600 mb-3">
              Cerca i professionisti che vuoi invitare nella tua équipe
            </p>

            {/* Membri selezionati */}
            {formData.selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.selectedMembers.map(uid => {
                  const usr = allUsers.find(u => u.uid === uid);
                  return (
                    <span key={uid} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                      {usr?.profile?.nome || usr?.email || uid}
                      <button
                        type="button"
                        onClick={() => handleMemberToggle(uid)}
                        className="ml-1 text-blue-600 hover:text-blue-900 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search bar */}
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Cerca per nome, email o specializzazione..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
            />

            {/* Risultati ricerca */}
            {memberSearch.trim().length >= 2 && (() => {
              const query = memberSearch.trim().toLowerCase();
              const filtered = allUsers.filter(u =>
                (u.profile?.nome?.toLowerCase().includes(query)) ||
                (u.email?.toLowerCase().includes(query)) ||
                (u.profile?.specializzazioni?.some(s => s.toLowerCase().includes(query)))
              );
              return filtered.length === 0 ? (
                <p className="text-gray-500 text-center py-4 border rounded-lg">Nessun professionista trovato</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {filtered.map((usr) => (
                    <label key={usr.uid} className="flex items-start p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                      <input
                        type="checkbox"
                        checked={formData.selectedMembers.includes(usr.uid)}
                        onChange={() => handleMemberToggle(usr.uid)}
                        className="mr-3 mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="font-semibold">{usr.profile?.nome || 'Nome non disponibile'}</div>
                        <div className="text-sm text-gray-600">{usr.email}</div>
                        {usr.profile?.specializzazioni && usr.profile.specializzazioni.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {usr.profile.specializzazioni.join(', ')}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Pulsanti */}
          <div className="flex gap-4 pt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold text-base"
            >
              {loading ? 'Creazione in corso...' : 'Crea Équipe'}
            </button>
            <Link
              to="/teams"
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
