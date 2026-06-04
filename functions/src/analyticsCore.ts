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

function toMillis(event: UxEventRecord): number {
  return event.timestamp?.toMillis?.() || 0;
}

export function aggregateAnalytics(events: UxEventRecord[]): AggregatedAnalytics {
  const sorted = [...events].sort((a, b) => toMillis(a) - toMillis(b));
  const sessions = new Map<string, UxEventRecord[]>();
  const pageViews = new Map<string, number>();
  const exits = new Map<string, number>();
  const eventTypes = new Map<string, number>();
  const devices = new Map<string, number>();
  const referrers = new Map<string, number>();
  const commonPaths = new Map<string, number>();

  for (const event of sorted) {
    if (!sessions.has(event.session_id)) sessions.set(event.session_id, []);
    sessions.get(event.session_id)!.push(event);
    increment(eventTypes, event.event_type);
    increment(devices, event.device);
    increment(referrers, event.referrer || 'direct');
    if (event.event_type === 'page_view') increment(pageViews, event.path);
  }

  for (const sessionEvents of sessions.values()) {
    const sessionPageViews = sessionEvents.filter((event) => event.event_type === 'page_view');
    const lastPage = sessionPageViews[sessionPageViews.length - 1];
    if (lastPage) increment(exits, lastPage.path);
    const sequence = sessionPageViews.map((event) => event.path);
    if (sequence.length > 1) {
      increment(commonPaths, sequence.slice(0, 5).join(' -> '));
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
  };
}

export function passesAnalyticsFilters(event: UxEventRecord, filters: AnalyticsFilters): boolean {
  if (filters.path && event.path !== sanitizePath(filters.path)) return false;
  if (filters.event_type && event.event_type !== filters.event_type) return false;
  if (filters.device && event.device !== filters.device) return false;
  if (filters.referrer && !event.referrer.toLowerCase().includes(filters.referrer.toLowerCase())) return false;
  return true;
}
