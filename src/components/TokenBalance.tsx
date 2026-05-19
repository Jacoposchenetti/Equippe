'use client';

import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function TokenBalance() {
  const { userProfile } = useAuth();

  if (!userProfile) return null;

  const balance = userProfile.tokenBalance ?? 0;

  return (
    <Link
      to="/connections"
      title="I tuoi token — usati per inviare richieste di connessione"
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition text-amber-300 text-sm font-semibold"
    >
      {/* Coin icon */}
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" opacity="0.3" />
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">T</text>
      </svg>
      <span>{balance}</span>
    </Link>
  );
}
