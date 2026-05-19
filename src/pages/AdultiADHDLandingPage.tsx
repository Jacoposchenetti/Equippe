import { useState, useRef, useEffect } from 'react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const THOUGHTS = [
  'Devo fare quella cosa... ma cos\'era?',
  'Perché non riesco a iniziare?',
  'Ho sbagliato ancora. Sono stupido?',
  'Domani lo faccio. Domani, giuro.',
  'Tutti sembrano capire tranne me.',
  'Sono stanco di combattere con me stesso.',
];

function ThoughtBubble() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex(i => (i + 1) % THOUGHTS.length), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative">
      {/* pallini del fumetto */}
      <div className="absolute -bottom-2 right-8 flex items-end gap-1">
        <span className="block w-3 h-3 rounded-full bg-slate-200 border border-slate-300" />
        <span className="block w-2 h-2 rounded-full bg-slate-200 border border-slate-300" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm min-h-[52px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="text-sm text-slate-600 italic leading-snug"
          >
            &ldquo;{THOUGHTS[index]}&rdquo;
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function sanitizeEmailAsId(email: string): string {
  return email.trim().toLowerCase().replace(/[.#$[\]/]/g, '_');
}

const DISPONIBILITA_OPTIONS = [
  { id: 'lun-1', giorno: 'Lunedì', orario: '18:00 - 19:30' },
  { id: 'lun-2', giorno: 'Lunedì', orario: '19:30 - 21:00' },
  { id: 'mer-1', giorno: 'Mercoledì', orario: '18:00 - 19:30' },
  { id: 'mer-2', giorno: 'Mercoledì', orario: '19:30 - 21:00' },
];

export default function AdultiADHDLandingPage() {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [disponibilita, setDisponibilita] = useState<string[]>([]);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [navSolid, setNavSolid] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Equippe Gruppi — Percorso per adulti con ADHD';
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
      await setDoc(doc(collection(db, 'adult_adhd_requests'), docId), {
        nome: nome.trim(),
        cognome: cognome.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono.trim(),
        disponibilita,
        disponibilita_label: disponibilita.map(id => {
          const opt = DISPONIBILITA_OPTIONS.find(o => o.id === id);
          return opt ? `${opt.giorno} ${opt.orario}` : id;
        }),
        gdprConsent: true,
        newsletter,
        status: 'pending',
        vertical: 'adulti_adhd',
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Errore salvataggio richiesta adulti ADHD:', err);
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
          <div className="w-11 h-11 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sei nella lista, {nome}.</h1>
          <p className="text-slate-500 mb-8 text-sm leading-relaxed">
            Ti contatteremo quando il gruppo è pronto per partire.
            Controlla <span className="font-medium text-slate-700">{email}</span>.
          </p>
          <div className="text-left border border-slate-200 rounded-lg p-5 space-y-2 text-sm text-slate-500">
            <p className="font-medium text-slate-800 mb-1">Prossimi passi</p>
            <p>1. Raccogliamo le adesioni in tutta Italia.</p>
            <p>2. Quando il gruppo è completo (6-8 persone), ti chiamiamo per confermare.</p>
            <p>3. Si parte: 8 incontri online con psicoterapeuta e altri adulti con ADHD.</p>
          </div>
          <p className="mt-8 text-xs text-slate-400">
            Domande? <a href="mailto:info@tuaequipe.it" className="text-orange-600 hover:underline">info@tuaequipe.it</a>
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
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded transition-colors"
          >
            Unisciti al gruppo
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-24 pb-0 px-5 border-b border-slate-100">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-end gap-12 lg:gap-16">
          <motion.div
            className="flex-1 pb-14"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-5">
              Percorso di gruppo · Online
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-5">
              Hai l'ADHD?<br />
              Non devi affrontarlo da solo.
            </h1>
            <p className="text-base text-slate-500 leading-relaxed mb-8 max-w-md">
              Un percorso online con altri adulti con ADHD e uno psicoterapeuta.
              Otto incontri per ritrovare struttura, strategie e un posto dove essere capiti.
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
            className="flex-shrink-0 w-full max-w-sm lg:max-w-lg xl:max-w-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              {/* Fumetto di pensiero */}
              <motion.div
                className="absolute -top-16 left-4 right-4 z-10"
                initial={{ opacity: 0, y: 8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 1.0 }}
              >
                <ThoughtBubble />
              </motion.div>
              <img src="/uomo%20ADHD.png" alt="Adulto con ADHD" className="w-full h-auto block" />
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="max-w-5xl mx-auto mt-0 pt-8 pb-12 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: '100%', label: 'online' },
            { value: '8', label: 'incontri totali' },
            { value: '6-8', label: 'partecipanti per gruppo' },
            { value: '40€', label: 'a incontro' },
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
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-8">Cosa ci dicono gli adulti con ADHD</p>
          <motion.div
            className="grid sm:grid-cols-2 gap-y-7 gap-x-12"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {[
              { label: 'Procrastinazione e blocchi', text: 'Sai cosa dovresti fare ma non riesci a iniziare. Oppure inizi e non finisci. È frustrante e logorante.' },
              { label: 'Lavoro e carriera', text: "Scadenze mancate, riunioni infinite, difficoltà a seguire procedure: l'ADHD in ufficio si fa sentire ogni giorno." },
              { label: 'Disregolazione emotiva', text: 'Le reazioni sembrano sproporzionate, le frustrazioni si accumulano. Non è carattere: è neurologia.' },
              { label: 'Relazioni e incomprensioni', text: '"Sei disordinato", "non ti impegni", "fai apposta". Partner, amici e colleghi spesso non capiscono.' },
            ].map((item, i) => (
              <motion.div key={i} variants={fadeUp} className="pl-4 border-l-2 border-orange-600">
                <p className="font-semibold text-slate-900 text-sm mb-1">{item.label}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PSICOLOGO */}
      <section className="py-14 px-5 border-b border-slate-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-8">Il tuo terapeuta</p>
          <motion.div
            className="flex flex-col sm:flex-row gap-8 items-start"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <img
              src="/Psicologo%20Valerio%20Borzi.jpg"
              alt="Dott. Borzi Valerio"
              className="w-48 h-48 object-cover object-top rounded-xl flex-shrink-0 border border-slate-100"
            />
            <div>
              <p className="font-bold text-slate-900 text-lg mb-0.5">Dott. Borzi Valerio</p>
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-4">Psicoterapeuta in formazione · Psicologo clinico</p>
              <p className="text-sm text-slate-500 leading-relaxed mb-3">
                Psicologo clinico e psicodiagnosta per ADHD, DSA e Autismo.
                Lavora con adulti su disturbi alimentari, ADHD e con l'età evolutiva su DSA e dipendenza da videogiochi.
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Si occupa inoltre di consulenza di coppia e di problematiche legate ad ansia, depressione, attacchi di panico,
                potenziamento delle risorse personali e gestione emotiva.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* COME FUNZIONA */}
      <section className="py-14 px-5 bg-slate-50 border-b border-slate-100">
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
              { n: '02', title: 'Ti contattiamo noi', desc: 'Quando ci sono 6-8 persone iscritte, ti chiamiamo per confermare.' },
              { n: '03', title: 'Si parte', desc: '8 incontri online con uno psicoterapeuta e altri adulti con ADHD. 40€ a incontro, ogni 2 settimane.' },
            ].map(s => (
              <motion.div key={s.n} variants={fadeUp}>
                <p className="text-xs font-bold text-orange-600 mb-3">{s.n}</p>
                <p className="font-semibold text-slate-900 text-sm mb-1">{s.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <p className="mt-10 text-xs text-slate-400">Online via video call · 1 incontro ogni 2 settimane</p>
        </div>
      </section>

      {/* IL PERCORSO */}
      <section className="py-14 px-5 border-b border-slate-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Il percorso</p>
          <h2 className="text-xl font-bold text-slate-900 mb-5">Cosa facciamo insieme</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-8 max-w-2xl">
            Il percorso è un intervento di gruppo rivolto ad adulti con ADHD (diagnosi formale o sospetta),
            finalizzato a migliorare la gestione della disattenzione, dell’impulsività e della disregolazione emotiva nella vita quotidiana.
            Il gruppo integra approcci: cognitivo-comportamentale, psicoeducativo, coaching ADHD-oriented, strategie di regolazione emotiva.
          </p>
          <div className="mt-10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Obiettivi principali</p>
            <motion.div
              className="grid sm:grid-cols-2 gap-5"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              {[
                { n: '01', text: "Comprendere il funzionamento dell'ADHD in età adulta" },
                { n: '02', text: 'Migliorare organizzazione, gestione del tempo e pianificazione' },
                { n: '03', text: 'Sviluppare strategie per attenzione e memoria' },
                { n: '04', text: 'Lavorare su procrastinazione e motivazione' },
                { n: '05', text: 'Gestire impulsività ed emozioni intense' },
                { n: '06', text: 'Aumentare autostima e senso di efficacia personale' },
              ].map(item => (
                <motion.div key={item.n} variants={fadeUp} className="flex gap-3 items-start">
                  <span className="text-xs font-bold text-orange-600 mt-0.5 w-6 flex-shrink-0">{item.n}</span>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
            <p className="text-sm text-slate-500 leading-relaxed mt-6 max-w-3xl">
              Il contesto di gruppo favorisce identificazione, normalizzazione e apprendimento reciproco.
            </p>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className="pt-14 pb-14 px-5" ref={formRef}>
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Lista d'attesa</p>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Iscriviti</h2>
          <p className="text-sm text-slate-500 mb-8">Quando il gruppo è pronto, ti contattiamo noi.</p>

          {error && (
            <div className="border border-red-200 bg-red-50 rounded p-3 mb-5">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
              <input type="text" name="url_field" tabIndex={-1} autoComplete="new-password" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome <span className="text-red-500">*</span></label>
                <input type="text" required value={nome} onChange={e => setNome(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-600 focus:border-orange-600"
                  placeholder="Mario" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Cognome <span className="text-red-500">*</span></label>
                <input type="text" required value={cognome} onChange={e => setCognome(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-600 focus:border-orange-600"
                  placeholder="Rossi" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-600 focus:border-orange-600"
                  placeholder="mario@email.it" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefono <span className="text-red-500">*</span></label>
                <input type="tel" required value={telefono} onChange={e => setTelefono(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-600 focus:border-orange-600"
                  placeholder="333 1234567" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-3">
                Disponibilità <span className="text-red-500">*</span>
                <span className="font-normal text-slate-400 ml-1">(anche più di una)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DISPONIBILITA_OPTIONS.map(opt => {
                  const selected = disponibilita.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleDisponibilita(opt.id)}
                      className={`flex flex-col items-start px-4 py-3 rounded-lg border text-left transition-all ${
                        selected
                          ? 'border-orange-600 bg-orange-50 ring-1 ring-orange-600'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className={`text-xs font-semibold mb-0.5 ${
                        selected ? 'text-orange-600' : 'text-slate-500'
                      }`}>{opt.giorno}</span>
                      <span className={`text-sm font-medium ${
                        selected ? 'text-slate-900' : 'text-slate-700'
                      }`}>{opt.orario}</span>
                      {selected && (
                        <span className="mt-1.5 text-[10px] font-semibold text-orange-600 uppercase tracking-wide">Selezionato</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input id="newsletter-adulti-adhd" type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-orange-600 border-slate-300 rounded focus:ring-orange-600 flex-shrink-0" />
              <label htmlFor="newsletter-adulti-adhd" className="text-xs text-slate-500 leading-relaxed">
                Voglio ricevere aggiornamenti e contenuti utili sull'ADHD da tuaequipe.it. Puoi disiscriverti in qualsiasi momento.
              </label>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input id="gdpr-adulti-adhd" type="checkbox" required checked={gdprConsent} onChange={e => setGdprConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-orange-600 border-slate-300 rounded focus:ring-orange-600 flex-shrink-0" />
              <label htmlFor="gdpr-adulti-adhd" className="text-xs text-slate-500 leading-relaxed">
                Ho letto e accetto l'<Link to="/legal/privacy" className="text-orange-600 hover:underline">informativa sulla privacy</Link> e acconsento al trattamento dei dati. <span className="text-red-500">*</span>
              </label>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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

