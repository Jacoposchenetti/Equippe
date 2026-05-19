# Sistema di Abbonamenti — Stato e Roadmap

## Cosa è già stato implementato

### Modello dati (Firestore)
- Aggiunto tipo `SubscriptionPlan = 'base' | 'pro' | 'best'` in `src/types/equippe.ts`
- Aggiunto campo opzionale `plan?: SubscriptionPlan` e `planUpdatedAt?: Timestamp` al documento `users/{uid}`
- Default lazy a `'base'` per tutti gli utenti esistenti — zero migrazione necessaria

### AuthContext
- `currentPlan: SubscriptionPlan` esposto nel context globale
- Disponibile ovunque nell'app via `const { currentPlan } = useAuth()`

### UI — Pagina Abbonamento (`/abbonamento`)
- Accessibile dal dropdown avatar (desktop + mobile) nella topbar
- 3 card con prezzi e feature:
  - **Base** — gratuito, attivo, badge "Piano attuale"
  - **Pro** — €40/mese, badge "Prossimamente", non selezionabile
  - **Best** — €90/mese, badge "Prossimamente", non selezionabile
- TypeScript compila senza errori

---

## Cosa manca per renderli operativi

### 1. Integrazione pagamento (Lemon Squeezy — Merchant of Record)
- [ ] Creare account Lemon Squeezy e completare la verifica identità
- [ ] Creare i prodotti/abbonamenti ricorrenti:
  - Piano Pro: €40/mese
  - Piano Best: €90/mese
- [ ] Configurare webhook Lemon Squeezy → Firebase Cloud Function:
  - Creare `functions/src/lemonsqueezy.ts` con endpoint HTTP per ricevere eventi
  - Evento `subscription_created` / `subscription_updated` → aggiornare `users/{uid}.plan` su Firestore
  - Evento `subscription_cancelled` / `subscription_expired` → downgrade a `'base'`
- [ ] Aggiungere `lsCustomerId?: string` e `lsSubscriptionId?: string` al tipo `User`
- [ ] Configurare variabile d'ambiente:
  ```
  firebase functions:config:set lemonsqueezy.webhook_secret="..."
  ```
- [ ] In `AbbonamentoPage.tsx`: sostituire i bottoni "Prossimamente" con link al checkout Lemon Squeezy

### 2. Portal clienti (gestione rinnovo/cancellazione)
- [ ] Usare il Customer Portal di Lemon Squeezy (built-in, nessuna configurazione extra)
- [ ] In `AbbonamentoPage.tsx`: pulsante "Gestisci abbonamento" che rimanda al portal Lemon Squeezy per gli utenti Pro/Best

### 3. Feature gating
- Decidere quando bloccare quali funzionalità in base al piano
- Primo caso d'uso già definito: visibilità in `/trova` → solo piano Pro/Best
  - In `AvailabilityPage.tsx`: mostrare il toggle `isPublic` solo se `currentPlan !== 'base'` (o mostrarlo ma con una modale che invita a fare upgrade)
  - In `TrovaPage.tsx`: il filtro `isPublic === true` già funziona, basta che solo Pro/Best possano impostarlo a `true`
- Creare hook `usePlanFeatures()` o usare direttamente `currentPlan` nei componenti interessati

### 4. Email transazionali legate al piano
- Email di benvenuto al piano Pro/Best (con link al portal)
- Email di avviso scadenza / pagamento fallito
- Email di downgrade al piano Base
- Implementare in `functions/src/index.ts` triggerando sulle modifiche a `users/{uid}.plan`

### 5. Admin panel
- Vista in `AdminVerificationsPage` o pagina dedicata per vedere piano di ogni utente
- Possibilità di sovrascrivere manualmente il piano (es. account di test, omaggi)

---

## Adempimenti legali e documentazione

### Contratti e termini
- [x] **Termini di Servizio aggiornati** — sezione 4-bis con accordo art. 28 GDPR (referral/PHI)
- [x] **Privacy Policy aggiornata** — sezione fornitori include Lemon Squeezy come Merchant of Record
- [ ] **Aggiungere ai Termini di Servizio** la sezione abbonamenti:
  - Descrizione dei piani a pagamento e dei loro limiti
  - Condizioni di rinnovo automatico mensile (gestito da Lemon Squeezy)
  - Politica di rimborso (da allineare con le condizioni Lemon Squeezy)
  - Clausola di variazione del prezzo con preavviso di 30 giorni
  - Diritto di recesso per consumatori (art. 52 Codice del Consumo, 14 giorni)

