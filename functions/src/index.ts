import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

// ECM (Educazione Continua in Medicina) - ricerca corsi AGENAS
// ECM v3 - database locale con sync periodico da AGENAS
export { getECMDropdownValues, getECMDisciplines, getECMEventDetail, downloadECMProgramma, searchECMLive } from './ecm';
export { syncECMAutomatic, triggerECMSync, cleanupECMStaleEvents } from './ecmSync';

admin.initializeApp();

// Lazy initialization di Resend per evitare errori durante il deploy
let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

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
  const baseUrl = 'https://tuaequipe.it';

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
    
    case 'message':
    case 'new_message':
      return `${baseUrl}/messages?conversation=${notification.conversationId}`;
    
    case 'referral_received':
    case 'referral_accepted':
      return `${baseUrl}/referrals/${notification.referralId}`;
    
    case 'marketplace_offer_received':
    case 'marketplace_offer_accepted':
    case 'marketplace_offer_rejected':
      return `${baseUrl}/marketplace/my`;
    
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

/**
 * Cloud Function per inviare email di verifica professione
 * Trigger: quando un utente aggiunge una professione in pending
 */
export const sendProfessionVerificationEmail = functions
  .region('europe-west1')
  .firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const userId = context.params.userId;

    // Verifica se sono state aggiunte professioni pending
    const beforePending = before.profile?.professioniPending || [];
    const afterPending = after.profile?.professioniPending || [];

    if (afterPending.length <= beforePending.length) {
      return null; // Nessuna nuova professione pending
    }

    const newProfessioni = afterPending.slice(beforePending.length);
    const userDisplayName = `${after.profile?.nome || ''} ${after.profile?.cognome || ''}`.trim() || after.profile?.email || 'Un utente';
    const userPhoto = after.profile?.photoURL;

    const [adminByEmailSnapshot, adminByProfileEmailSnapshot] = await Promise.all([
      admin.firestore().collection('users').where('email', 'in', ADMIN_EMAILS).get(),
      admin.firestore().collection('users').where('profile.email', 'in', ADMIN_EMAILS).get(),
    ]);

    const adminIds = new Set<string>();
    adminByEmailSnapshot.forEach((doc) => adminIds.add(doc.id));
    adminByProfileEmailSnapshot.forEach((doc) => adminIds.add(doc.id));

    try {
      // Invia email all'admin
      for (const professione of newProfessioni) {
        await getResend().emails.send({
          from: EMAIL_FROM.noreply,
          to: ADMIN_EMAILS,
          subject: `Nuova richiesta verifica professione: ${professione.professione}`,
          html: wrapEmailTemplate(`
            <h2>Nuova Richiesta di Verifica Professione</h2>
            <p><strong>Utente:</strong> ${after.profile?.nome} ${after.profile?.cognome}</p>
            <p><strong>Email:</strong> ${after.profile?.email}</p>
            <p><strong>Professione:</strong> ${professione.professione}</p>
            <p><strong>Anni esperienza:</strong> ${professione.anniEsperienza || 'Non specificato'}</p>
            <h3>Documenti caricati:</h3>
            <ul>
              ${professione.documenti?.map((doc: any) => 
                `<li><strong>${doc.tipo}:</strong> ${doc.nome} - <a href="${doc.url}">Visualizza</a></li>`
              ).join('') || '<li>Nessun documento</li>'}
            </ul>
            <p><a href="https://tuaequipe.it/admin/verifications?filter=with-pending-professions">Vai al pannello di verifica</a></p>
          `),
        });

        if (adminIds.size > 0) {
          await Promise.all(
            Array.from(adminIds).map((adminId) =>
              createInternalNotification({
                userId: adminId,
                type: 'profession_verification_request',
                title: 'Nuova richiesta verifica professione',
                message: `${userDisplayName} ha inviato la professione "${professione.professione}" per verifica`,
                senderId: userId,
                senderName: userDisplayName,
                senderPhotoURL: userPhoto,
              })
            )
          );
        }
      }

      console.log('✅ Email verifica professione inviata per utente:', userId);
      return null;
    } catch (error) {
      console.error('❌ Errore invio email verifica professione:', error);
      return null;
    }
  });

/**
 * Cloud Function per inviare email quando una professione viene approvata
 */
export const sendProfessionApprovedEmail = functions
  .region('europe-west1')
  .https
  .onCall(async (data, context) => {
    // Verifica autenticazione
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }

    const { professione, userEmail, userName } = data;

    try {
      await getResend().emails.send({
        from: EMAIL_FROM.info,
        to: userEmail,
        subject: 'Professione Approvata - Equipe',
        html: wrapEmailTemplate(`
          <h2>Congratulazioni!</h2>
          <p>Ciao ${userName},</p>
          <p>La tua richiesta per la professione <strong>${professione}</strong> è stata approvata!</p>
          <p>Ora puoi utilizzare tutte le funzionalità della piattaforma per questa professione.</p>
          <p><a href="https://tuaequipe.it/profile/edit">Vai al tuo profilo</a></p>
          <br>
          <p>Il team di Equipe</p>
        `),
      });

      console.log('✅ Email approvazione professione inviata a:', userEmail);
      return { success: true };
    } catch (error) {
      console.error('❌ Errore invio email approvazione:', error);
      throw new functions.https.HttpsError('internal', 'Errore invio email');
    }
  });

/**
 * Cloud Function per inviare email quando una professione viene rifiutata
 */
export const sendProfessionRejectedEmail = functions
  .region('europe-west1')
  .https
  .onCall(async (data, context) => {
    // Verifica autenticazione
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }

    const { professione, userEmail, userName, motivo } = data;

    try {
      await getResend().emails.send({
        from: EMAIL_FROM.support,
        to: userEmail,
        subject: 'Richiesta Professione Non Approvata - Equipe',
        html: wrapEmailTemplate(`
          <h2>Richiesta Non Approvata</h2>
          <p>Ciao ${userName},</p>
          <p>La tua richiesta per la professione <strong>${professione}</strong> non è stata approvata.</p>
          ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
          <p>Se ritieni ci sia stato un errore o desideri fornire ulteriore documentazione, puoi contattarci a support@tuaequipe.it</p>
          <br>
          <p>Il team di Equipe</p>
        `),
      });

      console.log('✅ Email rifiuto professione inviata a:', userEmail);
      return { success: true };
    } catch (error) {
      console.error('❌ Errore invio email rifiuto:', error);
      throw new functions.https.HttpsError('internal', 'Errore invio email');
    }
  });

/**
 * Indirizzi email mittente (caselle Aruba)
 */
const EMAIL_FROM = {
  noreply: 'tuaequipe.it <noreply@tuaequipe.it>',
  info: 'tuaequipe.it <info@tuaequipe.it>',
  support: 'tuaequipe.it <support@tuaequipe.it>',
  admin: 'tuaequipe.it <admin@tuaequipe.it>',
};

/** Indirizzi admin per notifiche interne */
const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

