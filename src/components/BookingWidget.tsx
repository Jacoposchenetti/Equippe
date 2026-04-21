import { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Availability, Appointment, TipoVisita, WeeklySchedule } from '@/types/equippe';

interface BookingWidgetProps {
  professionalUid: string;
  professionalName: string;
  availability: Availability;
}

const DAY_KEYS: (keyof WeeklySchedule)[] = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function generateSlots(availability: Availability, date: Date, bookedSlotsByDate: Record<string, string[]>): string[] {
  const dayKey = DAY_KEYS[date.getDay()];
  const ranges = availability.schedule[dayKey] ?? [];
  const slots: string[] = [];
  const dateStr = date.toISOString().split('T')[0];
  const booked = bookedSlotsByDate[dateStr] ?? [];

  for (const range of ranges) {
    let cursor = range.start;
    while (true) {
      const end = addMinutes(cursor, availability.slotDurationMinutes);
      if (end > range.end) break;
      if (!booked.includes(cursor)) {
        slots.push(cursor);
      }
      cursor = addMinutes(end, availability.bufferMinutes);
    }
  }
  return slots;
}

function isDateAvailable(availability: Availability, date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  if (availability.exceptDates?.includes(dateStr)) return false;
  const dayKey = DAY_KEYS[date.getDay()];
  return (availability.schedule[dayKey] ?? []).length > 0;
}

export default function BookingWidget({ professionalUid, professionalName, availability }: BookingWidgetProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedTipo, setSelectedTipo] = useState<TipoVisita | null>(
    availability.tipiVisita.length === 1 ? availability.tipiVisita[0] : null
  );
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [step, setStep] = useState<'calendar' | 'form' | 'success'>('calendar');

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setCurrentUser);
    return unsub;
  }, []);

  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + availability.bookingWindowDays);
    return d;
  }, [availability.bookingWindowDays]);

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
    const dateStr = date.toISOString().split('T')[0];
    if (bookedSlots[dateStr] !== undefined) return; // already loaded
    setLoadingSlots(true);
    try {
      const q = query(
        collection(db, 'appointments'),
        where('professionalUid', '==', professionalUid),
        where('date', '==', dateStr),
        where('status', '==', 'confirmed')
      );
      const snap = await getDocs(q);
      const times = snap.docs.map(d => (d.data() as Appointment).startTime);
      setBookedSlots(prev => ({ ...prev, [dateStr]: times }));
    } catch {
      setBookedSlots(prev => ({ ...prev, [dateStr]: [] }));
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectDate = async (date: Date) => {
    if (date < today || date > maxDate) return;
    if (!isDateAvailable(availability, date)) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    await loadBookedSlots(date);
  };

  const slotsForSelected = useMemo(() => {
    if (!selectedDate) return [];
    return generateSlots(availability, selectedDate, bookedSlots);
  }, [selectedDate, bookedSlots, availability]);

  const handleSubmit = async () => {
    if (!selectedDate || !selectedSlot || !selectedTipo) return;
    setFormError('');
    if (!patientName.trim()) { setFormError('Inserisci il tuo nome'); return; }
    if (!patientEmail.trim() || !patientEmail.includes('@')) { setFormError('Inserisci un email valida'); return; }
    const loc = availability.locationVisita;
    if (loc?.tipo === 'entrambi' && !locScelta) { setFormError('Seleziona la modalità: in presenza o online'); return; }

    setSubmitting(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const endTime = addMinutes(selectedSlot, selectedTipo.durata);
      const cancellationToken = crypto.randomUUID();

      const loc = availability.locationVisita;
      const locTipo = loc ? (loc.tipo === 'entrambi' ? locScelta! : loc.tipo) : undefined;
      const locDettaglio = locTipo === 'presenziale' ? (loc?.indirizzo || undefined) : (loc?.linkOnline || undefined);

      const appointment: Omit<Appointment, 'id'> = {
        professionalUid,
        professionalName,
        patientName: patientName.trim(),
        patientEmail: patientEmail.trim().toLowerCase(),
        patientPhone: patientPhone.trim() || undefined,
        date: dateStr,
        startTime: selectedSlot,
        endTime,
        tipoVisita: selectedTipo.nome,
        status: 'confirmed',
        notes: notes.trim() || undefined,
        locazioneTipo: locTipo as 'presenziale' | 'online' | undefined,
        locazioneDettaglio: locDettaglio,
        cancellationToken,
        createdAt: Timestamp.now(),
        ...(currentUser ? { pazienteUid: currentUser.uid } : {}),
      };
      await addDoc(collection(db, 'appointments'), appointment);
      // Mark as booked locally
      setBookedSlots(prev => ({
        ...prev,
        [dateStr]: [...(prev[dateStr] ?? []), selectedSlot],
      }));
      setConfirmedAppointment({ locazioneTipo: locTipo, locazioneDettaglio: locDettaglio });
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
        {currentUser ? (
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
          setStep('calendar');
          setSelectedDate(null);
          setSelectedSlot(null);
          setPatientName(''); setPatientEmail(''); setPatientPhone(''); setNotes('');
          setLocScelta(null); setConfirmedAppointment(null);
        }} className="mt-6 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 underline">
          Fai un'altra prenotazione
        </button>
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

        {/* Location info */}
        {availability.locationVisita && (
          <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
            {availability.locationVisita.tipo === 'entrambi' ? (
              <div>
                <p className="font-medium text-gray-700 mb-2">Come vuoi svolgere la visita?</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setLocScelta('presenziale')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition ${locScelta === 'presenziale' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    🏥 In presenza
                    {availability.locationVisita.indirizzo && <div className="text-xs font-normal mt-0.5">{availability.locationVisita.indirizzo}</div>}
                  </button>
                  <button type="button" onClick={() => setLocScelta('online')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition ${locScelta === 'online' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    💻 Online
                  </button>
                </div>
              </div>
            ) : availability.locationVisita.tipo === 'presenziale' ? (
              <p className="text-gray-700">🏥 <span className="font-medium">In presenza</span>{availability.locationVisita.indirizzo ? ` — ${availability.locationVisita.indirizzo}` : ''}</p>
            ) : (
              <p className="text-gray-700">💻 <span className="font-medium">Visita online</span></p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {availability.tipiVisita.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo di visita *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availability.tipiVisita.map(tipo => (
                  <button key={tipo.id} type="button"
                    onClick={() => setSelectedTipo(tipo)}
                    className={`p-3 border-2 rounded-lg text-left transition ${selectedTipo?.id === tipo.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="font-medium text-sm">{tipo.nome}</div>
                    <div className="text-xs text-gray-500">{tipo.durata} min {tipo.prezzo ? `· €${tipo.prezzo}` : ''}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
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
          const past = date < today;
          const tooFar = date > maxDate;
          const available = !past && !tooFar && isDateAvailable(availability, date);
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
