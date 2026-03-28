// Script: count_waitlist_by_day.js
// Conta le iscrizioni alla waiting list per giorno da Firestore

const admin = require('firebase-admin');
const fs = require('fs');

// Percorso al file di service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('waitlist').get();
  const counts = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    let date;
    if (data.createdAt && data.createdAt.toDate) {
      // Timestamp Firestore
      date = data.createdAt.toDate();
    } else if (data.createdAt && data.createdAt._seconds) {
      // Oggetto timestamp esportato
      date = new Date(data.createdAt._seconds * 1000);
    } else {
      return;
    }
    const day = date.toISOString().slice(0, 10); // YYYY-MM-DD
    counts[day] = (counts[day] || 0) + 1;
  });
  // Ordina per data
  const sorted = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  console.log('Iscrizioni per giorno:');
  sorted.forEach(([day, count]) => {
    console.log(`${day}: ${count}`);
  });
  // Salva anche su file
  fs.writeFileSync('waitlist_counts_by_day.json', JSON.stringify(Object.fromEntries(sorted), null, 2));
  console.log('\nRisultato salvato in waitlist_counts_by_day.json');
}

main().catch(err => {
  console.error('Errore:', err);
  process.exit(1);
});
