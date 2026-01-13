'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Conversation, Message } from '@/types/equippe';
import Header from '@/components/Header';
import { notifyNewMessage } from '@/lib/notifications';

export default function MessagesPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.uid || !userProfile) {
      if (user === null) {
        router.push('/login');
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

  // Auto-scroll ai nuovi messaggi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    if (!user?.uid) return;

    try {
      // Forza il refresh del token prima di fare la query
      await user.getIdToken(true);
      
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

          // Carica i dati degli utenti partecipanti
          for (const conv of convs) {
            if (!conv.participantsData) {
              conv.participantsData = {};
            }
            
            for (const participantId of conv.participants) {
              if (participantId !== user.uid && !conv.participantsData[participantId]) {
                try {
                  const userDoc = await getDoc(doc(db, 'users', participantId));
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    conv.participantsData[participantId] = {
                      name: userData.profile?.nome || 'Utente'
                    };
                  }
                } catch (error) {
                  console.error('Error loading participant data:', error);
                }
              }
            }
          }

          // Ordina per ultimo messaggio
          convs.sort((a, b) => {
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
            name: userProfile.profile.nome
          },
          [otherUserId]: {
            name: otherUserData.profile.nome
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || !selectedConversation || !messageText.trim() || sending) return;

    setSending(true);

    try {
      const conversation = conversations.find(c => c.id === selectedConversation);
      if (!conversation) return;

      const receiverId = conversation.participants.find(id => id !== user.uid)!;

      // Crea messaggio
      const messageDoc = await addDoc(collection(db, 'messages'), {
        conversationId: selectedConversation,
        senderId: user.uid,
        senderName: userProfile.profile.nome,
        receiverId,
        content: messageText.trim(),
        read: false,
        createdAt: Timestamp.now()
      });

      // Aggiorna conversazione
      const convRef = doc(db, 'conversations', selectedConversation);
      const currentUnreadCount = conversation?.unreadCount || {};
      await updateDoc(convRef, {
        lastMessage: messageText.trim().substring(0, 100),
        lastMessageTime: Timestamp.now(),
        lastSenderId: user.uid,
        unreadCount: {
          ...currentUnreadCount,
          [receiverId]: (currentUnreadCount[receiverId] || 0) + 1
        }
      });

      // Invia notifica al destinatario
      await notifyNewMessage(
        selectedConversation,
        messageDoc.id,
        user.uid,
        userProfile.profile.nome,
        [receiverId],
        messageText.trim()
      );

      setMessageText('');
    } catch (err) {
      console.error('Errore nell\'invio del messaggio:', err);
      alert('Errore nell\'invio. Riprova.');
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
                  const otherId = conv.participants.find(id => id !== user?.uid);
                  const otherName = otherId && conv.participantsData?.[otherId]?.name || 'Sconosciuto';
                  const unread = conv.unreadCount?.[user?.uid || ''] || 0;
                  const isSelected = selectedConversation === conv.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition ${
                        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                              {otherName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900">{otherName}</h3>
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
            <div className={`${selectedConversation ? 'flex-1' : 'hidden'} md:flex md:flex-col md:col-span-8 h-full overflow-hidden`}>
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
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        {otherUserName?.charAt(0).toUpperCase()}
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">{otherUserName}</h2>
                    </div>
                  </div>

                  {/* Lista messaggi */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((msg) => {
                      const isMine = msg.senderId === user?.uid;
                      
                      return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] ${isMine ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} rounded-2xl px-4 py-3`}>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className={`text-xs mt-1 ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                              {msg.createdAt.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Form invio messaggio */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Scrivi un messaggio..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        disabled={!messageText.trim() || sending}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm"
                      >
                        {sending ? 'Invio...' : 'Invia'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
