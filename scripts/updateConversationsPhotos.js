// Script per aggiornare le conversazioni esistenti con le foto dei team
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  // Aggiungi qui la configurazione Firebase
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateTeamConversationsWithPhotos() {
  try {
    console.log('🔄 Aggiornamento conversazioni con foto team...');
    
    // Carica tutte le conversazioni team
    const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
    let updated = 0;
    
    for (const convDoc of conversationsSnapshot.docs) {
      const convData = convDoc.data();
      
      // Solo conversazioni team senza foto
      if (convData.type === 'team' && convData.teamId && !convData.teamPhotoURL) {
        try {
          // Carica dati team
          const teamDoc = await getDoc(doc(db, 'teams', convData.teamId));
          
          if (teamDoc.exists()) {
            const teamData = teamDoc.data();
            
            if (teamData.photoURL) {
              // Aggiorna conversazione con foto team
              await updateDoc(doc(db, 'conversations', convDoc.id), {
                teamPhotoURL: teamData.photoURL
              });
              
              console.log(`✅ Aggiornata conversazione ${convDoc.id} per team ${teamData.name}`);
              updated++;
            }
          }
        } catch (error) {
          console.error(`❌ Errore aggiornamento conversazione ${convDoc.id}:`, error);
        }
      }
    }
    
    console.log(`🎉 Aggiornate ${updated} conversazioni`);
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

// Esporta per uso manuale
module.exports = { updateTeamConversationsWithPhotos };