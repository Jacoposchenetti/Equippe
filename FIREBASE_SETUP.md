# Guida Setup Firebase per Equipe

## Passaggi Configurazione Firebase Console

### 1. Crea Progetto Firebase

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Clicca "Aggiungi progetto"
3. Nome progetto: `equippe-mvp` (o nome a tua scelta)
4. **IMPORTANTE**: Seleziona location **europe-west** per GDPR compliance
5. Disabilita Google Analytics (opzionale per MVP)

### 2. Configura Authentication

1. Nel menu laterale, vai su **Authentication**
2. Clicca "Inizia"
3. Vai su tab "Sign-in method"
4. Abilita **Email/Password**
   - ✅ Email/Password
   - ❌ Email link (non serve per MVP)
5. Salva

#### Configurazione Email Verification (Consigliato)

1. Vai su **Authentication > Templates**
2. Personalizza template "Verifica email"
3. Imposta URL personalizzato (se hai dominio)

### 3. Crea Database Firestore

1. Nel menu laterale, vai su **Firestore Database**
2. Clicca "Crea database"
3. **IMPORTANTE**: Seleziona modalità **Production** (regole strict)
4. **IMPORTANTE**: Seleziona location **europe-west3 (Frankfurt)** per GDPR
5. Clicca "Abilita"

#### Configura Security Rules

1. Vai su tab "Regole"
2. Copia e incolla il contenuto di `firestore.rules` dal progetto
3. Clicca "Pubblica"

#### Configura Indexes

1. Vai su tab "Indici"
2. Per ogni indice in `firestore.indexes.json`:
   - Clicca "Aggiungi indice"
   - Inserisci:
     - Collection: `users` (o `referrals`)
     - Campi come specificato nel file
     - Ordine: ASCENDING/DESCENDING/CONTAINS
   - Salva

**Indici necessari**:

**Indice 1: users - specializzazioni + città**
- Collection: `users`
- Campo 1: `profile.specializzazioni` - array-contains
- Campo 2: `profile.location.città` - Ascending

**Indice 2: users - tematiche + città**
- Collection: `users`
- Campo 1: `profile.tematiche` - array-contains
- Campo 2: `profile.location.città` - Ascending

**Indice 3: referrals - teamId + status + timestamp**
- Collection: `referrals`
- Campo 1: `teamId` - Ascending
- Campo 2: `status` - Ascending
- Campo 3: `timeline[0].timestamp` - Descending

### 4. Configura Cloud Messaging (FCM) - Opzionale per Fase 2

1. Nel menu laterale, vai su **Cloud Messaging**
2. Segui wizard configurazione
3. Genera certificato per web push
4. Salva Server Key per backend

### 5. Ottieni Credenziali Progetto

1. Clicca sull'icona ingranaggio (⚙️) > **Impostazioni progetto**
2. Scorri fino a "Le tue app"
3. Clicca sull'icona **Web** (`</>`)
4. Registra app:
   - Nome app: `Equipe Web`
   - ❌ Non configurare Firebase Hosting (lo faremo dopo)
5. Copia le credenziali mostrate:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "equippe-mvp.firebaseapp.com",
  projectId: "equippe-mvp",
  storageBucket: "equippe-mvp.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 6. Configura .env.local nel Progetto

1. Copia `.env.local.example` in `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Modifica `.env.local` con le tue credenziali:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=equippe-mvp.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=equippe-mvp
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=equippe-mvp.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Equippe
```

### 6b. Configura credenziali Admin per script locali (sicuro)

Gli script `firebase-admin` locali usano la variabile `GOOGLE_APPLICATION_CREDENTIALS`.

1. Genera la service key da Firebase Console > Project Settings > Service Accounts
2. Salvala fuori dal repository (es. `C:\Users\<utente>\secure\firebase-adminsdk.json`)
3. Imposta la variabile:

```powershell
# Solo sessione corrente
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\<utente>\secure\firebase-adminsdk.json"

# Persistente (nuovi terminali)
setx GOOGLE_APPLICATION_CREDENTIALS "C:\Users\<utente>\secure\firebase-adminsdk.json"
```

Non committare mai il file JSON nel repository.

### 7. Configura Firebase Hosting (Per Deploy Production)

