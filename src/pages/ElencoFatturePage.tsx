import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, onSnapshot, query, orderBy, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import STSExportSuccessModal from '@/components/STSExportSuccessModal';
import { useNavigate } from 'react-router-dom';
import { formatEuro } from '@/lib/calcoloFiscale';
import { getSTSDeadlineInfo, getUrgenzaStyle } from '@/lib/stsDeadlines';

interface Fattura {
  id: string;
  tipo: 'fattura' | 'proforma' | 'nota_credito';
  stato: 'bozza' | 'emessa';
  numero: number;
  anno: number;
  numeroFormattato: string;
  dataEmissione: string;
  dataScadenza?: string;
  statoPagamento?: 'non_pagata' | 'pagata';
  dataPagamento?: string;
  emailInviataAt?: any;
  emailInviataA?: string;
  inviatoSTS?: boolean;
  inviatoSTSAt?: any;
  caricatoSTS?: boolean;
  caricatoSTSAt?: any;
  fatturaRiferimentoNumero?: string;
  clienteSnapshot: {
    tipo: string;
    nome?: string;
    cognome?: string;
    ragioneSociale?: string;
    codiceFiscale: string;
    email?: string;
  };
  totali: {
    totaleDocumento: number;
    nettoAPagare: number;
  };
  xmlUrl?: string;
  pdfUrl?: string;
  pdfPath?: string;
  canale?: 'sdi' | 'cartacea';
  idoneaSTS: boolean;
}

