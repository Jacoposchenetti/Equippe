import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Connection, ConnectionStatus } from '@/types/equippe';
import { spendToken, TOKEN_COST_CONNECTION_REQUEST } from './tokens';
import { createNotification } from './notifications';

/** Deterministic, sorted document ID for a pair of users. */
export function getConnectionId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

/** Fetch the connection document between two users (or null). */
export async function getConnection(uid1: string, uid2: string): Promise<Connection | null> {
  const id = getConnectionId(uid1, uid2);
  const snap = await getDoc(doc(db, 'connections', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Connection;
}

/** Returns true if the two users have an accepted connection. */
export async function isConnected(uid1: string, uid2: string): Promise<boolean> {
  const conn = await getConnection(uid1, uid2);
  return conn?.status === 'accepted';
}

/**
 * Send a connection request.
 * Costs TOKEN_COST_CONNECTION_REQUEST token from the sender.
 * If a 'rejected' document already exists (previous request), it is overwritten.
 * Throws 'INSUFFICIENT_TOKENS' if the sender has no tokens.
 */
export async function sendConnectionRequest(
  fromUid: string,
  toUid: string,
  message?: string
): Promise<void> {
  // Spend token first (atomic, throws if insufficient)
  await spendToken(fromUid, TOKEN_COST_CONNECTION_REQUEST);

  const id = getConnectionId(fromUid, toUid);
  const connRef = doc(db, 'connections', id);
  const now = Timestamp.now();

  // Upsert: works for both new requests and retries after rejection
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(connRef);
    if (snap.exists() && snap.data().status === 'accepted') {
      throw new Error('ALREADY_CONNECTED');
    }
    if (snap.exists() && snap.data().status === 'pending') {
      throw new Error('REQUEST_ALREADY_PENDING');
    }
    tx.set(connRef, {
      userA: fromUid < toUid ? fromUid : toUid,
      userB: fromUid < toUid ? toUid : fromUid,
      requestedBy: fromUid,
      status: 'pending' as ConnectionStatus,
      ...(message?.trim() ? { message: message.trim() } : {}),
      createdAt: snap.exists() ? snap.data().createdAt : now,
      updatedAt: now,
    });
  });

  // Notify recipient (non-blocking)
  createNotification({
    userId: toUid,
    type: 'connection_request',
    title: 'Nuova richiesta di connessione',
    message: message?.trim()
      ? `Hai ricevuto una richiesta di connessione con messaggio: "${message.trim()}"`
      : 'Hai ricevuto una nuova richiesta di connessione',
    senderId: fromUid,
    connectionId: id,
  }).catch(console.error);
}

/** Accept a pending connection request. */
export async function acceptConnection(connectionId: string, acceptorUid: string): Promise<void> {
  const connRef = doc(db, 'connections', connectionId);
  const snap = await getDoc(connRef);
  if (!snap.exists()) throw new Error('Connessione non trovata');

  const data = snap.data() as Connection;
  await updateDoc(connRef, { status: 'accepted' as ConnectionStatus, updatedAt: Timestamp.now() });

  // Notify the original requester
  createNotification({
    userId: data.requestedBy,
    type: 'connection_accepted',
    title: 'Richiesta di connessione accettata',
    message: 'La tua richiesta di connessione è stata accettata!',
    senderId: acceptorUid,
    connectionId,
  }).catch(console.error);
}

/** Reject a pending connection request (keeps doc with 'rejected' status). */
export async function rejectConnection(connectionId: string): Promise<void> {
  const connRef = doc(db, 'connections', connectionId);
  await updateDoc(connRef, { status: 'rejected' as ConnectionStatus, updatedAt: Timestamp.now() });
}

/** Revoke/disconnect an accepted connection (deletes the document). */
export async function revokeConnection(connectionId: string): Promise<void> {
  await deleteDoc(doc(db, 'connections', connectionId));
}

/**
 * Auto-connect two users without spending tokens (used for team joins, migrations).
 * Skips if a connection already exists and is accepted.
 */
export async function autoConnect(uid1: string, uid2: string): Promise<void> {
  const id = getConnectionId(uid1, uid2);
  const connRef = doc(db, 'connections', id);
  const snap = await getDoc(connRef);
  if (snap.exists() && snap.data().status === 'accepted') return; // already connected

  const now = Timestamp.now();
  await setDoc(connRef, {
    userA: uid1 < uid2 ? uid1 : uid2,
    userB: uid1 < uid2 ? uid2 : uid1,
    requestedBy: 'system',
    status: 'accepted' as ConnectionStatus,
    createdAt: snap.exists() ? snap.data().createdAt : now,
    updatedAt: now,
  });
}

/**
 * Auto-connect a new member with all existing team members.
 * Called when a user joins or is accepted into a team.
 */
export async function autoConnectWithTeamMembers(
  newMemberId: string,
  existingMemberIds: string[]
): Promise<void> {
  await Promise.all(
    existingMemberIds
      .filter((mid) => mid !== newMemberId)
      .map((mid) => autoConnect(newMemberId, mid))
  );
}
