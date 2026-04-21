import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Header from '@/components/Header';
import { Availability, WeeklySchedule, TimeRange, TipoVisita, LocationVisita, TipoLocazione } from '@/types/equippe';

const DAYS: { key: keyof WeeklySchedule; label: string }[] = [
  { key: 'lun', label: 'Lunedì' },
  { key: 'mar', label: 'Martedì' },
  { key: 'mer', label: 'Mercoledì' },
  { key: 'gio', label: 'Giovedì' },
  { key: 'ven', label: 'Venerdì' },
  { key: 'sab', label: 'Sabato' },
  { key: 'dom', label: 'Domenica' },
];

const DEFAULT_SCHEDULE: WeeklySchedule = {
  lun: [], mar: [], mer: [], gio: [], ven: [], sab: [], dom: [],
};

function generateTimeOptions(): string[] {
  const opts: string[] = [];
  for (let h = 7; h <= 21; h++) {
    for (const m of [0, 30]) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
}

const TIME_OPTIONS = generateTimeOptions();

const DAY_KEYS: (keyof WeeklySchedule)[] = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function WeeklyPreview({ schedule, slotDuration, buffer }: {
  schedule: WeeklySchedule;
  slotDuration: number;
  buffer: number;
}) {
  function getDaySlots(key: keyof WeeklySchedule): string[] {
    const slots: string[] = [];
    for (const range of schedule[key]) {
      let cur = range.start;
      while (addMinutes(cur, slotDuration) <= range.end) {
        slots.push(cur);
        cur = addMinutes(cur, slotDuration + buffer);
      }
    }
    return slots;
  }

  const allSlots = DAY_KEYS.map(k => getDaySlots(k));
  const hasSomething = allSlots.some(s => s.length > 0);

  if (!hasSomething) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Anteprima slot settimanali</h2>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 min-w-[420px]">
          {DAY_KEYS.map((key, i) => {
            const slots = allSlots[i];
            return (
              <div key={key} className="text-center">
                <div className={`text-xs font-bold mb-2 pb-1 border-b ${
                  slots.length > 0 ? 'text-blue-700 border-blue-200' : 'text-gray-300 border-gray-100'
                }`}>
                  {DAY_SHORT[i]}
                </div>
                {slots.length === 0 ? (
                  <div className="text-gray-200 text-xs mt-3">—</div>
                ) : (
                  <div className="space-y-1">
                    {slots.map(slot => (
                      <div key={slot}
                        className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded px-1 py-0.5 font-medium text-center">
                        {slot}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        {allSlots.flat().length} slot totali · durata {slotDuration} min{buffer > 0 ? ` + ${buffer} min pausa` : ''}
      </p>
    </div>
  );
}

export default function AvailabilityPage() {
  const { user } = useAuth();
  const { showToast } = useModal();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Availability state
  const [isPublic, setIsPublic] = useState(false);
  const [slotDuration, setSlotDuration] = useState(60);
  const [buffer, setBuffer] = useState(0);
  const [bookingWindow, setBookingWindow] = useState(30);
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE);
  const [tipiVisita, setTipiVisita] = useState<TipoVisita[]>([]);
  const [exceptDates, setExceptDates] = useState<string[]>([]);
  const [newExceptDate, setNewExceptDate] = useState('');

  // Location config
  const [locTipo, setLocTipo] = useState<TipoLocazione>('presenziale');
  const [locIndirizzo, setLocIndirizzo] = useState('');
  const [locLink, setLocLink] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadAvailability();
  }, [user]);

  const loadAvailability = async () => {
    try {
      const docRef = doc(db, 'availability', user!.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as Availability;
        setIsPublic(data.isPublic ?? false);
        setSlotDuration(data.slotDurationMinutes ?? 60);
        setBuffer(data.bufferMinutes ?? 0);
        setBookingWindow(data.bookingWindowDays ?? 30);
        setSchedule(data.schedule ?? DEFAULT_SCHEDULE);
        setTipiVisita(data.tipiVisita ?? []);
        setExceptDates(data.exceptDates ?? []);
        if (data.locationVisita) {
          setLocTipo(data.locationVisita.tipo ?? 'presenziale');
          setLocIndirizzo(data.locationVisita.indirizzo ?? '');
          setLocLink(data.locationVisita.linkOnline ?? '');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (tipiVisita.length === 0) {
      showToast('Aggiungi almeno un tipo di visita prima di salvare', 'warning');
      return;
    }
    setSaving(true);
    try {
      const locationVisita: LocationVisita = {
        tipo: locTipo,
        ...(locTipo !== 'online' && locIndirizzo ? { indirizzo: locIndirizzo } : {}),
        ...(locTipo !== 'presenziale' && locLink ? { linkOnline: locLink } : {}),
      };
      const data: Availability = {
        uid: user.uid,
        isPublic,
        slotDurationMinutes: slotDuration,
        bufferMinutes: buffer,
        bookingWindowDays: bookingWindow,
        schedule,
        tipiVisita,
        exceptDates,
        locationVisita,
        updatedAt: Timestamp.now(),
      };
      await setDoc(doc(db, 'availability', user.uid), data);
      showToast('Disponibilità salvata!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Errore durante il salvataggio', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Schedule helpers ──────────────────────────────────────────────────────
  const addRange = (day: keyof WeeklySchedule) => {
    setSchedule(prev => ({
      ...prev,
      [day]: [...prev[day], { start: '09:00', end: '13:00' }],
    }));
  };

  const removeRange = (day: keyof WeeklySchedule, idx: number) => {
    setSchedule(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== idx),
    }));
  };

  const updateRange = (day: keyof WeeklySchedule, idx: number, field: keyof TimeRange, value: string) => {
    setSchedule(prev => {
      const ranges = [...prev[day]];
      ranges[idx] = { ...ranges[idx], [field]: value };
      return { ...prev, [day]: ranges };
    });
  };

  // ── Tipi visita helpers ───────────────────────────────────────────────────
  const addTipoVisita = () => {
    setTipiVisita(prev => [...prev, { id: crypto.randomUUID(), nome: '', durata: slotDuration, prezzo: undefined }]);
  };

  const updateTipoVisita = (idx: number, field: keyof TipoVisita, value: any) => {
    setTipiVisita(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const removeTipoVisita = (idx: number) => {
    setTipiVisita(prev => prev.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Caricamento...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <div className="mb-6">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Indietro
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Disponibilità e Agenda</h1>
          <p className="text-gray-600 mt-1">Configura gli orari in cui sei disponibile per le prenotazioni</p>
        </div>

        <div className="space-y-6">

          {/* Visibilità pubblica */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Profilo pubblico</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Attiva per permettere ai pazienti di trovare il tuo profilo e prenotare una visita
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="sr-only" />
                <div className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${isPublic ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${isPublic ? 'translate-x-6' : ''}`} />
                </div>
              </label>
            </div>
            {isPublic && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                ✓ Il tuo profilo è visibile ai pazienti su{' '}
                <a href={`/p/${user?.uid}`} className="font-medium underline" target="_blank" rel="noopener noreferrer">
                  tuaequipe.it/p/{user?.uid}
                </a>
              </div>
            )}
          </div>

          {/* Impostazioni slot */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Impostazioni slot</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Durata slot</label>
                <select value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value={30}>30 minuti</option>
                  <option value={45}>45 minuti</option>
                  <option value={60}>1 ora</option>
                  <option value={90}>1h 30min</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pausa tra slot</label>
                <select value={buffer} onChange={e => setBuffer(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value={0}>Nessuna pausa</option>
                  <option value={10}>10 minuti</option>
                  <option value={15}>15 minuti</option>
                  <option value={30}>30 minuti</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Finestra prenotazione</label>
                <select value={bookingWindow} onChange={e => setBookingWindow(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value={14}>2 settimane</option>
                  <option value={30}>1 mese</option>
                  <option value={60}>2 mesi</option>
                  <option value={90}>3 mesi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Luogo della visita */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Luogo della visita</h2>
            <p className="text-sm text-gray-500 mb-4">I pazienti vedranno questa informazione prima di prenotare</p>
            <div className="flex gap-3 flex-wrap mb-4">
              {(['presenziale', 'online', 'entrambi'] as TipoLocazione[]).map(opt => (
                <button key={opt} onClick={() => setLocTipo(opt)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${locTipo === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                  {opt === 'presenziale' ? '🏥 In presenza' : opt === 'online' ? '💻 Online' : '🔀 Entrambe le modalità'}
                </button>
              ))}
            </div>
            {(locTipo === 'presenziale' || locTipo === 'entrambi') && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo dello studio</label>
                <input value={locIndirizzo} onChange={e => setLocIndirizzo(e.target.value)}
                  placeholder="es. Via Roma 10, Milano (MI)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            )}
            {(locTipo === 'online' || locTipo === 'entrambi') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link per le visite online</label>
                <input value={locLink} onChange={e => setLocLink(e.target.value)}
                  placeholder="es. https://meet.google.com/abc-defg-hij"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <p className="text-xs text-gray-400 mt-1">Link Google Meet, Zoom, Teams o simili. Il paziente lo riceverà via email.</p>
              </div>
            )}
          </div>

          {/* Tipi di visita */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Tipi di visita</h2>
              <button onClick={addTipoVisita}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                + Aggiungi
              </button>
            </div>
            {tipiVisita.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-500">
                <p className="text-sm">Aggiungi almeno un tipo di visita (es. "Prima visita", "Controllo")</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tipiVisita.map((tipo, idx) => (
                  <div key={tipo.id} className="border border-gray-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                      <input value={tipo.nome} onChange={e => updateTipoVisita(idx, 'nome', e.target.value)}
                        placeholder="es. Prima visita" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Durata (min)</label>
                      <input type="number" min={15} step={15} value={tipo.durata}
                        onChange={e => updateTipoVisita(idx, 'durata', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Prezzo (€) opzionale</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} placeholder="—" value={tipo.prezzo ?? ''}
                          onChange={e => updateTipoVisita(idx, 'prezzo', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                        <button onClick={() => removeTipoVisita(idx)} className="text-red-500 hover:text-red-700 flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orari settimanali */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Orari settimanali</h2>
            <div className="space-y-4">
              {DAYS.map(({ key, label }) => (
                <div key={key} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-24 text-sm font-medium text-gray-800">{label}</span>
                      {schedule[key].length === 0 && (
                        <span className="text-xs text-gray-400 italic">Non disponibile</span>
                      )}
                    </div>
                    <button onClick={() => addRange(key)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                      + Fascia oraria
                    </button>
                  </div>
                  {schedule[key].length > 0 && (
                    <div className="space-y-2 ml-0 sm:ml-27">
                      {schedule[key].map((range, idx) => (
                        <div key={idx} className="flex items-center gap-3 flex-wrap">
                          <select value={range.start} onChange={e => updateRange(key, idx, 'start', e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <span className="text-gray-500 text-sm">→</span>
                          <select value={range.end} onChange={e => updateRange(key, idx, 'end', e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            {TIME_OPTIONS.filter(t => t > range.start).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <button onClick={() => removeRange(key, idx)} className="text-red-400 hover:text-red-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Date eccezione */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Giorni di chiusura / eccezioni</h2>
            <p className="text-sm text-gray-600 mb-4">Blocca date specifiche (ferie, festività, ecc.)</p>
            <div className="flex gap-3 mb-4">
              <input type="date" value={newExceptDate} onChange={e => setNewExceptDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <button onClick={() => {
                if (newExceptDate && !exceptDates.includes(newExceptDate)) {
                  setExceptDates(prev => [...prev, newExceptDate].sort());
                  setNewExceptDate('');
                }
              }} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 transition">
                + Blocca
              </button>
            </div>
            {exceptDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {exceptDates.map(date => (
                  <span key={date} className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-sm">
                    {new Date(date + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    <button onClick={() => setExceptDates(prev => prev.filter(d => d !== date))} className="text-red-400 hover:text-red-700">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Anteprima */}
          <WeeklyPreview schedule={schedule} slotDuration={slotDuration} buffer={buffer} />

          {/* Save */}
          <div className="flex gap-3 justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition">
              {saving ? 'Salvataggio...' : 'Salva disponibilità'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
