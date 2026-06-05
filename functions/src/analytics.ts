import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import {
  aggregateAnalytics,
  isAnalyticsAdminEmail,
  normalizeDevice,
  normalizeEventType,
  passesAnalyticsFilters,
  sanitizeMetadata,
  sanitizePath,
  sanitizeReferrer,
  sanitizeSessionId,
  AnalyticsFilters,
  UxEventRecord,
} from './analyticsCore';

const MAX_ANALYTICS_EVENTS = 12000;

function assertAdmin(context: functions.https.CallableContext): void {
  const email = context.auth?.token.email;
  if (!context.auth || !isAnalyticsAdminEmail(email)) {
    throw new functions.https.HttpsError('permission-denied', 'Solo admin');
  }
}

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string') return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export const recordUxEvent = functions
  .region('europe-west1')
  .https
  .onCall(async (data, context) => {
    const sessionId = sanitizeSessionId(data?.session_id);
    if (!sessionId) {
      throw new functions.https.HttpsError('invalid-argument', 'session_id non valido');
    }

    const eventType = normalizeEventType(data?.event_type);
    const path = sanitizePath(data?.path);
    const referrer = sanitizeReferrer(data?.referrer);
    const device = normalizeDevice(data?.device);
    const metadata = sanitizeMetadata(data?.metadata);
    const userAgent = typeof context.rawRequest?.headers['user-agent'] === 'string'
      ? context.rawRequest.headers['user-agent'].slice(0, 220)
      : undefined;

    try {
      await admin.firestore().collection('ux_events').add({
        session_id: sessionId,
        path,
        referrer,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        device,
        event_type: eventType,
        metadata,
        userAgent,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ok: true };
    } catch (error) {
      console.error('recordUxEvent failed', error);
      throw new functions.https.HttpsError('internal', 'Errore registrazione evento');
    }
  });

export const getUxAnalytics = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https
  .onCall(async (data, context) => {
    assertAdmin(context);

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 86400000);
    const startDate = parseDate(data?.startDate, defaultStart);
    const endDate = parseDate(data?.endDate, now);
    endDate.setHours(23, 59, 59, 999);

    const filters: AnalyticsFilters = {
      startDate: data?.startDate,
      endDate: data?.endDate,
      path: typeof data?.path === 'string' ? data.path : undefined,
      event_type: typeof data?.event_type === 'string' ? data.event_type : undefined,
      device: typeof data?.device === 'string' ? data.device : undefined,
      referrer: typeof data?.referrer === 'string' ? data.referrer : undefined,
      targetPath: typeof data?.targetPath === 'string' ? data.targetPath : undefined,
      targetEvent: typeof data?.targetEvent === 'string' ? data.targetEvent : undefined,
    };

    try {
      const snap = await admin.firestore()
        .collection('ux_events')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .orderBy('timestamp', 'asc')
        .limit(MAX_ANALYTICS_EVENTS)
        .get();

      const events = snap.docs
        .map((doc) => doc.data() as UxEventRecord)
        .filter((event) => event.timestamp && passesAnalyticsFilters(event, filters));

      return {
        filters,
        limited: snap.size === MAX_ANALYTICS_EVENTS,
        ...aggregateAnalytics(events, {
          targetPath: filters.targetPath,
          targetEvent: filters.targetEvent,
        }),
      };
    } catch (error) {
      console.error('getUxAnalytics failed', error);
      throw new functions.https.HttpsError('internal', 'Errore caricamento analytics');
    }
  });
