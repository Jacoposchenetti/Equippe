/**
 * Script per verificare tutti gli utenti in Firestore vs Firebase Auth
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
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const auth = admin.auth();
const db = admin.firestore();

async function compareAuthAndFirestore() {
  console.log('🔍 Confronto Firebase Auth vs Firestore\n');

  try {
    // Ottieni utenti da Auth
    const authUsers = await auth.listUsers();
    console.log(`👥 FIREBASE AUTH: ${authUsers.users.length} utenti\n`);
    
    const authMap = new Map();
    for (const user of authUsers.users) {
      authMap.set(user.uid, {
        email: user.email,
        emailVerified: user.emailVerified,
        created: user.metadata.creationTime
      });
      console.log(`📧 ${user.email}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Email Verificata: ${user.emailVerified ? '✅' : '❌'}`);
      console.log(`   Creato: ${new Date(user.metadata.creationTime).toLocaleString('it-IT')}`);
    }

    // Ottieni utenti da Firestore
    console.log('\n\n💾 FIRESTORE USERS COLLECTION:\n');
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Documenti trovati: ${usersSnapshot.size}\n`);
    
    const firestoreUids = new Set();
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      firestoreUids.add(doc.id);
      console.log(`📄 ${data.email || 'NO EMAIL'}`);
      console.log(`   UID: ${doc.id}`);
      console.log(`   Nome: ${data.profile?.nome || 'N/A'}`);
      console.log(`   Status: ${data.profile?.verificationInfo?.status || 'N/A'}`);
      console.log(`   Creato: ${data.createdAt?.toDate?.().toLocaleString('it-IT') || 'N/A'}`);
      console.log();
    }

    // Trova discrepanze
    console.log('\n⚠️  DISCREPANZE:\n');
    let foundIssues = false;
    
    for (const [uid, authData] of authMap.entries()) {
      if (!firestoreUids.has(uid)) {
        console.log(`❌ MANCA IN FIRESTORE: ${authData.email} (UID: ${uid})`);
        console.log(`   Creato in Auth: ${new Date(authData.created).toLocaleString('it-IT')}`);
        console.log();
        foundIssues = true;
      }
    }
    
    if (!foundIssues) {
      console.log('✅ Nessuna discrepanza trovata - tutti gli utenti Auth hanno profilo Firestore');
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    process.exit(0);
  }
}

compareAuthAndFirestore();
