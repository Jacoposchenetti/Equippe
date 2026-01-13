'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Conversation } from '@/types/equippe';
import Header from '@/components/Header';

export default function ProfilePage() {
  const { user: currentUser, userProfile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const uid = params.uid as string;

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingConversation, setStartingConversation] = useState(false);

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
              <div className="w-20 h-20 rounded-full bg-blue-300 flex items-center justify-center text-white text-2xl font-bold">
                {profileUser.profile.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              
              {/* Nome e info base */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{profileUser.profile.nome}</h1>
                <div className="mt-2 space-y-1">
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
                </div>
                {profileUser.email && (
                  <p className="text-gray-500 text-sm mt-1">{profileUser.email}</p>
                )}
              </div>
            </div>

            {/* Pulsante messaggio */}
            <button
              onClick={handleStartConversation}
              disabled={startingConversation}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {startingConversation ? 'Caricamento...' : '💬 Invia Messaggio'}
            </button>
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
                  <span>🔗</span>
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
                  <span>🌐</span>
                  <span>Website</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
