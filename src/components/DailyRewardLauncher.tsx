import { useEffect, useState } from 'react';
import DailyRewardModal from '@/components/DailyRewardModal';
import { useAuth } from '@/contexts/AuthContext';
import { fetchDailyRewardStatus, DailyRewardStatus } from '@/lib/dailyReward';

export const DAILY_REWARD_OPEN_EVENT = 'equippe:open-daily-reward';

export function openDailyReward() {
  window.dispatchEvent(new Event(DAILY_REWARD_OPEN_EVENT));
}

export default function DailyRewardLauncher() {
  const { user } = useAuth();
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = async () => {
      if (!user) return;
      try {
        const nextStatus = await fetchDailyRewardStatus(user.uid);
        setStatus(nextStatus);
        setIsOpen(true);
      } catch {
        setStatus(null);
        setIsOpen(false);
      }
    };

    window.addEventListener(DAILY_REWARD_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(DAILY_REWARD_OPEN_EVENT, handleOpen);
  }, [user]);

  if (!isOpen || !status) return null;

  return (
    <DailyRewardModal
      status={status}
      onClose={() => setIsOpen(false)}
      onClaimed={(newStreak) => {
        setStatus((previous) => previous ? { ...previous, canClaim: false, currentStreak: newStreak } : previous);
      }}
    />
  );
}
