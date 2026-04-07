import { useModal } from '@/contexts/ModalContext';
import { useAuth } from '@/contexts/AuthContext';
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
import { useCanInteract } from '@/hooks/useCanInteract';

export default function TeamDetailPage() {
  const { user, userProfile } = useAuth();
  const { canInteract, message: canInteractMessage } = useCanInteract();
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
  const [inviteSearch, setInviteSearch] = useState('');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [teamConversation, setTeamConversation] = useState<Conversation | null>(null);

  // Stati per editing inline
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [editingPositions, setEditingPositions] = useState<any[]>([]);
  const [editingLocation, setEditingLocation] = useState<{ coordinate: { lat: number; lng: number } | null; indirizzo: string; raggioKm: number }>({ coordinate: null, indirizzo: '', raggioKm: 10 });
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
        
        // Filtra utenti non già membri E solo quelli approvati
        const available = allUsers.filter(u => 
          !teamData.memberIds?.includes(u.uid) &&
          u.profile?.verificationInfo?.status === 'approved'
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

      // Carica o crea chat di equipe
      await loadTeamChat();
    } catch (error) {
      console.error('Errore caricamento team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const confirmed = await showConfirm({ title: 'Rimuovi membro', message: 'Sei sicuro di voler rimuovere questo membro?', variant: 'danger', confirmText: 'Rimuovi' }); if (!confirmed) return;

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
      const confirmed = await showConfirm({ title: 'Lascia equipe', message: 'Sei sicuro di voler lasciare questa equipe?', variant: 'warning', confirmText: 'Lascia' }); if (!confirmed) return;

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
            await notifyTeamMemberLeft(adminIds, userName, teamId, team.name, user.uid);
          }
        }

        navigate('/teams');
      } catch (error) {
        console.error('Errore uscita dal team:', error);
        showToast('Errore durante l\'uscita dal team', 'error');
      }
    } else {
      // Admin lascia il team - passa admin al secondo membro
      const confirmed = await showConfirm({ title: 'Lascia equipe', message: 'Sei sicuro di voler lasciare questa equipe? Il ruolo di admin passerà al prossimo membro.', variant: 'warning', confirmText: 'Lascia' }); if (!confirmed) return;

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

            showToast(`${otherMembers[0].userId} è ora l'admin dell'equipe`, 'info');
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
    const confirmed1 = await showConfirm({ title: 'Elimina equipe', message: 'ATTENZIONE: Sei sicuro di voler eliminare definitivamente questa equipe? Questa azione non può essere annullata.', variant: 'danger', confirmText: 'Elimina' }); if (!confirmed1) return;
    
    // Doppia conferma per sicurezza
    const confirmed2 = await showConfirm({ title: 'Conferma eliminazione', message: 'Confermi l\'eliminazione? Tutti i dati del team saranno persi.', variant: 'danger', confirmText: 'Conferma eliminazione' }); if (!confirmed2) return;

    try {
      // Elimina la conversazione di gruppo e i suoi messaggi
      const convQuery = query(
        collection(db, 'conversations'),
        where('teamId', '==', teamId),
        where('type', '==', 'team')
      );
      const convSnapshot = await getDocs(convQuery);
      for (const convDoc of convSnapshot.docs) {
        // Elimina tutti i messaggi della conversazione
        const messagesQuery = query(
          collection(db, 'messages'),
          where('conversationId', '==', convDoc.id)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        await Promise.all(messagesSnapshot.docs.map(msgDoc => deleteDoc(msgDoc.ref)));
        // Elimina la conversazione
        await deleteDoc(convDoc.ref);
      }

      // Elimina gli inviti correlati
      const invitesQuery = query(collection(db, 'teamInvites'), where('teamId', '==', teamId));
      const invitesSnapshot = await getDocs(invitesQuery);
      await Promise.all(invitesSnapshot.docs.map(invDoc => deleteDoc(invDoc.ref)));

      // Elimina il team
      await deleteDoc(doc(db, 'teams', teamId));

      showToast('equipe eliminata con successo', 'success');
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
          await notifyTeamInviteReceived(userId, teamId, team.name, senderName, inviteRef.id, user.uid);
        }
      });

      await Promise.all(invitePromises);

      setShowInviteModal(false);
      setSelectedUsers([]);
      setInviteSearch('');
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
      showToast('Richiesta accettata! Il membro è stato aggiunto all\'equipe.', 'success');
    } catch (error) {
      console.error('Errore accettazione richiesta:', error);
      showToast('Errore durante l\'accettazione della richiesta', 'error');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const confirmed = await showConfirm({ title: 'Rifiuta richiesta', message: 'Sei sicuro di voler rifiutare questa richiesta?', variant: 'warning', confirmText: 'Rifiuta' }); if (!confirmed) return;

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
        
        // Assicurati che l'utente corrente sia nei participants
        if (!conversationData.participants?.includes(user.uid)) {
          const updatedParticipants = [...(conversationData.participants || []), user.uid];
          await updateDoc(doc(db, 'conversations', conversationDoc.id), {
            participants: updatedParticipants
          });
          conversationData.participants = updatedParticipants;
        }
        
        setTeamConversation(conversationData);
      } else {
        // Nessuna conversazione trovata - sarà creata quando l'utente aprirà la chat
        setTeamConversation(null);
      }
    } catch (error) {
      console.error('Errore caricamento chat team:', error);
    }
  };

  const createTeamChat = async (): Promise<string | null> => {
    if (!team || !user) return null;

    try {
      // Controlla prima se esiste già (potrebbe essere stata creata nel frattempo)
      const existingQuery = query(
        collection(db, 'conversations'),
        where('type', '==', 'team'),
        where('teamId', '==', team.id || teamId)
      );
      const existingSnapshot = await getDocs(existingQuery);
      if (!existingSnapshot.empty) {
        const existingConv = existingSnapshot.docs[0];
        // Assicurati che l'utente corrente sia nei participants
        const existingData = existingConv.data();
        const currentParticipants: string[] = existingData.participants || [];
        if (!currentParticipants.includes(user.uid)) {
          await updateDoc(doc(db, 'conversations', existingConv.id), {
            participants: [...currentParticipants, user.uid]
          });
        }
        return existingConv.id;
      }

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

      // Assicurati che l'utente corrente sia sempre incluso
      if (!participants.includes(user.uid)) {
        participants.push(user.uid);
        participantsData[user.uid] = {
          name: userProfile?.profile?.nome || user.displayName || 'Tu',
          photoURL: userProfile?.profile?.photoURL || user.photoURL || ''
        };
      }

      // Aggiungi anche i memberIds del team se presenti e non già inclusi
      const teamMemberIds = team.memberIds || [];
      for (const mid of teamMemberIds) {
        if (!participants.includes(mid)) {
          participants.push(mid);
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

  // Funzione per aprire la chat del team nella pagina Messaggi
  const handleOpenTeamChat = async () => {
    if (!team || !user) return;

    try {
      let conversationId = teamConversation?.id;

      // Se non esiste ancora una conversazione, creala
      if (!conversationId) {
        conversationId = await createTeamChat();
        if (!conversationId) {
          showToast('Errore durante la creazione della chat', 'error');
          return;
        }
      }

      // Naviga alla pagina messaggi con la conversazione selezionata
      navigate(`/messages?conversation=${conversationId}`);
    } catch (error) {
      console.error('Errore apertura chat team:', error);
      showToast('Errore durante l\'apertura della chat', 'error');
    }
  };

  // Funzioni per editing inline
  const startEditing = (field: string, currentValue: string | any[]) => {
    setEditingField(field);
    if (field === 'positions') {
      setEditingPositions(Array.isArray(currentValue) ? currentValue : []);
    } else if (field === 'location') {
      setEditingLocation({
        coordinate: team?.coordinate || null,
        indirizzo: team?.indirizzo || '',
        raggioKm: team?.raggioKm || 10,
      });
    } else {
      setEditingValue(typeof currentValue === 'string' ? currentValue : '');
    }
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditingValue('');
    setEditingPositions([]);
    setEditingLocation({ coordinate: null, indirizzo: '', raggioKm: 10 });
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
      } else if (field === 'location') {
        if (editingLocation.coordinate) updateData.coordinate = editingLocation.coordinate;
        if (editingLocation.indirizzo) updateData.indirizzo = editingLocation.indirizzo;
        updateData.raggioKm = editingLocation.raggioKm;
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
    const confirmed = await showConfirm({ title: 'Rimuovi posizione', message: `Sei sicuro di voler rimuovere la posizione per ${position.specializzazione}?`, variant: 'warning', confirmText: 'Rimuovi' });
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-24 sm:pb-10">
        {/* Back navigation */}
        <Link to="/teams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 font-medium transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tutte le equipe
        </Link>

        {/* ===== HERO CARD ===== */}
        <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              {/* Avatar */}
              {team.photoURL ? (
                <img src={team.photoURL} alt={team.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 shadow" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                {/* Nome – editabile admin */}
                {isAdmin && editingField === 'name' ? (
                  <div className="mb-3">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="text-2xl sm:text-3xl font-bold text-gray-900 bg-white border border-amber-400 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter') saveField('name'); if (e.key === 'Escape') cancelEditing(); }}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => saveField('name')} disabled={saving} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">{saving ? '...' : 'Salva'}</button>
                      <button onClick={cancelEditing} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">Annulla</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{team.name}</h1>
                    {isAdmin && (
                      <button onClick={() => startEditing('name', team.name || '')} className="p-1 text-gray-400 hover:text-amber-500 transition rounded" title="Modifica nome">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    )}
                  </div>
                )}
                {/* Descrizione – editabile admin */}
                {isAdmin && editingField === 'description' ? (
                  <div className="mb-4">
                    <textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="text-gray-600 bg-white border border-amber-400 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 w-full resize-none"
                      rows={3}
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) saveField('description'); if (e.key === 'Escape') cancelEditing(); }}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => saveField('description')} disabled={saving} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">{saving ? '...' : 'Salva'}</button>
                      <button onClick={cancelEditing} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">Annulla</button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Ctrl+Enter per salvare, Esc per annullare</p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 mb-4">
                    <p className="text-gray-600 flex-1">{team.description || <span className="italic text-gray-400">Nessuna descrizione</span>}</p>
                    {isAdmin && (
                      <button onClick={() => startEditing('description', team.description || '')} className="p-1 text-gray-400 hover:text-amber-500 transition rounded flex-shrink-0 mt-0.5" title="Modifica descrizione">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    )}
                  </div>
                )}
                {/* Stats */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    {members.length} {members.length === 1 ? 'membro' : 'membri'}
                  </span>
                  {team.ruoliCercati && team.ruoliCercati.length > 0 && (() => {
                    const aperte = team.ruoliCercati.filter(r => (r.numero - (r.occupati || 0)) > 0).length;
                    return aperte > 0 ? (
                      <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {aperte} {aperte === 1 ? 'posizione aperta' : 'posizioni aperte'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-green-600 font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Equipe al completo
                      </span>
                    );
                  })()}
                  {team.indirizzo && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                      {team.indirizzo}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Specializzazioni del team */}
            {(() => {
              const allSpec = members.flatMap(m => m.profile?.specializzazioni || []);
              const profMap: Record<string, string> = { 'Psicologo': 'Psicologia', 'Psicoterapeuta': 'Psicoterapia', 'Psichiatra': 'Psichiatria', 'Nutrizionista': 'Nutrizione', 'Dietologo': 'Dietetica', 'Logopedista': 'Logopedia', 'Neuropsicomotricista': 'Neuropsicomotricità' };
              const discs = [...new Set(allSpec.map(s => profMap[s] || s))];
              return discs.length > 0 ? (
                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                  {discs.map(d => (
                    <span key={d} className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-sm font-medium">{d}</span>
                  ))}
                </div>
              ) : null;
            })()}
            {/* Azioni */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-2.5">
              {isMember && (
                <button onClick={handleOpenTeamChat} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Chat di gruppo
                </button>
              )}
              {!isMember && canInteract && (
                <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  Richiedi di aderire
                </button>
              )}
              {!isMember && !canInteract && (
                <div className="relative group">
                  <button disabled className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed opacity-70">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Richiedi di aderire
                  </button>
                  <div className="hidden group-hover:block absolute z-10 w-64 p-2 mt-2 text-xs bg-gray-800 text-white rounded-lg shadow-lg left-0">{canInteractMessage}</div>
                </div>
              )}
              {isMember && !isAdmin && (
                <button onClick={handleLeaveTeam} className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 hover:border-red-300 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Lascia equipe
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ===== LAYOUT A DUE COLONNE SU DESKTOP ===== */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">

        {/* === COLONNA PRINCIPALE (2/3) === */}
        <div className="lg:col-span-2 space-y-6">

        {/* ===== RICHIESTE DI ADESIONE (admin) ===== */}
        {isAdmin && pendingRequests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-orange-100 bg-orange-50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Richieste di adesione</h3>
                <p className="text-xs text-gray-500">{pendingRequests.length} {pendingRequests.length === 1 ? 'richiesta in attesa' : 'richieste in attesa'}</p>
              </div>
              <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingRequests.map((request: any) => (
                <div key={request.id} className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-base flex-shrink-0">
                      {request.userData?.profile?.nome?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm">{request.userData?.profile?.nome || request.userName || 'Utente'}</h4>
                          {request.userData?.profile?.specializzazioni && (
                            <div className="flex flex-wrap gap-1 mt-1 mb-2">
                              {request.userData.profile.specializzazioni.map((spec: string) => (
                                <span key={spec} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{spec}</span>
                              ))}
                            </div>
                          )}
                          <blockquote className="text-sm text-gray-600 bg-gray-50 border-l-2 border-gray-300 pl-3 py-1.5 rounded-r-lg mb-2 italic">"{request.message}"</blockquote>
                          <p className="text-xs text-gray-400">{new Date(request.createdAt?.toDate()).toLocaleDateString('it-IT')}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => handleAcceptRequest(request.id, request.userId)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">Accetta</button>
                          <button onClick={() => handleRejectRequest(request.id)} className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition">Rifiuta</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== MEMBRI ===== */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Membri</h2>
            <p className="text-xs text-gray-500 mt-0.5">{members.length} {members.length === 1 ? 'professionista' : 'professionisti'}</p>
          </div>
          <div className="p-5">
            {members.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {members.map((member) => {
                  const memberInfo = team.members.find(m => m.userId === member.uid);
                  const isCurrentUser = member.uid === user?.uid;
                  return (
                    <div key={member.uid} className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition group">
                      {member.profile.photoURL ? (
                        <img src={member.profile.photoURL} alt={member.profile.nome} className="w-11 h-11 rounded-full object-cover border-2 border-gray-100 flex-shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                          {member.profile.nome.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="font-semibold text-gray-900 text-sm">{member.profile.nome}</span>
                          {memberInfo?.role === 'admin' && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-bold">Admin</span>}
                          {isCurrentUser && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-bold">Tu</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {(member.profile.specializzazioni || []).map((spec) => (
                            <span key={spec} className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">{spec}</span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                          {member.profile.location.città}
                        </p>
                      </div>
                      {isAdmin && !isCurrentUser && (
                        <button onClick={() => handleRemoveMember(member.uid)} className="opacity-0 group-hover:opacity-100 transition p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0" title="Rimuovi membro">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                <p className="text-sm text-gray-400">Nessun membro ancora presente</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== POSIZIONI APERTE ===== */}
        {(isAdmin || (team.ruoliCercati && team.ruoliCercati.length > 0)) && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Posizioni aperte</h2>
                <p className="text-xs text-gray-500 mt-0.5">Professionisti cercati per il team</p>
              </div>
              {isAdmin && editingField !== 'positions' && (
                <button onClick={() => startEditing('positions', team.ruoliCercati || [])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Modifica
                </button>
              )}
            </div>
            <div className="p-5">
              {isAdmin && editingField === 'positions' ? (
                <div className="space-y-5">
                  {editingPositions.length > 0 && (
                    <div className="space-y-3">
                      {editingPositions.map((pos, index) => {
                        const occupati = pos.occupati || 0;
                        const postiLiberi = pos.numero - occupati;
                        const isCompleto = postiLiberi === 0;
                        return (
                          <div key={index} className={`rounded-xl p-4 border-2 ${isCompleto ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-gray-900 text-sm">{pos.specializzazione}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isCompleto ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {isCompleto ? 'Completo' : `${postiLiberi} ${postiLiberi === 1 ? 'posto' : 'posti'} liberi`}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div className={`h-1.5 rounded-full ${isCompleto ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${(occupati / pos.numero) * 100}%` }} />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{occupati} / {pos.numero} occupati</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {!isCompleto && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-600">Posti:</span>
                                    <input type="number" min={occupati} max="10" value={pos.numero} onChange={(e) => updatePosition(index, 'numero', parseInt(e.target.value) || occupati)} className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                  </div>
                                )}
                                {occupati === 0 && (
                                  <button onClick={() => removePosition(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Rimuovi">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Aggiungi specializzazione</p>
                    <select
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        if (editingPositions.some(p => p.specializzazione === e.target.value)) { showToast('Questa specializzazione è già presente', 'warning'); return; }
                        setEditingPositions(prev => [...prev, { specializzazione: e.target.value, numero: 1, occupati: 0 }]);
                      }}
                      className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">+ Seleziona specializzazione</option>
                      {specializzazioni.filter(spec => !editingPositions.some(p => p.specializzazione === spec)).map(spec => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => saveField('positions')} disabled={saving} className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">{saving ? 'Salvataggio...' : 'Salva modifiche'}</button>
                    <button onClick={cancelEditing} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">Annulla</button>
                  </div>
                </div>
              ) : team.ruoliCercati && team.ruoliCercati.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {team.ruoliCercati.map((ruolo, index) => {
                    const occupati = ruolo.occupati || 0;
                    const postiLiberi = ruolo.numero - occupati;
                    const isCompleto = postiLiberi === 0;
                    return (
                      <div key={index} className={`rounded-xl p-4 border ${isCompleto ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white hover:border-amber-200 hover:bg-amber-50/30'} transition`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 text-sm">{ruolo.specializzazione}</h4>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCompleto ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-600'}`}>
                            {isCompleto ? 'Completo' : `${postiLiberi} ${postiLiberi === 1 ? 'posto' : 'posti'}`}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${isCompleto ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${(occupati / ruolo.numero) * 100}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">{occupati} / {ruolo.numero} occupati</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">Nessuna posizione aperta al momento</p>
                  {isAdmin && <p className="text-xs text-gray-400 mt-1">Clicca "Modifica" per aggiungerne</p>}
                </div>
              )}
            </div>
          </div>
        )}

        </div>{/* fine colonna principale */}

        {/* === SIDEBAR (1/3) === */}
        <div className="lg:col-span-1 space-y-6 mt-6 lg:mt-0">

        {/* ===== INVITA PROFESSIONISTI (admin) ===== */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Invita professionisti</h2>
              <p className="text-xs text-gray-500 mt-0.5">Cerca e invita professionisti verificati nell'equipe</p>
            </div>
            <div className="p-5">
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedUsers.map(uid => {
                    const usr = availableUsers.find(u => u.uid === uid);
                    return (
                      <span key={uid} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 text-sm px-3 py-1 rounded-full">
                        {usr?.profile?.nome || uid}
                        <button type="button" onClick={() => toggleUserSelection(uid)} className="text-blue-500 hover:text-blue-800 font-bold leading-none">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="Cerca per nome o specializzazione..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
              {inviteSearch.trim().length >= 2 && (() => {
                const q = inviteSearch.trim().toLowerCase();
                const filtered = availableUsers.filter(u =>
                  !selectedUsers.includes(u.uid) && (
                    u.profile?.nome?.toLowerCase().includes(q) ||
                    u.email?.toLowerCase().includes(q) ||
                    u.profile?.specializzazioni?.some((s: string) => s.toLowerCase().includes(q))
                  )
                );
                return filtered.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-xl">Nessun professionista trovato</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {filtered.map((usr) => (
                      <label key={usr.uid} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition">
                        <input type="checkbox" checked={selectedUsers.includes(usr.uid)} onChange={() => toggleUserSelection(usr.uid)} className="w-4 h-4 text-amber-500 rounded" />
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {usr.profile?.nome?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{usr.profile?.nome || 'Nome non disponibile'}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {[
                              usr.profile?.specializzazioni?.join(', '),
                              usr.profile?.location?.città
                                ? usr.profile.location.città.includes('|')
                                  ? usr.profile.location.città.split('|')[1]?.trim()
                                  : usr.profile.location.città
                                : null
                            ].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                );
              })()}
              {selectedUsers.length > 0 && (
                <div className="mt-4 flex gap-2">
                  <button onClick={handleInviteMembers} className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                    Invia {selectedUsers.length > 1 ? `${selectedUsers.length} inviti` : 'invito'}
                  </button>
                  <button onClick={() => { setSelectedUsers([]); setInviteSearch(''); }} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                    Annulla
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== ZONA OPERATIVA ===== */}
        {(team.coordinate || team.indirizzo) && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {isAdmin && (!team.coordinate || (Math.abs(team.coordinate.lat - 41.9028) < 0.001 && Math.abs(team.coordinate.lng - 12.4964) < 0.001)) && (
              <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50 border-b border-amber-200">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <p className="text-xs text-amber-700">La zona operativa non ha coordinate precise. Clicca <strong>Modifica</strong>, cerca l'indirizzo nella mappa e salva per apparire nei risultati di ricerca.</p>
              </div>
            )}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Zona operativa</h2>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  {team.indirizzo} · {team.raggioKm || 10} km
                </p>
              </div>
              {isAdmin && editingField !== 'location' && (
                <button onClick={() => startEditing('location', [])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Modifica
                </button>
              )}
              {editingField === 'location' && (
                <div className="flex gap-2">
                  <button onClick={() => saveField('location')} disabled={saving} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 transition">{saving ? 'Salvo...' : 'Salva'}</button>
                  <button onClick={cancelEditing} className="px-4 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition">Annulla</button>
                </div>
              )}
            </div>
            <div className="p-5" style={{ position: 'relative', zIndex: 1 }}>
              <MapSelector
                coordinate={editingField === 'location' ? editingLocation.coordinate : team.coordinate}
                raggioKm={editingField === 'location' ? editingLocation.raggioKm : (team.raggioKm || 10)}
                indirizzo={editingField === 'location' ? editingLocation.indirizzo : team.indirizzo}
                onCoordinateChange={(coord) => setEditingLocation(prev => ({ ...prev, coordinate: coord }))}
                onIndirizzoChange={(addr) => setEditingLocation(prev => ({ ...prev, indirizzo: addr }))}
                onRaggioChange={(raggio) => setEditingLocation(prev => ({ ...prev, raggioKm: raggio }))}
                readOnly={editingField !== 'location'}
              />
            </div>
          </div>
        )}

        {/* ===== DANGER ZONE (admin) ===== */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-red-100">
            <div className="px-6 py-3 border-b border-red-100 bg-red-50/50">
              <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest">Zona pericolosa</h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-orange-50 border border-orange-100">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Lascia equipe</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {team.members.length > 1 ? 'Il ruolo admin passerà al prossimo membro.' : 'Essendo l\'unico membro, l\'equipe verrà eliminata.'}
                  </p>
                </div>
                <button onClick={handleLeaveTeam} className="ml-4 px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition whitespace-nowrap">Lascia</button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-100">
                <div>
                  <p className="font-medium text-red-900 text-sm">Elimina equipe</p>
                  <p className="text-xs text-red-500 mt-0.5">Azione irreversibile. Tutti i dati verranno persi.</p>
                </div>
                <button onClick={handleDeleteTeam} className="ml-4 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition whitespace-nowrap">Elimina</button>
              </div>
            </div>
          </div>
        )}

        </div>{/* fine sidebar */}
        </div>{/* fine grid a due colonne */}
      </div>

      {/* ===== MODAL: Richiesta di adesione ===== */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ zIndex: 10000 }}>
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Richiesta di adesione</h3>
              <p className="text-sm text-gray-500 mt-0.5">Presenta la tua candidatura all'amministratore</p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Messaggio *</label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Presentati brevemente e spiega perché vorresti far parte di questa equipe..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows={5}
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setShowRequestModal(false); setRequestMessage(''); }} className="flex-1 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-100 transition">Annulla</button>
              <button onClick={handleJoinRequest} className="flex-1 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition">Invia richiesta</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
