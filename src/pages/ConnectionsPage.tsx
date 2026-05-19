'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import ConnectionButton from '@/components/ConnectionButton';
import { Connection, User } from '@/types/equippe';
import { acceptConnection, rejectConnection, revokeConnection } from '@/lib/connections';
import { useModal } from '@/contexts/ModalContext';

type Tab = 'accepted' | 'received' | 'sent';

interface ConnectionWithUser {
  connection: Connection;
  otherUser: User | null;
}

export default function ConnectionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, showConfirm } = useModal();
  const [tab, setTab] = useState<Tab>('accepted');
  const [items, setItems] = useState<ConnectionWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Two queries: where I'm userA, and where I'm userB
    const unsubA = onSnapshot(
      query(collection(db, 'connections'), where('userA', '==', user.uid)),
      () => refetch(),
      console.error
    );
    const unsubB = onSnapshot(
      query(collection(db, 'connections'), where('userB', '==', user.uid)),
      () => refetch(),
      console.error
    );

    refetch();

    return () => { unsubA(); unsubB(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refetch = async () => {
    if (!user) return;
    try {
      const [snapA, snapB] = await Promise.all([
        new Promise<Connection[]>((resolve) => {
          const unsub = onSnapshot(
            query(collection(db, 'connections'), where('userA', '==', user.uid)),
            (snap) => { resolve(snap.docs.map(d => ({ id: d.id, ...d.data() } as Connection))); unsub(); }
          );
        }),
        new Promise<Connection[]>((resolve) => {
          const unsub = onSnapshot(
            query(collection(db, 'connections'), where('userB', '==', user.uid)),
            (snap) => { resolve(snap.docs.map(d => ({ id: d.id, ...d.data() } as Connection))); unsub(); }
          );
        }),
      ]);

      const all = [...snapA, ...snapB];

      const withUsers: ConnectionWithUser[] = await Promise.all(
        all.map(async (conn) => {
          const otherUid = conn.userA === user.uid ? conn.userB : conn.userA;
          try {
            const snap = await getDoc(doc(db, 'users', otherUid));
            return {
              connection: conn,
              otherUser: snap.exists() ? ({ uid: snap.id, ...snap.data() } as User) : null,
            };
          } catch {
            return { connection: conn, otherUser: null };
          }
        })
      );

      setItems(withUsers);
    } finally {
      setLoading(false);
    }
  };

  const accepted = items.filter((i) => i.connection.status === 'accepted');
  const received = items.filter(
    (i) => i.connection.status === 'pending' && i.connection.requestedBy !== user?.uid
  );
  const sent = items.filter(
    (i) => i.connection.status === 'pending' && i.connection.requestedBy === user?.uid
  );

  const current = tab === 'accepted' ? accepted : tab === 'received' ? received : sent;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'accepted', label: 'Connessioni', count: accepted.length },
    { id: 'received', label: 'Ricevute', count: received.length },
    { id: 'sent', label: 'Inviate', count: sent.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 sm:pb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Connessioni</h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    tab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Caricamento...</div>
        ) : current.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">
              {tab === 'accepted' && 'Nessuna connessione ancora. Cerca professionisti e invia richieste di connessione.'}
              {tab === 'received' && 'Nessuna richiesta ricevuta.'}
              {tab === 'sent' && 'Nessuna richiesta inviata.'}
            </p>
            {tab === 'accepted' && (
              <button
                onClick={() => navigate('/dashboard')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
              >
                Vai alla dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {current.map(({ connection, otherUser }) => {
              const otherUid = connection.userA === user?.uid ? connection.userB : connection.userA;
              const name = otherUser?.profile?.nome ?? otherUid;
              const photo = otherUser?.profile?.photoURL;
              const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              const professions = otherUser?.profile?.professioniConDocumenti?.map((p) => p.professione) ??
                otherUser?.profile?.specializzazioni ?? [];

              return (
                <div key={connection.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
                  {/* Avatar */}
                  <button onClick={() => navigate(`/profile/${otherUid}`)} className="shrink-0">
                    {photo ? (
                      <img src={photo} alt={name} className="w-12 h-12 rounded-full object-cover border-2 border-blue-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center text-blue-800 font-bold text-sm">
                        {initials}
                      </div>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(`/profile/${otherUid}`)}
                      className="font-semibold text-gray-900 hover:text-blue-600 transition text-sm"
                    >
                      {name}
                    </button>
                    {professions.length > 0 && (
                      <p className="text-xs text-gray-500 truncate">{professions.join(', ')}</p>
                    )}
                    {tab === 'received' && connection.message && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{connection.message}"</p>
                    )}
                    {tab === 'sent' && connection.message && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{connection.message}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0">
                    {tab === 'accepted' && (
                      <button
                        onClick={async () => {
                          const ok = await showConfirm({
                            title: 'Rimuovi connessione',
                            message: `Rimuovere la connessione con ${name}?`,
                            variant: 'warning',
                            confirmText: 'Rimuovi',
                          });
                          if (!ok) return;
                          await revokeConnection(connection.id);
                          showToast('Connessione rimossa', 'success');
                          refetch();
                        }}
                        className="text-xs text-gray-400 hover:text-red-500 transition px-2 py-1 rounded hover:bg-red-50"
                      >
                        Rimuovi
                      </button>
                    )}
                    {tab === 'received' && (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await acceptConnection(connection.id, user!.uid);
                            showToast(`Sei ora connesso con ${name}!`, 'success');
                            refetch();
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                        >
                          Accetta
                        </button>
                        <button
                          onClick={async () => {
                            await rejectConnection(connection.id);
                            showToast('Richiesta rifiutata', 'info');
                            refetch();
                          }}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                        >
                          Rifiuta
                        </button>
                      </div>
                    )}
                    {tab === 'sent' && (
                      <button
                        onClick={async () => {
                          const ok = await showConfirm({
                            title: 'Annulla richiesta',
                            message: `Annullare la richiesta a ${name}?`,
                            variant: 'warning',
                            confirmText: 'Annulla richiesta',
                          });
                          if (!ok) return;
                          await revokeConnection(connection.id);
                          showToast('Richiesta annullata', 'success');
                          refetch();
                        }}
                        className="text-xs text-gray-400 hover:text-red-500 transition px-2 py-1 rounded hover:bg-red-50"
                      >
                        Annulla
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
