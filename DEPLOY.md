# 🚀 Guida Deploy TuaEquipe.it su Aruba

## Passaggi per mettere online il sito:

### 1. **Genera il build di produzione**
```bash
npm run deploy
```
Questo comando genererà la cartella `out/` con tutti i file del sito.

### 2. **Configura Firebase per produzione**
- Vai su [Firebase Console](https://console.firebase.google.com)
- Crea un nuovo progetto chiamato "tuaequipe-prod" (o simile)
- Attiva Authentication e Firestore
- Copia le nuove credenziali in `src/lib/firebase.ts`

### 3. **Upload su Aruba**

#### Via File Manager:
1. Accedi al pannello di controllo Aruba
2. Vai su "Gestione File" o "File Manager"
3. Naviga in `/public_html/`
4. **IMPORTANTE**: Carica tutto il CONTENUTO della cartella `out/` (non la cartella stessa)
5. Carica anche il file `.htaccess` nella root

#### Via FTP:
- Host: `ftp.tuaequipe.it` (o quello fornito da Aruba)
- Utente/Password: quelli del tuo account Aruba
- Percorso: `/public_html/`

### 4. **Configurazioni Aruba**

#### SSL:
- Attiva SSL gratuito nel pannello Aruba
- Forza sempre HTTPS

#### Email:
- Configura le 5 caselle email consigliate:
  - info@tuaequipe.it
  - support@tuaequipe.it  
  - admin@tuaequipe.it
  - noreply@tuaequipe.it
  - legal@tuaequipe.it

### 5. **Test finale**
1. Visita `https://tuaequipe.it`
2. Testa registrazione e login
3. Verifica email di verifica
4. Testa le funzionalità principali

### 6. **Aggiornamenti futuri**
Per aggiornare il sito:
1. Modifica il codice
2. Esegui `npm run deploy`
3. Ricarica il contenuto di `out/` su Aruba

### 📧 Configurazione Email di Sistema
Nel codice sono già configurate:
- support@tuaequipe.it (per assistenza)
- noreply@tuaequipe.it (per email automatiche)

### 🔒 Sicurezza
Il file `.htaccess` include:
- Redirect HTTPS automatico
- Headers di sicurezza
- Cache ottimizzata
- Compressione GZIP

---
**Nota**: Dopo il primo deploy, potrebbero servire 24-48h per la propagazione DNS completa.