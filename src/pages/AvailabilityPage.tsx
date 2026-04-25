import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase';
import Header from '@/components/Header';
import { Availability, WeeklySchedule, TimeRange, TipoVisita, SedeDisponibilita, Studio } from '@/types/equippe';

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

const DEFAULT_ONLINE_SCHEDULE: WeeklySchedule = {
  lun: [{ start: '09:00', end: '17:00' }],
  mar: [{ start: '09:00', end: '17:00' }],
  mer: [{ start: '09:00', end: '17:00' }],
  gio: [{ start: '09:00', end: '17:00' }],
  ven: [{ start: '09:00', end: '17:00' }],
  sab: [],
  dom: [],
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


export default function AvailabilityPage() {
  const { user } = useAuth();
  const { showToast } = useModal();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Availability state
  const [isPublic, setIsPublic] = useState(false);
  const [buffer, setBuffer] = useState(0);
  const [bookingWindow, setBookingWindow] = useState(30);
  const [minAdvanceHours, setMinAdvanceHours] = useState(24);
  const [sedi, setSedi] = useState<SedeDisponibilita[]>([]);
  const [profileStudi, setProfileStudi] = useState<Studio[]>([]);
  const [tipiVisita, setTipiVisita] = useState<TipoVisita[]>([]);
  const [exceptDates, setExceptDates] = useState<string[]>([]);
  const [newExceptDate, setNewExceptDate] = useState('');

  // iCal sync
  const [icalToken, setIcalToken] = useState<string | null>(null);
  const [icalCopied, setIcalCopied] = useState(false);
  const [icalGenerating, setIcalGenerating] = useState(false);
  const [showIcalInstructions, setShowIcalInstructions] = useState(false);

  // Google Calendar integration
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalDisconnecting, setGcalDisconnecting] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadAvailability();
  }, [user]);

  // Leggi ?gcal=success/error dalla URL dopo il callback OAuth
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gcal = params.get('gcal');
    if (gcal === 'success') {
      setGcalConnected(true);
      showToast('Google Calendar connesso!', 'success');
      navigate('/disponibilita', { replace: true });
    } else if (gcal === 'error') {
      showToast('Errore connessione Google Calendar. Riprova.', 'error');
      navigate('/disponibilita', { replace: true });
    }
  }, [location.search]);

  const loadAvailability = async () => {
    try {
      const [snap, profileSnap] = await Promise.all([
        getDoc(doc(db, 'availability', user!.uid)),
        getDoc(doc(db, 'users', user!.uid)),
      ]);
      const profileStudi: Studio[] = profileSnap.data()?.profile?.studi ?? [];
      setProfileStudi(profileStudi);

      const profileLavoraOnline: boolean = profileSnap.data()?.profile?.lavoraOnline ?? profileStudi.some(s => s.remoto) ?? false;

      // Helper: build initial sedi from profile.studi
      const sediFromProfile = (fallbackSchedule: WeeklySchedule): SedeDisponibilita[] => {
        const result: SedeDisponibilita[] = [];
        const studiFisici = profileStudi.filter(s => s.indirizzo);
        const hasRemoto = profileLavoraOnline;
        studiFisici.forEach((studio, idx) => {
          const fullAddress = [studio.indirizzo, studio.città, studio.provincia && `(${studio.provincia})`]
            .filter(Boolean).join(', ');
          result.push({
            id: crypto.randomUUID(),
            nome: studio.indirizzo.split(',')[0].trim() || `Studio ${idx + 1}`,
            tipo: 'presenziale',
            indirizzo: fullAddress || studio.indirizzo,
            schedule: { ...fallbackSchedule },
          });
        });
        if (hasRemoto) {
          result.push({ id: crypto.randomUUID(), nome: 'Online', tipo: 'online', schedule: { ...DEFAULT_ONLINE_SCHEDULE } });
        }
        return result.length > 0 ? result : [{ id: crypto.randomUUID(), nome: 'Sede principale', tipo: 'presenziale', schedule: fallbackSchedule }];
      };

      if (snap.exists()) {
        const data = snap.data() as Availability;
        setIsPublic(data.isPublic ?? false);
        setBuffer(data.bufferMinutes ?? 0);
        setBookingWindow(data.bookingWindowDays ?? 30);
        setMinAdvanceHours(data.minAdvanceHours ?? 24);
        setTipiVisita(data.tipiVisita ?? []);
        setExceptDates(data.exceptDates ?? []);
        setIcalToken((data as any).icalToken ?? null);

        // ── Carica sedi (nuovo modello) o migra dal vecchio ──────────────
        if (data.sedi && data.sedi.length > 0) {
          setSedi(data.sedi);
        } else {
          // Migra dal vecchio modello: preferisce sempre profile.studi se presenti
          const initSched = data.schedule ?? DEFAULT_SCHEDULE;
          const loc = data.locationVisita;
          if (profileStudi.length > 0) {
            // Crea una sede per ogni studio del profilo, con il vecchio schedule come base
            // Se c'era anche modalità online, aggiunge la sede online
            const sedi = sediFromProfile(initSched);
            if ((loc?.tipo === 'online' || loc?.tipo === 'entrambi') && !profileLavoraOnline) {
              sedi.push({
                id: crypto.randomUUID(),
                nome: 'Online',
                tipo: 'online',
                linkOnline: loc?.linkOnline ?? '',
                schedule: { ...DEFAULT_ONLINE_SCHEDULE },
              });
            }
            setSedi(sedi);
          } else {
            // Nessuno studio nel profilo: usa locationVisita salvata
            const initSedi: SedeDisponibilita[] = [];
            if (!loc || loc.tipo === 'presenziale' || loc.tipo === 'entrambi') {
              initSedi.push({
                id: crypto.randomUUID(),
                nome: loc?.indirizzo ? loc.indirizzo.split(',')[0].trim() : 'Sede principale',
                tipo: 'presenziale',
                indirizzo: loc?.indirizzo ?? '',
                schedule: initSched,
              });
            }
            if (loc?.tipo === 'online' || loc?.tipo === 'entrambi') {
              initSedi.push({
                id: crypto.randomUUID(),
                nome: 'Online',
                tipo: 'online',
                linkOnline: loc?.linkOnline ?? '',
                schedule: loc?.tipo === 'entrambi' ? { ...DEFAULT_ONLINE_SCHEDULE } : initSched,
              });
            }
            if (initSedi.length === 0) {
              initSedi.push({ id: crypto.randomUUID(), nome: 'Sede principale', tipo: 'presenziale', schedule: initSched });
            }
            setSedi(initSedi);
          }
        }
      } else {
        // Nuovo profilo: costruisci sedi dagli studi del profilo
        setSedi(sediFromProfile(DEFAULT_SCHEDULE));
      }
      // Controlla se Google Calendar è connesso
      const gcalDoc = await getDoc(doc(db, 'users', user!.uid, 'integrations', 'google'));
      setGcalConnected(gcalDoc.exists());
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
    if (sedi.length === 0) {
      showToast('Aggiungi almeno una sede prima di salvare', 'warning');
      return;
    }
    setSaving(true);
    try {
      // Deriva schedule e locationVisita dal nuovo modello (retrocompatibilità)
      const firstPresenziale = sedi.find(s => s.tipo === 'presenziale');
      const firstOnline = sedi.find(s => s.tipo === 'online');
      const derivedSchedule = firstPresenziale?.schedule ?? sedi[0]?.schedule ?? DEFAULT_SCHEDULE;
      const hasBoth = !!firstPresenziale && !!firstOnline;
      const locationVisita = hasBoth
        ? { tipo: 'entrambi' as const, indirizzo: firstPresenziale?.indirizzo ?? '', linkOnline: firstOnline?.linkOnline ?? '' }
        : firstOnline
        ? { tipo: 'online' as const, linkOnline: firstOnline.linkOnline ?? '' }
        : { tipo: 'presenziale' as const, indirizzo: firstPresenziale?.indirizzo ?? '' };

      // Sanitize sedi: rimuove campi undefined non accettati da Firestore
      const sediSanitized = sedi.map(s => ({
        id: s.id,
        nome: s.nome,
        tipo: s.tipo,
        schedule: s.schedule,
        ...(s.indirizzo !== undefined && { indirizzo: s.indirizzo }),
        ...(s.linkOnline !== undefined && { linkOnline: s.linkOnline }),
      }));

      const data: Availability = {
        uid: user.uid,
        isPublic,
        bufferMinutes: buffer,
        bookingWindowDays: bookingWindow,
        minAdvanceHours,
        schedule: derivedSchedule,
        sedi: sediSanitized,
        locationVisita,
        tipiVisita,
        exceptDates,
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

  // ── Google Calendar helpers ───────────────────────────────────────────────
  const connectGoogleCalendar = async () => {
    setGcalConnecting(true);
    try {
      const fns = getFunctions(undefined, 'europe-west1');
      const getAuthUrl = httpsCallable<unknown, { url: string }>(fns, 'googleCalendarAuthUrl');
      const { data } = await getAuthUrl({});
      // Apri il popup OAuth in una nuova scheda
      window.open(data.url, '_blank', 'width=500,height=650,noopener');
    } catch {
      showToast('Errore avvio connessione Google Calendar', 'error');
    } finally {
      setGcalConnecting(false);
    }
  };

  const disconnectGcal = async () => {
    setGcalDisconnecting(true);
    try {
      const fns = getFunctions(undefined, 'europe-west1');
      const disconnect = httpsCallable(fns, 'disconnectGoogleCalendar');
      await disconnect({});
      setGcalConnected(false);
      showToast('Google Calendar disconnesso', 'success');
    } catch {
      showToast('Errore durante la disconnessione', 'error');
    } finally {
      setGcalDisconnecting(false);
    }
  };

  // ── iCal helpers ─────────────────────────────────────────────────────────
  const icalUrl = icalToken
    ? `https://europe-west1-equippe-1e1fa.cloudfunctions.net/appointmentsIcal?uid=${user?.uid}&token=${icalToken}`
    : null;

  const generateIcalToken = async () => {
    if (!user) return;
    setIcalGenerating(true);
    try {
      const newToken = crypto.randomUUID();
      await updateDoc(doc(db, 'availability', user.uid), { icalToken: newToken });
      setIcalToken(newToken);
    } catch {
      // se il documento non esiste ancora, usa setDoc con merge
      const newToken = crypto.randomUUID();
      await setDoc(doc(db, 'availability', user!.uid), { icalToken: newToken }, { merge: true });
      setIcalToken(newToken);
    } finally {
      setIcalGenerating(false);
    }
  };

  const copyIcalUrl = async () => {
    if (!icalUrl) return;
    await navigator.clipboard.writeText(icalUrl);
    setIcalCopied(true);
    setTimeout(() => setIcalCopied(false), 2000);
  };

  // ── Sede helpers ─────────────────────────────────────────────────────────
  const addSede = (tipo: 'presenziale' | 'online') => {
    setSedi(prev => [...prev, {
      id: crypto.randomUUID(),
      nome: tipo === 'online' ? 'Online' : 'Nuova sede',
      tipo,
      schedule: DEFAULT_SCHEDULE,
    }]);
  };

  const removeSede = (id: string) => {
    setSedi(prev => prev.filter(s => s.id !== id));
  };

  const updateSedeField = (id: string, field: keyof SedeDisponibilita, value: string) => {
    setSedi(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const toggleSedeDay = (sedeId: string, day: keyof WeeklySchedule) => {
    setSedi(prev => prev.map(s => {
      if (s.id !== sedeId) return s;
      const enabled = s.schedule[day].length > 0;
      return { ...s, schedule: { ...s.schedule, [day]: enabled ? [] : [{ start: '09:00', end: '18:00' }] } };
    }));
  };

  const addSedeRange = (sedeId: string, day: keyof WeeklySchedule) => {
    setSedi(prev => prev.map(s => {
      if (s.id !== sedeId) return s;
      return { ...s, schedule: { ...s.schedule, [day]: [...s.schedule[day], { start: '09:00', end: '13:00' }] } };
    }));
  };

  const removeSedeRange = (sedeId: string, day: keyof WeeklySchedule, idx: number) => {
    setSedi(prev => prev.map(s => {
      if (s.id !== sedeId) return s;
      return { ...s, schedule: { ...s.schedule, [day]: s.schedule[day].filter((_, i) => i !== idx) } };
    }));
  };

  const updateSedeRange = (sedeId: string, day: keyof WeeklySchedule, idx: number, field: keyof TimeRange, value: string) => {
    setSedi(prev => prev.map(s => {
      if (s.id !== sedeId) return s;
      const ranges = [...s.schedule[day]];
      ranges[idx] = { ...ranges[idx], [field]: value };
      return { ...s, schedule: { ...s.schedule, [day]: ranges } };
    }));
  };

  // ── Tipi visita helpers ───────────────────────────────────────────────────
  const addTipoVisita = () => {
    setTipiVisita(prev => [...prev, { id: crypto.randomUUID(), nome: '', durata: 60, prezzo: undefined }]);
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-32">

        {/* Page header */}
        <div className="mb-8">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Indietro
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Disponibilità e Agenda</h1>
          <p className="text-gray-500 mt-1 text-sm">Configura quando sei disponibile e come i pazienti possono prenotare</p>
        </div>

        <div className="space-y-5">

          {/* ── 1. Sedi di lavoro ── */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Sedi di lavoro</h2>
              <p className="text-sm text-gray-500 mt-0.5">Configura dove ricevi i pazienti e i relativi orari. Ogni sede può avere giorni e fasce orarie diversi.</p>
            </div>

            {sedi.map(sede => (
              <div key={sede.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card header */}
                <div className={`px-5 py-3.5 flex items-center gap-3 ${sede.tipo === 'online' ? 'bg-purple-50 border-b border-purple-100' : 'bg-blue-50 border-b border-blue-100'}`}>
                  <span className="font-semibold text-gray-900 min-w-0 flex-1 text-sm truncate">{sede.nome}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${sede.tipo === 'online' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {sede.tipo === 'online' ? 'Online' : 'In presenza'}
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  {/* Location detail */}
                  {sede.tipo === 'presenziale' && sede.indirizzo && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">{sede.indirizzo}</span>
                    </div>
                  )}
                  {sede.tipo === 'online' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Link per le visite online</label>
                      <input value={sede.linkOnline ?? ''} onChange={e => updateSedeField(sede.id, 'linkOnline', e.target.value)}
                        placeholder="es. https://meet.google.com/abc-defg-hij"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      <p className="text-xs text-gray-400 mt-1">Il paziente lo riceve via email dopo la prenotazione</p>
                    </div>
                  )}

                  {/* Schedule */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Giorni e orari per questa sede</p>
                    <div className="space-y-2">
                      {DAYS.map(({ key, label }) => {
                        const enabled = sede.schedule[key].length > 0;
                        return (
                          <div key={key} className={`rounded-xl border transition-colors ${enabled ? 'border-blue-100 bg-blue-50/40' : 'border-gray-100 bg-gray-50/50'}`}>
                            <div className="flex items-center justify-between px-3 py-2.5">
                              <span className={`text-sm font-medium ${enabled ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
                              <button onClick={() => toggleSedeDay(sede.id, key)}
                                className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 ${enabled ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${enabled ? 'translate-x-4' : ''}`} />
                              </button>
                            </div>
                            {enabled ? (
                              <div className="flex flex-wrap gap-2 items-center px-3 pb-2.5">
                                {sede.schedule[key].map((range, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2 py-1 shadow-sm">
                                    <select value={range.start} onChange={e => updateSedeRange(sede.id, key, idx, 'start', e.target.value)}
                                      className="text-sm text-gray-700 border-none bg-transparent focus:outline-none cursor-pointer">
                                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <span className="text-gray-300 text-xs">–</span>
                                    <select value={range.end} onChange={e => updateSedeRange(sede.id, key, idx, 'end', e.target.value)}
                                      className="text-sm text-gray-700 border-none bg-transparent focus:outline-none cursor-pointer">
                                      {TIME_OPTIONS.filter(t => t > range.start).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    {sede.schedule[key].length > 1 && (
                                      <button onClick={() => removeSedeRange(sede.id, key, idx)} className="text-gray-300 hover:text-red-400 ml-0.5 flex-shrink-0">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button onClick={() => addSedeRange(sede.id, key)}
                                  className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border border-dashed border-blue-300 rounded-lg transition whitespace-nowrap">
                                  + fascia
                                </button>
                              </div>
                            ) : (
                              <p className="px-3 pb-2.5 text-sm text-gray-400 italic">Giorno libero</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Aggiungi sede — rimosso: le sedi derivano dal profilo */}
          </div>

          {/* ── 3. Tipi di visita ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Tipi di visita</h2>
                <p className="text-sm text-gray-500 mt-0.5">Le prestazioni che offri (il paziente le vedrà prima di prenotare)</p>
              </div>
              <button onClick={addTipoVisita}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Aggiungi
              </button>
            </div>
            {tipiVisita.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-medium">Nessun tipo di visita configurato</p>
                <p className="text-xs mt-1">es. "Prima visita", "Controllo", "Consulto"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tipiVisita.map((tipo, idx) => (
                  <div key={tipo.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl bg-gray-50/60 flex-wrap">
                    <input value={tipo.nome} onChange={e => updateTipoVisita(idx, 'nome', e.target.value)}
                      placeholder="Nome visita (es. Prima visita)"
                      className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <div className="flex items-center gap-1.5">
                      <input type="number" min={15} step={15} value={tipo.durata}
                        onChange={e => updateTipoVisita(idx, 'durata', Number(e.target.value))}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 text-center" />
                      <span className="text-xs text-gray-500 whitespace-nowrap">min</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min={0} placeholder="—" value={tipo.prezzo ?? ''}
                        onChange={e => updateTipoVisita(idx, 'prezzo', e.target.value ? Number(e.target.value) : undefined)}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 text-center" />
                      <span className="text-xs text-gray-500">€</span>
                    </div>
                    <button onClick={() => removeTipoVisita(idx)} className="text-gray-300 hover:text-red-400 transition p-1 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 4. Impostazioni prenotazione ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Impostazioni prenotazione</h2>
            <p className="text-sm text-gray-500 mb-5">Definisci come i pazienti possono prenotare</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pausa tra appuntamenti</label>
                <select value={buffer} onChange={e => setBuffer(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                  <option value={0}>Nessuna pausa</option>
                  <option value={10}>10 minuti</option>
                  <option value={15}>15 minuti</option>
                  <option value={30}>30 minuti</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Tempo libero tra un appuntamento e il successivo</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quanto in anticipo si può prenotare?</label>
                <select value={bookingWindow} onChange={e => setBookingWindow(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                  <option value={14}>Fino a 2 settimane</option>
                  <option value={30}>Fino a 1 mese</option>
                  <option value={60}>Fino a 2 mesi</option>
                  <option value={90}>Fino a 3 mesi</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Il paziente non può prenotare oltre questa data</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preavviso minimo richiesto</label>
                <select value={minAdvanceHours} onChange={e => setMinAdvanceHours(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                  <option value={0}>Nessun preavviso</option>
                  <option value={2}>Almeno 2 ore prima</option>
                  <option value={4}>Almeno 4 ore prima</option>
                  <option value={12}>Almeno 12 ore prima</option>
                  <option value={24}>Almeno 1 giorno prima</option>
                  <option value={48}>Almeno 2 giorni prima</option>
                  <option value={72}>Almeno 3 giorni prima</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Il paziente non può prenotare con meno preavviso</p>
              </div>
            </div>
          </div>

          {/* ── 5. Giorni di chiusura ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Giorni di chiusura</h2>
            <p className="text-sm text-gray-500 mb-4">Blocca date specifiche in cui non sei disponibile (ferie, festività…)</p>
            <div className="flex gap-3 mb-4 flex-wrap">
              <input type="date" value={newExceptDate} onChange={e => setNewExceptDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <button onClick={() => {
                if (newExceptDate && !exceptDates.includes(newExceptDate)) {
                  setExceptDates(prev => [...prev, newExceptDate].sort());
                  setNewExceptDate('');
                }
              }} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900 transition font-medium">
                Blocca giorno
              </button>
            </div>
            {exceptDates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {exceptDates.map(date => (
                  <span key={date} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm font-medium">
                    {new Date(date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}
                    <button onClick={() => setExceptDates(prev => prev.filter(d => d !== date))} className="text-red-300 hover:text-red-600 ml-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Nessun giorno bloccato</p>
            )}
          </div>

          {/* ── 6. Integrazioni calendario ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Integrazioni calendario</h2>
              <p className="text-sm text-gray-500 mt-0.5">Tieni i tuoi appuntamenti sincronizzati con il calendario che usi ogni giorno</p>
            </div>

            {/* Google Calendar */}
            <div className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Google Calendar</p>
                  <p className="text-xs text-gray-500">Blocca gli slot occupati da altri eventi e crea automaticamente un evento per ogni nuova prenotazione</p>
                </div>
              </div>
              {gcalConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-100 rounded-lg">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-green-800 font-medium">Connesso e attivo</span>
                  </div>
                  <button onClick={disconnectGcal} disabled={gcalDisconnecting}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition disabled:opacity-60">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    {gcalDisconnecting ? 'Disconnessione...' : 'Disconnetti'}
                  </button>
                </div>
              ) : (
                <button onClick={connectGoogleCalendar} disabled={gcalConnecting}
                  className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition shadow-sm">
                  {gcalConnecting ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Apertura finestra Google...</>
                  ) : 'Connetti con Google'}
                </button>
              )}
            </div>

            {/* iCal */}
            <div className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Apple Calendar / Outlook</p>
                  <p className="text-xs text-gray-500">Importa i tuoi appuntamenti in qualsiasi app calendario tramite link iCal</p>
                </div>
              </div>
              {!icalUrl ? (
                <button onClick={generateIcalToken} disabled={icalGenerating}
                  className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition shadow-sm">
                  {icalGenerating ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Generazione...</>
                  ) : 'Genera link iCal'}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                    <code className="text-xs text-gray-500 break-all flex-1 select-all">{icalUrl}</code>
                    <button onClick={copyIcalUrl} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition">
                      {icalCopied
                        ? <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        : <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      }
                    </button>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <button onClick={() => setShowIcalInstructions(v => !v)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition">
                      <svg className={`w-3.5 h-3.5 transition-transform ${showIcalInstructions ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Come lo aggiungo al mio calendario?
                    </button>
                    <button onClick={generateIcalToken} disabled={icalGenerating}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition disabled:opacity-60">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Rigenera link
                    </button>
                  </div>
                  {showIcalInstructions && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-blue-800 mb-1">📱 Google Calendar</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-gray-600 text-xs">
                          <li>Apri <strong>Google Calendar</strong> sul computer</li>
                          <li>Clicca <strong>«+»</strong> accanto a «Altri calendari» → <strong>«Da URL»</strong></li>
                          <li>Incolla il link e clicca <strong>«Aggiungi calendario»</strong></li>
                        </ol>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-blue-800 mb-1">🍎 Apple Calendar</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-gray-600 text-xs">
                          <li>Menu <strong>File → Nuova iscrizione calendario…</strong></li>
                          <li>Incolla il link e clicca <strong>Iscriviti</strong></li>
                        </ol>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-blue-800 mb-1">📧 Outlook</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-gray-600 text-xs">
                          <li><strong>Calendario → Aggiungi calendario → Da Internet</strong></li>
                          <li>Incolla il link e clicca <strong>OK</strong></li>
                        </ol>
                      </div>
                      <p className="text-xs text-gray-400">Gli appuntamenti si aggiornano automaticamente (ogni poche ore).</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-3 z-40 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400 hidden sm:block">Le modifiche non vengono salvate automaticamente</p>
          <button onClick={handleSave} disabled={saving}
            className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition shadow-sm">
            {saving ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Salvataggio...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Salva modifiche</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
