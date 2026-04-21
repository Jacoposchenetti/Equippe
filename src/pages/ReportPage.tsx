import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { formatEuro } from '@/lib/calcoloFiscale';
import { getSTSDeadlineInfo, getUrgenzaStyle } from '@/lib/stsDeadlines';

interface FatturaReportData {
  tipo: string;
  stato: string;
  dataEmissione: string;
  totali: {
    imponibile: number;
    cassaPrevidenziale: number;
    totaleIva: number;
    ritenuataAcconto: number;
    bolloVirtuale: number;
    totaleDocumento: number;
    nettoAPagare: number;
  };
  idoneaSTS: boolean;
}

export default function ReportPage() {
  const { user } = useAuth();
  const [fatture, setFatture] = useState<FatturaReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, anno]);

  async function loadData() {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', user!.uid, 'fatture'),
        where('anno', '==', anno),
        where('stato', '==', 'emessa'),
        where('tipo', '==', 'fattura'),
        orderBy('numero', 'asc')
      );
      const snap = await getDocs(q);
      setFatture(snap.docs.map(d => d.data() as FatturaReportData));
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const byMonth: Record<number, { count: number; fatturato: number }> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = { count: 0, fatturato: 0 };

    let totImponibile = 0, totCassa = 0, totIva = 0, totRitenuta = 0, totBollo = 0, totDocumento = 0, totNetto = 0;
    let countSTS = 0;

    for (const f of fatture) {
      const mese = parseInt(f.dataEmissione.split('-')[1], 10);
      byMonth[mese].count++;
      byMonth[mese].fatturato += f.totali.totaleDocumento;

      totImponibile += f.totali.imponibile;
      totCassa += f.totali.cassaPrevidenziale;
      totIva += f.totali.totaleIva;
      totRitenuta += f.totali.ritenuataAcconto;
      totBollo += f.totali.bolloVirtuale;
      totDocumento += f.totali.totaleDocumento;
      totNetto += f.totali.nettoAPagare;
      if (f.idoneaSTS) countSTS++;
    }

    return { byMonth, totImponibile, totCassa, totIva, totRitenuta, totBollo, totDocumento, totNetto, countSTS, count: fatture.length };
  }, [fatture]);

  async function handleExportCSV() {
    setExporting(true);
    try {
      const fn = httpsCallable<{ anno: number }, { downloadUrl: string }>(functions, 'exportCommercialistaCSV');
      const result = await fn({ anno });
      window.open(result.data.downloadUrl, '_blank');
    } catch (err) {
      console.error('Errore export:', err);
      alert('Errore durante l\'export.');
    } finally {
      setExporting(false);
    }
  }

  const mesiLabel = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const maxFatturato = Math.max(...Object.values(stats.byMonth).map(m => m.fatturato), 1);
  const anni = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-4 sm:pb-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">Report Fatturazione</h1>
            <p className="text-gray-600 text-sm sm:text-base">Panoramica annuale della tua attività di fatturazione.</p>
          </div>
          <div className="flex gap-2 self-start">
            <select value={anno} onChange={e => setAnno(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              {anni.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={handleExportCSV} disabled={exporting || fatture.length === 0}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition text-sm">
              {exporting ? 'Export...' : '📊 Esporta CSV'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : fatture.length === 0 ? (
          <div className="text-center py-16">
            <div className="mb-4 text-6xl">📊</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Nessun dato per il {anno}</h3>
            <p className="text-gray-500">Non ci sono fatture emesse per l'anno selezionato.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Totali annuali */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Fatture emesse</p>
                <p className="text-2xl font-bold text-gray-900">{stats.count}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Totale fatturato</p>
                <p className="text-2xl font-bold text-green-600">{formatEuro(stats.totDocumento)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Incassato netto</p>
                <p className="text-2xl font-bold text-blue-600">{formatEuro(stats.totNetto)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Invii STS</p>
                <p className="text-2xl font-bold text-cyan-600">{stats.countSTS}</p>
              </div>
            </div>

            {/* Grafico mensile */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Fatturato mensile</h2>
              <div className="flex items-end gap-2 h-48">
                {mesiLabel.map((label, i) => {
                  const mData = stats.byMonth[i + 1];
                  const height = maxFatturato > 0 ? (mData.fatturato / maxFatturato) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center justify-end" style={{ height: '160px' }}>
                        {mData.count > 0 && (
                          <span className="text-xs text-gray-500 mb-1">{mData.count}</span>
                        )}
                        <div
                          className={`w-full rounded-t transition-all ${mData.fatturato > 0 ? 'bg-blue-500' : 'bg-gray-100'}`}
                          style={{ height: `${Math.max(height, mData.fatturato > 0 ? 8 : 2)}%` }}
                          title={`${label}: ${formatEuro(mData.fatturato)} (${mData.count} fatture)`}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dettaglio fiscale */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Riepilogo fiscale annuale</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Totale imponibile</span>
                  <span className="font-medium">{formatEuro(stats.totImponibile)}</span>
                </div>
                {stats.totCassa > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Totale cassa previdenziale</span>
                    <span className="font-medium">{formatEuro(stats.totCassa)}</span>
                  </div>
                )}
                {stats.totIva > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Totale IVA</span>
                    <span className="font-medium">{formatEuro(stats.totIva)}</span>
                  </div>
                )}
                {stats.totBollo > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Totale bolli virtuali</span>
                    <span className="font-medium">{formatEuro(stats.totBollo)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-100 font-bold">
                  <span>Totale documenti</span>
                  <span>{formatEuro(stats.totDocumento)}</span>
                </div>
                {stats.totRitenuta > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Totale ritenute d'acconto</span>
                    <span className="font-medium text-red-600">- {formatEuro(stats.totRitenuta)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 font-bold text-base">
                  <span>Totale netto incassato</span>
                  <span className="text-green-600">{formatEuro(stats.totNetto)}</span>
                </div>
              </div>
            </div>

            {/* Info STS */}
            {stats.countSTS > 0 && (() => {
              const stsInfo = getSTSDeadlineInfo(anno);
              const style = getUrgenzaStyle(stsInfo.urgenza);
              return (
                <div className={`${style.bg} border ${style.border} rounded-xl p-4 text-sm ${style.text}`}>
                  <p className="font-medium mb-1">{style.icon} Sistema Tessera Sanitaria — {stsInfo.periodoLabel}</p>
                  <p>
                    Hai <strong>{stats.countSTS}</strong> fatture idonee all'invio al Sistema Tessera Sanitaria.
                    Esporta il file XML dalla pagina <strong>Fatture</strong> e caricalo sul{' '}
                    <a href="https://sistemats4.sanita.finanze.it/simossHome/login.jsp" target="_blank" rel="noopener noreferrer"
                      className="underline font-medium">portale STS</a>.
                  </p>
                  <p className="mt-1 text-xs opacity-75">
                    {stsInfo.urgenza === 'scaduto'
                      ? `⚠️ Scadenza superata il ${stsInfo.deadline}`
                      : `Scadenza invio: ${stsInfo.deadline} (${stsInfo.giorniRimanenti} giorni rimanenti)`
                    }
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
