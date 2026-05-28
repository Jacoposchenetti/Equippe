/**
 * tuaequipe.it — Questionari di validazione assunzioni
 *
 * ISTRUZIONI:
 * 1. Vai su https://script.google.com → "Nuovo progetto"
 * 2. Incolla tutto questo file, sostituendo il codice esistente
 * 3. IMPORTANTE: imposta CF_SECRET qui sotto con lo stesso valore di PROMO_SECRET in functions/.env
 * 4. In alto: Esegui → "main"
 * 5. Al primo avvio ti chiederà i permessi → clicca "Autorizza" (servono: Form + UrlFetch + ScriptTriggers)
 * 6. Dopo l'esecuzione: Visualizza → Log → trovi i link ai 2 form
 *
 * I form vengono creati nel tuo Google Drive.
 * ATTENZIONE: ogni esecuzione di main() crea NUOVI form E nuovi trigger.
 * Se esegui più volte, usa cleanupTriggers() per rimuovere quelli duplicati.
 */

// =============================================================================
// CONFIGURAZIONE — modifica questi valori prima di eseguire
// =============================================================================

/** Codice promozionale inviato dopo la compilazione del form */
var PROMO_CODE = "SURVEY2026";

/**
 * URL della Cloud Function che invia l'email con il codice.
 * Già configurata su Firebase per tuaequipe.it.
 */
var CF_URL = "https://europe-west1-equippe-271f5.cloudfunctions.net/sendPromoCodeEmail";

/**
 * Secret di autenticazione — DEVE corrispondere a PROMO_SECRET in functions/.env
 * Sostituisci questo placeholder con il valore reale prima di eseguire.
 */
var CF_SECRET = "6j8ifEY9e1rbX7t5GMRqvWkJ2OlgB4Ip";

function main() {
  var urlProf = crea_form_professionisti();
  var urlPaz  = crea_form_pazienti();

  Logger.log("=================================================");
  Logger.log("FORM CREATI CON SUCCESSO");
  Logger.log("=================================================");
  Logger.log("Questionario Professionisti: " + urlProf);
  Logger.log("Questionario Pazienti:       " + urlPaz);
  Logger.log("=================================================");
}

// =============================================================================
// QUESTIONARIO PROFESSIONISTI
// Testa Assunzione 1 (referral difficili) + Assunzione 2 (network → pazienti)
// =============================================================================

