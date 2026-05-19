import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { NotificationType } from '@/types/equippe';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  teamId?: string;
  teamName?: string;
  requestId?: string;
  messageId?: string;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  senderPhotoURL?: string;
  referralId?: string;
  inviteId?: string;
  accepted?: boolean;
  listingId?: string;
  offerId?: string;
  connectionId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const notificationsRef = collection(db, 'notifications');
    // Filtra i valori undefined per evitare errori Firestore
    const cleanParams: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        cleanParams[key] = value;
      }
    }
    await addDoc(notificationsRef, {
      ...cleanParams,
      read: false,
      createdAt: Timestamp.now()
    });
    console.log('✅ Notifica creata per', params.userId);
  } catch (error) {
    console.error('❌ Errore creazione notifica:', error);
    throw error;
  }
}

// Helper specifici per ogni tipo di notifica

export async function notifyTeamRequest(teamId: string, teamName: string, adminIds: string[], requesterId: string, requesterName: string, requesterPhotoURL?: string) {
  try {
    // Notifica tutti gli admin dell'equipe
    await Promise.all(
      adminIds.map(adminId =>
        createNotification({
          userId: adminId,
          type: 'team_request',
          title: 'Nuova richiesta di adesione',
          message: `${requesterName} ha richiesto di entrare in "${teamName}"`,
          teamId,
          teamName,
          senderId: requesterId,
          senderName: requesterName,
          senderPhotoURL: requesterPhotoURL
        })
      )
    );
  } catch (error) {
    console.error('Errore notifyTeamRequest:', error);
  }
}

export async function notifyNewMessage(conversationId: string, messageId: string, senderId: string, senderName: string, senderPhotoURL: string | undefined, recipientIds: string[], messagePreview: string) {
  try {
    // Notifica tutti i partecipanti tranne il mittente
    await Promise.all(
      recipientIds
        .filter(id => id !== senderId)
        .map(recipientId =>
          createNotification({
            userId: recipientId,
            type: 'message',
            title: `Nuovo messaggio da ${senderName}`,
            message: messagePreview.substring(0, 100),
            conversationId,
            messageId,
            senderId,
            senderName,
            senderPhotoURL
          })
        )
    );
  } catch (error) {
    console.error('Errore notifyNewMessage:', error);
  }
}

export async function notifyTeamRequestAccepted(userId: string, teamId: string, teamName: string) {
  try {
    await createNotification({
      userId,
      type: 'team_request_accepted',
      title: 'Richiesta accettata!',
      message: `La tua richiesta per entrare in "${teamName}" è stata accettata`,
      teamId,
      teamName,
      accepted: true
    });
  } catch (error) {
    console.error('Errore notifyTeamRequestAccepted:', error);
  }
}

export async function notifyTeamRemoval(userId: string, teamId: string, teamName: string) {
  try {
    await createNotification({
      userId,
      type: 'team_removed',
      title: 'Rimosso da equipe',
      message: `Sei stato rimosso da "${teamName}"`,
      teamId,
      teamName
    });
  } catch (error) {
    console.error('Errore notifyTeamRemoval:', error);
  }
}

export async function notifyTeamAdminPromotion(userId: string, teamId: string, teamName: string) {
  try {
    await createNotification({
      userId,
      type: 'team_admin',
      title: 'Promosso ad amministratore',
      message: `Sei stato promosso amministratore di "${teamName}"`,
      teamId,
      teamName
    });
  } catch (error) {
    console.error('Errore notifyTeamAdminPromotion:', error);
  }
}

export async function notifyTeamInviteResponse(targetUserId: string, recipientName: string, teamName: string, accepted: boolean, inviteId: string, responderId?: string) {
  try {
    await createNotification({
      userId: targetUserId,
      type: 'team_invite_response',
      title: accepted ? 'Invito accettato' : 'Invito rifiutato',
      message: `${recipientName} ha ${accepted ? 'accettato' : 'rifiutato'} l'invito per "${teamName}"`,
      teamName,
      senderName: recipientName,
      senderId: responderId,
      inviteId,
      accepted
    });
  } catch (error) {
    console.error('Errore notifyTeamInviteResponse:', error);
  }
}

export async function notifyReferralReceived(recipientId: string, senderId: string, senderName: string, senderPhotoURL: string | undefined, patientName: string, referralId: string) {
  try {
    await createNotification({
      userId: recipientId,
      type: 'referral_received',
      title: 'Nuova referral ricevuta',
      message: `${senderName} ti ha inviato una referral per ${patientName}`,
      senderId,
      senderName,
      senderPhotoURL,
      referralId
    });
  } catch (error) {
    console.error('Errore notifyReferralReceived:', error);
  }
}

export async function notifyReferralAccepted(senderId: string, recipientId: string, recipientName: string, recipientPhotoURL: string | undefined, patientName: string, referralId: string) {
  try {
    await createNotification({
      userId: senderId,
      type: 'referral_accepted',
      title: 'Referral accettata',
      message: `${recipientName} ha accettato la presa in carico di ${patientName}`,
      senderId: recipientId,
      senderName: recipientName,
      senderPhotoURL: recipientPhotoURL,
      referralId,
      accepted: true
    });
  } catch (error) {
    console.error('Errore notifyReferralAccepted:', error);
  }
}

