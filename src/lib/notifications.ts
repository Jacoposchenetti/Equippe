import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { NotificationType } from '@/types/equippe';

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
  referralId?: string;
  inviteId?: string;
  accepted?: boolean;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, {
      ...params,
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

export async function notifyTeamRequest(teamId: string, teamName: string, adminIds: string[], requesterId: string, requesterName: string) {
  try {
    // Notifica tutti gli admin dell'équipe
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
          senderName: requesterName
        })
      )
    );
  } catch (error) {
    console.error('Errore notifyTeamRequest:', error);
  }
}

export async function notifyNewMessage(conversationId: string, messageId: string, senderId: string, senderName: string, recipientIds: string[], messagePreview: string) {
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
            senderName
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
      title: 'Rimosso da équipe',
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

export async function notifyTeamInviteResponse(senderId: string, recipientName: string, teamName: string, accepted: boolean, inviteId: string) {
  try {
    await createNotification({
      userId: senderId,
      type: 'team_invite_response',
      title: accepted ? 'Invito accettato' : 'Invito rifiutato',
      message: `${recipientName} ha ${accepted ? 'accettato' : 'rifiutato'} l'invito per "${teamName}"`,
      teamName,
      senderName: recipientName,
      inviteId,
      accepted
    });
  } catch (error) {
    console.error('Errore notifyTeamInviteResponse:', error);
  }
}

export async function notifyReferralReceived(recipientId: string, senderId: string, senderName: string, patientName: string, referralId: string) {
  try {
    await createNotification({
      userId: recipientId,
      type: 'referral_received',
      title: 'Nuova referral ricevuta',
      message: `${senderName} ti ha inviato una referral per ${patientName}`,
      senderId,
      senderName,
      referralId
    });
  } catch (error) {
    console.error('Errore notifyReferralReceived:', error);
  }
}

export async function notifyReferralAccepted(senderId: string, recipientName: string, patientName: string, referralId: string) {
  try {
    await createNotification({
      userId: senderId,
      type: 'referral_accepted',
      title: 'Referral accettata',
      message: `${recipientName} ha accettato la presa in carico di ${patientName}`,
      senderName: recipientName,
      referralId,
      accepted: true
    });
  } catch (error) {
    console.error('Errore notifyReferralAccepted:', error);
  }
}

export async function notifyTeamMemberLeft(adminIds: string[], memberName: string, teamId: string, teamName: string) {
  try {
    // Notifica tutti gli admin dell'équipe
    await Promise.all(
      adminIds.map(adminId =>
        createNotification({
          userId: adminId,
          type: 'team_removed',
          title: 'Membro uscito dall\'\u00e9quipe',
          message: `${memberName} ha lasciato "${teamName}"`,
          teamId,
          teamName,
          senderName: memberName
        })
      )
    );
  } catch (error) {
    console.error('Errore notifyTeamMemberLeft:', error);
  }
}

export async function notifyTeamInviteReceived(recipientId: string, teamId: string, teamName: string, senderName: string, inviteId: string) {
  try {
    await createNotification({
      userId: recipientId,
      type: 'team_invite_response',
      title: 'Invito a équipe',
      message: `${senderName} ti ha invitato a unirti a "${teamName}"`,
      teamId,
      teamName,
      senderName,
      inviteId
    });
  } catch (error) {
    console.error('Errore notifyTeamInviteReceived:', error);
  }
}
