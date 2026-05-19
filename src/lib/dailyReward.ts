import { doc, getDoc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_HOURS = 20;        // minimum hours between claims
const STREAK_RESET_HOURS = 48; // streak resets if > 48h gap
const MAX_STREAK = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyRewardClaim {
  streak: number;
  lastClaimedAt: Timestamp;
  totalTokensEarned: number;
}

export interface DailyRewardStatus {
  canClaim: boolean;
  currentStreak: number;   // streak before this claim
  nextReward: number;      // tokens that will be awarded on claim
  hoursUntilNext: number | null; // null if can claim now
}

// ─── Status computation ───────────────────────────────────────────────────────

export function computeRewardStatus(claim: DailyRewardClaim | null): DailyRewardStatus {
  if (!claim) {
    return { canClaim: true, currentStreak: 0, nextReward: 1, hoursUntilNext: null };
  }

  const hoursSince = (Date.now() - claim.lastClaimedAt.toMillis()) / 3_600_000;

  if (hoursSince < MIN_HOURS) {
    return {
      canClaim: false,
      currentStreak: claim.streak,
      nextReward: hoursSince < STREAK_RESET_HOURS ? Math.min(claim.streak + 1, MAX_STREAK) : 1,
      hoursUntilNext: MIN_HOURS - hoursSince,
    };
  }

  const nextStreak = hoursSince < STREAK_RESET_HOURS
    ? Math.min(claim.streak + 1, MAX_STREAK)
    : 1;

  return { canClaim: true, currentStreak: claim.streak, nextReward: nextStreak, hoursUntilNext: null };
}

// ─── Firestore fetch ──────────────────────────────────────────────────────────

export async function fetchDailyRewardStatus(uid: string): Promise<DailyRewardStatus> {
  const snap = await getDoc(doc(db, 'dailyRewardClaims', uid));
  return computeRewardStatus(snap.exists() ? (snap.data() as DailyRewardClaim) : null);
}

// ─── Claim (atomic transaction) ───────────────────────────────────────────────
//
// Security layers:
//   1. Client-side: timing validated before writing
//   2. Firestore transaction: atomic, no race conditions
//   3. serverTimestamp(): server sets lastClaimedAt — client cannot fake it
//   4. Firestore Rules on /dailyRewardClaims/{uid}: enforce 20h window server-side
//
export async function claimDailyReward(uid: string): Promise<{ newStreak: number; tokensEarned: number }> {
  const claimRef = doc(db, 'dailyRewardClaims', uid);
  const userRef  = doc(db, 'users', uid);
  let result = { newStreak: 1, tokensEarned: 1 };

  await runTransaction(db, async (tx) => {
    const [claimSnap, userSnap] = await Promise.all([tx.get(claimRef), tx.get(userRef)]);

    if (!userSnap.exists()) throw new Error('USER_NOT_FOUND');

    const currentBalance: number = userSnap.data().tokenBalance ?? 0;
    const claim = claimSnap.exists() ? (claimSnap.data() as DailyRewardClaim) : null;
    const hoursSince = claim
      ? (Date.now() - claim.lastClaimedAt.toMillis()) / 3_600_000
      : Infinity;

    // Client-side guard (Firestore Rules are the authoritative server-side check)
    if (hoursSince < MIN_HOURS) throw new Error('TOO_EARLY');

    const newStreak = !claim || hoursSince >= STREAK_RESET_HOURS
      ? 1
      : Math.min(claim.streak + 1, MAX_STREAK);
    const tokensEarned = newStreak;
    result = { newStreak, tokensEarned };

    // Write claim record — Firestore Rules enforce the 20h window server-side
    tx.set(claimRef, {
      streak: newStreak,
      lastClaimedAt: serverTimestamp(),
      totalTokensEarned: (claim?.totalTokensEarned ?? 0) + tokensEarned,
    });

    // Mirror streak info on user doc and credit tokens atomically
    tx.update(userRef, {
      tokenBalance: currentBalance + tokensEarned,
      loginStreak: newStreak,
      lastLoginReward: serverTimestamp(),
    });
  });

  return result;
}
