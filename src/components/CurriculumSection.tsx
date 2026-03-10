import { useState } from 'react';
import { EsperienzaProfessionale, Formazione, Certificazione } from '@/types/equippe';

// ===== ID Generator =====
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ===== Sub-components for forms =====

interface EsperienzaFormProps {
  esperienza?: EsperienzaProfessionale;
  onSave: (e: EsperienzaProfessionale) => void;
  onCancel: () => void;
}

function EsperienzaForm({ esperienza, onSave, onCancel }: EsperienzaFormProps) {
  const [form, setForm] = useState<EsperienzaProfessionale>(esperienza || {
    id: generateId(),
    titolo: '',
    organizzazione: '',
    indirizzo: '',
    descrizione: '',
    dataInizio: '',
    dataFine: '',
    attuale: false,
  });

  const handleSubmit = () => {
    if (!form.titolo.trim() || !form.organizzazione.trim() || !form.dataInizio) return;
    onSave({ ...form, dataFine: form.attuale ? undefined : form.dataFine });
  };

  return (
    <div className="space-y-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo / Titolo *</label>
        <input
          type="text"
          value={form.titolo}
          onChange={(e) => setForm({ ...form, titolo: e.target.value })}
          placeholder="es. Psicologa / Psicoterapeuta"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Organizzazione / Ente *</label>
        <input
          type="text"
          value={form.organizzazione}
          onChange={(e) => setForm({ ...form, organizzazione: e.target.value })}
          placeholder="es. Studio Privato Dott.ssa Rossi"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
        <input
          type="text"
          value={form.indirizzo || ''}
          onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
          placeholder="es. Via Trieste 19, Villanova PE"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio *</label>
          <input
            type="month"
            value={form.dataInizio}
            onChange={(e) => setForm({ ...form, dataInizio: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
          <input
            type="month"
            value={form.attuale ? '' : (form.dataFine || '')}
            onChange={(e) => setForm({ ...form, dataFine: e.target.value })}
            disabled={form.attuale}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.attuale}
          onChange={(e) => setForm({ ...form, attuale: e.target.checked, dataFine: e.target.checked ? undefined : form.dataFine })}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Attualmente in corso</span>
      </label>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
        <textarea
          value={form.descrizione || ''}
          onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
          placeholder="Descrivi le tue attività e responsabilità..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          Annulla
        </button>
        <button type="button" onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {esperienza ? 'Salva Modifiche' : 'Aggiungi'}
        </button>
      </div>
    </div>
  );
}

interface FormazioneFormProps {
  formazione?: Formazione;
  onSave: (f: Formazione) => void;
  onCancel: () => void;
}

function FormazioneForm({ formazione, onSave, onCancel }: FormazioneFormProps) {
  const [form, setForm] = useState<Formazione>(formazione || {
    id: generateId(),
    titolo: '',
    istituzione: '',
    annoConseguimento: '',
  });

  const handleSubmit = () => {
    if (!form.titolo.trim() || !form.istituzione.trim() || !form.annoConseguimento) return;
    onSave(form);
  };

  return (
    <div className="space-y-3 p-4 border border-purple-200 rounded-lg bg-purple-50">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titolo di Studio *</label>
        <input
          type="text"
          value={form.titolo}
          onChange={(e) => setForm({ ...form, titolo: e.target.value })}
          placeholder="es. Laurea Magistrale in Psicologia"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Istituzione *</label>
        <input
          type="text"
          value={form.istituzione}
          onChange={(e) => setForm({ ...form, istituzione: e.target.value })}
          placeholder="es. Università La Sapienza"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Anno Conseguimento *</label>
        <input
          type="number"
          value={form.annoConseguimento}
          onChange={(e) => setForm({ ...form, annoConseguimento: e.target.value })}
          placeholder="es. 2018"
          min="1950"
          max={new Date().getFullYear()}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          Annulla
        </button>
        <button type="button" onClick={handleSubmit} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          {formazione ? 'Salva Modifiche' : 'Aggiungi'}
        </button>
      </div>
    </div>
  );
}

interface CertificazioneFormProps {
  certificazione?: Certificazione;
  onSave: (c: Certificazione) => void;
  onCancel: () => void;
}

function CertificazioneForm({ certificazione, onSave, onCancel }: CertificazioneFormProps) {
  const [form, setForm] = useState<Certificazione>(certificazione || {
    id: generateId(),
    titolo: '',
    istituzione: '',
    anno: '',
  });

  const handleSubmit = () => {
    if (!form.titolo.trim() || !form.istituzione.trim() || !form.anno) return;
    onSave(form);
  };

  return (
    <div className="space-y-3 p-4 border border-amber-200 rounded-lg bg-amber-50">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titolo Attestato/Certificazione *</label>
        <input
          type="text"
          value={form.titolo}
          onChange={(e) => setForm({ ...form, titolo: e.target.value })}
          placeholder="es. Corso EMDR livello 2"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ente / Istituzione *</label>
        <input
          type="text"
          value={form.istituzione}
          onChange={(e) => setForm({ ...form, istituzione: e.target.value })}
          placeholder="es. Centro di Psicologia Clinica"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Anno *</label>
        <input
          type="number"
          value={form.anno}
          onChange={(e) => setForm({ ...form, anno: e.target.value })}
          placeholder="es. 2023"
          min="1950"
          max={new Date().getFullYear()}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          required
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          Annulla
        </button>
        <button type="button" onClick={handleSubmit} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
          {certificazione ? 'Salva Modifiche' : 'Aggiungi'}
        </button>
      </div>
    </div>
  );
}

// ===== Helper formatting =====
function formatDateRange(inizio: string, fine?: string, attuale?: boolean): string {
  const formatMonth = (d: string) => {
    const [y, m] = d.split('-');
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${months[parseInt(m) - 1]} ${y}`;
  };
  const start = formatMonth(inizio);
  const end = attuale ? 'Oggi' : (fine ? formatMonth(fine) : 'Oggi');
  return `${start} - ${end}`;
}

// ===== Display Card for Esperienza =====
function EsperienzaCard({ esperienza, onEdit, onRemove }: {
  esperienza: EsperienzaProfessionale;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-3 p-3">
      <div className="flex-shrink-0 mt-1">
        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900">{esperienza.titolo}</h4>
        <p className="text-sm text-gray-600">{esperienza.organizzazione}</p>
        <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mt-0.5">
          {formatDateRange(esperienza.dataInizio, esperienza.dataFine, esperienza.attuale)}
        </p>
        {esperienza.indirizzo && (
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {esperienza.indirizzo}
          </p>
        )}
        {esperienza.descrizione && (
          <>
            <p className={`text-sm text-gray-600 mt-1 ${!expanded ? 'line-clamp-2' : ''}`}>
              {esperienza.descrizione}
            </p>
            {esperienza.descrizione.length > 120 && (
              <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-600 hover:text-blue-800 mt-0.5">
                {expanded ? 'Mostra meno' : 'Mostra altro'}
              </button>
            )}
          </>
        )}
      </div>
      {(onEdit || onRemove) && (
        <div className="flex-shrink-0 flex gap-1">
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Modifica">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Rimuovi">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Display Card for Formazione =====
function FormazioneCard({ formazione, onEdit, onRemove }: {
  formazione: Formazione;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex gap-3 p-3">
      <div className="flex-shrink-0 mt-1">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 14l9-5-9-5-9 5 9 5z" />
            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900">{formazione.titolo}</h4>
        <p className="text-sm text-gray-600">{formazione.istituzione}</p>
        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mt-0.5">
          Conseguito nel {formazione.annoConseguimento}
        </p>
      </div>
      {(onEdit || onRemove) && (
        <div className="flex-shrink-0 flex gap-1">
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Modifica">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Rimuovi">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Display Card for Certificazione =====
function CertificazioneCard({ certificazione, onEdit, onRemove }: {
  certificazione: Certificazione;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex gap-3 p-3">
      <div className="flex-shrink-0 mt-1">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900">{certificazione.titolo}</h4>
        <p className="text-sm text-gray-600">{certificazione.istituzione}</p>
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mt-0.5">{certificazione.anno}</p>
      </div>
      {(onEdit || onRemove) && (
        <div className="flex-shrink-0 flex gap-1">
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Modifica">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Rimuovi">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Main Exported Components =====

// Read-only display for public profile
export function CurriculumDisplay({ esperienze, formazione, certificazioni }: {
  esperienze?: EsperienzaProfessionale[];
  formazione?: Formazione[];
  certificazioni?: Certificazione[];
}) {
  const attuali = (esperienze || []).filter(e => e.attuale).sort((a, b) => b.dataInizio.localeCompare(a.dataInizio));
  const passate = (esperienze || []).filter(e => !e.attuale).sort((a, b) => (b.dataFine || b.dataInizio).localeCompare(a.dataFine || a.dataInizio));
  const formazioneOrdinata = [...(formazione || [])].sort((a, b) => b.annoConseguimento.localeCompare(a.annoConseguimento));
  const certOrdinati = [...(certificazioni || [])].sort((a, b) => b.anno.localeCompare(a.anno));
  const [showAllPast, setShowAllPast] = useState(false);

  const hasContent = attuali.length > 0 || passate.length > 0 || formazioneOrdinata.length > 0 || certOrdinati.length > 0;
  if (!hasContent) return null;

  return (
    <>
      {/* Esperienze Attuali */}
      {attuali.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Esperienze professionali attuali</h2>
          <div className="divide-y divide-gray-100">
            {attuali.map(e => <EsperienzaCard key={e.id} esperienza={e} />)}
          </div>
        </div>
      )}

      {/* Esperienze Passate */}
      {passate.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Esperienze professionali passate</h2>
            {passate.length > 2 && (
              <button
                onClick={() => setShowAllPast(!showAllPast)}
                className="text-sm font-semibold text-orange-600 hover:text-orange-800 flex items-center gap-1"
              >
                {showAllPast ? 'MOSTRA MENO' : 'MOSTRA TUTTO'}
                <svg className={`w-4 h-4 transition-transform ${showAllPast ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {(showAllPast ? passate : passate.slice(0, 2)).map(e => <EsperienzaCard key={e.id} esperienza={e} />)}
          </div>
        </div>
      )}

      {/* Formazione */}
      {formazioneOrdinata.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Formazione</h2>
          <div className="divide-y divide-gray-100">
            {formazioneOrdinata.map(f => <FormazioneCard key={f.id} formazione={f} />)}
          </div>
        </div>
      )}

      {/* Certificazioni */}
      {certOrdinati.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Attestati e certificazioni</h2>
          <div className="divide-y divide-gray-100">
            {certOrdinati.map(c => <CertificazioneCard key={c.id} certificazione={c} />)}
          </div>
        </div>
      )}
    </>
  );
}

