# Script di Manutenzione Database

## Prerequisiti

1. Scarica la chiave privata del servizio Firebase:
   - Vai su Firebase Console → Project Settings → Service Accounts
   - Clicca su "Generate new private key"
   - Salva il file in una posizione sicura fuori dal repository

2. Esporta la variabile d'ambiente con il path del file JSON:
   - PowerShell (sessione corrente):
     ```powershell
     $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\firebase-adminsdk.json"
     ```
   - PowerShell (persistente per il tuo utente):
     ```powershell
     setx GOOGLE_APPLICATION_CREDENTIALS "C:\\path\\to\\firebase-adminsdk.json"
     ```

3. Installa le dipendenze:
   ```bash
   npm install firebase-admin
   ```

## Script Disponibili

### 0. Smoke Test Email (Firebase + Functions)
```bash
npm run smoke:email
```

- Legge il project ID da `.firebaserc`
- Analizza i log recenti delle Cloud Functions email
- Mostra report `OK/ERROR` per le funzioni principali
- Restituisce exit code non-zero se trova errori email

### 1. Clean Duplicate Conversations
```bash
node scripts/cleanDuplicateConversations.js
```

- Cercherà tutte le conversazioni duplicate
- Mantiene solo la più recente per ogni coppia di utenti
- Elimina tutte le altre conversazioni duplicate

### 2. Migrate Studi Field
```bash
node scripts/migrateStudiField.js
```

- Aggiunge il campo `profile.studi` a tutti gli utenti che non ce l'hanno
- Migra i dati da `profile.location` al nuovo array `studi`
- Mantiene la compatibilità con il vecchio formato

**Rollback:**
```bash
node scripts/migrateStudiField.js rollback
```

### 3. Fix Studi Coordinates
```bash
node scripts/fixStudiCoordinates.js
```

- Ottiene le coordinate reali degli indirizzi degli studi usando geocoding
- Aggiorna solo gli studi con coordinate non valide (0,0)
- Usa OpenStreetMap Nominatim (servizio gratuito)

**Test geocoding:**
```bash
node scripts/fixStudiCoordinates.js test
```

### 4. Altri script
- `checkUserData.js` - Verifica integrità dati utente
- `debugProfile.js` - Debug profilo specifico
- `migrateConsentsFromBrowser.js` - Migrazione consensi
- `migrateGdprConsents.js` - Migrazione GDPR
- `testTeamPhoto.js` - Test upload foto team
- `updateConversationsPhotos.js` - Aggiornamento foto conversazioni

## Importante

⚠️ **BACKUP**: Prima di eseguire qualsiasi script, fai un backup del database Firestore dalla console Firebase!

⚠️ **SICUREZZA**: NON committare mai file JSON di service account su Git. Gli script usano `GOOGLE_APPLICATION_CREDENTIALS`.
