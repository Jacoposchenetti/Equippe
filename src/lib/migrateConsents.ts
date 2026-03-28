// Funzione per aggiornare consensi GDPR degli utenti esistenti
// Eseguibile dalla console browser su una pagina autenticata di equipe

import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function migrateExistingUsersConsents() {
  try {
    console.log('🔄 Migrazione consensi GDPR iniziata...');
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let updated = 0;
    let skipped = 0;
    const migrationDate = Timestamp.now();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Solo se non ha già i consensi
      if (!userData.consents) {
        await updateDoc(doc(db, 'users', userDoc.id), {
          consents: {
            termini: { 
              accepted: true, 
              timestamp: migrationDate,
              migrated: true  // Flag per audit
            },
            privacy: { 
              accepted: true, 
              timestamp: migrationDate,
              migrated: true
            },
            marketing: { 
              accepted: false,  // Conservativo
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
    
    console.log(`\n🎉 Completato: ${updated} aggiornati, ${skipped} saltati`);
    
    return { updated, skipped, timestamp: migrationDate.toDate() };
    
  } catch (error) {
    console.error('❌ Errore migrazione:', error);
    throw error;
  }
}

// Per eseguire dalla console browser:
// migrateExistingUsersConsents().then(result => console.log('Risultato:', result));
