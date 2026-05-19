/**
 * Script per verificare la configurazione Firebase Authentication
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inizializza Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const auth = admin.auth();

async function checkAuthConfig() {
  console.log('🔍 Verifica configurazione Firebase Authentication\n');

  try {
    console.log('📋 Project ID:', serviceAccount.project_id);
    console.log('📧 Auth Domain:', `${serviceAccount.project_id}.firebaseapp.com`);
    
    // Ottieni tutti gli utenti e controlla il loro stato
    const listUsersResult = await auth.listUsers();
    const users = listUsersResult.users;
    
    console.log(`\n👥 Utenti totali: ${users.length}\n`);
    
    for (const user of users) {
      console.log(`📧 ${user.email}`);
      console.log(`   Email Verificata: ${user.emailVerified ? '✅' : '❌'}`);
      console.log(`   Provider: ${user.providerData.map(p => p.providerId).join(', ')}`);
      console.log(`   Creato: ${new Date(user.metadata.creationTime).toLocaleString('it-IT')}`);
      console.log(`   Ultimo login: ${new Date(user.metadata.lastSignInTime).toLocaleString('it-IT')}`);
      
      // Controlla se l'utente ha token validi
      try {
        const customToken = await auth.createCustomToken(user.uid);
        console.log(`   Token: ✅ Valido`);
      } catch (err) {
        console.log(`   Token: ❌ Errore - ${err.message}`);
      }
      console.log();
    }

    // Informazioni sui limiti di Firebase
    console.log('\n⚠️  LIMITI FIREBASE EMAIL VERIFICATION:');
    console.log('   - Max 1 email ogni 60 secondi per lo stesso utente');
    console.log('   - Max 5 email al giorno per lo stesso indirizzo');
    console.log('   - Il link di verifica scade dopo 3 giorni');
    console.log('\n💡 CAUSE COMUNI ERRORI:');
    console.log('   1. Too many requests: hai già inviato un\'email recentemente');
    console.log('   2. Network error: problemi di connessione');
    console.log('   3. Invalid action code: link di verifica scaduto o già usato');
    console.log('   4. Email template non configurato nella console Firebase');

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    process.exit(0);
  }
}

checkAuthConfig();
