'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, getDoc, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Conversation, Message, Team, ConversationType, FileAttachment } from '@/types/equippe';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notifyNewMessage } from '@/lib/notifications';
import { uploadFile, validateFile, getFileIcon, formatFileSize } from '@/lib/fileUpload';
import { useModal } from '@/contexts/ModalContext';

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `oggi, ${time}`;
  if (diffDays === 1) return `ieri, ${time}`;
  if (diffDays === 2) return `2 giorni fa, ${time}`;
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + time;
}

function formatDateSeparator(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Oggi';
  if (diffDays === 1) return 'Ieri';
  return date.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function MessagesPage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast, showConfirm } = useModal();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.uid || !userProfile) {
      if (user === null) {
        navigate('/login');
      }
      return;
    }
    
    const cleanup = loadConversations();
    return () => {
      if (cleanup) cleanup.then(unsub => unsub?.());
    };
  }, [user, userProfile]);

  // Seleziona automaticamente la conversazione se specificata nell'URL
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (!conversationId) return;
    
    // Se già selezionata, non fare nulla
    if (selectedConversation === conversationId) return;
    
    // Attendi che la conversazione sia disponibile nella lista
    if (conversations.length > 0) {
      const exists = conversations.some(c => c.id === conversationId);
      if (exists) {
        setSelectedConversation(conversationId);
      }
    }
  }, [searchParams, conversations]);

  // Auto-scroll ai nuovi messaggi (solo nel container, non nella pagina)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Scroll quando si seleziona una conversazione (con retry per mobile)
  useEffect(() => {
    if (!selectedConversation) return;
    
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    };
    
    // Prima chiamata immediata
    scrollToBottom();
    
    // Poi retry multipli per assicurarsi che funzioni su mobile
    const timeouts = [
      setTimeout(scrollToBottom, 0),
      setTimeout(scrollToBottom, 100),
      setTimeout(scrollToBottom, 300),
      setTimeout(scrollToBottom, 600)
    ];
    
    return () => timeouts.forEach(t => clearTimeout(t));
  }, [selectedConversation]);

  // Crea chat di team se non esiste
  const createTeamConversationIfNeeded = async (team: Team) => {
    if (!user?.uid) return;

    try {
      // Controlla se esiste già una conversazione per questo team
      const teamConversationQuery = query(
        collection(db, 'conversations'),
        where('teamId', '==', team.id || team.teamId),
        where('type', '==', 'team')
      );
      
      const existingSnapshot = await getDocs(teamConversationQuery);
      
      if (existingSnapshot.empty) {
        // Crea nuova conversazione di team
        const teamMembers = team.memberIds || team.members?.map(m => m.uid) || [];
        
        const participantsData: { [key: string]: { name: string; photoURL?: string } } = {};
        
        // Carica dati di tutti i membri
        for (const memberId of teamMembers) {
          try {
            if (memberId === user?.uid) {
              // Usa i dati dell'utente corrente
              participantsData[memberId] = {
                name: userProfile?.profile?.nome || 'Tu',
                photoURL: userProfile?.profile?.photoURL || ''
              };
            } else {
              // Carica dati degli altri membri
              const memberDoc = await getDoc(doc(db, 'users', memberId));
              if (memberDoc.exists()) {
                const userData = memberDoc.data();
                participantsData[memberId] = {
                  name: userData.profile?.nome || 'Utente',
                  photoURL: userData.profile?.photoURL || ''
                };
              }
            }
          } catch (error) {
            console.error('Error loading member data:', error);
          }
        }

        await addDoc(collection(db, 'conversations'), {
          type: 'team',
          teamId: team.id || team.teamId,
          teamName: team.nome || team.name,
          teamPhotoURL: team.photoURL || '',
          participants: teamMembers,
          participantsData,
          lastMessage: 'Chat di gruppo creata',
          lastMessageTime: Timestamp.now(),
          unreadCount: Object.fromEntries(teamMembers.map(id => [id, 0])),
          createdAt: Timestamp.now()
        });
      } else {
        // Conversazione esiste già: sincronizza i participants con i membri attuali del team
        const existingConv = existingSnapshot.docs[0];
        const existingData = existingConv.data();
        const currentParticipants: string[] = existingData.participants || [];
        const teamMembers = team.memberIds || team.members?.map(m => m.uid) || [];
        
        // Controlla se ci sono membri del team non presenti nei participants
        const missingMembers = teamMembers.filter(id => !currentParticipants.includes(id));
        const removedMembers = currentParticipants.filter(id => !teamMembers.includes(id));
        
        if (missingMembers.length > 0 || removedMembers.length > 0) {
          const updatedParticipantsData = { ...(existingData.participantsData || {}) };
          
          // Aggiungi dati dei nuovi membri
          for (const memberId of missingMembers) {
            try {
              if (memberId === user?.uid) {
                updatedParticipantsData[memberId] = {
                  name: userProfile?.profile?.nome || 'Tu',
                  photoURL: userProfile?.profile?.photoURL || ''
                };
              } else {
                const memberDoc = await getDoc(doc(db, 'users', memberId));
                if (memberDoc.exists()) {
                  const userData = memberDoc.data();
                  updatedParticipantsData[memberId] = {
                    name: userData.profile?.nome || 'Utente',
                    photoURL: userData.profile?.photoURL || ''
                  };
                }
              }
            } catch (error) {
              console.error('Error loading new member data:', error);
            }
          }
          
          // Rimuovi dati dei membri usciti
          for (const memberId of removedMembers) {
            delete updatedParticipantsData[memberId];
          }
          
          await updateDoc(doc(db, 'conversations', existingConv.id), {
            participants: teamMembers,
            participantsData: updatedParticipantsData
          });
        }
      }
    } catch (error) {
      console.error('Error creating team conversation:', error);
    }
  };

  const loadConversations = async () => {
    if (!user?.uid) return;

    try {
      // Forza il refresh del token prima di fare la query
      await user.getIdToken(true);
      
      // Carica teams dell'utente
      const teamsQuery = query(
        collection(db, 'teams'),
        where('memberIds', 'array-contains', user.uid)
      );
      
      const teamsSnapshot = await getDocs(teamsQuery);
      const userTeams = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Team));
      setTeams(userTeams);
      
      // Crea automaticamente chat di gruppo per ogni team se non esiste
      for (const team of userTeams) {
        await createTeamConversationIfNeeded(team);
      }
      
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid)
      );

      const unsubscribe = onSnapshot(
        conversationsQuery, 
        async (snapshot) => {
          const convs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Conversation));

          // Carica i dati degli utenti partecipanti (sempre per assicurarci che siano aggiornati)
          for (const conv of convs) {
            if (!conv.participantsData) {
              conv.participantsData = {};
            }
            
            // Aggiorna foto team per conversazioni team se mancante
            if (conv.type === 'team' && conv.teamId && !conv.teamPhotoURL) {
              try {
                const teamDoc = await getDoc(doc(db, 'teams', conv.teamId));
                if (teamDoc.exists()) {
                  const teamData = teamDoc.data();
                  if (teamData.photoURL) {
                    conv.teamPhotoURL = teamData.photoURL;
                    // Aggiorna anche nel database
                    await updateDoc(doc(db, 'conversations', conv.id), {
                      teamPhotoURL: teamData.photoURL
                    });
                  }
                }
              } catch (error) {
                console.error('Error updating team photo in conversation:', error);
              }
            }
            
            for (const participantId of conv.participants) {
              // Ricarica sempre i dati per assicurarci che le foto profilo siano aggiornate
              try {
                if (participantId === user.uid) {
                  // Usa i dati dell'utente corrente
                  conv.participantsData[participantId] = {
                    name: userProfile?.profile?.nome || 'Tu',
                    photoURL: userProfile?.profile?.photoURL || ''
                  };
                } else {
                  // Carica dati degli altri utenti
                  const userDoc = await getDoc(doc(db, 'users', participantId));
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    conv.participantsData[participantId] = {
                      name: userData.profile?.nome || 'Utente',
                      photoURL: userData.profile?.photoURL || ''
                    };
                  }
                }
              } catch (error) {
                console.error('Error loading participant data:', error);
              }
            }
          }

          // Filtra chat orfane: team eliminati o utenti che non esistono più
          const validConvs = [];
          for (const conv of convs) {
            let isOrphan = false;

            if (conv.type === 'team' && conv.teamId) {
              // Controlla se il team esiste ancora
              try {
                const teamDoc = await getDoc(doc(db, 'teams', conv.teamId));
                if (!teamDoc.exists()) {
                  isOrphan = true;
                }
              } catch (error) {
                console.error('Error checking team existence:', error);
              }
            } else if (conv.type === 'private' || !conv.type) {
              // Chat diretta: controlla se l'altro utente esiste ancora
              const otherParticipantId = conv.participants.find((p: string) => p !== user.uid);
              if (otherParticipantId) {
                try {
                  const otherUserDoc = await getDoc(doc(db, 'users', otherParticipantId));
                  if (!otherUserDoc.exists()) {
                    isOrphan = true;
                  }
                } catch (error) {
                  console.error('Error checking user existence:', error);
                }
              }
            }

            if (isOrphan) {
              // Rimuovi conversazione e messaggi da Firestore
              try {
                const messagesQuery = query(
                  collection(db, 'messages'),
                  where('conversationId', '==', conv.id)
                );
                const messagesSnapshot = await getDocs(messagesQuery);
                await Promise.all(messagesSnapshot.docs.map(msgDoc => deleteDoc(doc(db, 'messages', msgDoc.id))));
                await deleteDoc(doc(db, 'conversations', conv.id));
              } catch (cleanupError) {
                console.error('Error cleaning up orphan conversation:', cleanupError);
              }
              continue; // Non aggiungere alle conversazioni valide
            }

            validConvs.push(conv);
          }

          // Ordina per ultimo messaggio (più recente prima)
          validConvs.sort((a, b) => {
            const timeA = a.lastMessageTime?.toMillis() || 0;
            const timeB = b.lastMessageTime?.toMillis() || 0;
            return timeB - timeA;
          });

          setConversations(validConvs);
          setLoading(false);
        },
        (error) => {
          console.error('Error loading conversations:', error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up conversations listener:', error);
      setLoading(false);
    }
  };

  // Carica messaggi della conversazione selezionata
  useEffect(() => {
    if (!selectedConversation || !user?.uid) return;

    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', selectedConversation),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery, 
      async (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
        
        setMessages(msgs);

        // Segna come letti i messaggi non letti ricevuti
        const unreadMessages = msgs.filter(m => !m.read && m.receiverId === user.uid);
        for (const msg of unreadMessages) {
          try {
            await updateDoc(doc(db, 'messages', msg.id), { read: true });
          } catch (error) {
            console.error('Error marking message as read:', error);
          }
        }

        // Aggiorna conteggio non letti nella conversazione
        const currentConv = conversations.find(c => c.id === selectedConversation);
        if (currentConv) {
          try {
            const convRef = doc(db, 'conversations', selectedConversation);
            const currentUnreadCount = currentConv.unreadCount || {};
            await updateDoc(convRef, {
              unreadCount: {
                ...currentUnreadCount,
                [user.uid]: 0
              }
            });
          } catch (error) {
            console.error('Error updating conversation unread count:', error);
          }
        }
      },
      (error) => {
        console.error('Error loading messages:', error);
      }
    );

    return () => unsubscribe();
  }, [selectedConversation, user, conversations]);

  const startNewConversation = async (otherUserId: string) => {
    if (!user || !userProfile || otherUserId === user.uid || creatingConversation) return;
    
    setCreatingConversation(true);

    try {
      // Controlla se esiste già una conversazione
      const existingConvQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid)
      );
      
      const existingConvSnapshot = await getDocs(existingConvQuery);
      const existingConv = existingConvSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.participants.includes(otherUserId);
      });

      if (existingConv) {
        setSelectedConversation(existingConv.id);
        setCreatingConversation(false);
        return;
      }

      // Recupera dati dell'altro utente
      const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
      if (!otherUserDoc.exists()) {
        setCreatingConversation(false);
        return;
      }
      
      const otherUserData = otherUserDoc.data();

      // Crea nuova conversazione
      const newConv = {
        participants: [user.uid, otherUserId].sort(),
        participantsData: {
          [user.uid]: {
            name: userProfile.profile.nome,
            photoURL: userProfile.profile.photoURL || ''
          },
          [otherUserId]: {
            name: otherUserData.profile.nome,
            photoURL: otherUserData.profile.photoURL || ''
          }
        },
        lastMessage: '',
        lastMessageTime: Timestamp.now(),
        unreadCount: {
          [user.uid]: 0,
          [otherUserId]: 0
        },
        createdAt: Timestamp.now()
      };

      const convRef = await addDoc(collection(db, 'conversations'), newConv);
      setSelectedConversation(convRef.id);
    } catch (err) {
      console.error('Errore nella creazione della conversazione:', err);
      showToast('Errore nella creazione della conversazione. Riprova.', 'error');
    }

    setCreatingConversation(false);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    Array.from(files).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });
    
    if (errors.length > 0) {
      showToast('Errori nei file:\n' + errors.join('\n'), 'warning');
    }
    
    if (validFiles.length > 0) {
      handleUploadFiles(validFiles);
    }
    
    // Reset input file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadFiles = async (files: File[]) => {
    if (!selectedConversation || !user) return;
    
    setUploadingFiles(prev => [...prev, ...files]);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const fileName = file.name;
        setUploadProgress(prev => ({ ...prev, [fileName]: 0 }));
        
        const attachment = await uploadFile(
          file,
          selectedConversation,
          user.uid,
          (progress) => {
            setUploadProgress(prev => ({ ...prev, [fileName]: progress }));
          }
        );
        
        return attachment;
      });
      
      const attachments = await Promise.all(uploadPromises);
      
      // Aggiungi agli allegati in attesa invece di inviare subito
      setPendingAttachments(prev => [...prev, ...attachments]);
      
    } catch (error) {
      console.error('Error uploading files:', error);
      showToast('Errore durante l\'upload dei file', 'error');
    } finally {
      // Pulisci stati upload
      setUploadingFiles(prev => prev.filter(f => !files.includes(f)));
      files.forEach(file => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });
      });
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setPendingAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const handleSendMessageWithAttachments = async (attachments: FileAttachment[], text?: string) => {
    if (!user || !userProfile || !selectedConversation) return;

    try {
      const conversation = conversations.find(c => c.id === selectedConversation);
      if (!conversation) return;

      // Crea messaggio
      const messageData: any = {
        conversationId: selectedConversation,
        senderId: user.uid,
        senderName: userProfile.profile.nome,
        senderPhotoURL: userProfile.profile.photoURL || '',
        content: text || (attachments.length > 0 ? '' : ''),
        attachments,
        read: false,
        createdAt: Timestamp.now()
      };

      // Per chat private, aggiungi receiverId
      if (conversation.type === 'private') {
        const receiverId = conversation.participants.find(id => id !== user.uid)!;
        messageData.receiverId = receiverId;
      }

      const messageDoc = await addDoc(collection(db, 'messages'), messageData);

      // Aggiorna conversazione
      const convRef = doc(db, 'conversations', selectedConversation);
      const currentUnreadCount = conversation?.unreadCount || {};
      
      const newUnreadCount = { ...currentUnreadCount };
      let recipientIds: string[] = [];
      
      if (conversation.type === 'team') {
        conversation.participants.forEach(participantId => {
          if (participantId !== user.uid) {
            newUnreadCount[participantId] = (newUnreadCount[participantId] || 0) + 1;
            recipientIds.push(participantId);
          }
        });
      } else {
        const receiverId = conversation.participants.find(id => id !== user.uid)!;
        newUnreadCount[receiverId] = (newUnreadCount[receiverId] || 0) + 1;
        recipientIds = [receiverId];
      }
      
      const lastMessage = attachments.length > 0 
        ? `📎 ${attachments.length} allegat${attachments.length === 1 ? 'o' : 'i'}${text ? ': ' + text.substring(0, 50) : ''}`
        : text || '';
      
      await updateDoc(convRef, {
        lastMessage: lastMessage.substring(0, 100),
        lastMessageTime: Timestamp.now(),
        lastSenderId: user.uid,
        unreadCount: newUnreadCount
      });

      // Invia notifica ai destinatari
      if (recipientIds.length > 0) {
        await notifyNewMessage(
          selectedConversation,
          messageDoc.id,
          user.uid,
          userProfile.profile.nome,
          userProfile.profile.photoURL || user.photoURL,
          recipientIds,
          lastMessage
        );
      }

    } catch (error) {
      console.error('Error sending message with attachments:', error);
      throw error;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || !selectedConversation || (!messageText.trim() && pendingAttachments.length === 0) || sending) return;

    setSending(true);

    try {
      await handleSendMessageWithAttachments(pendingAttachments, messageText.trim());
      setMessageText('');
      setPendingAttachments([]);
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Errore nell\'invio del messaggio', 'error');
    }

    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  const selectedConvData = conversations.find(c => c.id === selectedConversation);
  const otherUserId = selectedConvData?.participants.find(id => id !== user?.uid);
  const otherUserName = otherUserId ? selectedConvData?.participantsData[otherUserId]?.name : '';

  return (
    <div className="min-h-screen bg-white md:bg-gray-50">
      <div className={`${selectedConversation ? 'hidden md:block' : ''}`}><Header /></div>

      <div className="max-w-7xl mx-auto md:px-6 pt-0 pb-0 md:pb-24 md:py-8">
        {!selectedConversation && (
          <h1 className="text-[28px] sm:text-4xl font-extrabold text-[#1B3A5C] px-5 pt-6 pb-4 sm:mb-8">Messaggi</h1>
        )}

        <div className="bg-white md:rounded-xl md:shadow-sm" style={{ height: selectedConversation ? '100dvh' : 'calc(100dvh - 160px)', display: 'flex' }}>
          <div className="flex md:grid md:grid-cols-12 w-full h-full">
            {/* Lista conversazioni */}
            <div className={`${selectedConversation ? 'hidden' : 'flex-1'} md:flex md:flex-col md:col-span-4 border-r border-gray-200 overflow-y-auto h-full`}>
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="font-medium">Nessuna conversazione</p>
                  <p className="text-sm mt-2">Inizia una nuova conversazione dalla dashboard</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isTeamChat = conv.type === 'team';
                  const unread = conv.unreadCount?.[user?.uid || ''] || 0;
                  const isSelected = selectedConversation === conv.id;

                  // Per chat private
                  let displayName = '';
                  let photoURL = '';
                  
                  if (isTeamChat) {
                    displayName = conv.teamName || 'Senza nome';
                    photoURL = conv.teamPhotoURL || '';
                  } else {
                    const otherId = conv.participants.find(id => id !== user?.uid);
                    displayName = otherId && conv.participantsData?.[otherId]?.name || 'Sconosciuto';
                    photoURL = otherId && conv.participantsData?.[otherId]?.photoURL || '';
                  }

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`px-5 py-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Info conversazione */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-[#1B3A5C] text-[15px] leading-tight">
                              {displayName}
                            </h3>
                            {isTeamChat && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full uppercase tracking-wide">
                                Équipe
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className="text-sm text-[#1B3A5C] font-medium truncate mt-0.5 leading-tight">
                              {conv.lastMessage}
                            </p>
                          )}
                          {conv.lastMessageTime && (
                            <p className="text-[13px] text-gray-400 mt-0.5">
                              {formatRelativeDate(conv.lastMessageTime.toDate())}
                            </p>
                          )}
                        </div>

                        {/* Unread badge */}
                        {unread > 0 && (
                          <span className="w-5 h-5 flex items-center justify-center bg-[#0C8CE9] text-white text-[11px] font-bold rounded-full flex-shrink-0">
                            {unread}
                          </span>
                        )}

                        {/* Avatar con bordo blu stile BlaBlaCar */}
                        <div className="flex-shrink-0 relative">
                          {isTeamChat ? (
                            photoURL ? (
                              <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-br from-amber-400 to-orange-500">
                                <img 
                                  src={photoURL} 
                                  alt={displayName} 
                                  className="w-full h-full rounded-full object-cover border-2 border-white"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              </div>
                            )
                          ) : photoURL ? (
                            <div className="w-12 h-12 rounded-full p-[2px] bg-[#0C8CE9]">
                              <img 
                                src={photoURL} 
                                alt={displayName} 
                                className="w-full h-full rounded-full object-cover border-2 border-white"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-[#0C8CE9] rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Chevron */}
                        <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Area messaggi */}
            <div className={`${selectedConversation ? 'flex flex-col flex-1' : 'hidden'} md:col-span-8 h-full overflow-hidden`}>
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-lg font-medium">Seleziona una conversazione</p>
                    <p className="text-sm mt-2">Scegli una chat dalla lista per iniziare a messaggiare</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header conversazione - stile BlaBlaCar */}
                  <div className="px-3 py-3 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-3">
                      {/* Pulsante indietro */}
                      <button
                        onClick={() => setSelectedConversation(null)}
                        className="md:hidden p-1 -ml-1 hover:bg-gray-100 rounded-full transition"
                      >
                        <svg className="w-6 h-6 text-[#1B3A5C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      {selectedConvData?.type === 'team' ? (
                        <>
                          {selectedConvData.teamPhotoURL ? (
                            <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-amber-400 to-orange-500 flex-shrink-0">
                              <img 
                                src={selectedConvData.teamPhotoURL} 
                                alt={selectedConvData.teamName} 
                                className="w-full h-full rounded-full object-cover border-[1.5px] border-white"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 616 0zm6 3a2 2 0 11-4 0 2 2 0 414 0zM7 10a2 2 0 11-4 0 2 2 0 414 0z" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h2 className="text-[16px] font-bold text-[#1B3A5C] truncate">
                              {selectedConvData.teamName}
                            </h2>
                            <p className="text-[13px] text-gray-500">
                              {selectedConvData.participants.length} membri
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {otherUserId && selectedConvData?.participantsData?.[otherUserId]?.photoURL ? (
                            <div className="w-10 h-10 rounded-full p-[2px] bg-[#0C8CE9] flex-shrink-0">
                              <img 
                                src={selectedConvData.participantsData[otherUserId].photoURL} 
                                alt={otherUserName} 
                                className="w-full h-full rounded-full object-cover border-[1.5px] border-white"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-[#0C8CE9] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                              {otherUserName?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h2 className="text-[16px] font-bold text-[#1B3A5C] truncate">{otherUserName}</h2>
                          </div>
                        </>
                      )}
                      
                      {/* Menu tre punti stile BlaBlaCar */}
                      <button className="p-2 hover:bg-gray-100 rounded-full transition flex-shrink-0">
                        <svg className="w-5 h-5 text-[#1B3A5C]" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Lista messaggi - stile BlaBlaCar */}
                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 bg-white">
                    {(() => {
                      let lastDateKey = '';
                      return messages.map((msg) => {
                        const isMine = msg.senderId === user?.uid;
                        const isTeamChat = selectedConvData?.type === 'team';
                        const msgDate = msg.createdAt.toDate();
                        const currentDateKey = getDateKey(msgDate);
                        const showDateSeparator = currentDateKey !== lastDateKey;
                        lastDateKey = currentDateKey;
                        
                        return (
                          <div key={msg.id}>
                            {/* Date separator */}
                            {showDateSeparator && (
                              <div className="flex justify-center my-4">
                                <span className="text-[13px] text-gray-400 font-medium">
                                  {formatDateSeparator(msgDate)}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
                              <div className="flex items-end gap-2 max-w-[80%]">
                                {!isMine && isTeamChat && (
                                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mb-4">
                                    {msg.senderPhotoURL ? (
                                      <img 
                                        src={msg.senderPhotoURL} 
                                        alt={msg.senderName} 
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                                        {msg.senderName.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div>
                                  {!isMine && isTeamChat && (
                                    <p className="text-[11px] font-semibold text-gray-500 mb-1 ml-1">
                                      {msg.senderName}
                                    </p>
                                  )}
                                  <div className={`${
                                    isMine 
                                      ? 'bg-[#1B3A5C] text-white rounded-2xl rounded-br-md' 
                                      : 'bg-[#EDEFF1] text-[#1B3A5C] rounded-2xl rounded-bl-md'
                                  } px-4 py-2.5`}>
                                    {/* Contenuto testuale */}
                                    {msg.content && (
                                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{msg.content}</p>
                                    )}
                                    
                                    {/* Allegati */}
                                    {msg.attachments && msg.attachments.length > 0 && (
                                      <div className="space-y-2 mt-1">
                                        {msg.attachments.map((attachment) => (
                                          attachment.type.startsWith('image/') ? (
                                            /* Immagine: mostra solo la foto */
                                            <div key={attachment.id} className="rounded-lg overflow-hidden cursor-pointer" onClick={() => setLightboxUrl(attachment.downloadURL)}>
                                              <img 
                                                src={attachment.downloadURL} 
                                                alt={attachment.name}
                                                className="max-w-full h-auto rounded-lg"
                                                style={{ maxHeight: '250px' }}
                                              />
                                            </div>
                                          ) : (
                                            /* File non-immagine: mostra dettagli */
                                            <div key={attachment.id} className={`border rounded-lg p-2 ${isMine ? 'border-[#2a5078] bg-[#1a3050]' : 'border-gray-300 bg-white'}`}>
                                              <div className="flex items-center gap-2">
                                                <span className="text-lg">{getFileIcon(attachment.type)}</span>
                                                <div className="flex-1 min-w-0">
                                                  <p className={`text-sm font-medium truncate ${isMine ? 'text-white' : 'text-gray-900'}`}>
                                                    {attachment.name}
                                                  </p>
                                                  <p className={`text-xs ${isMine ? 'text-blue-200' : 'text-gray-500'}`}>
                                                    {formatFileSize(attachment.size)}
                                                  </p>
                                                </div>
                                                <a
                                                  href={attachment.downloadURL}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-2 py-1 rounded text-xs font-medium transition bg-[#0C8CE9] text-white hover:bg-blue-600"
                                                >
                                                  Scarica
                                                </a>
                                              </div>
                                            </div>
                                          )
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {/* Timestamp + read receipts sotto la bolla */}
                                  <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end mr-1' : 'ml-1'}`}>
                                    <span className="text-[12px] text-gray-400">
                                      {msg.createdAt.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {isMine && (
                                      <span className={`text-[12px] ${msg.read ? 'text-[#0C8CE9]' : 'text-gray-400'}`}>
                                        ✓✓
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Form invio messaggio - stile BlaBlaCar */}
                  <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-gray-200 bg-white">
                    {/* Indicatore upload in corso */}
                    {uploadingFiles.length > 0 && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700 mb-2">Caricamento file in corso...</p>
                        {uploadingFiles.map((file) => (
                          <div key={file.name} className="flex items-center gap-2 mb-1">
                            <span className="text-xs">{getFileIcon(file.type)}</span>
                            <span className="text-sm flex-1">{file.name}</span>
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-[#0C8CE9] h-2 rounded-full transition-all" 
                                style={{ width: `${uploadProgress[file.name] || 0}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{Math.round(uploadProgress[file.name] || 0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Anteprima allegati in attesa */}
                    {pendingAttachments.length > 0 && (
                      <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-gray-700 font-medium">Allegati ({pendingAttachments.length}):</p>
                          <button
                            type="button"
                            onClick={() => setPendingAttachments([])}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Rimuovi tutti
                          </button>
                        </div>
                        <div className="space-y-2">
                          {pendingAttachments.map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded">
                              <span className="text-lg">{getFileIcon(attachment.type)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {attachment.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(attachment.size)}
                                </p>
                              </div>
                              {/* Preview per immagini */}
                              {attachment.type.startsWith('image/') && (
                                <img 
                                  src={attachment.downloadURL} 
                                  alt={attachment.name}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => removeAttachment(attachment.id)}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                title="Rimuovi allegato"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2 items-end">
                      {/* Pulsante allegati */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || uploadingFiles.length > 0}
                        className="p-2.5 text-gray-400 hover:text-[#0C8CE9] hover:bg-blue-50 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        title="Allega file"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>

                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          placeholder={`Il tuo messaggio per ${selectedConvData?.type === 'team' ? selectedConvData.teamName : otherUserName}`}
                          className="w-full px-4 py-2.5 bg-[#F5F6F8] border-0 rounded-full text-[15px] text-[#1B3A5C] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]/30"
                          disabled={sending || uploadingFiles.length > 0}
                        />
                      </div>
                      
                      {/* Pulsante invia */}
                      <button
                        type="submit"
                        disabled={(!messageText.trim() && pendingAttachments.length === 0) || sending || uploadingFiles.length > 0}
                        className="p-2.5 bg-[#0C8CE9] text-white rounded-full hover:bg-[#0a7bd4] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition flex-shrink-0"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Input file nascosto */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(e) => handleFileSelect(e.target.files)}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                    />
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="hidden md:block">
        <Footer />
      </div>

      {/* Lightbox immagine */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition z-10"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
