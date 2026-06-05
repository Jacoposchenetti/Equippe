'use client';

import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import NotificationBell from './NotificationBell';
import TokenBalance from './TokenBalance';
import { useCanInteract } from '@/hooks/useCanInteract';
import { useSidebar } from '@/contexts/SidebarContext';

export default function Header() {
  const { user, userProfile, signOut, isAdminViewActive } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { canInteract } = useCanInteract();
  const { isOpen, toggle, close } = useSidebar();
  const handleNavClick = () => { if (window.innerWidth < 1024) close(); };
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);

  useEffect(() => { setUnreadMessages(0); }, [user, userProfile]);

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
      return userProfile.profile.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const isAdmin = isAdminViewActive;

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', badge: 0 },
    { href: '/teams', label: 'Equipe', badge: pendingInvites },
    { href: '/connections', label: 'Connessioni', badge: 0 },
    { href: '/referrals', label: 'Pazienti', badge: 0 },
    { href: '/messages', label: 'Messaggi', badge: unreadMessages },
    { href: '/appuntamenti', label: 'Agenda', badge: 0 },
    { href: '/ecm', label: 'ECM', badge: 0 },
    { href: '/fatturazione', label: 'Fatture', badge: 0 },
    { href: '/marketplace', label: 'Marketplace', badge: 0 },
  ];

  const navIcons: Record<string, JSX.Element> = {
    '/dashboard': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
    '/teams': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    '/connections': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    '/referrals': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    '/messages': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    '/appuntamenti': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    '/ecm': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    '/fatturazione': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    '/marketplace': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#1d2540] text-white flex items-center justify-between px-4 z-20 shadow-lg border-b border-white/10">
        <button onClick={toggle} className="p-2 rounded-xl hover:bg-white/10 transition" aria-label="Menu">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl overflow-hidden bg-white p-1">
            <img src="/logo_senza_scritta.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <span className="font-bold text-sm">
            <span className="text-blue-400">tua</span><span className="text-green-400">equipe</span><span className="text-orange-400">.it</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <TokenBalance />
          <NotificationBell />
        </div>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/35 backdrop-blur-sm z-30 lg:hidden" onClick={close} />
      )}

      {/* Desktop: floating tab when sidebar closed */}
      {!isOpen && (
        <button
          onClick={toggle}
          className="hidden lg:flex fixed top-1/2 -translate-y-1/2 left-0 z-50 p-2 bg-[#1d2540] text-white rounded-r-xl shadow-lg hover:bg-[#263151] transition"
          aria-label="Apri menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <aside className={`fixed top-0 left-0 h-full w-72 bg-[#1d2540] text-white z-40 flex flex-col shadow-2xl border-r border-white/10 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
      {/* Logo + toggle button */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="h-9 w-9 rounded-xl overflow-hidden bg-white p-1">
            <img src="/logo_senza_scritta.png" alt="tuaequipe.it Logo" className="h-full w-full object-contain" />
          </div>
          <span className="font-bold text-base">
            <span className="text-blue-400">tua</span>
            <span className="text-green-400">equipe</span>
            <span className="text-orange-400">.it</span>
          </span>
        </Link>
        <button
          onClick={toggle}
          className="p-1.5 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition"
          aria-label="Chiudi menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* User info + token + bell */}
      <div className="px-5 py-4 border-b border-white/10 bg-[#243052]/70">

        <div className="flex items-center gap-3 mb-2">
          {userProfile?.profile?.photoURL ? (
            <img src={userProfile.profile.photoURL} alt={userProfile.profile.nome} className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shrink-0" />
          ) : (
            <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
              {getInitials()}
            </div>
          )}
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">{userProfile?.profile?.nome || 'Utente'}</p>
            <p className="text-xs text-slate-300 truncate">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <TokenBalance />
          <NotificationBell />
        </div>
      </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto py-3 sidebar-nav">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            const isDisabled = !canInteract && link.href === '/messages';
            if (isDisabled) {
              return (
                <div key={link.href} className="mx-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-500 opacity-60 cursor-not-allowed">
                  {navIcons[link.href]}
                  <span className="text-sm font-medium">{link.label}</span>
                </div>
              );
            }
            return (
              <Link
                key={link.href}
                to={link.href}
                onClick={handleNavClick}
                className={`mx-3 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors relative ${
                  isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                {navIcons[link.href]}
                <span className="text-sm font-medium">{link.label}</span>
                {link.badge > 0 && (
                  <span className="ml-auto px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                    {link.badge > 9 ? '9+' : link.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Admin links */}
          {isAdmin && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="px-5 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Admin</p>
              {[
                { href: '/admin/verifications', label: 'Verifiche' },
                { href: '/admin/analytics', label: 'Analytics UX' },
                { href: '/admin/mailing-list', label: 'Mailing List' },
                { href: '/admin/waitlist-email', label: 'Email WL' },
              ].map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={handleNavClick}
                  className={`mx-3 flex items-center rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    pathname === link.href ? 'bg-yellow-500 text-[#1d2540]' : 'text-yellow-300 hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* Bottom: profile + logout */}
        <div className="border-t border-white/10 bg-[#243052]/70 p-3 space-y-1">
          <Link
            to="/profile/edit"
            onClick={handleNavClick}
            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 rounded-xl transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Il Mio Profilo
          </Link>
          <Link
            to="/abbonamento"
            onClick={handleNavClick}
            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 rounded-xl transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Abbonamento
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-300 hover:bg-white/10 rounded-xl transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Esci
          </button>
        </div>
    </aside>
    </>
  );
}
