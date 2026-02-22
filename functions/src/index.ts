import * as functions from 'firebase-functions';
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

    try {
      // Invia email all'admin
      for (const professione of newProfessioni) {
        await getResend().emails.send({
          from: EMAIL_FROM.noreply,
          to: ADMIN_EMAIL,
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

/** Indirizzo admin per notifiche interne */
const ADMIN_EMAIL = 'admin@tuaequipe.it';

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
    }

    return null;
  });

/**
 * 3. Email notifica nuovo messaggio privato
 * Trigger: onCreate su conversations/{conversationId}/messages
 */
export const sendNewMessageEmail = functions
  .region('europe-west1')
  .firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const conversationId = context.params.conversationId;

    // Ottieni conversazione
    const conversationDoc = await admin.firestore()
      .collection('conversations')
      .doc(conversationId)
      .get();

    if (!conversationDoc.exists) return null;

    const conversation = conversationDoc.data();
    
    // Se è un messaggio di gruppo (team), salta (gestito da altra funzione)
    if (conversation?.teamId) return null;

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
    const messagePreview = message.text.length > 100 
      ? message.text.substring(0, 100) + '...' 
      : message.text;

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
 * Trigger: onCreate su conversations/{conversationId}/messages per conversazioni di team
 */
export const sendTeamMessageEmail = functions
  .region('europe-west1')
  .firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const conversationId = context.params.conversationId;

    // Ottieni conversazione
    const conversationDoc = await admin.firestore()
      .collection('conversations')
      .doc(conversationId)
      .get();

    if (!conversationDoc.exists) return null;

    const conversation = conversationDoc.data();
    
    // Solo messaggi di team
    if (!conversation?.teamId) return null;

    // Ottieni team
    const teamDoc = await admin.firestore()
      .collection('teams')
      .doc(conversation.teamId)
      .get();

    if (!teamDoc.exists) return null;

    const team = teamDoc.data();

    // Ottieni mittente
    const senderDoc = await admin.firestore()
      .collection('users')
      .doc(message.senderId)
      .get();

    if (!senderDoc.exists) return null;

    const sender = senderDoc.data();
    const senderName = `${sender?.profile?.nome || ''} ${sender?.profile?.cognome || ''}`.trim();

    // Invia email a tutti i membri tranne il mittente
    const recipients = conversation.participants.filter((id: string) => id !== message.senderId);

    const messagePreview = message.text.length > 100 
      ? message.text.substring(0, 100) + '...' 
      : message.text;

    // Ottieni email di tutti i destinatari
    const recipientDocs = await Promise.all(
      recipients.map((id: string) => admin.firestore().collection('users').doc(id).get())
    );

    // Invia email a ciascun membro
    await Promise.all(
      recipientDocs
        .filter(doc => doc.exists)
        .map(doc => {
          const userData = doc.data();
          return sendEmail(
            userData?.email,
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

    return null;
  });

/**
 * 5. Email invito a unirsi a un'equipé
 * Trigger: onCreate su invites
 */
export const sendTeamInviteEmail = functions
  .region('europe-west1')
  .firestore
  .document('invites/{inviteId}')
  .onCreate(async (snapshot, context) => {
    const invite = snapshot.data();

    // Ottieni dati invitato, team e inviter
    const [invitedUserDoc, teamDoc, inviterDoc] = await Promise.all([
      admin.firestore().collection('users').doc(invite.invitedUserId).get(),
      admin.firestore().collection('teams').doc(invite.teamId).get(),
      admin.firestore().collection('users').doc(invite.invitedBy).get(),
    ]);

    if (!invitedUserDoc.exists || !teamDoc.exists || !inviterDoc.exists) return null;

    const invitedUser = invitedUserDoc.data();
    const team = teamDoc.data();
    const inviter = inviterDoc.data();

    const inviterName = `${inviter?.profile?.nome || ''} ${inviter?.profile?.cognome || ''}`.trim();

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
 * Trigger: onCreate su referrals quando type='received'
 */
export const sendReferralReceivedEmail = functions
  .region('europe-west1')
  .firestore
  .document('referrals/{referralId}')
  .onCreate(async (snapshot, context) => {
    const referral = snapshot.data();

    // Solo per referral ricevuti
    if (referral.type !== 'received') return null;

    // Determina se è referral individuale o di team
    const recipientId = referral.userId || referral.teamId;
    const isTeam = !!referral.teamId;

    if (!recipientId) return null;

    // Ottieni mittente
    const senderDoc = await admin.firestore()
      .collection('users')
      .doc(referral.senderId)
      .get();

    if (!senderDoc.exists) return null;

    const sender = senderDoc.data();
    const senderName = `${sender?.profile?.nome || ''} ${sender?.profile?.cognome || ''}`.trim();

    if (isTeam) {
      // Referral per team - invia a tutti i membri
      const teamDoc = await admin.firestore()
        .collection('teams')
        .doc(recipientId)
        .get();

      if (!teamDoc.exists) return null;

      const team = teamDoc.data();
      const memberDocs = await Promise.all(
        (team?.membri || []).map((id: string) => 
          admin.firestore().collection('users').doc(id).get()
        )
      );

      await Promise.all(
        memberDocs
          .filter(doc => doc.exists)
          .map(doc => {
            const userData = doc.data();
            return sendEmail(
              userData?.email,
              `Nuovo Referral per il team ${team?.nome || ''}`,
              `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #0066cc;">Nuovo Referral Ricevuto! 🎯</h2>
                  <p><strong>${senderName}</strong> ha inviato un referral al vostro team <strong>${team?.nome || ''}</strong>:</p>
                  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin: 0 0 10px 0;">Cliente: ${referral.clientName || 'N/D'}</h4>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${referral.clientEmail || 'N/D'}</p>
                    ${referral.clientPhone ? `<p style="margin: 5px 0;"><strong>Telefono:</strong> ${referral.clientPhone}</p>` : ''}
                    ${referral.notes ? `<p style="margin: 10px 0 0 0;"><strong>Note:</strong> ${referral.notes}</p>` : ''}
                  </div>
                  <p style="text-align: center; margin: 30px 0;">
                    <a href="https://tuaequipe.it/referrals" 
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
          })
      );
    } else {
      // Referral individuale
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(recipientId)
        .get();

      if (!userDoc.exists) return null;

      const user = userDoc.data();

      await sendEmail(
        user?.email,
        `Nuovo Referral da ${senderName}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">Nuovo Referral Ricevuto! 🎯</h2>
            <p><strong>${senderName}</strong> ti ha inviato un referral:</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0;">Cliente: ${referral.clientName || 'N/D'}</h4>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${referral.clientEmail || 'N/D'}</p>
              ${referral.clientPhone ? `<p style="margin: 5px 0;"><strong>Telefono:</strong> ${referral.clientPhone}</p>` : ''}
              ${referral.notes ? `<p style="margin: 10px 0 0 0;"><strong>Note:</strong> ${referral.notes}</p>` : ''}
            </div>
            <p style="text-align: center; margin: 30px 0;">
              <a href="https://tuaequipe.it/referrals" 
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
    }

    return null;
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

    // Controlla se lo status è cambiato
    if (before.status === after.status) return null;

    // Solo per referral inviati
    if (after.type !== 'sent') return null;

    // Ottieni mittente (chi ha inviato il referral originale)
    const senderDoc = await admin.firestore()
      .collection('users')
      .doc(after.senderId)
      .get();

    if (!senderDoc.exists) return null;

    const sender = senderDoc.data();

    // Determina se è stato accettato o rifiutato
    const isAccepted = after.status === 'accepted';
    const isRejected = after.status === 'rejected';

    if (!isAccepted && !isRejected) return null;

    // Ottieni nome del destinatario
    let recipientName = 'il destinatario';
    if (after.userId) {
      const userDoc = await admin.firestore().collection('users').doc(after.userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        recipientName = `${userData?.profile?.nome || ''} ${userData?.profile?.cognome || ''}`.trim();
      }
    } else if (after.teamId) {
      const teamDoc = await admin.firestore().collection('teams').doc(after.teamId).get();
      if (teamDoc.exists) {
        recipientName = `il team ${teamDoc.data()?.nome || ''}`;
      }
    }

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
          <p>${recipientName} ha ${isAccepted ? 'accettato' : 'rifiutato'} il referral che hai inviato:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0;">Cliente: ${after.clientName || 'N/D'}</h4>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${after.clientEmail || 'N/D'}</p>
            ${after.clientPhone ? `<p style="margin: 5px 0;"><strong>Telefono:</strong> ${after.clientPhone}</p>` : ''}
          </div>
          ${isAccepted 
            ? '<p>Il destinatario prenderà in carico il cliente. Grazie per aver condiviso questa opportunità!</p>' 
            : '<p>Il destinatario non è disponibile per questo referral al momento.</p>'}
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://tuaequipe.it/referrals" 
               style="background-color: #0066cc; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Visualizza Tutti i Referral
            </a>
          </p>
          <br>
          <p>Il team di Equipe</p>
        </div>
      `
    );

    return null;
  });

