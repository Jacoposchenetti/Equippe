import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { importKey, decryptData } from '@/lib/encryption';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { User } from '@/types/equippe';

interface PatientData {
  name: string;
  age: string;
  contact: string;
}

interface ReferralData {
  senderUid: string;
  receiverUid: string;
  encryptedPatient: string;
  patientIv: string;
  encryptedDiagnosis: string;
  diagnosisIv: string;
  encryptedNotes: string;
  notesIv: string;
  encryptionKey: string;
  urgency: 'low' | 'normal' | 'high';
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: any;
  updatedAt: any;
}

export default function ReferralDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast, showConfirm } = useModal();
  const navigate = useNavigate();

  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [senderUser, setSenderUser] = useState<User | null>(null);
  const [receiverUser, setReceiverUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [decryptError, setDecryptError] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (id) loadReferral();
  }, [user, id]);

  const loadReferral = async () => {
    try {
      if (!id) return;
      const refDoc = await getDoc(doc(db, 'referrals', id));
      if (!refDoc.exists()) {
        showToast('Referral non trovato', 'error');
        navigate('/referrals');
        return;
      }

      const data = refDoc.data() as ReferralData;
      setReferral(data);

      // Verifica che l'utente sia mittente o destinatario
      if (data.senderUid !== user?.uid && data.receiverUid !== user?.uid) {
        showToast('Non hai accesso a questo referral', 'error');
        navigate('/referrals');
        return;
      }

      // Carica utenti
      const [sDoc, rDoc] = await Promise.all([
        getDoc(doc(db, 'users', data.senderUid)),
        getDoc(doc(db, 'users', data.receiverUid)),
      ]);
      if (sDoc.exists()) setSenderUser({ uid: sDoc.id, ...sDoc.data() } as User);
      if (rDoc.exists()) setReceiverUser({ uid: rDoc.id, ...rDoc.data() } as User);

      // Decripta dati sensibili
      try {
        const key = await importKey(data.encryptionKey);
        const patientJson = await decryptData(data.encryptedPatient, data.patientIv, key);
        setPatient(JSON.parse(patientJson));
        const diagText = await decryptData(data.encryptedDiagnosis, data.diagnosisIv, key);
        setDiagnosis(diagText);
        if (data.encryptedNotes && data.notesIv) {
          const notesText = await decryptData(data.encryptedNotes, data.notesIv, key);
          setNotes(notesText);
        }
      } catch {
        console.error('Errore decriptazione dati referral');
        setDecryptError(true);
      }
    } catch (err) {
      console.error('Errore caricamento referral:', err);
      showToast('Errore nel caricamento del referral', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'accepted' | 'rejected') => {
    if (!id || !referral) return;

    const label = newStatus === 'accepted' ? 'accettare' : 'rifiutare';
    const confirmed = await showConfirm({
      title: newStatus === 'accepted' ? 'Accetta Referral' : 'Rifiuta Referral',
      message: `Sei sicuro di voler ${label} questo referral?`,
      confirmText: newStatus === 'accepted' ? 'Accetta' : 'Rifiuta',
      variant: newStatus === 'accepted' ? 'info' : 'danger',
    });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'referrals', id), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      setReferral({ ...referral, status: newStatus });
      showToast(
        newStatus === 'accepted' ? 'Referral accettato!' : 'Referral rifiutato',
        newStatus === 'accepted' ? 'success' : 'info'
      );
    } catch (err) {
      console.error('Errore aggiornamento stato:', err);
      showToast('Errore nell\'aggiornamento dello stato', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!id || !referral) return;

    const confirmed = await showConfirm({
      title: 'Completa Referral',
      message: 'Confermi che il referral è stato completato?',
      confirmText: 'Completa',
      variant: 'info',
    });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'referrals', id), {
        status: 'completed',
        updatedAt: Timestamp.now(),
      });
      setReferral({ ...referral, status: 'completed' });
      showToast('Referral completato!', 'success');
    } catch (err) {
      console.error('Errore completamento:', err);
      showToast('Errore nel completamento del referral', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const urgencyConfig: Record<string, { label: string; color: string; icon: string }> = {
    low: { label: 'Bassa', color: 'bg-green-100 text-green-800', icon: '🟢' },
    normal: { label: 'Normale', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
    high: { label: 'Alta', color: 'bg-red-100 text-red-800', icon: '🔴' },
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'In attesa', color: 'bg-blue-100 text-blue-800' },
    accepted: { label: 'Accettato', color: 'bg-green-100 text-green-800' },
    rejected: { label: 'Rifiutato', color: 'bg-red-100 text-red-800' },
    completed: { label: 'Completato', color: 'bg-gray-100 text-gray-800' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (!referral) return null;

  const isReceiver = user?.uid === referral.receiverUid;
  const isSender = user?.uid === referral.senderUid;
  const urgency = urgencyConfig[referral.urgency] || urgencyConfig.normal;
  const status = statusConfig[referral.status] || statusConfig.pending;
  const otherUser = isReceiver ? senderUser : receiverUser;
  const createdDate = referral.createdAt?.toDate?.()?.toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) || 'N/D';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:py-8">
        <Link to="/referrals" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna ai Referral
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dettaglio Referral</h1>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${urgency.color}`}>
              {urgency.icon} {urgency.label}
            </span>
            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Info Referral */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Informazioni Referral
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Inviato da</p>
                <div className="flex items-center gap-2">
                  {senderUser?.profile?.photoURL ? (
                    <img src={senderUser.profile.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                      {senderUser?.profile?.nome?.[0] || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{senderUser?.profile?.nome || 'N/D'}</p>
                    <p className="text-xs text-gray-500">{senderUser?.profile?.specializzazioni?.join(', ') || ''}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Destinatario</p>
                <div className="flex items-center gap-2">
                  {receiverUser?.profile?.photoURL ? (
                    <img src={receiverUser.profile.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm">
                      {receiverUser?.profile?.nome?.[0] || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{receiverUser?.profile?.nome || 'N/D'}</p>
                    <p className="text-xs text-gray-500">{receiverUser?.profile?.specializzazioni?.join(', ') || ''}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Data creazione</p>
                <p className="font-medium text-gray-900">{createdDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Urgenza</p>
                <span className={`inline-block px-3 py-1 rounded-lg text-sm font-semibold ${urgency.color}`}>
                  {urgency.icon} {urgency.label}
                </span>
              </div>
            </div>
          </div>

          {/* Dati Paziente */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Dati Paziente
            </h2>

            {decryptError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                <strong>Errore di decriptazione:</strong> Non è stato possibile decriptare i dati del paziente. La chiave potrebbe essere corrotta.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Nome Paziente</p>
                    <p className="font-medium text-gray-900">{patient?.name || 'N/D'}</p>
                  </div>
                  {patient?.age && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Età</p>
                      <p className="font-medium text-gray-900">{patient.age}</p>
                    </div>
                  )}
                  {patient?.contact && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Contatto</p>
                      <p className="font-medium text-gray-900">{patient.contact}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Diagnosi / Motivo Referral</p>
                  <div className="bg-gray-50 rounded-lg p-4 text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
                    {diagnosis || 'N/D'}
                  </div>
                </div>

                {notes && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Note Cliniche</p>
                    <div className="bg-gray-50 rounded-lg p-4 text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
                      {notes}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Azioni */}
          {isReceiver && referral.status === 'pending' && (
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Azioni</h2>
              <p className="text-sm text-gray-600 mb-4">
                Questo referral è in attesa della tua risposta. Puoi accettarlo o rifiutarlo.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleStatusChange('accepted')}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {actionLoading ? 'Attendere...' : 'Accetta Referral'}
                </button>
                <button
                  onClick={() => handleStatusChange('rejected')}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-white text-red-600 border-2 border-red-300 rounded-lg font-semibold hover:bg-red-50 disabled:bg-gray-100 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {actionLoading ? 'Attendere...' : 'Rifiuta Referral'}
                </button>
              </div>
            </div>
          )}

          {isReceiver && referral.status === 'accepted' && (
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Azioni</h2>
              <p className="text-sm text-gray-600 mb-4">
                Hai accettato questo referral. Quando avrai concluso la presa in carico, segna come completato.
              </p>
              <button
                onClick={handleComplete}
                disabled={actionLoading}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {actionLoading ? 'Attendere...' : 'Segna come Completato'}
              </button>
            </div>
          )}

          {/* Status info per il mittente */}
          {isSender && referral.status !== 'pending' && (
            <div className={`rounded-xl shadow-sm p-4 sm:p-6 ${
              referral.status === 'accepted' ? 'bg-green-50 border border-green-200' :
              referral.status === 'rejected' ? 'bg-red-50 border border-red-200' :
              'bg-gray-50 border border-gray-200'
            }`}>
              <p className="font-semibold text-gray-900 mb-1">
                {referral.status === 'accepted' && '✅ Referral accettato'}
                {referral.status === 'rejected' && '❌ Referral rifiutato'}
                {referral.status === 'completed' && '✔️ Referral completato'}
              </p>
              <p className="text-sm text-gray-600">
                {referral.status === 'accepted' && `${otherUser?.profile?.nome || 'Il destinatario'} ha accettato di prendere in carico il paziente.`}
                {referral.status === 'rejected' && `${otherUser?.profile?.nome || 'Il destinatario'} non è disponibile per questo referral.`}
                {referral.status === 'completed' && `Il referral è stato completato con successo.`}
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
