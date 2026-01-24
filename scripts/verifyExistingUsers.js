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
  readFileSync(join(__dirname, '../serviceAccountKey.json'), 'utf8')
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

    // Utenti da verificare automaticamente (esistenti prima del sistema)
    const usersToVerify = [
      'martinamaccarana@icloud.com',
      'jschenetti@gmail.com',
      'jacopo.schenetti@unitn.it'
    ];

    let verified = 0;
    let errors = 0;

    for (const user of users) {
      if (usersToVerify.includes(user.email)) {
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
