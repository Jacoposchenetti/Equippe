const admin = require('./functions/node_modules/firebase-admin');
const sa = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: 'equippe-271f5',
  databaseURL: 'https://equippe-271f5-default-rtdb.europe-west1.firebasedatabase.app'
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function check() {
  console.log('Searching for user with email jschenetti@gmail.com...');
  
  // Search by email field
  const snap = await db.collection('users').where('email', '==', 'jschenetti@gmail.com').limit(1).get();
  
  if (snap.empty) {
    console.log('❌ USER NOT FOUND by email field');
    console.log('Listing first 5 users to check structure...');
    const all = await db.collection('users').limit(5).get();
    all.docs.forEach(d => {
      const data = d.data();
      console.log('  UID:', d.id, '| email:', data.email, '| displayName:', data.displayName);
    });
    return;
  }

  const userDoc = snap.docs[0];
  const d = userDoc.data();
  const p = d.profile || {};

  console.log('\n✅ USER FOUND');
  console.log('UID:', userDoc.id);
  console.log('displayName:', d.displayName);
  console.log('email:', d.email);
  console.log('verificationInfo:', JSON.stringify(p.verificationInfo));
  console.log('professioniConDocumenti count:', (p.professioniConDocumenti || []).length);
  (p.professioniConDocumenti || []).forEach((prof, i) => {
    console.log(`  prof[${i}]: ${prof.professione}`);
  });
  console.log('professioniPending count:', (p.professioniPending || []).length);
  (p.professioniPending || []).forEach((prof, i) => {
    console.log(`  pending[${i}]: ${prof.professione}`);
  });

  // Check availability
  console.log('\nChecking availability doc...');
  const avail = await db.collection('availability').doc(userDoc.id).get();
  if (!avail.exists) {
    console.log('❌ NO availability doc for this user');
  } else {
    const av = avail.data();
    console.log('✅ availability exists');
    console.log('isPublic:', av.isPublic);
    console.log('slots count:', (av.slots || []).length);
  }
}

check().catch(console.error).finally(() => process.exit(0));
