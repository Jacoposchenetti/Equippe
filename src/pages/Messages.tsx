'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Conversation, Message, Team, ConversationType, FileAttachment } from '@/types/equippe';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notifyNewMessage } from '@/lib/notifications';
import { uploadFile, validateFile, getFileIcon, formatFileSize } from '@/lib/fileUpload';

export default function MessagesPage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
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
    if (conversationId && conversations.length > 0) {
      setSelectedConversation(conversationId);
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

          // Ordina per tipo (team prima) e poi per ultimo messaggio
          convs.sort((a, b) => {
            // Prima le chat di team
            if (a.type === 'team' && b.type !== 'team') return -1;
            if (b.type === 'team' && a.type !== 'team') return 1;
            
            // Poi per ultimo messaggio
            const timeA = a.lastMessageTime?.toMillis() || 0;
            const timeB = b.lastMessageTime?.toMillis() || 0;
            return timeB - timeA;
          });

          setConversations(convs);
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
      alert('Errore nella creazione della conversazione. Riprova.');
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
      alert('Errori nei file:\n' + errors.join('\n'));
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
      alert('Errore durante l\'upload dei file');
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
      alert('Errore nell\'invio del messaggio');
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
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Messaggi</h1>

        <div className="bg-white rounded-xl shadow-sm" style={{ height: '70vh', display: 'flex' }}>
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
                    displayName = `Équipe: ${conv.teamName || 'Senza nome'}`;
                    photoURL = ''; // Icona team
                  } else {
                    const otherId = conv.participants.find(id => id !== user?.uid);
                    displayName = otherId && conv.participantsData?.[otherId]?.name || 'Sconosciuto';
                    photoURL = otherId && conv.participantsData?.[otherId]?.photoURL || '';
                  }

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition ${
                        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      } ${isTeamChat ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-l-2 border-l-amber-400' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {isTeamChat ? (
                              conv.teamPhotoURL ? (
                                <img 
                                  src={conv.teamPhotoURL} 
                                  alt={displayName} 
                                  className="w-10 h-10 rounded-full object-cover border-2 border-amber-300"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 616 0zm6 3a2 2 0 11-4 0 2 2 0 414 0zM7 10a2 2 0 11-4 0 2 2 0 414 0z" />
                                  </svg>
                                </div>
                              )
                            ) : photoURL ? (
                              <img 
                                src={photoURL} 
                                alt={displayName} 
                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className={`font-bold ${isTeamChat ? 'text-amber-900' : 'text-gray-900'}`}>
                                  {displayName}
                                </h3>
                                {isTeamChat && (
                                  <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                                    ÉQUIPE
                                  </span>
                                )}
                              </div>
                              {conv.lastMessage && (
                                <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {unread > 0 && (
                          <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                            {unread}
                          </span>
                        )}
                      </div>
                      {conv.lastMessageTime && (
                        <p className="text-xs text-gray-400 mt-1">
                          {conv.lastMessageTime.toDate().toLocaleString('it-IT')}
                        </p>
                      )}
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
                  {/* Header conversazione */}
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                      {/* Pulsante indietro per mobile */}
                      <button
                        onClick={() => setSelectedConversation(null)}
                        className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      {selectedConvData?.type === 'team' ? (
                        <>
                          {selectedConvData.teamPhotoURL ? (
                            <img 
                              src={selectedConvData.teamPhotoURL} 
                              alt={selectedConvData.teamName} 
                              className="w-10 h-10 rounded-full object-cover border-2 border-amber-300"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 616 0zm6 3a2 2 0 11-4 0 2 2 0 414 0zM7 10a2 2 0 11-4 0 2 2 0 414 0z" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1">
                            <h2 className="text-xl font-bold text-amber-900">
                              Équipe: {selectedConvData.teamName}
                            </h2>
                            <p className="text-sm text-gray-600">
                              {selectedConvData.participants.length} membri
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {otherUserId && selectedConvData?.participantsData?.[otherUserId]?.photoURL ? (
                            <img 
                              src={selectedConvData.participantsData[otherUserId].photoURL} 
                              alt={otherUserName} 
                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                              {otherUserName?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <h2 className="text-xl font-bold text-gray-900">{otherUserName}</h2>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Lista messaggi */}
                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((msg) => {
                      const isMine = msg.senderId === user?.uid;
                      const isTeamChat = selectedConvData?.type === 'team';
                      
                      return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className="flex items-end gap-2 max-w-[70%]">
                            {!isMine && isTeamChat && (
                              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
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
                            <div className={`${isMine ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} rounded-2xl px-4 py-3`}>
                              {!isMine && isTeamChat && (
                                <p className="text-xs font-semibold mb-1 opacity-70">
                                  {msg.senderName}
                                </p>
                              )}
                              
                              {/* Contenuto testuale */}
                              {msg.content && (
                                <p className="whitespace-pre-wrap break-words mb-2">{msg.content}</p>
                              )}
                              
                              {/* Allegati */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="space-y-2 mb-2">
                                  {msg.attachments.map((attachment) => (
                                    <div key={attachment.id} className={`border rounded-lg p-2 ${isMine ? 'border-blue-300 bg-blue-500' : 'border-gray-300 bg-white'}`}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">{getFileIcon(attachment.type)}</span>
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm font-medium truncate ${isMine ? 'text-white' : 'text-gray-900'}`}>
                                            {attachment.name}
                                          </p>
                                          <p className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                                            {formatFileSize(attachment.size)}
                                          </p>
                                        </div>
                                        <a
                                          href={attachment.downloadURL}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`px-2 py-1 rounded text-xs font-medium transition ${
                                            isMine 
                                              ? 'bg-blue-700 text-white hover:bg-blue-800' 
                                              : 'bg-blue-600 text-white hover:bg-blue-700'
                                          }`}
                                        >
                                          {attachment.type.startsWith('image/') ? 'Visualizza' : 'Scarica'}
                                        </a>
                                      </div>
                                      
                                      {/* Preview per immagini */}
                                      {attachment.type.startsWith('image/') && (
                                        <div className="mt-2">
                                          <img 
                                            src={attachment.downloadURL} 
                                            alt={attachment.name}
                                            className="max-w-full h-auto rounded cursor-pointer"
                                            style={{ maxHeight: '200px' }}
                                            onClick={() => window.open(attachment.downloadURL, '_blank')}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              <p className={`text-xs mt-1 ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                                {msg.createdAt.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Form invio messaggio */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-gray-50">
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
                                className="bg-blue-600 h-2 rounded-full transition-all" 
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
                    
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          placeholder="Scrivi un messaggio..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={sending || uploadingFiles.length > 0}
                        />
                      </div>
                      
                      {/* Pulsante allegati */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || uploadingFiles.length > 0}
                        className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Allega file"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>
                      
                      {/* Pulsante invia */}
                      <button
                        type="submit"
                        disabled={(!messageText.trim() && pendingAttachments.length === 0) || sending || uploadingFiles.length > 0}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm"
                      >
                        {sending ? 'Invio...' : 'Invia'}
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
      <Footer />
    </div>
  );
}
