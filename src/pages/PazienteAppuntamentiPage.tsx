import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Appointment } from '@/types/equippe';

interface PatientDoc {
  nome: string;
  cognome: string;
  email: string;
}

type AppointmentWithId = Appointment & { id: string };

export default function PazienteAppuntamentiPage() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientDoc | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (!user) {
        navigate('/paziente/login', { replace: true });
        return;
      }
      const patSnap = await getDoc(doc(db, 'patients', user.uid));
      if (!patSnap.exists()) {
        navigate('/paziente/login', { replace: true });
        return;
      }
      const patData = patSnap.data() as PatientDoc;
      setPatient(patData);

      // Fetch appointments by patient email
      const q = query(
        collection(db, 'appointments'),
        where('patientEmail', '==', patData.email),
        orderBy('date', 'desc'),
      );
      const snap = await getDocs(q);
      const appts = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppointmentWithId));
      setAppointments(appts);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/trova');
  };

  const today = new Date().toISOString().split('T')[0];
  const upcoming = appointments.filter(a => a.date >= today && a.status === 'confirmed');
  const past = appointments.filter(a => a.date < today || a.status === 'cancelled');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Caricamento appuntamenti…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/trova" className="flex items-center">
            <span className="text-blue-600 font-bold text-xl">tua</span>
            <span className="text-green-600 font-bold text-xl">equipe</span>
            <span className="text-orange-500 font-bold text-xl">.it</span>
          </Link>
          <div className="flex items-center gap-3">
            {patient && (
              <span className="text-sm text-gray-600 hidden sm:block">
                {patient.nome} {patient.cognome}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Esci
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900">I tuoi appuntamenti</h1>
          {patient && (
            <p className="text-gray-500 text-sm mt-1">{patient.email}</p>
          )}
        </div>

        {/* Prossimi */}
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            Prossimi appuntamenti
          </h2>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
              <p className="text-gray-500 text-sm mb-3">Nessun appuntamento in programma.</p>
              <Link to="/trova" className="text-blue-600 text-sm font-semibold hover:underline">
                Trova un professionista →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(a => (
                <AppointmentCard key={a.id} appointment={a} />
              ))}
            </div>
          )}
        </section>

        {/* Passati */}
        {past.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-400 rounded-full" />
              Appuntamenti passati
            </h2>
            <div className="space-y-3">
              {past.map(a => (
                <AppointmentCard key={a.id} appointment={a} isPast />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AppointmentCard({
  appointment: a,
  isPast,
}: {
  appointment: AppointmentWithId;
  isPast?: boolean;
}) {
  const dateStr = new Date(a.date + 'T00:00:00').toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const isCancelled = a.status === 'cancelled';

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
        isCancelled ? 'border-red-100 opacity-70' : 'border-gray-100'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-bold text-gray-900">{a.professionalName}</span>
          {isCancelled ? (
            <span className="text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">
              Cancellato
            </span>
          ) : isPast ? (
            <span className="text-xs font-medium bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
              Completato
            </span>
          ) : (
            <span className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
              Confermato
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">{a.tipoVisita}</p>
        <p className="text-sm text-gray-500 mt-0.5">
          {dateStr} — ore {a.startTime}
          {a.locazioneTipo && (
            <span className="ml-2 text-xs">
              {a.locazioneTipo === 'online' ? '💻 Online' : '🏥 In presenza'}
            </span>
          )}
        </p>
      </div>
      {!isCancelled && !isPast && a.cancellationToken && (
        <a
          href={`/cancella?token=${a.cancellationToken}`}
          className="text-sm text-red-500 hover:text-red-700 hover:underline whitespace-nowrap flex-shrink-0"
        >
          Cancella appuntamento
        </a>
      )}
    </div>
  );
}
