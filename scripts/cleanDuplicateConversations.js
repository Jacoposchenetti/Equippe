const admin = require('firebase-admin');
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanDuplicateConversations() {
  console.log('🔍 Cerco conversazioni duplicate...\n');

  try {
    // Ottieni tutte le conversazioni
    const conversationsSnapshot = await db.collection('conversations').get();
    console.log(`📊 Trovate ${conversationsSnapshot.size} conversazioni totali\n`);

    // Mappa per tracciare conversazioni uniche
    const conversationMap = new Map();
    const toDelete = [];

    conversationsSnapshot.forEach(doc => {
      const data = doc.data();
      const participants = data.participants || [];
      
      // Crea una chiave ordinata per identificare conversazioni duplicate
      const key = participants.sort().join('_');
      
      if (conversationMap.has(key)) {
        // Conversazione duplicata trovata
        const existing = conversationMap.get(key);
        const existingTime = existing.data.createdAt?.toDate() || new Date(0);
        const currentTime = data.createdAt?.toDate() || new Date(0);
        
        // Mantieni la più recente
        if (currentTime > existingTime) {
          // La nuova è più recente, elimina la vecchia
          toDelete.push({
            id: existing.id,
            participants: existing.data.participants,
            createdAt: existingTime
          });
          conversationMap.set(key, { id: doc.id, data });
          console.log(`🔄 Trovato duplicato più recente per ${key}`);
        } else {
          // La vecchia è più recente, elimina la nuova
          toDelete.push({
            id: doc.id,
            participants: data.participants,
            createdAt: currentTime
          });
          console.log(`🔄 Trovato duplicato più vecchio per ${key}`);
        }
      } else {
        // Prima conversazione con questa coppia di utenti
        conversationMap.set(key, { id: doc.id, data });
      }
    });

    console.log(`\n📋 Risultati:`);
    console.log(`   - Conversazioni uniche: ${conversationMap.size}`);
    console.log(`   - Conversazioni duplicate da eliminare: ${toDelete.length}\n`);

    if (toDelete.length === 0) {
      console.log('✅ Nessuna conversazione duplicata trovata!');
      process.exit(0);
    }

    // Mostra le conversazioni che verranno eliminate
    console.log('🗑️  Conversazioni da eliminare:');
    toDelete.forEach((conv, index) => {
      console.log(`   ${index + 1}. ID: ${conv.id}`);
      console.log(`      Partecipanti: ${conv.participants.join(', ')}`);
      console.log(`      Creata: ${conv.createdAt.toLocaleString('it-IT')}\n`);
    });

    // Chiedi conferma
    console.log('⚠️  Vuoi procedere con l\'eliminazione? (y/n)');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('> ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('\n🗑️  Eliminazione in corso...\n');
        
        const batch = db.batch();
        let count = 0;

        for (const conv of toDelete) {
          const docRef = db.collection('conversations').doc(conv.id);
          batch.delete(docRef);
          count++;
          
          if (count % 10 === 0) {
            console.log(`   Processate ${count}/${toDelete.length}...`);
          }
        }

        await batch.commit();
        console.log(`\n✅ Eliminate ${toDelete.length} conversazioni duplicate!`);
      } else {
        console.log('\n❌ Operazione annullata.');
      }
      
      readline.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

cleanDuplicateConversations();
