import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook per verificare se l'utente può interagire con il sito.
 * 
 * Un utente può interagire solo se:
 * 1. La sua email è stata verificata (emailVerified = true)
 * 2. La sua documentazione è stata approvata dall'admin (verificationInfo.status = 'approved')
 * 
 * Altrimenti è un "semplice spettatore" che può solo visualizzare il sito.
 */
export function useCanInteract() {
  const { user, userProfile } = useAuth();

  // Nessun utente autenticato = non può interagire
  if (!user || !userProfile) {
    return {
      canInteract: false,
      reason: 'not-authenticated' as const,
      message: 'Devi essere autenticato per eseguire questa azione',
    };
  }

  // Email non verificata = non può interagire
  if (!user.emailVerified) {
    return {
      canInteract: false,
      reason: 'email-not-verified' as const,
      message: 'Verifica la tua email per sbloccare tutte le funzionalità',
    };
  }

  // Documentazione non approvata = non può interagire
  const status = userProfile.profile?.verificationInfo?.status;
  if (status !== 'approved') {
    if (status === 'rejected') {
      return {
        canInteract: false,
        reason: 'verification-rejected' as const,
        message: 'La tua documentazione è stata rifiutata. Aggiorna i tuoi documenti per procedere',
      };
    }
    if (status === 'suspended') {
      return {
        canInteract: false,
        reason: 'verification-suspended' as const,
        message: 'Il tuo account è stato sospeso. Contatta il supporto per maggiori informazioni',
      };
    }
    // pending o undefined
    return {
      canInteract: false,
      reason: 'verification-pending' as const,
      message: 'La tua documentazione è in attesa di approvazione',
    };
  }

  // Tutto ok! Può interagire
  return {
    canInteract: true,
    reason: null,
    message: null,
  };
}
