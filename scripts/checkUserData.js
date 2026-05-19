// Script per controllare i dati utente salvati nel database
// Incolla questo nella console del browser su localhost:3000 dopo aver fatto login

(async function checkUserData() {
  try {
    console.log('🔍 Controllo dati utente...');
    
    // Importa Firebase dinamicamente
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    // Ottieni l'utente corrente
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.error('❌ Nessun utente loggato');
      return;
    }
    
    console.log('👤 Utente:', currentUser.email);
    console.log('🆔 UID:', currentUser.uid);
    
    // Ottieni il documento utente
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    if (!userDoc.exists()) {
      console.error('❌ Documento utente non trovato');
      return;
    }
    
    const userData = userDoc.data();
    console.log('📊 Dati completi utente:', userData);
    
    // Controlla specificamente gli studi
    console.log('\n🏢 STUDI:');
    if (userData.profile?.studi) {
      console.log('✅ Studi trovati:', userData.profile.studi.length);
      userData.profile.studi.forEach((studio, index) => {
        console.log(`\n📍 Studio ${index + 1}:`);
        console.log('  - Indirizzo:', studio.indirizzo);
        console.log('  - Città:', studio.città);
        console.log('  - Provincia:', studio.provincia);
        console.log('  - Coordinate:', studio.coordinate);
        console.log('  - Remoto:', studio.remoto);
      });
    } else {
      console.log('❌ Nessuno studio trovato');
    }
    
    // Controlla il vecchio campo location
    console.log('\n🗺️ LOCATION (vecchio sistema):');
    if (userData.profile?.location) {
      console.log('✅ Location trovata:', userData.profile.location);
    } else {
      console.log('❌ Nessuna location trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
})();