function crea_form_professionisti() {
  var form = FormApp.create("Ricerca sul coordinamento tra professionisti sanitari");

  form.setDescription(
    "Stiamo svolgendo una ricerca sul coordinamento tra professionisti sanitari in Italia. " +
    "Il questionario richiede circa 8–10 minuti. Le risposte sono completamente anonime."
  );
  form.setCollectEmail(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    "Grazie per aver risposto! Il tuo contributo è prezioso per la nostra ricerca.\n\n" +
    "Il tuo codice promozionale è:\n\n" +
    PROMO_CODE + "\n\n" +
    "Usalo quando ti iscrivi su tuaequipe.it — riceverai anche una conferma via email."
  );

  // ── SEZIONE 1: PROFILO ──────────────────────────────────────────────────────
  form.addSectionHeaderItem()
    .setTitle("Profilo professionale")
    .setHelpText("Alcune domande per contestualizzare le tue risposte.");

  // EMAIL — obbligatoria, serve per inviare il codice promozionale
  var emailValidation = FormApp.createTextValidation().requireTextIsEmail().build();
  form.addTextItem()
    .setTitle("La tua email")
    .setHelpText("Ti invieremo il codice promozionale " + PROMO_CODE + " a questo indirizzo.")
    .setRequired(true)
    .setValidation(emailValidation);

  form.addListItem()
    .setTitle("Qual è la tua professione?")
    .setRequired(true)
    .setChoiceValues([
      "Psicologo / Psicoterapeuta",
      "Psichiatra",
      "Medico di base (MMG)",
      "Fisioterapista",
      "Osteopata",
      "Nutrizionista / Dietista",
      "Dietologo",
      "Logopedista",
      "Neurologo",
      "Ginecologo",
      "Andrologo / Sessuologo",
      "Assistente Sociale",
      "Educatore Professionale",
      "Terapista Occupazionale",
      "Infermiere",
      "Altro"
    ]);

  form.addMultipleChoiceItem()
    .setTitle("Anni di esperienza professionale")
    .setRequired(true)
    .setChoiceValues([
      "Meno di 2 anni",
      "2–5 anni",
      "5–10 anni",
      "10–20 anni",
      "Più di 20 anni"
    ]);

  form.addMultipleChoiceItem()
    .setTitle("Modalità di esercizio principale")
    .setRequired(true)
    .setChoiceValues([
      "Libero professionista privato",
      "Convenzionato SSN",
      "Dipendente pubblico o privato",
      "Misto (libero professionista + dipendente)"
    ]);

  form.addListItem()
    .setTitle("In quale regione lavori principalmente?")
    .setRequired(true)
    .setChoiceValues([
      "Valle d'Aosta", "Piemonte", "Liguria", "Lombardia",
      "Trentino-Alto Adige", "Veneto", "Friuli-Venezia Giulia",
      "Emilia-Romagna", "Toscana", "Umbria", "Marche", "Lazio",
      "Abruzzo", "Molise", "Campania", "Puglia",
      "Basilicata", "Calabria", "Sicilia", "Sardegna"
    ]);

  // ── SEZIONE 2: REFERRAL (Assunzione 1) ──────────────────────────────────────
  var pb2 = form.addPageBreakItem()
    .setTitle("Invio ai colleghi");

  // D1 — frequenza referral
  form.addScaleItem()
    .setTitle("Negli ultimi 3 mesi, quante volte hai consigliato a un paziente di rivolgersi a un altro specialista?")
    .setLabels("Mai (0 volte)", "Più di 20 volte")
    .setBounds(1, 7)
    .setRequired(true);

  // D2 — domanda aperta (Mom Test core)
  form.addParagraphTextItem()
    .setTitle("Raccontaci come fai di solito quando un paziente ha bisogno di uno specialista diverso da te.")
    .setHelpText("Es: come trovi il collega? Come comunichi il passaggio al paziente? Anche 2–3 righe vanno benissimo.")
    .setRequired(false);

  // D3 — facilità di trovare il collega giusto
  form.addScaleItem()
    .setTitle("In generale, quanto è facile trovare il professionista giusto a cui inviare un paziente?")
    .setLabels("Molto difficile", "Molto facile")
    .setBounds(1, 7)
    .setRequired(true);

  // D4 — ostacoli (checkbox)
  form.addCheckboxItem()
    .setTitle("Cosa rende difficile consigliare lo specialista giusto? (Seleziona tutto ciò che si applica)")
    .setChoiceValues([
      "Non conosco abbastanza colleghi fuori dalla mia specializzazione",
      "Non so quali colleghi abbiano disponibilità o accettino nuovi pazienti",
      "Non conosco le competenze specifiche dei colleghi",
      "Non ho modo di verificare la qualità del lavoro del collega",
      "Non è difficile: ho già una rete consolidata",
      "Altro"
    ])
    .setRequired(false);

  // D5 — come hai conosciuto i colleghi (checkbox)
  form.addCheckboxItem()
    .setTitle("Come hai conosciuto gli specialisti che consigli ai tuoi pazienti? (Seleziona tutto ciò che si applica)")
    .setChoiceValues([
      "Durante la formazione (università, master, corsi ECM)",
      "Stesso studio o poliambulatorio",
      "Convegni ed eventi professionali",
      "Colleghi che mi hanno contattato direttamente",
      "Pazienti che li hanno raccomandati",
      "Altro"
    ])
    .setRequired(true);

  // D6 — condizionale (choices impostate DOPO, quando le page break esistono)
  var d6 = form.addMultipleChoiceItem()
    .setTitle("Ti è mai capitato di non fare un invio a un collega perché non sapevi a chi mandare il paziente?")
    .setRequired(true);

  // ── SEZIONE 2b: APPROFONDIMENTO D6 (condizionale: Sì / A volte) ─────────────
  var pb2b = form.addPageBreakItem()
    .setTitle("Approfondimento: mancato invio");

  form.addParagraphTextItem()
    .setTitle("Puoi raccontarci brevemente di una situazione in cui non hai fatto l'invio perché non sapevi a chi mandare il paziente?")
    .setHelpText("Cosa è successo al paziente? Come hai risolto? Anche poche righe vanno benissimo.")
    .setRequired(false);

  // ── SEZIONE 3: PROVENIENZA PAZIENTI (Assunzione 2) ───────────────────────────
  var pb3 = form.addPageBreakItem()
    .setTitle("Da dove arrivano i tuoi nuovi pazienti");

  // D7 — griglia fonti × frequenza
  form.addGridItem()
    .setTitle("Da dove arrivano principalmente i tuoi nuovi pazienti? Indica la frequenza per ciascuna fonte.")
    .setHelpText("1 = Mai  |  7 = Sempre / Quasi sempre")
    .setRows([
      "Invio da colleghi specialisti",
      "Invio dal medico di base",
      "Passaparola di ex pazienti",
      "Recensioni online (Google, Doctolib, ecc.)",
      "Piattaforme di prenotazione (MioDottore, ecc.)",
      "Social media personali",
      "Sito web personale"
    ])
    .setColumns(["1", "2", "3", "4", "5", "6", "7"])
    .setRequired(true);

  // D8 — impatto del network
  form.addScaleItem()
    .setTitle("Pensi che conoscere più colleghi di fiducia influenzerebbe il numero di pazienti che ricevi?")
    .setLabels("Per niente", "Moltissimo")
    .setBounds(1, 7)
    .setRequired(true);

  // ── SEZIONE 4: CHIUSURA ───────────────────────────────────────────────────────
  var pb4 = form.addPageBreakItem()
    .setTitle("Quasi finito!");

  form.addMultipleChoiceItem()
    .setTitle("Saresti disponibile a una breve call (15 min) per approfondire le tue risposte?")
    .setRequired(true)
    .setChoiceValues([
      "Sì, con piacere",
      "Forse, dipende dai tempi",
      "No, preferisco rimanere anonimo"
    ]);

  // ── IMPOSTA LOGICA CONDIZIONALE D6 ──────────────────────────────────────────
  // Ora pb2b e pb3 esistono → posso usarli come destinazione
  d6.setChoices([
    d6.createChoice("Sì, mi è capitato",                pb2b),
    d6.createChoice("A volte",                           pb2b),
    d6.createChoice("No, ho sempre saputo dove inviare", pb3)
  ]);
  // pb2b (Sezione 2b) finisce con CONTINUE → va automaticamente a pb3 (sezione successiva) ✓

  // ── SETUP TRIGGER ONFORMSUBMIT ────────────────────────────────────────────
  ScriptApp.newTrigger('onSubmit_professionisti')
    .forForm(form)
    .onFormSubmit()
    .create();
  Logger.log("Trigger onFormSubmit registrato per form professionisti");

  Logger.log("Form professionisti creato: " + form.getPublishedUrl());
  return form.getPublishedUrl();
}

