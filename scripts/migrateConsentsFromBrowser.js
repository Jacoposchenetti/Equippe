// Script da eseguire nella console del browser su una pagina di Equipé (quando loggato)

(async function migrateConsents() {
  try {
    console.log('🔄 Inizio migrazione consensi GDPR...');
    
    // Importa Firebase dinamicamente (v9+ modular)
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore, collection, getDocs, updateDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    const firebaseConfig = {
      apiKey: "AIzaSyDnF5nXUE7DRCTNIcCdJmvmnlLtSi6r-20",
      authDomain: "equippe-mvp.firebaseapp.com", 
      projectId: "equippe-mvp",
      storageBucket: "equippe-mvp.firebasestorage.app",
      messagingSenderId: "1018536334624",
      appId: "1:1018536334624:web:ae5ef988cac0b0a19d6ad4"
    };
    
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let updated = 0;
    let skipped = 0;
    const migrationDate = Timestamp.now();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      console.log(`📋 Controllo: ${userData.profile?.nome || userDoc.id}`);
      
      if (!userData.consents) {
        await updateDoc(userDoc.ref, {
          consents: {
            termini: { 
              accepted: true, 
              timestamp: migrationDate,
              migrated: true
            },
            privacy: { 
              accepted: true, 
              timestamp: migrationDate,
              migrated: true
            },
            marketing: { 
              accepted: false,
              timestamp: migrationDate,
              migrated: true
            }
          }
        });
        
        updated++;
        console.log(`✅ ${userData.profile?.nome || userDoc.id} - consensi aggiunti`);
      } else {
        skipped++;
        console.log(`⏭️ ${userData.profile?.nome || userDoc.id} - già presente`);
      }
    }
    
    console.log(`\n🎉 COMPLETATO:`);
    console.log(`📈 Utenti aggiornati: ${updated}`);
    console.log(`⏭️ Utenti saltati: ${skipped}`);
    console.log(`📅 Data migrazione: ${migrationDate.toDate()}`);
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
})();