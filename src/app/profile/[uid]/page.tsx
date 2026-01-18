'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Conversation, Team } from '@/types/equippe';
import Header from '@/components/Header';
import { notifyTeamInviteReceived } from '@/lib/notifications';

export default function ProfilePage() {
  const { user: currentUser, userProfile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const uid = params.uid as string;

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingConversation, setStartingConversation] = useState(false);
  const [adminTeams, setAdminTeams] = useState<Team[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Funzione per normalizzare i vecchi nomi delle discipline nei nomi dei professionisti
  const normalizeSpecialization = (spec: string): string => {
    const normalizationMap: Record<string, string> = {
      'Psicologia': 'Psicologo',
      'Psicoterapia': 'Psicoterapeuta',
      'Psichiatria': 'Psichiatra',
      'Nutrizione': 'Nutrizionista',
      'Dietetica': 'Dietista',
      'Assistenza Sociale': 'Assistente Sociale',
      'Educazione Professionale': 'Educatore Professionale',
      'Logopedia': 'Logopedista',
      'Fisioterapia': 'Fisioterapista',
      'Terapia Occupazionale': 'Terapista Occupazionale',
      'Infermieristica': 'Infermiere',
      'Medicina': 'Medico Specialista',
      'Ginecologia': 'Ginecologo',
      'Andrologia': 'Andrologo',
      'Sessuologia': 'Sessuologo'
    };
    return normalizationMap[spec] || spec;
  };

  // Funzione per normalizzare le vecchie tematiche
  const normalizeTematica = (tema: string): string => {
    // Prima filtra esplicitamente le tematiche da rimuovere
    if (tema === 'Dolore cronico' || tema === 'Riabilitazione' || tema === 'Riabilitazione motoria' || tema === 'Geriatria' || tema === 'Pediatria') {
      return '';
    }
    
    const normalizationMap: Record<string, string> = {
      'DCA (Disturbi del Comportamento Alimentare)': 'Disturbi alimentari',
      'Ansia e stress': 'Disturbi d\'ansia',
      'Obesità': 'Disturbi alimentari',
      'Diabete': 'Disturbi alimentari',
    };
    return normalizationMap[tema] || tema;
  };

  useEffect(() => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    if (currentUser.uid === uid) {
      router.push('/dashboard');
      return;
    }

    loadProfile();
    loadAdminTeams();
  }, [currentUser, uid]);

  const loadProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        console.error('Utente non trovato');
        router.push('/dashboard');
        return;
      }

      setProfileUser({
        uid: userDoc.id,
        ...userDoc.data()
      } as User);
    } catch (error) {
      console.error('Errore caricamento profilo:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminTeams = async () => {
    try {
      if (!currentUser) return;
      
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('memberIds', 'array-contains', currentUser.uid));
      const snapshot = await getDocs(q);
      
      const allTeams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Team));
      
      // Filtra solo i team dove sono amministratore
      const myAdminTeams = allTeams.filter(team => {
        const member = team.members.find(m => 
          (m.userId || m.uid) === currentUser.uid
        );
        return member && (member.role === 'admin' || member.ruolo === 'admin');
      });
      
      setAdminTeams(myAdminTeams);
    } catch (error) {
      console.error('Errore caricamento team amministrati:', error);
    }
  };

  const handleSendInvite = async () => {
    if (!selectedTeamId) {
      alert('Seleziona un\'équipe');
      return;
    }
    
    if (!currentUser || !profileUser) return;
    
    setSendingInvite(true);
    
    try {
      // Controlla se esiste già un invito pendente per questo utente e team
      const invitesRef = collection(db, 'teamInvites');
      const existingInviteQuery = query(
        invitesRef,
        where('teamId', '==', selectedTeamId),
        where('toUserId', '==', profileUser.uid),
        where('status', '==', 'pending')
      );
      
      const existingInviteSnapshot = await getDocs(existingInviteQuery);
      
      if (!existingInviteSnapshot.empty) {
        alert('Esiste già un invito pendente per questo professionista in questa équipe');
        return;
      }
      
      // Controlla se l'utente è già membro del team
      const selectedTeam = adminTeams.find(t => t.id === selectedTeamId);
      if (selectedTeam?.memberIds?.includes(profileUser.uid)) {
        alert('Questo professionista è già membro dell\'équipe selezionata');
        return;
      }
      
      // Crea l'invito
      const inviteRef = await addDoc(collection(db, 'teamInvites'), {
        teamId: selectedTeamId,
        type: 'invite',
        fromUserId: currentUser.uid,
        toUserId: profileUser.uid,
        status: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      // Invia notifica
      if (selectedTeam) {
        const senderName = userProfile?.profile?.nome || currentUser.displayName || currentUser.email || 'Un professionista';
        await notifyTeamInviteReceived(
          profileUser.uid,
          selectedTeamId,
          selectedTeam.nome || selectedTeam.name || 'Équipe',
          senderName,
          inviteRef.id
        );
      }
      
      setShowInviteModal(false);
      setSelectedTeamId('');
      alert('Invito inviato con successo!');
    } catch (error) {
      console.error('Errore invio invito:', error);
      alert('Errore durante l\'invio dell\'invito');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleStartConversation = async () => {
    if (!currentUser || !profileUser) {
      console.log('User or profileUser not available');
      return;
    }

    setStartingConversation(true);

    try {
      // Forza il refresh del token di autenticazione
      console.log('Refreshing auth token...');
      await currentUser.getIdToken(true);
      
      // Controlla se esiste già una conversazione
      console.log('Checking for existing conversation between:', currentUser.uid, 'and', profileUser.uid);
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', currentUser.uid)
      );

      const snapshot = await getDocs(q);
      const existingConversation = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.participants.includes(profileUser.uid);
      });

      if (existingConversation) {
        // Conversazione già esistente, vai direttamente ai messaggi
        console.log('Found existing conversation:', existingConversation.id);
        router.push(`/messages?conversation=${existingConversation.id}`);
        return;
      }

      // Crea nuova conversazione solo se non esiste
      console.log('Creating new conversation between:', currentUser.uid, 'and', profileUser.uid);
      const conversationData = {
        participants: [currentUser.uid, profileUser.uid],
        participantsData: {
          [currentUser.uid]: {
            name: userProfile?.profile?.nome || 'Tu'
          },
          [profileUser.uid]: {
            name: profileUser.profile.nome
          }
        },
        createdAt: Timestamp.now(),
        lastMessage: '',
        lastMessageTime: Timestamp.now(),
        lastSenderId: '',
        unreadCount: {
          [currentUser.uid]: 0,
          [profileUser.uid]: 0
        }
      };

      const docRef = await addDoc(collection(db, 'conversations'), conversationData);
      console.log('Conversation created:', docRef.id);
      router.push(`/messages?conversation=${docRef.id}`);
    } catch (error) {
      console.error('Errore avvio conversazione:', error);
      alert('Errore durante l\'avvio della conversazione. Verifica di essere autenticato.');
    } finally {
      setStartingConversation(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    );
  }

  if (!profileUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header del profilo */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              {profileUser.profile.photoURL ? (
                <img 
                  src={profileUser.profile.photoURL} 
                  alt={profileUser.profile.nome} 
                  className="w-20 h-20 rounded-full object-cover border-4 border-blue-300"
                  style={{ aspectRatio: '1/1' }}
                />
              ) : (
                <div 
                  className="w-20 h-20 rounded-full bg-blue-300 flex items-center justify-center text-white text-2xl font-bold"
                  style={{ aspectRatio: '1/1' }}
                >
                  {profileUser.profile.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              )}
              
              {/* Nome e info base */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{profileUser.profile.nome}</h1>
                
                {/* Studi multipli */}
                <div className="mt-2 space-y-1">
                  {profileUser.profile.studi && profileUser.profile.studi.length > 0 ? (
                    <>
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        📍 {profileUser.profile.studi.length === 1 ? 'Studio' : 'Studi'} di Lavoro:
                      </div>
                      {profileUser.profile.studi.map((studio, index) => (
                        <div key={index} className="flex items-start gap-2 text-gray-600">
                          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div className="flex-1">
                            <span>{studio.indirizzo}</span>
                            {studio.remoto && (
                              <span className="ml-2 text-green-600 text-sm font-medium">• Remoto</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    // Fallback per compatibilità con il vecchio formato location
                    <>
                      {profileUser.profile.location.indirizzo && (
                        <p className="text-gray-600 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {profileUser.profile.location.indirizzo}
                        </p>
                      )}
                      {profileUser.profile.location.zonaRoma && (
                        <p className="text-gray-600 text-sm">
                          📍 {profileUser.profile.location.zonaRoma}
                        </p>
                      )}
                      {!profileUser.profile.location.indirizzo && (
                        <p className="text-gray-600">
                          {profileUser.profile.location.città}, {profileUser.profile.location.provincia}
                        </p>
                      )}
                    </>
                  )}
                </div>
                
                {profileUser.email && (
                  <p className="text-gray-500 text-sm mt-1">{profileUser.email}</p>
                )}
              </div>
            </div>

            {/* Pulsanti azione */}
            <div className="flex gap-3">
              {/* Pulsante Invita in Équipe */}
              {adminTeams.length > 0 && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Invita in Équipe
                </button>
              )}
              
              {/* Pulsante messaggio */}
              <button
                onClick={handleStartConversation}
                disabled={startingConversation}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.456L3 21l2.544-5.906A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                </svg>
                {startingConversation ? 'Caricamento...' : 'Invia Messaggio'}
              </button>
            </div>
          </div>
        </div>

        {/* Specializzazioni */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Specializzazioni</h2>
          <div className="flex flex-wrap gap-2">
            {[...new Set(profileUser.profile.specializzazioni.map(spec => normalizeSpecialization(spec)))].map((spec, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>

        {/* Tematiche */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Tematiche di Interesse</h2>
          <div className="flex flex-wrap gap-2">
            {[...new Set(profileUser.profile.tematiche
              .map(tema => normalizeTematica(tema))
              .filter(t => t !== '')
            )].map((tema, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
              >
                {tema}
              </span>
            ))}
          </div>
        </div>

        {/* Studi e Sedi di Lavoro */}
        {profileUser.profile.studi && profileUser.profile.studi.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {profileUser.profile.studi.length === 1 ? 'Studio di Lavoro' : 'Studi e Sedi di Lavoro'}
            </h2>
            <div className="space-y-4">
              {profileUser.profile.studi.map((studio, index) => (
                <div key={index} className="border-l-4 border-blue-200 pl-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 mt-0.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <div>
                          <p className="font-medium text-gray-900">{studio.indirizzo}</p>
                          {studio.città && (
                            <p className="text-sm text-gray-600">{studio.città}, {studio.provincia}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {studio.remoto && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          Remoto
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bio (se presente) */}
        {profileUser.profile.bio && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Bio</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{profileUser.profile.bio}</p>
          </div>
        )}

        {/* Link social (se presenti) */}
        {(profileUser.profile.linkedin || profileUser.profile.website) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Link</h2>
            <div className="space-y-2">
              {profileUser.profile.linkedin && (
                <a
                  href={profileUser.profile.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <span>Link</span>
                  <span>LinkedIn</span>
                </a>
              )}
              {profileUser.profile.website && (
                <a
                  href={profileUser.profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <span>Web</span>
                  <span>Website</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Modal Invito Équipe */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Invita in Équipe</h3>
              <p className="text-sm text-gray-600 mt-1">Seleziona l'équipe in cui invitare <strong>{profileUser?.profile.nome}</strong></p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Équipe di destinazione *</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Seleziona un'équipe...</option>
                  {adminTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.nome || team.name}
                      {team.specializations && team.specializations.length > 0 && 
                        ` - ${team.specializations.join(', ')}`
                      }
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedTeamId && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                  <strong>Info:</strong> L'invito verrà inviato al professionista che potrà accettare o rifiutare.
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setSelectedTeamId('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSendInvite}
                disabled={!selectedTeamId || sendingInvite}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {sendingInvite ? 'Invio...' : 'Invia Invito'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}