// =============================================================================
// QUESTIONARIO PAZIENTI
// Testa Assunzione 3 (preferenza équipe) + Assunzione 4 (scelta per passaparola)
// =============================================================================

function crea_form_pazienti() {
  var form = FormApp.create("Ricerca sulla scelta degli specialisti sanitari");

  form.setDescription(
    "Stiamo svolgendo una ricerca su come le persone scelgono i propri specialisti sanitari in Italia. " +
    "Il questionario richiede circa 6–8 minuti. Le risposte sono completamente anonime."
  );
  form.setCollectEmail(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    "Grazie per aver partecipato! Il tuo contributo è davvero prezioso.\n\n" +
    "Il tuo codice promozionale è:\n\n" +
    PROMO_CODE + "\n\n" +
    "Usalo quando ti iscrivi su tuaequipe.it — riceverai anche una conferma via email."
  );

  // ── SEZIONE 1: PROFILO ──────────────────────────────────────────────────────
  form.addSectionHeaderItem()
    .setTitle("Profilo")
    .setHelpText("Alcune domande per contestualizzare le tue risposte.");

  // EMAIL — obbligatoria, serve per inviare il codice promozionale
  var emailValidation2 = FormApp.createTextValidation().requireTextIsEmail().build();
  form.addTextItem()
    .setTitle("La tua email")
    .setHelpText("Ti invieremo il codice promozionale " + PROMO_CODE + " a questo indirizzo.")
    .setRequired(true)
    .setValidation(emailValidation2);

  form.addMultipleChoiceItem()
    .setTitle("Qual è la tua fascia d'età?")
    .setRequired(true)
    .setChoiceValues([
      "18–24 anni",
      "25–34 anni",
      "35–44 anni",
      "45–54 anni",
      "55–64 anni",
      "65 anni o più"
    ]);

  form.addMultipleChoiceItem()
    .setTitle("Quante volte hai visitato uno specialista (non il medico di base) nell'ultimo anno?")
    .setRequired(true)
    .setChoiceValues([
      "0 volte",
      "1–2 volte",
      "3–5 volte",
      "Più di 5 volte"
    ]);

  form.addListItem()
    .setTitle("In quale regione vivi?")
    .setRequired(true)
    .setChoiceValues([
      "Valle d'Aosta", "Piemonte", "Liguria", "Lombardia",
      "Trentino-Alto Adige", "Veneto", "Friuli-Venezia Giulia",
      "Emilia-Romagna", "Toscana", "Umbria", "Marche", "Lazio",
      "Abruzzo", "Molise", "Campania", "Puglia",
      "Basilicata", "Calabria", "Sicilia", "Sardegna"
    ]);

  // ── SEZIONE 2: COME SCEGLI (Assunzione 4) ───────────────────────────────────
  var pb2p = form.addPageBreakItem()
    .setTitle("Come scegli uno specialista");

  // D1 — ultimo specialista (comportamentale, passato)
  form.addMultipleChoiceItem()
    .setTitle("Pensa all'ultimo specialista che hai contattato per una visita: come lo hai trovato?")
    .setRequired(true)
    .setChoiceValues([
      "Me lo ha consigliato un medico o specialista che già seguivo",
      "Me lo ha consigliato un amico o un familiare",
      "L'ho cercato su Google",
      "L'ho trovato su una piattaforma di prenotazione (Doctolib, MioDottore, ecc.)",
      "L'ho scelto tramite la mia assicurazione o mutua",
      "L'ho trovato tramite AI (ChatGPT, ecc.)",
      "Altro"
    ]);

  // D2 — griglia peso delle fonti
  form.addGridItem()
    .setTitle("Quanto peso dai alle diverse fonti quando scegli uno specialista?")
    .setHelpText("1 = Per niente  |  7 = Moltissimo")
    .setRows([
      "Consiglio di un medico o specialista che già seguo",
      "Consiglio di amici e parenti",
      "Recensioni online",
      "Distanza da casa",
      "Disponibilità rapida dell'appuntamento",
      "Prezzo della visita"
    ])
    .setColumns(["1", "2", "3", "4", "5", "6", "7"])
    .setRequired(true);

  // D3 — condizionale (choices impostate dopo)
  var d3p = form.addMultipleChoiceItem()
    .setTitle("Hai mai visitato uno specialista su consiglio di un altro professionista sanitario che ti seguiva già?")
    .setRequired(true);

  // ── SEZIONE 2b: D3 APPROFONDIMENTO (condizionale: Sì) ───────────────────────
  var pb2bp = form.addPageBreakItem()
    .setTitle("Approfondimento");

  form.addScaleItem()
    .setTitle("Quando uno specialista ti viene consigliato da un altro professionista sanitario che ti segue, hai più fiducia iniziale in lui rispetto a uno scelto da solo?")
    .setLabels("No, nessuna differenza", "Sì, molta più fiducia")
    .setBounds(1, 7)
    .setRequired(true);

  // ── SEZIONE 3: COORDINAMENTO TRA SPECIALISTI (Assunzione 3) ─────────────────
  var pb3p = form.addPageBreakItem()
    .setTitle("I tuoi specialisti comunicano tra loro?");

  // D4 — condizionale (choices impostate dopo)
  var d4p = form.addMultipleChoiceItem()
    .setTitle("Ti è mai capitato di avere più specialisti che seguivano contemporaneamente lo stesso problema di salute?")
    .setRequired(true);

  // ── SEZIONE 3b: D4 APPROFONDIMENTO (condizionale: Sì) ───────────────────────
  var pb3bp = form.addPageBreakItem()
    .setTitle("Coordinamento tra i tuoi specialisti");

  form.addMultipleChoiceItem()
    .setTitle("Come comunicavano tra loro questi specialisti?")
    .setRequired(true)
    .setChoiceValues([
      "Non si conoscevano e non comunicavano",
      "Comunicavano tramite me (io riferivo le informazioni da uno all'altro)",
      "Si scambiavano referti o lettere cliniche",
      "Si parlavano direttamente (telefono, email)",
      "Facevano consulenze o visite congiunte",
      "Altro"
    ]);

  // ── SEZIONE 3c: IMPORTANZA COORDINAMENTO + D6 ───────────────────────────────
  var pb3cp = form.addPageBreakItem()
    .setTitle("Il coordinamento tra i tuoi specialisti");

  // D5 — importanza coordinamento
  form.addScaleItem()
    .setTitle("Quanto è importante per te che i professionisti sanitari che ti seguono si coordinino tra loro?")
    .setLabels("Per niente importante", "Fondamentale")
    .setBounds(1, 7)
    .setRequired(true);

  // D6 — condizionale (choices impostate dopo)
  var d6p = form.addMultipleChoiceItem()
    .setTitle("Ti è mai capitato di ricevere consigli contraddittori da diversi specialisti?")
    .setRequired(true);

  // ── SEZIONE 3d: D6 APPROFONDIMENTO (condizionale: Sì) ───────────────────────
  var pb3dp = form.addPageBreakItem()
    .setTitle("Consigli contraddittori");

  form.addParagraphTextItem()
    .setTitle("Puoi raccontarci brevemente come hai gestito la situazione?")
    .setHelpText("Anche 2–3 righe vanno benissimo.")
    .setRequired(false);

  // ── SEZIONE 4: CHIUSURA ───────────────────────────────────────────────────────
  var pb4p = form.addPageBreakItem()
    .setTitle("Ultima domanda");

  // D7 — preferenza équipe (leggermente ipotetico ma giustificato dal contesto comportamentale)
  form.addScaleItem()
    .setTitle("A parità di qualità e prezzo, saresti più propenso a scegliere uno specialista che collabora attivamente con gli altri professionisti che ti seguono?")
    .setLabels("Per niente", "Certamente sì")
    .setBounds(1, 7)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Saresti disponibile a una breve call (10 min) per approfondire le tue risposte?")
    .setRequired(true)
    .setChoiceValues([
      "Sì, con piacere",
      "Forse, dipende dai tempi",
      "No, preferisco rimanere anonimo"
    ]);

  // ── IMPOSTA LOGICA CONDIZIONALE ──────────────────────────────────────────────
  // Ora tutte le page break esistono → posso impostare le choices condizionali

  // D3: Sì → pb2bp (approfondimento fiducia); No → salta a pb3p (équipe)
  d3p.setChoices([
    d3p.createChoice("Sì", pb2bp),
    d3p.createChoice("No", pb3p)
  ]);
  // pb2bp finisce con CONTINUE → va automaticamente a pb3p ✓

  // D4: Sì → pb3bp (come comunicavano); No → salta a pb3cp (importanza coordinamento)
  d4p.setChoices([
    d4p.createChoice("Sì", pb3bp),
    d4p.createChoice("No", pb3cp)
  ]);
  // pb3bp finisce con CONTINUE → va automaticamente a pb3cp ✓

  // D6: Sì → pb3dp (come gestito); No → salta a pb4p (ultima domanda)
  d6p.setChoices([
    d6p.createChoice("Sì", pb3dp),
    d6p.createChoice("No", pb4p)
  ]);
  // pb3dp finisce con CONTINUE → va automaticamente a pb4p ✓

  // ── SETUP TRIGGER ONFORMSUBMIT ────────────────────────────────────────────
  ScriptApp.newTrigger('onSubmit_pazienti')
    .forForm(form)
    .onFormSubmit()
    .create();
  Logger.log("Trigger onFormSubmit registrato per form pazienti");

  Logger.log("Form pazienti creato: " + form.getPublishedUrl());
  return form.getPublishedUrl();
}

