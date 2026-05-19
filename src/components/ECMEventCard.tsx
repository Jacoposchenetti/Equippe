import { useState } from 'react';
import { ECMEvent, ECMEventDetail, useECMEventDetail, useECMDownloadProgramma } from '@/hooks/useECMSearch';

interface ECMEventCardProps {
  event: ECMEvent;
  compact?: boolean;
}

function DetailModal({ detail, onClose }: { detail: ECMEventDetail; onClose: () => void }) {
  const rows: { label: string; value: string }[] = [
    { label: 'ID Evento', value: detail.id },
    { label: 'Edizione', value: detail.edizione },
    { label: 'Provider', value: detail.ragioneSociale },
    { label: 'ID Provider', value: detail.idProvider },
    { label: 'Data inizio', value: detail.dataInizio },
    { label: 'Data fine', value: detail.dataFine },
    { label: 'Durata (ore)', value: detail.durata },
    { label: 'Crediti', value: detail.crediti },
    { label: 'Quota partecipazione', value: detail.quota },
    { label: 'N. Partecipanti', value: detail.numPartecipanti },
    { label: 'Tipologia FAD', value: detail.tipologiaFAD },
    { label: 'Obiettivo formativo', value: detail.obiettivo },
    { label: 'Area obiettivo', value: detail.areaObiettivo },
    { label: 'Competenze tecnico-prof.', value: detail.competenzeTecniche },
    { label: 'Competenze di processo', value: detail.competenzeProcesso },
    { label: 'Verifica apprendimento', value: detail.verificaApprendimento },
    { label: 'Professioni', value: detail.professioni },
    { label: 'Programma', value: detail.programmaFilename },
    { label: 'Sponsorizzato', value: detail.sponsorizzato },
    { label: 'Tel. Segreteria', value: detail.telefonoSegreteria },
    { label: 'Email Segreteria', value: detail.emailSegreteria },
    { label: 'Responsabile', value: [detail.responsabileNome, detail.responsabileCognome].filter(Boolean).join(' ') },
  ].filter(r => r.value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 pr-4">{detail.titolo}</h2>
          <button onClick={onClose} className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:gap-3">
              <span className="text-sm font-medium text-gray-500 sm:w-48 flex-shrink-0">{label}</span>
              <span className="text-sm text-gray-900 break-words">
                {label === 'Email Segreteria' ? (
                  <a href={`mailto:${value}`} className="text-blue-600 hover:underline">{value}</a>
                ) : label === 'Tel. Segreteria' ? (
                  <a href={`tel:${value}`} className="text-blue-600 hover:underline">{value}</a>
                ) : value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ECMEventCard({ event, compact = false }: ECMEventCardProps) {
  const { detail, loading: detailLoading, error: detailError, loadDetail, clearDetail } = useECMEventDetail();
  const { loading: pdfLoading, error: pdfError, download } = useECMDownloadProgramma();
  const [showDetail, setShowDetail] = useState(false);

  const handleDetail = async () => {
    if (!event.id) return;
    const result = await loadDetail(event.id);
    if (result) setShowDetail(true);
  };

  const handleDownload = () => {
    if (!event.id) return;
    download(event.id);
  };

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden border border-gray-100 ${compact ? 'p-4' : 'p-6'}`}>
        {/* Header con crediti badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className={`font-semibold text-gray-900 line-clamp-2 ${compact ? 'text-sm' : 'text-base'}`}>
            {event.titolo || 'Evento ECM'}
          </h3>
          {event.crediti && (
            <span className="flex-shrink-0 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full whitespace-nowrap">
              {event.crediti} ECM
            </span>
          )}
        </div>

        {/* Provider */}
        {event.provider && (
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-sm text-gray-600 truncate">{event.provider}</span>
          </div>
        )}

        {/* Date */}
        {(event.dataInizio || event.dataFine) && (
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-600">
              {event.dataInizio}
              {event.dataFine && event.dataFine !== event.dataInizio && ` — ${event.dataFine}`}
            </span>
          </div>
        )}

        {!compact && (
          <>
            {/* Tipologia & Professione */}
            <div className="flex flex-wrap gap-2 mb-3">
              {event.tipologia && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                  {event.tipologia}
                </span>
              )}
              {event.professione && (
                <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-full">
                  {event.professione}
                </span>
              )}
            </div>

            {/* Costo */}
            {event.costo && (
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-medium">Costo:</span> {event.costo}
              </p>
            )}
          </>
        )}

        {/* Footer: ID + pulsanti azione */}
        <div className={`${compact ? 'mt-2' : 'mt-4'} pt-3 border-t border-gray-100`}>
          {event.id && (
            <span className="text-xs text-gray-400 block mb-2">ID: {event.id}</span>
          )}

          {event.id && !compact && (
            <div className="flex items-center gap-2">
              {/* Dettaglio Evento */}
              <button
                onClick={handleDetail}
                disabled={detailLoading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition disabled:opacity-50"
              >
                {detailLoading ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                Dettaglio
              </button>

              {/* Scarica Programma */}
              <button
                onClick={handleDownload}
                disabled={pdfLoading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
              >
                {pdfLoading ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                Programma PDF
              </button>
            </div>
          )}

          {/* Errori azioni */}
          {(detailError || pdfError) && (
            <p className="text-xs text-red-500 mt-1">{detailError || pdfError}</p>
          )}
        </div>
      </div>

      {/* Modal dettaglio */}
      {showDetail && detail && (
        <DetailModal detail={detail} onClose={() => { setShowDetail(false); clearDetail(); }} />
      )}
    </>
  );
}
