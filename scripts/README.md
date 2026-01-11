# Script per Pulire Conversazioni Duplicate

## Prerequisiti

1. Scarica la chiave privata del servizio Firebase:
   - Vai su Firebase Console → Project Settings → Service Accounts
   - Clicca su "Generate new private key"
   - Salva il file come `serviceAccountKey.json` nella cartella root del progetto (`equippe-mvp/`)

2. Installa le dipendenze:
   ```bash
   npm install firebase-admin
   ```

## Come Usare lo Script

1. Apri il terminale nella cartella del progetto:
   ```bash
   cd C:\Users\User1\Desktop\Progetti\Equippe\equippe-mvp
   ```

2. Esegui lo script:
   ```bash
   node scripts/cleanDuplicateConversations.js
   ```

3. Lo script:
   - Cercherà tutte le conversazioni duplicate
   - Ti mostrerà un elenco di quelle da eliminare
   - Ti chiederà conferma prima di procedere

4. Digita `y` per confermare l'eliminazione, oppure `n` per annullare

## Come Funziona

Lo script:
- Trova tutte le conversazioni con gli stessi partecipanti
- Mantiene solo la più recente per ogni coppia di utenti
- Elimina tutte le altre conversazioni duplicate

## Importante

⚠️ **BACKUP**: Prima di eseguire lo script, fai un backup del database Firestore dalla console Firebase!

⚠️ **SICUREZZA**: NON committare mai il file `serviceAccountKey.json` su Git! È già nel .gitignore.