// =============================================================================
// HANDLER TRIGGER — eseguiti automaticamente a ogni nuova risposta
// =============================================================================

function onSubmit_professionisti(e) {
  var items = e.response.getItemResponses();
  var email = '';
  for (var i = 0; i < items.length; i++) {
    if (items[i].getItem().getTitle() === 'La tua email') {
      email = items[i].getResponse();
      break;
    }
  }
  if (email) {
    inviaPromoCode(email);
  } else {
    Logger.log('onSubmit_professionisti: nessuna email trovata nella risposta');
  }
}

function onSubmit_pazienti(e) {
  var items = e.response.getItemResponses();
  var email = '';
  for (var i = 0; i < items.length; i++) {
    if (items[i].getItem().getTitle() === 'La tua email') {
      email = items[i].getResponse();
      break;
    }
  }
  if (email) {
    inviaPromoCode(email);
  } else {
    Logger.log('onSubmit_pazienti: nessuna email trovata nella risposta');
  }
}

/**
 * Chiama la Cloud Function sendPromoCodeEmail via Resend.
 * Richiede CF_URL e CF_SECRET configurati in cima al file.
 */
function inviaPromoCode(email) {
  try {
    var payload = JSON.stringify({ email: email });
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-internal-secret': CF_SECRET },
      payload: payload,
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(CF_URL, options);
    Logger.log('sendPromoCodeEmail → ' + response.getResponseCode() + ' ' + response.getContentText());
  } catch (err) {
    Logger.log('Errore invio promo code a ' + email + ': ' + err.message);
  }
}

/**
 * Utility: rimuove TUTTI i trigger installati in questo script.
 * Utile se hai eseguito main() più volte e vuoi ripartire da zero.
 * Esegui questa funzione manualmente da: Esegui → cleanupTriggers
 */
function cleanupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log('Rimossi ' + triggers.length + ' trigger.');
}
