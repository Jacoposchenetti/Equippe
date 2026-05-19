import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function resetTematiche() {
  console.log('🔄 Inizio reset tematiche per tutti gli utenti...\n');

  try {
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;
    let processedUsers = 0;
    let updatedUsers = 0;

    console.log(`📊 Trovati ${totalUsers} utenti totali\n`);

    for (const userDoc of usersSnapshot.docs) {
      processedUsers++;
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      console.log(`[${processedUsers}/${totalUsers}] Processando: ${userData.profile?.nome || userId}`);

      const updateData = {
        'profile.tematiche': []
      };

      // Reset tematiche in professioniConDocumenti
      if (userData.profile?.professioniConDocumenti && userData.profile.professioniConDocumenti.length > 0) {
        const professioniReset = userData.profile.professioniConDocumenti.map(prof => ({
          ...prof,
          tematiche: []
        }));
        updateData['profile.professioniConDocumenti'] = professioniReset;
      }

      // Reset tematiche in professioniPending
      if (userData.profile?.professioniPending && userData.profile.professioniPending.length > 0) {
        const professioniPendingReset = userData.profile.professioniPending.map(prof => ({
          ...prof,
          tematiche: []
        }));
        updateData['profile.professioniPending'] = professioniPendingReset;
      }

      await db.collection('users').doc(userId).update(updateData);
      updatedUsers++;
      console.log(`  ✅ Tematiche resettate\n`);
    }

    console.log('\n✨ Reset completato!');
    console.log(`📈 Statistiche:`);
    console.log(`   - Utenti totali: ${totalUsers}`);
    console.log(`   - Utenti aggiornati: ${updatedUsers}`);
    
  } catch (error) {
    console.error('❌ Errore durante il reset:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

resetTematiche();
