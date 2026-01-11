# Equippe MVP

Piattaforma per collaborazione tra professionisti sociosanitari

## Stack Tecnologico

- **Frontend**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Cloud Functions, FCM)
- **PWA**: next-pwa + Workbox

## Setup Iniziale

### 1. Installa le dipendenze

```bash
npm install
```

### 2. Configura Firebase

1. Crea un progetto Firebase su [Firebase Console](https://console.firebase.google.com/)
2. Attiva Authentication (Email/Password)
3. Crea un database Firestore (regione EU per GDPR)
4. Copia le credenziali del progetto

### 3. Configura le variabili d'ambiente

Copia `.env.local.example` in `.env.local` e inserisci le tue credenziali Firebase:

```bash
cp .env.local.example .env.local
```

Modifica `.env.local` con i tuoi valori:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Configura Firestore Security Rules

Nel Firebase Console, vai su Firestore Database > Rules e copia il contenuto del file `firestore.rules`

### 5. Configura Firestore Indexes

Nel Firebase Console, vai su Firestore Database > Indexes e crea gli indici dal file `firestore.indexes.json`

### 6. Avvia il server di sviluppo

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Struttura del Progetto

```
equippe-mvp/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── dashboard/          # Dashboard principale
│   │   ├── login/              # Pagina login
│   │   ├── register/           # Pagina registrazione
│   │   ├── onboarding/         # Completamento profilo
│   │   └── page.tsx            # Homepage
│   ├── components/             # Componenti React riutilizzabili
│   ├── contexts/               # React Contexts (Auth, etc.)
│   │   └── AuthContext.tsx     # Context autenticazione
│   ├── lib/                    # Librerie e utilità
│   │   └── firebase.ts         # Configurazione Firebase
│   └── types/                  # TypeScript types
│       └── equippe.ts          # Types del dominio
├── public/
│   └── manifest.json           # PWA manifest
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Firestore indexes
└── firebase.json               # Firebase configuration
```

## Funzionalità Implementate (MVP Fase 1)

### ✅ Autenticazione e Onboarding
- Registrazione con email/password
- Login
- Completamento profilo professionale
- Verifica albo (manuale)

### ✅ Dashboard Ricerca
- Ricerca professionisti per città, specializzazione, tematica, parole chiave
- Visualizzazione risultati con filtri
- Card professionista con dettagli

### ✅ Configurazione PWA
- Manifest per installazione app
- Service Worker per offline support
- Ottimizzazione mobile

## Prossimi Step (Fase 2)

### 🔜 Gestione Equipé
- Creazione equipé private
- Invito membri
- Configurazione SLA (24h/48h/72h)

### 🔜 Sistema Referral
- Form referral strutturato
- Stati workflow (draft → sent → accepted → closed)
- Notifiche push (FCM)
- Encryption PHI client-side

## Note di Sicurezza

- **PHI**: Dati sensibili dei pazienti crittografati client-side
- **Firestore Rules**: Accesso basato su team membership
- **GDPR**: Progetto Firebase in regione EU
- **Verifica Albo**: Verifica manuale del numero di albo
