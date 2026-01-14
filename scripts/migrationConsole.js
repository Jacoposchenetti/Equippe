// Script semplificato da copiare direttamente nella console del browser
// ISTRUZIONI: 
// 1. Vai su localhost:3000 e fai login
// 2. Apri DevTools (F12)
// 3. Vai nella tab "Console"  
// 4. Copia tutto questo codice e incollalo nella console
// 5. Premi Enter per eseguirlo

(async function migrateExistingUsers() {
  try {
    console.log('🔄 Migrazione consensi GDPR - START');
    
    // Importa direttamente i metodi Firebase v9
    const { collection, getDocs, doc, updateDoc, Timestamp } = await import('firebase/firestore');
    
    // Ottieni l'istanza db dal modulo firebase dell'app
    // Nota: questo funziona perché l'app è già inizializzata
    const dbModule = await import('/src/lib/firebase.ts');
    const db = dbModule.db;
    
    console.log('✅ Firebase connesso');
    
    // Query tutti gli utenti
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    console.log(`📊 Trovati ${usersSnapshot.size} utenti`);
    
    let updated = 0;
    let skipped = 0;
    const now = Timestamp.now();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userName = userData.profile?.nome || userData.profile?.cognome || userDoc.id;
      
      console.log(`🔍 Controllo: ${userName}`);
      
      if (!userData.consents) {
        // Aggiungi i consensi
        await updateDoc(userDoc.ref, {
          consents: {
            termini: {
              accepted: true,
              timestamp: now,
              migrated: true
            },
            privacy: {
              accepted: true, 
              timestamp: now,
              migrated: true
            },
            marketing: {
              accepted: false,
              timestamp: now, 
              migrated: true
            }
          }
        });
        
        updated++;
        console.log(`✅ ${userName} - consensi aggiunti`);
      } else {
        skipped++;
        console.log(`⏭️  ${userName} - già ha consensi`);
      }
    }
    
    console.log('\n🎉 MIGRAZIONE COMPLETATA!');
    console.log(`📈 Utenti aggiornati: ${updated}`);
    console.log(`⏭️  Utenti saltati: ${skipped}`);
    console.log(`🕐 Timestamp: ${now.toDate()}`);
    
  } catch (error) {
    console.error('❌ ERRORE durante migrazione:', error);
    console.log('\n🔧 SOLUZIONE ALTERNATIVA:');
    console.log('Se questo metodo non funziona, possiamo aggiungere un pulsante admin nella dashboard');
  }
})();