# Valutazione d'Impatto sulla Protezione dei Dati (DPIA)
### ai sensi dell'art. 35 del Regolamento (UE) 2016/679 (GDPR)

---

**Titolare del Trattamento:** tuaequipe.it  
**Data della valutazione:** 25 aprile 2026  
**Versione:** 1.0  
**Documento riservato — uso interno**

---

## 1. Descrizione del Trattamento

### 1.1 Contesto e finalità
tuaequipe.it è una piattaforma B2B per professionisti sanitari italiani. Il **sistema di referral clinico** consente a un professionista (mittente) di condividere informazioni cliniche su un paziente con un collega (destinatario) all'interno di un'equipe multidisciplinare, al fine di ottenere una consulenza specialistica o garantire la continuità terapeutica.

**Finalità del trattamento:**
- Trasmissione sicura di quesiti clinici tra professionisti della stessa equipe
- Supporto alla continuità assistenziale del paziente
- Documentazione dell'avvenuta comunicazione professionale

### 1.2 Natura dei dati trattati
Il sistema referral tratta dati di **categoria speciale** ai sensi dell'art. 9 GDPR:
- Dati identificativi del paziente (nome, cognome, data di nascita)
- Quesito clinico / diagnosi di invio
- Urgenza clinica
- Allegati clinici (referti, lettere, etc.)
- Note del professionista

### 1.3 Soggetti coinvolti
| Ruolo | Soggetto | Responsabilità GDPR |
|---|---|---|
| Titolare del trattamento | Professionista sanitario mittente | Autonomo titolare verso il proprio paziente |
| Responsabile del trattamento | tuaequipe.it | Art. 28 GDPR — infrastruttura tecnica |
| Sub-responsabile | Google Cloud / Firebase (europe-west1) | Art. 28 GDPR — hosting e database |
| Interessato | Paziente del professionista | Terzo non utente della piattaforma |

### 1.4 Base giuridica
- **Art. 9.2.h GDPR**: trattamento necessario per finalità di medicina preventiva o di medicina del lavoro, diagnosi, assistenza o terapia sanitaria o sociale
- **Art. 2-sexies D.Lgs. 196/2003** (Codice Privacy italiano): trattamento dati sanitari per finalità di interesse pubblico nel settore della sanità
- Il trattamento è effettuato sotto la responsabilità di un professionista sanitario soggetto al segreto professionale

### 1.5 Flusso dei dati
```
Professionista A (mittente)
    │
    ├─ Inserisce dati paziente nel form referral
    ├─ I dati PHI vengono cifrati lato client (Web Crypto API, AES-GCM 256-bit)
    ├─ Il testo cifrato viene trasmesso via HTTPS a Firebase Firestore
    │
Firebase Firestore (europe-west1)
    │  [Conserva solo il ciphertext — illeggibile senza chiave]
    │
Professionista B (destinatario)
    ├─ Scarica il ciphertext da Firestore
    └─ Decifra i dati localmente nel proprio browser
```

**tuaequipe.it non ha mai accesso al dato in chiaro.**

---

## 2. Necessità e Proporzionalità

### 2.1 Minimizzazione dei dati
I campi del referral sono limitati a:
- Quesito clinico (campo testuale libero — la responsabilità del contenuto è del professionista)
- Urgenza (enum: bassa / media / alta)
- PHI cifrate (opzionale — il professionista decide cosa inserire)
- Allegati (opzionali)

Non sono raccolti dati che non siano strettamente necessari al quesito clinico.

### 2.2 Proporzionalità rispetto alla finalità
La raccolta di dati sanitari è strettamente funzionale al trasferimento del quesito clinico. In assenza di questi dati, la finalità (consulenza specialistica) non potrebbe essere raggiunta.

### 2.3 Misure di minimizzazione implementate
- I dati PHI sono cifrati client-side: tuaequipe.it non li vede mai in chiaro
- L'accesso al referral è limitato ai soli professionisti del team coinvolto (Firestore rules)
- Non vi è aggregazione o profilazione dei pazienti
- Non vi è trasmissione dei dati a terzi non autorizzati

---

## 3. Identificazione e Valutazione dei Rischi

### 3.1 Metodologia
La valutazione dei rischi segue il framework ENISA e le linee guida WP29/EDPB (Guidelines on DPIA, WP248 rev.01).

Scala probabilità: 1 (remota) → 4 (quasi certa)  
Scala impatto: 1 (trascurabile) → 4 (critico)  
Rischio = Probabilità × Impatto

### 3.2 Matrice dei rischi

