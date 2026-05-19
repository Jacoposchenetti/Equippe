import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection, query, getDocs, doc, updateDoc,
  orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Header from '@/components/Header';
import { useModal } from '@/contexts/ModalContext';

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];
const MIN_GROUP_SIZE = 6;

type GroupStatus = 'pending' | 'contacted' | 'assigned' | 'declined';
type ActiveTab = 'dsa' | 'adhd';

interface GroupRequest {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  zona: string;
  coordinate?: { lat: number; lng: number };
  etaFiglio: string;
  disponibilita: string[];
  gdprConsent: boolean;
  status: GroupStatus;
  createdAt: Timestamp;
}

interface AdhdRequest {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  disponibilita: string[];
  disponibilita_label: string[];
  newsletter: boolean;
  gdprConsent: boolean;
  status: GroupStatus;
  createdAt: Timestamp;
}

const STATUS_LABELS: Record<GroupStatus, string> = {
  pending: 'In attesa',
  contacted: 'Contattato',
  assigned: 'Assegnato',
  declined: 'Declinato',
};

const STATUS_COLORS: Record<GroupStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  contacted: 'bg-blue-100 text-blue-800',
  assigned: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
};

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function AdminGruppiPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useModal();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dsa');

  // DSA state
  const [requests, setRequests] = useState<GroupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<GroupStatus | 'all'>('all');
  const [filterZona, setFilterZona] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ADHD state
  const [adhdRequests, setAdhdRequests] = useState<AdhdRequest[]>([]);
  const [adhdLoading, setAdhdLoading] = useState(true);
  const [adhdFilterStatus, setAdhdFilterStatus] = useState<GroupStatus | 'all'>('all');
  const [adhdUpdatingId, setAdhdUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
      navigate('/dashboard');
      return;
    }
    loadRequests();
    loadAdhdRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'group_therapy_requests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const data: GroupRequest[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupRequest));
      setRequests(data);
    } catch (err) {
      console.error(err);
      showToast('Errore nel caricamento delle richieste DSA', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAdhdRequests = async () => {
    setAdhdLoading(true);
    try {
      const snap = await getDocs(collection(db, 'adult_adhd_requests'));
      const data: AdhdRequest[] = snap.docs.map(d => ({
        id: d.id,
        status: 'pending',
        ...d.data(),
      } as AdhdRequest));
      setAdhdRequests(data);
    } catch (err) {
      console.error(err);
      showToast('Errore nel caricamento delle richieste ADHD', 'error');
    } finally {
      setAdhdLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: GroupStatus) => {
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'group_therapy_requests', id), { status: newStatus });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      showToast(`Stato aggiornato: ${STATUS_LABELS[newStatus]}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Errore aggiornamento stato', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const updateAdhdStatus = async (id: string, newStatus: GroupStatus) => {
    setAdhdUpdatingId(id);
    try {
      await updateDoc(doc(db, 'adult_adhd_requests', id), { status: newStatus });
      setAdhdRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      showToast(`Stato aggiornato: ${STATUS_LABELS[newStatus]}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Errore aggiornamento stato', 'error');
    } finally {
      setAdhdUpdatingId(null);
    }
  };

  /* —— DSA derived data —— */
  const activeRequests = requests.filter(r => r.status !== 'declined');
  const zonaCounts: Record<string, number> = {};
  activeRequests.forEach(r => {
    const key = r.zona || '—';
    zonaCounts[key] = (zonaCounts[key] || 0) + 1;
  });
  const zonaEntries = Object.entries(zonaCounts).sort((a, b) => b[1] - a[1]);
  const readyZones = zonaEntries.filter(([, count]) => count >= MIN_GROUP_SIZE);

  const filtered = requests.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterZona && !r.zona?.toLowerCase().includes(filterZona.toLowerCase())) return false;
    return true;
  });

  const uniqueZone = [...new Set(requests.map(r => r.zona).filter(Boolean))].sort();

  const dsaStats = [
    { label: 'Totale iscrizioni', value: requests.length, color: 'bg-blue-50 text-blue-700' },
    { label: 'In attesa', value: requests.filter(r => r.status === 'pending').length, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Gruppi attivabili', value: readyZones.length, color: 'bg-green-50 text-green-700' },
    { label: 'Assegnati', value: requests.filter(r => r.status === 'assigned').length, color: 'bg-purple-50 text-purple-700' },
  ];

  /* —— ADHD derived data —— */
  const adhdFiltered = adhdRequests.filter(r => {
    if (adhdFilterStatus !== 'all' && r.status !== adhdFilterStatus) return false;
    return true;
  });

  const adhdStats = [
    { label: 'Totale iscrizioni', value: adhdRequests.length, color: 'bg-orange-50 text-orange-700' },
    { label: 'In attesa', value: adhdRequests.filter(r => r.status === 'pending').length, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Contattati', value: adhdRequests.filter(r => r.status === 'contacted').length, color: 'bg-blue-50 text-blue-700' },
    { label: 'Assegnati', value: adhdRequests.filter(r => r.status === 'assigned').length, color: 'bg-green-50 text-green-700' },
  ];

  /* —— Status action buttons (shared) —— */
  function StatusActions({ id, status, onUpdate, busy }: { id: string; status: GroupStatus; onUpdate: (id: string, s: GroupStatus) => void; busy: boolean }) {
    return (
      <div className="flex gap-1 flex-wrap">
        {status !== 'contacted' && (
          <button disabled={busy} onClick={() => onUpdate(id, 'contacted')}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition disabled:opacity-50">
            Contattato
          </button>
        )}
        {status !== 'assigned' && (
          <button disabled={busy} onClick={() => onUpdate(id, 'assigned')}
            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition disabled:opacity-50">
            Assegnato
          </button>
        )}
        {status !== 'declined' && (
          <button disabled={busy} onClick={() => onUpdate(id, 'declined')}
            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition disabled:opacity-50">
            Declina
          </button>
        )}
        {status === 'declined' && (
          <button disabled={busy} onClick={() => onUpdate(id, 'pending')}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition disabled:opacity-50">
            Ripristina
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Equippe Gruppi — Richieste</h1>
          <p className="text-gray-500 mt-1 text-sm">Gestisci le richieste di partecipazione ai gruppi terapeutici.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('dsa')}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px ${
              activeTab === 'dsa'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Gruppi DSA
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">{requests.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('adhd')}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px ${
              activeTab === 'adhd'
                ? 'border-orange-500 text-orange-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Adulti ADHD
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">{adhdRequests.length}</span>
          </button>
        </div>

        {/* ══ DSA TAB ══ */}
        {activeTab === 'dsa' && (
          <>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {dsaStats.map(s => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm mt-1 opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Zone summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Riepilogo per zona</h2>
            <span className="text-xs text-gray-400">Min. {MIN_GROUP_SIZE} per attivare un gruppo</span>
          </div>
          <div className="divide-y divide-gray-50">
            {zonaEntries.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Nessuna iscrizione ancora.</p>
            )}
            {zonaEntries.map(([zona, count]) => {
              const isReady = count >= MIN_GROUP_SIZE;
              const pct = Math.min(100, Math.round((count / MIN_GROUP_SIZE) * 100));
              return (
                <div key={zona} className="px-6 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{zona}</p>
                      {isReady && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          Pronto!
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${isReady ? 'bg-green-500' : 'bg-blue-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-sm font-bold ${isReady ? 'text-green-700' : 'text-gray-600'}`}>
                    {count}/{MIN_GROUP_SIZE}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as GroupStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Tutti gli stati</option>
            {(Object.keys(STATUS_LABELS) as GroupStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          <select
            value={filterZona}
            onChange={e => setFilterZona(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Tutte le zone</option>
            {uniqueZone.map(z => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          <span className="text-sm text-gray-400 ml-auto">{filtered.length} richieste</span>

          <button
            onClick={loadRequests}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Aggiorna
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400">Caricamento...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">Nessuna richiesta trovata.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Nome', 'Contatto', 'Zona', 'Età figlio', 'Disponibilità', 'Data', 'Stato', 'Azioni'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {r.nome} {r.cognome}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <a href={`mailto:${r.email}`} className="block text-blue-600 hover:underline">{r.email}</a>
                        <a href={`tel:${r.telefono}`} className="block text-gray-500 hover:underline">{r.telefono}</a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[180px]">
                        <span className="block truncate" title={r.zona}>{r.zona || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {r.etaFiglio ? `${r.etaFiglio} anni` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <div className="flex flex-wrap gap-1">
                          {(r.disponibilita || []).map(d => (
                            <span key={d} className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{d}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusActions id={r.id} status={r.status} onUpdate={updateStatus} busy={updatingId === r.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}

        {/* ══ ADHD TAB ══ */}
        {activeTab === 'adhd' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {adhdStats.map(s => (
                <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
                  <p className="text-3xl font-bold">{s.value}</p>
                  <p className="text-sm mt-1 opacity-80">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <select
                value={adhdFilterStatus}
                onChange={e => setAdhdFilterStatus(e.target.value as GroupStatus | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Tutti gli stati</option>
                {(Object.keys(STATUS_LABELS) as GroupStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <span className="text-sm text-gray-400 ml-auto">{adhdFiltered.length} richieste</span>
              <button
                onClick={loadAdhdRequests}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Aggiorna
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {adhdLoading ? (
                <div className="py-16 text-center text-gray-400">Caricamento...</div>
              ) : adhdFiltered.length === 0 ? (
                <div className="py-16 text-center text-gray-400">Nessuna richiesta trovata.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Nome', 'Contatto', 'Disponibilità', 'Newsletter', 'Data', 'Stato', 'Azioni'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {adhdFiltered.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {r.nome} {r.cognome}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <a href={`mailto:${r.email}`} className="block text-blue-600 hover:underline">{r.email}</a>
                            <a href={`tel:${r.telefono}`} className="block text-gray-500 hover:underline">{r.telefono}</a>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <div className="flex flex-wrap gap-1">
                              {(r.disponibilita_label || r.disponibilita || []).map((d, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 rounded text-orange-700">{d}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-center">
                            {r.newsletter
                              ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Sì</span>
                              : <span className="text-gray-300">No</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(r.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_LABELS[r.status] || r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusActions id={r.id} status={r.status} onUpdate={updateAdhdStatus} busy={adhdUpdatingId === r.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