export default function ElencoFatturePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAnno, setFiltroAnno] = useState(new Date().getFullYear());
  const [filtroTipo, setFiltroTipo] = useState<string>('tutti');
  const [filtroStato, setFiltroStato] = useState<string>('tutti');
  const [exportingComm, setExportingComm] = useState(false);
  const [exportingSTS, setExportingSTS] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // STS modal state
  const [stsModalOpen, setStsModalOpen] = useState(false);
  const [stsModalData, setStsModalData] = useState<{ count: number; xmlContent: string } | null>(null);
  const [filtroSTS, setFiltroSTS] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'fatture'),
      where('anno', '==', filtroAnno),
      orderBy('numero', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setFatture(snap.docs.map(d => ({ id: d.id, ...d.data() } as Fattura)));
      setLoading(false);
    });
    return () => unsub();
  }, [user, filtroAnno]);

  const filtered = fatture.filter(f => {
    if (filtroTipo !== 'tutti' && f.tipo !== filtroTipo) return false;
    if (filtroStato !== 'tutti' && f.stato !== filtroStato) return false;
    if (filtroSTS && !(f.idoneaSTS && f.stato === 'emessa' && !f.caricatoSTS)) return false;
    return true;
  });

  // STS stats
  const stsStats = useMemo(() => {
    const idonee = fatture.filter(f => f.idoneaSTS && f.stato === 'emessa');
    const esportate = idonee.filter(f => f.inviatoSTS);
    const caricate = idonee.filter(f => f.caricatoSTS);
    const daEsportare = idonee.filter(f => !f.inviatoSTS);
    return { idonee: idonee.length, esportate: esportate.length, caricate: caricate.length, daEsportare: daEsportare.length };
  }, [fatture]);

  const stsDeadline = useMemo(() => getSTSDeadlineInfo(filtroAnno), [filtroAnno]);
  const stsStyle = getUrgenzaStyle(stsDeadline.urgenza);

  const totaleEmesse = fatture.filter(f => f.stato === 'emessa' && f.tipo === 'fattura')
    .reduce((sum, f) => sum + (f.totali?.totaleDocumento || 0), 0);
  const countEmesse = fatture.filter(f => f.stato === 'emessa' && f.tipo === 'fattura').length;
  const daIncassare = fatture
    .filter(f => f.stato === 'emessa' && f.tipo === 'fattura' && f.statoPagamento !== 'pagata')
    .reduce((sum, f) => sum + (f.totali?.nettoAPagare || f.totali?.totaleDocumento || 0), 0);
  const oggi = new Date().toISOString().split('T')[0];
  const countScadute = fatture.filter(f =>
    f.stato === 'emessa' && f.tipo === 'fattura' && f.statoPagamento !== 'pagata'
    && f.dataScadenza && f.dataScadenza < oggi
  ).length;

  function getNomeCliente(f: Fattura): string {
    const c = f.clienteSnapshot;
    if (c.tipo === 'persona_giuridica') return c.ragioneSociale || '';
    return `${c.cognome || ''} ${c.nome || ''}`.trim();
  }

  async function handleExportCommercialistaCSV() {
    setExportingComm(true);
    try {
      const fn = httpsCallable<{ anno: number }, { downloadUrl: string; count: number; csvContent?: string }>(functions, 'exportCommercialistaCSV');
      const result = await fn({ anno: filtroAnno });
      const content = result.data.csvContent ?? '';
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `fatture_${filtroAnno}_commercialista.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Errore export:', err);
      alert('Errore durante l\'export. Riprova.');
    } finally {
      setExportingComm(false);
    }
  }

  async function handleExportSTS() {
    const soloNuove = confirm('Esportare solo le fatture NON ancora incluse in un export STS?\n\nOK = solo nuove\nAnnulla = tutte le idonee');
    setExportingSTS(true);
    try {
      const fn = httpsCallable<
        { anno: number; soloNonInviati?: boolean },
        { downloadUrl: string | null; count: number; message?: string; xmlContent?: string }
      >(functions, 'exportSTSTracked');
      const result = await fn({ anno: filtroAnno, soloNonInviati: soloNuove });
      if (result.data.count === 0) {
        alert(result.data.message || 'Nessuna fattura idonea per STS trovata.');
        return;
      }
      if (result.data.xmlContent) {
        const blob = new Blob([result.data.xmlContent], { type: 'application/xml' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `export_sts_${filtroAnno}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        // Open guided modal instead of alert
        setStsModalData({ count: result.data.count, xmlContent: result.data.xmlContent });
        setStsModalOpen(true);
      }
    } catch (err) {
      console.error('Errore export STS:', err);
      alert('Errore durante l\'export STS. Riprova.');
    } finally {
      setExportingSTS(false);
    }
  }

  async function handleResetSTS(fatturaId: string) {
    if (!confirm('Annullare il flag "Esportata per STS" per questa fattura?\nLa fattura verrà inclusa nel prossimo export STS.')) return;
    setActionLoading(fatturaId);
    try {
      const fn = httpsCallable<{ fatturaId: string }, { success: boolean }>(functions, 'resetInvioSTS');
      await fn({ fatturaId });
    } catch (err) {
      console.error('Errore reset STS:', err);
      alert('Errore. Riprova.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRegeneraUrls(fatturaId: string) {
    try {
      const fn = httpsCallable<{ fatturaId: string }, { xmlUrl: string; pdfUrl: string }>(functions, 'rigeneraDownloadUrls');
      const result = await fn({ fatturaId });
      const response = await fetch(result.data.xmlUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `fattura_${fatturaId}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Errore rigenerazione URL:', err);
      alert('Errore nel download. Riprova.');
    }
  }

  async function handleSegnaComePagata(fatturaId: string) {
    setActionLoading(fatturaId);
    try {
      const fn = httpsCallable<{ fatturaId: string }, { success: boolean; statoPagamento: string }>(functions, 'segnaComePagata');
      await fn({ fatturaId });
    } catch (err) {
      console.error('Errore aggiornamento pagamento:', err);
      alert('Errore. Riprova.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConfirmCaricatoSTS() {
    if (!user) return;
    const fattureToMark = fatture.filter(f => f.idoneaSTS && f.inviatoSTS && !f.caricatoSTS && f.stato === 'emessa');
    for (const f of fattureToMark) {
      const ref = doc(db, 'users', user.uid, 'fatture', f.id);
      await updateDoc(ref, { caricatoSTS: true, caricatoSTSAt: serverTimestamp() });
    }
  }

  async function handleInviaEmail(fattura: Fattura) {
    let email = fattura.clienteSnapshot.email;
    if (!email) {
      const input = prompt('Inserisci l\'indirizzo email del cliente:');
      if (!input) return;
      email = input.trim();
    }
    if (!email) return;

    if (!confirm(`Inviare la fattura n. ${fattura.numeroFormattato} a ${email}?`)) return;

    setActionLoading(fattura.id);
    try {
      const fn = httpsCallable<{ fatturaId: string; emailOverride?: string }, { success: boolean; emailTo: string }>(functions, 'inviaFatturaEmail');
      await fn({ fatturaId: fattura.id, emailOverride: email });
      alert(`Fattura inviata a ${email}`);
    } catch (err) {
      console.error('Errore invio email:', err);
      alert('Errore durante l\'invio email. Riprova.');
    } finally {
      setActionLoading(null);
    }
  }

  const anni = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-4 sm:pb-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">Fatturazione</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Gestisci le tue fatture elettroniche.
            </p>
          </div>
          <div className="flex gap-2 self-start">
            <button onClick={() => navigate('/fatturazione/setup')}
              className="px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-sm">
              Setup
            </button>
            <button onClick={() => navigate('/fatturazione/clienti')}
              className="px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-sm">
              Clienti
            </button>
            <button onClick={() => navigate('/fatturazione/nuova')}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nuova fattura
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Fatture emesse ({filtroAnno})</p>
            <p className="text-2xl font-bold text-gray-900">{countEmesse}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Fatturato ({filtroAnno})</p>
            <p className="text-2xl font-bold text-green-600">{formatEuro(totaleEmesse)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Da incassare</p>
            <p className="text-2xl font-bold text-amber-600">{formatEuro(daIncassare)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Scadute</p>
            <p className={`text-2xl font-bold ${countScadute > 0 ? 'text-red-600' : 'text-gray-400'}`}>{countScadute}</p>
          </div>
        </div>

        {/* STS Dashboard */}
        {stsStats.idonee > 0 && (
          <div className={`${stsStyle.bg} border ${stsStyle.border} rounded-xl p-4 mb-6`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <p className={`text-sm font-semibold ${stsStyle.text} flex items-center gap-2`}>
                  {stsStyle.icon} Sistema Tessera Sanitaria — {stsDeadline.periodoLabel}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs">
                  <span className={stsStyle.text}>
                    <span className="font-medium">{stsStats.idonee}</span> idonee
                  </span>
                  <span className="text-amber-600">
                    <span className="font-medium">{stsStats.esportate}</span> esportate
                  </span>
                  <span className="text-green-600">
                    <span className="font-medium">{stsStats.caricate}</span> caricate su portale
                  </span>
                  {stsStats.daEsportare > 0 && (
                    <span className="text-red-600 font-medium">
                      {stsStats.daEsportare} da esportare
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-1 ${stsStyle.text} opacity-75`}>
                  {stsDeadline.urgenza === 'scaduto'
                    ? `Scadenza superata il ${stsDeadline.deadline}`
                    : `Scadenza invio: ${stsDeadline.deadline} (${stsDeadline.giorniRimanenti} giorni)`
                  }
                </p>
              </div>
              <div className="flex gap-2">
                {stsStats.daEsportare > 0 && (
                  <button onClick={handleExportSTS} disabled={exportingSTS}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                    {exportingSTS ? 'Export...' : `Esporta ${stsStats.daEsportare} nuove`}
                  </button>
                )}
                <button onClick={() => setFiltroSTS(!filtroSTS)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    filtroSTS ? 'bg-blue-600 text-white' : 'bg-white/70 text-gray-700 hover:bg-white'
                  }`}>
                  {filtroSTS ? 'Mostra tutte' : 'Solo da inviare STS'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filtri */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Anno</label>
              <select value={filtroAnno} onChange={e => setFiltroAnno(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                {anni.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="tutti">Tutti</option>
                <option value="fattura">Fatture</option>
                <option value="proforma">Proforma</option>
                <option value="nota_credito">Note di credito</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stato</label>
              <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="tutti">Tutti</option>
                <option value="emessa">Emesse</option>
                <option value="bozza">Bozze</option>
              </select>
            </div>

            <div className="flex-1" />

            {/* Export buttons */}
            <div className="flex gap-2">
              <button onClick={handleExportSTS} disabled={exportingSTS}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition">
                {exportingSTS ? 'Export...' : 'Export STS XML'}
              </button>
              <button onClick={handleExportCommercialistaCSV} disabled={exportingComm}
                className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition">
                {exportingComm ? 'Export...' : 'Export Commercialista'}
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
                <div className="flex justify-between"><div className="h-5 bg-gray-200 rounded w-1/4" /><div className="h-5 bg-gray-200 rounded w-16" /></div>
                <div className="h-4 bg-gray-100 rounded w-1/2 mt-2" />
              </div>
            ))}
          </div>
        )}

        {/* Lista fatture */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(f => {
              const nomeCliente = getNomeCliente(f);
              const tipoLabel = f.tipo === 'nota_credito' ? 'Nota Credito' : f.tipo === 'proforma' ? 'Proforma' : 'Fattura';
              const tipoColor = f.tipo === 'nota_credito' ? 'bg-red-100 text-red-700'
                : f.tipo === 'proforma' ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700';
              const statoColor = f.stato === 'emessa' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';

              // Payment status
              const isScaduta = f.stato === 'emessa' && f.statoPagamento !== 'pagata' && f.dataScadenza && f.dataScadenza < oggi;
              const pagamentoColor = f.statoPagamento === 'pagata' ? 'bg-green-100 text-green-700'
                : isScaduta ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-500';
              const pagamentoLabel = f.statoPagamento === 'pagata' ? 'Pagata'
                : isScaduta ? 'Scaduta' : 'Non pagata';

              const isLoading = actionLoading === f.id;

              return (
                <div key={f.id} className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tipoColor}`}>{tipoLabel}</span>
                        <h3 className="font-semibold text-gray-900">N. {f.numeroFormattato}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statoColor}`}>{f.stato}</span>
                        {f.idoneaSTS && f.stato === 'emessa' && (
                          f.caricatoSTS
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700" title="Caricata sul portale Sistema TS">STS ✓</span>
                            : f.inviatoSTS
                              ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title="XML esportato, da caricare sul portale STS">STS esportata</span>
                              : <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700" title="Idonea per Sistema Tessera Sanitaria">STS</span>
                        )}
                        {f.stato === 'emessa' && f.tipo !== 'proforma' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${pagamentoColor}`}>{pagamentoLabel}</span>
                        )}
                        {f.emailInviataAt && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" title={`Inviata a ${f.emailInviataA || ''}`}>Email inviata</span>
                        )}
                        {f.stato === 'emessa' && f.canale === 'cartacea' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title="No SDI — prestazione sanitaria a persona fisica">Cartacea</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {nomeCliente} · {f.dataEmissione} · <span className="font-medium text-gray-700">{formatEuro(f.totali?.totaleDocumento || 0)}</span>
                        {f.dataScadenza && f.statoPagamento !== 'pagata' && (
                          <span className={`ml-2 ${isScaduta ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            · scad. {f.dataScadenza}
                          </span>
                        )}
                        {f.dataPagamento && (
                          <span className="ml-2 text-green-600">· pagata il {f.dataPagamento}</span>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 self-end sm:self-center flex-wrap">
                      {f.stato === 'emessa' && f.xmlUrl && (
                        <a href={f.xmlUrl} target="_blank" rel="noopener noreferrer"
                          title="Scarica il file XML FatturaPA (per caricare su Fatture e Corrispettivi o archivio)"
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded transition">
                          XML
                        </a>
                      )}
                      {f.stato === 'emessa' && f.pdfUrl && (
                        <a href={f.pdfUrl} target="_blank" rel="noopener noreferrer"
                          title="Apri o scarica il PDF della fattura"
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded transition">
                          PDF
                        </a>
                      )}
                      {f.stato === 'emessa' && !f.xmlUrl && f.canale !== 'cartacea' && (
                        <button onClick={() => handleRegeneraUrls(f.id)}
                          title="Rigenera i link di download se scaduti"
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded transition">
                          Rigenera link
                        </button>
                      )}
                      {f.stato === 'emessa' && f.tipo !== 'proforma' && (
                        <button onClick={() => handleSegnaComePagata(f.id)} disabled={isLoading}
                          title={f.statoPagamento === 'pagata' ? 'Segna come non pagata' : 'Segna come pagata'}
                          className={`text-xs font-medium px-2 py-1 rounded-full border transition flex items-center gap-1.5 ${
                            f.statoPagamento === 'pagata'
                              ? 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
                              : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                          } disabled:opacity-50`}>
                          {isLoading ? '...' : (
                            <>
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                f.statoPagamento === 'pagata' ? 'bg-green-500' : 'bg-gray-300'
                              }`} />
                              {f.statoPagamento === 'pagata' ? 'Pagata' : 'Non pagata'}
                            </>
                          )}
                        </button>
                      )}
                      {f.stato === 'emessa' && f.pdfUrl && (
                        <button onClick={() => handleInviaEmail(f)} disabled={isLoading}
                          title="Invia la fattura PDF via email al paziente"
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 hover:bg-indigo-50 rounded transition disabled:opacity-50">
                          {isLoading ? '...' : 'Invia al paziente'}
                        </button>
                      )}
                      {f.stato === 'emessa' && f.tipo === 'fattura' && (
                        <button onClick={() => navigate(`/fatturazione/nuova?notaCredito=${f.id}`)}
                          title="Crea una nota di credito per stornare questa fattura"
                          className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 hover:bg-red-50 rounded transition">
                          Nota credito
                        </button>
                      )}
                      {f.stato === 'emessa' && f.idoneaSTS && f.inviatoSTS && (
                        <button onClick={() => handleResetSTS(f.id)} disabled={isLoading}
                          className="text-xs text-amber-600 hover:text-amber-800 font-medium px-2 py-1 hover:bg-amber-50 rounded transition disabled:opacity-50">
                          {isLoading ? '...' : '↩ Reset STS'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && fatture.length === 0 && (
          <div className="text-center py-16">
            <div className="mb-4 text-6xl">📄</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Nessuna fattura</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Inizia a emettere fatture elettroniche per i tuoi pazienti.
            </p>
            <button onClick={() => navigate('/fatturazione/nuova')}
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
              Crea la prima fattura
            </button>
          </div>
        )}

        {!loading && fatture.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Nessuna fattura trovata con i filtri selezionati.</p>
          </div>
        )}
      </div>

      {/* STS Export Success Modal */}
      {stsModalData && (
        <STSExportSuccessModal
          isOpen={stsModalOpen}
          onClose={() => setStsModalOpen(false)}
          count={stsModalData.count}
          anno={filtroAnno}
          xmlContent={stsModalData.xmlContent}
          onConfirmCaricato={handleConfirmCaricatoSTS}
        />
      )}

      <Footer />
    </div>
  );
}
