import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function syncAuthUsers() {
  console.log('🔄 Sincronizzazione utenti da Authentication a Firestore...\n');

  try {
    // Ottieni tutti gli utenti da Authentication
    const listUsersResult = await auth.listUsers();
    console.log(`📊 Trovati ${listUsersResult.users.length} utenti in Authentication`);

    // Ottieni tutti gli utenti da Firestore
    const usersSnapshot = await db.collection('users').get();
    const firestoreUserIds = new Set(usersSnapshot.docs.map(doc => doc.id));
    console.log(`📊 Trovati ${firestoreUserIds.size} utenti in Firestore\n`);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const userRecord of listUsersResult.users) {
      // Controlla se l'utente esiste già in Firestore
      if (firestoreUserIds.has(userRecord.uid)) {
        console.log(`⏭️  Utente già esistente: ${userRecord.email}`);
        skippedCount++;
        continue;
      }

      // Crea un documento utente di base in Firestore
      const userData = {
        uid: userRecord.uid,
        email: userRecord.email,
        profile: {
          nome: userRecord.displayName || 'Nome non impostato',
          dataNascita: '',
          specializzazioni: [],
          professioniConDocumenti: [],
          tematiche: [],
          esperienza: '',
          location: { lat: 0, lng: 0, città: '' },
          studi: [],
          disponibilità: '',
          photoURL: userRecord.photoURL || '',
          verified: false,
          verificationInfo: {
            status: 'pending',
            submittedAt: admin.firestore.Timestamp.now(),
            note: 'Utente sincronizzato automaticamente da Authentication'
          }
        },
        teams: [],
        stats: { referralsSent: 0, referralsReceived: 0 },
        consents: {
          termini: { accepted: false, timestamp: admin.firestore.Timestamp.now() },
          privacy: { accepted: false, timestamp: admin.firestore.Timestamp.now() },
          marketing: { accepted: false, timestamp: admin.firestore.Timestamp.now() }
        },
        createdAt: userRecord.metadata.creationTime 
          ? admin.firestore.Timestamp.fromDate(new Date(userRecord.metadata.creationTime))
          : admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      await db.collection('users').doc(userRecord.uid).set(userData);
      console.log(`✅ Utente sincronizzato: ${userRecord.email} (${userRecord.uid})`);
      syncedCount++;
    }

    console.log('\n📈 Riepilogo:');
    console.log(`   ✅ Utenti sincronizzati: ${syncedCount}`);
    console.log(`   ⏭️  Utenti già presenti: ${skippedCount}`);
    console.log(`   📊 Totale utenti: ${listUsersResult.users.length}`);
    console.log('\n⚠️  NOTA: Gli utenti sincronizzati hanno profili vuoti.');
    console.log('   Chiedi agli utenti di completare il loro profilo tramite onboarding.');

  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione:', error);
    process.exit(1);
  }

  process.exit(0);
}

syncAuthUsers();
