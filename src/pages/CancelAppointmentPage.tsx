import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface AppointmentInfo {
  date: string;
  startTime: string;
  endTime: string;
  professionalName: string;
  tipoVisita: string;
  patientName: string;
  locazioneTipo?: string;
  locazioneDettaglio?: string;
  status: string;
}

const cancelFn = httpsCallable<
  { token: string; action: 'get' | 'cancel' },
  { appointment?: AppointmentInfo; alreadyCancelled?: boolean; success?: boolean }
>(functions, 'cancelAppointmentByToken');

export default function CancelAppointmentPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null);
  const [error, setError] = useState('');
  const [alreadyCancelled, setAlreadyCancelled] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Link non valido. Assicurati di aprire il link ricevuto via email.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await cancelFn({ token, action: 'get' });
        if (res.data.alreadyCancelled) {
          setAlreadyCancelled(true);
        } else if (res.data.appointment) {
          setAppointment(res.data.appointment);
        }
      } catch (e: any) {
        const code = e?.code;
        if (code === 'functions/not-found') {
          setError('Appuntamento non trovato. Il link potrebbe essere scaduto o non valido.');
        } else {
          setError('Errore nel caricamento. Riprova fra qualche istante.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleCancel = async () => {
    if (!token) return;
    setCancelling(true);
    try {
      await cancelFn({ token, action: 'cancel' });
      setCancelled(true);
    } catch (e: any) {
      const code = e?.code;
      if (code === 'functions/already-exists') {
        setAlreadyCancelled(true);
      } else {
        setError('Errore durante la cancellazione. Riprova o contatta l\'assistenza.');
      }
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-gray-400 text-sm mb-4">
            <span className="font-semibold text-gray-700">tuaequipe</span>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-gray-500">Caricamento appuntamento...</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Link non valido</h2>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        )}

        {!loading && alreadyCancelled && (
          <div className="text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Appuntamento già annullato</h2>
            <p className="text-sm text-gray-600">Questo appuntamento è stato già annullato in precedenza.</p>
          </div>
        )}

        {!loading && cancelled && (
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Appuntamento annullato</h2>
            <p className="text-sm text-gray-600">
              Il tuo appuntamento è stato annullato con successo. Il professionista ha ricevuto una notifica.
            </p>
          </div>
        )}

        {!loading && !error && !alreadyCancelled && !cancelled && appointment && (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Annulla appuntamento</h2>
            <p className="text-sm text-gray-500 mb-5">Vuoi annullare questo appuntamento?</p>

            {/* Appointment details card */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Professionista</span>
                <span className="font-medium text-gray-900">{appointment.professionalName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo visita</span>
                <span className="font-medium text-gray-900">{appointment.tipoVisita}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Data</span>
                <span className="font-medium text-gray-900 capitalize">{formatDate(appointment.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Orario</span>
                <span className="font-medium text-gray-900">{appointment.startTime} – {appointment.endTime}</span>
              </div>
              {appointment.locazioneTipo && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Modalità</span>
                  <span className="font-medium text-gray-900">
                    {appointment.locazioneTipo === 'presenziale' ? '🏥 In presenza' : '💻 Online'}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 disabled:bg-red-300 transition">
                {cancelling ? 'Annullamento in corso...' : 'Conferma annullamento'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Il professionista riceverà una notifica dell'annullamento.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
