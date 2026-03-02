import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

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
          html: `
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
          `,
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
        html: `
          <h2>Congratulazioni!</h2>
          <p>Ciao ${userName},</p>
          <p>La tua richiesta per la professione <strong>${professione}</strong> è stata approvata!</p>
          <p>Ora puoi utilizzare tutte le funzionalità della piattaforma per questa professione.</p>
          <p><a href="https://tuaequipe.it/profile/edit">Vai al tuo profilo</a></p>
          <br>
          <p>Il team di Equipe</p>
        `,
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
        html: `
          <h2>Richiesta Non Approvata</h2>
          <p>Ciao ${userName},</p>
          <p>La tua richiesta per la professione <strong>${professione}</strong> non è stata approvata.</p>
          ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
          <p>Se ritieni ci sia stato un errore o desideri fornire ulteriore documentazione, puoi contattarci a support@tuaequipe.it</p>
          <br>
          <p>Il team di Equipe</p>
        `,
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
  noreply: 'Equipe <noreply@tuaequipe.it>',
  info: 'Equipe <info@tuaequipe.it>',
  support: 'Equipe <support@tuaequipe.it>',
  admin: 'Equipe <admin@tuaequipe.it>',
};

/** Indirizzi admin per notifiche interne */
const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com'];

/**
 * Funzione helper per inviare email
 * @param to - destinatario
 * @param subject - oggetto
 * @param html - corpo HTML
 * @param from - mittente (default: noreply@tuaequipe.it)
 */
async function sendEmail(to: string, subject: string, html: string, from?: string) {
  try {
    await getResend().emails.send({
      from: from || EMAIL_FROM.noreply,
      to,
      subject,
      html,
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
 * 4. Email notifica nuovo messaggio in gruppo equipé
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
 * 5. Email invito a unirsi a un'equipé
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
 * 5b. Email risposta a invito équipe (accettato/rifiutato)
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
    const teamName = team?.nome || team?.name || 'Équipe';

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
          <p><strong>${responderName}</strong> ha ${isAccepted ? 'accettato' : 'rifiutato'} il tuo invito per l'équipe:</p>
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
              Vai all'Équipe
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
 * 6. Email richiesta equipé accettata/rifiutata
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

