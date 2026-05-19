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

async function approveAllPendingUsers() {
  console.log('🔄 Approvazione automatica utenti esistenti...');
  
  try {
    // Ottieni tutti gli utenti
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`📊 Trovati ${usersSnapshot.size} utenti`);
    
    let updated = 0;
    
    const batch = db.batch();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Aggiorna tutti a approved
      const verificationInfo = {
        status: 'approved',
        submittedAt: userData.profile?.verificationInfo?.submittedAt || userData.createdAt || admin.firestore.Timestamp.now(),
        lastCheckedAt: admin.firestore.Timestamp.now(),
        checkedBy: 'admin-migration',
        notes: 'Utente esistente - approvato automaticamente'
      };
      
      batch.update(userDoc.ref, {
        'profile.verificationInfo': verificationInfo,
        'profile.verified': true
      });
      
      console.log(`✅ ${userData.profile?.nome || userData.email} - APPROVATO`);
      updated++;
    }
    
    await batch.commit();
    console.log(`\n💾 ${updated} utenti approvati!`);
    
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

approveAllPendingUsers();
