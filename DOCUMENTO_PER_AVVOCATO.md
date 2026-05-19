# tuaequipe.it — Documento di Sintesi per Consulenza Legale

**Preparato da:** Jacopo Schenetti (fondatore)  
**Data:** 25 aprile 2026  
**Scopo:** Revisione legale della conformità del servizio in materia di privacy, GDPR, trattamento dati sanitari, termini contrattuali e posizione del titolare come persona fisica non ancora strutturata (senza P.IVA o società).

---

## PARTE 1 — CHI SONO E COSA HO COSTRUITO

### 1.1 Il fondatore
- Nome: Jacopo Schenetti
- Ruolo: sviluppatore e titolare del servizio a titolo personale
- **Non ho ancora partita IVA né ho costituito alcuna società**
- Contatto operativo: legal@tuaequipe.it / admin@tuaequipe.it

### 1.2 Il servizio: tuaequipe.it
**tuaequipe.it** (anche detto "Equippe") è una piattaforma web italiana destinata a **professionisti sanitari** (psicologi, psichiatri, medici, fisioterapisti, logopedisti, nutrizionisti, educatori professionali, ecc.) che permette loro di:

1. **Creare un profilo professionale verificato** — con specializzazioni, studio, disponibilità, iscrizione all'albo
2. **Trovare colleghi** — ricerca per specializzazione, zona geografica, disponibilità remota
3. **Formare equipe multidisciplinari** — gruppi di professionisti che collaborano su casi clinici
4. **Inviare referral clinici cifrati** — passaggio sicuro di informazioni su pazienti da un professionista all'altro all'interno di un'equipe
5. **Scambiare messaggi** — chat interna tra membri di un'equipe
6. **Pubblicare offerte sul marketplace** — offerte di collaborazione per presa in carico continuativa
7. **Gestire la fatturazione** — emissione fatture verso i propri clienti/pazienti (funzione ad uso del professionista, non del titolare)
8. **Accedere a corsi ECM** — integrazione con il portale AGENAS per la formazione continua in medicina

### 1.3 Chi usa la piattaforma
La piattaforma ha **due lati distinti**:

**Lato B2B — Professionisti sanitari:**
Gli utenti primari sono professionisti sanitari verificati che si registrano, creano profili, formano equipe e inviano referral.

**Lato B2C — Pazienti (implementato, da analizzare):**
Esiste anche un lato paziente, attualmente in sviluppo ma tecnicamente funzionante, che comprende:
- **Profili pubblici dei professionisti** (`/trova/{uid}`) — visibili a chiunque, con foto, bio, specializzazione e widget di prenotazione
- **Booking widget** — i pazienti possono prenotare appuntamenti direttamente dal profilo pubblico del professionista, scegliendo data/ora tra gli slot disponibili
- **Account paziente** — i pazienti possono registrarsi (`/paziente/registrati`) con nome, cognome, email, password e accettazione Privacy Policy
- **Login paziente** (`/paziente/login`) — accesso separato dall'accesso professionisti
- **Area appuntamenti paziente** (`/paziente/appuntamenti`) — il paziente vede i propri appuntamenti prenotati

I dati dei pazienti con account vengono salvati nella collection `patients/{uid}` su Firebase Firestore (distinta dalla collection `users/{uid}` dei professionisti).

### 1.4 Stato attuale
- Piattaforma in produzione su tuaequipe.it (hosting Firebase + Aruba)
- Utenti: piccolo numero, fase early-stage / beta
- Abbonamenti: non ancora attivi (previsti con Lemon Squeezy come Merchant of Record)
- Repository: GitHub privato (github.com/Jacoposchenetti/Equippe)

---

## PARTE 2 — ARCHITETTURA TECNICA (rilevante per il legale)

### 2.1 Stack tecnologico
| Componente | Tecnologia | Provider | Localizzazione |
|---|---|---|---|
| Frontend | React + TypeScript | — | — |
| Database | Firebase Firestore | Google Cloud | europe-west1 (Belgio, UE) |
| Autenticazione | Firebase Auth | Google Cloud | europe-west1 |
| File storage | Firebase Storage | Google Cloud | europe-west1 |
| Cloud Functions | Firebase Functions | Google Cloud | europe-west1 |
| Email transazionali | Resend | Resend Inc. (USA) | — |
| Pagamenti (futuri) | Lemon Squeezy | Lemon Squeezy LLC (USA) | Merchant of Record |
| Hosting principale | Firebase Hosting | Google Cloud | CDN globale |

