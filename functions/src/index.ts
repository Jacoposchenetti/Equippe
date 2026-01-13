import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * Cloud Function che invia notifiche push quando viene creata una notifica in Firestore
 * Trigger: onCreate su collection 'notifications'
 */
export const sendPushNotification = functions
  .region('europe-west1')
  .firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.data();
    const notificationId = context.params.notificationId;

    console.log('📬 Nuova notifica creata:', notificationId, notification);

    try {
      // Ottieni il token FCM dell'utente destinatario
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(notification.userId)
        .get();

      if (!userDoc.exists) {
        console.log('❌ Utente non trovato:', notification.userId);
        return null;
      }

      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        console.log('⚠️ Nessun token FCM per utente:', notification.userId);
        return null;
      }

      // Costruisci il payload della notifica
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: notification.title,
          body: notification.message
        },
        data: {
          notificationId,
          type: notification.type,
          url: getNotificationUrl(notification)
        },
        webpush: {
          notification: {
            icon: '/icon-192x192.png',
            badge: '/icon-72x72.png',
            requireInteraction: true,
            tag: notificationId
          },
          fcmOptions: {
            link: getNotificationUrl(notification)
          }
        }
      };

      // Invia la notifica
      const response = await admin.messaging().send(message);
      console.log('✅ Notifica push inviata:', response);

      return response;
    } catch (error: any) {
      console.error('❌ Errore invio notifica push:', error);
      
      // Se il token è invalido, rimuovilo dal profilo utente
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        console.log('🗑️ Rimozione token FCM invalido');
        await admin.firestore()
          .collection('users')
          .doc(notification.userId)
          .update({
            fcmToken: admin.firestore.FieldValue.delete(),
            fcmTokenUpdatedAt: admin.firestore.FieldValue.delete()
          });
      }

      return null;
    }
  });

/**
 * Determina l'URL a cui portare l'utente quando clicca sulla notifica
 */
function getNotificationUrl(notification: any): string {
  const baseUrl = 'https://equippe-271f5.web.app'; // Cambia con il tuo dominio

  switch (notification.type) {
    case 'team_request':
      return `${baseUrl}/teams/${notification.teamId}`;
    
    case 'team_request_accepted':
    case 'team_removal':
    case 'team_admin_promotion':
      return `${baseUrl}/teams/${notification.teamId}`;
    
    case 'team_member_left':
      return `${baseUrl}/teams/${notification.teamId}`;
    
    case 'team_invite_response':
      return `${baseUrl}/invites`;
    
    case 'new_message':
      return `${baseUrl}/messages?conversation=${notification.conversationId}`;
    
    case 'referral_received':
    case 'referral_accepted':
      return `${baseUrl}/referrals/${notification.referralId}`;
    
    default:
      return `${baseUrl}/dashboard`;
  }
}

/**
 * Cloud Function per pulire token FCM vecchi (opzionale)
 * Esegue ogni giorno e rimuove token più vecchi di 60 giorni
 */
export const cleanupOldFCMTokens = functions
  .region('europe-west1')
  .pubsub
  .schedule('0 2 * * *') // Ogni giorno alle 2:00 AM
  .timeZone('Europe/Rome')
  .onRun(async (context) => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('fcmTokenUpdatedAt', '<', admin.firestore.Timestamp.fromDate(sixtyDaysAgo))
      .get();

    const batch = admin.firestore().batch();
    let count = 0;

    usersSnapshot.forEach(doc => {
      if (doc.data().fcmToken) {
        batch.update(doc.ref, {
          fcmToken: admin.firestore.FieldValue.delete(),
          fcmTokenUpdatedAt: admin.firestore.FieldValue.delete()
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`🗑️ Rimossi ${count} token FCM obsoleti`);
    }

    return null;
  });
