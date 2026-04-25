import { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from '@/lib/firebase';
import { Availability, Appointment, TipoVisita, WeeklySchedule, SedeDisponibilita } from '@/types/equippe';

interface BookingWidgetProps {
  professionalUid: string;
  professionalName: string;
  availability: Availability;
}

const DAY_KEYS: (keyof WeeklySchedule)[] = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function generateSlots(
  schedule: WeeklySchedule,
  availability: Availability,
  date: Date,
  slotDurationMinutes: number,
  bookedSlotsByDate: Record<string, Array<{ start: string; end: string }>>,
  gcalBusyByDate: Record<string, Array<{ start: string; end: string }>>
): string[] {
  const dayKey = DAY_KEYS[date.getDay()];
  const ranges = schedule[dayKey] ?? [];
  const slots: string[] = [];
  const dateStr = localDateStr(date);
  const booked = bookedSlotsByDate[dateStr] ?? [];
  const gcalBusy = gcalBusyByDate[dateStr] ?? [];

  function isOverlap(slotStart: string, slotEnd: string, busy: Array<{ start: string; end: string }>): boolean {
    return busy.some(b => slotStart < b.end && slotEnd > b.start);
  }

  const buffer = availability.bufferMinutes ?? 0;

  for (const range of ranges) {
    let cursor = range.start;
    while (true) {
      const end = addMinutes(cursor, slotDurationMinutes);
      if (end > range.end) break;

      // Un nuovo slot [cursor, end] è in conflitto con un busy b se si sovrappone
      // all'appuntamento stesso O alla sua pausa post-appuntamento.
      // In caso di conflitto, saltiamo direttamente a b.end + buffer (no dead zone).
      const allBusy = [...booked, ...gcalBusy];
      const conflict = allBusy.find(b => cursor < addMinutes(b.end, buffer) && end > b.start);

      if (!conflict) {
        slots.push(cursor);
        cursor = addMinutes(end, buffer);
      } else {
        cursor = addMinutes(conflict.end, buffer);
      }
    }
  }
  return slots;
}

function isDateAvailable(schedule: WeeklySchedule, availability: Availability, date: Date): boolean {
  const dateStr = localDateStr(date);
  if (availability.exceptDates?.includes(dateStr)) return false;
  const dayKey = DAY_KEYS[date.getDay()];
  return (schedule[dayKey] ?? []).length > 0;
}

export default function BookingWidget({ professionalUid, professionalName, availability }: BookingWidgetProps) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Prima data prenotabile in base al preavviso minimo
  const minBookableDate = useMemo(() => {
    const minAdvanceHours = availability.minAdvanceHours ?? 0;
    const d = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [availability.minAdvanceHours]);

  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedTipo, setSelectedTipo] = useState<TipoVisita | null>(
    availability.tipiVisita.length === 1 ? availability.tipiVisita[0] : null
  );
  const [selectedSede, setSelectedSede] = useState<SedeDisponibilita | null>(() => {
    const sedi = availability.sedi ?? [];
    return sedi.length === 1 ? sedi[0] : null;
  });
  const hasSedi = (availability.sedi?.length ?? 0) > 0;
  const needsSedeChoice = hasSedi && (availability.sedi?.length ?? 0) > 1;
  const needsTipoChoice = availability.tipiVisita.length > 1;
  const [bookedSlots, setBookedSlots] = useState<Record<string, Array<{ start: string; end: string }>>>({});
  const [gcalBusy, setGcalBusy] = useState<Record<string, Array<{ start: string; end: string }>>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [step, setStep] = useState<'tipo' | 'sede' | 'calendar' | 'form' | 'success'>(() => {
    if (needsTipoChoice) return 'tipo';
    if (needsSedeChoice) return 'sede';
    return 'calendar';
  });

  // Form state
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [locScelta, setLocScelta] = useState<'presenziale' | 'online' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmedAppointment, setConfirmedAppointment] = useState<{ locazioneTipo?: string; locazioneDettaglio?: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isPatient, setIsPatient] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      setCurrentUser(user);
      if (user) {
        const { doc: fsDoc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(fsDoc(db, 'patients', user.uid));
        setIsPatient(snap.exists());
      } else {
        setIsPatient(false);
      }
    });
    return unsub;
  }, []);

  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + availability.bookingWindowDays);
    return d;
  }, [availability.bookingWindowDays, today]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Start from Monday
    const startOffset = (firstDay.getDay() + 6) % 7; // convert Sun=0 to Mon=0
    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [currentMonth]);

  const loadBookedSlots = async (date: Date) => {
    const dateStr = localDateStr(date);
    if (bookedSlots[dateStr] !== undefined) return; // already loaded
    setLoadingSlots(true);
    try {
      // Carica appuntamenti Equippe confermati
      const q = query(
        collection(db, 'appointments'),
        where('professionalUid', '==', professionalUid),
        where('date', '==', dateStr),
        where('status', '==', 'confirmed')
      );
      const snap = await getDocs(q);
      const times = snap.docs.map(d => {
        const appt = d.data() as Appointment;
        return { start: appt.startTime, end: appt.endTime };
      });
      setBookedSlots(prev => ({ ...prev, [dateStr]: times }));

      // Carica eventi Google Calendar (se connesso) — silenzioso in caso di errore
      try {
        const fns = getFunctions(undefined, 'europe-west1');
        const getBusy = httpsCallable<unknown, { busyTimes: Array<{ start: string; end: string }> }>(
          fns, 'getGoogleCalendarBusySlots'
        );
        const gcalDate = localDateStr(date);
        const { data } = await getBusy({ professionalUid, date: gcalDate });
        if (data.busyTimes.length > 0) {
          setGcalBusy(prev => ({ ...prev, [dateStr]: data.busyTimes }));
        }
      } catch {
        // Google Calendar non connesso o errore — non blocca il flusso
      }
    } catch {
      setBookedSlots(prev => ({ ...prev, [dateStr]: [] }));
    } finally {
      setLoadingSlots(false);
    }
  };

  // Effective schedule: use selected sede's schedule if available, fallback to top-level
  const effectiveSchedule = selectedSede?.schedule ?? availability.schedule;

  const handleSelectDate = async (date: Date) => {
    if (date < minBookableDate || date > maxDate) return;
    if (!isDateAvailable(effectiveSchedule, availability, date)) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    await loadBookedSlots(date);
  };

  const slotsForSelected = useMemo(() => {
    if (!selectedDate || !selectedTipo) return [];
    const slotDuration = selectedTipo.durata;
    const minAdvanceHours = availability.minAdvanceHours ?? 0;
    const cutoff = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);
    const cutoffTime = `${String(cutoff.getHours()).padStart(2, '0')}:${String(cutoff.getMinutes()).padStart(2, '0')}`;
    const dateStr = localDateStr(selectedDate);
    const todayStr = localDateStr(today);
    const minDateStr = localDateStr(minBookableDate);
    const all = generateSlots(effectiveSchedule, availability, selectedDate, slotDuration, bookedSlots, gcalBusy);
    if (dateStr === minDateStr && dateStr > todayStr) return all.filter(s => s >= cutoffTime);
    if (dateStr === minDateStr && dateStr === todayStr) return all.filter(s => s >= cutoffTime);
    return all;
  }, [selectedDate, selectedTipo, bookedSlots, gcalBusy, availability, effectiveSchedule, now]);

  const handleSubmit = async () => {
    if (!selectedDate || !selectedSlot || !selectedTipo) return;
    setFormError('');
    if (!patientName.trim()) { setFormError('Inserisci il tuo nome'); return; }
    if (!patientEmail.trim() || !patientEmail.includes('@')) { setFormError('Inserisci un email valida'); return; }
    const loc = availability.locationVisita;
    if (!selectedSede && loc?.tipo === 'entrambi' && !locScelta) { setFormError('Seleziona la modalità: in presenza o online'); return; }

    setSubmitting(true);
    try {
      const dateStr = localDateStr(selectedDate);
      const endTime = addMinutes(selectedSlot, selectedTipo.durata);
      const cancellationToken = crypto.randomUUID();

      // Determina locazione dalla sede selezionata (nuovo modello) o da locationVisita (legacy)
      let locTipo: 'presenziale' | 'online' | null = null;
      let locDettaglio: string | null = null;
      if (selectedSede) {
        locTipo = selectedSede.tipo;
        locDettaglio = selectedSede.tipo === 'presenziale' ? (selectedSede.indirizzo || null) : (selectedSede.linkOnline || null);
      } else {
        const loc = availability.locationVisita;
        if (loc) {
          const resolvedTipo = loc.tipo === 'entrambi' ? locScelta! : loc.tipo;
          locTipo = resolvedTipo as 'presenziale' | 'online';
          locDettaglio = resolvedTipo === 'presenziale' ? (loc.indirizzo || null) : (loc.linkOnline || null);
        }
      }

      const appointment: Omit<Appointment, 'id'> = {
        professionalUid,
        professionalName,
        patientName: patientName.trim(),
        patientEmail: patientEmail.trim().toLowerCase(),
        patientPhone: patientPhone.trim() || null,
        date: dateStr,
        startTime: selectedSlot,
        endTime,
        tipoVisita: selectedTipo.nome,
        status: 'confirmed',
        notes: notes.trim() || null,
        locazioneTipo: locTipo,
        locazioneDettaglio: locDettaglio,
        ...(selectedSede ? { sedeId: selectedSede.id, sedeName: selectedSede.nome } : {}),
        cancellationToken,
        createdAt: Timestamp.now(),
        ...(currentUser ? { pazienteUid: currentUser.uid } : {}),
      };
      await addDoc(collection(db, 'appointments'), appointment);
      // Mark as booked locally
      setBookedSlots(prev => ({
        ...prev,
        [dateStr]: [...(prev[dateStr] ?? []), { start: selectedSlot, end: endTime }],
      }));
      setConfirmedAppointment({ locazioneTipo: locTipo ?? undefined, locazioneDettaglio: locDettaglio ?? undefined });
      setStep('success');
    } catch (e) {
      console.error(e);
      setFormError('Errore durante la prenotazione. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Prenotazione confermata!</h3>
        <p className="text-gray-600 mb-1">
          {selectedDate?.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} — {selectedSlot}
        </p>
        <p className="text-gray-600 mb-4">con <strong>{professionalName}</strong></p>
        {selectedSede && (
          <p className="text-sm text-gray-500 mb-2">Sede: <strong>{selectedSede.nome}</strong></p>
        )}

        {confirmedAppointment?.locazioneTipo && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
            {confirmedAppointment.locazioneTipo === 'presenziale' ? (
              <>
                <span className="font-semibold">🏥 In presenza</span>
                {confirmedAppointment.locazioneDettaglio && (
                  <p className="mt-1 text-blue-700">{confirmedAppointment.locazioneDettaglio}</p>
                )}
              </>
            ) : (
              <>
                <span className="font-semibold">💻 Visita online</span>
                {confirmedAppointment.locazioneDettaglio && (
                  <p className="mt-1"><a href={confirmedAppointment.locazioneDettaglio} target="_blank" rel="noopener noreferrer" className="underline break-all">{confirmedAppointment.locazioneDettaglio}</a></p>
                )}
              </>
            )}
          </div>
        )}

        <p className="text-sm text-gray-500">Riceverai una email di conferma a <strong>{patientEmail}</strong></p>
        <p className="text-xs text-gray-400 mt-1">Nell'email troverai anche il link per annullare l'appuntamento se necessario.</p>

        {/* Post-booking prompt */}
        {isPatient ? (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="text-blue-800 font-medium">Gestisci i tuoi appuntamenti</p>
            <a href="/paziente/appuntamenti" className="text-blue-600 hover:underline text-xs">
              Vai all'area personale →
            </a>
          </div>
        ) : (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-left">
            <p className="text-gray-800 font-medium mb-1">Vuoi tenere traccia dei tuoi appuntamenti?</p>
            <p className="text-gray-600 text-xs mb-2">Crea un account gratuito per visualizzare e gestire tutte le tue prenotazioni.</p>
            <a
              href={`/paziente/registrati?email=${encodeURIComponent(patientEmail)}`}
              className="inline-block text-xs font-semibold text-blue-600 hover:underline"
            >
              Crea account gratuito →
            </a>
          </div>
        )}

        <button onClick={() => {
          if (needsTipoChoice) { setSelectedTipo(null); setStep('tipo'); }
          else if (needsSedeChoice) setStep('sede');
          else setStep('calendar');
          setSelectedDate(null);
          setSelectedSlot(null);
          setSelectedSede(needsSedeChoice ? null : (availability.sedi?.[0] ?? null));
          setPatientName(''); setPatientEmail(''); setPatientPhone(''); setNotes('');
          setLocScelta(null); setConfirmedAppointment(null);
        }} className="mt-6 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 underline">
          Fai un'altra prenotazione
        </button>
      </div>
    );
  }

  if (step === 'tipo') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Che tipo di visita cerchi?</h3>
        <p className="text-sm text-gray-500 mb-5">Scegli la prestazione che ti interessa</p>
        <div className="space-y-3">
          {availability.tipiVisita.map(tipo => (
            <button key={tipo.id} onClick={() => {
              setSelectedTipo(tipo);
              setStep(needsSedeChoice ? 'sede' : 'calendar');
            }}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left group">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-sm">
                {tipo.durata}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 group-hover:text-blue-700">{tipo.nome}</p>
                <p className="text-sm text-gray-500">
                  {tipo.durata} min{tipo.prezzo ? ` · €${tipo.prezzo}` : ''}
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'sede') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        {needsTipoChoice && (
          <button onClick={() => setStep('tipo')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Indietro
          </button>
        )}
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Dove vuoi la visita?</h3>
        <p className="text-sm text-gray-500 mb-5">Scegli la sede che preferisci</p>
        <div className="space-y-3">
          {(availability.sedi ?? []).map(sede => (
            <button key={sede.id} onClick={() => { setSelectedSede(sede); setStep('calendar'); }}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${sede.tipo === 'online' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                {sede.tipo === 'online' ? (
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 group-hover:text-blue-700">{sede.nome}</p>
                {sede.tipo === 'presenziale' && sede.indirizzo && (
                  <p className="text-sm text-gray-500 truncate">{sede.indirizzo}</p>
                )}
                {sede.tipo === 'online' && (
                  <p className="text-sm text-gray-500">Visita online</p>
                )}
              </div>
              <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <button onClick={() => setStep('calendar')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Indietro
        </button>

        <h3 className="text-lg font-bold text-gray-900 mb-1">Completa la prenotazione</h3>
        <p className="text-sm text-gray-600 mb-4">
          {selectedDate?.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} ore {selectedSlot} — {selectedTipo?.nome}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome e cognome *</label>
            <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Mario Rossi"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={patientEmail} onChange={e => setPatientEmail(e.target.value)} placeholder="mario@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono (opzionale)</label>
            <input type="tel" value={patientPhone} onChange={e => setPatientPhone(e.target.value)} placeholder="+39 ..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (opzionale)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Motivo della visita, informazioni aggiuntive..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button onClick={handleSubmit} disabled={submitting || !selectedTipo}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition">
            {submitting ? 'Prenotazione in corso...' : 'Conferma prenotazione'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Confermando accetti il trattamento dei tuoi dati per la gestione dell'appuntamento.
          </p>
        </div>
      </div>
    );
  }

  // Step: calendar
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <button onClick={() => setStep(needsSedeChoice ? 'sede' : needsTipoChoice ? 'tipo' : 'calendar')}
        className={`flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 ${!needsSedeChoice && !needsTipoChoice ? 'invisible' : ''}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Indietro
      </button>

      {selectedTipo && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <span className="font-medium text-blue-700">{selectedTipo.nome}</span>
          <span className="text-gray-400">·</span>
          <span>{selectedTipo.durata} min{selectedTipo.prezzo ? ` · €${selectedTipo.prezzo}` : ''}</span>
          {needsTipoChoice && (
            <button onClick={() => setStep('tipo')} className="ml-auto text-xs text-blue-500 hover:underline">Cambia</button>
          )}
        </div>
      )}

      <h3 className="text-lg font-bold text-gray-900 mb-4">Seleziona data e ora</h3>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          disabled={currentMonth <= new Date(today.getFullYear(), today.getMonth(), 1)}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-semibold text-gray-900 capitalize">
          {currentMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="p-2 rounded-lg hover:bg-gray-100 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {calendarDays.map((date, idx) => {
          if (!date) return <div key={idx} />;
          const past = date < minBookableDate;
          const tooFar = date > maxDate;
          const available = !past && !tooFar && isDateAvailable(effectiveSchedule, availability, date);
          const selected = selectedDate?.toDateString() === date.toDateString();
          return (
            <button key={idx} onClick={() => available && handleSelectDate(date)}
              className={`aspect-square rounded-lg text-sm font-medium transition
                ${selected ? 'bg-blue-600 text-white' : ''}
                ${available && !selected ? 'hover:bg-blue-50 text-gray-900 cursor-pointer' : ''}
                ${!available ? 'text-gray-300 cursor-default' : ''}
              `}>
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Slot picker */}
      {selectedDate && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Orari disponibili — {selectedDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h4>
          {loadingSlots ? (
            <div className="text-sm text-gray-400">Caricamento orari...</div>
          ) : slotsForSelected.length === 0 ? (
            <div className="text-sm text-gray-400">Nessuno slot disponibile in questo giorno.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
              {slotsForSelected.map(slot => (
                <button key={slot} onClick={() => setSelectedSlot(slot)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition
                    ${selectedSlot === slot ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:border-blue-400 text-gray-700'}`}>
                  {slot}
                </button>
              ))}
            </div>
          )}
          {selectedSlot && (
            <button onClick={() => setStep('form')}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition">
              Continua con {selectedSlot}
            </button>
          )}
        </div>
      )}
      {!selectedDate && (
        <p className="text-sm text-center text-gray-400">Clicca su un giorno disponibile per vedere gli orari</p>
      )}
    </div>
  );
}