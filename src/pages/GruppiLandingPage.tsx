import { useState, useRef, useEffect } from 'react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from 'react-router-dom';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

function sanitizeEmailAsId(email: string): string {
  return email.trim().toLowerCase().replace(/[.#$[\]/]/g, '_');
}

const DISPONIBILITA_OPTIONS = ['Mattina', 'Pomeriggio', 'Sera', 'Sabato'];
const ETA_FIGLIO_OPTIONS = [
  { value: '6-10', label: '6–10 anni' },
  { value: '11-14', label: '11–14 anni' },
  { value: '15-18', label: '15–18 anni' },
];

export default function GruppiLandingPage() {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [zona, setZona] = useState('');
  const [coordinate, setCoordinate] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [etaFiglio, setEtaFiglio] = useState('');
  const [disponibilita, setDisponibilita] = useState<string[]>([]);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [navSolid, setNavSolid] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Equippe Gruppi — Percorsi per genitori di figli con DSA';
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleDisponibilita = (val: string) => {
    setDisponibilita(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (website) { setSuccess(true); return; }
    if (!nome.trim() || !cognome.trim() || !email.trim() || !telefono.trim()) {
      setError('Nome, cognome, email e telefono sono obbligatori.');
      return;
    }
    if (!zona.trim()) {
      setError('Indica la tua zona di Roma.');
      return;
    }
    if (!etaFiglio) {
      setError("Indica l'età di tuo figlio/a.");
      return;
    }
    if (disponibilita.length === 0) {
      setError('Seleziona almeno una disponibilità.');
      return;
    }
    if (!gdprConsent) {
      setError("Devi accettare l'informativa sulla privacy per procedere.");
      return;
    }
    setLoading(true);
    try {
      const docId = sanitizeEmailAsId(email);
      await setDoc(doc(collection(db, 'group_therapy_requests'), docId), {
        nome: nome.trim(),
        cognome: cognome.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono.trim(),
        zona: zona.trim(),
        ...(coordinate && { coordinate }),
        etaFiglio,
        disponibilita,
        gdprConsent: true,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Errore salvataggio richiesta gruppo:', err);
      if (err.code === 'permission-denied') {
        setError('Questa email è già registrata. Ti contatteremo presto!');
      } else {
        setError('Si è verificato un errore. Riprova più tardi.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-5">
        <div className="max-w-md w-full text-center py-16">
          <div className="w-11 h-11 bg-blue-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sei nella lista, {nome}.</h1>
          <p className="text-slate-500 mb-8 text-sm leading-relaxed">
            Ti contatteremo quando il gruppo nella tua zona è pronto per partire.
            Controlla <span className="font-medium text-slate-700">{email}</span>.
          </p>
          <div className="text-left border border-slate-200 rounded-lg p-5 space-y-2 text-sm text-slate-500">
            <p className="font-medium text-slate-800 mb-1">Prossimi passi</p>
            <p>1. Raccogliamo le adesioni nella tua zona di Roma.</p>
            <p>2. Quando il gruppo è completo (6-8 persone), ti chiamiamo per confermare.</p>
            <p>3. Si parte: 8 incontri con psicoterapeuta e altri genitori.</p>
          </div>
          <p className="mt-8 text-xs text-slate-400">
            Domande? <a href="mailto:info@tuaequipe.it" className="text-blue-700 hover:underline">info@tuaequipe.it</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* NAV */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${navSolid ? 'bg-white border-b border-slate-200' : 'bg-white/80 backdrop-blur'}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg overflow-hidden border border-slate-100">
              <img src="/logo_senza_scritta.png" alt="tuaequipe.it" className="h-full w-full object-contain" />
            </div>
            <span className="font-bold text-sm">
              <span className="text-blue-400">tua</span><span className="text-green-500">equipe</span><span className="text-orange-400">.it</span><span className="text-slate-700"> Gruppi</span>
            </span>
          </div>
          <button
            onClick={scrollToForm}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded transition-colors"
          >
            Unisciti al gruppo
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-24 pb-14 px-5 border-b border-slate-100">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-start gap-12 lg:gap-20">
          <motion.div
            className="flex-1"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-5">
              Percorso di gruppo · Roma
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-5">
              Hai un figlio con DSA?<br />
              Non devi affrontarlo da solo.
            </h1>
            <p className="text-base text-slate-500 leading-relaxed mb-8 max-w-md">
              Un percorso con altri genitori e uno psicoterapeuta, nella tua zona di Roma.
              Otto incontri per ritrovare strumenti, condivisione e sollievo.
            </p>
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded transition-colors"
            >
              Unisciti al gruppo
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            </motion.div>
          <motion.div
            className="flex-shrink-0 w-full max-w-xs lg:max-w-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <img src="/genitori-dsa.png" alt="Famiglia con figlio DSA" className="w-full h-auto rounded-lg" />
          </motion.div>
        </div>

        {/* Stats */}
        <div className="max-w-5xl mx-auto mt-12 pt-8 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: '35€', label: 'a incontro' },
            { value: '8', label: 'incontri totali' },
            { value: '6-8', label: 'genitori per gruppo' },
            { value: '1', label: 'psicoterapeuta dedicato' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DIFFICOLTÀ */}
      <section className="py-14 px-5 border-b border-slate-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-8">Cosa ci dicono i genitori</p>
          <motion.div
            className="grid sm:grid-cols-2 gap-y-7 gap-x-12"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {[
              { label: 'Isolamento', text: 'Ti senti solo/a nel gestire le difficoltà scolastiche e le reazioni di tuo figlio.' },
              { label: 'Comunicazione', text: 'Non sai come spiegare il DSA agli insegnanti, ai parenti, o a tuo figlio stesso.' },
              { label: 'Carico emotivo', text: 'La stanchezza si accumula e non hai spazio per parlarne davvero con qualcuno.' },
              { label: 'Strumenti pratici', text: 'Hai bisogno di metodi concreti, non solo di essere ascoltato/a.' },
            ].map((item, i) => (
              <motion.div key={i} variants={fadeUp} className="pl-4 border-l-2 border-blue-700">
                <p className="font-semibold text-slate-900 text-sm mb-1">{item.label}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PER CHI È */}
      <section className="py-14 px-5 bg-slate-50 border-b border-slate-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Per chi è</p>
          <h2 className="text-xl font-bold text-slate-900 mb-8">Il percorso è pensato per due fasce d'età</h2>
          <motion.div
            className="grid sm:grid-cols-2 gap-5"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <motion.div variants={fadeUp} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-amber-50 flex justify-center py-6 px-6">
                <img src="/madre-dsa.png" alt="" className="h-36 w-auto object-contain" />
              </div>
              <div className="p-5 border-t border-slate-100">
                <p className="font-semibold text-slate-900 text-sm mb-1">Bambini e preadolescenti · 6–14 anni</p>
                <p className="text-xs text-slate-500 leading-relaxed">La diagnosi è recente oppure ci convivi da anni, ma senti che ti mancano ancora gli strumenti giusti.</p>
              </div>
            </motion.div>
            <motion.div variants={fadeUp} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-purple-50 flex justify-center py-6 px-6">
                <img src="/madre-figlia-dsa.png" alt="" className="h-36 w-auto object-contain" />
              </div>
              <div className="p-5 border-t border-slate-100">
                <p className="font-semibold text-slate-900 text-sm mb-1">Adolescenti · medie e liceo</p>
                <p className="text-xs text-slate-500 leading-relaxed">Le pressioni scolastiche aumentano e il DSA si scontra con l'autonomia che tuo figlio inizia a voler conquistare.</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* COME FUNZIONA */}
      <section className="py-14 px-5 border-b border-slate-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Come funziona</p>
          <h2 className="text-xl font-bold text-slate-900 mb-10">Tre passi</h2>
          <motion.div
            className="grid sm:grid-cols-3 gap-8"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {[
              { n: '01', title: 'Ti iscrivi alla lista', desc: 'Compila il form. Gratuito, nessun impegno.' },
              { n: '02', title: 'Ti contattiamo noi', desc: 'Quando ci sono 6-8 genitori nella tua zona, ti chiamiamo per confermare.' },
              { n: '03', title: 'Si parte', desc: '8 incontri con uno psicoterapeuta e altri genitori. 35€ a incontro.' },
            ].map(s => (
              <motion.div key={s.n} variants={fadeUp}>
                <p className="text-xs font-bold text-blue-700 mb-3">{s.n}</p>
                <p className="font-semibold text-slate-900 text-sm mb-1">{s.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <p className="mt-10 text-xs text-slate-400">In presenza a Roma · incontri settimanali o bisettimanali</p>
        </div>
      </section>

      {/* FORM */}
      <section className="py-14 px-5" ref={formRef}>
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Lista d'attesa</p>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Iscriviti</h2>
          <p className="text-sm text-slate-500 mb-8">Quando il gruppo nella tua zona è pronto, ti contattiamo noi.</p>

          {error && (
            <div className="border border-red-200 bg-red-50 rounded p-3 mb-5">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome <span className="text-red-500">*</span></label>
                <input type="text" required value={nome} onChange={e => setNome(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
                  placeholder="Mario" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Cognome <span className="text-red-500">*</span></label>
                <input type="text" required value={cognome} onChange={e => setCognome(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
                  placeholder="Rossi" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
                  placeholder="mario@email.it" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefono <span className="text-red-500">*</span></label>
                <input type="tel" required value={telefono} onChange={e => setTelefono(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
                  placeholder="333 1234567" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Zona di Roma <span className="text-red-500">*</span></label>
              <p className="text-xs text-slate-400 mb-1.5">Inserisci un indirizzo per trovare il luogo di incontro più comodo.</p>
              <LocationAutocomplete
                value={zona}
                onChange={(address, coords) => { setZona(address); setCoordinate(coords); }}
                placeholder="Es. Pigneto, Parioli, EUR..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Età di tuo figlio/a <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-4">
                {ETA_FIGLIO_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                    <input type="radio" name="etaFiglio" value={opt.value} checked={etaFiglio === opt.value} onChange={() => setEtaFiglio(opt.value)}
                      className="h-4 w-4 text-blue-700 border-slate-300 focus:ring-blue-700" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Disponibilità <span className="text-red-500">*</span>
                <span className="font-normal text-slate-400 ml-1">(anche più di una)</span>
              </label>
              <div className="flex flex-wrap gap-4">
                {DISPONIBILITA_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                    <input type="checkbox" value={opt} checked={disponibilita.includes(opt)} onChange={() => toggleDisponibilita(opt)}
                      className="h-4 w-4 text-blue-700 border-slate-300 rounded focus:ring-blue-700" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input id="gdpr-gruppi" type="checkbox" required checked={gdprConsent} onChange={e => setGdprConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-blue-700 border-slate-300 rounded focus:ring-blue-700 flex-shrink-0" />
              <label htmlFor="gdpr-gruppi" className="text-xs text-slate-500 leading-relaxed">
                Ho letto e accetto l'<Link to="/legal/privacy" className="text-blue-700 hover:underline">informativa sulla privacy</Link> e acconsento al trattamento dei dati. <span className="text-red-500">*</span>
              </label>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Invio in corso...' : 'Unisciti al gruppo'}
            </button>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-8 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg overflow-hidden border border-slate-100">
              <img src="/logo_senza_scritta.png" alt="tuaequipe.it" className="h-full w-full object-contain" />
            </div>
            <span className="font-bold text-sm">
              <span className="text-blue-400">tua</span><span className="text-green-500">equipe</span><span className="text-orange-400">.it</span><span className="text-slate-500"> Gruppi</span>
            </span>
          </div>
          <div className="flex gap-5">
            <a href="https://tuaequipe.it" className="hover:text-slate-700 transition-colors">tuaequipe.it</a>
            <Link to="/legal/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
            <a href="mailto:info@tuaequipe.it" className="hover:text-slate-700 transition-colors">info@tuaequipe.it</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

