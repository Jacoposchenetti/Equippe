import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Header from '@/components/Header';
import { Appointment, AppointmentStatus } from '@/types/equippe';

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string }> = {
  confirmed: { label: 'Confermato', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annullato', color: 'bg-red-100 text-red-700' },
  completed: { label: 'Completato', color: 'bg-gray-100 text-gray-600' },
};

type FilterStatus = 'all' | AppointmentStatus;
type DateFilter = 'upcoming' | 'past' | 'today';

export default function AppointmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('upcoming');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const q = query(
      collection(db, 'appointments'),
      where('professionalUid', '==', user.uid),
      orderBy('date', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
      setAppointments(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'appointments', id), { status });
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = appointments.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (dateFilter === 'upcoming') return a.date >= today;
    if (dateFilter === 'past') return a.date < today;
    if (dateFilter === 'today') return a.date === today;
    return true;
  });

  const upcomingCount = appointments.filter(a => a.date >= today && a.status === 'confirmed').length;
  const todayCount = appointments.filter(a => a.date === today && a.status === 'confirmed').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Caricamento appuntamenti...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Appuntamenti</h1>
            <p className="text-gray-600 mt-1">Gestisci le prenotazioni ricevute dai pazienti</p>
          </div>
          <button onClick={() => navigate('/disponibilita')}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Gestisci disponibilità
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{todayCount}</div>
            <div className="text-sm text-gray-500 mt-1">Oggi</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{upcomingCount}</div>
            <div className="text-sm text-gray-500 mt-1">Prossimi</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-3xl font-bold text-gray-700">{appointments.length}</div>
            <div className="text-sm text-gray-500 mt-1">Totali</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            {(['upcoming', 'today', 'past'] as DateFilter[]).map(df => (
              <button key={df} onClick={() => setDateFilter(df)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition
                  ${dateFilter === df ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {df === 'upcoming' ? 'Prossimi' : df === 'today' ? 'Oggi' : 'Passati'}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            {(['all', 'confirmed', 'cancelled', 'completed'] as FilterStatus[]).map(sf => (
              <button key={sf} onClick={() => setStatusFilter(sf)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition
                  ${statusFilter === sf ? 'bg-gray-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {sf === 'all' ? 'Tutti' : STATUS_CONFIG[sf as AppointmentStatus].label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun appuntamento</h3>
            <p className="text-sm text-gray-500">
              {dateFilter === 'upcoming'
                ? 'Non hai appuntamenti futuri. Rendi il tuo profilo pubblico per ricevere prenotazioni.'
                : 'Nessun appuntamento trovato per i filtri selezionati.'}
            </p>
            {dateFilter === 'upcoming' && (
              <button onClick={() => navigate('/disponibilita')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
                Configura disponibilità
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(appt => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                updating={updatingId === appt.id}
                onUpdateStatus={updateStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  appointment: Appointment;
  updating: boolean;
  onUpdateStatus: (id: string, status: AppointmentStatus) => void;
}

function AppointmentCard({ appointment: a, updating, onUpdateStatus }: CardProps) {
  const statusCfg = STATUS_CONFIG[a.status];
  const dateFormatted = new Date(a.date + 'T00:00:00').toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-start gap-4">
      {/* Date block */}
      <div className="flex-shrink-0 text-center bg-blue-50 rounded-lg px-4 py-3 min-w-[80px]">
        <div className="text-2xl font-bold text-blue-700">{new Date(a.date + 'T00:00:00').getDate()}</div>
        <div className="text-xs text-blue-500 uppercase font-medium">
          {new Date(a.date + 'T00:00:00').toLocaleDateString('it-IT', { month: 'short' })}
        </div>
        <div className="text-sm font-bold text-gray-700 mt-1">{a.startTime}–{a.endTime}</div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-semibold text-gray-900 text-lg">{a.patientName}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-1">{a.tipoVisita} · {dateFormatted}</p>
        <div className="flex gap-4 text-sm text-gray-500 flex-wrap">
          <a href={`mailto:${a.patientEmail}`} className="hover:text-blue-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {a.patientEmail}
          </a>
          {a.patientPhone && (
            <a href={`tel:${a.patientPhone}`} className="hover:text-blue-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {a.patientPhone}
            </a>
          )}
        </div>
        {a.notes && (
          <p className="text-sm text-gray-500 mt-2 italic">"{a.notes}"</p>
        )}
      </div>

      {/* Actions */}
      {a.status === 'confirmed' && (
        <div className="flex sm:flex-col gap-2 flex-shrink-0">
          <button onClick={() => onUpdateStatus(a.id!, 'completed')} disabled={updating}
            className="px-3 py-1.5 text-xs font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition">
            Completato
          </button>
          <button onClick={() => onUpdateStatus(a.id!, 'cancelled')} disabled={updating}
            className="px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition">
            Annulla
          </button>
        </div>
      )}
    </div>
  );
}
