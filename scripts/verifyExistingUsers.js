/**
 * Script per verificare manualmente le email degli utenti esistenti
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

async function verifyExistingUsers() {
  console.log('📧 Verifica email per utenti esistenti\n');

  try {
    // Ottieni tutti gli utenti
    const listUsersResult = await auth.listUsers();
    const users = listUsersResult.users;

    console.log(`👥 Trovati ${users.length} utenti\n`);

    // Utenti da verificare automaticamente (configurabili)
    const usersToVerify = (
      process.env.USERS_TO_VERIFY || 'admin@tuaequipe.it,info@tuaequipe.it,support@tuaequipe.it'
    )
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    let verified = 0;
    let errors = 0;

    for (const user of users) {
      if (user.email && usersToVerify.includes(user.email.toLowerCase())) {
        console.log(`📧 ${user.email}`);
        console.log(`   Stato attuale: ${user.emailVerified ? '✅ Verificata' : '❌ Non verificata'}`);
        
        if (!user.emailVerified) {
          try {
            await auth.updateUser(user.uid, {
              emailVerified: true
            });
            console.log(`   ✅ Email VERIFICATA manualmente (utente esistente pre-sistema)`);
            verified++;
          } catch (err) {
            console.log(`   ❌ Errore: ${err.message}`);
            errors++;
          }
        } else {
          console.log(`   ℹ️  Già verificata, nessuna azione necessaria`);
        }
        console.log();
      }
    }

    console.log('\n📊 Riepilogo:');
    console.log(`   ✅ Verificate: ${verified}`);
    console.log(`   ❌ Errori: ${errors}`);

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    process.exit(0);
  }
}

verifyExistingUsers();