### Fatturazione e fisco
- [x] **Fatturazione verso utenti**: gestita interamente da Lemon Squeezy (Merchant of Record) — nessun obbligo diretto di P.IVA o SDI per incassare abbonamenti finché si opera come privato
- [ ] **Aprire P.IVA** quando si supera la soglia di reddito da lavoro occasionale (5.000 €/anno) o si vuole strutturare come società
- [ ] **Dichiarazione OSS / IVA**: gestita automaticamente da Lemon Squeezy per tutti i paesi UE
- [ ] **Ritenuta d'acconto**: verificare con commercialista in fase di apertura P.IVA

### GDPR / privacy
- [x] **DPA con Google Cloud** — accettato il 25/04/2026 (Google Cloud Console > Privacy e sicurezza)
- [x] **Privacy Policy aggiornata** — sezione PHI/referral, Lemon Squeezy come fornitore
- [x] **Termini di Servizio aggiornati** — clausola art. 28 GDPR per sistema referral
- [x] **DPIA redatta** — documento `DPIA.md` (v1.0, 25/04/2026)
- [ ] **DPA con Lemon Squeezy**: disponibile nelle impostazioni account LS — da accettare prima del go-live pagamenti
- [ ] **Registro dei trattamenti (art. 30 GDPR)**: aggiungere il trattamento "gestione abbonamenti" con Lemon Squeezy come sub-processor
- [ ] **DPIA revisione annuale**: aprile 2027

### Altro
- [ ] **Cookie**: il checkout Lemon Squeezy è hosted su dominio LS — nessun cookie aggiuntivo su Equippe
- [ ] **Accessibilità**: i piani devono essere comunicati in modo chiaro prima dell'acquisto (direttiva Omnibus 2022)
- [ ] **Gestione upgrade/downgrade**: definire la politica di pro-rata nei Termini (Lemon Squeezy la gestisce automaticamente)

---

## Setup Lemon Squeezy — step-by-step

1. **Crea lo store**: scegli slug (es: `tuaequipe`) → negozio su `https://tuaequipe.lemonsqueezy.com`
2. **Completa la verifica**: dati reali, sito web (anche con waiting list, purché descrittivo)
3. **Collega il dominio** *(opzionale)*: Settings > Domains → es. `shop.tuaequipe.it`
4. **Crea i prodotti/abbonamenti**: uno per Piano Pro (€40/mese) e uno per Piano Best (€90/mese), tipo "Subscription"
5. **Personalizza checkout e email**: logo, colori, testi
6. **Configura pagamenti**: inserisci IBAN per ricevere i bonifici
7. **Testa il checkout**: prodotto di test, prova acquisto completo
8. **Configura webhook**: Settings > Webhooks → URL della tua Cloud Function, eventi `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`
9. **Accetta DPA Lemon Squeezy**: Settings > Privacy — da fare prima del go-live

### Quando passare a P.IVA / struttura societaria
- Quando si supera la soglia reddito da lavoro occasionale (~5.000 €/anno)
- Quando si vuole pieno controllo su fatturazione, branding, flussi avanzati

---

## Ordine consigliato di esecuzione

1. **Fase 1 — Legale** *(fatto 25/04/2026)*: Privacy Policy, T&S art. 28, DPA Google, DPIA
2. **Fase 2 — Lemon Squeezy** (~2 giorni): setup store, prodotti, webhook, Cloud Function
3. **Fase 3 — UI** (~1 giorno): aggiornare `AbbonamentoPage` con link checkout LS + pulsante gestisci abbonamento
4. **Fase 4 — Feature gating** (~2 giorni): bloccare toggle `isPublic` per piano Base, modale upgrade
5. **Fase 5 — Email** (~1 giorno): email transazionali legate a cambio piano

---

*Documento generato il 24 aprile 2026 — aggiornare a ogni sprint.*
