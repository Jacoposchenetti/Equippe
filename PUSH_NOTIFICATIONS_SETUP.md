# Setup Notifiche Push Firebase Cloud Messaging

## Stato Implementazione
✅ Service Worker creato (`public/firebase-messaging-sw.js`)
✅ Funzioni FCM aggiunte (`src/lib/notifications.ts`)
✅ Cloud Functions create (`functions/src/index.ts`)
✅ Componente UI per richiesta permessi (`src/components/PushNotificationManager.tsx`)
✅ Integrato nel layout principale

## Setup Necessario

### 1. Genera VAPID Key

Le VAPID keys sono necessarie per le notifiche web push. Generale dalla console Firebase:

1. Vai su: https://console.firebase.google.com/project/equippe-271f5/settings/cloudmessaging
2. Nella sezione **"Web Push certificates"**
3. Clicca **"Generate key pair"**
4. Copia la chiave generata

### 2. Aggiungi VAPID Key al .env.local

Apri il file `.env.local` e aggiungi:

```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-generated-vapid-key-here
```

### 3. Installa dipendenze Cloud Functions

```bash
cd functions
npm install
cd ..
```

### 4. Deploy Cloud Functions

```bash
firebase deploy --only functions
```

Questo deploierà:
- `sendPushNotification` - Invia push quando viene creata una notifica
- `cleanupOldFCMTokens` - Pulisce token FCM obsoleti (esegue ogni notte)

### 5. Testa le Notifiche

1. Accedi all'app
2. Dopo 10 secondi apparirà un popup per abilitare le notifiche
3. Clicca "Abilita" e accetta il permesso del browser
4. Il token FCM verrà salvato nel tuo profilo Firestore

Per testare:
- Fai una richiesta di adesione a un'equipé
- Invia un messaggio
- Crea un invito

## Funzionalità Implementate

### Client-Side (Browser)
- ✅ Richiesta permessi notifiche
- ✅ Registrazione Service Worker
- ✅ Ottenimento token FCM
- ✅ Salvataggio token in Firestore
- ✅ Listener messaggi in foreground
- ✅ UI prompt per abilitazione

### Server-Side (Cloud Functions)
- ✅ Trigger automatico su creazione notifica
- ✅ Invio push notification con FCM
- ✅ Gestione token invalidi
- ✅ Cleanup automatico token vecchi
- ✅ URL dinamici per ogni tipo di notifica

### Service Worker
- ✅ Gestione notifiche in background
- ✅ Click handler per aprire URL corretto
- ✅ Badge e icone personalizzate
- ✅ Gestione focus finestre esistenti

## Tipi di Notifiche Supportate

Tutte le notifiche esistenti invieranno automaticamente push:

1. `team_request` - Richiesta di adesione equipé
2. `team_request_accepted` - Richiesta accettata
3. `team_removal` - Rimozione da equipé
4. `team_admin_promotion` - Promosso ad admin
5. `team_member_left` - Membro ha lasciato
6. `team_invite_response` - Invito a equipé
7. `new_message` - Nuovo messaggio
8. `referral_received` - Referral ricevuto
9. `referral_accepted` - Referral accettato

## Configurazione Firebase Console

Verifica che Firebase Cloud Messaging sia abilitato:
1. Vai su: https://console.firebase.google.com/project/equippe-271f5/settings/cloudmessaging
2. Controlla che sia abilitato

## Debug

### Console Browser
```javascript
// Verifica permessi
console.log('Permission:', Notification.permission);

// Verifica service worker
navigator.serviceWorker.getRegistrations().then(regs => console.log(regs));

// Verifica token
// Apri DevTools > Application > IndexedDB > firebaseLocalStorage
```

### Cloud Functions Logs
```bash
firebase functions:log
```

### Test Manuale Notifica

Puoi testare manualmente dalla Firebase Console:
1. Vai su Cloud Messaging
2. "Send test message"
3. Inserisci il token FCM di un utente
4. Invia

## Note Importanti

- Le notifiche push funzionano solo su HTTPS (o localhost)
- Il browser deve supportare Service Workers
- L'utente deve aver dato il permesso
- I token FCM scadono e vengono aggiornati automaticamente
- Le notifiche in foreground mostrano un popup browser
- Le notifiche in background sono gestite dal service worker

## Prossimi Passi

Dopo il setup:
1. ✅ Testa con un utente reale
2. ⬜ Personalizza icone notifiche
3. ⬜ Aggiungi azioni nelle notifiche (es. "Rispondi", "Accetta")
4. ⬜ Implementa notifiche silenziose per sync dati
5. ⬜ Analytics sulle notifiche
