import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { functions } from '@/lib/firebase';

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

interface MetricRow {
  count: number;
  [key: string]: string | number;
}

interface FunnelStep {
  step: string;
  sessions: number;
  rate: number;
}

interface AnalyticsResponse {
  totals: {
    visits: number;
    sessions: number;
    conversions: number;
    conversionRate: number;
    events: number;
  };
  topPages: Array<{ path: string; count: number }>;
  exitPages: Array<{ path: string; count: number; rate: number }>;
  commonPaths: Array<{ path: string; count: number }>;
  dropOff: Array<{ path: string; views: number; exits: number; rate: number }>;
  funnel: FunnelStep[];
  eventsByType: Array<{ event_type: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  referrers: Array<{ referrer: string; count: number }>;
  transitions: Array<{ from: string; to: string; count: number }>;
  pageRoles: Array<{
    path: string;
    destinationSessions: number;
    intermediateSessions: number;
    destinationRate: number;
    functionalEvents: number;
  }>;
  journey: {
    target: string;
    reachedSessions: number;
    averageSteps: number;
    medianSteps: number;
    averageIntermediateSteps: number;
    distribution: Array<{ steps: number; sessions: number }>;
    commonJourneys: Array<{ path: string; count: number; steps: number }>;
  };
  limited?: boolean;
}

interface Filters {
  startDate: string;
  endDate: string;
  path: string;
  event_type: string;
  device: string;
  referrer: string;
  targetPath: string;
  targetEvent: string;
}

const eventOptions = ['', 'page_view', 'click_cta', 'form_start', 'form_submit', 'conversion'];
const deviceOptions = ['', 'desktop', 'tablet', 'mobile', 'unknown'];

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultFilters(): Filters {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400000);
  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
    path: '',
    event_type: '',
    device: '',
    referrer: '',
    targetPath: '',
    targetEvent: 'conversion',
  };
}