/**
 * Wraps email body HTML with branded header (logo) and footer
 */
function wrapEmailTemplate(bodyHtml: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header con logo -->
      <div style="text-align: center; padding: 24px 0 16px 0; border-bottom: 2px solid #0066cc;">
        <a href="https://tuaequipe.it" target="_blank">
          <img src="https://tuaequipe.it/logo-equipe.png" alt="tuaequipe.it" style="height: 48px; width: auto;" />
        </a>
      </div>
      <!-- Body -->
      <div style="padding: 24px 20px;">
        ${bodyHtml}
      </div>
      <!-- Footer -->
      <div style="text-align: center; padding: 16px 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
        <p style="margin: 4px 0;">&copy; ${new Date().getFullYear()} tuaequipe.it &mdash; <a href="https://tuaequipe.it" style="color: #999;">tuaequipe.it</a></p>
        <p style="margin: 4px 0;">La piattaforma per professionisti sanitari</p>
      </div>
    </div>
  `;
}

/**
 * Funzione helper per inviare email
 * @param to - destinatario
 * @param subject - oggetto
 * @param html - corpo HTML (verrà wrappato con header logo e footer)
 * @param from - mittente (default: noreply@tuaequipe.it)
 */
async function sendEmail(to: string, subject: string, html: string, from?: string) {
  try {
    await getResend().emails.send({
      from: from || EMAIL_FROM.noreply,
      to,
      subject,
      html: wrapEmailTemplate(html),
    });
    console.log(`✅ Email inviata a ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`❌ Errore invio email a ${to}:`, error);
    return false;
  }
}

async function createInternalNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  senderId?: string;
  senderName?: string;
  senderPhotoURL?: string;
  [key: string]: any;
}) {
  try {
    await admin.firestore().collection('notifications').add({
      ...params,
      read: false,
      createdAt: admin.firestore.Timestamp.now(),
    });
  } catch (error) {
    console.error('❌ Errore creazione notifica interna:', error);
  }
}

/**
 * Cloud Function callable per inviare email di verifica indirizzo email via Resend
 * Genera il link di verifica con Firebase Admin SDK e lo invia tramite Resend
 */
export const sendCustomVerificationEmail = functions
  .region('europe-west1')
  .https
  .onCall(async (data, context) => {
    // L'utente deve essere autenticato
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }

    const uid = context.auth.uid;

    try {
      // Rate limit server-side: max 1 email di verifica ogni 60 secondi per utente
      const rateLimitRef = admin.firestore().collection('rateLimits').doc(`verification_${uid}`);
      const rateLimitDoc = await rateLimitRef.get();
      if (rateLimitDoc.exists) {
        const lastSent = rateLimitDoc.data()?.lastSentAt?.toMillis?.() || 0;
        const now = Date.now();
        if (now - lastSent < 60000) {
          const secondsLeft = Math.ceil((60000 - (now - lastSent)) / 1000);
          throw new functions.https.HttpsError('resource-exhausted', `Attendi ${secondsLeft} secondi prima di richiedere una nuova email di verifica`);
        }
      }

      // Ottieni l'utente da Firebase Auth
      const userRecord = await admin.auth().getUser(uid);

      if (userRecord.emailVerified) {
        return { success: true, alreadyVerified: true };
      }

      const email = userRecord.email;
      if (!email) {
        throw new functions.https.HttpsError('failed-precondition', 'Utente senza email');
      }

      // Genera il link di verifica email con Firebase Admin SDK
      const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
        url: 'https://tuaequipe.it/login?verified=true',
      });

      const displayName = userRecord.displayName || 'Utente';

      // Invia l'email tramite Resend
      await getResend().emails.send({
        from: EMAIL_FROM.noreply,
        to: email,
        subject: 'Verifica il tuo indirizzo email - equipe',
        html: wrapEmailTemplate(`
          <h2 style="color: #0066cc;">Verifica il tuo indirizzo email</h2>
          <p>Ciao ${displayName},</p>
          <p>Grazie per esserti registrato su <strong>equipe</strong>!</p>
          <p>Per completare la registrazione e accedere alla piattaforma, clicca sul pulsante qui sotto:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #0066cc; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 8px; display: inline-block;
                      font-weight: bold; font-size: 16px;">
              Verifica Email
            </a>
          </p>
          <p style="color: #666; font-size: 13px;">
            Se il pulsante non funziona, copia e incolla questo link nel tuo browser:<br>
            <a href="${verificationLink}" style="color: #0066cc; word-break: break-all;">${verificationLink}</a>
          </p>
          <p style="color: #666; font-size: 13px;">Se non hai creato un account su equipe, puoi ignorare questa email.</p>
          <br>
          <p>A presto,<br>Il team di equipe</p>
        `),
      });

      // Aggiorna rate limit dopo invio riuscito
      await rateLimitRef.set({ lastSentAt: admin.firestore.FieldValue.serverTimestamp() });

      console.log(`✅ Email verifica custom inviata a ${email} per utente ${uid}`);
      return { success: true };
    } catch (error: any) {
      // Ri-lancia errori di rate limiting senza wrapping
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      console.error('❌ Errore invio email verifica custom:', error);
      throw new functions.https.HttpsError('internal', 'Errore invio email di verifica');
    }
  });

/**
 * 1. Email di benvenuto quando viene verificata l'email
 * Trigger: onUpdate su users quando emailVerified passa a true
 */
