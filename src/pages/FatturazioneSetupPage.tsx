import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useNavigate } from 'react-router-dom';

const REGIMI_FISCALI = [
  { value: 'forfettario', label: 'Regime forfettario (L. 190/2014)' },
  { value: 'ordinario', label: 'Regime ordinario' },
  { value: 'semplificato', label: 'Regime semplificato' },
];

const CASSE_PREVIDENZIALI = [
  { value: 'ENPAP', codice: 'TC22', aliquota: 2, label: 'ENPAP - Psicologi (2%)' },
  { value: 'ENPAM', codice: 'TC01', aliquota: 2, label: 'ENPAM - Medici (2%)' },
  { value: 'ENPAB', codice: 'TC07', aliquota: 4, label: 'ENPAB - Biologi (4%)' },
  { value: 'nessuna', codice: '', aliquota: 0, label: 'Nessuna cassa previdenziale' },
];

export default function FatturazioneSetupPage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configExists, setConfigExists] = useState(false);

  // Form fields
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [partitaIva, setPartitaIva] = useState('');
  const [regimeFiscale, setRegimeFiscale] = useState('forfettario');
  const [cassaPrevidenziale, setCassaPrevidenziale] = useState('ENPAP');
  const [indirizzo, setIndirizzo] = useState('');
  const [cap, setCap] = useState('');
  const [citta, setCitta] = useState('');
  const [provincia, setProvincia] = useState('');
  const [emailFatturazione, setEmailFatturazione] = useState('');
  const [iban, setIban] = useState('');
  const [pec, setPec] = useState('');
  const [codiceDestinatario, setCodiceDestinatario] = useState('0000000');

  useEffect(() => {
    if (!user) return;
    loadConfig();
  }, [user]);

  async function loadConfig() {
    try {
      const configRef = doc(db, 'users', user!.uid, 'fatturazione_config', 'config');
      const snap = await getDoc(configRef);
      if (snap.exists()) {
        const data = snap.data();
        setConfigExists(true);
        setNome(data.nome || '');
        setCognome(data.cognome || '');
        setCodiceFiscale(data.codiceFiscale || '');
        setPartitaIva(data.partitaIva || '');
        setRegimeFiscale(data.regimeFiscale || 'forfettario');
        setCassaPrevidenziale(data.cassaPrevidenziale?.nome || 'ENPAP');
        setIndirizzo(data.indirizzo || '');
        setCap(data.cap || '');
        setCitta(data.città || '');
        setProvincia(data.provincia || '');
        setEmailFatturazione(data.emailFatturazione || '');
        setIban(data.iban || '');
        setPec(data.pec || '');
        setCodiceDestinatario(data.codiceDestinatario || '0000000');
      } else {
        // Pre-fill from profile
        const profile = userProfile?.profile;
        if (profile) {
          const parts = (profile.nome || '').split(' ');
          setNome(parts[0] || '');
          setCognome(parts.slice(1).join(' ') || '');
          setEmailFatturazione(user?.email || '');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!nome || !cognome || !codiceFiscale || !partitaIva || !indirizzo || !cap || !citta || !provincia) {
      alert('Compila tutti i campi obbligatori.');
      return;
    }

    if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(codiceFiscale)) {
      alert('Codice fiscale non valido.');
      return;
    }

    if (!/^\d{11}$/.test(partitaIva)) {
      alert('Partita IVA deve essere di 11 cifre.');
      return;
    }

    setSaving(true);
    try {
      const cassaInfo = CASSE_PREVIDENZIALI.find(c => c.value === cassaPrevidenziale);

      const configData = {
        nome,
        cognome,
        codiceFiscale: codiceFiscale.toUpperCase(),
        partitaIva,
        regimeFiscale,
        cassaPrevidenziale: cassaPrevidenziale !== 'nessuna' ? {
          nome: cassaInfo!.value,
          codice: cassaInfo!.codice,
          aliquota: cassaInfo!.aliquota,
        } : null,
        indirizzo,
        cap,
        città: citta,
        provincia: provincia.toUpperCase(),
        nazione: 'IT',
        emailFatturazione,
        iban: iban || null,
        pec: pec || null,
        codiceDestinatario,
        // Numerazione progressiva
        prossimoNumeroFattura: 1,
        prossimoNumeroProforma: 1,
        prossimoNumeroNotaCredito: 1,
        updatedAt: new Date(),
      };

      const configRef = doc(db, 'users', user.uid, 'fatturazione_config', 'config');
      await setDoc(configRef, configData, { merge: true });

      setConfigExists(true);
      navigate('/fatturazione');
    } catch (err) {
      console.error('Errore salvataggio config:', err);
      alert('Errore nel salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-4 sm:pb-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-4 sm:pb-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">
            {configExists ? 'Impostazioni Fatturazione' : 'Configura Fatturazione'}
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            {configExists
              ? 'Modifica i tuoi dati fiscali per la fatturazione elettronica.'
              : 'Inserisci i tuoi dati fiscali per iniziare a emettere fatture elettroniche.'}
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Dati anagrafici */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Dati anagrafici</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
                <input type="text" value={cognome} onChange={e => setCognome(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale *</label>
                <input type="text" value={codiceFiscale} onChange={e => setCodiceFiscale(e.target.value.toUpperCase())} required maxLength={16}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase" placeholder="RSSMRA80A01H501U" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partita IVA *</label>
                <input type="text" value={partitaIva} onChange={e => setPartitaIva(e.target.value.replace(/\D/g, '').slice(0, 11))} required maxLength={11}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="01234567890" />
              </div>
            </div>
          </div>

          {/* Regime e Cassa */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Regime fiscale e cassa previdenziale</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regime fiscale *</label>
                <select value={regimeFiscale} onChange={e => setRegimeFiscale(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  {REGIMI_FISCALI.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cassa previdenziale</label>
                <select value={cassaPrevidenziale} onChange={e => setCassaPrevidenziale(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  {CASSE_PREVIDENZIALI.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {regimeFiscale === 'forfettario' && (
              <p className="text-xs text-amber-600 mt-3">
                Regime forfettario: le fatture saranno emesse senza IVA con dicitura art. 1 c.54-89 L.190/2014
              </p>
            )}
          </div>

          {/* Sede */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Sede legale / domicilio fiscale</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo *</label>
                <input type="text" value={indirizzo} onChange={e => setIndirizzo(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Via Roma, 1" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CAP *</label>
                  <input type="text" value={cap} onChange={e => setCap(e.target.value.replace(/\D/g, '').slice(0, 5))} required maxLength={5}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Città *</label>
                  <input type="text" value={citta} onChange={e => setCitta(e.target.value)} required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prov. *</label>
                  <input type="text" value={provincia} onChange={e => setProvincia(e.target.value.toUpperCase().slice(0, 2))} required maxLength={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase" placeholder="MI" />
                </div>
              </div>
            </div>
          </div>

          {/* Contatti e pagamento */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Contatti e pagamento</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email fatturazione</label>
                <input type="email" value={emailFatturazione} onChange={e => setEmailFatturazione(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PEC</label>
                <input type="email" value={pec} onChange={e => setPec(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                <input type="text" value={iban} onChange={e => setIban(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase" placeholder="IT60X0542811101000000123456" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice Destinatario SDI</label>
                <input type="text" value={codiceDestinatario} onChange={e => setCodiceDestinatario(e.target.value.toUpperCase().slice(0, 7))} maxLength={7}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase" />
                <p className="text-xs text-gray-500 mt-1">Il tuo codice destinatario per ricevere fatture (default: 0000000)</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
              {saving ? 'Salvataggio...' : configExists ? 'Salva modifiche' : 'Completa configurazione'}
            </button>
            {configExists && (
              <button type="button" onClick={() => navigate('/fatturazione')}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">
                Annulla
              </button>
            )}
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
}
