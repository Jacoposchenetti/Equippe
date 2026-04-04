import { useState, useRef, useEffect } from 'react';
import { collection, doc, setDoc, getDoc, serverTimestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PROFESSIONI_DISPONIBILI } from '@/lib/professioni';
import { Link } from 'react-router-dom';

function sanitizeEmailAsId(email: string): string {
  return email.trim().toLowerCase().replace(/[.#$[\]/]/g, '_');
}

/* ─── Brand helpers ─── */
const Brand = () => (
  <span className="inline-flex items-center gap-1.5 font-bold text-xl">
    <img src="/logo_senza_scritta.png" alt="" className="w-7 h-7" />
    <span>
      <span className="text-blue-600">tua</span>
      <span className="text-green-600">equipe</span>
      <span className="text-orange-500">.it</span>
    </span>
  </span>
);

const BrandLarge = () => (
  <span className="font-extrabold text-4xl sm:text-5xl tracking-tight">
    <span className="text-blue-600">tua</span>
    <span className="text-green-600">equipe</span>
    <span className="text-orange-500">.it</span>
  </span>
);

/* ─── Scarcity config ─── */
const TOTAL_SPOTS = 200;

/* ─── Professioni visibili nella landing ─── */
const PROFESSIONI_LANDING = [
  {
    nome: 'Psicologo',
    desc: 'Sostegno, valutazione e benessere mentale',
    color: 'bg-violet-50 text-violet-600',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  },
  {
    nome: 'Psicoterapeuta',
    desc: 'Percorsi terapeutici e cura del disagio',
    color: 'bg-blue-50 text-blue-600',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>,
  },
  {
    nome: 'Psichiatra',
    desc: 'Diagnosi e trattamento farmacologico',
    color: 'bg-indigo-50 text-indigo-600',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>,
  },
  {
    nome: 'Nutrizionista',
    desc: 'Alimentazione, salute e prevenzione',
    color: 'bg-emerald-50 text-emerald-600',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" /></svg>,
  },
  {
    nome: 'Dietista',
    desc: 'Piani alimentari e riabilitazione nutrizionale',
    color: 'bg-green-50 text-green-600',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>,
  },
  {
    nome: 'Dietologo',
    desc: 'Patologie metaboliche e diete cliniche',
    color: 'bg-teal-50 text-teal-600',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>,
  },
  {
    nome: 'Logopedista',
    desc: 'Linguaggio, voce e comunicazione',
    color: 'bg-sky-50 text-sky-600',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>,
  },
  {
    nome: 'Neuropsicomotricista',
    desc: 'Sviluppo psicomotorio in età evolutiva',
    color: 'bg-amber-50 text-amber-600',
    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M7 13c-1.5 0-3-1-3-3.5S5.5 4 7 4c1 0 2 .5 2.5 1.5C10 4 11.5 2 14 2c3 0 5 2.5 5 6 0 4-2.5 7-7 9" /><path d="M10 13v5c0 1.1.9 2 2 2h1a2 2 0 002-2v-3" /></svg>,
  },
  {
    nome: 'Fisioterapista',
    desc: 'Riabilitazione motoria e terapia manuale',
    color: 'bg-rose-50 text-rose-600',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  },
  {
    nome: 'Osteopata',
    desc: 'Trattamento muscolo-scheletrico e posturale',
    color: 'bg-orange-50 text-orange-600',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  },
];

export default function WaitlistPage() {
    // Carica dinamicamente lo script Iubenda per la cookie policy
    useEffect(() => {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://embeds.iubenda.com/widgets/7f39969c-734a-463a-bb01-ecd3a1026205.js';
      script.async = true;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    }, []);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [professione, setProfessione] = useState('');
  const [isPsichiatra, setIsPsichiatra] = useState('');
  const [citta, setCitta] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [website, setWebsite] = useState(''); // honeypot anti-bot
  const [navSolid, setNavSolid] = useState(false);
  const [spotsLeft, setSpotsLeft] = useState<number | null>(() => {
    // Mostra subito il valore dalla cache se disponibile e fresco (< 1 ora)
    try {
      const cached = localStorage.getItem('waitlist_spots');
      if (cached) {
        const { value, ts } = JSON.parse(cached);
        if (Date.now() - ts < 60 * 60 * 1000) return value;
      }
    } catch { /* ignore */ }
    return null;
  });

  const formRef = useRef<HTMLFormElement>(null);

  /* Sticky nav background on scroll */
  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Conteggio reale posti rimasti
   * 1. Prima prova localStorage (istantaneo, TTL 1h)
   * 2. Poi legge config/stats (documento singolo, usa la cache Firestore offline)
   * 3. Solo se config/stats non è ancora inizializzato, usa getCountFromServer
   */
  useEffect(() => {
    // Controlla se la cache locale è ancora fresca
    try {
      const cached = localStorage.getItem('waitlist_spots');
      if (cached) {
        const { ts } = JSON.parse(cached);
        if (Date.now() - ts < 60 * 60 * 1000) return;
      }
    } catch { /* ignore */ }

    async function fetchCount() {
      // Prova il counter document (fast — usa cache Firestore offline)
      try {
        const statsSnap = await getDoc(doc(db, 'config', 'stats'));
        if (statsSnap.exists() && typeof statsSnap.data().waitlistCount === 'number') {
          const value = Math.max(0, TOTAL_SPOTS - statsSnap.data().waitlistCount);
          setSpotsLeft(value);
          try {
            localStorage.setItem('waitlist_spots', JSON.stringify({ value, ts: Date.now() }));
          } catch { /* ignore */ }
          return;
        }
      } catch { /* ignore, fallback below */ }

      // Fallback: aggregazione server (solo se config/stats non esiste ancora)
      try {
        const countSnap = await getCountFromServer(collection(db, 'waitlist'));
        const value = Math.max(0, TOTAL_SPOTS - countSnap.data().count);
        setSpotsLeft(value);
        try {
          localStorage.setItem('waitlist_spots', JSON.stringify({ value, ts: Date.now() }));
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    }

    fetchCount();
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Honeypot: se compilato, è un bot — rifiuta silenziosamente
    if (website) {
      setSuccess(true);
      return;
    }

    if (!nome.trim() || !cognome.trim() || !email.trim() || !professione || !citta.trim()) {
      setError('Tutti i campi sono obbligatori.');
      return;
    }
    if (professione === 'Psicoterapeuta' && !isPsichiatra) {
      setError('Indica se sei anche psichiatra.');
      return;
    }
    if (!gdprConsent) {
      setError('Devi accettare l\'informativa sulla privacy per procedere.');
      return;
    }

    setLoading(true);
    try {
      const docId = sanitizeEmailAsId(email);
      const docRef = doc(collection(db, 'waitlist'), docId);

      // setDoc su un doc esistente fallirà con permission-denied (Firestore rules: solo create)
      // Il catch gestisce il caso duplicato mostrando il messaggio appropriato
      await setDoc(docRef, {
        nome: nome.trim(),
        cognome: cognome.trim(),
        email: email.trim().toLowerCase(),
        professione,
        citta: citta.trim(),
        gdprConsent: true,
        createdAt: serverTimestamp(),
        ...(professione === 'Psicoterapeuta' && { isPsichiatra: isPsichiatra === 'si' }),
      });

      setSuccess(true);
      // Invalida la cache così il prossimo caricamento prenderà il conteggio aggiornato
      try { localStorage.removeItem('waitlist_spots'); } catch { /* ignore */ }
      setSpotsLeft(prev => prev !== null ? Math.max(0, prev - 1) : null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Errore salvataggio waitlist:', err);
      if (err.code === 'permission-denied') {
        setError('Questa email è già registrata nella waiting list. Ti contatteremo presto!');
      } else {
        setError('Si è verificato un errore. Riprova più tardi.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ─── Shared form JSX ─── */
  const formContent = (id: string) => (
    <form ref={id === 'hero' ? formRef : undefined} onSubmit={handleSubmit} className="space-y-3">
      {/* Honeypot anti-bot: campo nascosto che solo i bot compilano */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
        <label htmlFor={`website-${id}`}>Website</label>
        <input id={`website-${id}`} type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`nome-${id}`} className="block text-sm font-medium text-gray-700">
            Nome <span className="text-red-500">*</span>
          </label>
          <input id={`nome-${id}`} type="text" required value={nome} onChange={(e) => setNome(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nome" />
        </div>
        <div>
          <label htmlFor={`cognome-${id}`} className="block text-sm font-medium text-gray-700">
            Cognome <span className="text-red-500">*</span>
          </label>
          <input id={`cognome-${id}`} type="text" required value={cognome} onChange={(e) => setCognome(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Cognome" />
        </div>
      </div>

      <div>
        <label htmlFor={`email-${id}`} className="block text-sm font-medium text-gray-700">
          Email <span className="text-red-500">*</span>
        </label>
        <input id={`email-${id}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="La tua email" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`professione-${id}`} className="block text-sm font-medium text-gray-700">
            Professione <span className="text-red-500">*</span>
          </label>
          <select id={`professione-${id}`} required value={professione} onChange={(e) => { setProfessione(e.target.value); setIsPsichiatra(''); }}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
            <option value="">Seleziona...</option>
            {PROFESSIONI_DISPONIBILI.map((prof) => (
              <option key={prof} value={prof}>{prof}</option>
            ))}
            <option value="Altro">Altro</option>
          </select>
        </div>
        <div>
          <label htmlFor={`citta-${id}`} className="block text-sm font-medium text-gray-700">
            Città <span className="text-red-500">*</span>
          </label>
          <input id={`citta-${id}`} type="text" required value={citta} onChange={(e) => setCitta(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="La tua città" />
        </div>
      </div>

      {professione === 'Psicoterapeuta' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Sei anche psichiatra? <span className="text-red-500">*</span>
          </label>
          <div className="mt-2 flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`psichiatra-${id}`} value="si" checked={isPsichiatra === 'si'} onChange={() => setIsPsichiatra('si')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
              <span className="text-sm text-gray-700">Sì</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`psichiatra-${id}`} value="no" checked={isPsichiatra === 'no'} onChange={() => setIsPsichiatra('no')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
              <span className="text-sm text-gray-700">No</span>
            </label>
          </div>
        </div>
      )}

      <div className="flex items-start pt-1">
        <div className="flex items-center h-5">
          <input id={`gdpr-${id}`} type="checkbox" required checked={gdprConsent} onChange={(e) => setGdprConsent(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
        </div>
        <div className="ml-2 text-xs">
          <label htmlFor={`gdpr-${id}`} className="text-gray-600">
            Ho letto e accetto l'{' '}
            <Link to="/legal/privacy" className="text-blue-600 hover:text-blue-500 underline" target="_blank">
              informativa sulla privacy
            </Link>
            {' '}e acconsento al trattamento dei dati per essere ricontattato/a. <span className="text-red-500">*</span>
          </label>
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? 'Invio in corso...' : 'Iscriviti alla waiting list'}
      </button>
    </form>
  );

  /* ════════════════════════════════════════════════
     SUCCESS STATE — full-page confirmation
     ════════════════════════════════════════════════ */
  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Iscrizione confermata!</h1>
          <p className="text-gray-600 mb-2 text-lg">
            Grazie, <span className="font-semibold">{nome}</span>. Sei nella lista.
          </p>
          <p className="text-gray-500 mb-8">
            Ti contatteremo a <span className="font-medium">{email}</span> quando la piattaforma sarà pronta per te.
          </p>
          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50 mb-6">
            <p className="text-gray-500 text-sm">
              📬 Ti abbiamo inviato un'email di conferma. Controlla anche la cartella spam.
            </p>
          </div>
          <p className="text-sm text-gray-400">
            Hai domande? Scrivici a{' '}
            <a href="mailto:info@tuaequipe.it" className="text-blue-600 hover:underline">info@tuaequipe.it</a>
          </p>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     MAIN LANDING PAGE
     ════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-white">

      {/* ───── 1. STICKY NAV ───── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${navSolid ? 'bg-white/95 backdrop-blur shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Brand />
          <button onClick={scrollToForm}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition-colors">
            Iscriviti gratis
          </button>
        </div>
      </nav>

      {/* ───── 2. HERO ───── */}
      <section className="relative pt-16 overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-0 items-end min-h-[540px]">
            {/* Left — Text */}
            <div className="py-12 lg:py-16 lg:pr-12">
              <div className="mb-5">
                <BrandLarge />
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                Basta passaparola casuale.<br />
                <span className="text-blue-600">Costruisci la tua rete professionale</span> sanitaria.
              </h1>
              <p className="text-lg text-gray-600 mb-6 max-w-lg">
                La prima piattaforma italiana dove psicologi, psichiatri, nutrizionisti e altri professionisti sanitari collaborano e rafforzano la propria attività clinica — gratuitamente.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-8">
                <span className="flex items-center gap-1.5">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  100% gratuito
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Solo professionisti verificati
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Iscrizione in 30 secondi
                </span>
              </div>
              <button onClick={scrollToForm}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-colors text-lg">
                Iscriviti gratis alla waiting list
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Right — Hero image with blend to hide background mismatch */}
            <div className="hidden lg:flex justify-center items-end self-end">
              <img src="/hero-professionals.png" alt="Professionisti tuaequipe.it"
                className="w-full max-w-[600px] h-auto object-contain drop-shadow-2xl"
                style={{ marginBottom: '-4px' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ───── FORM SECTION — split: image left, form right ───── */}
      <section className="py-10 lg:py-14 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left — Dottoressa */}
            <div className="hidden lg:flex justify-center">
              <img src="/dottoressa_indica.png" alt="Professionista sanitaria"
                className="w-full max-w-[420px] h-auto object-contain drop-shadow-lg" />
            </div>
            {/* Right — Form */}
            <div>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-6 sm:p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">Unisciti alla waiting list</h2>
                <p className="text-sm text-gray-500 mb-5 text-center">Accesso anticipato riservato ai primi iscritti</p>
                {formContent('hero')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── 3. SCARCITY BAR ───── */}
      <section className="bg-blue-600 py-4">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-white font-semibold text-lg mb-2">
            {spotsLeft === null
              ? <span className="text-yellow-300">Caricamento posti...</span>
              : <>Solo <span className="text-yellow-300">{spotsLeft} posti</span> rimasti</>
            }
          </p>
          <div className="w-full bg-blue-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-yellow-400 h-3 rounded-full transition-all duration-700"
              style={{ width: spotsLeft !== null ? `${((TOTAL_SPOTS - spotsLeft) / TOTAL_SPOTS) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </section>

      {/* ───── 4. COME FUNZIONA ───── */}
      <section className="py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            {/* Immagine a sinistra */}
            <div className="w-full lg:w-5/12 flex-shrink-0">
              <img
                src="/gruppo_professionisti.png"
                alt="Gruppo di professionisti"
                className="w-full h-auto max-w-md mx-auto lg:max-w-none"
              />
            </div>

            {/* Contenuto a destra */}
            <div className="w-full lg:w-7/12">
              <div className="mb-8 text-center lg:text-left">
                <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">Come funziona</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Tre passi per entrare nella rete</h2>
                <p className="text-gray-500">Nessun impegno, nessun costo.</p>
              </div>

              <div className="space-y-6">
                {[
                  {
                    step: '1',
                    title: 'Iscriviti alla waiting list',
                    desc: 'Compila il form con i tuoi dati. In 30 secondi sei dentro.',
                    icon: (
                      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ),
                  },
                  {
                    step: '2',
                    title: 'Ricevi l\'accesso anticipato',
                    desc: 'Appena la piattaforma è pronta, sarai tra i primi ad accedere.',
                    icon: (
                      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    ),
                  },
                  {
                    step: '3',
                    title: 'Costruisci la tua equipe',
                    desc: 'Trova colleghi, invia referral e collabora in modo sicuro.',
                    icon: (
                      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                  },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">Passo {item.step}</div>
                      <h3 className="font-semibold text-gray-900 text-lg mb-0.5">{item.title}</h3>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── 6. SEZIONE PROBLEMA ───── */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-2">Il problema</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Ti riconosci in queste situazioni?</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Lavori bene nel tuo ambito, ma quando il paziente ha bisogno di un altro specialista le cose si complicano.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-14">
            {[
              { pain: 'Cerchi un collega fidato per un invio e finisci a chiedere in giro senza garanzie.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
              { pain: 'Non sai chi lavora nella tua zona e con che tipo di approccio.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg> },
              { pain: 'Ricevi richieste fuori dalla tua specializzazione e non sai a chi indirizzare.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg> },
              { pain: 'Ti manca una rete strutturata — il classico "gruppo WhatsApp" non basta.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg> },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-400">
                  {item.icon}
                </div>
                <p className="text-gray-600 text-[15px] leading-relaxed pt-1.5">{item.pain}</p>
              </div>
            ))}
          </div>

          {/* Solution panel */}
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-8 sm:p-10 text-center max-w-2xl mx-auto">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Con <span className="text-blue-600">tua</span><span className="text-green-600">equipe</span><span className="text-orange-500">.it</span> questi problemi spariscono.
            </h3>
            <p className="text-gray-500 mb-6">Professionisti verificati, nella tua zona, a portata di clic.</p>
            <button onClick={scrollToForm}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm">
              Iscriviti alla waitlist
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ───── 7. LISTA PROFESSIONI ───── */}
      <section className="py-16 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">La rete</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Per chi è <span className="text-blue-600">tua</span><span className="text-green-600">equipe</span><span className="text-orange-500">.it</span>?
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">Professionisti dell'area sanitaria che vogliono collaborare, crescere e offrire un servizio migliore ai propri pazienti.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PROFESSIONI_LANDING.map((prof) => (
              <div key={prof.nome} className="group relative bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-200">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${prof.color}`}>
                  {prof.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{prof.nome}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{prof.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">…e altre professioni in arrivo con i prossimi aggiornamenti</p>
        </div>
      </section>

      {/* ───── 8. CTA FINALE ───── */}
      <section className="py-16 lg:py-20 bg-gradient-to-br from-blue-600 to-blue-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Non restare fuori dalla rete</h2>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto">
            I posti nella waiting list sono limitati. Iscriviti ora e sarai tra i primi a usare la piattaforma — gratis.
          </p>
          <button onClick={scrollToForm}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-700 font-bold rounded-lg shadow-lg hover:bg-gray-50 transition-colors text-lg">
            Iscriviti alla waiting list
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="py-8 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <Brand />
          <div className="flex gap-4">
            <Link to="/legal/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <a href="mailto:info@tuaequipe.it" className="hover:text-gray-600 transition-colors">Contatti</a>
          </div>
          <span>© {new Date().getFullYear()} tuaequipe.it</span>
        </div>
      </footer>
    {/* Script Iubenda per cookie policy */}
    <script
      type="text/javascript"
      src="https://embeds.iubenda.com/widgets/7f39969c-734a-463a-bb01-ecd3a1026205.js"
    ></script>
  </div>
  );
}
