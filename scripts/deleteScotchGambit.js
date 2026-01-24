/**
 * Script per eliminare l'account scotchgambit e permettere una nuova registrazione
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

async function deleteScotchGambit() {
  console.log('🗑️  Eliminazione account incompleto scotchgambit230700@gmail.com\n');

  try {
    // Trova l'utente
    const user = await auth.getUserByEmail('scotchgambit230700@gmail.com');
    
    console.log('📧 Utente trovato:');
    console.log(`   Email: ${user.email}`);
    console.log(`   UID: ${user.uid}`);
    console.log(`   Email Verificata: ${user.emailVerified ? '✅' : '❌'}`);
    console.log(`   Creato: ${new Date(user.metadata.creationTime).toLocaleString('it-IT')}`);
    
    // Elimina l'account
    await auth.deleteUser(user.uid);
    console.log('\n✅ Account eliminato con successo da Firebase Auth');
    console.log('\n💡 L\'utente può ora registrarsi di nuovo con la stessa email');

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('❌ Utente non trovato');
    } else {
      console.error('❌ Errore:', error);
    }
  } finally {
    process.exit(0);
  }
}

deleteScotchGambit();
