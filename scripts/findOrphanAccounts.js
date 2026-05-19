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

async function findOrphanAccounts() {
  console.log('🔍 Ricerca account orfani (in Auth ma non in Firestore)...\n');
  
  try {
    // Ottieni tutti gli utenti da Authentication
    const listUsersResult = await auth.listUsers();
    const authUsers = listUsersResult.users;
    
    console.log(`📊 Trovati ${authUsers.length} utenti in Authentication`);
    
    // Ottieni tutti gli utenti da Firestore
    const firestoreSnapshot = await db.collection('users').get();
    const firestoreUIDs = new Set(firestoreSnapshot.docs.map(doc => doc.id));
    
    console.log(`📊 Trovati ${firestoreUIDs.size} utenti in Firestore\n`);
    
    // Trova gli orfani
    const orphans = authUsers.filter(authUser => !firestoreUIDs.has(authUser.uid));
    
    if (orphans.length === 0) {
      console.log('✅ Nessun account orfano trovato!');
      process.exit(0);
    }
    
    console.log(`⚠️  Trovati ${orphans.length} account orfani:\n`);
    
    orphans.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email || 'No email'}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Creato: ${new Date(user.metadata.creationTime).toLocaleString('it-IT')}`);
      console.log(`   Ultimo accesso: ${user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString('it-IT') : 'Mai'}`);
      console.log(`   Verificato: ${user.emailVerified ? 'Sì' : 'No'}`);
      console.log('');
    });
    
    console.log('\n💡 Opzioni:');
    console.log('   1. Per eliminare questi account: node scripts/deleteOrphanAccounts.js');
    console.log('   2. Per creare profili Firestore minimi: node scripts/createMissingProfiles.js');
    
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

findOrphanAccounts();
