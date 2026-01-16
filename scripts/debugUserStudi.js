const admin = require('firebase-admin');

// Inizializza Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function debugUserStudi() {
  console.log('🔍 Debug studi utenti...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      console.log(`\n👤 Utente: ${userData.profile?.nome || userId}`);
      console.log('📧 Email:', userData.email);
      
      // Location principale
      if (userData.profile?.location) {
        const loc = userData.profile.location;
        console.log('📍 Location principale:');
        console.log(`   Indirizzo: ${loc.indirizzo || 'N/A'}`);
        console.log(`   Città: ${loc.città || 'N/A'}`);
        console.log(`   Coordinate: ${loc.lat || 0}, ${loc.lng || 0}`);
      }
      
      // Studi
      if (userData.profile?.studi?.length) {
        console.log('🏢 Studi:');
        userData.profile.studi.forEach((studio, idx) => {
          console.log(`   Studio ${idx + 1}:`);
          console.log(`     Indirizzo: ${studio.indirizzo}`);
          console.log(`     Città: ${studio.città || 'N/A'}`);
          console.log(`     Coordinate: ${studio.coordinate?.lat || 0}, ${studio.coordinate?.lng || 0}`);
          console.log(`     Remoto: ${studio.remoto}`);
        });
      } else {
        console.log('🏢 Studi: Nessuno');
      }
      
      console.log('─'.repeat(50));
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

debugUserStudi();