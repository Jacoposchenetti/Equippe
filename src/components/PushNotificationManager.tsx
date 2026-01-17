'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { requestNotificationPermission, saveFCMToken, onMessageListener } from '@/lib/notifications';

export default function PushNotificationManager() {
  const { user, userProfile } = useAuth();
  const pathname = usePathname();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      
      // Non mostrare nelle pagine di login/register
      if (pathname === '/login' || pathname === '/register' || pathname === '/') {
        return;
      }
      
      // Controlla se l'utente ha già rifiutato nelle ultime 24 ore
      const lastPrompt = localStorage.getItem('lastNotificationPrompt');
      if (lastPrompt) {
        const hoursSinceLastPrompt = (Date.now() - parseInt(lastPrompt)) / (1000 * 60 * 60);
        if (hoursSinceLastPrompt < 24) {
          console.log(`Notifiche richieste di nuovo tra ${Math.round(24 - hoursSinceLastPrompt)} ore`);
          return;
        }
      }
      
      // Mostra il prompt dopo 10 secondi se non è mai stato chiesto (o è stato rifiutato) E se l'utente ha un profilo completo
      if ((Notification.permission === 'default' || Notification.permission === 'denied') && user && userProfile) {
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 10000); // 10 secondi
        
        return () => clearTimeout(timer);
      }
    }
  }, [user, userProfile, pathname]);

  useEffect(() => {
    if (!user) return;

    // Setup listener per messaggi in foreground
    const unsubscribe = onMessageListener((payload) => {
      console.log('Notifica ricevuta:', payload);
      
      // Mostra una notifica browser se l'app è in foreground
      if (Notification.permission === 'granted') {
        new Notification(payload.notification?.title || 'Equipé', {
          body: payload.notification?.body,
          icon: '/icon-192x192.png',
          badge: '/icon-72x72.png',
          tag: payload.data?.notificationId,
          data: payload.data
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user]);

  const handleEnableNotifications = async () => {
    if (!user) return;

    const token = await requestNotificationPermission();
    
    if (token) {
      await saveFCMToken(user.uid, token);
      setPermission('granted');
      setShowPrompt(false);
      
      // Mostra conferma
      alert('🔔 Notifiche push abilitate con successo!');
    } else {
      setPermission(Notification.permission);
      setShowPrompt(false);
      // Se è stato rifiutato, salva timestamp per riprovare tra 24h
      if (Notification.permission === 'denied') {
        localStorage.setItem('lastNotificationPrompt', Date.now().toString());
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Richiedi di nuovo tra 24 ore
    localStorage.setItem('lastNotificationPrompt', Date.now().toString());
  };

  if (!showPrompt || permission === 'granted') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white rounded-lg shadow-2xl border-2 border-blue-500 p-6 animate-slide-up" style={{ zIndex: 9999 }}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 mb-2">Abilita le Notifiche Push</h3>
          <p className="text-sm text-gray-600 mb-4">
            Ricevi notifiche istantanee per messaggi, inviti e richieste da équipe
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={handleEnableNotifications}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Abilita
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
            >
              Dopo
            </button>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
