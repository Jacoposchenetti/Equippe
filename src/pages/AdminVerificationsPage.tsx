import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, VerificationStatus, VerificationInfo } from '@/types/equippe';
import Header from '@/components/Header';
import { useModal } from '@/contexts/ModalContext';

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

interface PendingUser extends User {
  id: string;
}

export default function AdminVerificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, showConfirm } = useModal();
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<VerificationStatus | 'all' | 'with-pending-professions'>('pending');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Verifica che l'utente sia admin
    if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
      showToast('Accesso negato: solo gli amministratori possono accedere a questa pagina', 'error');
      navigate('/dashboard');
      return;
    }

    loadPendingUsers();
  }, [user, navigate, filterStatus]);

  const loadPendingUsers = async () => {
    setLoading(true);
    try {
      let q;
      
      if (filterStatus === 'with-pending-professions') {
        // Carica TUTTI gli utenti e filtra poi in memoria quelli con professioniPending
        q = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc')
        );
      } else if (filterStatus === 'all') {
        // Carica tutti gli utenti
        q = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc')
        );
      } else {
        // Carica utenti con status specifico
        q = query(
          collection(db, 'users'),
          where('profile.verificationInfo.status', '==', filterStatus),
          orderBy('profile.verificationInfo.submittedAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      let users: PendingUser[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as User;
        users.push({
          id: docSnap.id,
          ...data
        });
      });

      // Se filtro per professioni pending, mantieni solo quelli con professioniPending
      if (filterStatus === 'with-pending-professions') {
        users = users.filter(u => 
          u.profile.professioniPending && u.profile.professioniPending.length > 0
        );
      }

      setPendingUsers(users);
    } catch (error) {
      console.error('Errore caricamento utenti:', error);
      showToast('Errore nel caricamento degli utenti', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    const confirmed = await showConfirm({
      title: 'Approvare utente',
      message: 'Confermi di voler APPROVARE questo utente? Avrà accesso completo alla piattaforma.',
      variant: 'warning',
      confirmText: 'Approva'
    });
    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    try {
      const verificationInfo: VerificationInfo = {
        status: 'approved',
        submittedAt: Timestamp.now(),
        lastCheckedAt: Timestamp.now(),
        checkedBy: user!.uid,
        notes: 'Approvato da admin'
      };

      await updateDoc(doc(db, 'users', userId), {
        'profile.verified': true,
        'profile.verificationInfo': verificationInfo,
        updatedAt: Timestamp.now()
      });

      showToast('Utente approvato con successo!', 'success');
      loadPendingUsers();
      setSelectedUser(null);
    } catch (error) {
      console.error('Errore approvazione:', error);
      showToast('Errore durante l\'approvazione', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (userId: string) => {
    if (!rejectionReason.trim()) {
      showToast('Inserisci un motivo per il rifiuto', 'warning');
      return;
    }

    const confirmed = await showConfirm({
      title: 'Rifiutare utente',
      message: 'Confermi di voler RIFIUTARE questo utente? Dovrà reinviare la documentazione.',
      variant: 'danger',
      confirmText: 'Rifiuta'
    });
    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    try {
      const verificationInfo: VerificationInfo = {
        status: 'rejected',
        submittedAt: Timestamp.now(),
        lastCheckedAt: Timestamp.now(),
        checkedBy: user!.uid,
        rejectionReason: rejectionReason.trim(),
        notes: `Rifiutato: ${rejectionReason.trim()}`
      };

      await updateDoc(doc(db, 'users', userId), {
        'profile.verified': false,
        'profile.verificationInfo': verificationInfo,
        updatedAt: Timestamp.now()
      });

      showToast('Utente rifiutato. Riceverà notifica per reinviare documentazione.', 'success');
      setRejectionReason('');
      loadPendingUsers();
      setSelectedUser(null);
    } catch (error) {
      console.error('Errore rifiuto:', error);
      showToast('Errore durante il rifiuto', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async (userId: string, reason: string) => {
    if (!reason.trim()) {
      showToast('Inserisci un motivo per la sospensione', 'warning');
      return;
    }

    const confirmed = await showConfirm({
      title: 'Sospendere utente',
      message: 'Confermi di voler SOSPENDERE questo utente?',
      variant: 'danger',
      confirmText: 'Sospendi'
    });
    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    try {
      const verificationInfo: VerificationInfo = {
        status: 'suspended',
        submittedAt: Timestamp.now(),
        lastCheckedAt: Timestamp.now(),
        checkedBy: user!.uid,
        rejectionReason: reason.trim(),
        notes: `Sospeso: ${reason.trim()}`
      };

      await updateDoc(doc(db, 'users', userId), {
        'profile.verified': false,
        'profile.verificationInfo': verificationInfo,
        updatedAt: Timestamp.now()
      });

      showToast('Utente sospeso.', 'success');
      loadPendingUsers();
      setSelectedUser(null);
    } catch (error) {
      console.error('Errore sospensione:', error);
      showToast('Errore durante la sospensione', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveProfessione = async (userId: string, professioneIndex: number) => {
    const userToUpdate = pendingUsers.find(u => u.id === userId);
    if (!userToUpdate || !userToUpdate.profile.professioniPending) return;

    const professioneToApprove = userToUpdate.profile.professioniPending[professioneIndex];
    const confirmed = await showConfirm({
      title: 'Approvare professione',
      message: `Confermi di voler APPROVARE la professione "${professioneToApprove.professione}"?`,
      variant: 'warning',
      confirmText: 'Approva'
    });
    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    try {
      // Sposta la professione da pending ad approvate
      const professioniApprovate = userToUpdate.profile.professioniConDocumenti || [];
      const professioniPending = userToUpdate.profile.professioniPending.filter((_, idx) => idx !== professioneIndex);
      
      professioniApprovate.push(professioneToApprove);

      // Aggiorna anche l'array specializzazioni per retrocompatibilità
      const specializzazioni = [...new Set([
        ...userToUpdate.profile.specializzazioni,
        professioneToApprove.professione
      ])];

      // Aggiungi le tematiche della professione alle tematiche generali
      const tematiche = userToUpdate.profile.tematiche || [];
      const nuoveTematiche = professioneToApprove.tematiche || [];
      const tematicheAggiornate = [...new Set([...tematiche, ...nuoveTematiche])];

      await updateDoc(doc(db, 'users', userId), {
        'profile.professioniConDocumenti': professioniApprovate,
        'profile.professioniPending': professioniPending,
        'profile.specializzazioni': specializzazioni,
        'profile.tematiche': tematicheAggiornate,
        updatedAt: Timestamp.now()
      });

      showToast(`Professione "${professioneToApprove.professione}" approvata con successo!`, 'success');
      loadPendingUsers();
    } catch (error) {
      console.error('Errore approvazione professione:', error);
      showToast('Errore durante l\'approvazione della professione', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectProfessione = async (userId: string, professioneIndex: number) => {
    const userToUpdate = pendingUsers.find(u => u.id === userId);
    if (!userToUpdate || !userToUpdate.profile.professioniPending) return;

    const professioneToReject = userToUpdate.profile.professioniPending[professioneIndex];
    const motivo = prompt(`Inserisci il motivo del rifiuto per "${professioneToReject.professione}":`);
    
    if (!motivo || !motivo.trim()) {
      showToast('Devi inserire un motivo per il rifiuto', 'warning');
      return;
    }

    const confirmed = await showConfirm({
      title: 'Rifiutare professione',
      message: `Confermi di voler RIFIUTARE la professione "${professioneToReject.professione}"?`,
      variant: 'danger',
      confirmText: 'Rifiuta'
    });
    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    try {
      // Rimuovi la professione dalle pending
      const professioniPending = userToUpdate.profile.professioniPending.filter((_, idx) => idx !== professioneIndex);

      await updateDoc(doc(db, 'users', userId), {
        'profile.professioniPending': professioniPending,
        updatedAt: Timestamp.now()
      });

      showToast(`Professione "${professioneToReject.professione}" rifiutata. Motivo: ${motivo}`, 'success');
      loadPendingUsers();
    } catch (error) {
      console.error('Errore rifiuto professione:', error);
      showToast('Errore durante il rifiuto della professione', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status?: VerificationStatus) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'In attesa' },
      approved: { color: 'bg-green-100 text-green-800', text: 'Approvato' },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Rifiutato' },
      suspended: { color: 'bg-gray-100 text-gray-800', text: 'Sospeso' }
    };

    const config = status ? statusConfig[status] : { color: 'bg-gray-100 text-gray-600', text: 'N/A' };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 pt-0 pb-24 sm:pt-4 sm:pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Verifiche Professionali</h1>
          <p className="text-gray-600 mt-2">Gestisci le richieste di verifica dei professionisti</p>
        </div>

        {/* Filtri */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filterStatus === 'pending' 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              In attesa ({pendingUsers.filter(u => u.profile.verificationInfo?.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilterStatus('with-pending-professions')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                filterStatus === 'with-pending-professions' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-lg">🆕</span>
              Nuove Professioni da Approvare
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filterStatus === 'approved' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Approvati
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filterStatus === 'rejected' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rifiutati
            </button>
            <button
              onClick={() => setFilterStatus('suspended')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filterStatus === 'suspended' 
                  ? 'bg-gray-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sospesi
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filterStatus === 'all' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tutti
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Caricamento...</p>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Nessun utente da verificare</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingUsers.map((pendingUser) => (
              <div key={pendingUser.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {pendingUser.profile.nome}
                        </h3>
                        {getStatusBadge(pendingUser.profile.verificationInfo?.status)}
                        {pendingUser.profile.professioniPending && pendingUser.profile.professioniPending.length > 0 && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                            {pendingUser.profile.professioniPending.length} Professione{pendingUser.profile.professioniPending.length > 1 ? 'i' : ''} da approvare
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm">{pendingUser.email}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        Iscritto il: {pendingUser.createdAt?.toDate ? pendingUser.createdAt.toDate().toLocaleDateString('it-IT') : 'N/A'}
                      </p>
                    </div>
                    
                    {selectedUser?.id !== pendingUser.id && (
                      <button
                        onClick={() => setSelectedUser(pendingUser)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Visualizza dettagli
                      </button>
                    )}
                  </div>

                  {/* Professioni */}
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Professioni dichiarate:</p>
                    <div className="flex flex-wrap gap-2">
                      {pendingUser.profile.professioniConDocumenti && pendingUser.profile.professioniConDocumenti.length > 0 ? (
                        pendingUser.profile.professioniConDocumenti.map((prof, idx) => (
                          <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                            {prof.professione}
                          </span>
                        ))
                      ) : pendingUser.profile.specializzazioni && pendingUser.profile.specializzazioni.length > 0 ? (
                        // Fallback per utenti legacy
                        pendingUser.profile.specializzazioni.map((spec, idx) => (
                          <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                            {spec} <span className="text-xs">(legacy)</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">Nessuna professione dichiarata</span>
                      )}
                    </div>
                  </div>

                  {/* Dettagli espansi */}
                  {selectedUser?.id === pendingUser.id && (
                    <div className="mt-6 border-t pt-6">
                      <h4 className="font-semibold text-lg mb-4">Documenti di verifica</h4>
                      
                      {/* Nuovi utenti con professioniConDocumenti */}
                      {pendingUser.profile.professioniConDocumenti && pendingUser.profile.professioniConDocumenti.length > 0 ? (
                        pendingUser.profile.professioniConDocumenti.map((prof, profIdx) => (
                          <div key={profIdx} className="mb-6 p-4 bg-gray-50 rounded-lg">
                            <h5 className="font-semibold text-blue-700 mb-3">{prof.professione}</h5>
                            
                            {/* Tematiche */}
                            {prof.tematiche && prof.tematiche.length > 0 && (
                              <div className="mb-3">
                                <p className="text-sm font-medium text-gray-700 mb-1">Tematiche:</p>
                                <div className="flex flex-wrap gap-1">
                                  {prof.tematiche.map((tem, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-white text-gray-700 rounded text-xs">
                                      {tem}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Esperienza */}
                            {prof.anniEsperienza && (
                              <div className="mb-3">
                                <p className="text-sm font-medium text-gray-700">
                                  Esperienza: <span className="font-normal">{prof.anniEsperienza}</span>
                                </p>
                              </div>
                            )}

                            {/* Documenti */}
                            <div className="space-y-2">
                              {prof.documenti.map((doc, docIdx) => (
                                <div key={docIdx} className="bg-white p-3 rounded border">
                                  <p className="font-medium text-sm text-gray-900">{doc.nome}</p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Valore:</span> {doc.valore}
                                  </p>
                                  {doc.fileURL && (
                                    <a
                                      href={doc.fileURL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                                    >
                                      📎 Visualizza documento allegato
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>

                            {prof.note && (
                              <div className="mt-3 p-2 bg-yellow-50 border-l-4 border-yellow-400">
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">Note:</span> {prof.note}
                                </p>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        // FALLBACK per utenti legacy (vecchio sistema)
                        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-start gap-2 mb-3">
                            <span className="text-yellow-600 text-lg">⚠️</span>
                            <div>
                              <h5 className="font-semibold text-yellow-900 mb-1">Utente con dati legacy</h5>
                              <p className="text-sm text-yellow-800">Questo utente è stato registrato prima del nuovo sistema di verifica. Dati disponibili:</p>
                            </div>
                          </div>

                          {/* Specializzazioni legacy */}
                          {pendingUser.profile.specializzazioni && pendingUser.profile.specializzazioni.length > 0 && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-900 mb-1">Specializzazioni:</p>
                              <div className="flex flex-wrap gap-2">
                                {pendingUser.profile.specializzazioni.map((spec, idx) => (
                                  <span key={idx} className="px-2 py-1 bg-white text-gray-800 rounded text-sm border">
                                    {spec}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Albo legacy */}
                          {pendingUser.profile.albo && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-900">
                                Numero Albo: <span className="font-normal">{pendingUser.profile.albo}</span>
                              </p>
                            </div>
                          )}

                          {/* Tematiche legacy */}
                          {pendingUser.profile.tematiche && pendingUser.profile.tematiche.length > 0 && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-900 mb-1">Tematiche:</p>
                              <div className="flex flex-wrap gap-1">
                                {pendingUser.profile.tematiche.map((tem, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-white text-gray-700 rounded text-xs border">
                                    {tem}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Esperienza legacy */}
                          {pendingUser.profile.esperienza && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-900">
                                Esperienza: <span className="font-normal">{pendingUser.profile.esperienza}</span>
                              </p>
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-yellow-300">
                            <p className="text-xs text-yellow-800">
                              💡 <strong>Nota:</strong> Documenti di verifica dettagliati non disponibili per utenti registrati prima del 19/01/2026.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Studi */}
                      {pendingUser.profile.studi && pendingUser.profile.studi.length > 0 && (
                        <div className="mb-6">
                          <h5 className="font-semibold text-gray-900 mb-3">Studi professionali</h5>
                          <div className="space-y-2">
                            {pendingUser.profile.studi.map((studio, idx) => (
                              <div key={idx} className="p-3 bg-gray-50 rounded">
                                <p className="text-sm text-gray-900">{studio.indirizzo}</p>
                                {studio.remoto && (
                                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                    Disponibile remoto
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Note precedenti */}
                      {pendingUser.profile.verificationInfo?.notes && (
                        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400">
                          <p className="text-sm font-medium text-blue-900 mb-1">Note precedenti:</p>
                          <p className="text-sm text-blue-800">{pendingUser.profile.verificationInfo.notes}</p>
                        </div>
                      )}

                      {/* Motivo rifiuto precedente */}
                      {pendingUser.profile.verificationInfo?.rejectionReason && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400">
                          <p className="text-sm font-medium text-red-900 mb-1">Motivo rifiuto precedente:</p>
                          <p className="text-sm text-red-800">{pendingUser.profile.verificationInfo.rejectionReason}</p>
                        </div>
                      )}

                      {/* Professioni in Attesa di Approvazione */}
                      {pendingUser.profile.professioniPending && pendingUser.profile.professioniPending.length > 0 && (
                        <div className="mb-6">
                          <h5 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Nuove</span>
                            Professioni in Attesa di Approvazione
                          </h5>
                          <div className="space-y-4">
                            {pendingUser.profile.professioniPending.map((prof, profIdx) => (
                              <div key={profIdx} className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                                <h6 className="font-semibold text-lg text-yellow-900 mb-3">{prof.professione}</h6>

                                {/* Tematiche */}
                                {prof.tematiche && prof.tematiche.length > 0 && (
                                  <div className="mb-3">
                                    <p className="text-sm font-medium text-gray-700 mb-1">Tematiche:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {prof.tematiche.map((tem, idx) => (
                                        <span key={idx} className="px-2 py-0.5 bg-white text-gray-700 rounded text-xs">
                                          {tem}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Esperienza */}
                                {prof.anniEsperienza && (
                                  <div className="mb-3">
                                    <p className="text-sm font-medium text-gray-700">
                                      Esperienza: <span className="font-normal">{prof.anniEsperienza}</span>
                                    </p>
                                  </div>
                                )}

                                {/* Documenti */}
                                <div className="space-y-2 mb-4">
                                  {prof.documenti.map((doc, docIdx) => (
                                    <div key={docIdx} className="bg-white p-3 rounded border">
                                      <p className="font-medium text-sm text-gray-900">{doc.nome}</p>
                                      <p className="text-sm text-gray-600 mt-1">
                                        <span className="font-medium">Valore:</span> {doc.valore}
                                      </p>
                                      {doc.fileURL && (
                                        <a
                                          href={doc.fileURL}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                                        >
                                          📎 Visualizza documento allegato
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {prof.note && (
                                  <div className="mb-4 p-2 bg-blue-50 border-l-4 border-blue-400">
                                    <p className="text-sm text-gray-700">
                                      <span className="font-medium">Note:</span> {prof.note}
                                    </p>
                                  </div>
                                )}

                                {/* Azioni per questa professione */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleApproveProfessione(pendingUser.id, profIdx)}
                                    disabled={actionLoading}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 text-sm"
                                  >
                                    ✓ Approva {prof.professione}
                                  </button>
                                  <button
                                    onClick={() => handleRejectProfessione(pendingUser.id, profIdx)}
                                    disabled={actionLoading}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 text-sm"
                                  >
                                    ✗ Rifiuta {prof.professione}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Azioni */}
                      <div className="mt-6 pt-6 border-t">
                        <h5 className="font-semibold mb-4">Azioni</h5>
                        
                        {pendingUser.profile.verificationInfo?.status === 'pending' && (
                          <div className="space-y-4">
                            {/* Approva */}
                            <div>
                              <button
                                onClick={() => handleApprove(pendingUser.id)}
                                disabled={actionLoading}
                                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                              >
                                ✓ Approva utente
                              </button>
                            </div>

                            {/* Rifiuta */}
                            <div className="space-y-2">
                              <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Inserisci il motivo del rifiuto (es: 'Numero albo non valido', 'Documento non leggibile')"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                                rows={3}
                              />
                              <button
                                onClick={() => handleReject(pendingUser.id)}
                                disabled={actionLoading || !rejectionReason.trim()}
                                className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                              >
                                ✗ Rifiuta - Richiedi nuova documentazione
                              </button>
                            </div>
                          </div>
                        )}

                        {pendingUser.profile.verificationInfo?.status === 'approved' && (
                          <div className="space-y-2">
                            <p className="text-sm text-green-700 mb-2">✓ Utente già approvato</p>
                            <textarea
                              placeholder="Motivo sospensione (opzionale)"
                              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                              rows={2}
                              id={`suspend-reason-${pendingUser.id}`}
                            />
                            <button
                              onClick={() => {
                                const reason = (document.getElementById(`suspend-reason-${pendingUser.id}`) as HTMLTextAreaElement)?.value;
                                handleSuspend(pendingUser.id, reason || 'Sospeso da admin');
                              }}
                              disabled={actionLoading}
                              className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium disabled:opacity-50"
                            >
                              Sospendi utente
                            </button>
                          </div>
                        )}

                        {(pendingUser.profile.verificationInfo?.status === 'rejected' || 
                          pendingUser.profile.verificationInfo?.status === 'suspended') && (
                          <div>
                            <button
                              onClick={() => handleApprove(pendingUser.id)}
                              disabled={actionLoading}
                              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                            >
                              ✓ Approva comunque
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => setSelectedUser(null)}
                          className="mt-4 w-full px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                        >
                          Chiudi dettagli
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