export const sendWelcomeEmail = functions
  .region('europe-west1')
  .firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Controlla se emailVerified è appena diventato true
    if (!before.isApproved && after.isApproved) {
      const { email, profile } = after;
      const nome = profile?.nome || 'Utente';

      await sendEmail(
        email,
        'Benvenuto su Equipe! 🎉',
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">Benvenuto su Equipe, ${nome}! 🎉</h2>
            <p>Siamo felici di averti nella nostra community di professionisti!</p>
            <p>Il tuo account è stato verificato e ora puoi iniziare a:</p>
            <ul>
              <li>Completare il tuo profilo professionale</li>
              <li>Cercare altri professionisti nella tua area</li>
              <li>Creare o unirti a team multidisciplinari</li>
              <li>Inviare e ricevere referral</li>
            </ul>
            <p style="text-align: center; margin: 30px 0;">
              <a href="https://tuaequipe.it/dashboard" 
                 style="background-color: #0066cc; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Vai alla Dashboard
              </a>
            </p>
            <p>Se hai domande o hai bisogno di supporto, non esitare a contattarci.</p>
            <br>
            <p>A presto,<br>Il team di Equipe</p>
          </div>
        `,
        EMAIL_FROM.info
      );
    }

    return null;
  });

/**
 * 2. Email approvazione/rifiuto documentazione professione
 * Trigger: onUpdate su users quando cambia lo stato di professioniConDocumenti o professioniPending
 */
export const sendProfessionStatusEmail = functions
  .region('europe-west1')
  .firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const { email, profile } = after;
    const nome = profile?.nome || 'Utente';

    // Controlla se una professione è stata approvata (spostata da pending ad approvata)
    const beforePending = before.profile?.professioniPending || [];
    const afterPending = after.profile?.professioniPending || [];
    const afterApprovate = after.profile?.professioniConDocumenti || [];

    // Professione approvata
    if (beforePending.length > afterPending.length) {
      const approvataNuova = afterApprovate.find((prof: any) =>
        !before.profile?.professioniConDocumenti?.some((p: any) => p.professione === prof.professione)
      );

      if (approvataNuova) {
        await sendEmail(
          email,
          `✅ Professione Approvata: ${approvataNuova.professione}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #28a745;">Professione Approvata! ✅</h2>
              <p>Ciao ${nome},</p>
              <p>La tua documentazione per la professione <strong>${approvataNuova.professione}</strong> è stata verificata e approvata!</p>
              <p>Ora questa professione è visibile nel tuo profilo pubblico e potrai:</p>
              <ul>
                <li>Essere trovato nelle ricerche per questa specializzazione</li>
                <li>Selezionare le tematiche d'interesse specifiche</li>
                <li>Unirti a team che cercano questa figura professionale</li>
              </ul>
              <p style="text-align: center; margin: 30px 0;">
                <a href="https://tuaequipe.it/profile/edit" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                  Visualizza Profilo
                </a>
              </p>
              <p>Continua a costruire la tua presenza professionale su Equipe!</p>
              <br>
              <p>Il team di Equipe</p>
            </div>
          `,
          EMAIL_FROM.info
        );

        await createInternalNotification({
          userId: context.params.userId,
          type: 'profession_approved',
          title: 'Professione approvata',
          message: `La tua professione "${approvataNuova.professione}" è stata approvata`,
        });
      }
    }

    // Controlla se c'è una professione rifiutata (rimossa da pending senza essere aggiunta ad approvate)
    const professioneRimossa = beforePending.find((prof: any) => 
      !afterPending.some((p: any) => p.professione === prof.professione) &&
      !afterApprovate.some((p: any) => p.professione === prof.professione)
    );

    if (professioneRimossa) {
      await sendEmail(
        email,
        `Documentazione ${professioneRimossa.professione} - Verifica Necessaria`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Documentazione Professione</h2>
            <p>Ciao ${nome},</p>
            <p>Abbiamo esaminato la documentazione per la professione <strong>${professioneRimossa.professione}</strong>.</p>
            <p>Purtroppo non siamo riusciti a verificare i documenti forniti. Questo può accadere per diversi motivi:</p>
            <ul>
              <li>Documenti non leggibili o incompleti</li>
              <li>Numero di iscrizione all'albo non corrispondente</li>
              <li>Documentazione non conforme ai requisiti richiesti</li>
            </ul>
            <p>Ti invitiamo a riprovare caricando nuovamente la documentazione corretta.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="https://tuaequipe.it/profile/edit" 
                 style="background-color: #0066cc; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Aggiungi Nuovamente
              </a>
            </p>
            <p>Se hai bisogno di assistenza, non esitare a contattarci a support@tuaequipe.it.</p>
            <br>
            <p>Il team di Equipe</p>
          </div>
        `,
        EMAIL_FROM.support
      );

      await createInternalNotification({
        userId: context.params.userId,
        type: 'profession_rejected',
        title: 'Professione non approvata',
        message: `La tua professione "${professioneRimossa.professione}" richiede nuova documentazione`,
      });
    }

    return null;
  });

/**
 * 3. Email notifica nuovo messaggio privato
 * Trigger: onCreate su messages (collection top-level)
 */
export const sendNewMessageEmail = functions
  .region('europe-west1')
  .firestore
  .document('messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const conversationId = message.conversationId;

    if (!conversationId) return null;

    // Ottieni conversazione
    const conversationDoc = await admin.firestore()
      .collection('conversations')
      .doc(conversationId)
      .get();

    if (!conversationDoc.exists) return null;

    const conversation = conversationDoc.data();
    
    // Se è un messaggio di gruppo (team), salta (gestito da altra funzione)
    if (conversation?.teamId || conversation?.type === 'team') return null;

    // Determina il destinatario (l'altro partecipante)
    const recipientId = conversation?.participants.find((id: string) => id !== message.senderId);
    if (!recipientId) return null;

    // Ottieni dati mittente e destinatario
    const [senderDoc, recipientDoc] = await Promise.all([
      admin.firestore().collection('users').doc(message.senderId).get(),
      admin.firestore().collection('users').doc(recipientId).get(),
    ]);

    if (!senderDoc.exists || !recipientDoc.exists) return null;

    const sender = senderDoc.data();
    const recipient = recipientDoc.data();

    const senderName = `${sender?.profile?.nome || ''} ${sender?.profile?.cognome || ''}`.trim();
    const messageText = message.content || message.text || '';
    const messagePreview = messageText.length > 100 
      ? messageText.substring(0, 100) + '...' 
      : messageText;

    await sendEmail(
      recipient?.email,
      `Nuovo messaggio da ${senderName}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0066cc;">Nuovo Messaggio 💬</h2>
          <p><strong>${senderName}</strong> ti ha inviato un messaggio:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">${messagePreview}</p>
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://tuaequipe.it/messages" 
               style="background-color: #0066cc; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Rispondi al Messaggio
            </a>
          </p>
          <p style="color: #666; font-size: 12px;">
            Puoi disattivare le notifiche email dalle impostazioni del tuo profilo.
          </p>
        </div>
      `
    );

    return null;
  });

/**
 * 4. Email notifica nuovo messaggio in gruppo equipe
 * Trigger: onCreate su messages (collection top-level) per conversazioni di team
 */
