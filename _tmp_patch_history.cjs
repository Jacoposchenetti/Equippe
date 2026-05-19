// Calls the patchWaitlistHistoryFailed cloud function with the 54 successful emails
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

const firebaseConfig = {
  apiKey: "AIzaSyAoc1gy01Wykf6wJ0IwSzHM5jUceZtPflE",
  authDomain: "equippe-271f5.firebaseapp.com",
  projectId: "equippe-271f5",
  storageBucket: "equippe-271f5.firebasestorage.app",
  messagingSenderId: "730568955288",
  appId: "1:730568955288:web:2c0faa69ef76eff30847ed"
};

const successfulEmails = [
  "acarnacina.psicologa@gmail.com",
  "adventuras@tiscali.iy",
  "alessia.pellegrino@gmail.com",
  "andreataalessia@gmail.com",
  "antonelladiamonds@gmail.com",
  "antonioamabile110568@gmail.com",
  "barbara.costantini17@gmail.com",
  "bibibucc@gmail.com",
  "cateresta@gmail.com",
  "catia.masaracchia@gmail.com",
  "chiara.manni90@gmail.com",
  "clacli1991@gmail.com",
  "coffaniornella@hotmail.com",
  "cristinafinocchiaro@gmail.com",
  "dapalumbo77@gmail.com",
  "dipietro.federica@gmail.com",
  "dott.amalia.conte@gmail.com",
  "dr.ludovicatriolo@gmail.com",
  "elena.collu88@gmail.com",
  "eugenio.tiraboschi@gmail.com",
  "flaviap88@hotmail.it",
  "francescanigrelli@gmail.com",
  "giulia.tunzi@gmail.com",
  "giuliabianconi.psi@gmail.com",
  "giuntini.lisa@libero.it",
  "grandepaola@hotmail.com",
  "ilariacalza@gmail.com",
  "info@loveyourbody.ch",
  "info@raffaellaspinoso.it",
  "jacopo.schenetti@unitn.it",
  "klavy@libero.it",
  "lisalisetta_81@hotmail.it",
  "luciacammarota05@gmail.com",
  "ludovica99fontana99@gmail.com",
  "luise.cristina@live.com",
  "maria.angelamendola@gmail.com",
  "marialaura.laurenti@psyveneto.it",
  "marialaurasanna@gmail.com",
  "marilu.mm@virgilio.it",
  "marisapappalardo@live.it",
  "martinaguida13@gmail.com",
  "nataliapalermo.psicologa@gmail.com",
  "premferendil@gmail.com",
  "psi.gabrielepenazzi@gmail.com",
  "rabazzialessia@gmail.com",
  "relaibleai@gmail.com",
  "riccardo.larosa2@gmail.com",
  "robertalancioni343@gmail.com",
  "storrifrancesca@gmail.com",
  "tatnap@hotmail.com",
  "tmarteddu@gmail.com",
  "valeriaoccelli7@gmail.com",
  "valeriob1997@gmail.com",
  "vanessapalombi@hotmail.it"
];

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  
  // Sign in as admin
  console.log('Signing in...');
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error('Usage: node _tmp_patch_history.cjs <admin_email> <password>');
    process.exit(1);
  }
  
  await signInWithEmailAndPassword(auth, email, password);
  console.log('Signed in as', email);
  
  const functions = getFunctions(app, 'europe-west1');
  const patchFn = httpsCallable(functions, 'patchWaitlistHistoryFailed');
  
  console.log(`Calling patchWaitlistHistoryFailed with ${successfulEmails.length} successful emails...`);
  const result = await patchFn({ successfulEmails });
  
  console.log('\n=== RISULTATO ===');
  console.log(JSON.stringify(result.data, null, 2));
  
  process.exit(0);
}

main().catch(err => {
  console.error('Errore:', err.message || err);
  process.exit(1);
});
