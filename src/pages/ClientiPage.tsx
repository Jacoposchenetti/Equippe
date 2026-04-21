import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface Cliente {
  id: string;
  tipo: 'persona_fisica' | 'persona_giuridica';
  nome?: string;
  cognome?: string;
  ragioneSociale?: string;
  codiceFiscale: string;
  partitaIva?: string;
  indirizzo: string;
  cap: string;
  città: string;
  provincia: string;
  email?: string;
  telefono?: string;
  codiceDestinatario?: string;
  pec?: string;
  opposizioneSTS: boolean;
  note?: string;
}

const emptyCliente: Omit<Cliente, 'id'> = {
  tipo: 'persona_fisica',
  nome: '',
  cognome: '',
  codiceFiscale: '',
  indirizzo: '',
  cap: '',
  città: '',
  provincia: '',
  opposizioneSTS: false,
};

export default function ClientiPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState<Omit<Cliente, 'id'>>(emptyCliente);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'clienti'),
      orderBy('cognome', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setClienti(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cliente)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const filteredClienti = clienti.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nome = c.tipo === 'persona_giuridica' ? c.ragioneSociale || '' : `${c.nome || ''} ${c.cognome || ''}`;
    return nome.toLowerCase().includes(q) || c.codiceFiscale.toLowerCase().includes(q);
  });

  function openNew() {
    setForm(emptyCliente);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(cliente: Cliente) {
    const { id, ...rest } = cliente;
    setForm(rest);
    setEditingId(id);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!form.codiceFiscale || !form.indirizzo || !form.cap || !form.città || !form.provincia) {
      alert('Compila tutti i campi obbligatori.');
      return;
    }

    if (form.tipo === 'persona_fisica' && (!form.nome || !form.cognome)) {
      alert('Nome e cognome sono obbligatori per persona fisica.');
      return;
    }
    if (form.tipo === 'persona_giuridica' && !form.ragioneSociale) {
      alert('Ragione sociale obbligatoria per azienda.');
      return;
    }

    setSaving(true);
    try {
      const data = {
        ...form,
        codiceFiscale: form.codiceFiscale.toUpperCase(),
        provincia: form.provincia.toUpperCase(),
        updatedAt: new Date(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'users', user.uid, 'clienti', editingId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'clienti'), { ...data, createdAt: new Date() });
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error('Errore salvataggio cliente:', err);
      alert('Errore nel salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(clienteId: string) {
    if (!user) return;
    if (!confirm('Eliminare questo cliente? Le fatture già emesse non verranno modificate.')) return;
    await deleteDoc(doc(db, 'users', user.uid, 'clienti', clienteId));
  }

  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-4 sm:pb-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button onClick={() => navigate('/fatturazione')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Fatture
            </button>
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">Clienti</h1>
            <p className="text-gray-600 text-sm sm:text-base">Gestisci la tua anagrafica clienti per la fatturazione.</p>
          </div>
          <button onClick={openNew}
            className="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2 self-start">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuovo cliente
          </button>
        </div>

        {/* Search */}
        {clienti.length > 0 && (
          <div className="mb-6">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca per nome o codice fiscale..."
              className="w-full sm:max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        )}

        {/* Form modale */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Modifica cliente' : 'Nuovo cliente'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* Tipo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={form.tipo === 'persona_fisica'}
                        onChange={() => updateForm('tipo', 'persona_fisica')}
                        className="text-blue-600" />
                      <span className="text-sm">Persona fisica</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={form.tipo === 'persona_giuridica'}
                        onChange={() => updateForm('tipo', 'persona_giuridica')}
                        className="text-blue-600" />
                      <span className="text-sm">Azienda / Ente</span>
                    </label>
                  </div>
                </div>

                {/* Nome / Ragione Sociale */}
                {form.tipo === 'persona_fisica' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                      <input type="text" value={form.nome || ''} onChange={e => updateForm('nome', e.target.value)} required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
                      <input type="text" value={form.cognome || ''} onChange={e => updateForm('cognome', e.target.value)} required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ragione Sociale *</label>
                    <input type="text" value={form.ragioneSociale || ''} onChange={e => updateForm('ragioneSociale', e.target.value)} required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                )}

                {/* CF e P.IVA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale *</label>
                    <input type="text" value={form.codiceFiscale} onChange={e => updateForm('codiceFiscale', e.target.value.toUpperCase())}
                      required maxLength={16}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase" />
                  </div>
                  {form.tipo === 'persona_giuridica' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Partita IVA</label>
                      <input type="text" value={form.partitaIva || ''} onChange={e => updateForm('partitaIva', e.target.value.replace(/\D/g, '').slice(0, 11))}
                        maxLength={11}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  )}
                </div>

                {/* Indirizzo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo *</label>
                  <input type="text" value={form.indirizzo} onChange={e => updateForm('indirizzo', e.target.value)} required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CAP *</label>
                    <input type="text" value={form.cap} onChange={e => updateForm('cap', e.target.value.replace(/\D/g, '').slice(0, 5))} required maxLength={5}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Città *</label>
                    <input type="text" value={form.città} onChange={e => updateForm('città', e.target.value)} required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prov. *</label>
                    <input type="text" value={form.provincia} onChange={e => updateForm('provincia', e.target.value.toUpperCase().slice(0, 2))} required maxLength={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase" />
                  </div>
                </div>

                {/* Contatti */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email || ''} onChange={e => updateForm('email', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                    <input type="tel" value={form.telefono || ''} onChange={e => updateForm('telefono', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>

                {/* SDI per aziende */}
                {form.tipo === 'persona_giuridica' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Codice Destinatario SDI</label>
                      <input type="text" value={form.codiceDestinatario || ''} onChange={e => updateForm('codiceDestinatario', e.target.value.toUpperCase().slice(0, 7))} maxLength={7}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PEC</label>
                      <input type="email" value={form.pec || ''} onChange={e => updateForm('pec', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                )}

                {/* Opposizione STS */}
                {form.tipo === 'persona_fisica' && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <input type="checkbox" checked={form.opposizioneSTS}
                      onChange={e => updateForm('opposizioneSTS', e.target.checked)}
                      className="h-4 w-4 rounded text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Opposizione invio dati STS</p>
                      <p className="text-xs text-amber-600">Il paziente si oppone all'invio dei dati al Sistema Tessera Sanitaria</p>
                    </div>
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea value={form.note || ''} onChange={e => updateForm('note', e.target.value)} rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
                    Annulla
                  </button>
                  <button type="submit" disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-semibold">
                    {saving ? 'Salvataggio...' : editingId ? 'Salva modifiche' : 'Aggiungi cliente'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Lista clienti */}
        {!loading && filteredClienti.length > 0 && (
          <div className="space-y-3">
            {filteredClienti.map(c => {
              const nomeDisplay = c.tipo === 'persona_giuridica'
                ? c.ragioneSociale || ''
                : `${c.cognome || ''} ${c.nome || ''}`.trim();

              return (
                <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{nomeDisplay}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.tipo === 'persona_giuridica' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {c.tipo === 'persona_giuridica' ? 'Azienda' : 'Persona'}
                      </span>
                      {c.opposizioneSTS && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">No STS</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      CF: {c.codiceFiscale}
                      {c.partitaIva && ` · P.IVA: ${c.partitaIva}`}
                      {` · ${c.città} (${c.provincia})`}
                    </p>
                  </div>
                  <div className="flex gap-2 self-end sm:self-center">
                    <button onClick={() => openEdit(c)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-50 rounded-lg transition">
                      Modifica
                    </button>
                    <button onClick={() => handleDelete(c.id)}
                      className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1.5 hover:bg-red-50 rounded-lg transition">
                      Elimina
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && clienti.length === 0 && (
          <div className="text-center py-16">
            <div className="mb-4 text-6xl">👥</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Nessun cliente</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Aggiungi i tuoi clienti per poter creare fatture velocemente.
            </p>
            <button onClick={openNew}
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
              Aggiungi il primo cliente
            </button>
          </div>
        )}

        {/* No results */}
        {!loading && clienti.length > 0 && filteredClienti.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Nessun cliente trovato per "{searchQuery}"</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
