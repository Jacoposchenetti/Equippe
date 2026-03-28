'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Team } from '@/types/equippe';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notifyTeamInviteResponse } from '@/lib/notifications';
import { occupyPositions } from '@/lib/teamPositions';
import { useModal } from '@/contexts/ModalContext';

interface TeamInvite {
  id: string;
  teamId: string;
  type: 'invite' | 'request';
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: any;
  updatedAt: any;
}

interface InviteWithData extends TeamInvite {
  team?: Team;
  fromUser?: User;
  toUser?: User;
}

export default function InvitesPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { showToast, showConfirm } = useModal();
  const [receivedInvites, setReceivedInvites] = useState<InviteWithData[]>([]);
  const [sentInvites, setSentInvites] = useState<InviteWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadInvites();
  }, [user]);

  const loadInvites = async () => {
    try {
      if (!user) {
        console.log('❌ User non disponibile');
        return;
      }
      
      console.log('✅ User disponibile:', user.uid);
      console.log('🔍 Caricamento inviti ricevuti...');

      // Carica inviti ricevuti - SENZA filtro status per test
      const receivedQuery = query(
        collection(db, 'teamInvites'),
        where('toUserId', '==', user.uid)
      );
      
      console.log('📤 Eseguo query inviti ricevuti...');
      const receivedSnapshot = await getDocs(receivedQuery);
      console.log('✅ Query ricevuti completata, documenti:', receivedSnapshot.size);
      
      const received = await Promise.all(
        receivedSnapshot.docs.map(async (inviteDoc) => {
          const invite = { id: inviteDoc.id, ...inviteDoc.data() } as TeamInvite;
          console.log('📩 Invito ricevuto:', invite);
          
          // Carica dati team
          const teamDoc = await getDoc(doc(db, 'teams', invite.teamId));
          const team = teamDoc.exists() ? { id: teamDoc.id, ...teamDoc.data() } as Team : undefined;
          
          // Carica dati utente che ha inviato
          const fromUserDoc = await getDoc(doc(db, 'users', invite.fromUserId));
          const fromUser = fromUserDoc.exists() ? { uid: fromUserDoc.id, ...fromUserDoc.data() } as User : undefined;
          
          return { ...invite, team, fromUser };
        })
      );
      
      // Filtra solo pending lato client per gli inviti ricevuti
      const pendingReceived = received.filter(inv => inv.status === 'pending');
      console.log('✅ Inviti pending:', pendingReceived.length);
      setReceivedInvites(pendingReceived);

      console.log('🔍 Caricamento inviti inviati...');
      // Carica inviti inviati (dove sono il mittente) - TUTTI gli stati
      const sentQuery = query(
        collection(db, 'teamInvites'),
        where('fromUserId', '==', user.uid)
      );
      
      console.log('📤 Eseguo query inviti inviati...');
      const sentSnapshot = await getDocs(sentQuery);
      console.log('✅ Query inviati completata, documenti:', sentSnapshot.size);
      
      const sent = await Promise.all(
        sentSnapshot.docs.map(async (inviteDoc) => {
          const invite = { id: inviteDoc.id, ...inviteDoc.data() } as TeamInvite;
          console.log('📮 Invito inviato:', invite);
          
          const teamDoc = await getDoc(doc(db, 'teams', invite.teamId));
          const team = teamDoc.exists() ? { id: teamDoc.id, ...teamDoc.data() } as Team : undefined;
          
          const toUserDoc = await getDoc(doc(db, 'users', invite.toUserId));
          const toUser = toUserDoc.exists() ? { uid: toUserDoc.id, ...toUserDoc.data() } as User : undefined;
          
          return { ...invite, team, toUser };
        })
      );
      setSentInvites(sent);
      
      console.log('✅ Caricamento inviti completato con successo');
    } catch (error) {
      console.error('❌ Errore caricamento inviti:', error);
      console.error('❌ Dettagli errore:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (invite: InviteWithData) => {
    try {
      // Aggiorna stato invito
      await updateDoc(doc(db, 'teamInvites', invite.id), {
        status: 'accepted',
        respondedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Aggiungi utente al team
      const teamRef = doc(db, 'teams', invite.teamId);
      await updateDoc(teamRef, {
        members: arrayUnion({
          userId: user?.uid,
          role: 'member',
          joinedAt: Timestamp.now(),
        }),
        memberIds: arrayUnion(user?.uid),
        updatedAt: Timestamp.now(),
      });

      // Notifica il mittente dell'invito
      if (invite.fromUserId && invite.team?.name && user) {
        const userName = user.displayName || user.email || 'Un utente';
        await notifyTeamInviteResponse(
          invite.fromUserId,
          userName,
          invite.team.name,
          true,
          invite.id,
          user.uid
        );
      }

      // Aggiorna le posizioni occupate
      if (user?.uid) {
        await occupyPositions(invite.teamId, user.uid);
      }

      showToast('Invito accettato! Ora fai parte dell\'equipe', 'success');
      await loadInvites();
    } catch (error) {
      console.error('Errore accettazione invito:', error);
      showToast('Errore durante l\'accettazione dell\'invito', 'error');
    }
  };

  const handleRejectInvite = async (invite: InviteWithData) => {
    const confirmed = await showConfirm({
      title: 'Rifiuta invito',
      message: 'Sei sicuro di voler rifiutare questo invito?',
      variant: 'danger',
      confirmText: 'Rifiuta',
    });
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'teamInvites', invite.id), {
        status: 'rejected',
        respondedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Notifica il mittente dell'invito
      if (invite.fromUserId && invite.team?.name && user) {
        const userName = user.displayName || user.email || 'Un utente';
        await notifyTeamInviteResponse(
          invite.fromUserId,
          userName,
          invite.team.name,
          false,
          invite.id,
          user.uid
        );
      }

      showToast('Invito rifiutato', 'success');
      await loadInvites();
    } catch (error) {
      console.error('Errore rifiuto invito:', error);
      showToast('Errore durante il rifiuto dell\'invito', 'error');
    }
  };

  const handleCancelInvite = async (invite: InviteWithData) => {
    const confirmed = await showConfirm({
      title: 'Annulla invito',
      message: 'Sei sicuro di voler annullare questo invito?',
      variant: 'warning',
      confirmText: 'Annulla invito',
    });
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'teamInvites', invite.id), {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
      });

      // Opzionalmente, potresti notificare l'utente che l'invito è stato annullato
      // Ma per ora evitiamo di inviare troppi spam di notifiche
      
      showToast('Invito annullato con successo', 'success');
      await loadInvites();
    } catch (error) {
      console.error('Errore annullamento invito:', error);
      showToast('Errore durante l\'annullamento dell\'invito', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  const displayInvites = tab === 'received' ? receivedInvites : sentInvites;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:py-8">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Inviti equipe</h1>
          {receivedInvites.length > 0 && (
            <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full">
              {receivedInvites.length}
            </span>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTab('received')}
              className={`flex-1 px-6 py-4 font-medium transition relative ${
                tab === 'received' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Ricevuti
              {receivedInvites.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {receivedInvites.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('sent')}
              className={`flex-1 px-6 py-4 font-medium transition ${
                tab === 'sent' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Inviati
              {sentInvites.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-gray-300 text-gray-700 text-xs font-bold rounded-full">
                  {sentInvites.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {displayInvites.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-16 text-center">
            <div className="max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {tab === 'received' ? 'Nessun invito ricevuto' : 'Nessun invito inviato'}
              </h3>
              <p className="text-gray-600">
                {tab === 'received'
                  ? 'Quando riceverai inviti a unirsi a un\'equipe, appariranno qui'
                  : 'Gli inviti che invii ai professionisti appariranno qui'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {displayInvites.map((invite) => (
              <div key={invite.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {tab === 'received' ? (
                        <>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Invito a unirsi a: {invite.team?.name || 'Caricamento...'}
                          </h3>
                          <p className="text-gray-600 mb-3">
                            Da: <span className="font-medium">{invite.fromUser?.profile.nome || 'Caricamento...'}</span>
                          </p>
                          {invite.team && (
                            <div className="mb-4">
                              <p className="text-sm text-gray-700 mb-2">{invite.team.description}</p>
                              <div className="flex flex-wrap gap-2">
                                {invite.team.specializations?.map((spec: string) => (
                                  <span key={spec} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm font-medium">
                                    {spec}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Invito a: {invite.toUser?.profile.nome || 'Caricamento...'}
                          </h3>
                          <p className="text-gray-600 mb-3">
                            Per unirsi a: <span className="font-medium">{invite.team?.name || 'Caricamento...'}</span>
                          </p>
                          <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
                            invite.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            invite.status === 'accepted' ? 'bg-green-100 text-green-700' :
                            invite.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {invite.status === 'pending' ? 'In attesa' :
                             invite.status === 'accepted' ? 'Accettato' :
                             invite.status === 'cancelled' ? 'Annullato' : 'Rifiutato'}
                          </span>
                        </>
                      )}
                      <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Inviato il {invite.createdAt?.toDate?.().toLocaleDateString('it-IT') || 'N/A'}
                      </p>
                    </div>

                    {tab === 'received' && invite.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleAcceptInvite(invite)}
                          className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition shadow-sm flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Accetta
                        </button>
                        <button
                          onClick={() => handleRejectInvite(invite)}
                          className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-sm flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Rifiuta
                        </button>
                      </div>
                    )}
                    
                    {tab === 'sent' && invite.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleCancelInvite(invite)}
                          className="px-5 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition shadow-sm flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Annulla Invito
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
