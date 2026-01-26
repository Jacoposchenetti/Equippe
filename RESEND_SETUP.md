# Setup Email con Resend

## 1. Crea Account Resend

1. Vai su [resend.com](https://resend.com)
2. Crea un account
3. Verifica il tuo dominio (o usa il dominio di test)

## 2. Ottieni API Key

1. Nel dashboard di Resend, vai su "API Keys"
2. Crea una nuova API key
3. Copia la chiave (inizia con `re_`)

## 3. Configura Firebase

### Per Sviluppo Locale

Crea un file `.env` nella cartella `functions/`:

```
RESEND_API_KEY=re_your_api_key_here
```

### Per Produzione

Imposta la variabile d'ambiente in Firebase:

```bash
firebase functions:config:set resend.api_key="re_your_api_key_here"
```

Oppure usa Firebase Environment Variables (consigliato):

```bash
firebase functions:secrets:set RESEND_API_KEY
```

## 4. Configura il Dominio Email

### Opzione 1: Usa il dominio di test (per sviluppo)
Resend fornisce un dominio di test `onboarding@resend.dev` che puoi usare subito.

### Opzione 2: Configura il tuo dominio (per produzione)

1. In Resend, vai su "Domains"
2. Aggiungi il tuo dominio (es. `equippe.it`)
3. Aggiungi i record DNS richiesti:
   - TXT record per verifica dominio
   - MX, TXT (SPF), TXT (DKIM) per invio email
4. Verifica il dominio

### Record DNS richiesti (esempio):
```
Type: TXT
Name: @
Value: resend-verification-code

Type: MX
Name: @
Value: feedback-smtp.resend.com
Priority: 10

Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all

Type: TXT
Name: resend._domainkey
Value: [fornito da Resend]
```

## 5. Aggiorna Email nel Codice

Una volta configurato il dominio, aggiorna le email in `functions/src/index.ts`:

```typescript
from: 'Equippe <noreply@tuodominio.it>'
```

## 6. Deploy

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

## 7. Test

Puoi testare l'invio email chiamando le Cloud Functions:

### Test Email di Benvenuto
Viene inviata automaticamente alla registrazione di un nuovo utente.

### Test Email Reset Password
```javascript
const functions = getFunctions();
const sendPasswordReset = httpsCallable(functions, 'sendPasswordResetEmail');
await sendPasswordReset({ email: 'test@example.com' });
```

### Test Email Approvazione Professione
```javascript
const sendApproval = httpsCallable(functions, 'sendProfessionApprovedEmail');
await sendApproval({
  userId: 'user123',
  professione: 'Psicologo',
  userEmail: 'user@example.com',
  userName: 'Mario Rossi'
});
```

## Funzioni Email Disponibili

1. **sendWelcomeEmail** - Automatica alla registrazione
2. **sendProfessionVerificationEmail** - Automatica quando utente aggiunge professione
3. **sendProfessionApprovedEmail** - Chiamata manualmente dall'admin
4. **sendProfessionRejectedEmail** - Chiamata manualmente dall'admin
5. **sendNewMessageEmail** - Chiamata quando arriva un messaggio
6. **sendPasswordResetEmail** - Chiamata per reset password

## Monitoraggio

- Dashboard Resend: monitora email inviate, rate di apertura, bounce, etc.
- Firebase Console: logs delle Cloud Functions
- Firebase Analytics: eventi di invio email

## Limiti Resend

### Piano Gratuito:
- 100 email/giorno
- 3,000 email/mese
- 1 dominio verificato

### Piani a Pagamento:
- A partire da $20/mese per 50,000 email
- Dominio personalizzato
- Support

## Troubleshooting

### Email non arrivano
1. Verifica che il dominio sia verificato in Resend
2. Controlla i logs in Firebase Console
3. Verifica che la API key sia configurata correttamente
4. Controlla che l'email del destinatario sia valida
5. Controlla spam/junk folder

### Errore API Key
```bash
firebase functions:config:get
```
Verifica che `resend.api_key` sia configurata.

### Test in locale
Usa Firebase Emulators:
```bash
cd functions
npm run serve
```

## Note Importanti

- **Non committare mai la API key** nel repository
- Usa variabili d'ambiente per gestire le chiavi
- Configura SPF, DKIM e DMARC per evitare spam
- Testa sempre prima in ambiente di sviluppo
- Rispetta le normative GDPR per l'invio email
