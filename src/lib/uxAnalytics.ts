import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type UxEventType = 'page_view' | 'click_cta' | 'form_start' | 'form_submit' | 'conversion';

type Device = 'desktop' | 'tablet' | 'mobile' | 'unknown';

interface TrackEventInput {
  event_type: UxEventType;
  path?: string;
  metadata?: Record<string, unknown>;
}

const SESSION_KEY = 'equippe_ux_session_id';
const STARTED_FORMS_KEY = 'equippe_ux_started_forms';
const SENSITIVE_RE = /(email|mail|phone|telefono|tel|name|nome|cognome|password|token|codice|address|indirizzo|iban|fiscal|cf)/i;
const recordUxEvent = httpsCallable(functions, 'recordUxEvent');

function createSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function getUxSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = createSessionId();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getDevice(): Device {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function sanitizeMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  Object.entries(metadata).slice(0, 16).forEach(([key, value]) => {
    if (SENSITIVE_RE.test(key)) return;
    if (typeof value === 'string') clean[key] = value.slice(0, 160);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) clean[key] = value;
  });
  return clean;
}

function currentReferrer(): string {
  const previousPath = sessionStorage.getItem('equippe_ux_previous_path');
  if (previousPath && previousPath !== window.location.pathname) return previousPath;
  return document.referrer || 'direct';
}

export async function trackUxEvent(input: TrackEventInput): Promise<void> {
  try {
    await recordUxEvent({
      session_id: getUxSessionId(),
      path: input.path || window.location.pathname,
      referrer: currentReferrer(),
      device: getDevice(),
      event_type: input.event_type,
      metadata: sanitizeMetadata(input.metadata),
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('UX analytics event skipped', error);
    }
  }
}

export function trackPageView(path: string): void {
  const previousPath = sessionStorage.getItem('equippe_ux_previous_path');
  void trackUxEvent({
    event_type: 'page_view',
    path,
    metadata: previousPath && previousPath !== path ? { previous_path: previousPath } : {},
  });
  sessionStorage.setItem('equippe_ux_previous_path', path);
}

function isLikelyCta(element: HTMLElement): boolean {
  const explicit = element.dataset.analyticsEvent === 'click_cta' || element.dataset.analyticsCta === 'true';
  if (explicit) return true;
  const text = (element.textContent || '').trim().toLowerCase();
  return ['iscriviti', 'registrati', 'crea', 'prenota', 'acquista', 'invia', 'salva', 'continua', 'vedi profilo', 'vedi equipe']
    .some((label) => text.includes(label));
}

function getElementLabel(element: HTMLElement): string {
  return (element.getAttribute('aria-label') || element.dataset.analyticsLabel || element.textContent || element.tagName)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function getFormKey(form: HTMLFormElement): string {
  return form.id || form.getAttribute('name') || form.getAttribute('aria-label') || window.location.pathname;
}

function markFormStarted(form: HTMLFormElement): boolean {
  const key = getFormKey(form);
  const started = new Set(JSON.parse(sessionStorage.getItem(STARTED_FORMS_KEY) || '[]') as string[]);
  if (started.has(key)) return false;
  started.add(key);
  sessionStorage.setItem(STARTED_FORMS_KEY, JSON.stringify([...started]));
  return true;
}

function isConversionForm(form: HTMLFormElement): boolean {
  const key = getFormKey(form).toLowerCase();
  const path = window.location.pathname.toLowerCase();
  return key.includes('waitlist') || key.includes('register') || key.includes('booking') ||
    path.includes('register') || path.includes('waitlist') || path.includes('paziente/registrati');
}

export function installUxAutoTracking(): () => void {
  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const element = target?.closest('button, a, [role="button"], [data-analytics-event]') as HTMLElement | null;
    if (!element || !isLikelyCta(element)) return;
    void trackUxEvent({
      event_type: 'click_cta',
      metadata: {
        label: getElementLabel(element),
        tag: element.tagName.toLowerCase(),
        href: element instanceof HTMLAnchorElement ? element.pathname : undefined,
      },
    });
  };

  const handleFocusIn = (event: FocusEvent) => {
    const target = event.target as HTMLElement | null;
    const form = target?.closest('form') as HTMLFormElement | null;
    if (!form || !markFormStarted(form)) return;
    void trackUxEvent({
      event_type: 'form_start',
      metadata: { form: getFormKey(form) },
    });
  };

  const handleSubmit = (event: SubmitEvent) => {
    const form = event.target as HTMLFormElement | null;
    if (!form) return;
    const conversion = isConversionForm(form);
    void trackUxEvent({
      event_type: 'form_submit',
      metadata: { form: getFormKey(form), conversion },
    });
    if (conversion) {
      void trackUxEvent({
        event_type: 'conversion',
        metadata: { source: 'form_submit', form: getFormKey(form) },
      });
    }
  };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('submit', handleSubmit, true);

  return () => {
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('focusin', handleFocusIn, true);
    document.removeEventListener('submit', handleSubmit, true);
  };
}