export async function notifyTeamMemberLeft(adminIds: string[], memberName: string, teamId: string, teamName: string, memberId?: string) {
  try {
    // Notifica tutti gli admin dell'equipe
    await Promise.all(
      adminIds.map(adminId =>
        createNotification({
          userId: adminId,
          type: 'team_removed',
          title: 'Membro uscito dall\'equipe',
          message: `${memberName} ha lasciato "${teamName}"`,
          teamId,
          teamName,
          senderName: memberName,
          senderId: memberId
        })
      )
    );
  } catch (error) {
    console.error('Errore notifyTeamMemberLeft:', error);
  }
}

export async function notifyTeamInviteReceived(recipientId: string, teamId: string, teamName: string, senderName: string, inviteId: string, senderId?: string) {
  try {
    await createNotification({
      userId: recipientId,
      type: 'team_invite_received',
      title: 'Invito a equipe',
      message: `${senderName} ti ha invitato a unirti a "${teamName}"`,
      teamId,
      teamName,
      senderName,
      senderId,
      inviteId
    });
  } catch (error) {
    console.error('Errore notifyTeamInviteReceived:', error);
  }
}

// ============================================
// MARKETPLACE NOTIFICATIONS
// ============================================

export async function notifyMarketplaceOfferReceived(
  authorId: string,
  offererName: string,
  offerAmount: number,
  listingTitle: string,
  listingId: string,
  offerId: string,
) {
  try {
    await createNotification({
      userId: authorId,
      type: 'marketplace_offer_received',
      title: 'Nuova offerta ricevuta',
      message: `${offererName} ha inviato un'offerta di ${offerAmount}€ per "${listingTitle}"`,
      senderName: offererName,
      listingId,
      offerId,
    });
  } catch (error) {
    console.error('Errore notifyMarketplaceOfferReceived:', error);
  }
}

export async function notifyMarketplaceOfferOutcome(
  offererId: string,
  status: 'accepted' | 'rejected',
  listingTitle: string,
  listingId: string,
  offerId: string,
) {
  try {
    await createNotification({
      userId: offererId,
      type: status === 'accepted' ? 'marketplace_offer_accepted' : 'marketplace_offer_rejected',
      title: status === 'accepted' ? '✅ Offerta accettata!' : '❌ Offerta rifiutata',
      message: status === 'accepted'
        ? `La tua offerta per "${listingTitle}" è stata accettata`
        : `La tua offerta per "${listingTitle}" è stata rifiutata`,
      listingId,
      offerId,
    });
  } catch (error) {
    console.error('Errore notifyMarketplaceOfferOutcome:', error);
  }
}

// ============================================
// FIREBASE CLOUD MESSAGING (Push Notifications)
// ============================================

let messagingInstance: Messaging | null = null;

/**
 * Inizializza Firebase Cloud Messaging
 * Deve essere chiamato solo nel browser, non durante SSR
 */
export function initializeMessaging(): Messaging | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging();
    } catch (error) {
      console.error('Errore inizializzazione FCM:', error);
      return null;
    }
  }

  return messagingInstance;
}

/**
 * Richiede il permesso per le notifiche e ottiene il token FCM
 * @returns FCM token o null se negato/errore
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('Notifiche non supportate in questo browser');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Permesso notifiche negato');
      return null;
    }

    const messaging = initializeMessaging();
    if (!messaging) {
      console.error('Impossibile inizializzare messaging');
      return null;
    }

    // Registra service worker
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registrato:', registration);
    }

    // Ottieni token FCM
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });

    if (token) {
      console.log('✅ FCM Token ottenuto:', token);
      return token;
    } else {
      console.log('Nessun token disponibile');
      return null;
    }
  } catch (error) {
    console.error('Errore richiesta permesso notifiche:', error);
    return null;
  }
}

/**
 * Listener per i messaggi in foreground
 * @param callback Funzione da chiamare quando arriva un messaggio
 */
export function onMessageListener(callback: (payload: any) => void) {
  const messaging = initializeMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('Messaggio ricevuto in foreground:', payload);
    callback(payload);
  });
}

/**
 * Salva il token FCM nel profilo utente
 * @param userId ID dell'utente
 * @param token FCM token
 */
export async function saveFCMToken(userId: string, token: string) {
  try {
    const { doc, updateDoc } = await import('firebase/firestore');
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      fcmToken: token,
      fcmTokenUpdatedAt: Timestamp.now()
    });

    console.log('✅ Token FCM salvato per utente:', userId);
  } catch (error) {
    console.error('Errore salvataggio token FCM:', error);
  }
}

/**
 * Aggiorna il badge numerico sull'icona dell'app (PWA installata)
 * Usa la Badging API supportata su Android Chrome, iOS Safari 16.4+, Windows/macOS
 * @param count Numero di notifiche non lette (0 per rimuovere il badge)
 */
export async function updateAppBadge(count: number) {
  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);
        console.log(`🔴 Badge app aggiornato: ${count}`);
      } else {
        await (navigator as any).clearAppBadge();
        console.log('⚪ Badge app rimosso');
      }
    }
  } catch (error) {
    console.error('Errore aggiornamento badge app:', error);
  }
}

/**
 * Rimuove il badge dall'icona dell'app
 */
export async function clearAppBadge() {
  try {
    if ('clearAppBadge' in navigator) {
      await (navigator as any).clearAppBadge();
      console.log('⚪ Badge app rimosso');
    }
  } catch (error) {
    console.error('Errore rimozione badge app:', error);
  }
}

