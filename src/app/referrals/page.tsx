'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types/equippe';
import Link from 'next/link';
import Header from '@/components/Header';

interface Referral {
  id: string;
  senderUid: string;
  receiverUid: string;
  urgency: 'low' | 'normal' | 'high';
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: any;
  updatedAt: any;
}

export default function ReferralsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [sentReferrals, setSentReferrals] = useState<Referral[]>([]);
  const [receivedReferrals, setReceivedReferrals] = useState<Referral[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadReferrals();
  }, [user]);

  const loadReferrals = async () => {
    try {
      if (!user) return;

      // Carica referral ricevuti
      const receivedQuery = query(
        collection(db, 'referrals'),
        where('receiverUid', '==', user.uid)
      );
      const receivedSnapshot = await getDocs(receivedQuery);
      const received = receivedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Referral));
      setReceivedReferrals(received);

      // Carica referral inviati
      const sentQuery = query(
        collection(db, 'referrals'),
        where('senderUid', '==', user.uid)
      );
      const sentSnapshot = await getDocs(sentQuery);
      const sent = sentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Referral));
      setSentReferrals(sent);

      // Carica dati utenti
      const allReferrals = [...received, ...sent];
      const userIds = new Set<string>();
      allReferrals.forEach(ref => {
        userIds.add(ref.senderUid);
        userIds.add(ref.receiverUid);
      });

      const usersData: Record<string, User> = {};
      for (const uid of userIds) {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          usersData[uid] = { uid: userDoc.id, ...userDoc.data() } as User;
        }
      }
      setUsers(usersData);
    } catch (error) {
      console.error('Errore caricamento referral:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'normal': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'In attesa';
      case 'accepted': return 'Accettato';
      case 'rejected': return 'Rifiutato';
      case 'completed': return 'Completato';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  const displayReferrals = tab === 'received' ? receivedReferrals : sentReferrals;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Referral</h1>
          <Link
            href="/referrals/create"
            className="px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition shadow-sm"
          >
            + Nuovo Referral
          </Link>
        </div>
        
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm text-gray-600 font-medium">Dati crittografati end-to-end</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTab('received')}
              className={`flex-1 px-6 py-4 font-medium transition ${
                tab === 'received' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Ricevuti ({receivedReferrals.length})
            </button>
            <button
              onClick={() => setTab('sent')}
              className={`flex-1 px-6 py-4 font-medium transition ${
                tab === 'sent' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Inviati ({sentReferrals.length})
            </button>
          </div>
        </div>

        {displayReferrals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-16 text-center">
            <div className="max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {tab === 'received' ? 'Nessun referral ricevuto' : 'Nessun referral inviato'}
              </h3>
              <p className="text-gray-600 mb-6">
                {tab === 'received'
                  ? 'Quando riceverai dei referral, appariranno qui'
                  : 'Crea il tuo primo referral per iniziare a collaborare'}
              </p>
              {tab === 'sent' && (
                <Link
                  href="/referrals/create"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
                >
                  Crea Referral
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {displayReferrals.map((referral) => {
              const otherUser = tab === 'received'
                ? users[referral.senderUid]
                : users[referral.receiverUid];

              return (
                <Link
                  key={referral.id}
                  href={`/referrals/${referral.id}`}
                  className="block bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold">
                            {tab === 'received' ? 'Da' : 'A'}: {otherUser?.profile.nome || 'Caricamento...'}
                          </h3>
                          <span className={`px-3 py-1 rounded text-sm font-semibold ${getUrgencyColor(referral.urgency)}`}>
                            {referral.urgency === 'high' ? '🔴 Alta' : referral.urgency === 'normal' ? '🟡 Normale' : '🟢 Bassa'}
                          </span>
                        </div>
                      
                        {otherUser && (
                          <p className="text-gray-600 text-sm mb-2">
                            {otherUser.profile.specializzazioni.join(', ')} • {otherUser.profile.location.città}
                          </p>
                        )}

                        <p className="text-gray-500 text-sm">
                          Creato il {referral.createdAt?.toDate?.().toLocaleDateString('it-IT') || 'N/A'}
                        </p>
                      </div>

                      <span className={`px-4 py-2 rounded font-semibold ${getStatusColor(referral.status)}`}>
                        {getStatusLabel(referral.status)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
