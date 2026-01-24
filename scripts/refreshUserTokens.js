/**
 * Script per forzare il refresh dei token degli utenti
 * Questo è necessario dopo aver modificato le regole Firestore per includere email_verified nei token
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

async function refreshUserTokens() {
  console.log('🔄 Refreshing user tokens...\n');

  try {
    // Ottieni tutti gli utenti
    const listUsersResult = await auth.listUsers();
    const users = listUsersResult.users;

    console.log(`📊 Trovati ${users.length} utenti\n`);

    let updated = 0;
    let errors = 0;

    for (const user of users) {
      try {
        console.log(`\n🔍 Utente: ${user.email}`);
        console.log(`   UID: ${user.uid}`);
        console.log(`   Email verificata: ${user.emailVerified ? '✅' : '❌'}`);

        // Forza la rievocazione dei token esistenti
        await auth.revokeRefreshTokens(user.uid);
        console.log(`   ✅ Token revocati - l'utente dovrà rifare il login per ottenere un nuovo token con email_verified aggiornato`);
        
        updated++;
      } catch (error) {
        console.error(`   ❌ Errore per ${user.email}:`, error.message);
        errors++;
      }
    }

    console.log('\n\n📊 Riepilogo:');
    console.log(`   ✅ Token revocati: ${updated}`);
    console.log(`   ❌ Errori: ${errors}`);
    console.log('\n⚠️  IMPORTANTE: Gli utenti dovranno rifare il login per ottenere un nuovo token aggiornato\n');

  } catch (error) {
    console.error('❌ Errore generale:', error);
  } finally {
    process.exit(0);
  }
}

refreshUserTokens();