// Editable section for profile edit page
export function CurriculumEditor({ esperienze, formazione, certificazioni, onChange }: {
  esperienze: EsperienzaProfessionale[];
  formazione: Formazione[];
  certificazioni: Certificazione[];
  onChange: (data: { esperienze: EsperienzaProfessionale[]; formazione: Formazione[]; certificazioni: Certificazione[] }) => void;
}) {
  const [showEspForm, setShowEspForm] = useState(false);
  const [editingEsp, setEditingEsp] = useState<EsperienzaProfessionale | null>(null);
  const [showFormForm, setShowFormForm] = useState(false);
  const [editingForm, setEditingForm] = useState<Formazione | null>(null);
  const [showCertForm, setShowCertForm] = useState(false);
  const [editingCert, setEditingCert] = useState<Certificazione | null>(null);

  // Esperienza handlers
  const handleSaveEsperienza = (e: EsperienzaProfessionale) => {
    const updated = editingEsp
      ? esperienze.map(ex => ex.id === e.id ? e : ex)
      : [...esperienze, e];
    onChange({ esperienze: updated, formazione, certificazioni });
    setShowEspForm(false);
    setEditingEsp(null);
  };

  const handleRemoveEsperienza = (id: string) => {
    onChange({ esperienze: esperienze.filter(e => e.id !== id), formazione, certificazioni });
  };

  // Formazione handlers
  const handleSaveFormazione = (f: Formazione) => {
    const updated = editingForm
      ? formazione.map(fx => fx.id === f.id ? f : fx)
      : [...formazione, f];
    onChange({ esperienze, formazione: updated, certificazioni });
    setShowFormForm(false);
    setEditingForm(null);
  };

  const handleRemoveFormazione = (id: string) => {
    onChange({ esperienze, formazione: formazione.filter(f => f.id !== id), certificazioni });
  };

  // Certificazione handlers
  const handleSaveCertificazione = (c: Certificazione) => {
    const updated = editingCert
      ? certificazioni.map(cx => cx.id === c.id ? c : cx)
      : [...certificazioni, c];
    onChange({ esperienze, formazione, certificazioni: updated });
    setShowCertForm(false);
    setEditingCert(null);
  };

  const handleRemoveCertificazione = (id: string) => {
    onChange({ esperienze, formazione, certificazioni: certificazioni.filter(c => c.id !== id) });
  };

  const attuali = esperienze.filter(e => e.attuale).sort((a, b) => b.dataInizio.localeCompare(a.dataInizio));
  const passate = esperienze.filter(e => !e.attuale).sort((a, b) => (b.dataFine || b.dataInizio).localeCompare(a.dataFine || a.dataInizio));
  const formazioneOrdinata = [...formazione].sort((a, b) => b.annoConseguimento.localeCompare(a.annoConseguimento));
  const certOrdinati = [...certificazioni].sort((a, b) => b.anno.localeCompare(a.anno));

  return (
    <div className="space-y-6">
      {/* Esperienze Professionali */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Esperienze Professionali</h2>
            <p className="text-sm text-gray-600 mt-1">Aggiungi le tue esperienze lavorative attuali e passate</p>
          </div>
          {!showEspForm && (
            <button
              type="button"
              onClick={() => { setEditingEsp(null); setShowEspForm(true); }}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm font-medium whitespace-nowrap"
            >
              + Aggiungi
            </button>
          )}
        </div>

        {/* Current */}
        {attuali.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-2">Attuali</h3>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {attuali.map(e => (
                <EsperienzaCard
                  key={e.id}
                  esperienza={e}
                  onEdit={() => { setEditingEsp(e); setShowEspForm(true); }}
                  onRemove={() => handleRemoveEsperienza(e.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Past */}
        {passate.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Passate</h3>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {passate.map(e => (
                <EsperienzaCard
                  key={e.id}
                  esperienza={e}
                  onEdit={() => { setEditingEsp(e); setShowEspForm(true); }}
                  onRemove={() => handleRemoveEsperienza(e.id)}
                />
              ))}
            </div>
          </div>
        )}

        {esperienze.length === 0 && !showEspForm && (
          <div className="text-center py-6 text-gray-500">
            <div className="text-3xl mb-2">💼</div>
            <p className="text-sm">Nessuna esperienza professionale aggiunta</p>
          </div>
        )}

        {showEspForm && (
          <EsperienzaForm
            esperienza={editingEsp || undefined}
            onSave={handleSaveEsperienza}
            onCancel={() => { setShowEspForm(false); setEditingEsp(null); }}
          />
        )}
      </div>

      {/* Formazione */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Formazione</h2>
            <p className="text-sm text-gray-600 mt-1">I tuoi titoli di studio e percorsi formativi</p>
          </div>
          {!showFormForm && (
            <button
              type="button"
              onClick={() => { setEditingForm(null); setShowFormForm(true); }}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm font-medium whitespace-nowrap"
            >
              + Aggiungi
            </button>
          )}
        </div>

        {formazioneOrdinata.length > 0 && (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg mb-4">
            {formazioneOrdinata.map(f => (
              <FormazioneCard
                key={f.id}
                formazione={f}
                onEdit={() => { setEditingForm(f); setShowFormForm(true); }}
                onRemove={() => handleRemoveFormazione(f.id)}
              />
            ))}
          </div>
        )}

        {formazione.length === 0 && !showFormForm && (
          <div className="text-center py-6 text-gray-500">
            <div className="text-3xl mb-2">🎓</div>
            <p className="text-sm">Nessun titolo di formazione aggiunto</p>
          </div>
        )}

        {showFormForm && (
          <FormazioneForm
            formazione={editingForm || undefined}
            onSave={handleSaveFormazione}
            onCancel={() => { setShowFormForm(false); setEditingForm(null); }}
          />
        )}
      </div>

      {/* Certificazioni */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Attestati e Certificazioni</h2>
            <p className="text-sm text-gray-600 mt-1">Corsi completati, attestati e certificazioni professionali</p>
          </div>
          {!showCertForm && (
            <button
              type="button"
              onClick={() => { setEditingCert(null); setShowCertForm(true); }}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition text-sm font-medium whitespace-nowrap"
            >
              + Aggiungi
            </button>
          )}
        </div>

        {certOrdinati.length > 0 && (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg mb-4">
            {certOrdinati.map(c => (
              <CertificazioneCard
                key={c.id}
                certificazione={c}
                onEdit={() => { setEditingCert(c); setShowCertForm(true); }}
                onRemove={() => handleRemoveCertificazione(c.id)}
              />
            ))}
          </div>
        )}

        {certificazioni.length === 0 && !showCertForm && (
          <div className="text-center py-6 text-gray-500">
            <div className="text-3xl mb-2">📜</div>
            <p className="text-sm">Nessun attestato o certificazione aggiunto</p>
          </div>
        )}

        {showCertForm && (
          <CertificazioneForm
            certificazione={editingCert || undefined}
            onSave={handleSaveCertificazione}
            onCancel={() => { setShowCertForm(false); setEditingCert(null); }}
          />
        )}
      </div>
    </div>
  );
}

// Compact form for registration (just current experience, required)
export function EsperienzaAttualeRegistrazione({ esperienza, onChange }: {
  esperienza: EsperienzaProfessionale | null;
  onChange: (e: EsperienzaProfessionale | null) => void;
}) {
  const [form, setForm] = useState<EsperienzaProfessionale>(esperienza || {
    id: generateId(),
    titolo: '',
    organizzazione: '',
    indirizzo: '',
    descrizione: '',
    dataInizio: '',
    attuale: true,
  });

  const updateField = (field: string, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    // Auto-propagate if has required fields
    if (updated.titolo.trim() && updated.organizzazione.trim() && updated.dataInizio) {
      onChange(updated);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo / Posizione attuale *</label>
        <input
          type="text"
          value={form.titolo}
          onChange={(e) => updateField('titolo', e.target.value)}
          placeholder="es. Tirocinante in psicoterapia"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Organizzazione / Ente *</label>
        <input
          type="text"
          value={form.organizzazione}
          onChange={(e) => updateField('organizzazione', e.target.value)}
          placeholder="es. Centro Clinico San Marco"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
        <input
          type="text"
          value={form.indirizzo || ''}
          onChange={(e) => updateField('indirizzo', e.target.value)}
          placeholder="es. Via Trieste 19, Villanova PE"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio *</label>
        <input
          type="month"
          value={form.dataInizio}
          onChange={(e) => updateField('dataInizio', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione attività</label>
        <textarea
          value={form.descrizione || ''}
          onChange={(e) => updateField('descrizione', e.target.value)}
          placeholder="Descrivi brevemente le tue attività..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
}
