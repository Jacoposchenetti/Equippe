# 🚀 Guida al Deployment su Aruba

## Prerequisiti
- [ ] Hosting Aruba attivo con supporto PHP/HTML
- [ ] Accesso FTP/SFTP
- [ ] Dominio tuaequipe.it configurato
- [ ] Node.js installato localmente

## 📦 Preparazione del Build

### 1. Esegui il Build
```bash
npm run build
```

Il comando dovrebbe completarsi senza errori e generare la cartella `.next/`.

### 2. Verifica i File
Assicurati che siano presenti:
- ✅ `.next/` - Cartella con il build Next.js
- ✅ `public/` - Assets statici
- ✅ `.htaccess` - Configurazione server Apache
- ✅ `package.json` - Metadati del progetto

## 📤 Upload su Aruba

### Metodo 1: Script Automatico (Raccomandato)
```powershell
# Windows
.\deploy.ps1

# Linux/Mac
./deploy.sh
```

### Metodo 2: Upload Manuale

1. **Connettiti via FTP/SFTP**
   - Host: tuodominio.it (o l'IP fornito da Aruba)
   - Username: il tuo username FTP
   - Password: la tua password FTP
   - Porta: 21 (FTP) o 22 (SFTP)

2. **Struttura di Upload**
   ```
   public_html/
   ├── .next/                    # Carica TUTTA la cartella
   │   ├── static/
   │   ├── server/
   │   └── ...
   ├── .htaccess                 # File nella root
   ├── package.json              # File nella root
   └── assets da public/         # Solo il CONTENUTO di public/
       ├── favicon.ico
       ├── images/
       └── firebase-messaging-sw.js
   ```

3. **⚠️ Attenzione**
   - NON caricare la cartella `public/` stessa, ma solo il suo contenuto
   - Il file `.htaccess` DEVE essere nella root (`public_html/`)
   - Assicurati che tutti i permessi siano corretti (644 per file, 755 per cartelle)

## 🔧 Configurazioni Server

### 1. Verifica .htaccess
Il file `.htaccess` deve contenere:
```apache
# Forza HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# SPA routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### 2. Variabili d'Ambiente (se supportate)
Nel pannello di controllo Aruba, configura:
```
NODE_ENV=production
NEXT_PUBLIC_FIREBASE_API_KEY=tua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tuo_progetto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tuo_progetto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tuo_progetto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=tua_app_id
```

## 🔥 Configurazione Firebase

### 1. Autorizza il Dominio
Nel console Firebase:
1. Vai su **Authentication** → **Settings** → **Authorized domains**
2. Aggiungi `tuaequipe.it`

### 2. Aggiorna CORS per Storage
```javascript
// Nel Google Cloud Console
gsutil cors set cors.json gs://tuo_progetto.appspot.com
```

Contenuto di `cors.json`:
```json
[
  {
    "origin": ["https://tuaequipe.it"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

### 3. Aggiorna Security Rules
```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Le tue regole esistenti
  }
}

// Storage Rules  
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Le tue regole esistenti
  }
}
```

## 🌍 Configurazione DNS

### Su Aruba:
1. Vai nel **Pannello di Controllo**
2. **Gestione DNS**
3. Verifica che il record A punti al server hosting
```
@ IN A 123.456.789.123  (IP del server Aruba)
www IN CNAME tuaequipe.it
```

## ✅ Test Post-Deploy

### 1. Verifica Base
- [ ] Il sito si carica su https://tuaequipe.it
- [ ] Il redirect da HTTP a HTTPS funziona
- [ ] Le pagine statiche si caricano (/login, /register, ecc.)

### 2. Verifica Routing
- [ ] Le route dinamiche funzionano (/profile/[uid], /teams/[id])
- [ ] Il refresh delle pagine non dà errore 404
- [ ] I link interni funzionano correttamente

### 3. Verifica Firebase
- [ ] Login/registrazione funziona
- [ ] I dati si salvano correttamente
- [ ] Le immagini si caricano
- [ ] Le notifiche push funzionano

### 4. Verifica Performance
- [ ] Immagini ottimizzate
- [ ] CSS e JS minificati
- [ ] Compressione GZIP attiva
- [ ] Cache headers configurati

## 🚨 Risoluzione Problemi Comuni

### 404 su Route Dinamiche
**Problema**: `/teams/123` dà errore 404
**Soluzione**: Verifica che `.htaccess` sia nella root e contenga le regole di rewrite

### Firebase Auth Errori
**Problema**: Errori di autenticazione
**Soluzione**: Aggiungi `tuaequipe.it` nei domini autorizzati Firebase

### Immagini Non si Caricano
**Problema**: Le immagini danno errore 404
**Soluzione**: Verifica che il contenuto di `public/` sia nella root di `public_html/`

### Service Worker Errori
**Problema**: PWA non funziona
**Soluzione**: Verifica che `firebase-messaging-sw.js` sia accessibile dalla root

## 📞 Supporto

### Log degli Errori
Controlla i log nel pannello Aruba per identificare problemi specifici.

### Test Locale
Prima del deploy, testa sempre con:
```bash
npm run build
npm start
```

### Backup
Mantieni sempre un backup del sito precedente prima dell'upload.

## 🎉 Deployment Completato!

Una volta completati tutti i passi, il tuo sito TuaEquipe.it dovrebbe essere online e funzionante su https://tuaequipe.it.

---

**Ultima modifica**: $(Get-Date -Format "yyyy-MM-dd HH:mm")
**Versione**: 1.0