'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Conversation } from '@/types/equippe';
import NotificationBell from './NotificationBell';

export default function Header() {
  const { user, userProfile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Conta messaggi non letti - disabilitato temporaneamente per evitare errori di permessi
  // Il contatore funzionerà correttamente quando si entra nella pagina messaggi
  useEffect(() => {
    // Disabilitato per evitare permission errors al caricamento della pagina
    setUnreadMessages(0);
  }, [user, userProfile]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const getInitials = () => {
    if (userProfile?.profile?.nome) {
      const names = userProfile.profile.nome.split(' ');
      return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', badge: 0 },
    { href: '/teams', label: 'Equipé', badge: 0 },
    { href: '/referrals', label: 'Referral', badge: 0 },
    { href: '/invites', label: 'Inviti', badge: 0 },
    { href: '/messages', label: 'Messaggi', badge: unreadMessages },
  ];

  return (
    <header className="bg-gray-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
            <div className="bg-blue-500 p-2 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold">Equippe</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition hover:text-blue-400 relative ${
                  pathname === link.href ? 'text-blue-400' : 'text-gray-300'
                }`}
              >
                {link.label}
                {link.badge > 0 && (
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* User Avatar and Notifications */}
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <NotificationBell />
            
            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 hover:opacity-80 transition"
              >
                {userProfile?.profile?.photoURL ? (
                  <img 
                    src={userProfile.profile.photoURL} 
                    alt={userProfile.profile.nome} 
                    className="w-10 h-10 rounded-full object-cover border-2 border-blue-500"
                  />
                ) : (
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold text-sm">
                    {getInitials()}
                  </div>
                )}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

            {/* Dropdown */}
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{userProfile?.profile?.nome}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <Link
                    href="/profile/edit"
                    onClick={() => setShowDropdown(false)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    ⚙️ Modifica Profilo
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    Esci
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