export const sendTeamMessageEmail = functions
  .region('europe-west1')
  .firestore
  .document('messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const conversationId = message.conversationId;

    console.log('📨 sendTeamMessageEmail triggered, conversationId:', conversationId);

    if (!conversationId) {
      console.log('⚠️ sendTeamMessageEmail: no conversationId, skipping');
      return null;
    }

    // Ottieni conversazione
    const conversationDoc = await admin.firestore()
      .collection('conversations')
      .doc(conversationId)
      .get();

    if (!conversationDoc.exists) {
      console.log('⚠️ sendTeamMessageEmail: conversation not found');
      return null;
    }

    const conversation = conversationDoc.data();
    console.log('📨 sendTeamMessageEmail: conversation type:', conversation?.type, 'teamId:', conversation?.teamId);
    
    // Solo messaggi di team
    if (!conversation?.teamId && conversation?.type !== 'team') {
      console.log('⚠️ sendTeamMessageEmail: not a team conversation, skipping');
      return null;
    }

    // Ottieni team
    const teamId = conversation.teamId;
    if (!teamId) {
      console.log('⚠️ sendTeamMessageEmail: teamId is missing, skipping');
      return null;
    }

    const teamDoc = await admin.firestore()
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      console.log('⚠️ sendTeamMessageEmail: team not found:', teamId);
      return null;
    }

    const team = teamDoc.data();

    // Ottieni mittente
    const senderDoc = await admin.firestore()
      .collection('users')
      .doc(message.senderId)
      .get();

    if (!senderDoc.exists) {
      console.log('⚠️ sendTeamMessageEmail: sender not found:', message.senderId);
      return null;
    }

    const sender = senderDoc.data();
    const senderName = `${sender?.profile?.nome || ''} ${sender?.profile?.cognome || ''}`.trim();

    // Invia email a tutti i membri tranne il mittente
    // Usa conversation.participants, ma se vuoto/incompleto fallback ai membri del team
    const convParticipants = conversation.participants?.filter((id: string) => id !== message.senderId) || [];
    const teamMemberIds = team?.memberIds || team?.membri || [];
    const teamRecipients = teamMemberIds.filter((id: string) => id !== message.senderId);
    
    // Usa i destinatari dalla conversazione, oppure dal team se la conversazione non li ha
    const recipients = convParticipants.length > 0 ? convParticipants : teamRecipients;
    console.log('📨 sendTeamMessageEmail: conv participants (excl sender):', convParticipants.length,
      'team members (excl sender):', teamRecipients.length,
      'using:', recipients.length);

    if (recipients.length === 0) {
      console.log('⚠️ sendTeamMessageEmail: no recipients from conversation or team, skipping');
      return null;
    }

    const messageText = message.content || message.text || '';
    const messagePreview = messageText.length > 100 
      ? messageText.substring(0, 100) + '...' 
      : messageText;

    // Ottieni email di tutti i destinatari
    const recipientDocs = await Promise.all(
      recipients.map((id: string) => admin.firestore().collection('users').doc(id).get())
    );

    // Invia email a ciascun membro
    const results = await Promise.all(
      recipientDocs
        .filter(doc => doc.exists)
        .map(doc => {
          const userData = doc.data();
          const recipientEmail = userData?.email || userData?.profile?.email;
          console.log('📨 sendTeamMessageEmail: sending to', recipientEmail);
          if (!recipientEmail) {
            console.log('⚠️ sendTeamMessageEmail: no email for user', doc.id);
            return Promise.resolve(false);
          }
          return sendEmail(
            recipientEmail,
            `Nuovo messaggio in ${team?.nome || 'team'}`,
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0066cc;">Nuovo Messaggio nel Team 👥</h2>
                <p><strong>${senderName}</strong> ha scritto in <strong>${team?.nome || 'team'}</strong>:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0;">${messagePreview}</p>
                </div>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="https://tuaequipe.it/messages" 
                     style="background-color: #0066cc; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 5px; display: inline-block;">
                    Vai alla Chat del Team
                  </a>
                </p>
                <p style="color: #666; font-size: 12px;">
                  Puoi disattivare le notifiche email dalle impostazioni del tuo profilo.
                </p>
              </div>
            `
          );
        })
    );

    console.log('📨 sendTeamMessageEmail: completed, results:', results);
    return null;
  });

/**
 * 5. Email invito a unirsi a un'equipe
 * Trigger: onCreate su teamInvites
 */
export const sendTeamInviteEmail = functions
  .region('europe-west1')
  .firestore
  .document('teamInvites/{inviteId}')
  .onCreate(async (snapshot, context) => {
    const invite = snapshot.data();

    // Ottieni dati invitato, team e inviter
    const [invitedUserDoc, teamDoc, inviterDoc] = await Promise.all([
      admin.firestore().collection('users').doc(invite.toUserId).get(),
      admin.firestore().collection('teams').doc(invite.teamId).get(),
      admin.firestore().collection('users').doc(invite.fromUserId).get(),
    ]);

    if (!invitedUserDoc.exists || !teamDoc.exists || !inviterDoc.exists) return null;

    const invitedUser = invitedUserDoc.data();
    const team = teamDoc.data();
    const inviter = inviterDoc.data();

    const inviterName = inviter?.profile?.nome || inviter?.displayName || 'Un professionista';

    await sendEmail(
      invitedUser?.email,
      `Invito a unirti al team ${team?.nome || ''}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0066cc;">Nuovo Invito a un Team! 🤝</h2>
          <p><strong>${inviterName}</strong> ti ha invitato a unirti al team:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${team?.nome || 'Team'}</h3>
            ${team?.descrizione ? `<p style="margin: 0; color: #666;">${team.descrizione}</p>` : ''}
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://tuaequipe.it/invites" 
               style="background-color: #28a745; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Visualizza Invito
            </a>
          </p>
          <p>Potrai accettare o rifiutare l'invito dalla tua area inviti.</p>
          <br>
          <p>Il team di Equipe</p>
        </div>
      `,
      EMAIL_FROM.info
    );

    return null;
  });

/**
 * 5b. Email risposta a invito equipe (accettato/rifiutato)
 * Trigger: onUpdate su teamInvites quando status cambia da pending
 */
export const sendTeamInviteResponseEmail = functions
  .region('europe-west1')
  .firestore
  .document('teamInvites/{inviteId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Procedi solo se lo status è cambiato da pending
    if (before.status === after.status || before.status !== 'pending') return null;
    if (after.status !== 'accepted' && after.status !== 'rejected') return null;

    const isAccepted = after.status === 'accepted';

    // Ottieni dati del responder, team e chi ha inviato l'invito
    const [responderDoc, teamDoc, inviterDoc] = await Promise.all([
      admin.firestore().collection('users').doc(after.toUserId).get(),
      admin.firestore().collection('teams').doc(after.teamId).get(),
      admin.firestore().collection('users').doc(after.fromUserId).get(),
    ]);

    if (!responderDoc.exists || !teamDoc.exists || !inviterDoc.exists) return null;

    const responder = responderDoc.data();
    const team = teamDoc.data();
    const inviter = inviterDoc.data();

    const responderName = responder?.profile?.nome || responder?.displayName || 'Un professionista';
    const teamName = team?.nome || team?.name || 'equipe';

    // Email a chi ha inviato l'invito
    await sendEmail(
      inviter?.email,
      isAccepted
        ? `✅ Invito Accettato: ${responderName} si è unito a "${teamName}"`
        : `❌ Invito Rifiutato: ${responderName} ha rifiutato "${teamName}"`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${isAccepted ? '#28a745' : '#dc3545'};">
            Invito ${isAccepted ? 'Accettato' : 'Rifiutato'} ${isAccepted ? '✅' : '❌'}
          </h2>
          <p><strong>${responderName}</strong> ha ${isAccepted ? 'accettato' : 'rifiutato'} il tuo invito per l'equipe:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${teamName}</h3>
          </div>
          ${isAccepted
            ? '<p>Il nuovo membro può ora collaborare con il team!</p>'
            : '<p>Puoi invitare altri professionisti dalla pagina del team.</p>'
          }
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://tuaequipe.it/teams/${after.teamId}" 
               style="background-color: #0066cc; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Vai all'equipe
            </a>
          </p>
          <br>
          <p>Il team di Equipe</p>
        </div>
      `,
      EMAIL_FROM.info
    );

    return null;
  });

/**
 * 6. Email richiesta equipe accettata/rifiutata
 * Trigger: onUpdate su teams quando cambiano i membri o le richieste
 */
export const sendTeamRequestStatusEmail = functions
  .region('europe-west1')
  .firestore
  .document('teams/{teamId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const beforeMembers = before.membri || [];
    const afterMembers = after.membri || [];

    // Controlla se un nuovo membro è stato aggiunto
    const newMember = afterMembers.find((id: string) => !beforeMembers.includes(id));

    if (newMember) {
      const [userDoc, teamData] = await Promise.all([
        admin.firestore().collection('users').doc(newMember).get(),
        after,
      ]);

      if (userDoc.exists) {
        const user = userDoc.data();
        await sendEmail(
          user?.email,
          `✅ Richiesta Accettata: ${teamData.nome || 'Team'}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #28a745;">Richiesta Accettata! ✅</h2>
              <p>La tua richiesta di unirti al team <strong>${teamData.nome || 'Team'}</strong> è stata accettata!</p>
              <p>Ora fai parte del team e puoi:</p>
              <ul>
                <li>Comunicare con gli altri membri</li>
                <li>Collaborare sui progetti del team</li>
                <li>Visualizzare e gestire i referral del team</li>
              </ul>
              <p style="text-align: center; margin: 30px 0;">
                <a href="https://tuaequipe.it/teams/${context.params.teamId}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                  Vai al Team
                </a>
              </p>
              <p>Benvenuto nel team!</p>
              <br>
              <p>Il team di Equipe</p>
            </div>
          `
        );
      }
    }

    return null;
  });

