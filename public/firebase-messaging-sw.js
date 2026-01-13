// Service Worker per Firebase Cloud Messaging
// Gestisce le notifiche push in background

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configurazione Firebase (deve corrispondere a quella dell'app)
firebase.initializeApp({
  apiKey: "AIzaSyATt8ZmGZ9MFHjW3xAuGODu5LgA1L9rCZo",
  authDomain: "equippe-271f5.firebaseapp.com",
  projectId: "equippe-271f5",
  storageBucket: "equippe-271f5.firebasestorage.app",
  messagingSenderId: "956363253556",
  appId: "1:956363253556:web:fa3dab3fa5fe881cae08e5"
});

const messaging = firebase.messaging();

// Gestione notifiche in background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'Equippe';
  const notificationOptions = {
    body: payload.notification?.body || 'Hai una nuova notifica',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: payload.data?.notificationId || 'default',
    data: payload.data,
    requireInteraction: true,
    actions: payload.data?.actions ? JSON.parse(payload.data.actions) : []
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestione click sulla notifica
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se c'è già una finestra aperta, portala in primo piano
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
