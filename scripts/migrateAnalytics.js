/**
 * Initializes UX analytics metadata for Firestore deployments.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/migrateAnalytics.js
 *
 * The ux_events collection is created lazily by the recordUxEvent Cloud Function.
 * Firestore rules keep it inaccessible to clients; firestore.indexes.json contains
 * the timestamp index used by getUxAnalytics.
 */

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function main() {
  await db.collection('metadata').doc('ux_analytics').set({
    schemaVersion: 1,
    collection: 'ux_events',
    fields: [
      'session_id',
      'path',
      'referrer',
      'timestamp',
      'device',
      'event_type',
      'metadata',
    ],
    piiPolicy: 'anonymous_sanitized_metadata_only',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('UX analytics metadata initialized');
}

main().catch((error) => {
  console.error('UX analytics migration failed:', error);
  process.exitCode = 1;
});
