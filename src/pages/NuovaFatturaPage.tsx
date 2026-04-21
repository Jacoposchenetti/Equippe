import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, doc, getDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { calcolaTotali, formatEuro, getDicituraBollo, getDicituraForfettario, getDicituraNoRitenutaForfettario, getDicituraEsenzioneIva, type CalcoloInput } from '@/lib/calcoloFiscale';
import { getConfigFiscale, getPrestazioniProfessione } from '@/lib/configFiscaleProfessioni';

interface Cliente {
  id: string;
  tipo: 'persona_fisica' | 'persona_giuridica';
  nome?: string;
  cognome?: string;
  ragioneSociale?: string;
  codiceFiscale: string;
  partitaIva?: string;
  indirizzo: string;
  cap: string;
  città: string;
  provincia: string;
  nazione?: string;
  email?: string;
  opposizioneSTS: boolean;
  codiceDestinatario?: string;
  pec?: string;
}

interface Riga {
  id: string;
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  aliquotaIva: number;
  naturaEsenzione?: string;
  sanitaria?: boolean;
}

type Step = 'cliente' | 'prestazioni' | 'riepilogo';

export default function NuovaFatturaPage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Nota di credito: pre-fill from referenced fattura
  const notaCreditoId = searchParams.get('notaCredito');

  const [step, setStep] = useState<Step>('cliente');
  const [tipo, setTipo] = useState<'fattura' | 'proforma' | 'nota_credito'>(notaCreditoId ? 'nota_credito' : 'fattura');
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Riferimento fattura originale (per nota di credito)
  const [fatturaRiferimentoId, setFatturaRiferimentoId] = useState<string | null>(notaCreditoId);
  const [fatturaRiferimentoNumero, setFatturaRiferimentoNumero] = useState<string | null>(null);

  // Step 1: Cliente
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');

  // Step 2: Prestazioni
  const [righe, setRighe] = useState<Riga[]>([]);
  const [note, setNote] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('Bonifico bancario');
  const [dataEmissione, setDataEmissione] = useState(() => new Date().toISOString().split('T')[0]);
  const [dataScadenza, setDataScadenza] = useState('');

  // Config
  const [configData, setConfigData] = useState<any>(null);
  const [prestazioniPreconfigurate, setPrestazioniPreconfigurate] = useState<{ descrizione: string; prezzo: number; sanitaria?: boolean; }[]>([]);

  useEffect(() => {
    if (!user) return;

    // Load clienti
    const q = query(collection(db, 'users', user.uid, 'clienti'), orderBy('cognome', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setClienti(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cliente)));
    });

    // Load config
    getDoc(doc(db, 'users', user.uid, 'fatturazione_config', 'config')).then(snap => {
      if (snap.exists()) {
        setConfigData(snap.data());
      } else {
        navigate('/fatturazione/setup');
      }
    });

    // Load prestazioni preconfigurate dalla professione
    const professione = userProfile?.profile?.specializzazioni?.[0];
    if (professione) {
      const prestazioni = getPrestazioniProfessione(professione);
      setPrestazioniPreconfigurate(prestazioni.map(p => ({ descrizione: p.descrizione, prezzo: p.prezzoDefault, sanitaria: p.sanitaria })));
    }

    return () => unsub();
  }, [user, userProfile]);

  // Load referenced fattura for nota di credito
  useEffect(() => {
    if (!user || !notaCreditoId) return;
    getDoc(doc(db, 'users', user.uid, 'fatture', notaCreditoId)).then(snap => {
      if (!snap.exists()) return;
      const f = snap.data();
      setFatturaRiferimentoNumero(f.numeroFormattato || `${f.numero}/${f.anno}`);
      setSelectedClienteId(f.clienteId);
      setRighe((f.righe || []).map((r: any) => ({
        id: crypto.randomUUID(),
        descrizione: r.descrizione,
        quantita: r.quantita,
        prezzoUnitario: r.prezzoUnitario,
        aliquotaIva: r.aliquotaIva || 0,
        naturaEsenzione: r.naturaEsenzione,
        sanitaria: r.sanitaria ?? true,
      })));
      setMetodoPagamento(f.metodoPagamento || 'Bonifico bancario');
      setNote(`Nota di credito per fattura n. ${f.numeroFormattato || f.numero + '/' + f.anno}`);
      // Skip to riepilogo step since everything is pre-filled
      setStep('prestazioni');
    });
  }, [user, notaCreditoId]);

  const selectedCliente = clienti.find(c => c.id === selectedClienteId);

  const filteredClienti = clienti.filter(c => {
    if (!clienteSearch) return true;
    const q = clienteSearch.toLowerCase();
    const nome = c.tipo === 'persona_giuridica' ? c.ragioneSociale || '' : `${c.nome || ''} ${c.cognome || ''}`;
    return nome.toLowerCase().includes(q) || c.codiceFiscale.toLowerCase().includes(q);
  });

  // Calcolo totali in tempo reale
  const totali = useMemo(() => {
    if (!configData || righe.length === 0) return null;

    const isForfettario = configData.regimeFiscale === 'forfettario';
    const isAzienda = selectedCliente?.tipo === 'persona_giuridica';
    const professione = userProfile?.profile?.specializzazioni?.[0] || '';
    const configFiscale = getConfigFiscale(professione);

    const input: CalcoloInput = {
      righe: righe.map(r => ({
        id: r.id,
        descrizione: r.descrizione,
        quantita: r.quantita,
        prezzoUnitario: r.prezzoUnitario,
        aliquotaIva: isForfettario ? 0 : r.aliquotaIva,
        naturaEsenzione: isForfettario ? 'N2.2' : r.naturaEsenzione,
      })),
      configFiscale,
      regimeFiscale: configData.regimeFiscale,
      tipoCliente: isAzienda ? 'persona_giuridica' : 'persona_fisica',
      applicaCassa: !!configData.cassaPrevidenziale,
      // Usa aliquota dalla config utente (priorità assoluta sulla mappa professione)
      cassaAliquota: configData.cassaPrevidenziale?.aliquota,
    };

    return calcolaTotali(input);
  }, [righe, configData, selectedCliente]);

  // Canale emissione: cartacea (no SDI) se prestazioni sanitarie a persona fisica
  const canaleEmissione: 'cartacea' | 'sdi' = (
    selectedCliente?.tipo === 'persona_fisica' && righe.some(r => r.sanitaria)
  ) ? 'cartacea' : 'sdi';

  function addRiga(template?: { descrizione: string; prezzo: number; sanitaria?: boolean }) {
    const isForfettario = configData?.regimeFiscale === 'forfettario';
    const sanitaria = template?.sanitaria ?? true; // default sanitaria per professioni sanitarie
    setRighe([...righe, {
      id: crypto.randomUUID(),
      descrizione: template?.descrizione || '',
      quantita: 1,
      prezzoUnitario: template?.prezzo || 0,
      aliquotaIva: isForfettario ? 0 : (sanitaria ? 0 : 22),
      naturaEsenzione: isForfettario ? 'N2.2' : (sanitaria ? 'N4' : undefined),
      sanitaria,
    }]);
  }

  function updateRiga(index: number, field: keyof Riga, value: any) {
    setRighe(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  function removeRiga(index: number) {
    setRighe(prev => prev.filter((_, i) => i !== index));
  }

  async function handleEmetti() {
    if (!user || !selectedCliente || !totali || !configData) return;

    setSaving(true);
    try {
      const fatturaData = {
        tipo,
        dataEmissione,
        dataScadenza: dataScadenza || null,
        clienteId: selectedClienteId,
        clienteSnapshot: {
          tipo: selectedCliente.tipo,
          nome: selectedCliente.nome,
          cognome: selectedCliente.cognome,
          ragioneSociale: selectedCliente.ragioneSociale,
          codiceFiscale: selectedCliente.codiceFiscale,
          partitaIva: selectedCliente.partitaIva,
          indirizzo: selectedCliente.indirizzo,
          cap: selectedCliente.cap,
          città: selectedCliente.città,
          provincia: selectedCliente.provincia,
          nazione: selectedCliente.nazione || 'IT',
          email: selectedCliente.email,
          opposizioneSTS: selectedCliente.opposizioneSTS,
          codiceDestinatario: selectedCliente.codiceDestinatario,
          pec: selectedCliente.pec,
        },
        righe,
        totali,
        metodoPagamento,
        ibanPagamento: configData.iban,
        note: note || null,
        // Prestazioni sanitarie a persona fisica: divieto SDI (art.10-bis DL 119/2018)
        // canale 'cartacea' = solo PDF, canale 'sdi' = FatturaPA XML a SDI
        canale: (selectedCliente.tipo === 'persona_fisica' && righe.some(r => r.sanitaria))
          ? 'cartacea' : 'sdi',
        idoneaSTS: tipo !== 'nota_credito' && selectedCliente.tipo === 'persona_fisica' && righe.some(r => r.sanitaria) && !selectedCliente.opposizioneSTS,
        fatturaRiferimentoId: fatturaRiferimentoId || null,
        fatturaRiferimentoNumero: fatturaRiferimentoNumero || null,
      };

      // Numerazione atomica via Cloud Function
      const creaFatturaBozzaFn = httpsCallable<
        { fatturaData: any },
        { success: boolean; fatturaId: string; numero: number; numeroFormattato: string }
      >(functions, 'creaFatturaBozza');
      const result = await creaFatturaBozzaFn({ fatturaData });
      const fatturaId = result.data.fatturaId;

      if (tipo === 'fattura' || tipo === 'nota_credito') {
        // Emetti: genera XML/PDF
        const emettiFatturaFn = httpsCallable(functions, 'emettiFattura');
        await emettiFatturaFn({ fatturaId });
      }

      navigate('/fatturazione');
    } catch (err) {
      console.error('Errore emissione fattura:', err);
      alert('Errore durante l\'emissione. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAnteprimaPDF() {
    if (!totali || !configData || !selectedCliente) return;
    setPreviewing(true);
    try {
      const isForfettario = configData.regimeFiscale === 'forfettario';
      const fatturaData = {
        tipo,
        dataEmissione,
        dataScadenza: dataScadenza || null,
        righe: righe.map(r => ({
          ...r,
          aliquotaIva: isForfettario ? 0 : r.aliquotaIva,
          naturaEsenzione: isForfettario ? 'N2.2' : r.naturaEsenzione,
        })),
        totali,
        clienteSnapshot: {
          tipo: selectedCliente.tipo,
          nome: selectedCliente.nome,
          cognome: selectedCliente.cognome,
          ragioneSociale: selectedCliente.ragioneSociale,
          codiceFiscale: selectedCliente.codiceFiscale,
          partitaIva: selectedCliente.partitaIva,
          indirizzo: selectedCliente.indirizzo,
          cap: selectedCliente.cap,
          città: selectedCliente.città,
          provincia: selectedCliente.provincia,
          nazione: selectedCliente.nazione || 'IT',
        },
        metodoPagamento,
        ibanPagamento: configData.iban,
        note: note || null,
        fatturaRiferimentoNumero: fatturaRiferimentoNumero || null,
      };

      const fn = httpsCallable<{ fatturaData: any }, { success: boolean; pdfBase64: string }>(functions, 'anteprimaFatturaPDF');
      const result = await fn({ fatturaData });

      // Convert base64 to blob and open in new tab
      const byteCharacters = atob(result.data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Errore anteprima PDF:', err);
      alert('Errore durante la generazione anteprima. Riprova.');
    } finally {
      setPreviewing(false);
    }
  }

  // Diciture obbligatorie per legge
  const diciture: string[] = [];
  if (configData?.regimeFiscale === 'forfettario') {
    diciture.push(getDicituraForfettario());
    diciture.push(getDicituraNoRitenutaForfettario());
  }
  if (totali?.bolloVirtuale && totali.bolloVirtuale > 0) {
    diciture.push(getDicituraBollo(totali.bolloVirtuale) ?? '');
  }
  if (righe.some(r => r.naturaEsenzione === 'N4') && configData?.regimeFiscale !== 'forfettario') {
    diciture.push(getDicituraEsenzioneIva());
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-4 sm:pb-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <button onClick={() => navigate('/fatturazione')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Fatture
          </button>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">
            {tipo === 'nota_credito' ? 'Nuova Nota di Credito' : tipo === 'proforma' ? 'Nuova Proforma' : 'Nuova Fattura'}
          </h1>
          {fatturaRiferimentoNumero && (
            <p className="text-sm text-red-600 font-medium mb-2">
              Riferimento fattura n. {fatturaRiferimentoNumero}
            </p>
          )}
          {!notaCreditoId && (
            <div className="flex gap-3 mt-3">
              <button onClick={() => setTipo('fattura')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${tipo === 'fattura' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Fattura
              </button>
              <button onClick={() => setTipo('proforma')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${tipo === 'proforma' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Proforma
              </button>
            </div>
          )}
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(['cliente', 'prestazioni', 'riepilogo'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${step === s || (['prestazioni', 'riepilogo'].indexOf(step) >= i) ? 'bg-blue-400' : 'bg-gray-300'}`} />}
              <button onClick={() => {
                if (s === 'cliente') setStep('cliente');
                if (s === 'prestazioni' && selectedClienteId) setStep('prestazioni');
                if (s === 'riepilogo' && righe.length > 0) setStep('riepilogo');
              }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition ${step === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {i + 1}. {s === 'cliente' ? 'Cliente' : s === 'prestazioni' ? 'Prestazioni' : 'Riepilogo'}
              </button>
            </div>
          ))}
        </div>

        {/* STEP 1: Seleziona Cliente */}
        {step === 'cliente' && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Seleziona cliente</h2>

            <input type="text" value={clienteSearch} onChange={e => setClienteSearch(e.target.value)}
              placeholder="Cerca per nome o CF..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4" />

            {filteredClienti.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-3">Nessun cliente trovato.</p>
                <button onClick={() => navigate('/fatturazione/clienti')}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                  Aggiungi un cliente →
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredClienti.map(c => {
                const nome = c.tipo === 'persona_giuridica'
                  ? c.ragioneSociale || ''
                  : `${c.cognome || ''} ${c.nome || ''}`.trim();
                const selected = selectedClienteId === c.id;

                return (
                  <button key={c.id} onClick={() => setSelectedClienteId(c.id)}
                    className={`w-full text-left p-3 rounded-lg border transition ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                    <p className="font-medium text-gray-900">{nome}</p>
                    <p className="text-sm text-gray-500">CF: {c.codiceFiscale} · {c.città} ({c.provincia})</p>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={() => navigate('/fatturazione')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
                Annulla
              </button>
              <button onClick={() => setStep('prestazioni')} disabled={!selectedClienteId}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-semibold">
                Avanti →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Prestazioni */}
        {step === 'prestazioni' && (
          <div className="space-y-4">
            {/* Data emissione */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data emissione</label>
                  <input type="date" value={dataEmissione} onChange={e => setDataEmissione(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza pagamento</label>
                  <input type="date" value={dataScadenza} onChange={e => setDataScadenza(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metodo di pagamento</label>
                  <select value={metodoPagamento} onChange={e => setMetodoPagamento(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option>Bonifico bancario</option>
                    <option>Contanti</option>
                    <option>Carta di pagamento</option>
                    <option>Assegno</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quick add prestazioni */}
            {prestazioniPreconfigurate.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Aggiungi prestazione rapida</h3>
                <div className="flex flex-wrap gap-2">
                  {prestazioniPreconfigurate.map((p, i) => (
                    <button key={i} onClick={() => addRiga(p)}
                      className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition">
                      {p.descrizione} ({formatEuro(p.prezzo)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Righe fattura */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Prestazioni</h2>
                <button onClick={() => addRiga()}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Aggiungi riga
                </button>
              </div>

              {righe.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">Nessuna prestazione aggiunta</p>
              )}

              <div className="space-y-3">
                {righe.map((riga, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 relative">
                    <button onClick={() => removeRiga(i)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Descrizione</label>
                        <input type="text" value={riga.descrizione} onChange={e => updateRiga(i, 'descrizione', e.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500" placeholder="Seduta individuale" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Quantità</label>
                        <input type="number" min={1} value={riga.quantita} onChange={e => updateRiga(i, 'quantita', parseInt(e.target.value) || 1)}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Prezzo (€)</label>
                        <input type="number" min={0} step={0.01} value={riga.prezzoUnitario}
                          onChange={e => updateRiga(i, 'prezzoUnitario', parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="mt-2 text-right text-sm font-medium text-gray-600">
                      Subtotale: {formatEuro(riga.quantita * riga.prezzoUnitario)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Anteprima totali */}
            {totali && (
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Riepilogo importi</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Imponibile</span><span>{formatEuro(totali.imponibile)}</span></div>
                  {totali.cassaPrevidenziale > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">Cassa prev.</span><span>{formatEuro(totali.cassaPrevidenziale)}</span></div>
                  )}
                  {totali.totaleIva > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">IVA</span><span>{formatEuro(totali.totaleIva)}</span></div>
                  )}
                  {totali.bolloVirtuale > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">Bollo</span><span>{formatEuro(totali.bolloVirtuale)}</span></div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2 mt-2">
                    <span>Totale documento</span><span>{formatEuro(totali.totaleDocumento)}</span>
                  </div>
                  {totali.ritenuataAcconto > 0 && (
                    <>
                      <div className="flex justify-between text-gray-500"><span>Ritenuta d'acconto</span><span>- {formatEuro(totali.ritenuataAcconto)}</span></div>
                      <div className="flex justify-between font-bold"><span>Netto a pagare</span><span>{formatEuro(totali.nettoAPagare)}</span></div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Note */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (opzionali)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep('cliente')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
                ← Indietro
              </button>
              <button onClick={() => setStep('riepilogo')} disabled={righe.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-semibold">
                Avanti →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Riepilogo */}
        {step === 'riepilogo' && (!selectedCliente || !totali) && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center">
            <p className="text-gray-500 mb-2">
              {!selectedCliente ? 'Nessun cliente selezionato.' : 'Nessuna prestazione aggiunta o configurazione mancante.'}
            </p>
            <button onClick={() => setStep(!selectedCliente ? 'cliente' : 'prestazioni')}
              className="text-blue-600 hover:text-blue-800 font-medium text-sm">
              ← Torna {!selectedCliente ? 'alla selezione cliente' : 'alle prestazioni'}
            </button>
          </div>
        )}
        {step === 'riepilogo' && selectedCliente && totali && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Riepilogo {tipo === 'proforma' ? 'proforma' : 'fattura'}</h2>

              {/* Cliente */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Cliente</p>
                <p className="text-sm text-gray-600">
                  {selectedCliente.tipo === 'persona_giuridica'
                    ? selectedCliente.ragioneSociale
                    : `${selectedCliente.nome} ${selectedCliente.cognome}`}
                  {' · CF: '}{selectedCliente.codiceFiscale}
                </p>
              </div>

              {/* Righe */}
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">Descrizione</th>
                    <th className="pb-2 text-right">Qtà</th>
                    <th className="pb-2 text-right">Prezzo</th>
                    <th className="pb-2 text-right">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2">{r.descrizione}</td>
                      <td className="py-2 text-right">{r.quantita}</td>
                      <td className="py-2 text-right">{formatEuro(r.prezzoUnitario)}</td>
                      <td className="py-2 text-right font-medium">{formatEuro(r.quantita * r.prezzoUnitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totali */}
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Imponibile</span><span>{formatEuro(totali.imponibile)}</span></div>
                {totali.cassaPrevidenziale > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Cassa previdenziale</span><span>{formatEuro(totali.cassaPrevidenziale)}</span></div>
                )}
                {totali.totaleIva > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-gray-500">IVA</span><span>{formatEuro(totali.totaleIva)}</span></div>
                )}
                {totali.bolloVirtuale > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Bollo virtuale</span><span>{formatEuro(totali.bolloVirtuale)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                  <span>Totale documento</span><span>{formatEuro(totali.totaleDocumento)}</span>
                </div>
                {totali.ritenuataAcconto > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Ritenuta d'acconto (20%)</span><span>- {formatEuro(totali.ritenuataAcconto)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base">
                      <span>Netto a pagare</span><span>{formatEuro(totali.nettoAPagare)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Diciture */}
              {diciture.length > 0 && (
                <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                  {diciture.map((d, i) => (
                    <p key={i} className="text-xs text-gray-500 italic mb-1">{d}</p>
                  ))}
                </div>
              )}

              {/* Info canale emissione */}
              {tipo === 'nota_credito' ? (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <p className="font-medium mb-1">Nota di Credito:</p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    <li>Verrà generato il file XML FatturaPA di tipo TD04 (Nota di Credito)</li>
                    <li>Riferimento: fattura n. <strong>{fatturaRiferimentoNumero}</strong></li>
                    <li>Carica il file XML su <strong>Fatture e Corrispettivi</strong> (portale AdE)</li>
                  </ul>
                </div>
              ) : tipo === 'proforma' ? (
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  <p className="font-medium mb-1">Proforma:</p>
                  <p className="text-xs">La proforma non ha valore fiscale. Potrai convertirla in fattura successivamente.</p>
                </div>
              ) : canaleEmissione === 'cartacea' ? (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <p className="font-medium mb-1">Fattura cartacea (prestazione sanitaria):</p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    <li>Verrà generato solo il <strong>PDF</strong> — <strong>non va inviata allo SDI</strong> (art. 10-bis DL 119/2018)</li>
                    <li>Invia il PDF al paziente via email o stampa</li>
                    <li>Trasmetti i dati al <strong>Sistema Tessera Sanitaria</strong> con l'export XML (sezione Fatture)</li>
                    <li>La fattura non potrà più essere modificata dopo l'emissione</li>
                  </ul>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <p className="font-medium mb-1">Fattura elettronica (SDI):</p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    <li>Verrà generato il file <strong>XML FatturaPA</strong> da scaricare</li>
                    <li>Carica il file XML su <strong>Fatture e Corrispettivi</strong> (portale AdE) per inviarlo allo SDI</li>
                    <li>La fattura non potrà più essere modificata dopo l'emissione</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep('prestazioni')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
                ← Modifica
              </button>
              <div className="flex gap-2">
                <button onClick={handleAnteprimaPDF} disabled={previewing || saving}
                  className="px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition text-sm font-semibold flex items-center gap-2">
                  {previewing ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generazione...
                    </>
                  ) : 'Anteprima PDF'}
                </button>
                <button onClick={handleEmetti} disabled={saving || previewing}
                  className={`px-6 py-2.5 text-white rounded-lg disabled:opacity-50 transition text-sm font-semibold flex items-center gap-2 ${
                    tipo === 'nota_credito' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                  }`}>
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Emissione in corso...
                    </>
                  ) : (
                    tipo === 'nota_credito' ? '📋 Emetti nota di credito'
                    : tipo === 'fattura' ? '✅ Emetti fattura' : '📋 Salva proforma'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