### 2.2 Struttura dati principale (Firestore)
- `users/{uid}` — profilo del professionista (dati anagrafici, professione, studi, disponibilità)
- `patients/{uid}` — profilo del paziente (nome, cognome, email, createdAt)
- `appointments/{id}` — appuntamenti prenotati (paziente, professionista, data, ora, tipo visita, stato)
- `availability/{uid}` — disponibilità del professionista (orari, slot, flag isPublic)
- `teams/{teamId}` — equipe multidisciplinari
- `referrals/{refId}` — referral clinici (contengono PHI cifrate)
- `users/{uid}/fatture/` — fatture emesse dal professionista verso i suoi clienti
- `users/{uid}/clienti/` — anagrafica clienti del professionista

### 2.3 Cifratura dei dati sanitari (PHI)
I dati identificativi del paziente nel sistema referral sono **cifrati lato client** prima di lasciare il browser del professionista, usando **Web Crypto API con algoritmo AES-GCM 256-bit**. Il server (Firebase) conserva solo il testo cifrato: tuaequipe.it tecnicamente non ha mai accesso ai dati in chiaro dei pazienti. Solo il mittente e il destinatario del referral possono decifrare i dati nel proprio browser.

---

## PARTE 3 — IL SISTEMA REFERRAL E I DATI SANITARI

### 3.1 Come funziona un referral
1. Un professionista (es. psicologo) vuole inviare un paziente a un collega specialista (es. psichiatra) della stessa equipe
2. Compila un form con: quesito clinico, urgenza (bassa/media/alta), dati del paziente (facoltativi ma tipicamente inseriti), allegati clinici
3. I dati del paziente vengono cifrati nel browser prima dell'invio
4. Il collega destinatario riceve una notifica, accede al referral e decifra i dati localmente
5. Il referral passa per stati: bozza → inviato → accettato → chiuso

### 3.2 Tipologia di dati trattati nel referral
- Nome, cognome, data di nascita del paziente
- Quesito clinico / diagnosi di invio
- Urgenza clinica
- Allegati (referti, lettere, documentazione clinica)
- Note cliniche del professionista

Questi sono **dati di categoria speciale** ai sensi dell'art. 9 GDPR (dati sulla salute).

### 3.3 Ruoli GDPR nel sistema referral
| Ruolo | Soggetto | Obbligo |
|---|---|---|
| Titolare del trattamento | Il professionista sanitario (mittente) | Ha il rapporto con il paziente, deve avere il consenso informato |
| Responsabile del trattamento (art. 28) | tuaequipe.it | Fornisce infrastruttura, non usa i dati per fini propri |
| Sub-responsabile | Google Cloud / Firebase | Hosting dei dati cifrati |
| Interessato | Il paziente | Non è utente della piattaforma |

### 3.4 Cosa garantisce il professionista (nei T&S)
I Termini di Servizio (sezione 4-bis) prevedono che il professionista, accettando i T&S, dichiari di:
- Aver acquisito il consenso informato del paziente prima di inserire qualsiasi suo dato
- Inserire solo i dati strettamente necessari al quesito clinico
- Essere il titolare autonomo del trattamento verso il proprio paziente

### 3.5 Account pazienti
**I pazienti possono creare un account sulla piattaforma.** Questo è un elemento importante da analizzare.

**Dati raccolti al momento della registrazione paziente:**
- Nome e cognome
- Email
- Password (gestita da Firebase Auth)
- Consenso Privacy Policy (checkbox obbligatorio)

**Dati generati dall'uso:**
- Appuntamenti prenotati (data, ora, tipo visita, professionista, sede)
- Email del paziente collegata agli appuntamenti prenotati anche prima della registrazione

**Flusso:**
1. Il paziente trova il profilo pubblico di un professionista su `/trova/{uid}`
2. Può prenotare un appuntamento anche senza account (tramite email)
3. Può registrarsi per avere un'area personale `/paziente/appuntamenti` dove vedere tutti i suoi appuntamenti
4. Al momento della registrazione, gli appuntamenti prenotati con quella email vengono automaticamente collegati al nuovo account

