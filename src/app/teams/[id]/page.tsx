import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, Timestamp, collection, getDocs, addDoc, deleteDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Team, User, Conversation, Message, ConversationType } from '@/types/equippe';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import MapSelector from '@/components/MapSelector';
import { notifyTeamRequest, notifyTeamRequestAccepted, notifyTeamRemoval, notifyTeamAdminPromotion, notifyTeamMemberLeft, notifyTeamInviteReceived } from '@/lib/notifications';
import { occupyPositions, freePositions } from '@/lib/teamPositions';

export default function TeamDetailPage() {
  const { user, userProfile } = useAuth();
  const { showToast, showConfirm } = useModal();
  const navigate = useNavigate();
  const params = useParams();
  const teamId = params.id as string;
  
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [teamConversation, setTeamConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stati per editing inline
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [editingPositions, setEditingPositions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Specializzazioni disponibili
  const specializzazioni = [
    'Psicologo',
    'Psicoterapeuta',
    'Psichiatra',
    'Nutrizionista',
    'Dietologo',
    'Logopedista'
  ];

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadTeamData();
  }, [user, teamId]);

  const loadTeamData = async () => {
    try {
      // Carica team
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (!teamDoc.exists()) {
        navigate('/teams');
        return;
      }

      const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
      setTeam(teamData);

      // Verifica se l'utente è admin o membro
      const userMember = teamData.members.find(m => m.userId === user?.uid || m.uid === user?.uid);
      setIsAdmin(userMember?.role === 'admin');
      setIsMember(!!userMember);

      // Carica dati membri
      const memberPromises = teamData.members.map(async (member) => {
        const userId = member.userId || member.uid;
        const userDoc = await getDoc(doc(db, 'users', userId));
        return { uid: userDoc.id, ...userDoc.data() } as User;
      });

      const membersData = await Promise.all(memberPromises);
      setMembers(membersData);

      // Carica utenti disponibili per invito
      const userIsAdmin = teamData.members.find(m => m.userId === user?.uid)?.role === 'admin';
      if (userIsAdmin) {
        const allUsersSnapshot = await getDocs(collection(db, 'users'));
        const allUsers = allUsersSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as User));
        
        // Filtra utenti non già membri (usa memberIds che è un array semplice)
        const available = allUsers.filter(u => 
          !teamData.memberIds?.includes(u.uid)
        );
        setAvailableUsers(available);

        // Carica richieste di adesione pendenti
        const requestsSnapshot = await getDocs(collection(db, 'teamRequests'));
        const requests = requestsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((req: any) => req.teamId === teamId && req.status === 'pending');
        
        // Carica dati utenti per le richieste
        const requestsWithUserData = await Promise.all(
          requests.map(async (req: any) => {
            const userDoc = await getDoc(doc(db, 'users', req.userId));
            return {
              ...req,
              userData: userDoc.exists() ? { uid: userDoc.id, ...userDoc.data() } : null
            };
          })
        );
        setPendingRequests(requestsWithUserData);
      }

      // Carica o crea chat di équipe
      await loadTeamChat();
    } catch (error) {
      console.error('Errore caricamento team:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll ai nuovi messaggi
  useEffect(() => {
    if (showChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  const handleRemoveMember = async (userId: string) => {
    const confirmed = await showConfirm({
      title: 'Rimuovi membro',
      message: 'Sei sicuro di voler rimuovere questo membro?',
      variant: 'danger',
      confirmText: 'Rimuovi'
    });
    if (!confirmed) return;

    try {
      const teamRef = doc(db, 'teams', teamId);
      const memberToRemove = team?.members.find(m => m.userId === userId);
      
      await updateDoc(teamRef, {
        members: arrayRemove(memberToRemove),
        memberIds: arrayRemove(userId),
        updatedAt: Timestamp.now(),
      });

      // Libera le posizioni occupate dal membro rimosso
      await freePositions(teamId, userId);

      // Notifica l'utente rimosso
      if (team?.name) {
        await notifyTeamRemoval(userId, teamId, team.name);
      }

      await loadTeamData();
    } catch (error) {
      console.error('Errore rimozione membro:', error);
      showToast('Errore durante la rimozione del membro', 'error');
    }
  };

  const handleLeaveTeam = async () => {
    if (!isAdmin) {
      // Utente normale lascia il team
      const confirmed = await showConfirm({
        title: 'Lascia Equipé',
        message: 'Sei sicuro di voler lasciare questa Equipé?',
        variant: 'warning',
        confirmText: 'Lascia'
      });
      if (!confirmed) return;

      try {
        const teamRef = doc(db, 'teams', teamId);
        const memberToRemove = team?.members.find(m => m.userId === user?.uid);
        
        await updateDoc(teamRef, {
          members: arrayRemove(memberToRemove),
          memberIds: arrayRemove(user?.uid),
          updatedAt: Timestamp.now(),
        });

        // Libera le posizioni occupate dal membro
        if (user?.uid) {
          await freePositions(teamId, user.uid);
        }

        // Notifica tutti gli admin che il membro ha lasciato
        if (team?.name && user) {
          const adminIds = team.members
            .filter(m => (m.role === 'admin' || m.ruolo === 'admin') && (m.userId || m.uid) !== user.uid)
            .map(m => m.userId || m.uid)
            .filter(Boolean) as string[];
          
          if (adminIds.length > 0) {
            const userName = user.displayName || user.email || 'Un membro';
            await notifyTeamMemberLeft(adminIds, userName, teamId, team.name);
          }
        }

        navigate('/teams');
      } catch (error) {
        console.error('Errore uscita dal team:', error);
        showToast('Errore durante l\'uscita dal team', 'error');
      }
    } else {
      // Admin lascia il team - passa admin al secondo membro
      const confirmed = await showConfirm({
        title: 'Lascia Equipé',
        message: 'Sei sicuro di voler lasciare questa Equipé? Il ruolo di admin passerà al prossimo membro.',
        variant: 'warning',
        confirmText: 'Lascia'
      });
      if (!confirmed) return;

      try {
        const teamRef = doc(db, 'teams', teamId);
        
        if (team && team.members.length > 1) {
          // Trova il secondo membro (non admin)
          const otherMembers = team.members.filter(m => m.userId !== user?.uid);
          
          if (otherMembers.length > 0) {
            // Promuovi il primo membro disponibile ad admin
            const newAdmin = otherMembers[0];
            const updatedNewAdmin = { ...newAdmin, role: 'admin' };
            
            // Rimuovi l'admin corrente e aggiorna il nuovo admin
            const memberToRemove = team.members.find(m => m.userId === user?.uid);
            const updatedMembers = team.members
              .filter(m => m.userId !== user?.uid)
              .map(m => m.userId === newAdmin.userId ? updatedNewAdmin : m);
            
            await updateDoc(teamRef, {
              members: updatedMembers,
              memberIds: arrayRemove(user?.uid),
              createdBy: newAdmin.userId, // Aggiorna anche il createdBy
              updatedAt: Timestamp.now(),
            });

            // Libera le posizioni occupate dall'admin
            if (user?.uid) {
              await freePositions(teamId, user.uid);
            }

            showToast(`${otherMembers[0].userId} è ora l'admin dell'Equipé`, 'info');
          }
        } else {
          // Se è l'unico membro, elimina il team
          await deleteDoc(teamRef);
        }

        navigate('/teams');
      } catch (error) {
        console.error('Errore uscita dal team:', error);
        showToast('Errore durante l\'uscita dal team', 'error');
      }
    }
  };

  const handleDeleteTeam = async () => {
    const confirmed1 = await showConfirm({
      title: 'Elimina Equipé',
      message: 'ATTENZIONE: Sei sicuro di voler eliminare definitivamente questa Equipé? Questa azione non può essere annullata.',
      variant: 'danger',
      confirmText: 'Elimina'
    });
    if (!confirmed1) return;
    
    // Doppia conferma per sicurezza
    const confirmed2 = await showConfirm({
      title: 'Conferma eliminazione',
      message: 'Confermi l\'eliminazione? Tutti i dati del team saranno persi.',
      variant: 'danger',
      confirmText: 'Conferma eliminazione'
    });
    if (!confirmed2) return;

    try {
      // Elimina il team
      await deleteDoc(doc(db, 'teams', teamId));
      
      // TODO: Considera di eliminare anche gli inviti correlati
      // const invitesQuery = query(collection(db, 'teamInvites'), where('teamId', '==', teamId));
      // const invitesSnapshot = await getDocs(invitesQuery);
      // await Promise.all(invitesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

      showToast('Equipé eliminata con successo', 'success');
      navigate('/teams');
    } catch (error) {
      console.error('Errore eliminazione team:', error);
      showToast('Errore durante l\'eliminazione del team', 'error');
    }
  };

  const handleInviteMembers = async () => {
    if (selectedUsers.length === 0) {
      showToast('Seleziona almeno un utente da invitare', 'warning');
      return;
    }

    try {
      // Crea inviti invece di aggiungere direttamente
      const invitePromises = selectedUsers.map(async (userId) => {
        const inviteRef = await addDoc(collection(db, 'teamInvites'), {
          teamId,
          type: 'invite',
          fromUserId: user?.uid,
          toUserId: userId,
          status: 'pending',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        // Notifica l'utente invitato
        if (team?.name && user) {
          const senderName = user.displayName || user.email || 'Un professionista';
          await notifyTeamInviteReceived(userId, teamId, team.name, senderName, inviteRef.id);
        }
      });

      await Promise.all(invitePromises);

      setShowInviteModal(false);
      setSelectedUsers([]);
      showToast(`Inviti inviati a ${selectedUsers.length} professionisti!`, 'success');
    } catch (error) {
      console.error('Errore invio inviti:', error);
      showToast('Errore durante l\'invio degli inviti', 'error');
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleJoinRequest = async () => {
    if (!requestMessage.trim()) {
      showToast('Inserisci un messaggio per la tua richiesta', 'warning');
      return;
    }

    try {
      // Crea la richiesta di adesione
      await addDoc(collection(db, 'teamRequests'), {
        teamId,
        teamName: team?.name,
        userId: user?.uid,
        userName: user?.displayName || user?.email,
        message: requestMessage,
        status: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Invia notifiche a tutti gli admin
      const adminIds = team?.members
        .filter(m => m.role === 'admin' || m.ruolo === 'admin')
        .map(m => m.userId || m.uid)
        .filter(Boolean) as string[];
      
      if (adminIds.length > 0 && team?.name && user?.uid) {
        const userName = user?.displayName || user?.email || 'Un utente';
        const userPhoto = userProfile?.profile?.photoURL || user.photoURL;
        await notifyTeamRequest(teamId, team.name, adminIds, user.uid, userName, userPhoto);
      }

      setShowRequestModal(false);
      setRequestMessage('');
      showToast('Richiesta inviata! L\'amministratore riceverà una notifica.', 'success');
    } catch (error) {
      console.error('Errore invio richiesta:', error);
      showToast('Errore durante l\'invio della richiesta', 'error');
    }
  };

  const handleAcceptRequest = async (requestId: string, userId: string) => {
    try {
      // Aggiungi l'utente al team
      const newMember = {
        uid: userId,
        userId: userId,
        ruolo: 'member' as const,
        role: 'member' as const,
        joinedAt: Timestamp.now(),
      };

      await updateDoc(doc(db, 'teams', teamId), {
        members: arrayUnion(newMember),
        memberIds: arrayUnion(userId),
        updatedAt: Timestamp.now(),
      });

      // Aggiorna lo stato della richiesta
      await updateDoc(doc(db, 'teamRequests', requestId), {
        status: 'accepted',
        updatedAt: Timestamp.now(),
      });

      // Notifica l'utente dell'accettazione
      if (team?.name) {
        await notifyTeamRequestAccepted(userId, teamId, team.name);
      }

      // Aggiorna le posizioni occupate
      await occupyPositions(teamId, userId);

      // Ricarica i dati
      await loadTeamData();
      showToast('Richiesta accettata! Il membro è stato aggiunto all\'équipe.', 'success');
    } catch (error) {
      console.error('Errore accettazione richiesta:', error);
      showToast('Errore durante l\'accettazione della richiesta', 'error');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const confirmed = await showConfirm({
      title: 'Rifiuta richiesta',
      message: 'Sei sicuro di voler rifiutare questa richiesta?',
      variant: 'warning',
      confirmText: 'Rifiuta'
    });
    if (!confirmed) return;

    try {
      // Aggiorna lo stato della richiesta
      await updateDoc(doc(db, 'teamRequests', requestId), {
        status: 'rejected',
        updatedAt: Timestamp.now(),
      });

      // Ricarica i dati
      await loadTeamData();
      showToast('Richiesta rifiutata.', 'info');
    } catch (error) {
      console.error('Errore rifiuto richiesta:', error);
      showToast('Errore durante il rifiuto della richiesta', 'error');
    }
  };

  // Team Chat Functions
  const loadTeamChat = async () => {
    if (!teamId || !user) return;

    try {
      // Cerca una conversazione esistente per questo team
      const conversationsRef = collection(db, 'conversations');
      const conversationQuery = query(
        conversationsRef,
        where('type', '==', 'team'),
        where('teamId', '==', teamId)
      );
      
      const conversationSnapshot = await getDocs(conversationQuery);
      
      if (!conversationSnapshot.empty) {
        // Conversazione esistente trovata
        const conversationDoc = conversationSnapshot.docs[0];
        const conversationData = { id: conversationDoc.id, ...conversationDoc.data() } as Conversation;
        setTeamConversation(conversationData);
        
        // Carica messaggi
        loadMessages(conversationDoc.id);
      } else {
        // Nessuna conversazione trovata - sarà creata al primo messaggio
        setTeamConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Errore caricamento chat team:', error);
    }
  };

  const createTeamChat = async (): Promise<string | null> => {
    if (!team || !user) return null;

    try {
      // Crea i dati dei partecipanti
      const participantsData: { [key: string]: { name: string; photoURL?: string } } = {};
      const participants: string[] = [];

      for (const member of team.members) {
        const memberId = member.userId || member.uid;
        if (memberId) {
          participants.push(memberId);
          
          // Trova i dati del membro
          const memberData = members.find(m => m.uid === memberId);
          if (memberData) {
            participantsData[memberId] = {
              name: memberData.profile.nome,
              photoURL: memberData.profile.photoURL
            };
          }
        }
      }

      // Crea la conversazione
      const newConversationRef = await addDoc(collection(db, 'conversations'), {
        type: 'team' as ConversationType,
        teamId: team.id || teamId,
        teamName: team.nome || team.name,
        teamPhotoURL: team.photoURL || '',
        participants,
        participantsData,
        lastMessage: '',
        lastMessageTime: Timestamp.now(),
        unreadCount: participants.reduce((acc, participantId) => ({ ...acc, [participantId]: 0 }), {}),
        createdAt: Timestamp.now(),
      });

      const newConversation: Conversation = {
        id: newConversationRef.id,
        type: 'team',
        teamId: team.id || teamId,
        teamName: team.nome || team.name,
        teamPhotoURL: team.photoURL || '',
        participants,
        participantsData,
        lastMessage: '',
        lastMessageTime: Timestamp.now(),
        unreadCount: participants.reduce((acc, participantId) => ({ ...acc, [participantId]: 0 }), {}),
        createdAt: Timestamp.now(),
      };

      setTeamConversation(newConversation);
      return newConversationRef.id;
    } catch (error) {
      console.error('Errore creazione chat team:', error);
      return null;
    }
  };

  const loadMessages = (conversationId: string) => {
    const messagesRef = collection(db, 'messages');
    const messagesQuery = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      
      setMessages(messagesList);
      
      // Scroll automatico verso il basso
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    });

    // Cleanup function
    return unsubscribe;
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || sending) return;

    setSending(true);

    try {
      let conversationId: string | null = teamConversation?.id || null;

      // Se non esiste una conversazione, creala
      if (!conversationId) {
        conversationId = await createTeamChat();
        if (!conversationId) {
          throw new Error('Impossibile creare la chat');
        }
      }

      // Crea il messaggio
      await addDoc(collection(db, 'messages'), {
        conversationId,
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Anonimo',
        senderPhotoURL: user.photoURL,
        content: messageText.trim(),
        read: false,
        createdAt: Timestamp.now(),
      });

      // Aggiorna la conversazione con l'ultimo messaggio
      if (conversationId) {
        await updateDoc(doc(db, 'conversations', conversationId), {
          lastMessage: messageText.trim(),
          lastMessageTime: Timestamp.now(),
          // TODO: Aggiorna unreadCount per gli altri partecipanti
        });
      }

      setMessageText('');
    } catch (error) {
      console.error('Errore invio messaggio:', error);
      showToast('Errore durante l\'invio del messaggio', 'error');
    } finally {
      setSending(false);
    }
  };

  // Funzioni per editing inline
  const startEditing = (field: string, currentValue: string | any[]) => {
    setEditingField(field);
    if (field === 'positions') {
      setEditingPositions(Array.isArray(currentValue) ? currentValue : []);
    } else {
      setEditingValue(typeof currentValue === 'string' ? currentValue : '');
    }
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditingValue('');
    setEditingPositions([]);
  };

  const saveField = async (field: string) => {
    if (!team || saving) return;

    setSaving(true);
    try {
      let updateData: any = {};
      
      if (field === 'name') {
        updateData.name = editingValue;
      } else if (field === 'description') {
        updateData.description = editingValue;
      } else if (field === 'positions') {
        updateData.ruoliCercati = editingPositions;
      }

      await updateDoc(doc(db, 'teams', teamId), updateData);
      
      // Aggiorna il team locale
      setTeam(prev => prev ? { ...prev, ...updateData } : prev);
      
      // Reset editing state
      cancelEditing();
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      showToast('Errore nel salvataggio', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Funzioni per gestire le posizioni
  const updatePosition = (index: number, field: string, value: string | number) => {
    setEditingPositions(prev => prev.map((pos, i) => 
      i === index ? { ...pos, [field]: value } : pos
    ));
  };

  const removePosition = async (index: number) => {
    const position = editingPositions[index];
    if (position.occupati > 0) {
      showToast('Non puoi rimuovere una posizione che ha membri assegnati!', 'warning');
      return;
    }
    const confirmed = await showConfirm({
      title: 'Rimuovi posizione',
      message: `Sei sicuro di voler rimuovere la posizione per ${position.specializzazione}?`,
      variant: 'warning',
      confirmText: 'Rimuovi'
    });
    if (confirmed) {
      setEditingPositions(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Load team chat when component mounts and user/team changes
  useEffect(() => {
    if (team && user && isMember) {
      loadTeamChat();
    }
  }, [team, user, isMember]);

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

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link to="/teams" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna alle Equipé
        </Link>

        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex gap-6 flex-1">
                {team.photoURL ? (
                  <img 
                    src={team.photoURL} 
                    alt={`Foto ${team.name}`}
                    className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-12 h-12 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {/* Nome del team - editabile per admin */}
                  {isAdmin && editingField === 'name' ? (
                    <div className="mb-3">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="text-4xl font-bold text-gray-900 bg-white border border-blue-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveField('name');
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveField('name')}
                          disabled={saving}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? '...' : '✓'}
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-4xl font-bold text-gray-900">{team.name}</h2>
                      {isAdmin && (
                        <button
                          onClick={() => startEditing('name', team.name || '')}
                          className="p-1 text-gray-400 hover:text-blue-600 transition bg-gray-100 rounded"
                          title="Clicca per modificare"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Descrizione del team - editabile per admin */}
                  {isAdmin && editingField === 'description' ? (
                    <div>
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="text-gray-600 text-lg bg-white border border-blue-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none"
                        rows={3}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) saveField('description');
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveField('description')}
                          disabled={saving}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? '...' : '✓'}
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Ctrl+Enter per salvare, Esc per annullare</p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 text-lg flex-1">{team.description}</p>
                      {isAdmin && (
                        <button
                          onClick={() => startEditing('description', team.description || '')}
                          className="p-1 text-gray-400 hover:text-blue-600 transition mt-1 bg-gray-100 rounded"
                          title="Clicca per modificare"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-4 py-2 rounded-lg font-medium ${
                  team.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {team.status === 'active' ? '✓ Attivo' : 'Inattivo'}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-gray-700">Specializzazioni del team</span>
          
              </div>

              <div className="flex flex-wrap gap-2">
                {(() => {
                  // Raccogli tutte le specializzazioni dei membri
                  const allSpecializations = members.flatMap(member => 
                    member.profile.specializzazioni || []
                  );
                  
                  // Rimuovi duplicati
                  const uniqueSpecializations = [...new Set(allSpecializations)];
                  
                  // Converti da professionista a disciplina
                  const disciplines = uniqueSpecializations.map(spec => {
                    const professionistToDiscipine: Record<string, string> = {
                      'Psicologo': 'Psicologia',
                      'Psicoterapeuta': 'Psicoterapia',
                      'Psichiatra': 'Psichiatria',
                      'Nutrizionista': 'Nutrizione',
                      'Dietologo': 'Dietetica',
                      'Logopedista': 'Logopedia'
                    };
                    return professionistToDiscipine[spec] || spec;
                  }).filter((disc, index, arr) => arr.indexOf(disc) === index); // Rimuovi duplicati anche dopo conversione
                  
                  return disciplines.length > 0 ? (
                    disciplines.map((disc) => (
                      <span key={disc} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
                        {disc}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm italic">
                      Nessuna specializzazione (aggiungi membri al team)
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Sezione Composizione Equipé */}
        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900">Composizione Equipé</h3>
            <p className="text-sm text-gray-600 mt-1">Membri attuali del team</p>
          </div>
          <div className="p-6">
            {members.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.map((member) => {
                  const memberInfo = team.members.find(m => m.userId === member.uid);
                  const isCurrentUser = member.uid === user?.uid;

                  return (
                    <div key={member.uid} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/30 transition">
                      <div className="flex items-start gap-3">
                        {member.profile.photoURL ? (
                          <img 
                            src={member.profile.photoURL} 
                            alt={member.profile.nome} 
                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-300 flex-shrink-0"
                            style={{ aspectRatio: '1/1' }}
                          />
                        ) : (
                          <div 
                            className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                            style={{ aspectRatio: '1/1' }}
                          >
                            {member.profile.nome.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-base text-gray-900">{member.profile.nome}</h4>
                            {memberInfo?.role === 'admin' && (
                              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">
                                ADMIN
                              </span>
                            )}
                            {isCurrentUser && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                TU
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {member.profile.specializzazioni.map((spec) => (
                              <span key={spec} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">
                                {spec}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {member.profile.location.città}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Nessun membro ancora presente</p>
              </div>
            )}
          </div>
        </div>

        {/* Sezione Posizioni Aperte - sempre visibile per admin */}
        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden border-2 border-amber-200">
          <div className="px-8 py-6 border-b border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Posizioni Aperte
                </h3>
                {isAdmin && editingField !== 'positions' && (
                  <button
                    onClick={() => startEditing('positions', team.ruoliCercati || [])}
                    className="p-1 text-gray-400 hover:text-blue-600 transition bg-gray-100 rounded"
                    title="Clicca per modificare"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-1">Posizioni ricercate per questo team</p>
          </div>

          <div className="p-6 bg-gradient-to-br from-amber-50/30 to-white">
            {/* Editor posizioni per admin */}
            {isAdmin && editingField === 'positions' ? (
              <div className="space-y-6">
                {/* Posizioni esistenti */}
                {editingPositions.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Posizioni attuali</h4>
                    <div className="space-y-3">
                      {editingPositions.map((pos, index) => {
                        const postiLiberi = pos.numero - pos.occupati;
                        const isCompleto = pos.occupati >= pos.numero;
                        const canRemove = pos.occupati === 0; // Solo se non ci sono membri assegnati
                        
                        return (
                          <div key={index} className={`p-4 rounded-lg border-2 ${
                            isCompleto ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h5 className="font-bold text-lg">{pos.specializzazione}</h5>
                                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                    isCompleto 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {isCompleto ? 'COMPLETO' : `${postiLiberi} POSTO${postiLiberi !== 1 ? 'I' : ''} APERTO${postiLiberi !== 1 ? 'I' : ''}`}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>Membri assegnati: <strong>{pos.occupati}</strong></span>
                                  <span>Posti totali: <strong>{pos.numero}</strong></span>
                                </div>
                                
                                {/* Barra di progresso */}
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all ${
                                      isCompleto ? 'bg-green-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${(pos.occupati / pos.numero) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 ml-4">
                                {!isCompleto && (
                                  <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium">Posti totali:</label>
                                    <input
                                      type="number"
                                      min={pos.occupati} // Non può essere meno dei posti già occupati
                                      max="10"
                                      value={pos.numero}
                                      onChange={(e) => updatePosition(index, 'numero', parseInt(e.target.value) || pos.occupati)}
                                      className="w-16 border border-gray-300 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                )}
                                
                                {canRemove && (
                                  <button
                                    onClick={() => removePosition(index)}
                                    className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
                                    title="Rimuovi posizione (solo se nessun membro assegnato)"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sezione per aggiungere nuove posizioni */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Aggiungi nuove posizioni</h4>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Specializzazione cercata</label>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const existingIndex = editingPositions.findIndex(p => p.specializzazione === e.target.value);
                              if (existingIndex >= 0) {
                                showToast('Questa specializzazione è già presente. Modifica quella esistente.', 'warning');
                                return;
                              }
                              setEditingPositions(prev => [...prev, { 
                                specializzazione: e.target.value, 
                                numero: 1, 
                                occupati: 0 
                              }]);
                            }
                          }}
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">+ Seleziona specializzazione</option>
                          {specializzazioni
                            .filter(spec => !editingPositions.some(p => p.specializzazione === spec))
                            .map(spec => (
                              <option key={spec} value={spec}>{spec}</option>
                          ))}
                        </select>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Seleziona una specializzazione dal menu per aggiungere una nuova posizione aperta.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => saveField('positions')}
                    disabled={saving}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {saving ? 'Salvataggio...' : 'Salva Modifiche'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              /* Vista normale posizioni */
              <>
                {team.ruoliCercati && team.ruoliCercati.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {team.ruoliCercati.map((ruolo, index) => {
                      const postiLiberi = ruolo.numero - ruolo.occupati;
                      const percentualeOccupazione = (ruolo.occupati / ruolo.numero) * 100;
                      const isCompleto = postiLiberi === 0;
                      
                      return (
                        <div key={index} className={`border-2 rounded-lg p-5 hover:shadow-lg transition ${
                          isCompleto 
                            ? 'border-green-300 bg-green-50 hover:border-green-400' 
                            : 'border-amber-300 bg-white hover:border-amber-400'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-bold text-lg text-gray-900 mb-1">{ruolo.specializzazione}</h4>
                              <p className="text-sm text-gray-600">{ruolo.descrizione}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ml-2 ${
                              isCompleto
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {postiLiberi > 0 ? `${postiLiberi} ${postiLiberi === 1 ? 'POSTO' : 'POSTI'}` : 'COMPLETO'}
                            </span>
                          </div>
                          <div className="bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                isCompleto ? 'bg-green-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${percentualeOccupazione}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-600">
                            {ruolo.occupati} / {ruolo.numero} posizioni occupate
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nessuna posizione aperta al momento</p>
                    {isAdmin && (
                      <p className="text-sm mt-2">Clicca l'icona di modifica per aggiungere posizioni</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Badge equipé completa */}
        {team.ruoliCercati && team.ruoliCercati.every(r => r.occupati >= r.numero) && team.ruoliCercati.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl shadow-sm mb-6 overflow-hidden">
            <div className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-3">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-green-900 mb-2">Equipé al Completo!</h3>
              <p className="text-green-700">Tutte le posizioni sono state ricoperte</p>
            </div>
          </div>
        )}

        {/* Sezione Richieste di Adesione (solo per admin) */}
        {isAdmin && pendingRequests.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Richieste di Adesione
                <span className="ml-2 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {pendingRequests.length}
                </span>
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {pendingRequests.map((request: any) => (
                <div key={request.id} className="border border-orange-200 rounded-xl p-5 bg-orange-50/30">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {request.userData?.profile?.nome?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg text-gray-900 mb-1">
                          {request.userData?.profile?.nome || request.userName || 'Utente'}
                        </h4>
                        {request.userData?.profile?.specializzazioni && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {request.userData.profile.specializzazioni.map((spec: string) => (
                              <span key={spec} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Messaggio:</strong>
                        </p>
                        <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                          "{request.message}"
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          Richiesta inviata il {new Date(request.createdAt?.toDate()).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleAcceptRequest(request.id, request.userId)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Accetta
                    </button>
                    <button
                      onClick={() => handleRejectRequest(request.id)}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Rifiuta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sezione Zona Operativa */}
        {team.coordinate && team.indirizzo && (
          <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Zona Operativa
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-1">📍 {team.indirizzo}</p>
                    <p className="text-sm text-gray-600">
                      Raggio di copertura: <span className="font-bold text-blue-600">{team.raggioKm} km</span>
                      {' • '}
                      Area coperta: circa <span className="font-bold">{(Math.PI * (team.raggioKm || 0) * (team.raggioKm || 0)).toFixed(1)} km²</span>
                    </p>
                    {team.remoto && (
                      <p className="text-sm text-green-600 font-medium mt-1">
                        ✓ Disponibile anche per lavoro da remoto
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <MapSelector
                  coordinate={team.coordinate}
                  raggioKm={team.raggioKm || 10}
                  indirizzo={team.indirizzo}
                  onCoordinateChange={() => {}}
                  onIndirizzoChange={() => {}}
                  onRaggioChange={() => {}}
                />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-2xl font-bold text-gray-900">Membri ({members.length})</h3>
            {isAdmin && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-5 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition shadow-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invita Membri
              </button>
            )}
          </div>
          <div className="p-6 space-y-4">
            {members.map((member) => {
              const memberInfo = team.members.find(m => m.userId === member.uid);
              const isCurrentUser = member.uid === user?.uid;

              return (
                <div key={member.uid} className="flex items-start justify-between p-5 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition">
                  <div className="flex gap-4 flex-1">
                    {member.profile.photoURL ? (
                      <img 
                        src={member.profile.photoURL} 
                        alt={member.profile.nome} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-300 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {member.profile.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-lg text-gray-900">{member.profile.nome}</h4>
                        {memberInfo?.role === 'admin' && (
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-xs font-bold">
                            ADMIN
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold">
                            TU
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{member.email}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {member.profile.specializzazioni.map((spec) => (
                          <span key={spec} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-lg font-medium">
                            {spec}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {member.profile.location.città}
                        </span>
                        <span>•</span>
                        <span>{member.profile.esperienza}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!isCurrentUser && (
                      <button
                        onClick={() => navigate(`/messages?userId=${member.uid}`)}
                        className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition flex items-center gap-2"
                        title="Invia messaggio"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                    )}
                    {isAdmin && !isCurrentUser && (
                      <button
                        onClick={() => handleRemoveMember(member.uid)}
                        className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pulsanti azioni per non membri */}
        {!isMember && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <button
              onClick={() => setShowRequestModal(true)}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition shadow-sm flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Fai Richiesta per Aderire
            </button>
          </div>
        )}

        {/* Pulsante lascia équipe per membri non admin */}
        {isMember && !isAdmin && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <button
              onClick={handleLeaveTeam}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-sm flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Lascia Equipé
            </button>
          </div>
        )}

        {/* Modal Richiesta Adesione */}
        {showRequestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" style={{ zIndex: 10000 }}>
              <div className="px-8 py-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900">Richiesta di Adesione</h3>
                <p className="text-sm text-gray-600 mt-1">Invia una richiesta per entrare nell'équipe</p>
              </div>
              
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Messaggio per l'amministratore *
                  </label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Presentati brevemente e spiega perché vorresti far parte di questa équipe..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows={6}
                  />
                </div>
              </div>

              <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setRequestMessage('');
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition"
                >
                  Annulla
                </button>
                <button
                  onClick={handleJoinRequest}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
                >
                  Invia Richiesta
                </button>
              </div>
            </div>
          </div>
        )}

        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900">Invita Nuovi Membri</h3>
                <p className="text-sm text-gray-600 mt-1">Seleziona i professionisti da invitare al team</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {availableUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-600 font-medium">Tutti i professionisti sono già membri</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableUsers.map((user) => (
                      <label key={user.uid} className="flex items-start p-4 hover:bg-blue-50 rounded-xl cursor-pointer border-2 border-gray-200 hover:border-blue-300 transition">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.uid)}
                          onChange={() => toggleUserSelection(user.uid)}
                          className="mr-4 mt-1.5 w-5 h-5 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-gray-900">{user.profile.nome}</div>
                          <div className="text-sm text-gray-600 mb-2">{user.email}</div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {user.profile.specializzazioni.map(spec => (
                              <span key={spec} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                                {spec}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {user.profile.location.città}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-8 py-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={handleInviteMembers}
                  disabled={selectedUsers.length === 0}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm"
                >
                  Invita {selectedUsers.length > 0 && `(${selectedUsers.length})`}
                </button>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setSelectedUsers([]);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sezione Chat Equipé - Solo per membri */}
        {isMember && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="px-4 sm:px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat di Gruppo
                </h3>
                <p className="text-sm text-gray-600 mt-1">Comunica con tutti i membri dell'equipé</p>
              </div>
              <button
                onClick={() => setShowChat(!showChat)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
              >
                {showChat ? 'Nascondi Chat' : 'Apri Chat'}
              </button>
            </div>
          </div>

          {showChat && (
            <div className="border-t border-gray-200">
              {/* Area Messaggi */}
              <div 
                ref={messagesEndRef}
                className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50"
              >
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="mb-2">Messaggio</p>
                    <p>Nessun messaggio ancora. Inizia la conversazione!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="bg-white rounded-lg p-3 shadow-sm border">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {message.senderPhotoURL ? (
                            <img
                              src={message.senderPhotoURL}
                              alt={message.senderName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                              {message.senderName?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 text-sm">
                              {message.senderName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {message.createdAt?.toDate().toLocaleString()}
                            </span>
                          </div>
                          <p className="text-gray-700 text-sm break-words">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Area Input Messaggio */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Scrivi un messaggio..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm"
                  >
                    {sending ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Sezione Azioni Admin */}
        {isAdmin && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="px-8 py-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Gestione Equipé</h3>
              <p className="text-sm text-gray-600 mt-1">Azioni riservate all'amministratore</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Lascia Equipé */}
              <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">Lascia Equipé</h4>
                    <p className="text-sm text-gray-600">
                      Esci dall'equipé. {team.members.length > 1 ? 'Il ruolo di admin passerà al prossimo membro.' : 'Essendo l\'unico membro, l\'equipé verrà eliminata.'}
                    </p>
                  </div>
                  <button
                    onClick={handleLeaveTeam}
                    className="ml-4 px-5 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition shadow-sm whitespace-nowrap"
                  >
                    Lascia Equipé
                  </button>
                </div>
              </div>

              {/* Elimina Equipé */}
              <div className="border border-red-300 rounded-lg p-4 bg-red-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-red-900 mb-1">Elimina Equipé</h4>
                    <p className="text-sm text-red-700">
                      Elimina definitivamente questa equipé. Questa azione è irreversibile e rimuoverà tutti i dati associati.
                    </p>
                  </div>
                  <button
                    onClick={handleDeleteTeam}
                    className="ml-4 px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-sm whitespace-nowrap"
                  >
                    Elimina Equipé
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