/**
 * 7. Email referral ricevuto
 * Trigger: onCreate su referrals
 */
export const sendReferralReceivedEmail = functions
  .region('europe-west1')
  .firestore
  .document('referrals/{referralId}')
  .onCreate(async (snapshot, context) => {
    const referral = snapshot.data();
    const referralId = context.params.referralId;

    const receiverUid = referral.receiverUid;
    const senderUid = referral.senderUid;

    if (!receiverUid || !senderUid) {
      console.log('❌ Referral senza senderUid o receiverUid:', referralId);
      return null;
    }

    try {
      // Ottieni mittente
      const senderDoc = await admin.firestore()
        .collection('users')
        .doc(senderUid)
        .get();

      if (!senderDoc.exists) {
        console.log('❌ Mittente non trovato:', senderUid);
        return null;
      }

      const sender = senderDoc.data();
      const senderName = `${sender?.profile?.nome || ''} ${sender?.profile?.cognome || ''}`.trim() || 'Un collega';

      // Ottieni destinatario
      const receiverDoc = await admin.firestore()
        .collection('users')
        .doc(receiverUid)
        .get();

      if (!receiverDoc.exists) {
        console.log('❌ Destinatario non trovato:', receiverUid);
        return null;
      }

      const receiver = receiverDoc.data();
      const receiverEmail = receiver?.email;

      if (!receiverEmail) {
        console.log('❌ Email destinatario non trovata:', receiverUid);
        return null;
      }

      const urgencyLabels: Record<string, string> = {
        low: '🟢 Bassa',
        normal: '🟡 Normale',
        high: '🔴 Alta',
      };
      const urgencyLabel = urgencyLabels[referral.urgency] || 'Normale';

      // Crea notifica interna
      await createInternalNotification({
        userId: receiverUid,
        type: 'referral_received',
        title: 'Nuovo Referral Ricevuto',
        message: `${senderName} ti ha inviato un nuovo referral`,
        senderId: senderUid,
        senderName,
        senderPhotoURL: sender?.profile?.photoURL || '',
        referralId,
      });

      // Invia email
      await sendEmail(
        receiverEmail,
        `Nuovo Referral da ${senderName}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">Nuovo Referral Ricevuto! 🎯</h2>
            <p><strong>${senderName}</strong> ti ha inviato un referral.</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Urgenza:</strong> ${urgencyLabel}</p>
              <p style="margin: 5px 0;"><strong>Stato:</strong> In attesa di accettazione</p>
            </div>
            <p style="color: #666; font-size: 13px;">🔒 I dati sensibili del paziente sono protetti. Accedi alla piattaforma per visualizzarli.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="https://tuaequipe.it/referrals/${referralId}" 
                 style="background-color: #0066cc; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Visualizza Referral
              </a>
            </p>
            <p>Puoi accettare o rifiutare il referral dalla tua area referral.</p>
            <br>
            <p>Il team di Equipe</p>
          </div>
        `
      );

      console.log('✅ Email referral ricevuto inviata a:', receiverEmail);
      return null;
    } catch (error) {
      console.error('❌ Errore invio email referral ricevuto:', error);
      return null;
    }
  });

/**
 * 8. Email referral inviato accettato/rifiutato
 * Trigger: onUpdate su referrals quando cambia lo status
 */
export const sendReferralStatusEmail = functions
  .region('europe-west1')
  .firestore
  .document('referrals/{referralId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const referralId = context.params.referralId;

    // Controlla se lo status è cambiato
    if (before.status === after.status) return null;

    const isAccepted = after.status === 'accepted';
    const isRejected = after.status === 'rejected';

    if (!isAccepted && !isRejected) return null;

    try {
      // Ottieni mittente (chi ha inviato il referral originale)
      const senderDoc = await admin.firestore()
        .collection('users')
        .doc(after.senderUid)
        .get();

      if (!senderDoc.exists) return null;

      const sender = senderDoc.data();

      // Ottieni nome del destinatario (chi ha accettato/rifiutato)
      let recipientName = 'il destinatario';
      if (after.receiverUid) {
        const receiverDoc = await admin.firestore()
          .collection('users')
          .doc(after.receiverUid)
          .get();
        if (receiverDoc.exists) {
          const receiverData = receiverDoc.data();
          recipientName = `${receiverData?.profile?.nome || ''} ${receiverData?.profile?.cognome || ''}`.trim() || 'il destinatario';
        }
      }

      // Crea notifica interna per il mittente
      await createInternalNotification({
        userId: after.senderUid,
        type: isAccepted ? 'referral_accepted' : 'referral_rejected',
        title: isAccepted ? 'Referral Accettato' : 'Referral Rifiutato',
        message: `${recipientName} ha ${isAccepted ? 'accettato' : 'rifiutato'} il tuo referral`,
        referralId,
      });

      await sendEmail(
        sender?.email,
        isAccepted 
          ? `✅ Referral Accettato da ${recipientName}` 
          : `❌ Referral Rifiutato da ${recipientName}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${isAccepted ? '#28a745' : '#dc3545'};">
              Referral ${isAccepted ? 'Accettato' : 'Rifiutato'} ${isAccepted ? '✅' : '❌'}
            </h2>
            <p><strong>${recipientName}</strong> ha ${isAccepted ? 'accettato' : 'rifiutato'} il referral che hai inviato.</p>
            ${isAccepted 
              ? '<p>Il destinatario prenderà in carico il paziente. Grazie per la collaborazione!</p>' 
              : '<p>Il destinatario non è disponibile per questo referral al momento.</p>'}
            <p style="text-align: center; margin: 30px 0;">
              <a href="https://tuaequipe.it/referrals/${referralId}" 
                 style="background-color: #0066cc; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Visualizza Referral
              </a>
            </p>
            <br>
            <p>Il team di Equipe</p>
          </div>
        `
      );

      console.log('✅ Email stato referral inviata a:', sender?.email);
      return null;
    } catch (error) {
      console.error('❌ Errore invio email stato referral:', error);
      return null;
    }
  });