1. Installa Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login:
   ```bash
   firebase login
   ```

3. Inizializza nella directory del progetto:
   ```bash
   firebase init hosting
   ```

4. Configurazione:
   - Progetto: Seleziona `equippe-mvp`
   - Public directory: `out`
   - Single-page app: **Yes**
   - GitHub deploy: No (per ora)

5. Build e deploy:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

### 8. Configurazioni Aggiuntive di Sicurezza

#### Authorized Domains

1. Vai su **Authentication > Settings > Authorized domains**
2. Aggiungi i tuoi domini:
   - `localhost` (già presente)
   - `equippe-mvp.web.app` (Firebase Hosting)
   - Il tuo dominio custom (se lo hai)

#### Quota e Limiti

1. Vai su **Authentication > Settings**
2. Configura:
   - **Email enumeration protection**: ✅ Enabled (raccomandato)
   - **Password policy**: Imposta minimo 8 caratteri

#### Firestore Quota

1. Vai su **Firestore > Utilizzo**
2. Monitora:
   - Letture/Scritture giornaliere
   - Storage utilizzato
3. Imposta alert se supera soglie (Fase 2)

---

## Test Configurazione

### 1. Test Locale

```bash
npm run dev
```

Vai su http://localhost:3000 e:
1. ✅ Registra nuovo utente
2. ✅ Verifica email ricevuta
3. ✅ Login
4. ✅ Completa profilo onboarding
5. ✅ Visualizza dashboard

### 2. Verifica Database

1. Vai su **Firestore Database > Dati**
2. Dovresti vedere:
   - Collection `users` con il tuo documento
   - UID corrispondente al tuo user

### 3. Verifica Authentication

1. Vai su **Authentication > Users**
2. Dovresti vedere il tuo utente registrato
3. Verifica email status

---

## Troubleshooting Comuni

### Errore: "Firebase app already initialized"

**Soluzione**: Riavvia il dev server
```bash
npm run dev
```

### Errore: "Permission denied" in Firestore

**Soluzione**: Controlla che le Security Rules siano pubblicate correttamente

### Errore: "Network error" durante registrazione

**Soluzione**: 
1. Verifica che Authentication sia abilitato
2. Verifica che `localhost` sia in Authorized Domains

### Errore: "Index not found"

**Soluzione**: 
1. Firestore mostrerà link diretto per creare l'indice
2. Clicca il link o crealo manualmente come descritto sopra

### Email di verifica non arrivano

**Soluzione**:
1. Controlla spam
2. Vai su Authentication > Templates e verifica configurazione
3. Per test, puoi disabilitare temporaneamente la verifica email

---

## Backup e Sicurezza

### Setup Backup Automatici (Produzione)

1. Vai su **Firestore > Importa/Esporta**
2. Configura esportazioni schedulate
3. Salva in Google Cloud Storage

### Monitoraggio

1. Abilita **Firebase Crashlytics** (opzionale)
2. Abilita **Performance Monitoring** (opzionale)
3. Setup alerting per quote Firestore

---

## Costi Stimati (Piano Spark - Gratuito)

### Limiti Piano Gratuito:
- ✅ **Authentication**: 50k MAU (Monthly Active Users)
- ✅ **Firestore**: 50k reads/day, 20k writes/day, 1GB storage
- ✅ **Hosting**: 10GB storage, 360MB/day transfer
- ✅ **Cloud Functions**: 125k invocazioni/mese (Fase 2)

### Quando Aggiornare a Blaze (Pay-as-you-go):
- Superi 20-30 utenti attivi giornalieri
- Necessiti Cloud Functions per notifiche
- Superi limiti storage

---

## Checklist Finale

Prima di considerare completata la configurazione:

- [ ] Progetto Firebase creato in regione EU
- [ ] Authentication Email/Password abilitato
- [ ] Firestore creato in europe-west3
- [ ] Security Rules configurate e pubblicate
- [ ] Indici Firestore creati
- [ ] Credenziali copiate in `.env.local`
- [ ] Test registrazione completato
- [ ] Test login completato
- [ ] Test creazione profilo completato
- [ ] Documento utente visibile in Firestore
- [ ] Email verification funzionante

---

**Tempo stimato setup**: 15-20 minuti

**Ultima revisione**: 10 Gennaio 2026
