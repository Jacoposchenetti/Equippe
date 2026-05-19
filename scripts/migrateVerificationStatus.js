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

async function migrateVerificationStatus() {
  console.log('🔄 Inizio migrazione status verifica utenti...');
  
  try {
    // Ottieni tutti gli utenti
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`📊 Trovati ${usersSnapshot.size} utenti`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Salta se ha già verificationInfo
      if (userData.profile?.verificationInfo) {
        console.log(`⏭️  ${userData.profile.nome} - già ha verificationInfo`);
        skipped++;
        continue;
      }
      
      // Per utenti esistenti, approva automaticamente tutti
      // (assumiamo che chi è già registrato sia legittimo)
      const status = 'approved';
      
      const verificationInfo = {
        status: status,
        submittedAt: userData.createdAt || admin.firestore.Timestamp.now(),
        lastCheckedAt: admin.firestore.Timestamp.now(),
        checkedBy: 'migration-script',
        notes: 'Utente esistente - approvato automaticamente durante migrazione'
      };
      
      batch.update(userDoc.ref, {
        'profile.verificationInfo': verificationInfo,
        'profile.verified': true
      });
      
      console.log(`✅ ${userData.profile?.nome || userData.email} - impostato come ${status}`);
      updated++;
      batchCount++;
      
      // Firestore batch limit is 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`💾 Batch di ${batchCount} utenti salvato`);
        batchCount = 0;
      }
    }
    
    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`💾 Batch finale di ${batchCount} utenti salvato`);
    }
    
    console.log('\n✅ Migrazione completata!');
    console.log(`   - Aggiornati: ${updated}`);
    console.log(`   - Saltati: ${skipped}`);
    console.log(`   - Errori: ${errors}`);
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

migrateVerificationStatus();
