// One-time script: find recipients who DIDN'T get the "Buona Pasqua" email and patch the Firestore history
const admin = require('firebase-admin');
const { Resend } = require('resend');

// Init firebase admin
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Init Resend
const resend = new Resend('re_Zj1Zs9i2_BSTkNwxK36Lv9qTed453REZw');

async function main() {
  // 1. Get all "Buona Pasqua" emails from Resend (successful deliveries)
  console.log('Fetching successfully sent emails from Resend...');
  const successfulEmails = new Set();
  
  for (let page = 1; page <= 20; page++) {
    try {
      const response = await resend.emails.list({ limit: 100, page });
      if (!response.data || response.data.data.length === 0) break;
      
      for (const email of response.data.data) {
        if (email.subject && email.subject.includes('Buona Pasqua')) {
          if (email.to && email.to.length > 0) {
            successfulEmails.add(email.to[0].toLowerCase());
          }
        }
      }
      
      if (response.data.data.length < 100) break;
      
      // Respect rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.log(`Page ${page} error (rate limit?), waiting...`);
      await new Promise(r => setTimeout(r, 2000));
      page--; // retry
    }
  }
  
  console.log(`\nDestinatari che hanno RICEVUTO "Buona Pasqua": ${successfulEmails.size}`);
  console.log([...successfulEmails].sort().join('\n'));

  // 2. Get the waitlist_email_history record for "Buona Pasqua"
  console.log('\n\nFetching waitlist_email_history from Firestore...');
  const historySnap = await db.collection('waitlist_email_history')
    .where('subject', '==', 'Buona Pasqua da Tuaequipe.it!')
    .orderBy('sentAt', 'desc')
    .limit(5)
    .get();
  
  if (historySnap.empty) {
    console.log('Nessun record trovato con oggetto "Buona Pasqua da Tuaequipe.it!"');
    // Try broader search
    const allHistory = await db.collection('waitlist_email_history').orderBy('sentAt', 'desc').limit(10).get();
    allHistory.docs.forEach(doc => {
      const d = doc.data();
      console.log(`  ${doc.id}: subject="${d.subject}", recipients=${d.recipients?.length}, result=${JSON.stringify(d.result)}`);
    });
    process.exit(1);
  }

  // Process each matching history entry
  for (const doc of historySnap.docs) {
    const data = doc.data();
    console.log(`\nRecord: ${doc.id}`);
    console.log(`  Subject: ${data.subject}`);
    console.log(`  Recipients: ${data.recipients?.length}`);
    console.log(`  Result: sent=${data.result?.sent}, failed=${data.result?.failed}`);
    
    const allRecipients = data.recipients || [];
    const failedRecipients = [];
    
    for (const r of allRecipients) {
      if (!successfulEmails.has(r.email.toLowerCase())) {
        failedRecipients.push(r);
      }
    }
    
    console.log(`\n  MANCANTI (non hanno ricevuto): ${failedRecipients.length}`);
    failedRecipients.forEach(r => console.log(`    - ${r.email} (${r.nome} ${r.cognome})`));
    
    if (failedRecipients.length > 0) {
      // 3. Update the Firestore history record with failedRecipients
      console.log(`\n  Aggiornamento Firestore record ${doc.id} con ${failedRecipients.length} failedRecipients...`);
      await db.collection('waitlist_email_history').doc(doc.id).update({
        failedRecipients: failedRecipients,
        'result.failed': failedRecipients.length,
        'result.sent': allRecipients.length - failedRecipients.length,
      });
      console.log('  ✅ Record aggiornato! Ora puoi usare il pulsante "Reinvia fallite" dal frontend.');
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Errore:', err);
  process.exit(1);
});
