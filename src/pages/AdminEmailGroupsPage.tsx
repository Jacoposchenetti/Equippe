import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { collection, query, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import Header from '@/components/Header';

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

// ── Types ──────────────────────────────────────────────────────────────

interface GroupCriteria {
  professioni?: string[];
  citta?: string[];
  daysMin?: number | null;
  daysMax?: number | null;
}

interface EmailGroup {
  id: string;
  name: string;
  description?: string;
  criteria: GroupCriteria;
  autoAssign: boolean;
  memberIds: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastRebuiltAt?: Timestamp;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface WaitlistEntry {
  id: string;
  professione: string;
  citta: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

const emptyGroup = (): Omit<EmailGroup, 'id' | 'memberIds' | 'createdAt' | 'updatedAt' | 'lastRebuiltAt'> => ({
  name: '',
  description: '',
  criteria: { professioni: [], citta: [], daysMin: null, daysMax: null },
  autoAssign: true,
});

const emptyTemplate = (): Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  subject: '',
  body: '',
});

// ── Component ──────────────────────────────────────────────────────────

export default function AdminEmailGroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useModal();

  const [tab, setTab] = useState<'groups' | 'templates'>('groups');

  // Waitlist entries (per i valori unici di professione/città)
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);

  // Gruppi
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [editingGroup, setEditingGroup] = useState<null | (Omit<EmailGroup, 'id' | 'memberIds' | 'createdAt' | 'updatedAt' | 'lastRebuiltAt'> & { id?: string })>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [rebuildingId, setRebuildingId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  // Template
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<null | (Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string })>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const professioni = useMemo(() => [...new Set(waitlistEntries.map(e => e.professione).filter(Boolean))].sort(), [waitlistEntries]);
  const citta = useMemo(() => [...new Set(waitlistEntries.map(e => e.citta).filter(Boolean))].sort(), [waitlistEntries]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
      navigate('/dashboard'); return;
    }
    loadAll();
  }, [user]);

  const loadAll = async () => {
    loadGroups();
    loadTemplates();
    loadWaitlist();
  };

  const loadWaitlist = async () => {
    try {
      const snap = await getDocs(collection(db, 'waitlist'));
      setWaitlistEntries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch { /* silently ignore */ }
  };

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const q = query(collection(db, 'waitlist_email_groups'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailGroup)));
    } catch (err) {
      console.error(err);
      showToast('Errore caricamento gruppi', 'error');
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const q = query(collection(db, 'waitlist_email_templates'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailTemplate)));
    } catch (err) {
      console.error(err);
      showToast('Errore caricamento template', 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  // ── Group actions ──

  const handleSaveGroup = async () => {
    if (!editingGroup) return;
    if (!editingGroup.name.trim()) { showToast('Nome obbligatorio', 'error'); return; }
    setSavingGroup(true);
    try {
      const fn = httpsCallable(functions, 'saveWaitlistEmailGroup');
      await fn({
        id: editingGroup.id || undefined,
        name: editingGroup.name,
        description: editingGroup.description,
        criteria: editingGroup.criteria,
        autoAssign: editingGroup.autoAssign,
      });
      showToast(editingGroup.id ? 'Gruppo aggiornato' : 'Gruppo creato', 'success');
      setEditingGroup(null);
      loadGroups();
    } catch (err: any) {
      showToast(`Errore: ${err.message}`, 'error');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!window.confirm(`Eliminare il gruppo "${name}"?`)) return;
    setDeletingGroupId(id);
    try {
      await httpsCallable(functions, 'deleteWaitlistEmailGroup')({ id });
      showToast('Gruppo eliminato', 'success');
      setGroups(prev => prev.filter(g => g.id !== id));
    } catch (err: any) {
      showToast(`Errore: ${err.message}`, 'error');
    } finally {
      setDeletingGroupId(null);
    }
  };

  const handleRebuild = async (id: string, name: string) => {
    if (!window.confirm(`Ricalcolare i membri del gruppo "${name}" in base ai criteri correnti?\nI membri attuali verranno sostituiti.`)) return;
    setRebuildingId(id);
    try {
      const result = await httpsCallable(functions, 'rebuildWaitlistEmailGroup')({ id }) as any;
      showToast(`Gruppo ricalcolato: ${result.data.count} membri`, 'success');
      loadGroups();
    } catch (err: any) {
      showToast(`Errore: ${err.message}`, 'error');
    } finally {
      setRebuildingId(null);
    }
  };

  // ── Template actions ──

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    if (!editingTemplate.name.trim() || !editingTemplate.subject.trim() || !editingTemplate.body.trim()) {
      showToast('Nome, oggetto e corpo sono obbligatori', 'error'); return;
    }
    setSavingTemplate(true);
    try {
      const fn = httpsCallable(functions, 'saveWaitlistEmailTemplate');
      await fn({
        id: editingTemplate.id || undefined,
        name: editingTemplate.name,
        subject: editingTemplate.subject,
        body: editingTemplate.body,
      });
      showToast(editingTemplate.id ? 'Template aggiornato' : 'Template creato', 'success');
      setEditingTemplate(null);
      loadTemplates();
    } catch (err: any) {
      showToast(`Errore: ${err.message}`, 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!window.confirm(`Eliminare il template "${name}"?`)) return;
    setDeletingTemplateId(id);
    try {
      await httpsCallable(functions, 'deleteWaitlistEmailTemplate')({ id });
      showToast('Template eliminato', 'success');
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      showToast(`Errore: ${err.message}`, 'error');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // ── Render helpers ──

  const MultiSelect = ({
    label, options, selected, onChange,
  }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="border rounded-lg p-2 max-h-36 overflow-y-auto bg-white">
        {options.length === 0 && <span className="text-xs text-gray-400">Nessun valore disponibile</span>}
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-gray-50 px-1 rounded">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={e => {
                if (e.target.checked) onChange([...selected, opt]);
                else onChange(selected.filter(s => s !== opt));
              }}
              className="rounded border-gray-300 text-blue-600"
            />
            {opt}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-blue-600 mt-1">
          Selezionati: {selected.join(', ')}
          <button className="ml-2 text-gray-400 hover:text-gray-600" onClick={() => onChange([])}>✕ deseleziona tutti</button>
        </p>
      )}
    </div>
  );

  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 pt-0 pb-24 sm:pt-4 sm:pb-8">
        {/* Breadcrumb */}
        <div className="mb-4">
          <button onClick={() => navigate('/admin/waitlist-email')} className="text-sm text-blue-600 hover:underline">
            ← Torna a Email Waitlist
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestione Gruppi &amp; Template</h1>
        <p className="text-gray-600 mb-6">
          Crea gruppi di destinatari con criteri automatici e testi pre-compilati riutilizzabili.
        </p>

        {/* Tab */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setTab('groups')}
            className={`px-5 py-2.5 font-medium text-sm transition border-b-2 -mb-px ${tab === 'groups' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            🗂 Gruppi destinatari
          </button>
          <button
            onClick={() => setTab('templates')}
            className={`px-5 py-2.5 font-medium text-sm transition border-b-2 -mb-px ${tab === 'templates' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            📝 Template email
          </button>
        </div>

        {/* ── GRUPPI ── */}
        {tab === 'groups' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Gruppi destinatari</h2>
              <button
                onClick={() => setEditingGroup(emptyGroup())}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition"
              >
                + Nuovo gruppo
              </button>
            </div>

            {/* Form creazione/modifica gruppo */}
            {editingGroup && (
              <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingGroup.id ? `Modifica gruppo: ${editingGroup.name}` : 'Nuovo gruppo'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome gruppo *</label>
                    <input
                      type="text"
                      value={editingGroup.name}
                      onChange={e => setEditingGroup(g => g ? { ...g, name: e.target.value } : g)}
                      placeholder="es. Nutrizionisti Roma"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                    <input
                      type="text"
                      value={editingGroup.description || ''}
                      onChange={e => setEditingGroup(g => g ? { ...g, description: e.target.value } : g)}
                      placeholder="Descrizione opzionale"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Criteri di filtraggio{' '}
                      <span className="text-gray-400 font-normal">(lascia vuoto = nessun filtro per quel campo)</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <MultiSelect
                        label="Professioni"
                        options={professioni}
                        selected={editingGroup.criteria.professioni || []}
                        onChange={v => setEditingGroup(g => g ? { ...g, criteria: { ...g.criteria, professioni: v } } : g)}
                      />
                      <MultiSelect
                        label="Città"
                        options={citta}
                        selected={editingGroup.criteria.citta || []}
                        onChange={v => setEditingGroup(g => g ? { ...g, criteria: { ...g.criteria, citta: v } } : g)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Giorni dall'iscrizione (min)</label>
                        <input
                          type="number"
                          min="0"
                          value={editingGroup.criteria.daysMin ?? ''}
                          onChange={e => setEditingGroup(g => g ? { ...g, criteria: { ...g.criteria, daysMin: e.target.value !== '' ? parseInt(e.target.value) : null } } : g)}
                          placeholder="es. 0"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Giorni dall'iscrizione (max)</label>
                        <input
                          type="number"
                          min="0"
                          value={editingGroup.criteria.daysMax ?? ''}
                          onChange={e => setEditingGroup(g => g ? { ...g, criteria: { ...g.criteria, daysMax: e.target.value !== '' ? parseInt(e.target.value) : null } } : g)}
                          placeholder="es. 30"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingGroup.autoAssign}
                      onChange={e => setEditingGroup(g => g ? { ...g, autoAssign: e.target.checked } : g)}
                      className="rounded border-gray-300 text-blue-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">
                      <strong>Auto-assign</strong> — aggiungi automaticamente i nuovi iscritti alla waitlist che soddisfano i criteri
                    </span>
                  </label>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleSaveGroup}
                      disabled={savingGroup}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition"
                    >
                      {savingGroup ? 'Salvataggio...' : 'Salva gruppo'}
                    </button>
                    <button
                      onClick={() => setEditingGroup(null)}
                      className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista gruppi */}
            {loadingGroups ? (
              <div className="text-gray-500 py-6 text-center">Caricamento gruppi...</div>
            ) : groups.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
                Nessun gruppo creato. Creane uno per segmentare i destinatari.
              </div>
            ) : (
              <div className="grid gap-4">
                {groups.map(group => (
                  <div key={group.id} className="bg-white rounded-xl shadow p-5 border border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-gray-900">{group.name}</h3>
                          {group.autoAssign && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">auto-assign</span>
                          )}
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                            {group.memberIds?.length ?? 0} membri
                          </span>
                        </div>
                        {group.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
                        )}
                        {/* Criteri badge */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {group.criteria.professioni && group.criteria.professioni.length > 0 && (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded border border-purple-200">
                              👔 {group.criteria.professioni.join(', ')}
                            </span>
                          )}
                          {group.criteria.citta && group.criteria.citta.length > 0 && (
                            <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded border border-yellow-200">
                              📍 {group.criteria.citta.join(', ')}
                            </span>
                          )}
                          {(group.criteria.daysMin != null || group.criteria.daysMax != null) && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                              📅 {group.criteria.daysMin ?? 0}–{group.criteria.daysMax ?? '∞'} giorni
                            </span>
                          )}
                          {(!group.criteria.professioni?.length && !group.criteria.citta?.length && group.criteria.daysMin == null && group.criteria.daysMax == null) && (
                            <span className="text-xs text-gray-400 italic">Nessun criterio (tutti gli iscritti)</span>
                          )}
                        </div>
                        {group.lastRebuiltAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Ultimo ricalcolo: {group.lastRebuiltAt.toDate?.().toLocaleString('it-IT') ?? '-'}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleRebuild(group.id, group.name)}
                          disabled={rebuildingId === group.id}
                          title="Ricalcola membri in base ai criteri attuali"
                          className="px-3 py-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition"
                        >
                          {rebuildingId === group.id ? '...' : '↻ Ricalcola'}
                        </button>
                        <button
                          onClick={() => setEditingGroup({
                            id: group.id,
                            name: group.name,
                            description: group.description || '',
                            criteria: { ...group.criteria },
                            autoAssign: group.autoAssign,
                          })}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          disabled={deletingGroupId === group.id}
                          className="px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition"
                        >
                          {deletingGroupId === group.id ? '...' : 'Elimina'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TEMPLATE ── */}
        {tab === 'templates' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Template email</h2>
              <button
                onClick={() => setEditingTemplate(emptyTemplate())}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition"
              >
                + Nuovo template
              </button>
            </div>

            {/* Form creazione/modifica template */}
            {editingTemplate && (
              <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingTemplate.id ? `Modifica template: ${editingTemplate.name}` : 'Nuovo template'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome template *</label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={e => setEditingTemplate(t => t ? { ...t, name: e.target.value } : t)}
                      placeholder="es. Lancio piattaforma – nutrizionisti"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto *</label>
                    <input
                      type="text"
                      value={editingTemplate.subject}
                      onChange={e => setEditingTemplate(t => t ? { ...t, subject: e.target.value } : t)}
                      placeholder="es. Ciao {nome}, tuaequipe.it è online!"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Corpo email *</label>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2 text-xs text-blue-700">
                      Placeholder: <code className="font-mono">{'{nome}'}</code> <code className="font-mono">{'{cognome}'}</code> <code className="font-mono">{'{professione}'}</code> <code className="font-mono">{'{citta}'}</code> <code className="font-mono">{'{unsubscribe_url}'}</code>
                    </div>
                    <textarea
                      value={editingTemplate.body}
                      onChange={e => setEditingTemplate(t => t ? { ...t, body: e.target.value } : t)}
                      rows={10}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder={"Ciao {nome}!\n\n..."}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      **grassetto**, [testo](url) per link, riga vuota = nuovo paragrafo.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleSaveTemplate}
                      disabled={savingTemplate}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition"
                    >
                      {savingTemplate ? 'Salvataggio...' : 'Salva template'}
                    </button>
                    <button
                      onClick={() => setEditingTemplate(null)}
                      className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista template */}
            {loadingTemplates ? (
              <div className="text-gray-500 py-6 text-center">Caricamento template...</div>
            ) : templates.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
                Nessun template creato. Crea un template per riutilizzare i testi.
              </div>
            ) : (
              <div className="grid gap-4">
                {templates.map(tmpl => (
                  <div key={tmpl.id} className="bg-white rounded-xl shadow p-5 border border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-gray-900">{tmpl.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">
                          <strong>Oggetto:</strong> {tmpl.subject}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{tmpl.body}</p>
                        {tmpl.updatedAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Aggiornato: {tmpl.updatedAt.toDate?.().toLocaleString('it-IT') ?? '-'}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setEditingTemplate({
                            id: tmpl.id,
                            name: tmpl.name,
                            subject: tmpl.subject,
                            body: tmpl.body,
                          })}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                          disabled={deletingTemplateId === tmpl.id}
                          className="px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition"
                        >
                          {deletingTemplateId === tmpl.id ? '...' : 'Elimina'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