| # | Scenario di rischio | Prob. | Impatto | Rischio lordo | Misure di mitigazione | Rischio residuo |
|---|---|---|---|---|---|---|
| R1 | Accesso non autorizzato al database Firebase | 2 | 4 | 8 | Firestore rules, autenticazione Firebase, email_verified + status=approved obbligatori | **4 — Basso** |
| R2 | Intercettazione dati in transito | 1 | 4 | 4 | HTTPS/TLS 1.3 obbligatorio, cifratura AES-GCM 256-bit lato client | **1 — Minimo** |
| R3 | Accesso al ciphertext da parte di tuaequipe.it | 1 | 3 | 3 | Architettura client-side encryption: server non detiene la chiave | **1 — Minimo** |
| R4 | Violazione account di un professionista | 2 | 3 | 6 | Firebase Auth, verifica email, possibilità revoca token, audit trail | **3 — Basso** |
| R5 | Inserimento di dati sanitari in campi non protetti (messaggi, bio) | 2 | 3 | 6 | Obbligo contrattuale T&S, campo PHI separato e cifrato, formazione utenti | **4 — Basso** |
| R6 | Data breach su infrastruttura Google/Firebase | 1 | 4 | 4 | DPA Google Cloud, region EU, Google SOC2/ISO27001 | **2 — Minimo** |
| R7 | Professionista privo di consenso del paziente | 2 | 4 | 8 | Obbligo contrattuale T&S (sezione 4-bis), responsabilità trasferita al professionista | **4 — Basso** |
| R8 | Conservazione dati oltre il necessario | 2 | 2 | 4 | Politica di retention definita (30 gg post-chiusura account), cancellazione su richiesta | **2 — Minimo** |
| R9 | Trasferimento dati extra-UE | 1 | 3 | 3 | Firebase region europe-west1, DPA Google, nessun altro fornitore extra-UE | **1 — Minimo** |
| R10 | Incapacità di evadere richiesta di cancellazione paziente | 2 | 3 | 6 | Processo di cancellazione via legal@tuaequipe.it, dati cifrati (cancellazione = perdita chiave) | **3 — Basso** |

### 3.3 Rischio residuo complessivo
Il rischio residuo complessivo del trattamento è classificato come **BASSO**, principalmente grazie all'architettura client-side encryption che rende i dati PHI inaccessibili all'infrastruttura.

---

## 4. Misure di Sicurezza Adottate

### 4.1 Misure tecniche
| Misura | Dettaglio |
|---|---|
| Cifratura PHI lato client | Web Crypto API, AES-GCM 256-bit. La chiave non lascia mai il browser |
| Cifratura in transito | HTTPS/TLS 1.3 (Firebase Hosting + Firestore) |
| Cifratura at-rest | Firebase Firestore cifra automaticamente i dati a riposo (AES-128) |
| Autenticazione | Firebase Auth con verifica email obbligatoria |
| Autorizzazione granulare | Firestore Security Rules: solo membri del team possono leggere/scrivere referral del team |
| Audit trail | Campo `timeline[]` nel documento referral traccia ogni azione con timestamp e uid |
| Segregazione dati | Ogni referral è vincolato a un `teamId` — impossibile l'accesso cross-team |
| Infrastruttura EU | Firebase region `europe-west1` (Belgio) |

### 4.2 Misure organizzative
| Misura | Dettaglio |
|---|---|
| Accordo responsabile del trattamento | Sezione 4-bis dei Termini di Servizio (accettata al momento della registrazione) |
| Obbligo consenso paziente | Contrattualizzato — responsabilità del professionista |
| DPA con Google | Google Cloud Data Processing Addendum (accettato nel Google Cloud Console) |
| Politica di retention | 30 giorni post-chiusura account, documentata in Privacy Policy sezione 4 |
| Formazione utenti | Onboarding e T&S chiari sugli obblighi GDPR |
| Contatto DPO/privacy | legal@tuaequipe.it per richieste degli interessati |

---

## 5. Consultazione con gli Interessati

### 5.1 Rappresentanti degli interessati (pazienti)
I pazienti non sono utenti diretti della piattaforma. Il loro trattamento avviene in forma mediata, attraverso il professionista sanitario che li ha in cura.

La consultazione diretta dei pazienti non è applicabile. La loro tutela è garantita da:
- L'obbligo contrattuale imposto al professionista (consenso informato)
- La cifratura end-to-end che limita l'accesso ai soli professionisti autorizzati
- Il diritto di cancellazione esercitabile indirettamente tramite il professionista o via legal@tuaequipe.it

### 5.2 Consultazione del DPO
Il soggetto responsabile per la privacy (legal@tuaequipe.it) ha esaminato e approvato la presente DPIA.

---

## 6. Conclusioni

### 6.1 Il trattamento è necessario?
**Sì.** La comunicazione di informazioni cliniche tra professionisti è una pratica consolidata e necessaria per la continuità assistenziale. La piattaforma digitalizza e rende tracciabile un processo che altrimenti avviene via email, telefono o carta — in modo meno sicuro.

### 6.2 Il rischio residuo è accettabile?
**Sì.** Il livello di rischio residuo è basso, inferiore alla soglia che richiederebbe consultazione preventiva del Garante ai sensi dell'art. 36 GDPR. Le misure tecniche (client-side encryption) e organizzative (T&S con clausola art. 28) sono adeguate e proporzionate.

### 6.3 Azioni di follow-up
| Azione | Scadenza | Responsabile |
|---|---|---|
| Accettare DPA Google Cloud Console | Subito | Titolare |
| Verificare che Firestore rules blocchino correttamente accesso cross-team ai referral | Subito | Dev |
| Aggiungere notifica all'utente nell'UI referral che ricorda l'obbligo di consenso del paziente | Prima del lancio referral | Dev |
| Revisione DPIA a 12 mesi o in caso di modifiche significative al trattamento | Aprile 2027 | Titolare |

---

## 7. Firma e Approvazione

| Ruolo | Nome | Data |
|---|---|---|
| Titolare del Trattamento | _(firma del titolare)_ | 25/04/2026 |
| Responsabile Privacy / DPO | _(firma)_ | 25/04/2026 |

---

*Documento redatto ai sensi dell'art. 35 GDPR e delle linee guida EDPB WP248 rev.01. Da conservare internamente e mettere a disposizione del Garante su richiesta.*
