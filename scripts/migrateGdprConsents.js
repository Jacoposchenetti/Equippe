// Script per aggiornare utenti esistenti con consensi GDPR
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } = require('firebase/firestore');

// Configurazione Firebase (sostituisci con la tua configurazione)
const firebaseConfig = {
  apiKey: "AIzaSyATt8ZmGZ9MFHjW3xAuGODu5LgA1L9rCZo",
  authDomain: "equippe-271f5.firebaseapp.com",
  projectId: "equippe-271f5",
  storageBucket: "equippe-271f5.firebasestorage.app",
  messagingSenderId: "956363253556",
  appId: "1:956363253556:web:fa3dab3fa5fe881cae08e5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateUserConsents() {
  try {
    console.log('🔄 Inizio migrazione consensi GDPR per utenti esistenti...');
    
    // Carica tutti gli utenti
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let updated = 0;
    let skipped = 0;
    
    const migrationTimestamp = Timestamp.now();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      console.log(`📋 Controllo utente: ${userData.profile?.nome || userId}`);
      
      // Se l'utente non ha già i consensi, aggiungili
      if (!userData.consents) {
        console.log(`  ➕ Aggiungendo consensi per ${userData.profile?.nome || userId}`);
        
        const consentsData = {
          consents: {
            termini: { 
              accepted: true, 
              timestamp: migrationTimestamp,
              migrated: true // Flag per indicare che è stata una migrazione
            },
            privacy: { 
              accepted: true, 
              timestamp: migrationTimestamp,
              migrated: true
            },
            marketing: { 
              accepted: false, // Conservativo per marketing
              timestamp: migrationTimestamp,
              migrated: true
            }
          }
        };
        
        await updateDoc(doc(db, 'users', userId), consentsData);
        updated++;
        console.log(`  ✅ Consensi aggiunti per ${userData.profile?.nome || userId}`);
      } else {
        console.log(`  ⏭️ Utente ${userData.profile?.nome || userId} ha già i consensi`);
        skipped++;
      }
    }
    
    console.log(`\n🎉 Migrazione completata:`);
    console.log(`   📈 Utenti aggiornati: ${updated}`);
    console.log(`   ⏭️ Utenti saltati: ${skipped}`);
    console.log(`   📅 Timestamp migrazione: ${migrationTimestamp.toDate()}`);
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
  }
}

// Esegui la migrazione
migrateUserConsents().then(() => {
  console.log('✨ Script completato');
  process.exit(0);
});