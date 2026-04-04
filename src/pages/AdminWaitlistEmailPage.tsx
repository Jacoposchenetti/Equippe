import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { collection, query, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import Header from '@/components/Header';

interface EmailHistoryEntry {
  id: string;
  sentAt?: Timestamp;
  admin: string;
  recipients: { email: string; nome: string; cognome: string; professione: string; citta: string }[];
  subject: string;
  bodyHtml: string;
  fromAddress: string;
  result: { sent: number; failed: number; errors: string[] };
  failedRecipients?: { email: string; nome: string; cognome: string; professione: string; citta: string }[];
  lastResendAt?: Timestamp;
}

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

interface WaitlistEntry {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  professione: string;
  citta: string;
  gdprConsent: boolean;
  createdAt?: Timestamp;
}

function daysSince(date: Date): number {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function AdminWaitlistEmailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useModal();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);

  // Filtri
  const [filterDaysMin, setFilterDaysMin] = useState<string>('');
  const [filterDaysMax, setFilterDaysMax] = useState<string>('');
  const [filterProfessione, setFilterProfessione] = useState<string>('all');
  const [filterCitta, setFilterCitta] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selezione
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Email
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailFrom, setEmailFrom] = useState<'info' | 'noreply' | 'admin'>('info');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

  // Storico invii email
  const [emailHistory, setEmailHistory] = useState<EmailHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
      showToast('Accesso negato: solo gli amministratori possono accedere a questa pagina', 'error');
      navigate('/dashboard');
      return;
    }
    loadEntries();
  }, [user, navigate]);

  useEffect(() => {
    if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) return;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const q = query(collection(db, 'waitlist_email_history'), orderBy('sentAt', 'desc'));
        const snapshot = await getDocs(q);
        const data: EmailHistoryEntry[] = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as EmailHistoryEntry[];
        setEmailHistory(data);
      } catch (err) {
        console.error('Errore caricamento storico email:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [user]);

  const handleResendFailed = async (historyEntry: EmailHistoryEntry) => {
    const failedCount = historyEntry.failedRecipients?.length || 0;
    if (failedCount === 0) {
      showToast('Nessun destinatario fallito da reinviare', 'error');
      return;
    }
    if (!window.confirm(`Reinviare l'email a ${failedCount} destinatari falliti?`)) return;

    setResendingId(historyEntry.id);
    try {
      const resendFailed = httpsCallable(functions, 'resendFailedWaitlistEmail');
      const result = await resendFailed({ historyId: historyEntry.id });
      const data = result.data as { sent: number; failed: number; errors: string[] };
      showToast(
        `Reinvio: ${data.sent} recuperate, ${data.failed} ancora fallite`,
        data.failed > 0 ? 'error' : 'success'
      );
      // Ricarica storico
      const q = query(collection(db, 'waitlist_email_history'), orderBy('sentAt', 'desc'));
      const snapshot = await getDocs(q);
      setEmailHistory(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as EmailHistoryEntry[]);
    } catch (error: any) {
      console.error('Errore reinvio:', error);
      showToast(`Errore reinvio: ${error.message || 'Errore sconosciuto'}`, 'error');
    } finally {
      setResendingId(null);
    }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'waitlist'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data: WaitlistEntry[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as WaitlistEntry[];
      setEntries(data);
    } catch (error) {
      console.error('Errore caricamento waitlist:', error);
      showToast('Errore nel caricamento della waitlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Valori unici per i filtri
  const professioni = useMemo(() => [...new Set(entries.map(e => e.professione).filter(Boolean))].sort(), [entries]);
  const citta = useMemo(() => [...new Set(entries.map(e => e.citta).filter(Boolean))].sort(), [entries]);

  const filtered = useMemo(() => {
    return entries.filter(entry => {
      // Filtro ricerca testo
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!`${entry.nome} ${entry.cognome} ${entry.email} ${entry.citta}`.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Filtro professione
      if (filterProfessione !== 'all' && entry.professione !== filterProfessione) return false;

      // Filtro città
      if (filterCitta !== 'all' && entry.citta !== filterCitta) return false;

      // Filtro giorni dall'iscrizione
      if (filterDaysMin || filterDaysMax) {
        if (!entry.createdAt?.toDate) return false;
        const days = daysSince(entry.createdAt.toDate());
        if (filterDaysMin && days < parseInt(filterDaysMin)) return false;
        if (filterDaysMax && days > parseInt(filterDaysMax)) return false;
      }

      return true;
    });
  }, [entries, searchTerm, filterProfessione, filterCitta, filterDaysMin, filterDaysMax]);

  // Quando i filtri cambiano, aggiorna la selezione (mantieni solo quelli ancora visibili)
  useEffect(() => {
    const filteredIds = new Set(filtered.map(e => e.id));
    setSelectedIds(prev => {
      const newSet = new Set<string>();
      prev.forEach(id => {
        if (filteredIds.has(id)) newSet.add(id);
      });
      return newSet;
    });
  }, [filtered]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e.id)));
    }
  };

  const selectedEntries = useMemo(() => {
    return filtered.filter(e => selectedIds.has(e.id));
  }, [filtered, selectedIds]);

  // Converte testo normale in HTML per email
  const textToHtml = (text: string): string => {
    // Escape HTML entities
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Converti link: [testo](url) → <a href="url">testo</a>
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #0066cc;">$1</a>');
    // Converti URL semplici in link cliccabili (ma non quelli già dentro un href)
    html = html.replace(/(?<!href=")(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color: #0066cc;">$1</a>');
    // Converti **grassetto**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Paragrafi: riga vuota separa paragrafi
    html = html
      .split(/\n\n+/)
      .map(p => `<p style="margin: 0 0 12px 0; line-height: 1.5;">${p.trim().replace(/\n/g, '<br>')}</p>`)
      .join('\n');
    return html;
  };

  // Anteprima email con placeholder sostituiti
  const getPreviewHtml = (entry: WaitlistEntry) => {
    const replaced = emailBody
      .replace(/\{nome\}/gi, entry.nome || '')
      .replace(/\{cognome\}/gi, entry.cognome || '')
      .replace(/\{professione\}/gi, entry.professione || '')
      .replace(/\{citta\}/gi, entry.citta || '')
      .replace(/\{email\}/gi, entry.email || '');
    return textToHtml(replaced);
  };

  const getPreviewSubject = (entry: WaitlistEntry) => {
    return emailSubject
      .replace(/\{nome\}/gi, entry.nome || '')
      .replace(/\{cognome\}/gi, entry.cognome || '')
      .replace(/\{professione\}/gi, entry.professione || '')
      .replace(/\{citta\}/gi, entry.citta || '')
      .replace(/\{email\}/gi, entry.email || '');
  };

  const handleSendEmails = async () => {
    if (selectedEntries.length === 0) {
      showToast('Nessun destinatario selezionato', 'error');
      return;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      showToast('Compila oggetto e corpo dell\'email', 'error');
      return;
    }

    const confirmMsg = `Stai per inviare ${selectedEntries.length} email. Continuare?`;
    if (!window.confirm(confirmMsg)) return;

    setSending(true);
    setSendResult(null);

    try {
      const sendBulkEmail = httpsCallable(functions, 'sendBulkWaitlistEmail');
      const result = await sendBulkEmail({
        recipients: selectedEntries.map(e => ({
          email: e.email,
          nome: e.nome,
          cognome: e.cognome,
          professione: e.professione,
          citta: e.citta,
        })),
        subject: emailSubject,
        bodyHtml: textToHtml(emailBody),
        fromAddress: emailFrom,
      });

      const data = result.data as { sent: number; failed: number; errors: string[] };
      setSendResult(data);
      showToast(`Email inviate: ${data.sent} riuscite, ${data.failed} fallite`, data.failed > 0 ? 'error' : 'success');
    } catch (error: any) {
      console.error('Errore invio email:', error);
      showToast(`Errore: ${error.message || 'Errore sconosciuto'}`, 'error');
    } finally {
      setSending(false);
    }
  };

  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 pt-0 pb-24 sm:pt-4 sm:pb-8">
        {/* Storico invii email */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Storico invii email waitlist</h2>
          {loadingHistory ? (
            <div className="text-gray-500">Caricamento storico...</div>
          ) : emailHistory.length === 0 ? (
            <div className="text-gray-400">Nessun invio registrato</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg shadow text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Data invio</th>
                    <th className="px-3 py-2 text-left">Oggetto</th>
                    <th className="px-3 py-2 text-left">Mittente</th>
                    <th className="px-3 py-2 text-left">Destinatari</th>
                    <th className="px-3 py-2 text-left">Risultato</th>
                  </tr>
                </thead>
                <tbody>
                  {emailHistory.map(entry => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{entry.sentAt?.toDate ? entry.sentAt.toDate().toLocaleString('it-IT') : '-'}</td>
                      <td className="px-3 py-2 max-w-xs truncate" title={entry.subject}>{entry.subject}</td>
                      <td className="px-3 py-2">{entry.fromAddress}@tuaequipe.it<br /><span className="text-xs text-gray-500">{entry.admin}</span></td>
                      <td className="px-3 py-2">
                        <span title={entry.recipients.map(r => r.email).join(', ')}>
                          {entry.recipients.length} destinatari
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={
                          entry.result.failed > 0
                            ? 'text-yellow-700 bg-yellow-100 rounded px-2'
                            : 'text-green-700 bg-green-100 rounded px-2'
                        }>
                          {entry.result.sent} inviate, {entry.result.failed} fallite
                        </span>
                        {entry.result.errors.length > 0 && (
                          <details className="text-xs mt-1">
                            <summary className="cursor-pointer text-yellow-700">Errori</summary>
                            <ul className="list-disc ml-4">
                              {entry.result.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                        {(entry.failedRecipients && entry.failedRecipients.length > 0) && (
                          <button
                            onClick={() => handleResendFailed(entry)}
                            disabled={resendingId === entry.id}
                            className="mt-1 px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 transition"
                          >
                            {resendingId === entry.id ? 'Reinvio...' : `Reinvia ${entry.failedRecipients.length} fallite`}
                          </button>
                        )}
                        {entry.lastResendAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Ultimo reinvio: {entry.lastResendAt.toDate ? entry.lastResendAt.toDate().toLocaleString('it-IT') : '-'}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Email Waitlist</h1>
            <p className="text-gray-600 mt-1">
              {selectedIds.size} selezionati su {filtered.length} filtrati ({entries.length} totali)
            </p>
          </div>
          <button
            onClick={() => setShowEmailPanel(!showEmailPanel)}
            disabled={selectedIds.size === 0}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2 self-start transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {showEmailPanel ? 'Chiudi pannello email' : `Invia email (${selectedIds.size})`}
          </button>
        </div>

        {/* Filtri */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Ricerca testo */}
            <input
              type="text"
              placeholder="Cerca per nome, email, città..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            {/* Professione */}
            <select
              value={filterProfessione}
              onChange={e => setFilterProfessione(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tutte le professioni</option>
              {professioni.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* Città */}
            <select
              value={filterCitta}
              onChange={e => setFilterCitta(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tutte le città</option>
              {citta.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Giorni dall'iscrizione min */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Giorni fa min:</label>
              <input
                type="number"
                min="0"
                placeholder="es. 7"
                value={filterDaysMin}
                onChange={e => setFilterDaysMin(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Giorni dall'iscrizione max */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Giorni fa max:</label>
              <input
                type="number"
                min="0"
                placeholder="es. 30"
                value={filterDaysMax}
                onChange={e => setFilterDaysMax(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Reset filtri */}
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterProfessione('all');
                setFilterCitta('all');
                setFilterDaysMin('');
                setFilterDaysMax('');
              }}
              className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition"
            >
              Reset filtri
            </button>
          </div>
        </div>

        {/* Pannello composizione email */}
        {showEmailPanel && (
          <div className="bg-white rounded-lg shadow-lg border-2 border-blue-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Componi email per {selectedIds.size} destinatari
            </h2>

            {/* Placeholder info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Placeholder disponibili:</strong> Usa questi tag nel testo e verranno sostituiti con i dati di ciascun destinatario:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['{nome}', '{cognome}', '{email}', '{professione}', '{citta}'].map(tag => (
                  <code key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-mono cursor-pointer hover:bg-blue-200"
                    onClick={() => {
                      navigator.clipboard.writeText(tag);
                      showToast(`${tag} copiato!`, 'success');
                    }}
                  >
                    {tag}
                  </code>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {/* Mittente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mittente</label>
                <select
                  value={emailFrom}
                  onChange={e => setEmailFrom(e.target.value as 'info' | 'noreply' | 'admin')}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="info">info@tuaequipe.it</option>
                  <option value="noreply">noreply@tuaequipe.it</option>
                  <option value="admin">admin@tuaequipe.it</option>
                </select>
              </div>

              {/* Oggetto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="es. Ciao {nome}, tuaequipe.it è online!"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Corpo email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Corpo email</label>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={10}
                  placeholder={`Ciao {nome}!\n\nSiamo felici di informarti che **tuaequipe.it** è finalmente online.\n\nCome {professione} a {citta}, sei tra i primi a poter accedere alla piattaforma.\n\n[Registrati ora](https://tuaequipe.it/register)\n\nA presto,\nIl team di tuaequipe.it`}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Scrivi normalmente. Riga vuota = nuovo paragrafo. **grassetto** per il grassetto. [testo](url) per i link.
                </p>
              </div>

              {/* Anteprima */}
              {emailBody && selectedEntries.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Anteprima (per: {selectedEntries[0].nome} {selectedEntries[0].cognome})
                  </label>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <p className="text-sm text-gray-500 mb-2">
                      <strong>Oggetto:</strong> {getPreviewSubject(selectedEntries[0])}
                    </p>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: getPreviewHtml(selectedEntries[0]) }}
                    />
                  </div>
                </div>
              )}

              {/* Risultato invio */}
              {sendResult && (
                <div className={`rounded-lg p-4 ${sendResult.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                  <p className={`font-medium ${sendResult.failed > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                    Inviate: {sendResult.sent} | Fallite: {sendResult.failed}
                  </p>
                  {sendResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-sm text-yellow-700 cursor-pointer">Mostra errori</summary>
                      <ul className="text-xs text-yellow-600 mt-1 space-y-1">
                        {sendResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {/* Pulsante invio */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendEmails}
                  disabled={sending || selectedIds.size === 0 || !emailSubject.trim() || !emailBody.trim()}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center gap-2 transition"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4  w-4 border-b-2 border-white"></div>
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Invia {selectedIds.size} email
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowEmailPanel(false);
                    setSendResult(null);
                  }}
                  className="px-4 py-2.5 text-gray-600 border rounded-lg hover:bg-gray-50 transition"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contenuto tabella */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Caricamento...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Nessun iscritto trovato con i filtri selezionati</p>
          </div>
        ) : (
          <>
            {/* Tabella desktop */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Professione</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Città</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Giorni fa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((entry) => {
                    const days = entry.createdAt?.toDate ? daysSince(entry.createdAt.toDate()) : null;
                    return (
                      <tr
                        key={entry.id}
                        className={`hover:bg-gray-50 transition cursor-pointer ${selectedIds.has(entry.id) ? 'bg-blue-50' : ''}`}
                        onClick={() => toggleSelection(entry.id)}
                      >
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelection(entry.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {entry.nome} {entry.cognome}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{entry.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {entry.professione}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{entry.citta}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {entry.createdAt?.toDate
                            ? entry.createdAt.toDate().toLocaleDateString('it-IT')
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          {days !== null ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              days <= 3 ? 'bg-green-50 text-green-700' :
                              days <= 7 ? 'bg-yellow-50 text-yellow-700' :
                              days <= 14 ? 'bg-orange-50 text-orange-700' :
                              'bg-red-50 text-red-700'
                            }`}>
                              {days}g
                            </span>
                          ) : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Card mobile */}
            <div className="md:hidden grid gap-3">
              {filtered.map((entry) => {
                const days = entry.createdAt?.toDate ? daysSince(entry.createdAt.toDate()) : null;
                return (
                  <div
                    key={entry.id}
                    className={`bg-white rounded-lg shadow p-4 cursor-pointer transition ${selectedIds.has(entry.id) ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
                    onClick={() => toggleSelection(entry.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelection(entry.id)}
                          onClick={e => e.stopPropagation()}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {entry.nome} {entry.cognome}
                          </p>
                          <p className="text-sm text-gray-600">{entry.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium whitespace-nowrap">
                          {entry.professione}
                        </span>
                        {days !== null && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            days <= 3 ? 'bg-green-50 text-green-700' :
                            days <= 7 ? 'bg-yellow-50 text-yellow-700' :
                            days <= 14 ? 'bg-orange-50 text-orange-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {days}g
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500 ml-6">
                      <span>{entry.citta}</span>
                      <span>
                        {entry.createdAt?.toDate
                          ? entry.createdAt.toDate().toLocaleDateString('it-IT')
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barra fissa in basso per selezione rapida */}
            {selectedIds.size > 0 && !showEmailPanel && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50 md:bottom-0">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedIds.size} destinatari selezionati
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 text-sm transition"
                    >
                      Deseleziona tutti
                    </button>
                    <button
                      onClick={() => {
                        setShowEmailPanel(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
                    >
                      Componi email
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
