const admin = require('firebase-admin');

// Inizializza Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateStudiField() {
  console.log('🚀 Inizio migrazione campo "studi" per tutti gli utenti...');
  
  try {
    // Ottieni tutti gli utenti
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Trovati ${usersSnapshot.size} utenti`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Processa ogni utente
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      try {
        // Controlla se ha già il campo studi
        if (userData.profile?.studi && Array.isArray(userData.profile.studi) && userData.profile.studi.length > 0) {
          console.log(`⏩ Utente ${userData.profile?.nome || userId} ha già studi configurati, salto`);
          skippedCount++;
          continue;
        }
        
        // Controlla se ha dati location da migrare
        const location = userData.profile?.location;
        if (!location || !location.indirizzo) {
          console.log(`⚠️  Utente ${userData.profile?.nome || userId} non ha indirizzo location, salto`);
          skippedCount++;
          continue;
        }
        
        // Crea il studio basato sui dati location esistenti
        const studio = {
          indirizzo: location.indirizzo,
          città: location.città || '',
          provincia: location.provincia || '',
          remoto: false, // Default false
          coordinate: {
            lat: location.lat || 0,
            lng: location.lng || 0
          }
        };
        
        // Aggiorna il documento utente
        await userDoc.ref.update({
          'profile.studi': [studio],
          'updatedAt': admin.firestore.Timestamp.now()
        });
        
        console.log(`✅ Migrato utente: ${userData.profile?.nome || userId}`);
        console.log(`   📍 Studio: ${studio.indirizzo}`);
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Errore migrazione utente ${userId}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📈 RIEPILOGO MIGRAZIONE:');
    console.log(`✅ Utenti migrati: ${migratedCount}`);
    console.log(`⏩ Utenti saltati: ${skippedCount}`);
    console.log(`❌ Errori: ${errorCount}`);
    console.log(`📊 Totale processati: ${migratedCount + skippedCount + errorCount}`);
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

// Funzione per rollback (opzionale)
async function rollbackStudiField() {
  console.log('🔄 Inizio rollback campo "studi"...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Trovati ${usersSnapshot.size} utenti`);
    
    let rollbackCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      if (userData.profile?.studi) {
        await userDoc.ref.update({
          'profile.studi': admin.firestore.FieldValue.delete(),
          'updatedAt': admin.firestore.Timestamp.now()
        });
        
        console.log(`🔄 Rollback utente: ${userData.profile?.nome || userId}`);
        rollbackCount++;
      }
    }
    
    console.log(`\n✅ Rollback completato: ${rollbackCount} utenti`);
    
  } catch (error) {
    console.error('❌ Errore rollback:', error);
  }
}

// Esegui la migrazione
if (require.main === module) {
  const action = process.argv[2];
  
  if (action === 'rollback') {
    rollbackStudiField()
      .then(() => {
        console.log('🎉 Rollback completato!');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Errore durante il rollback:', error);
        process.exit(1);
      });
  } else {
    migrateStudiField()
      .then(() => {
        console.log('🎉 Migrazione completata!');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Errore durante la migrazione:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  migrateStudiField,
  rollbackStudiField
};