const explanations: Record<string, string> = {
  visite: 'Numero di page_view nel periodo. Misura quante pagine sono state viste, non quante persone diverse.',
  sessioni: 'Numero di session_id anonimi unici. E una buona proxy delle visite utente/browser.',
  conversioni: 'Eventi conversion tracciati, oppure form importanti inviati con metadata conversion=true.',
  conversionRate: 'Conversioni divise per sessioni. Ti dice quanto traffico arriva a un esito utile.',
  eventi: 'Tutti gli eventi raccolti: page_view, click CTA, form_start, form_submit e conversion.',
  funnel: 'Sequenza sintetica dalle visite alla conversione. Il salto piu grande indica dove gli utenti si fermano.',
  topPages: 'Pagine viste piu spesso. Utile per capire dove concentrare miglioramenti e CTA.',
  exitPages: 'Ultima pagina vista in sessione. Se una pagina critica ha molte uscite, puo indicare frizione.',
  commonPaths: 'Sequenze di pagine piu frequenti nelle sessioni. Aiuta a capire se il percorso reale coincide con quello progettato.',
  dropOff: 'Pagine con alta percentuale di uscita rispetto alle visite. Prioritizza qui le analisi UX.',
  transitions: 'Passaggi pagina -> pagina piu frequenti. Mostrano dove gli utenti si spostano davvero.',
  pageRoles: 'Classifica le pagine in base al comportamento: destinazione funzionale se l utente compie azioni sulla pagina, step intermedio se passa oltre senza azioni.',
  journey: 'Misura quanti page_view servono tipicamente per raggiungere un obiettivo scelto: pagina target o evento target.',
  device: 'Distribuzione eventi per desktop, mobile e tablet. Drop-off alto su mobile spesso segnala problemi responsive.',
  referrer: 'Origine del traffico quando disponibile. direct significa accesso diretto o referrer non passato dal browser.',
};

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-700"
        aria-label="Spiegazione metrica"
      >
        i
      </button>
      {open && (
        <span className="absolute left-1/2 top-7 z-30 w-72 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-medium leading-5 text-slate-600 shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

function SectionTitle({ children, explanation }: { children: React.ReactNode; explanation: string }) {
  return (
    <h2 className="mb-4 flex items-center text-lg font-bold text-slate-950">
      {children}
      <InfoTip text={explanation} />
    </h2>
  );
}

function StatCard({ label, value, hint, accent, explanation }: { label: string; value: string | number; hint: string; accent: string; explanation: string }) {
  return (
    <div className="surface rounded-2xl p-5">
      <div className={`mb-4 h-1 w-12 rounded-full ${accent}`} />
      <p className="flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        <InfoTip text={explanation} />
      </p>
      <p className="mt-2 text-3xl font-extrabold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function BarList({ rows, labelKey }: { rows: MetricRow[]; labelKey: string }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Nessun dato nel periodo selezionato</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={`${row[labelKey]}`} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">{row[labelKey]}</span>
            <span className="font-semibold text-slate-950">{row.count}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-700"
              style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ rows, columns }: { rows: MetricRow[]; columns: Array<{ key: string; label: string }> }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Nessun dato disponibile</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-slate-50">
              {columns.map((column) => (
                <td key={column.key} className="max-w-[360px] px-3 py-3 text-slate-700">
                  <span className="line-clamp-2">{row[column.key]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(() => defaultFilters());
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  const pageOptions = useMemo(() => {
    const paths = new Set<string>();
    data?.topPages.forEach((page) => paths.add(page.path));
    data?.exitPages.forEach((page) => paths.add(page.path));
    data?.transitions.forEach((transition) => {
      paths.add(transition.from);
      paths.add(transition.to);
    });
    return [...paths].sort();
  }, [data]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    loadAnalytics();
  }, [user, isAdmin]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const fn = httpsCallable<Partial<Filters>, AnalyticsResponse>(functions, 'getUxAnalytics');
      const payload = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== '')
      ) as Partial<Filters>;
      const result = await fn(payload);
      setData(result.data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Errore caricamento analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen app-shell">
      <Header />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-0 sm:px-6 sm:pt-6 sm:pb-10">
        <section className="surface-lifted mb-6 rounded-3xl p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700">Admin</p>
              <h1 className="mt-1 text-3xl font-extrabold text-slate-950 sm:text-4xl">UX Analytics</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Eventi anonimi, percorsi, conversioni e drop-off raccolti senza dati sensibili.
              </p>
            </div>
            <button onClick={loadAnalytics} disabled={loading} className="btn-primary">
              {loading ? 'Aggiornamento...' : 'Aggiorna dati'}
            </button>
          </div>
        </section>

        <section className="surface mb-6 rounded-2xl p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <label className="text-sm font-medium text-slate-700">
              Da
              <input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              A
              <input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Pagina
              <input list="analytics-pages" value={filters.path} onChange={(event) => setFilters({ ...filters, path: event.target.value })} placeholder="/dashboard" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
              <datalist id="analytics-pages">
                {pageOptions.map((path) => <option key={path} value={path} />)}
              </datalist>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Evento
              <select value={filters.event_type} onChange={(event) => setFilters({ ...filters, event_type: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                {eventOptions.map((option) => <option key={option} value={option}>{option || 'Tutti'}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Device
              <select value={filters.device} onChange={(event) => setFilters({ ...filters, device: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                {deviceOptions.map((option) => <option key={option} value={option}>{option || 'Tutti'}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Referrer
              <input value={filters.referrer} onChange={(event) => setFilters({ ...filters, referrer: event.target.value })} placeholder="direct, google..." className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center text-sm font-bold text-slate-900">
              Obiettivo percorso
              <InfoTip text="Scegli una pagina o un evento finale per capire quanti passaggi intermedi servono tipicamente agli utenti per arrivarci." />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Pagina obiettivo
                <input list="analytics-target-pages" value={filters.targetPath} onChange={(event) => setFilters({ ...filters, targetPath: event.target.value, targetEvent: event.target.value ? '' : filters.targetEvent })} placeholder="/register" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
                <datalist id="analytics-target-pages">
                  {pageOptions.map((path) => <option key={path} value={path} />)}
                </datalist>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Evento obiettivo
                <select value={filters.targetEvent} onChange={(event) => setFilters({ ...filters, targetEvent: event.target.value, targetPath: event.target.value ? '' : filters.targetPath })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                  {eventOptions.map((option) => <option key={option} value={option}>{option || 'Nessuno'}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={loadAnalytics} disabled={loading} className="btn-primary">Applica filtri</button>
            <button onClick={() => setFilters(defaultFilters())} className="btn-secondary">Reset</button>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="surface rounded-3xl p-12 text-center text-slate-500">Caricamento analytics...</div>
        ) : data && (
          <>
            {data.limited && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Il periodo contiene molti eventi: la query e limitata ai primi campioni disponibili.
              </div>
            )}

            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Visite" value={data.totals.visits} hint="page_view nel periodo" accent="bg-blue-700" explanation={explanations.visite} />
              <StatCard label="Sessioni" value={data.totals.sessions} hint="session_id anonimi unici" accent="bg-green-700" explanation={explanations.sessioni} />
              <StatCard label="Conversioni" value={data.totals.conversions} hint="eventi conversione" accent="bg-orange-500" explanation={explanations.conversioni} />
              <StatCard label="Conversion rate" value={`${data.totals.conversionRate}%`} hint="conversioni su sessioni" accent="bg-slate-800" explanation={explanations.conversionRate} />
              <StatCard label="Eventi" value={data.totals.events} hint="eventi totali analizzati" accent="bg-indigo-600" explanation={explanations.eventi} />
            </section>

            <section className="mb-6 grid gap-6 lg:grid-cols-2">
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.funnel}>Funnel</SectionTitle>
                <div className="space-y-4">
                  {data.funnel.map((step) => (
                    <div key={step.step}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-semibold text-slate-700">{step.step}</span>
                        <span className="text-slate-500">{step.sessions} sessioni · {step.rate}%</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100">
                        <div className="h-3 rounded-full bg-gradient-to-r from-blue-700 to-green-600" style={{ width: `${Math.max(2, step.rate)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.eventi}>Eventi</SectionTitle>
                <BarList rows={data.eventsByType as MetricRow[]} labelKey="event_type" />
              </div>
            </section>

            <section className="mb-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.journey}>Step verso obiettivo</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-blue-50 p-4">
                    <p className="text-xs font-semibold uppercase text-blue-700">Obiettivo</p>
                    <p className="mt-1 break-words text-lg font-bold text-blue-950">{data.journey.target}</p>
                  </div>
                  <div className="rounded-2xl bg-green-50 p-4">
                    <p className="text-xs font-semibold uppercase text-green-700">Sessioni arrivate</p>
                    <p className="mt-1 text-2xl font-extrabold text-green-950">{data.journey.reachedSessions}</p>
                  </div>
                  <div className="rounded-2xl bg-orange-50 p-4">
                    <p className="text-xs font-semibold uppercase text-orange-700">Step medi</p>
                    <p className="mt-1 text-2xl font-extrabold text-orange-950">{data.journey.averageSteps}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-600">Intermedi medi</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-950">{data.journey.averageIntermediateSteps}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Se gli step intermedi medi sono alti per un'azione frequente, e un buon candidato per scorciatoie, CTA piu visibili o navigazione piu diretta.
                </p>
              </div>
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.transitions}>Transizioni piu frequenti</SectionTitle>
                <DataTable
                  rows={data.transitions as unknown as MetricRow[]}
                  columns={[
                    { key: 'from', label: 'Da' },
                    { key: 'to', label: 'A' },
                    { key: 'count', label: 'Volte' },
                  ]}
                />
              </div>
            </section>

            <section className="mb-6">
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.pageRoles}>Destinazione o step intermedio</SectionTitle>
                <p className="mb-4 text-sm leading-6 text-slate-600">
                  Una pagina viene considerata destinazione funzionale quando, prima di spostarsi altrove, l'utente clicca una CTA o interagisce con un form. Se passa alla pagina successiva senza azioni, viene conteggiata come step intermedio.
                </p>
                <DataTable
                  rows={data.pageRoles as unknown as MetricRow[]}
                  columns={[
                    { key: 'path', label: 'Pagina' },
                    { key: 'destinationSessions', label: 'Destinazione' },
                    { key: 'intermediateSessions', label: 'Intermedio' },
                    { key: 'destinationRate', label: 'Dest. %' },
                    { key: 'functionalEvents', label: 'Azioni' },
                  ]}
                />
              </div>
            </section>

            <section className="mb-6 grid gap-6 lg:grid-cols-2">
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation="Distribuzione degli step necessari per raggiungere l'obiettivo scelto.">Distribuzione step</SectionTitle>
                <BarList rows={data.journey.distribution.map((row) => ({ step: `${row.steps} step`, count: row.sessions })) as MetricRow[]} labelKey="step" />
              </div>
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation="Percorsi piu ricorrenti tra le sessioni che raggiungono l'obiettivo selezionato.">Percorsi verso obiettivo</SectionTitle>
                <DataTable
                  rows={data.journey.commonJourneys as unknown as MetricRow[]}
                  columns={[
                    { key: 'path', label: 'Percorso' },
                    { key: 'steps', label: 'Step' },
                    { key: 'count', label: 'Sessioni' },
                  ]}
                />
              </div>
            </section>

            <section className="mb-6 grid gap-6 lg:grid-cols-2">
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.topPages}>Pagine piu visitate</SectionTitle>
                <BarList rows={data.topPages as MetricRow[]} labelKey="path" />
              </div>
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.exitPages}>Pagine di uscita</SectionTitle>
                <DataTable
                  rows={data.exitPages as MetricRow[]}
                  columns={[
                    { key: 'path', label: 'Pagina' },
                    { key: 'count', label: 'Uscite' },
                    { key: 'rate', label: 'Exit rate %' },
                  ]}
                />
              </div>
            </section>

            <section className="mb-6 grid gap-6 lg:grid-cols-2">
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.commonPaths}>Percorsi piu comuni</SectionTitle>
                <DataTable
                  rows={data.commonPaths as MetricRow[]}
                  columns={[
                    { key: 'path', label: 'Percorso' },
                    { key: 'count', label: 'Sessioni' },
                  ]}
                />
              </div>
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.dropOff}>Drop-off</SectionTitle>
                <DataTable
                  rows={data.dropOff as unknown as MetricRow[]}
                  columns={[
                    { key: 'path', label: 'Pagina' },
                    { key: 'views', label: 'Visite' },
                    { key: 'exits', label: 'Uscite' },
                    { key: 'rate', label: 'Rate %' },
                  ]}
                />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.device}>Device</SectionTitle>
                <BarList rows={data.devices as MetricRow[]} labelKey="device" />
              </div>
              <div className="surface rounded-2xl p-5">
                <SectionTitle explanation={explanations.referrer}>Referrer</SectionTitle>
                <BarList rows={data.referrers as MetricRow[]} labelKey="referrer" />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
