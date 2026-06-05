import * as admin from 'firebase-admin';

export const UX_EVENT_TYPES = [
  'page_view',
  'click_cta',
  'form_start',
  'form_submit',
  'conversion',
] as const;

export const ANALYTICS_ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

export type UxEventType = typeof UX_EVENT_TYPES[number];

export function isAnalyticsAdminEmail(email?: string): boolean {
  return !!email && ANALYTICS_ADMIN_EMAILS.includes(email);
}

export interface UxEventRecord {
  session_id: string;
  path: string;
  referrer: string;
  timestamp: admin.firestore.Timestamp;
  device: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  event_type: UxEventType;
  metadata: Record<string, unknown>;
  userAgent?: string;
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  path?: string;
  event_type?: string;
  device?: string;
  referrer?: string;
  targetPath?: string;
  targetEvent?: string;
}

export interface AggregatedAnalytics {
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
  funnel: Array<{ step: string; sessions: number; rate: number }>;
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
}

const MAX_STRING_LENGTH = 180;
const MAX_METADATA_KEYS = 16;
const SENSITIVE_KEY_RE = /(email|e-mail|mail|phone|telefono|tel|name|nome|cognome|password|token|codice|address|indirizzo|fiscal|cf|tax|iban|card)/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\s.-]?){7,}/;

function truncate(value: string, max = MAX_STRING_LENGTH): string {
  return value.slice(0, max);
}

function stripQueryAndHash(value: string): string {
  const clean = value.split('#')[0].split('?')[0];
  return clean || '/';
}

export function sanitizePath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return '/';
  return truncate(stripQueryAndHash(trimmed), 220);
}

export function sanitizeReferrer(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'direct';
  try {
    const url = new URL(value);
    return truncate(`${url.origin}${url.pathname}`, 220);
  } catch {
    return truncate(stripQueryAndHash(value.trim()), 220);
  }
}

export function sanitizeSessionId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  return clean.length >= 12 ? clean : '';
}

export function normalizeDevice(value: unknown): UxEventRecord['device'] {
  return value === 'desktop' || value === 'tablet' || value === 'mobile' ? value : 'unknown';
}

export function normalizeEventType(value: unknown): UxEventType {
  return UX_EVENT_TYPES.includes(value as UxEventType) ? value as UxEventType : 'page_view';
}

export function sanitizeMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(input).slice(0, MAX_METADATA_KEYS)) {
    const key = rawKey.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40);
    if (!key || SENSITIVE_KEY_RE.test(key)) continue;
    if (typeof rawValue === 'string') {
      if (EMAIL_RE.test(rawValue) || PHONE_RE.test(rawValue)) continue;
      output[key] = truncate(rawValue);
    } else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      output[key] = rawValue;
    } else if (typeof rawValue === 'boolean') {
      output[key] = rawValue;
    } else if (rawValue === null) {
      output[key] = null;
    }
  }
  return output;
}

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) || 0) + amount);
}

function toList(map: Map<string, number>, keyName: string, limit = 10): Array<Record<string, string | number>> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ [keyName]: key, count }));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
}

function toMillis(event: UxEventRecord): number {
  return event.timestamp?.toMillis?.() || 0;
}

