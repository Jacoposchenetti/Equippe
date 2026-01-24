/**
 * Script per verificare lo stato email_verified di un utente
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inizializza Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const auth = admin.auth();

async function checkEmailVerified() {
  console.log('🔍 Controllo stato email verificata per tutti gli utenti\n');

  try {
    const listUsersResult = await auth.listUsers();
    const users = listUsersResult.users;

    console.log(`📊 Trovati ${users.length} utenti:\n`);

    for (const user of users) {
      console.log(`📧 Email: ${user.email}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Email Verificata: ${user.emailVerified ? '✅ SÌ' : '❌ NO'}`);
      console.log(`   Creato: ${new Date(user.metadata.creationTime).toLocaleString('it-IT')}`);
      console.log(`   Ultimo accesso: ${new Date(user.metadata.lastSignInTime).toLocaleString('it-IT')}`);
      console.log();
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    process.exit(0);
  }
}

checkEmailVerified();
