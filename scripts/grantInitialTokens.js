/**
 * One-time migration: grant 10 tokens to all existing users who don't have tokenBalance set.
 * Idempotent: skips users who already have a tokenBalance (including 0).
 *
 * Run: node scripts/grantInitialTokens.js
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const INITIAL_TOKENS = 10;
const BATCH_SIZE = 400; // Firestore batch limit is 500

async function grantInitialTokens() {
  console.log('🪙  Avvio concessione token iniziali...');

  const snapshot = await db.collection('users').get();
  const usersWithoutTokens = snapshot.docs.filter(
    (d) => d.data().tokenBalance === undefined || d.data().tokenBalance === null
  );

  console.log(`👥 Utenti totali: ${snapshot.size}`);
  console.log(`🎯 Utenti senza tokenBalance: ${usersWithoutTokens.length}`);

  if (usersWithoutTokens.length === 0) {
    console.log('✅ Nessun aggiornamento necessario.');
    process.exit(0);
  }

  let updated = 0;
  // Process in batches
  for (let i = 0; i < usersWithoutTokens.length; i += BATCH_SIZE) {
    const chunk = usersWithoutTokens.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const userDoc of chunk) {
      batch.update(userDoc.ref, { tokenBalance: INITIAL_TOKENS });
    }
    await batch.commit();
    updated += chunk.length;
    console.log(`  ✔ Aggiornati ${updated}/${usersWithoutTokens.length}...`);
  }

  console.log(`\n✅ Done! ${updated} utenti ricevono ${INITIAL_TOKENS} token.`);
  process.exit(0);
}

grantInitialTokens().catch((err) => {
  console.error('❌ Errore:', err);
  process.exit(1);
});