**NOTA PER L'AVVOCATO:** Questo cambia significativamente il perimetro del trattamento dati. I pazienti sono ora **interessati diretti** (non più solo terzi intermediati dal professionista). Questo implica:
- Necessità di una informativa privacy specifica rivolta ai pazienti (distinta da quella per i professionisti)
- Il fatto che il paziente accetti la Privacy Policy al momento della registrazione è documentato nel codice, ma la Privacy Policy attuale è scritta principalmente per i professionisti
- Il dato "paziente di un determinato professionista" è di per sé un dato sensibile (rivela una relazione terapeutica)
- Gli appuntamenti prenotati contengono: data, ora, tipo di visita — sono dati sanitari?

---

## PARTE 3-bis — LATO B2C: PAZIENTI E PRENOTAZIONI

### 3b.1 Come funziona il sistema di prenotazione
1. I professionisti con piano Pro/Best possono rendere pubblico il loro profilo e impostare la propria disponibilità (orari, tipi di visita, durata slot, buffer tra appuntamenti)
2. Il profilo pubblico del professionista è accessibile a chiunque su `/trova/{uid}` senza necessità di login
3. Un paziente può prenotare un appuntamento scegliendo data e ora tra gli slot disponibili
4. Al momento della prenotazione vengono raccolti: nome, cognome, email del paziente, tipo di visita, note (facoltative)
5. Il professionista riceve una notifica dell'appuntamento prenotato
6. Il paziente può registrarsi per accedere alla propria area appuntamenti

### 3b.2 Dati trattati nel sistema prenotazioni

**Dati del paziente (anche senza account):**
- Nome, cognome, email — raccolti nel form di prenotazione
- Data, ora, tipo di visita prenotata
- Note facoltative del paziente

**Dati aggiuntivi con account paziente:**
- Password (Firebase Auth)
- Storico di tutti gli appuntamenti collegati alla propria email

### 3b.3 Analisi GDPR del sistema prenotazioni

**Natura dei dati:**
Il dato "appuntamento con uno psicologo/medico/fisioterapista in data X" è potenzialmente un **dato sanitario** ai sensi dell'art. 9 GDPR, in quanto rivela informazioni sullo stato di salute e sulla relazione terapeutica del paziente. Questo è particolarmente vero per specialità come psicologia, psichiatria, oncologia, ecc.

**Ruolo di tuaequipe.it:**
Nel sistema prenotazioni, tuaequipe.it non è più solo responsabile del trattamento (come nel referral), ma potrebbe essere considerato **contitolare** o addirittura **titolare autonomo** del trattamento dei dati del paziente, poiché:
- È tuaequipe.it a raccogliere direttamente i dati del paziente tramite il form di prenotazione
- È tuaequipe.it a conservarli su Firebase
- Il paziente accetta la Privacy Policy di tuaequipe.it (non quella del professionista)

**Base giuridica attuale:**
- Consenso (art. 6.1.a + art. 9.2.a GDPR) — il paziente accetta la Privacy Policy al momento della registrazione

