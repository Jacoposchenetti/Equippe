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
const auth = admin.auth();

async function deleteOrphanAccounts() {
  console.log('🗑️  Eliminazione account orfani...\n');
  
  try {
    // Ottieni tutti gli utenti da Authentication
    const listUsersResult = await auth.listUsers();
    const authUsers = listUsersResult.users;
    
    // Ottieni tutti gli utenti da Firestore
    const firestoreSnapshot = await db.collection('users').get();
    const firestoreUIDs = new Set(firestoreSnapshot.docs.map(doc => doc.id));
    
    // Trova gli orfani
    const orphans = authUsers.filter(authUser => !firestoreUIDs.has(authUser.uid));
    
    if (orphans.length === 0) {
      console.log('✅ Nessun account orfano da eliminare!');
      process.exit(0);
    }
    
    console.log(`⚠️  Trovati ${orphans.length} account orfani da eliminare:\n`);
    
    let deleted = 0;
    let errors = 0;
    
    for (const user of orphans) {
      try {
        console.log(`🗑️  Eliminazione: ${user.email || 'No email'} (${user.uid})`);
        await auth.deleteUser(user.uid);
        console.log(`   ✅ Eliminato con successo`);
        deleted++;
      } catch (error) {
        console.error(`   ❌ Errore eliminazione:`, error.message);
        errors++;
      }
      console.log('');
    }
    
    console.log('\n📊 Riepilogo:');
    console.log(`   ✅ Eliminati: ${deleted}`);
    console.log(`   ❌ Errori: ${errors}`);
    
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

deleteOrphanAccounts();