/**
 * Cloud Function per inviare email di recupero password tramite Resend
 * Genera un link di reset password con Firebase Admin SDK e lo invia
 * con il template brandizzato tramite Resend.
 */
export const sendPasswordResetEmailCustom = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const { email } = data;

    if (!email || typeof email !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Email richiesta.');
    }

    try {
      // Verifica che l'utente esista in Firebase Auth
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
      } catch {
        // Non rivelare se l'utente esiste o meno per sicurezza
        console.log('⚠️ Utente non trovato per reset password:', email);
        return { success: true };
      }

      // Genera il link di reset password (link Firebase standard)
      const resetLink = await admin.auth().generatePasswordResetLink(email, {
        url: 'https://tuaequipe.it/login',
      });

      const nome = userRecord.displayName || 'Utente';

      // Invia l'email tramite Resend con template brandizzato
      await sendEmail(
        email,
        'Reimposta la tua password - Equipe',
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">Reimposta la tua password</h2>
            <p>Ciao ${nome},</p>
            <p>Abbiamo ricevuto una richiesta per reimpostare la password del tuo account Equipe.</p>
            <p>Clicca il pulsante qui sotto per scegliere una nuova password:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #0066cc; color: white; padding: 14px 28px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;
                        font-size: 16px; font-weight: bold;">
                Reimposta Password
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">Se non hai richiesto tu il reset della password, puoi ignorare questa email. Il link scadrà tra 1 ora.</p>
            <p style="color: #666; font-size: 14px;">Se il pulsante non funziona, copia e incolla questo link nel browser:</p>
            <p style="word-break: break-all; color: #0066cc; font-size: 13px;">${resetLink}</p>
            <br>
            <p>Il team di Equipe</p>
          </div>
        `
      );

      console.log('✅ Email reset password inviata a:', email);
      return { success: true };
    } catch (error) {
      console.error('❌ Errore invio email reset password:', error);
      throw new functions.https.HttpsError('internal', 'Errore durante l\'invio dell\'email di reset.');
    }
  });

/**
 * Cloud Function che gestisce le iscrizioni alla waiting list.
 * - Invia email di conferma all'utente
 * - Invia email di notifica all'admin
 * Trigger: onCreate su collection 'waitlist'
 */
export const onWaitlistSignup = functions
  .region('europe-west1')
  .firestore
  .document('waitlist/{docId}')
  .onCreate(async (snapshot) => {
    const data = snapshot.data();
    const { nome, cognome, email, professione, citta } = data;

    // 1. Email di conferma all'utente
    await sendEmail(
      email,
      'Benvenuto nella waiting list di Tuaequipe.it! 🎉',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0066cc;">Ciao ${nome}! 👋</h2>
          <p>Grazie per esserti iscritto/a alla waiting list di <strong>Tuaequipe.it</strong>.</p>
          <p>Stiamo costruendo la piattaforma dove professionisti sanitari come te potranno:</p>
          <ul>
            <li>Trovare colleghi nella propria area</li>
            <li>Creare team multidisciplinari</li>
            <li>Scambiarsi referral in modo semplice</li>
          </ul>
          <p>Ti ricontatteremo non appena la piattaforma sarà pronta per accoglierti.</p>
          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            I tuoi dati:<br>
            <strong>${nome} ${cognome}</strong><br>
            ${professione} — ${citta}
          </p>
          <br>
          <p>A presto,<br>Il team di Tuaequipe.it</p>
        </div>
      `,
      EMAIL_FROM.info
    );

    // 2. Email di notifica all'admin
    for (const adminEmail of ADMIN_EMAILS) {
      await sendEmail(
        adminEmail,
        `📋 Nuova iscrizione waiting list: ${nome} ${cognome}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">Nuova iscrizione alla waiting list</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Nome</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${nome} ${cognome}</strong></td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${email}</strong></td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Professione</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${professione}</strong></td></tr>
              <tr><td style="padding: 8px; color: #666;">Città</td><td style="padding: 8px;"><strong>${citta}</strong></td></tr>
            </table>
          </div>
        `,
        EMAIL_FROM.admin
      );
    }

    // 3. Incrementa il contatore in config/stats (lettura veloce da frontend)
    await admin.firestore().doc('config/stats').set(
      { waitlistCount: admin.firestore.FieldValue.increment(1) },
      { merge: true }
    );

    console.log(`✅ Waitlist: ${nome} ${cognome} (${email}) - conferma e notifica inviate`);
    return null;
  });

/**
 * Funzione HTTP di inizializzazione: conta tutti i documenti attuali della
 * waitlist e scrive il valore in config/stats.waitlistCount.
 * Va chiamata UNA SOLA VOLTA dopo il primo deploy.
 */
export const initWaitlistStats = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    // Protezione base: solo GET con header segreto
    if (req.headers['x-init-secret'] !== process.env.INIT_SECRET && process.env.INIT_SECRET) {
      res.status(403).send('Forbidden');
      return;
    }
    const snap = await admin.firestore().collection('waitlist').get();
    const count = snap.size;
    await admin.firestore().doc('config/stats').set({ waitlistCount: count }, { merge: true });
    console.log(`✅ initWaitlistStats: conteggio inizializzato a ${count}`);
    res.json({ ok: true, waitlistCount: count });
  });

/**
 * Cloud Function callable per inviare email in blocco agli iscritti della waitlist.
 * Solo gli admin possono chiamarla.
 * Parametri:
 *   - recipients: Array<{ email: string, nome: string, cognome: string, professione: string, citta: string }>
 *   - subject: string (oggetto email, supporta placeholder {nome}, {cognome}, {professione}, {citta})
 *   - bodyHtml: string (corpo HTML, supporta placeholder {nome}, {cognome}, {professione}, {citta})
 *   - fromAddress: 'info' | 'noreply' | 'admin' (default: 'info')
 */
