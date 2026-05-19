const admin = require('firebase-admin');

// Inizializza Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Funzione per ottenere coordinate da indirizzo usando OpenStreetMap Nominatim (gratuito)
async function geocodeAddress(address) {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EquippeApp/1.0'
      }
    });
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Errore geocoding:', error);
    return null;
  }
}

async function fixStudiCoordinates() {
  console.log('🌍 Inizio correzione coordinate studi...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      console.log(`\n👤 Controllo utente: ${userData.profile?.nome || userId}`);
      
      if (!userData.profile?.studi || userData.profile.studi.length === 0) {
        console.log('⏩ Nessuno studio, salto');
        continue;
      }
      
      let needsUpdate = false;
      const updatedStudi = [];
      
      for (let i = 0; i < userData.profile.studi.length; i++) {
        const studio = userData.profile.studi[i];
        console.log(`\n🏢 Studio ${i + 1}: ${studio.indirizzo}`);
        
        // Controlla se le coordinate sono invalid (0,0 o mancanti)
        if (!studio.coordinate || 
            studio.coordinate.lat === 0 || 
            studio.coordinate.lng === 0 ||
            isNaN(studio.coordinate.lat) ||
            isNaN(studio.coordinate.lng)) {
          
          console.log('🔍 Coordinate non valide, cerco coordinate reali...');
          
          // Aspetta 1 secondo tra le richieste per rispettare i rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const coordinates = await geocodeAddress(studio.indirizzo);
          
          if (coordinates) {
            console.log(`✅ Trovate coordinate: ${coordinates.lat}, ${coordinates.lng}`);
            updatedStudi.push({
              ...studio,
              coordinate: coordinates
            });
            needsUpdate = true;
          } else {
            console.log('❌ Non riesco a trovare coordinate, mantengo quelle esistenti');
            updatedStudi.push(studio);
          }
        } else {
          console.log(`✅ Coordinate già valide: ${studio.coordinate.lat}, ${studio.coordinate.lng}`);
          updatedStudi.push(studio);
        }
      }
      
      // Aggiorna il documento se necessario
      if (needsUpdate) {
        await userDoc.ref.update({
          'profile.studi': updatedStudi,
          'updatedAt': admin.firestore.Timestamp.now()
        });
        console.log(`\n💾 Aggiornato utente: ${userData.profile?.nome || userId}`);
      } else {
        console.log(`\n⏩ Nessun aggiornamento necessario per: ${userData.profile?.nome || userId}`);
      }
      
      console.log('─'.repeat(60));
    }
    
    console.log('\n🎉 Correzione coordinate completata!');
    
  } catch (error) {
    console.error('❌ Errore durante la correzione:', error);
  }
}

// Funzione per testare il geocoding senza aggiornare il database
async function testGeocoding() {
  console.log('🧪 Test geocoding...');
  
  const testAddresses = [
    'Lungotevere Flaminio, 00196 Roma città metropolitana di Roma Capitale, Italia',
    'Via della Farnesina 100, 00135 Roma città metropolitana di Roma Capitale, Italia'
  ];
  
  for (const address of testAddresses) {
    console.log(`\n🔍 Test: ${address}`);
    const coords = await geocodeAddress(address);
    if (coords) {
      console.log(`✅ Coordinate: ${coords.lat}, ${coords.lng}`);
    } else {
      console.log('❌ Coordinate non trovate');
    }
    
    // Aspetta 1 secondo tra le richieste
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Esegui lo script
if (require.main === module) {
  const action = process.argv[2];
  
  if (action === 'test') {
    testGeocoding()
      .then(() => {
        console.log('🎉 Test completato!');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Errore durante il test:', error);
        process.exit(1);
      });
  } else {
    fixStudiCoordinates()
      .then(() => {
        console.log('🎉 Correzione completata!');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Errore durante la correzione:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  fixStudiCoordinates,
  geocodeAddress
};