export function aggregateAnalytics(events: UxEventRecord[], options: Pick<AnalyticsFilters, 'targetPath' | 'targetEvent'> = {}): AggregatedAnalytics {
  const sorted = [...events].sort((a, b) => toMillis(a) - toMillis(b));
  const sessions = new Map<string, UxEventRecord[]>();
  const pageViews = new Map<string, number>();
  const exits = new Map<string, number>();
  const eventTypes = new Map<string, number>();
  const devices = new Map<string, number>();
  const referrers = new Map<string, number>();
  const commonPaths = new Map<string, number>();
  const transitions = new Map<string, number>();
  const pageRoleStats = new Map<string, {
    destinationSessions: Set<string>;
    intermediateSessions: Set<string>;
    functionalEvents: number;
  }>();

  for (const event of sorted) {
    if (!sessions.has(event.session_id)) sessions.set(event.session_id, []);
    sessions.get(event.session_id)!.push(event);
    increment(eventTypes, event.event_type);
    increment(devices, event.device);
    increment(referrers, event.referrer || 'direct');
    if (event.event_type === 'page_view') increment(pageViews, event.path);
  }

  for (const sessionEvents of sessions.values()) {
    const orderedSessionEvents = [...sessionEvents].sort((a, b) => toMillis(a) - toMillis(b));
    const sessionPageViews = orderedSessionEvents.filter((event) => event.event_type === 'page_view');
    const lastPage = sessionPageViews[sessionPageViews.length - 1];
    if (lastPage) increment(exits, lastPage.path);
    const sequence = sessionPageViews.map((event) => event.path);
    for (let index = 1; index < sequence.length; index += 1) {
      increment(transitions, `${sequence[index - 1]} -> ${sequence[index]}`);
    }
    if (sequence.length > 1) {
      increment(commonPaths, sequence.slice(0, 5).join(' -> '));
    }

    for (let pageIndex = 0; pageIndex < sessionPageViews.length; pageIndex += 1) {
      const pageView = sessionPageViews[pageIndex];
      const nextPageView = sessionPageViews[pageIndex + 1];
      const pageStart = toMillis(pageView);
      const pageEnd = nextPageView ? toMillis(nextPageView) : Number.POSITIVE_INFINITY;
      const functionalEvents = orderedSessionEvents.filter((event) =>
        event.path === pageView.path &&
        toMillis(event) >= pageStart &&
        toMillis(event) < pageEnd &&
        ['click_cta', 'form_start', 'form_submit', 'conversion'].includes(event.event_type)
      );

      if (!pageRoleStats.has(pageView.path)) {
        pageRoleStats.set(pageView.path, {
          destinationSessions: new Set<string>(),
          intermediateSessions: new Set<string>(),
          functionalEvents: 0,
        });
      }
      const stats = pageRoleStats.get(pageView.path)!;
      if (functionalEvents.length > 0) {
        stats.destinationSessions.add(pageView.session_id);
        stats.functionalEvents += functionalEvents.length;
      } else if (nextPageView) {
        stats.intermediateSessions.add(pageView.session_id);
      }
    }
  }

  const conversionSessions = new Set<string>();
  const formStartSessions = new Set<string>();
  const formSubmitSessions = new Set<string>();
  const pageViewSessions = new Set<string>();
  let conversions = 0;
  let visits = 0;

  for (const event of sorted) {
    if (event.event_type === 'page_view') {
      visits += 1;
      pageViewSessions.add(event.session_id);
    }
    if (event.event_type === 'form_start') formStartSessions.add(event.session_id);
    if (event.event_type === 'form_submit') formSubmitSessions.add(event.session_id);
    if (event.event_type === 'conversion' || event.metadata.conversion === true) {
      conversions += 1;
      conversionSessions.add(event.session_id);
    }
  }

  const sessionCount = sessions.size;
  const dropOff = [...pageViews.entries()]
    .map(([path, views]) => {
      const exitCount = exits.get(path) || 0;
      return { path, views, exits: exitCount, rate: views ? Math.round((exitCount / views) * 1000) / 10 : 0 };
    })
    .sort((a, b) => b.rate - a.rate || b.views - a.views)
    .slice(0, 10);

  const funnelSteps = [
    { step: 'Page view', sessions: pageViewSessions.size },
    { step: 'Form start', sessions: formStartSessions.size },
    { step: 'Form submit', sessions: formSubmitSessions.size },
    { step: 'Conversione', sessions: conversionSessions.size },
  ];
  const firstStepSessions = Math.max(1, funnelSteps[0].sessions);
  const targetPath = options.targetPath ? sanitizePath(options.targetPath) : '';
  const targetEvent = options.targetEvent && UX_EVENT_TYPES.includes(options.targetEvent as UxEventType)
    ? options.targetEvent
    : '';
  const journeyTarget = targetPath || targetEvent || 'conversion';
  const journeyStepCounts: number[] = [];
  const journeyDistribution = new Map<string, number>();
  const journeyPaths = new Map<string, { count: number; steps: number }>();

  for (const sessionEvents of sessions.values()) {
    const ordered = [...sessionEvents].sort((a, b) => toMillis(a) - toMillis(b));
    const pageSequence: string[] = [];
    let targetPageIndex = -1;
    let reachedTarget = false;

    for (const event of ordered) {
      if (event.event_type === 'page_view') {
        pageSequence.push(event.path);
        if (targetPath && event.path === targetPath && targetPageIndex === -1) {
          targetPageIndex = pageSequence.length - 1;
          reachedTarget = true;
          break;
        }
      }

      const isTargetEvent = targetEvent
        ? event.event_type === targetEvent
        : event.event_type === 'conversion' || event.metadata.conversion === true;
      if (!targetPath && isTargetEvent) {
        reachedTarget = true;
        break;
      }
    }

    if (!reachedTarget) continue;

    const steps = targetPath && targetPageIndex >= 0
      ? targetPageIndex
      : Math.max(0, pageSequence.length - 1);
    journeyStepCounts.push(steps);
    increment(journeyDistribution, String(steps));
    const compactJourney = pageSequence.slice(0, targetPath && targetPageIndex >= 0 ? targetPageIndex + 1 : undefined).slice(0, 8).join(' -> ') || '(nessuna pagina)';
    const existing = journeyPaths.get(compactJourney);
    journeyPaths.set(compactJourney, {
      count: (existing?.count || 0) + 1,
      steps,
    });
  }

  return {
    totals: {
      visits,
      sessions: sessionCount,
      conversions,
      conversionRate: sessionCount ? Math.round((conversions / sessionCount) * 1000) / 10 : 0,
      events: events.length,
    },
    topPages: toList(pageViews, 'path') as Array<{ path: string; count: number }>,
    exitPages: [...exits.entries()]
      .map(([path, count]) => ({
        path,
        count,
        rate: pageViews.get(path) ? Math.round((count / (pageViews.get(path) || 1)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    commonPaths: toList(commonPaths, 'path') as Array<{ path: string; count: number }>,
    dropOff,
    funnel: funnelSteps.map((step) => ({
      ...step,
      rate: Math.round((step.sessions / firstStepSessions) * 1000) / 10,
    })),
    eventsByType: toList(eventTypes, 'event_type') as Array<{ event_type: string; count: number }>,
    devices: toList(devices, 'device') as Array<{ device: string; count: number }>,
    referrers: toList(referrers, 'referrer') as Array<{ referrer: string; count: number }>,
    transitions: [...transitions.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([transition, count]) => {
        const [from, to] = transition.split(' -> ');
        return { from, to, count };
      }),
    pageRoles: [...pageRoleStats.entries()]
      .map(([path, stats]) => {
        const destinationSessions = stats.destinationSessions.size;
        const intermediateSessions = stats.intermediateSessions.size;
        const total = destinationSessions + intermediateSessions;
        return {
          path,
          destinationSessions,
          intermediateSessions,
          destinationRate: total ? Math.round((destinationSessions / total) * 1000) / 10 : 0,
          functionalEvents: stats.functionalEvents,
        };
      })
      .sort((a, b) => b.destinationSessions - a.destinationSessions || b.functionalEvents - a.functionalEvents)
      .slice(0, 15),
    journey: {
      target: journeyTarget,
      reachedSessions: journeyStepCounts.length,
      averageSteps: journeyStepCounts.length
        ? Math.round((journeyStepCounts.reduce((sum, value) => sum + value, 0) / journeyStepCounts.length) * 10) / 10
        : 0,
      medianSteps: median(journeyStepCounts),
      averageIntermediateSteps: journeyStepCounts.length
        ? Math.round((journeyStepCounts.reduce((sum, value) => sum + Math.max(0, value - 1), 0) / journeyStepCounts.length) * 10) / 10
        : 0,
      distribution: [...journeyDistribution.entries()]
        .map(([steps, count]) => ({ steps: Number(steps), sessions: count }))
        .sort((a, b) => a.steps - b.steps),
      commonJourneys: [...journeyPaths.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([path, value]) => ({ path, count: value.count, steps: value.steps })),
    },
  };
}

export function passesAnalyticsFilters(event: UxEventRecord, filters: AnalyticsFilters): boolean {
  if (filters.path && event.path !== sanitizePath(filters.path)) return false;
  if (filters.event_type && event.event_type !== filters.event_type) return false;
  if (filters.device && event.device !== filters.device) return false;
  if (filters.referrer && !event.referrer.toLowerCase().includes(filters.referrer.toLowerCase())) return false;
  return true;
}