export const sendBulkWaitlistEmail = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https
  .onCall(async (data, context) => {
    // Verifica autenticazione
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }

    // Verifica che sia admin
    const callerEmail = context.auth.token.email || '';
    if (!ADMIN_EMAILS.includes(callerEmail)) {
      throw new functions.https.HttpsError('permission-denied', 'Solo gli amministratori possono inviare email in blocco');
    }

    const { recipients, subject, bodyHtml, fromAddress } = data;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Lista destinatari vuota');
    }
    if (!subject || !bodyHtml) {
      throw new functions.https.HttpsError('invalid-argument', 'Oggetto e corpo email obbligatori');
    }
    if (recipients.length > 500) {
      throw new functions.https.HttpsError('invalid-argument', 'Massimo 500 destinatari per invio');
    }

    const from = EMAIL_FROM[fromAddress as keyof typeof EMAIL_FROM] || EMAIL_FROM.info;
    const results = { sent: 0, failed: 0, errors: [] as string[] };
    const failedRecipients: any[] = [];

    // Funzione per sostituire i placeholder
    const replacePlaceholders = (template: string, recipient: any): string => {
      return template
        .replace(/\{nome\}/gi, recipient.nome || '')
        .replace(/\{cognome\}/gi, recipient.cognome || '')
        .replace(/\{professione\}/gi, recipient.professione || '')
        .replace(/\{citta\}/gi, recipient.citta || '')
        .replace(/\{email\}/gi, recipient.email || '');
    };

    // Invia email una alla volta con delay per rispettare rate limit Resend (2/s free tier)
    const maxRetries = 3;
    const delayBetweenEmails = 600; // ms tra un'email e l'altra

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const personalizedSubject = replacePlaceholders(subject, recipient);
      const personalizedBody = replacePlaceholders(bodyHtml, recipient);
      let sent = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await getResend().emails.send({
            from,
            to: recipient.email,
            subject: personalizedSubject,
            html: wrapEmailTemplate(personalizedBody),
          });

          if (response.error) {
            throw new Error(response.error.message || JSON.stringify(response.error));
          }

          results.sent++;
          sent = true;
          break; // successo, esci dal retry loop
        } catch (error: any) {
          const isRateLimit = error.message?.includes('429') || error.message?.toLowerCase().includes('rate');
          if (attempt < maxRetries) {
            // Backoff esponenziale più aggressivo: 3s, 6s, 12s
            const backoff = isRateLimit ? 3000 * Math.pow(2, attempt) : 1000 * (attempt + 1);
            await new Promise(resolve => setTimeout(resolve, backoff));
            console.warn(`⚠️ Retry ${attempt + 1}/${maxRetries} per ${recipient.email} (backoff ${backoff}ms)`);
          } else {
            results.failed++;
            results.errors.push(`${recipient.email}: ${error.message || 'Errore sconosciuto'}`);
            failedRecipients.push({
              email: recipient.email,
              nome: recipient.nome,
              cognome: recipient.cognome,
              professione: recipient.professione,
              citta: recipient.citta,
            });
            console.error(`❌ Errore invio a ${recipient.email} dopo ${maxRetries} retry:`, error);
          }
        }
      }

      // Delay tra un'email e l'altra per non triggerare rate limit
      if (sent && i < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
      }
    }

    // Salva storico invio in Firestore
    try {
      await admin.firestore().collection('waitlist_email_history').add({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        admin: callerEmail,
        recipients: recipients.map((r: any) => ({
          email: r.email,
          nome: r.nome,
          cognome: r.cognome,
          professione: r.professione,
          citta: r.citta
        })),
        subject,
        bodyHtml,
        fromAddress,
        result: results,
        failedRecipients,
      });
    } catch (err) {
      console.error('Errore salvataggio storico invio email waitlist:', err);
    }

    console.log(`📧 Invio bulk completato: ${results.sent} inviate, ${results.failed} fallite su ${recipients.length} totali`);
    return results;
  });

// ── Reinvio email fallite a destinatari da un invio precedente ──
export const resendFailedWaitlistEmail = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }
    const callerEmail = context.auth.token.email || '';
    if (!ADMIN_EMAILS.includes(callerEmail)) {
      throw new functions.https.HttpsError('permission-denied', 'Solo gli amministratori possono reinviare email');
    }

    const { historyId } = data;
    if (!historyId) {
      throw new functions.https.HttpsError('invalid-argument', 'historyId obbligatorio');
    }

    // Carica il record storico
    const historyDoc = await admin.firestore().collection('waitlist_email_history').doc(historyId).get();
    if (!historyDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Record invio non trovato');
    }

    const historyData = historyDoc.data()!;
    const failedRecipients = historyData.failedRecipients || [];

    if (failedRecipients.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'Nessun destinatario fallito da reinviare');
    }

    const { subject, bodyHtml, fromAddress } = historyData;
    const from = EMAIL_FROM[fromAddress as keyof typeof EMAIL_FROM] || EMAIL_FROM.info;
    const results = { sent: 0, failed: 0, errors: [] as string[] };
    const stillFailed: any[] = [];

    const replacePlaceholders = (template: string, recipient: any): string => {
      return template
        .replace(/\{nome\}/gi, recipient.nome || '')
        .replace(/\{cognome\}/gi, recipient.cognome || '')
        .replace(/\{professione\}/gi, recipient.professione || '')
        .replace(/\{citta\}/gi, recipient.citta || '')
        .replace(/\{email\}/gi, recipient.email || '');
    };

    const maxRetries = 3;
    const delayBetweenEmails = 600;

    for (let i = 0; i < failedRecipients.length; i++) {
      const recipient = failedRecipients[i];
      const personalizedSubject = replacePlaceholders(subject, recipient);
      const personalizedBody = replacePlaceholders(bodyHtml, recipient);
      let sent = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await getResend().emails.send({
            from,
            to: recipient.email,
            subject: personalizedSubject,
            html: wrapEmailTemplate(personalizedBody),
          });

          if (response.error) {
            throw new Error(response.error.message || JSON.stringify(response.error));
          }

          results.sent++;
          sent = true;
          break;
        } catch (error: any) {
          const isRateLimit = error.message?.includes('429') || error.message?.toLowerCase().includes('rate');
          if (attempt < maxRetries) {
            const backoff = isRateLimit ? 3000 * Math.pow(2, attempt) : 1000 * (attempt + 1);
            await new Promise(resolve => setTimeout(resolve, backoff));
          } else {
            results.failed++;
            results.errors.push(`${recipient.email}: ${error.message || 'Errore sconosciuto'}`);
            stillFailed.push(recipient);
          }
        }
      }

      if (sent && i < failedRecipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
      }
    }

    // Aggiorna il record storico con i nuovi risultati
    try {
      await admin.firestore().collection('waitlist_email_history').doc(historyId).update({
        'result.sent': admin.firestore.FieldValue.increment(results.sent),
        'result.failed': results.failed, // sostituisci con il nuovo conteggio (quelli ancora falliti)
        failedRecipients: stillFailed,
        lastResendAt: admin.firestore.FieldValue.serverTimestamp(),
        'result.errors': results.failed > 0 ? results.errors : [],
      });
    } catch (err) {
      console.error('Errore aggiornamento storico dopo reinvio:', err);
    }

    console.log(`📧 Reinvio completato: ${results.sent} recuperate, ${results.failed} ancora fallite`);
    return results;
  });

