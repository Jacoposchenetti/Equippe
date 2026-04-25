import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const auth = admin.auth();

const TARGET_EMAIL = 'noto@grownnectia.com';

async function provision() {
  // 1. Recupera UID da Firebase Auth
  const userRecord = await auth.getUserByEmail(TARGET_EMAIL);
  const uid = userRecord.uid;
  console.log(`✅ Trovato in Auth — UID: ${uid}`);

  // 2. Crea documento Firestore con status approved
  const now = admin.firestore.Timestamp.now();
  await db.collection('users').doc(uid).set({
    uid,
    email: TARGET_EMAIL,
    profile: {
      nome: userRecord.displayName || '',
      specializzazioni: [],
      tematiche: [],
      esperienza: '',
      verified: true,
      verificationInfo: {
        status: 'approved',
        submittedAt: now,
        lastCheckedAt: now,
        checkedBy: 'manual-provision',
        notes: 'Provisioning manuale — accesso diretto',
      },
    },
    teams: [],
    stats: { referralsSent: 0, referralsReceived: 0 },
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  console.log(`🎉 Documento Firestore creato/aggiornato per ${TARGET_EMAIL}`);
  console.log(`   L'utente può ora accedere al sito normalmente.`);
}

provision().catch(console.error).finally(() => process.exit());
