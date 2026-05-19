'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import {
  getConnection,
  sendConnectionRequest,
  acceptConnection,
  rejectConnection,
  revokeConnection,
} from '@/lib/connections';
import { Connection } from '@/types/equippe';

interface Props {
  targetUid: string;
  targetName: string;
  onConnectionChange?: () => void;
}

export default function ConnectionButton({ targetUid, targetName, onConnectionChange }: Props) {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { showToast, showConfirm } = useModal();

  const [connection, setConnection] = useState<Connection | null | undefined>(undefined); // undefined = loading
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Live-fetch the connection doc
  useEffect(() => {
    if (!user) return;

    const sortedA = user.uid < targetUid ? user.uid : targetUid;
    const sortedB = user.uid < targetUid ? targetUid : user.uid;
    const connectionId = `${sortedA}_${sortedB}`;

    const unsub = onSnapshot(
      doc(db, 'connections', connectionId),
      (snap) => {
        if (snap.exists()) {
          setConnection({ id: snap.id, ...snap.data() } as Connection);
        } else {
          setConnection(null);
        }
      },
      () => setConnection(null)
    );
    return () => unsub();
  }, [user, targetUid]);

  if (!user || !userProfile || connection === undefined) return null;

  const balance = userProfile.tokenBalance ?? 0;
  const iAmRequester = connection?.requestedBy === user.uid;
  const iAmReceiver = connection != null && !iAmRequester;

  // ── ACCEPTED ───────────────────────────────────────────────────────────────
  if (connection?.status === 'accepted') {
    return (
      <button
        onClick={async () => {
          const ok = await showConfirm({
            title: 'Rimuovi connessione',
            message: `Sei sicuro di voler rimuovere la connessione con ${targetName}? Potrai riconnetterti in futuro.`,
            variant: 'warning',
            confirmText: 'Rimuovi',
          });
          if (!ok) return;
          setLoading(true);
          try {
            await revokeConnection(connection.id);
            showToast('Connessione rimossa', 'success');
            onConnectionChange?.();
          } catch {
            showToast('Errore nella rimozione della connessione', 'error');
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Connesso
      </button>
    );
  }

  // ── PENDING — I sent the request ──────────────────────────────────────────
  if (connection?.status === 'pending' && iAmRequester) {
    return (
      <button
        onClick={async () => {
          const ok = await showConfirm({
            title: 'Annulla richiesta',
            message: `Annullare la richiesta di connessione inviata a ${targetName}?`,
            variant: 'warning',
            confirmText: 'Annulla richiesta',
          });
          if (!ok) return;
          setLoading(true);
          try {
            await revokeConnection(connection.id);
            showToast('Richiesta annullata', 'success');
          } catch {
            showToast('Errore durante l\'annullamento', 'error');
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition text-sm font-medium"
      >
        <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
        </svg>
        Richiesta inviata
      </button>
    );
  }

  // ── PENDING — I received the request ─────────────────────────────────────
  if (connection?.status === 'pending' && iAmReceiver) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            setLoading(true);
            try {
              await acceptConnection(connection.id, user.uid);
              showToast(`Sei ora connesso con ${targetName}!`, 'success');
              onConnectionChange?.();
            } catch {
              showToast('Errore durante l\'accettazione', 'error');
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Accetta
        </button>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              await rejectConnection(connection.id);
              showToast('Richiesta rifiutata', 'info');
            } catch {
              showToast('Errore durante il rifiuto', 'error');
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition text-sm font-medium"
        >
          Rifiuta
        </button>
      </div>
    );
  }

  // ── NO CONNECTION / REJECTED — show Connect button ────────────────────────
  return (
    <>
      <button
        onClick={() => setShowRequestModal(true)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        Connetti
      </button>

      {/* Request modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Invia richiesta di connessione
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                a <span className="font-medium text-gray-700">{targetName}</span>
              </p>

              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Aggiungi un messaggio (opzionale)…"
                rows={3}
                maxLength={300}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
              <p className="text-xs text-gray-400 text-right mt-1">{requestMessage.length}/300</p>

              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" opacity="0.2" />
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">T</text>
                </svg>
                <span className="text-sm text-amber-800">
                  Questa richiesta costerà <strong>1 token</strong>.
                  Il tuo saldo attuale: <strong>{balance} token</strong>.
                </span>
              </div>

              {balance < 1 && (
                <p className="mt-2 text-sm text-red-600 font-medium">
                  Non hai abbastanza token per inviare questa richiesta.
                </p>
              )}
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowRequestModal(false); setRequestMessage(''); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition"
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  if (balance < 1) return;
                  setLoading(true);
                  try {
                    await sendConnectionRequest(user.uid, targetUid, requestMessage || undefined);
                    await refreshUserProfile();
                    setShowRequestModal(false);
                    setRequestMessage('');
                    showToast('Richiesta di connessione inviata!', 'success');
                  } catch (err: any) {
                    if (err.message === 'INSUFFICIENT_TOKENS') {
                      showToast('Non hai abbastanza token', 'error');
                    } else if (err.message === 'ALREADY_CONNECTED') {
                      showToast('Sei già connesso con questo utente', 'info');
                    } else if (err.message === 'REQUEST_ALREADY_PENDING') {
                      showToast('Hai già una richiesta in sospeso', 'info');
                    } else {
                      showToast('Errore nell\'invio della richiesta', 'error');
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || balance < 1}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition disabled:opacity-50"
              >
                {loading ? 'Invio...' : 'Invia richiesta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
