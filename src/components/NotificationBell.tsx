"use client"

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import { Notification } from '@/types/equippe';
import { useNavigate } from 'react-router-dom';
import { updateAppBadge } from '@/lib/notifications';

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userPhotos, setUserPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;

    // Ascolta le notifiche dell'utente
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Notification));
        
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.read).length);
        
        // Recupera le foto profilo mancanti
        const senderIds = notifs
          .filter(n => n.senderId && (!n.senderPhotoURL || n.senderPhotoURL.trim() === ''))
          .map(n => n.senderId!)
          .filter((id, index, arr) => arr.indexOf(id) === index); // rimuovi duplicati
        
        if (senderIds.length > 0) {
          const photos: Record<string, string> = {};
          for (const senderId of senderIds) {
            try {
              const userDoc = await getDoc(doc(db, 'users', senderId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                const photoURL = userData.profile?.photoURL || userData.photoURL;
                if (photoURL) {
                  photos[senderId] = photoURL;
                }
              }
            } catch (error) {
              console.error('Errore recupero foto utente:', senderId, error);
            }
          }
          setUserPhotos(prev => ({ ...prev, ...photos }));
        }
      },
      (error) => {
        // Gestisci errore di permessi silenziosamente
        // (le regole devono essere aggiunte in Firebase Console)
        console.warn('⚠️ Notifiche non disponibili. Aggiungi le regole Firestore per la collezione notifications.');
        setNotifications([]);
        setUnreadCount(0);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Sincronizza il badge sull'icona dell'app con il conteggio notifiche non lette
  useEffect(() => {
    updateAppBadge(unreadCount);
  }, [unreadCount]);

  const markAsRead = async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true });
    } catch (error) {
      console.error('Errore marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifs.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }))
      );
    } catch (error) {
      console.error('Errore marking all as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id);
    setShowDropdown(false);

    // Naviga in base al tipo di notifica
    switch (notification.type) {
      case 'team_request':
        if (notification.teamId) navigate(`/teams/${notification.teamId}`);
        break;
      case 'message':
        if (notification.conversationId) navigate(`/messages?conversation=${notification.conversationId}`);
        break;
      case 'team_request_accepted':
      case 'team_removed':
      case 'team_admin':
        if (notification.teamId) navigate(`/teams/${notification.teamId}`);
        break;
      case 'team_invite_received':
        navigate('/invites');
        break;
      case 'team_invite_response':
        navigate('/teams');
        break;
      case 'referral_received':
      case 'referral_accepted':
        if (notification.referralId) navigate(`/referrals/${notification.referralId}`);
        break;
      case 'profession_verification_request':
        navigate('/admin/verifications?filter=with-pending-professions');
        break;
      case 'profession_approved':
      case 'profession_rejected':
        navigate('/profile/edit');
        break;
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'team_request':
        return 'Team';
      case 'message':
        return 'Msg';
      case 'team_request_accepted':
        return 'OK';
      case 'team_removed':
        return 'NO';
      case 'team_admin':
        return 'Info';
      case 'team_invite_response':
        return 'Inv';
      case 'team_invite_received':
        return 'Inv';
      case 'referral_received':
        return 'Ref';
      case 'referral_accepted':
        return 'OK';
      case 'profession_verification_request':
        return 'Doc';
      case 'profession_approved':
        return 'OK';
      case 'profession_rejected':
        return 'NO';
      default:
        return '🔔';
    }
  };

  const formatTimestamp = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Adesso';
    if (diffMins < 60) return `${diffMins}m fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays < 7) return `${diffDays}g fa`;
    return date.toLocaleDateString('it-IT');
  };

  if (!user) return null;

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => {
          const opening = !showDropdown;
          setShowDropdown(opening);
          if (opening && unreadCount > 0) {
            markAllAsRead();
          }
        }}
        className="relative p-2 text-white hover:text-blue-400 transition-colors"
        aria-label="Notifiche"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        {/* Badge per notifiche non lette */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Notifiche */}
      {showDropdown && (
        <>
          {/* Overlay per chiudere */}
          {/* Overlay per chiudere - visibile solo su desktop */}
          <div
            className="fixed inset-0 z-10 hidden sm:block"
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Full-screen su mobile, dropdown su desktop */}
          <div className="fixed inset-0 z-20 bg-white flex flex-col sm:absolute sm:inset-auto sm:right-0 sm:mt-2 sm:w-96 sm:rounded-lg sm:shadow-xl sm:max-h-[80vh]">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDropdown(false)}
                  className="sm:hidden p-1 -ml-1 text-gray-600 hover:text-gray-900"
                  aria-label="Chiudi"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-lg font-semibold text-gray-900">Notifiche</h3>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Segna tutte come lette
                </button>
              )}
            </div>

            {/* Lista Notifiche */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-sm">Nessuna notifica</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full p-3 sm:p-4 text-left hover:bg-gray-50 transition-colors ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex gap-2 sm:gap-3">
                        {/* Foto profilo del sender se disponibile, altrimenti icona */}
                        {(() => {
                          const photoURL = notification.senderPhotoURL || (notification.senderId ? userPhotos[notification.senderId] : null);
                          return photoURL && photoURL.trim() !== '' ? (
                            <img 
                              src={photoURL} 
                              alt={notification.senderName || 'Utente'} 
                              className="rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                              style={{ 
                                width: '40px', 
                                height: '40px',
                                minWidth: '40px',
                                minHeight: '40px'
                              }}
                              onError={(e) => {
                                // Se l'immagine non si carica, mostra l'iniziale
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                if (target.nextElementSibling) {
                                  (target.nextElementSibling as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                          ) : null;
                        })()}
                        <div 
                          className={`bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 overflow-hidden ${
                            (() => {
                              const photoURL = notification.senderPhotoURL || (notification.senderId ? userPhotos[notification.senderId] : null);
                              return photoURL && photoURL.trim() !== '' ? 'hidden' : '';
                            })()
                          }`}
                          style={{ 
                            width: '40px', 
                            height: '40px',
                            minWidth: '40px',
                            minHeight: '40px'
                          }}
                        >
                          {notification.senderName 
                            ? notification.senderName.charAt(0).toUpperCase() 
                            : <img src="/logo-equipe.png" alt="Equipe" className="w-full h-full object-cover" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs sm:text-sm ${!notification.read ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                            {notification.title}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 sm:mt-2">
                            {formatTimestamp(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1 sm:mt-2" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
