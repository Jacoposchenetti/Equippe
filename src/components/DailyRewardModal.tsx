import { useState } from 'react';
import { claimDailyReward, DailyRewardStatus } from '@/lib/dailyReward';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';

interface Props {
  status: DailyRewardStatus;
  onClose: () => void;
  onClaimed: (newStreak: number, tokensEarned: number) => void;
}

const MAX_STREAK = 10;

export default function DailyRewardModal({ status, onClose, onClaimed }: Props) {
  const { user, refreshUserProfile } = useAuth();
  const { showToast } = useModal();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimResult, setClaimResult] = useState<{ newStreak: number; tokensEarned: number } | null>(null);

  const handleClaim = async () => {
    if (!user || claiming) return;
    setClaiming(true);
    try {
      const result = await claimDailyReward(user.uid);
      await refreshUserProfile();
      setClaimResult(result);
      setClaimed(true);
      onClaimed(result.newStreak, result.tokensEarned);
    } catch (err: any) {
      if (err.message === 'TOO_EARLY') {
        showToast('Hai già ritirato il premio oggi.', 'info');
      } else {
        showToast('Errore nel ritiro del premio. Riprova.', 'error');
      }
    } finally {
      setClaiming(false);
    }
  };

  // Visual state: how many days to show as "done" and which is "today"
  const displayStreak = claimed && claimResult ? claimResult.newStreak : status.nextReward;
  const completedDays = claimed && claimResult ? claimResult.newStreak : status.nextReward - 1;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg select-none">
              🔥
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">Accesso giornaliero</h2>
              <p className="text-xs text-gray-400 mt-0.5">Torna ogni giorno per guadagnare token</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Day progress */}
        <div className="px-6 pb-4">
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_STREAK }, (_, i) => {
              const day = i + 1;
              const isDone = day <= completedDays;
              const isToday = day === displayStreak;
              return (
                <div
                  key={day}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isDone
                      ? 'bg-blue-600 text-white'
                      : isToday
                      ? 'bg-amber-400 text-white ring-2 ring-amber-300'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <span className="leading-none">{day}</span>
                  {isDone && (
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {isToday && !isDone && <span className="text-[8px] leading-none">oggi</span>}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5 px-0.5">
            <span className="text-[10px] text-gray-400">1 giorno</span>
            <span className="text-[10px] text-gray-400">10 giorni</span>
          </div>
        </div>

        {/* Reward box */}
        <div className="px-6 pb-6">
          {claimed && claimResult ? (
            <div className="text-center py-4">
              <p className="text-3xl font-bold text-gray-900 mb-1">
                +{claimResult.tokensEarned}
                <span className="text-amber-500 ml-1 text-2xl">T</span>
              </p>
              <p className="text-sm text-gray-500 mb-1">Premio ritirato!</p>
              {claimResult.newStreak === MAX_STREAK && (
                <p className="text-xs text-amber-600 font-medium mt-1">🏆 Streak massima raggiunta!</p>
              )}
              <button
                onClick={onClose}
                className="mt-4 w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
              >
                Ottimo!
              </button>
            </div>
          ) : status.canClaim ? (
            <>
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
                <p className="text-xs text-gray-400 mb-1">Premio di oggi · giorno {status.nextReward}</p>
                <p className="text-3xl font-bold text-gray-900">
                  +{status.nextReward}
                  <span className="text-amber-500 ml-1 text-2xl">T</span>
                </p>
                {status.currentStreak > 0 && status.nextReward > 1 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Streak attiva: {status.currentStreak} {status.currentStreak === 1 ? 'giorno' : 'giorni'} di fila
                  </p>
                )}
              </div>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {claiming ? 'Ritiro in corso…' : 'Ritira il premio'}
              </button>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Hai già ritirato il premio oggi
              </p>
              <p className="text-xs text-gray-400 mb-1">
                Streak attuale: <strong>{status.currentStreak}</strong> {status.currentStreak === 1 ? 'giorno' : 'giorni'}
              </p>
              {status.hoursUntilNext !== null && (
                <p className="text-xs text-gray-400">
                  Torna tra{' '}
                  <strong>
                    {Math.ceil(status.hoursUntilNext)}h
                  </strong>
                </p>
              )}
              <button
                onClick={onClose}
                className="mt-4 w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Chiudi
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