**Problemi aperti (da analizzare con l'avvocato):**
- La Privacy Policy attuale è scritta principalmente per i professionisti, non per i pazienti
- Non è chiaro se "accetto la Privacy Policy" al momento della registrazione costituisca un consenso esplicito al trattamento di dati sanitari (art. 9.2.a GDPR richiede consenso **esplicito**)
- Il sistema di prenotazione senza account (solo email) non raccoglie alcun consenso formale

### 3b.4 Separazione architetturale tra profili
- I professionisti sono nella collection `users/{uid}` — accedono da `/login`
- I pazienti sono nella collection `patients/{uid}` — accedono da `/paziente/login`
- Gli appuntamenti sono nella collection `appointments/{id}` — accessibili sia ai professionisti (per gestire la propria agenda) che ai pazienti (per vedere i propri appuntamenti)
- Un utente professionista può anche avere un account paziente (dual-role, gestito nel codice)

---



### 4.1 Privacy Policy (in produzione su /privacy)

**Struttura attuale:**
1. Titolare del trattamento — tuaequipe.it, persona fisica, legal@tuaequipe.it
2. Dati trattati:
   - Dati identificativi e professionali dei professionisti
   - Dati di utilizzo (messaggi, log, partecipazione a equipe)
   - **Dati sanitari dei pazienti** (via sistema referral, cifrati AES-GCM 256-bit)
3. Basi giuridiche:
   - Art. 6.1.a GDPR (consenso) — profilo, marketing
   - Art. 6.1.f GDPR (interesse legittimo) — networking, sicurezza
   - **Art. 9.2.h GDPR** (finalità di cura) — dati sanitari referral
   - Art. 6.1.c GDPR (obbligo legale) — fiscale
4. Conservazione dati:
   - Account attivo: durata utilizzo
   - Post-cancellazione: 10 anni (obblighi fiscali)
   - Dati referral PHI: 30 gg dalla chiusura account o su richiesta
   - Log accessi: 24 mesi
5. Fornitori (sub-responsabili art. 28):
   - Google Firebase / Google Cloud (europe-west1, DPA accettato il 25/04/2026)
   - Resend (email transazionali)
   - Lemon Squeezy (pagamenti futuri, Merchant of Record)
6. Trasferimenti internazionali: nessuno (tutti i dati in UE)
7. Diritti dell'interessato: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione, revoca consenso
8. DPO: admin@tuaequipe.it

**NOTA PER L'AVVOCATO:** Il titolare è indicato come "persona fisica (dati completi su richiesta)". Non è stato ancora specificato il nome completo e il domicilio nella privacy policy pubblica. Verificare se questo è sufficiente o se serve maggiore specificità.

---

### 4.2 Termini e Condizioni di Servizio (in produzione su /termini)

**Struttura attuale:**
1. Oggetto del servizio — connessione professionisti sanitari, equipe, referral clinici cifrati
2. Definizioni — Piattaforma, Utente, equipe, Referral
3. Requisiti di accesso — solo professionisti iscritti ad albi, operatori sanitari autorizzati
4. Obblighi dell'utente — veridicità dati, riservatezza credenziali, rispetto codice deontologico
5. **Sezione 4-bis: Accordo ex Art. 28 GDPR** (trattamento dati sanitari):
   - Ruoli GDPR (professionista = titolare autonomo; tuaequipe.it = responsabile)
   - Obbligo del professionista di acquisire consenso del paziente
   - Principio di minimizzazione
   - Misure di sicurezza (AES-GCM 256-bit, Firebase europe-west1)
   - Sub-responsabili (Google Cloud)
   - Cancellazione entro 30 giorni
   - Assistenza all'interessato
6. Contenuti e responsabilità — divieto di inserire PHI fuori dal sistema referral cifrato
7. Limitazioni di responsabilità
8. Sospensione e risoluzione
9. Modifiche ai Termini (preavviso 30 giorni)
10. Legge applicabile: italiana; Foro competente: Roma

**NOTA PER L'AVVOCATO:** La sezione 4-bis incorpora l'accordo ex art. 28 GDPR direttamente nei T&S, senza un contratto separato. Questo è un approccio legittimo ma verificare se è sufficiente o se serve un DPA formale separato, soprattutto considerando che il titolare è una persona fisica non strutturata.

---

### 4.3 Cookie Policy (in produzione su /cookie)

**Struttura attuale:**
- Cookie tecnici (sempre attivi): autenticazione, sessione, sicurezza CSRF, preferenze UI
- Cookie di prestazioni (con consenso): Google Analytics (se attivato)
- Cookie NON utilizzati: profilazione, marketing, tracciamento comportamentale
- Tabella cookie con nome, scopo, durata
- Gestione: da browser o da impostazioni profilo

**NOTA PER L'AVVOCATO:** Verificare se l'implementazione del banner cookie è conforme alle ultime linee guida del Garante italiano (provvedimento del 10 giugno 2021 e aggiornamenti successivi). Al momento non è chiaro se esiste un banner cookie operativo sulla piattaforma o solo la pagina informativa.

---

### 4.4 DPIA — Valutazione d'Impatto (documento interno, non pubblico)

Redatta il 25/04/2026 (versione 1.0) per il sistema referral clinico.

**Sintesi:**
- Trattamento: referral clinici con PHI dei pazienti
- Base giuridica: art. 9.2.h GDPR + art. 2-sexies D.Lgs. 196/2003
- Rischio residuo complessivo: **BASSO** (grazie alla cifratura client-side)
- Principale misura di mitigazione: AES-GCM 256-bit lato client (tuaequipe.it non vede mai i dati in chiaro)
- Principali scenari di rischio valutati: accesso non autorizzato DB, intercettazione in transito, violazione account professionista, inserimento PHI in campi non cifrati, conservazione oltre il necessario
- Azioni di follow-up: notifica UI dell'obbligo di consenso del paziente, revisione annuale (aprile 2027)

**NOTA PER L'AVVOCATO:** La DPIA è stata redatta internamente. Verificare se è adeguata o se richiede revisione da parte di un esperto esterno prima del lancio con un numero significativo di utenti. Verificare anche se, per il tipo di trattamento effettuato, sia richiesta la consultazione preventiva del Garante ex art. 36 GDPR.

---

### 4.5 Adempimenti completati

| Adempimento | Stato | Data |
|---|---|---|
| DPA con Google Cloud (accettato in Google Cloud Console) | ✅ Completato | 25/04/2026 |
| Privacy Policy con sezione PHI/referral | ✅ Completato | 25/04/2026 |
| Termini di Servizio con clausola art. 28 GDPR | ✅ Completato | 25/04/2026 |
| DPIA (documento interno) | ✅ Completato | 25/04/2026 |
| DPA con Lemon Squeezy | ⏳ Da fare (prima del go-live pagamenti) | — |
| Registro dei trattamenti (art. 30 GDPR) | ⏳ Da fare | — |
| Banner cookie operativo e conforme | ⚠️ Da verificare | — |

---

## PARTE 5 — PAGAMENTI E ABBONAMENTI (non ancora attivi)

### 5.1 Piano abbonamenti previsto
- **Piano Base**: gratuito (attuale per tutti gli utenti)
- **Piano Pro**: €40/mese
- **Piano Best**: €90/mese

### 5.2 Provider scelto: Lemon Squeezy
Lemon Squeezy agisce come **Merchant of Record**: è il venditore legale verso l'utente finale, emette le fatture, gestisce IVA, rimborsi e chargeback. Questo significa che:
- tuaequipe.it **non emette fatture** agli abbonati
- Il titolare **non ha bisogno di P.IVA** per iniziare a incassare abbonamenti tramite LS (riceve compensi come "royalties" da LS)
- Lemon Squeezy gestisce autonomamente gli obblighi fiscali (IVA, OSS UE, ecc.)

### 5.3 Obblighi verso i professionisti abbonati
I Termini di Servizio dovranno essere integrati (prima del lancio degli abbonamenti) con:
- Descrizione dei piani e delle relative funzionalità
- Condizioni di rinnovo automatico mensile
- Politica di rimborso (da allineare con le condizioni Lemon Squeezy)
- Clausola di variazione del prezzo con preavviso di 30 giorni
- Diritto di recesso per consumatori (art. 52 Codice del Consumo, 14 giorni)

**NOTA PER L'AVVOCATO:** I professionisti sanitari potrebbero essere considerati "consumatori" ai sensi del Codice del Consumo se usano la piattaforma per scopi non strettamente professionali, oppure "professionisti" se usano la piattaforma nell'esercizio della loro attività. La distinzione è rilevante per il diritto di recesso. Qual è il corretto inquadramento nel nostro caso?

---

## PARTE 6 — LA POSIZIONE DEL TITOLARE COME PERSONA FISICA

### 6.1 Stato attuale
- Il servizio è operato da **Jacopo Schenetti**, persona fisica residente in Italia
- **Nessuna partita IVA** aperta
- **Nessuna società costituita**
- Il servizio è in fase early-stage, con un numero limitato di utenti

### 6.2 Implicazioni legali note (da verificare con l'avvocato)

**GDPR:**
- Il titolare del trattamento è una persona fisica: questo è legittimo. La Privacy Policy lo indica ma non specifica nome e domicilio completi (per scelta cautelativa). Verificare se il GDPR richiede l'indicazione completa o se "persona fisica, dati su richiesta" è sufficiente.
- Il DPO indicato è la stessa persona del titolare (admin@tuaequipe.it). Questo non è corretto secondo il GDPR (il DPO deve essere indipendente). Da valutare se nominare un DPO esterno o se, alla dimensione attuale, sia obbligatorio.

**Reddito e fiscalità:**
- Gli abbonamenti non sono ancora attivi, quindi il problema fiscale non è ancora urgente
- Quando gli abbonamenti saranno attivi, Lemon Squeezy pagherà il titolare: questo reddito rientra nel reddito da lavoro autonomo occasionale (fino a ~5.000 €/anno senza obbligo di P.IVA) o diversamente. Da verificare con un commercialista.

**Responsabilità contrattuale:**
- I T&S e la Privacy Policy sono firmati/accettati in nome di "tuaequipe.it", non in nome di "Jacopo Schenetti". Verificare se questo crea problemi di identificazione del soggetto obbligato in caso di controversia.

**Trattamento dati sanitari da persona fisica:**
- Il fatto che il responsabile del trattamento ex art. 28 GDPR sia una persona fisica (e non una società) non è vietato, ma è inusuale. Verificare se ci sono implicazioni pratiche (es. responsabilità patrimoniale personale in caso di data breach).

---

## PARTE 7 — DOMANDE SPECIFICHE PER L'AVVOCATO

1. **Privacy Policy — identificazione del titolare**: È sufficiente indicare "persona fisica, dati su richiesta" o devo mettere nome e domicilio completi nella privacy policy pubblica?

2. **DPO**: Sono obbligato a nominare un DPO esterno? La piattaforma tratta dati sanitari su larga scala (art. 37.1.c GDPR obbliga la nomina del DPO per chi tratta dati sanitari su larga scala). Alla dimensione attuale (pochi utenti) siamo "larga scala"?

3. **Accordo art. 28 GDPR nei T&S**: La clausola 4-bis che ho inserito nei T&S è sufficiente come accordo formale con i professionisti, oppure serve un DPA separato firmato?

4. **Consenso del paziente**: Nel sistema referral, mi baso sul fatto che il professionista abbia già il consenso del paziente. Questo è sufficiente per me come responsabile del trattamento, o devo prevedere ulteriori meccanismi?

5. **Lemon Squeezy e diritto di recesso**: I professionisti che si abbonano a tuaequipe.it sono "consumatori" o "professionisti" ai sensi del Codice del Consumo? Questo cambia gli obblighi sul diritto di recesso?

6. **Responsabilità patrimoniale personale**: Operare come persona fisica in un servizio che tratta dati sanitari espone il mio patrimonio personale in modo significativamente diverso rispetto a operare tramite una società? Ha senso costituire una SRL prima del lancio degli abbonamenti?

7. **DPIA**: La DPIA che ho redatto internamente è formalmente adeguata? Richiede la consultazione preventiva del Garante (art. 36 GDPR)?

8. **Banner cookie**: Ci sono requisiti specifici del Garante italiano che devo rispettare nel banner cookie che non siano già coperti dalla Cookie Policy?

9. **Fatturazione professionisti → loro pazienti**: La piattaforma include un modulo per la generazione di fatture dei professionisti verso i loro pazienti. Questo mi comporta obblighi particolari (es. trattamento dati fiscali dei pazienti)?

10. **Quando è il momento giusto per strutturarmi?** Con P.IVA, con SRL, o rimango persona fisica? Quali sono i trigger (volume utenti, fatturato, tipo di trattamento dati) che rendono urgente la strutturazione?

11. **Sistema prenotazioni — dati sanitari?** Il dato "appuntamento prenotato con uno psicologo in data X" è un dato sanitario ai sensi dell'art. 9 GDPR? Se sì, quale base giuridica è corretta per raccoglierlo tramite il form di prenotazione?

12. **Privacy Policy separata per i pazienti**: Devo avere una informativa privacy distinta rivolta ai pazienti (che si registrano e prenotano appuntamenti) rispetto a quella per i professionisti?

13. **Consenso esplicito nel form di prenotazione senza account**: Quando un paziente prenota senza registrarsi (solo con email), non c'è alcun consenso formale raccolto. Cosa devo aggiungere al form di prenotazione per essere a norma?

14. **tuaequipe.it come titolare o responsabile nel sistema prenotazioni?**: Nel sistema referral sono responsabile del trattamento (il professionista è il titolare). Nel sistema prenotazioni, che raccoglie direttamente i dati del paziente, sono io il titolare? Cambia qualcosa?

15. **DPIA aggiornata**: Con l'introduzione del sistema prenotazioni con account pazienti, la DPIA attuale (focalizzata solo sul sistema referral) è ancora sufficiente o va estesa?

---

## ALLEGATI DISPONIBILI SU RICHIESTA

- [ ] Testo completo Privacy Policy (HTML/testo)
- [ ] Testo completo Termini e Condizioni di Servizio (HTML/testo)
- [ ] Testo completo Cookie Policy (HTML/testo)
- [ ] Documento DPIA v1.0 (25/04/2026)
- [ ] Screenshot Google Cloud DPA accettato (25/04/2026)
- [ ] Firestore Security Rules (regole di accesso al database)
- [ ] Codice della funzione di cifratura PHI (encryption.ts)
- [ ] Screenshot della piattaforma (flusso registrazione, referral, team)

---

*Documento preparato da Jacopo Schenetti — 25 aprile 2026*  
*Contatto: legal@tuaequipe.it*
