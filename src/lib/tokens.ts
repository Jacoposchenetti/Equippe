import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

export const TOKEN_COST_CONNECTION_REQUEST = 1;
export const TOKEN_GRANT_REGISTRATION = 10;

/**
 * Award tokens to a user atomically.
 * Safe to call from client — Firestore rules allow users to update their own doc.
 */
export async function awardTokens(userId: string, amount: number): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('Utente non trovato');
    const current: number = snap.data().tokenBalance ?? 0;
    tx.update(userRef, { tokenBalance: current + amount });
  });
}

/**
 * Spend tokens atomically.
 * Throws if the balance is insufficient.
 * Returns the new balance.
 */
export async function spendToken(userId: string, amount: number = 1): Promise<number> {
  const userRef = doc(db, 'users', userId);
  let newBalance = 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('Utente non trovato');
    const current: number = snap.data().tokenBalance ?? 0;
    if (current < amount) {
      throw new Error('INSUFFICIENT_TOKENS');
    }
    newBalance = current - amount;
    tx.update(userRef, { tokenBalance: newBalance });
  });
  return newBalance;
}
