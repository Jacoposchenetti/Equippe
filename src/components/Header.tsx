'use client';

import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Conversation } from '@/types/equippe';
import NotificationBell from './NotificationBell';
import { useCanInteract } from '@/hooks/useCanInteract';

export default function Header() {
  const { user, userProfile, signOut } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { canInteract, message } = useCanInteract();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);

  // Conta messaggi non letti - disabilitato temporaneamente per evitare errori di permessi
  useEffect(() => {
    setUnreadMessages(0);
  }, [user, userProfile]);

  // Conta inviti pendenti in realtime
  useEffect(() => {
    if (!user) { setPendingInvites(0); return; }
    const q = query(
      collection(db, 'teamInvites'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => setPendingInvites(snap.size), () => setPendingInvites(0));
    return () => unsub();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = () => {
    if (userProfile?.profile?.nome) {
      const names = userProfile.profile.nome.split(' ');
      return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  // Link admin visibile solo per admin
  const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', badge: 0 },
    { href: '/teams', label: 'Equipe', badge: pendingInvites },
    { href: '/referrals', label: 'Pazienti', badge: 0 },
    { href: '/messages', label: 'Messaggi', badge: unreadMessages },
    { href: '/ecm', label: 'ECM', badge: 0 },
    ...(isAdmin ? [{ href: '/marketplace', label: 'Marketplace', badge: 0 }] : []),
  ];

  // Icons for bottom nav
  const navIcons: Record<string, JSX.Element> = {
    '/dashboard': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
    '/teams': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
      </svg>
    ),
    '/referrals': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    '/messages': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    '/ecm': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    '/marketplace': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  };

  return (
    <>
      <header className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 relative">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl overflow-hidden bg-white p-1">
                <img 
                  src="/logo_senza_scritta.png" 
                  alt="tuaequipe.it Logo" 
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="font-bold text-lg">
                <span className="text-blue-400">tua</span>
                <span className="text-green-400">equipe</span>
                <span className="text-orange-400">.it</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => {
                const isDisabled = !canInteract && (link.href === '/messages');
                return isDisabled ? (
                  <div
                    key={link.href}
                    className="text-sm font-medium text-gray-500 relative cursor-not-allowed opacity-50"
                    title={message || 'Funzionalità non disponibile'}
                  >
                    {link.label}
                    {link.badge > 0 && (
                      <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                        {link.badge}
                      </span>
                    )}
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    to={link.href}
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
                );
              })}
              
              {/* Admin links */}
              {isAdmin && (
                <>
                  <Link
                    to="/admin/verifications"
                    className={`text-sm font-medium transition hover:text-yellow-400 relative ${
                      pathname === '/admin/verifications' ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    Admin
                  </Link>
                  <Link
                    to="/admin/mailing-list"
                    className={`text-sm font-medium transition hover:text-yellow-400 relative ${
                      pathname === '/admin/mailing-list' ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    Mailing List
                  </Link>
                  <Link
                    to="/admin/waitlist-email"
                    className={`text-sm font-medium transition hover:text-yellow-400 relative ${
                      pathname === '/admin/waitlist-email' ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    Email WL
                  </Link>
                </>
              )}
            </nav>

            {/* Desktop User Area */}
            <div className="hidden md:flex items-center gap-4">
              <NotificationBell />
              
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

                {showDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">{userProfile?.profile?.nome}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <Link
                        to="/profile/edit"
                        onClick={() => setShowDropdown(false)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                      >
                        Il Mio Profilo
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

            {/* Mobile Controls: Bell + Profile Avatar */}
            <div className="md:hidden flex items-center gap-2">
              <NotificationBell />
              
              {/* Profile avatar for mobile */}
              <div className="relative">
                <button
                  onClick={() => setShowMobileProfileMenu(!showMobileProfileMenu)}
                  className="p-1 hover:opacity-80 transition"
                >
                  {userProfile?.profile?.photoURL ? (
                    <img 
                      src={userProfile.profile.photoURL} 
                      alt={userProfile.profile.nome} 
                      className="w-9 h-9 rounded-full object-cover border-2 border-blue-500"
                    />
                  ) : (
                    <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center font-bold text-xs">
                      {getInitials()}
                    </div>
                  )}
                </button>

                {showMobileProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMobileProfileMenu(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-xl z-20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">{userProfile?.profile?.nome || 'Utente'}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <Link
                        to="/profile/edit"
                        onClick={() => setShowMobileProfileMenu(false)}
                        className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Il Mio Profilo
                      </Link>
                      {isAdmin && (
                        <>
                          <Link
                            to="/admin/verifications"
                            onClick={() => setShowMobileProfileMenu(false)}
                            className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                          >
                            Admin
                          </Link>
                          <Link
                            to="/admin/mailing-list"
                            onClick={() => setShowMobileProfileMenu(false)}
                            className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                          >
                            Mailing List
                          </Link>
                          <Link
                            to="/admin/waitlist-email"
                            onClick={() => setShowMobileProfileMenu(false)}
                            className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                          >
                            Email WL
                          </Link>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setShowMobileProfileMenu(false);
                          handleLogout();
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition border-t border-gray-100"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
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

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            const isDisabled = !canInteract && (link.href === '/messages');
            
            if (isDisabled) {
              return (
                <div
                  key={link.href}
                  className="flex flex-col items-center justify-center flex-1 py-1 opacity-40 cursor-not-allowed relative"
                >
                  <div className="text-gray-400">
                    {navIcons[link.href]}
                  </div>
                  <span className="text-[10px] mt-0.5 text-gray-400 leading-tight">{link.label}</span>
                </div>
              );
            }

            return (
              <Link
                key={link.href}
                to={link.href}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
                  isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {navIcons[link.href]}
                <span className={`text-[10px] mt-0.5 leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {link.label}
                </span>
                {link.badge > 0 && (
                  <span className="absolute top-0 right-1/4 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] text-center leading-none">
                    {link.badge > 9 ? '9+' : link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for mobile bottom nav */}
      <div className="md:hidden h-4" />
    </>
  );
}
