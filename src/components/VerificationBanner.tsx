import { useAuth } from '@/contexts/AuthContext';
import { useCanInteract } from '@/hooks/useCanInteract';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState } from 'react';

/**
 * Banner che mostra lo stato di verifica dell'utente
 */
export default function VerificationBanner() {
  const { user, userProfile } = useAuth();
  const { canInteract, reason, message } = useCanInteract();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Se può interagire, non mostrare nulla
  if (canInteract) return null;

  // Se non è autenticato, non mostrare il banner (gestito dalle route)
  if (reason === 'not-authenticated') return null;

  const handleResendEmail = async () => {
    if (!auth.currentUser) return;
    
    setResendLoading(true);
    setResendSuccess(false);
    
    try {
      await sendEmailVerification(auth.currentUser);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (error) {
      console.error('Errore invio email:', error);
      alert('Errore nell\'invio dell\'email. Riprova più tardi.');
    } finally {
      setResendLoading(false);
    }
  };

  // Banner per email non verificata
  if (reason === 'email-not-verified') {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Verifica la tua email
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Ti abbiamo inviato un'email all'indirizzo <strong>{user?.email}</strong>.
                Clicca sul link nella email per verificare il tuo account.
              </p>
            </div>
          </div>
          <div className="mt-3 sm:mt-0 sm:ml-4">
            {resendSuccess ? (
              <span className="text-sm text-green-600 font-medium">
                ✓ Email inviata!
              </span>
            ) : (
              <button
                onClick={handleResendEmail}
                disabled={resendLoading}
                className="whitespace-nowrap inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                {resendLoading ? 'Invio...' : 'Invia di nuovo'
              }
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Banner per documentazione in attesa
  if (reason === 'verification-pending') {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Documentazione in attesa di verifica
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              Il tuo profilo è stato creato correttamente! Stiamo verificando la tua documentazione professionale.
              Riceverai una notifica appena completata la revisione. Nel frattempo puoi esplorare il sito.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Banner per documentazione rifiutata
  if (reason === 'verification-rejected') {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Documentazione non valida
              </h3>
              <p className="mt-1 text-sm text-red-700">
                La documentazione che hai inviato non è stata accettata.
                {userProfile?.profile?.verificationInfo?.rejectionReason && (
                  <span className="block mt-1">
                    <strong>Motivo:</strong> {userProfile.profile.verificationInfo.rejectionReason}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="mt-3 sm:mt-0 sm:ml-4">
            <button
              onClick={() => window.location.href = '/profile'}
              className="whitespace-nowrap inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Aggiorna documenti
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banner per account sospeso
  if (reason === 'verification-suspended') {
    return (
      <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-800">
              Account sospeso
            </h3>
            <p className="mt-1 text-sm text-gray-700">
              Il tuo account è stato sospeso. Per maggiori informazioni contatta il supporto all'indirizzo{' '}
              <a href="mailto:support@tuaequipe.it" className="font-medium underline">
                support@tuaequipe.it
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
