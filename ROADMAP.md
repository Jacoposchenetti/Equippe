# Roadmap Sviluppo Equippe

## ✅ FASE 1 - COMPLETATA
**Durata**: Settimana 1-2  
**Status**: ✅ Implementato

### Funzionalità
- [x] Setup progetto Next.js + Firebase + PWA
- [x] Sistema di autenticazione (login/registrazione)
- [x] Onboarding con profilo professionale completo
- [x] Dashboard ricerca professionisti con filtri
- [x] Firestore security rules e indexes
- [x] TypeScript types completi
- [x] PWA configuration

---

## 🔜 FASE 2 - PROSSIMI PASSI
**Durata**: Settimana 3  
**Focus**: Gestione Equipé e Referral System

### A. Gestione Equipé

#### 1. Creazione Equipé
**File da creare**: `src/app/dashboard/teams/page.tsx`

```typescript
// Funzionalità:
- Lista equipé dell'utente
- Pulsante "Crea nuova equipé"
- Card con info equipé (nome, membri, SLA)
```

**File da creare**: `src/app/dashboard/teams/new/page.tsx`
```typescript
// Form:
- Nome equipé
- SLA (24h/48h/72h)
- Tematiche
- Regolamento
```

#### 2. Dettaglio Equipé
**File da creare**: `src/app/dashboard/teams/[teamId]/page.tsx`

```typescript
// Sezioni:
- Header con nome e settings
- Lista membri con ruoli
- Pulsante "Invita membro"
- Lista referral dell'equipé
- Statistiche equipé
```

#### 3. Invito Membri
**File da creare**: `src/components/teams/InviteMemberModal.tsx`

```typescript
// Funzionalità:
- Ricerca professionista (riuso filtri)
- Selezione ruolo (admin/referrer/receiver)
- Invio invito
```

**File da creare**: `src/app/dashboard/invites/page.tsx`
```typescript
// Gestione inviti:
- Lista inviti ricevuti
- Accetta/Rifiuta
- Notifiche
```

### B. Sistema Referral

#### 1. Creazione Referral
**File da creare**: `src/app/dashboard/referrals/new/page.tsx`

```typescript
// Form referral:
- Selezione equipé
- Selezione destinatario (membro equipé)
- Quesito clinico
- Urgenza (bassa/media/alta)
- Dati paziente crittografati
- Allegati (opzionale)
```

**File da creare**: `src/lib/encryption.ts`
```typescript
// Encryption client-side per PHI:
- encrypt(data: string): Promise<string>
- decrypt(encryptedData: string): Promise<string>
// Usare Web Crypto API
```

#### 2. Dashboard Referral
**File da creare**: `src/app/dashboard/referrals/page.tsx`

```typescript
// Tabs:
1. Inviati (sent)
2. Ricevuti (received)
3. Bozze (draft)
4. Completati (closed)

// Card referral:
- Info paziente anonimizzata
- Mittente/destinatario
- Status con badge
- Data invio/scadenza SLA
- Azioni (Accetta/Rifiuta/Chiudi)
```

#### 3. Dettaglio Referral
**File da creare**: `src/app/dashboard/referrals/[refId]/page.tsx`

```typescript
// Sezioni:
- Header con status e timeline
- Quesito completo
- Dati paziente (decriptati)
- Messaggi/note tra professionisti
- Azioni contestuali
- Log audit trail
```

### C. Sistema Notifiche

#### 1. FCM Setup
**File da creare**: `src/lib/notifications.ts`

```typescript
// Firebase Cloud Messaging:
- requestPermission()
- getToken()
- onMessageListener()
```

**File da creare**: `public/firebase-messaging-sw.js`
```javascript
// Service Worker per notifiche background
```

#### 2. Notifiche in-app
**File da creare**: `src/components/notifications/NotificationBell.tsx`

```typescript
// Badge con contatore
// Dropdown con lista notifiche
// Mark as read
```

**File da creare**: `src/app/dashboard/notifications/page.tsx`
```typescript
// Lista completa notifiche
// Filtri per tipo
```

---

## 📋 SCHEMA DATABASE DA IMPLEMENTARE

