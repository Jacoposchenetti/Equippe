import { useState } from 'react';

interface STSExportSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  anno: number;
  xmlContent: string;
  onConfirmCaricato: () => Promise<void>;
}

export default function STSExportSuccessModal({
  isOpen,
  onClose,
  count,
  anno,
  xmlContent,
  onConfirmCaricato,
}: STSExportSuccessModalProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  function handleDownloadAgain() {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_sts_${anno}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleConfirmCaricato() {
    setConfirming(true);
    try {
      await onConfirmCaricato();
      setConfirmed(true);
    } catch {
      alert('Errore durante la conferma. Riprova.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                ✅ Export STS completato
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {count} fattur{count === 1 ? 'a' : 'e'} esportat{count === 1 ? 'a' : 'e'} per l'anno {anno}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600 font-medium">
            Segui questi passaggi per completare l'invio al Sistema Tessera Sanitaria:
          </p>

          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">1</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Il file XML è stato scaricato</p>
              <p className="text-xs text-gray-500 mt-0.5">Se non lo trovi, puoi scaricarlo di nuovo:</p>
              <button onClick={handleDownloadAgain}
                className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium underline">
                ↓ Scarica di nuovo export_sts_{anno}.xml
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">2</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Accedi al portale Sistema TS</p>
              <p className="text-xs text-gray-500 mt-0.5">Accedi con le tue credenziali, SPID o CIE.</p>
              <a href="https://sistemats4.sanita.finanze.it/simossHome/login.jsp"
                target="_blank" rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
                Apri portale Sistema TS
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">3</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Carica il file XML</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Nel portale STS, vai su <span className="font-medium">"Spese sanitarie" → "Invio file"</span> e carica il file <span className="font-mono text-xs">export_sts_{anno}.xml</span>.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">4</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Verifica la ricevuta</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Il portale STS mostrerà una ricevuta di avvenuta ricezione. Controlla che non ci siano errori.
              </p>
            </div>
          </div>
        </div>

        {/* Confirm section */}
        <div className="px-6 pb-6">
          {confirmed ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <span className="text-green-600 text-lg">✅</span>
              <p className="text-sm text-green-700 font-medium">
                Confermato! Le fatture sono state marcate come caricate sul portale STS.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-600 mb-3">
                Hai caricato il file sul portale STS e verificato la ricevuta?
              </p>
              <div className="flex gap-2">
                <button onClick={handleConfirmCaricato} disabled={confirming}
                  className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                  {confirming ? 'Conferma...' : '✓ Sì, ho caricato su STS'}
                </button>
                <button onClick={onClose}
                  className="px-4 py-2 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 transition">
                  Lo farò dopo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
