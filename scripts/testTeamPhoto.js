// Test script per verificare la foto del team
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  // Configurazione Firebase dal file serviceAccountKey.json
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testTeamPhoto(teamId) {
  try {
    console.log('🔍 Verificando team:', teamId);
    
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    
    if (!teamDoc.exists()) {
      console.log('❌ Team non trovato');
      return;
    }
    
    const teamData = teamDoc.data();
    console.log('📋 Dati team:', {
      name: teamData.name,
      photoURL: teamData.photoURL,
      hasPhoto: !!teamData.photoURL
    });
    
    if (teamData.photoURL) {
      console.log('✅ Foto trovata:', teamData.photoURL);
    } else {
      console.log('❌ Nessuna foto trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

// Esporta per uso in terminale Node.js
module.exports = { testTeamPhoto };