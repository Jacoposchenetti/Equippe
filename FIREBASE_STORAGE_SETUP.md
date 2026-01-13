# Setup Firebase Storage

## Il problema
Firebase Storage non è ancora attivato nel progetto. Gli errori CORS che vedi nella console sono dovuti a questo.

## Soluzione

### 1. Attiva Firebase Storage
1. Vai su: https://console.firebase.google.com/project/equippe-271f5/storage
2. Clicca su **"Get Started"** o **"Inizia"**
3. Seleziona la modalità di sicurezza (puoi scegliere "production mode" o "test mode")
4. Scegli la location: **europe-west1** (Milano) o **europe-west3** (Frankfurt)
5. Clicca su **"Done"** o **"Fine"**

### 2. Deploy delle regole di sicurezza
Una volta attivato Storage, esegui nel terminal:

```bash
cd equippe-mvp
firebase deploy --only storage
```

### 3. Verifica
Dopo il deploy, le regole di sicurezza saranno:
- ✅ Tutti gli utenti autenticati possono vedere le foto profilo
- ✅ Solo il proprietario può caricare/modificare la propria foto
- ✅ Limite di 5MB per foto
- ✅ Solo file immagine accettati

## Stato Attuale
Il codice è già configurato per:
- ✅ Gestire l'upload delle foto profilo in registrazione
- ✅ Gestire l'upload delle foto profilo in modifica profilo
- ✅ Visualizzare le foto nell'header e nei profili
- ✅ Continuare a funzionare anche se Storage non è disponibile (salva senza foto)
- ✅ Salvare correttamente il campo `dataNascita`

## Files coinvolti
- `storage.rules` - Regole di sicurezza Storage
- `firebase.json` - Configurazione aggiornata con Storage
- `src/lib/firebase.ts` - Storage inizializzato
- `src/app/register/page.tsx` - Upload foto in registrazione
- `src/app/profile/edit/page.tsx` - Upload foto in modifica profilo

## Note
Fino a quando non attivi Firebase Storage, il sistema funzionerà normalmente ma senza salvare le foto profilo. Tutti gli altri dati (inclusa la data di nascita) verranno salvati correttamente.