### Collection: teams
```javascript
{
  teamId: "auto_id",
  nome: "Equipé DCA Roma",
  adminUid: "uid_creator",
  members: [
    {
      uid: "uid1",
      ruolo: "admin",
      joinedAt: Timestamp
    }
  ],
  settings: {
    slaRisposta: "48h",
    regole: "...",
    tematiche: ["DCA"]
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection: referrals
```javascript
{
  refId: "auto_id",
  teamId: "team_id",
  senderUid: "uid_sender",
  receiverUid: "uid_receiver",
  status: "sent",
  data: {
    quesito: "...",
    urgenza: "media",
    phiEncrypted: "encrypted_string",
    allegati: []
  },
  timeline: [
    {
      timestamp: Timestamp,
      action: "sent",
      actor: "uid",
      note: "..."
    }
  ],
  slaDeadline: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection: invites
```javascript
{
  inviteId: "auto_id",
  teamId: "team_id",
  inviterUid: "uid_inviter",
  invitedUid: "uid_invited",
  status: "pending" | "accepted" | "rejected",
  role: "referrer" | "receiver",
  createdAt: Timestamp,
  expiresAt: Timestamp
}
```

### Collection: notifications
```javascript
{
  notificationId: "auto_id",
  userId: "uid",
  type: "referral_received" | "invite" | "message",
  title: "...",
  message: "...",
  read: false,
  link: "/dashboard/referrals/xxx",
  createdAt: Timestamp
}
```

---

## 🔐 SECURITY RULES DA AGGIORNARE

### Aggiungere a firestore.rules:

```javascript
// Invites
match /invites/{inviteId} {
  allow read: if isAuthenticated() && 
              (resource.data.inviterUid == request.auth.uid ||
               resource.data.invitedUid == request.auth.uid);
  allow create: if isAuthenticated();
  allow update: if isAuthenticated() && 
                resource.data.invitedUid == request.auth.uid;
}

// Notifications
match /notifications/{notificationId} {
  allow read, write: if isAuthenticated() && 
                        resource.data.userId == request.auth.uid;
}
```

---

## 🎨 COMPONENTI UI DA CREARE

### 1. Card Components
- `TeamCard.tsx` - Card equipé
- `ReferralCard.tsx` - Card referral
- `ProfessionalCard.tsx` - Card professionista (già parzialmente nel dashboard)

### 2. Form Components
- `TeamForm.tsx` - Form crea/modifica equipé
- `ReferralForm.tsx` - Form crea referral
- `MessageInput.tsx` - Input messaggi referral

### 3. Modal Components
- `InviteMemberModal.tsx` - Modal invito membro
- `AcceptReferralModal.tsx` - Modal accettazione referral
- `CloseReferralModal.tsx` - Modal chiusura referral

### 4. Layout Components
- `DashboardLayout.tsx` - Layout riusabile per tutte le pagine dashboard
- `Sidebar.tsx` - Sidebar navigazione (opzionale)

---

## 📱 FIREBASE CLOUD FUNCTIONS

### Functions da creare (dopo MVP):

1. **onReferralCreated**
   - Invia notifica FCM al destinatario
   - Invia email
   - Calcola SLA deadline

2. **onSLAExpiring**
   - Scheduled function (ogni ora)
   - Controlla referral in scadenza
   - Invia reminder

3. **onTeamInvite**
   - Invia notifica invito
   - Invia email

4. **validateAlbo**
   - Function per verifica numero albo (chiamata admin)

---

## 🧪 TESTING

### Priorità per Fase 2:
1. Test autenticazione flow completo
2. Test creazione equipé
3. Test invio referral
4. Test encryption/decryption PHI
5. Test notifiche

---

## 📊 METRICHE DA TRACCIARE

- Numero utenti registrati
- Numero equipé create
- Numero referral inviati/completati
- Tempo medio risposta referral
- SLA rispettati vs non rispettati
- Tasso accettazione inviti equipé

---

## 🚀 DEPLOY CHECKLIST

Prima del deploy production:

- [ ] Configurare Firebase in modalità production
- [ ] Impostare regione EU per Firestore
- [ ] Attivare email verification obbligatoria
- [ ] Configurare dominio personalizzato
- [ ] Impostare CORS policies
- [ ] Configurare rate limiting
- [ ] Setup monitoring e alerting
- [ ] Backup automatici Firestore
- [ ] Privacy policy e Terms of Service
- [ ] Cookie consent (GDPR)

---

## 💡 FUTURE FEATURES (Post-MVP)

### Monetizzazione
- [ ] Pacchetti tematici premium
- [ ] Certificazioni profili avanzate
- [ ] Analytics equipé avanzati
- [ ] Videochiamate integrate

### Funzionalità Avanzate
- [ ] Chat in tempo reale (Firebase Realtime DB)
- [ ] Calendario condiviso equipé
- [ ] Export report referral (PDF)
- [ ] Integrazione calendari esterni
- [ ] App mobile nativa (React Native)
- [ ] Sistema di rating professionisti
- [ ] Marketplace servizi

---

**Ultima revisione**: 10 Gennaio 2026
