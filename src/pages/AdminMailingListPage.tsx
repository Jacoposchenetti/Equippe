import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Header from '@/components/Header';
import { useModal } from '@/contexts/ModalContext';

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com'];

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

export default function AdminMailingListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useModal();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProfessione, setFilterProfessione] = useState<string>('all');

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
      console.error('Errore caricamento mailing list:', error);
      showToast('Errore nel caricamento della mailing list', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Professioni uniche per il filtro
  const professioni = [...new Set(entries.map(e => e.professione))].sort();

  const filtered = entries.filter(entry => {
    const matchSearch =
      !searchTerm ||
      `${entry.nome} ${entry.cognome} ${entry.email} ${entry.citta}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchProfessione =
      filterProfessione === 'all' || entry.professione === filterProfessione;
    return matchSearch && matchProfessione;
  });

  const handleExportCSV = () => {
    const header = 'Nome,Cognome,Email,Professione,Città,Data iscrizione';
    const rows = filtered.map(e => {
      const date = e.createdAt?.toDate
        ? e.createdAt.toDate().toLocaleDateString('it-IT')
        : 'N/A';
      // Escape fields that may contain commas
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      return [esc(e.nome), esc(e.cognome), esc(e.email), esc(e.professione), esc(e.citta), date].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailing-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mailing List</h1>
            <p className="text-gray-600 mt-1">
              {filtered.length} iscritti{filtered.length !== entries.length ? ` (su ${entries.length} totali)` : ''}
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center gap-2 self-start"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Esporta CSV
          </button>
        </div>

        {/* Filtri */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Cerca per nome, email o città..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
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
        </div>

        {/* Contenuto */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Caricamento...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Nessun iscritto trovato</p>
          </div>
        ) : (
          <>
            {/* Tabella desktop */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Professione</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Città</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((entry, idx) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card mobile */}
            <div className="md:hidden grid gap-3">
              {filtered.map((entry, idx) => (
                <div key={entry.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {idx + 1}. {entry.nome} {entry.cognome}
                      </p>
                      <p className="text-sm text-gray-600">{entry.email}</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium whitespace-nowrap">
                      {entry.professione}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{entry.citta}</span>
                    <span>
                      {entry.createdAt?.toDate
                        ? entry.createdAt.toDate().toLocaleDateString('it-IT')
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
