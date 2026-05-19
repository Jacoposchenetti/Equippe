// Script per debuggare la pagina profilo
// Incolla questo nella console del browser quando sei sulla pagina profilo dell'utente

(async function debugProfile() {
  try {
    console.log('🔍 Debug pagina profilo...');
    
    // Cerca i dati dell'utente nel DOM React
    const profileContainer = document.querySelector('h1')?.parentElement?.parentElement;
    if (profileContainer) {
      console.log('📄 Elemento profilo trovato');
    }
    
    // Importa Firebase per controllare i dati direttamente
    const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    // Estrai UID dall'URL
    const url = window.location.pathname;
    const uid = url.split('/').pop();
    console.log('🆔 UID dalla URL:', uid);
    
    if (!uid || uid === 'profile') {
      console.error('❌ UID non trovato nell\'URL');
      return;
    }
    
    // Recupera i dati dal database
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', uid));
    
    if (!userDoc.exists()) {
      console.error('❌ Utente non trovato nel database');
      return;
    }
    
    const userData = userDoc.data();
    console.log('👤 Dati utente completi:', userData);
    
    // Controlla specificamente gli studi
    console.log('\\n🏢 STUDI:');
    if (userData.profile?.studi) {
      console.log('✅ Studi presenti:', userData.profile.studi.length);
      userData.profile.studi.forEach((studio, i) => {
        console.log(`\\n📍 Studio ${i + 1}:`);
        console.log('  Indirizzo:', studio.indirizzo);
        console.log('  Città:', studio.città);
        console.log('  Provincia:', studio.provincia);
        console.log('  Coordinate:', studio.coordinate);
        console.log('  Remoto:', studio.remoto);
      });
    } else {
      console.log('❌ Campo studi non presente');
    }
    
    // Controlla il vecchio sistema location
    console.log('\\n🗺️ LOCATION (sistema legacy):');
    if (userData.profile?.location) {
      console.log('✅ Location presente:', userData.profile.location);
    } else {
      console.log('❌ Campo location non presente');
    }
    
    // Controlla cosa mostra il React component
    const nameElement = document.querySelector('h1');
    if (nameElement) {
      const locationContainer = nameElement.parentElement?.querySelector('div:nth-child(2)');
      if (locationContainer) {
        console.log('\\n🖥️ CONTENUTO UI LOCALIZZAZIONE:');
        console.log('Testo mostrato:', locationContainer.textContent);
        console.log('HTML:', locationContainer.innerHTML);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore debug:', error);
  }
})();