// ── TEMPORANEA: Patch storico con failedRecipients usando dati da Resend ──
export const patchWaitlistHistoryFailed = functions
  .region('europe-west1')
  .https
  .onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Non autenticato');
    const callerEmail = context.auth.token.email || '';
    if (!ADMIN_EMAILS.includes(callerEmail)) throw new functions.https.HttpsError('permission-denied', 'Non admin');

    const { successfulEmails } = data; // array di email che hanno ricevuto con successo
    if (!successfulEmails || !Array.isArray(successfulEmails)) {
      throw new functions.https.HttpsError('invalid-argument', 'successfulEmails array richiesto');
    }

    const successSet = new Set(successfulEmails.map((e: string) => e.toLowerCase()));

    // Trova tutti i record "Buona Pasqua"
    const historySnap = await admin.firestore().collection('waitlist_email_history')
      .orderBy('sentAt', 'desc')
      .limit(10)
      .get();

    const results: any[] = [];

    for (const doc of historySnap.docs) {
      const docData = doc.data();
      if (!docData.subject || !docData.subject.includes('Buona Pasqua')) continue;

      const allRecipients = docData.recipients || [];
      const failedRecipients = allRecipients.filter((r: any) => !successSet.has(r.email.toLowerCase()));

      await admin.firestore().collection('waitlist_email_history').doc(doc.id).update({
        failedRecipients,
        'result.failed': failedRecipients.length,
        'result.sent': allRecipients.length - failedRecipients.length,
      });

      results.push({
        id: doc.id,
        subject: docData.subject,
        totalRecipients: allRecipients.length,
        successCount: allRecipients.length - failedRecipients.length,
        failedCount: failedRecipients.length,
        failedEmails: failedRecipients.map((r: any) => r.email),
      });
    }

    return results;
  });

/**
 * Trigger: nuova offerta marketplace creata
 * Invia email al proprietario dell'annuncio
 */
export const onMarketplaceOfferCreated = functions
  .region('europe-west1')
  .firestore
  .document('marketplace_offers/{offerId}')
  .onCreate(async (snapshot) => {
    const offer = snapshot.data();
    if (!offer) return;

    try {
      const authorRecord = await admin.auth().getUser(offer.authorId);
      const authorEmail = authorRecord.email;
      if (!authorEmail) return;

      const slotsText = (offer.requestedSlots || []).map((s: any) =>
        `<li>${s.day}: ${s.startTime} \u2013 ${s.endTime}</li>`
      ).join('');

      await sendEmail(
        authorEmail,
        `Nuova offerta per "${offer.listingTitle}"`,
        `
          <h2 style="color:#0066cc;">Hai ricevuto una nuova offerta!</h2>
          <p><strong>${offer.offererName}</strong> ha inviato un'offerta per il tuo annuncio
          <strong>"${offer.listingTitle}"</strong>.</p>
          <table style="margin:16px 0;border-collapse:collapse;width:100%;">
            <tr><td style="padding:6px 12px;background:#f5f8ff;font-weight:bold;">Importo offerto</td>
                <td style="padding:6px 12px;">${offer.offerAmount}\u20ac</td></tr>
            ${offer.message ? '<tr><td style="padding:6px 12px;background:#f5f8ff;font-weight:bold;">Messaggio</td><td style="padding:6px 12px;">' + offer.message + '</td></tr>' : ''}
          </table>
          ${slotsText ? '<p><strong>Fasce orarie richieste:</strong></p><ul>' + slotsText + '</ul>' : ''}
          <p style="text-align:center;margin:28px 0;">
            <a href="https://tuaequipe.it/marketplace/my"
               style="background:#0066cc;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
              Gestisci offerte
            </a>
          </p>
          <p style="color:#888;font-size:13px;">Accedi a "I miei annunci" per accettare o rifiutare l'offerta.</p>
        `,
        EMAIL_FROM.info
      );

      // Notifica in-app al proprietario dell'annuncio
      await createInternalNotification({
        userId: offer.authorId,
        type: 'marketplace_offer_received',
        title: 'Nuova offerta ricevuta',
        message: `${offer.offererName} ha inviato un'offerta di ${offer.offerAmount}\u20ac per "${offer.listingTitle}"`,
        senderName: offer.offererName,
        senderPhotoURL: offer.offererPhotoURL || '',
        listingId: offer.listingId || '',
        offerId: snapshot.id,
      });
    } catch (error) {
      console.error('\u274c onMarketplaceOfferCreated:', error);
    }
  });

/**
 * Trigger: offerta marketplace aggiornata (accepted / rejected)
 * Invia email all'offerente con l'esito
 */
export const onMarketplaceOfferUpdated = functions
  .region('europe-west1')
  .firestore
  .document('marketplace_offers/{offerId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after) return;
    if (before.status === after.status) return;
    if (after.status !== 'accepted' && after.status !== 'rejected') return;

    try {
      const offererRecord = await admin.auth().getUser(after.offererId);
      const offererEmail = offererRecord.email;
      if (!offererEmail) return;

      const accepted = after.status === 'accepted';
      const emoji = accepted ? '\u2705' : '\u274c';
      const esito = accepted ? 'accettata' : 'rifiutata';
      const color = accepted ? '#16a34a' : '#dc2626';

      await sendEmail(
        offererEmail,
        `${emoji} La tua offerta \u00e8 stata ${esito}`,
        `
          <h2 style="color:${color};">${emoji} Offerta ${esito}!</h2>
          <p>La tua offerta per l'annuncio <strong>"${after.listingTitle}"</strong>
          di <strong>${after.authorName}</strong> \u00e8 stata <strong>${esito}</strong>.</p>
          ${after.responseMessage ? '<div style="background:#f9f9f9;border-left:4px solid ' + color + ';padding:12px 16px;margin:16px 0;border-radius:4px;"><p style="margin:0;font-style:italic;">"' + after.responseMessage + '"</p></div>' : ''}
          ${accepted ? '<p style="text-align:center;margin:28px 0;"><a href="https://tuaequipe.it/marketplace/' + after.listingId + '" style="background:#0066cc;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Visualizza annuncio</a></p>' : ''}
          <p style="color:#888;font-size:13px;">Puoi consultare tutte le tue offerte in "I miei annunci".</p>
        `,
        EMAIL_FROM.info
      );

      // Notifica in-app all'offerente
      await createInternalNotification({
        userId: after.offererId,
        type: accepted ? 'marketplace_offer_accepted' : 'marketplace_offer_rejected',
        title: accepted ? '\u2705 Offerta accettata!' : '\u274c Offerta rifiutata',
        message: accepted
          ? `La tua offerta per "${after.listingTitle}" \u00e8 stata accettata`
          : `La tua offerta per "${after.listingTitle}" \u00e8 stata rifiutata`,
        listingId: after.listingId,
        offerId: change.after.id,
      });
    } catch (error) {
      console.error('\u274c onMarketplaceOfferUpdated:', error);
    }
  });