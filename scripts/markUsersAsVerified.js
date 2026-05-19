/**
 * Script per marcare tutti gli utenti esistenti come email verificata
 * Da eseguire prima di attivare il controllo di verifica email
 */

const { initializeApp } = require('firebase/app');
const { getAuth, updateUser } = require('firebase-admin/auth');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const admin = require('firebase-admin');

// Configurazione Firebase (usa le stesse credenziali del progetto)
const firebaseConfig = {
  // Inserisci qui la configurazione del tuo progetto Firebase
  // Puoi prenderla da src/lib/firebase.ts
};

// Inizializza Firebase Admin
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const adminAuth = admin.auth();
const db = admin.firestore();

async function markExistingUsersAsVerified() {
  try {
    console.log('🔄 Inizio processo di verifica utenti esistenti...');
    
    // Ottieni tutti gli utenti da Firestore
    const usersSnapshot = await db.collection('users').get();
    let processedCount = 0;
    let errorCount = 0;
    
    console.log(`📊 Trovati ${usersSnapshot.size} utenti nel database`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      try {
        // Aggiorna l'utente in Firebase Auth per marcarlo come verificato
        await adminAuth.updateUser(userId, {
          emailVerified: true
        });
        
        console.log(`✅ Utente ${userData.email || userId} marcato come verificato`);
        processedCount++;
        
        // Piccola pausa per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Errore aggiornamento utente ${userId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📈 Processo completato:`);
    console.log(`   ✅ Utenti verificati: ${processedCount}`);
    console.log(`   ❌ Errori: ${errorCount}`);
    console.log(`   📊 Totale processati: ${processedCount + errorCount}`);
    
  } catch (error) {
    console.error('💥 Errore generale:', error);
  }
}

// Esegui lo script
console.log('🚀 Avvio script di verifica utenti esistenti...');
console.log('⚠️  ATTENZIONE: Questo script marcherà TUTTI gli utenti esistenti come email verificata');
console.log('');

// Aggiungi una conferma prima di eseguire
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('Vuoi continuare? (scrivi "SI" per confermare): ', (answer) => {
  if (answer === 'SI') {
    markExistingUsersAsVerified().finally(() => {
      readline.close();
      process.exit(0);
    });
  } else {
    console.log('❌ Operazione annullata');
    readline.close();
    process.exit(0);
  }
});