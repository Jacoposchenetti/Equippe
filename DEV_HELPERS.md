# Script Helper per Sviluppo Equippe

## Quick Commands

### Sviluppo
```bash
# Avvia dev server
npm run dev

# Avvia in porta diversa
npm run dev -- -p 3001

# Pulisci cache e riavvia
rm -rf .next && npm run dev
```

### Database

```bash
# Installa Firebase CLI (se non già installato)
npm install -g firebase-tools

# Login Firebase
firebase login

# Deploy solo rules
firebase deploy --only firestore:rules

# Deploy solo indexes
firebase deploy --only firestore:indexes

# Backup Firestore (richiede Blaze plan)
firebase firestore:export gs://your-bucket/backups/$(date +%Y%m%d)
```

### Testing

```bash
# Test locale con Firebase Emulators
firebase emulators:start

# In .env.local aggiungi:
# NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
```

### Git (quando configuri repo)

```bash
# Inizializza Git
git init

# .gitignore importante
cat > .gitignore << EOF
.next
node_modules
.env.local
.env*.local
*.log
.DS_Store
out
EOF

# Primo commit
git add .
git commit -m "Initial commit: Equippe MVP Fase 1"
```

### Deploy Production

```bash
# Build
npm run build

# Test build locale
npm start

# Deploy su Firebase Hosting
firebase deploy --only hosting

# Deploy tutto (hosting + firestore rules)
firebase deploy
```

### Utilità Sviluppo

```bash
# Controlla errori TypeScript
npm run type-check

# Fix lint automatico
npm run lint -- --fix

# Analizza bundle size
npm run build
# Poi controlla .next/analyze

# Controlla vulnerabilità
npm audit

# Aggiorna dipendenze
npm update

# Controlla dipendenze obsolete
npm outdated
```

### Firebase Console Quick Links

Dopo aver creato il progetto, salva questi link:

```
# Sostituisci YOUR_PROJECT_ID con il tuo project ID

Authentication:
https://console.firebase.google.com/project/YOUR_PROJECT_ID/authentication/users

Firestore:
https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/data

Rules:
https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/rules

Indexes:
https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/indexes

Settings:
https://console.firebase.google.com/project/YOUR_PROJECT_ID/settings/general
```

### Debug Tips

```bash
# Mostra versione dipendenze
npm list firebase
npm list next

# Pulisci tutto e reinstalla
rm -rf node_modules package-lock.json
npm install

# Mostra env variables (senza valori sensibili)
echo "Checking env variables..."
node -e "console.log(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)"

# Test connessione Firebase
node -e "
const { initializeApp } = require('firebase/app');
const config = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
};
console.log('Firebase config OK:', config);
"
```

### VS Code Extensions Consigliate

Installa queste estensioni per migliorare DX:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "firebase.vscode-firebase-explorer"
  ]
}
```

Crea file `.vscode/extensions.json` con il contenuto sopra.

### Backup Locale Database

```bash
# Esporta tutti i dati utente (richiede firebase-admin)
# Crea script src/scripts/export-users.ts

# Backup .env.local (gitignored)
cp .env.local .env.local.backup
```

### Performance Monitoring

```bash
# Analizza performance build
npm run build -- --profile

# Lighthouse CI (installare prima)
npm install -g @lhci/cli
lhci autorun
```

### Shortcuts Comuni

```bash
# Alias utili da aggiungere a ~/.bashrc o ~/.zshrc
alias equippe-dev="cd ~/path/to/equippe-mvp && npm run dev"
alias equippe-logs="cd ~/path/to/equippe-mvp && firebase functions:log"
alias equippe-deploy="cd ~/path/to/equippe-mvp && npm run build && firebase deploy"
```

### Environment Setup per Team

Se lavori in team, crea `.env.local.template`:

```env
# Firebase Configuration (DO NOT COMMIT .env.local!)
NEXT_PUBLIC_FIREBASE_API_KEY=get_from_firebase_console
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Equippe

# Optional: Firebase Emulator (for local development)
# NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
# NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=localhost:8080
# NEXT_PUBLIC_AUTH_EMULATOR_HOST=localhost:9099
```

## Monitoring & Logging

### Setup Console Logging

```typescript
// src/lib/logger.ts
export const logger = {
  info: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[INFO]', ...args);
    }
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  }
};
```

### Firebase Performance Monitoring

```bash
# Installa SDK
npm install firebase/performance

# Aggiungi in src/lib/firebase.ts
import { getPerformance } from 'firebase/performance';
const perf = getPerformance(app);
```

## Cheat Sheet Firestore

```typescript
// Lettura documento
const docRef = doc(db, 'users', userId);
const docSnap = await getDoc(docRef);
const data = docSnap.data();

// Query con filtri
const q = query(
  collection(db, 'users'),
  where('profile.città', '==', 'Roma'),
  limit(10)
);
const snapshot = await getDocs(q);

// Scrittura
await setDoc(doc(db, 'users', userId), data);

// Update
await updateDoc(doc(db, 'users', userId), { 'profile.verified': true });

// Delete
await deleteDoc(doc(db, 'users', userId));

// Batch write
const batch = writeBatch(db);
batch.set(doc(db, 'users', 'user1'), data1);
batch.update(doc(db, 'users', 'user2'), { field: 'value' });
await batch.commit();
```

---

**Last updated**: 10 Gennaio 2026
