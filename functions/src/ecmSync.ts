/**
 * ecmSync.ts — Sincronizzazione periodica degli eventi ECM da AGENAS.
 *
 * Architettura:
 * - scheduledECMSync (cron ogni 15 min): controlla quale professione
 *   ha dati più vecchi e la sincronizza.
 * - Ogni invocazione processa UNA professione (pagina per pagina).
 * - Gli eventi vengono salvati in Firestore "ecmEvents/{eventId}"
 * - Le professioni con sync in corso trovano ripresa automatica.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/** Parsa il valore costo AGENAS (es. "€ 150,00", "Gratuito") in un numero. */
function parseCosto(costo: string): number {
  if (!costo) return 0;
  const lower = costo.toLowerCase().trim();
  if (lower === 'gratuito' || lower === '') return 0;
  const cleaned = costo.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}
import * as cheerio from 'cheerio';

const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';
const SYNC_STALE_MS = 12 * 60 * 60 * 1000; // 12 ore
const MAX_RUN_MS = 450_000; // Stop dopo 450s su 540s di timeout
const PAGE_SIZE = 10; // AGENAS restituisce 10 eventi per pagina
const PAGE_DELAY_MS = 500; // pausa tra pagine per non sovraccaricare AGENAS

/**
 * Mappa professioni AGENAS → solo quelle rilevanti per il sito.
 * Chiave: ID AGENAS, Valore: label AGENAS.
 *
 * Mappatura con professioni del sito:
 *   1  Medico Chirurgo    → Psichiatra, Dietologo, Medico di Base, Medico Specialista, Ginecologo, Andrologo
 *   5  Psicologo          → Psicologo, Psicoterapeuta
 *   6  Biologo            → Nutrizionista
 *  10  Dietista           → Dietista
 *  11  Educatore Prof.    → Educatore Professionale
 *  12  Fisioterapista     → Fisioterapista
 *  14  Infermiere         → Infermiere
 *  16  Logopedista        → Logopedista
 *  29  TNPEE              → Neuropsicomotricista
 *  30  Terapista Occup.   → Terapista Occupazionale
 */
const AGENAS_PROFESSIONS: Record<string, string> = {
  '1': 'Medico Chirurgo',
  '5': 'Psicologo',
  '6': 'Biologo',
  '10': 'Dietista',
  '11': 'Educatore Professionale',
  '12': 'Fisioterapista',
  '14': 'Infermiere',
  '16': 'Logopedista',
  '29': 'Terapista Della Neuro E Psicomotricità Dell\'età Evolutiva',
  '30': 'Terapista Occupazionale',
};

const AGENAS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: AGENAS_URL,
  Origin: 'https://ape.agenas.it',
};

// ---- Types ----

interface SyncedEvent {
  id: string;
  titolo: string;
  provider: string;
  crediti: string;
  creditiNum: number;
  dataInizio: string;
  dataInizioTimestamp: admin.firestore.Timestamp | null;
  dataFine: string;
  dataFineTimestamp: admin.firestore.Timestamp | null;
  tipologia: string;
  costo: string;
  costoNum: number;
  professioneLabel: string;
  lastSynced: admin.firestore.FieldValue;
  // Per poter ritrovare l'evento su AGENAS per detail/PDF
  _syncProfessioneId: string;
  _syncGlobalIndex: number; // indice 0-based nell'intera lista risultati
}

// ---- Helpers ----

type CheerioRoot = ReturnType<typeof cheerio.load>;

function getHiddenFields($: CheerioRoot): Record<string, string> {
  const fields: Record<string, string> = {};
  $('input[type="hidden"]').each((_: number, el: any) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) fields[name] = val;
  });
  return fields;
}

function buildFormData(
  $: CheerioRoot,
  hiddenFields: Record<string, string>
): URLSearchParams {
  const formData = new URLSearchParams();
  for (const [name, val] of Object.entries(hiddenFields)) {
    formData.append(name, val);
  }
  $('input[type="text"]').each((_: number, el: any) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) formData.append(name, val);
  });
  $('select').each((_: number, el: any) => {
    const name = $(el).attr('name');
    const optCount = $(el).find('option').length;
    if (!name || optCount === 0) return;
    const selected = $(el).find('option[selected]').attr('value');
    const firstOpt = $(el).find('option').first().attr('value');
    formData.append(name, selected || firstOpt || '');
  });
  return formData;
}

function parseItalianDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
}

function parseEventsFromPage(
  $: CheerioRoot,
  professioneId: string,
  professioneLabel: string,
  pageStartIndex: number
): SyncedEvent[] {
  const events: SyncedEvent[] = [];

  $('.lista').each((i: number, el: any) => {
    const item = $(el);
    const firstSpan = item.find('[id*="ResultTable"]').first();
    const idMatch = firstSpan.attr('id')?.match(/_(\d+)$/);
    const idx = idMatch ? idMatch[1] : '';
    const span = (suffix: string) =>
      item.find(`[id$="${suffix}_${idx}"]`).text().trim();

    const id = span('lbValoreEvento');
    const titolo = span('lbTitoloEvento');
    const crediti = span('lbValoreCrediti');
    const dataInizio = span('lbVAloreDataInizio');
    const dataFine = span('lbVAloreDataFine');

    if (!titolo || titolo.length < 3) return;

    const dataInizioDate = parseItalianDate(dataInizio);
    const dataFineDate = parseItalianDate(dataFine);

    // Scarta eventi già scaduti (dataFine nel passato)
    if (dataFineDate && dataFineDate < new Date()) return;

    events.push({
      id,
      titolo,
      provider: span('lbNomeProvider'),
      crediti,
      creditiNum: parseFloat(crediti?.replace(',', '.') || '0') || 0,
      dataInizio,
      dataInizioTimestamp: dataInizioDate
        ? admin.firestore.Timestamp.fromDate(dataInizioDate)
        : null,
      dataFine,
      dataFineTimestamp: dataFineDate
        ? admin.firestore.Timestamp.fromDate(dataFineDate)
        : null,
      tipologia: span('lbValoreTipoEvento'),
      costo: span('lbValoreCosto'),
      costoNum: parseCosto(span('lbValoreCosto')),
      professioneLabel: span('lbValoreProfessioni') || professioneLabel,
      lastSynced: admin.firestore.FieldValue.serverTimestamp(),
      _syncProfessioneId: professioneId,
      _syncGlobalIndex: pageStartIndex + i,
    });
  });

  return events;
}

/**
 * Scrive una batch di eventi su Firestore con upsert.
 * Per il campo professioni usiamo arrayUnion, così un evento
 * che appare per più professioni accumula tutte le associazioni.
 */
async function upsertEvents(events: SyncedEvent[]): Promise<void> {
  if (events.length === 0) return;

  // Firestore batch limit is 500 operations
  const chunks: SyncedEvent[][] = [];
  for (let i = 0; i < events.length; i += 250) {
    chunks.push(events.slice(i, i + 250));
  }

  for (const chunk of chunks) {
    const batch = admin.firestore().batch();
    for (const event of chunk) {
      const ref = admin.firestore().collection('ecmEvents').doc(event.id);
      batch.set(
        ref,
        {
          ...event,
          professioniIds: admin.firestore.FieldValue.arrayUnion(
            event._syncProfessioneId
          ),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Session management ----

interface AgenasSession {
  $: ReturnType<typeof cheerio.load>;
  hiddenFields: Record<string, string>;
  cookies: string;
}

async function startSession(): Promise<AgenasSession> {
  const resp = await fetch(AGENAS_URL, {
    headers: {
      'User-Agent': AGENAS_HEADERS['User-Agent'],
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'it-IT,it;q=0.9',
    },
  });
  if (!resp.ok) throw new Error(`AGENAS GET fallita: ${resp.status}`);
  const cookies = (resp.headers.getSetCookie?.() || [])
    .map((c: string) => c.split(';')[0])
    .join('; ');
  const html = await resp.text();
  const $ = cheerio.load(html);
  return { $, hiddenFields: getHiddenFields($), cookies };
}

async function searchProfession(
  session: AgenasSession,
  professioneId: string
): Promise<AgenasSession> {
  const formData = buildFormData(session.$, session.hiddenFields);
  formData.set('ctl00$cphMain$Eventi1$ddlProfessione', professioneId);
  formData.set('__EVENTTARGET', '');
  formData.set('__EVENTARGUMENT', '');
  formData.append('ctl00$cphMain$Eventi1$btnCerca', 'Cerca');

  const headers = { ...AGENAS_HEADERS };
  if (session.cookies) headers['Cookie'] = session.cookies;

  const resp = await fetch(AGENAS_URL, {
    method: 'POST',
    headers,
    body: formData.toString(),
  });
  if (!resp.ok) throw new Error(`AGENAS search fallita: ${resp.status}`);
  const html = await resp.text();
  const $ = cheerio.load(html);
  return { $, hiddenFields: getHiddenFields($), cookies: session.cookies };
}

/**
 * Naviga alla pagina successiva cliccando il bottone "Next" del DataPager.
 */
async function navigateNextPage(
  session: AgenasSession
): Promise<AgenasSession | null> {
  const { $ } = session;

  // Il bottone Next è un <input type="image"> con alt="Next"
  // name = ctl00$cphMain$Eventi1$DataPager1$ctl02$ctl00
  const nextBtn = $(
    'input[type="image"][alt="Next"]:not(.aspNetDisabled)'
  );
  if (nextBtn.length === 0) return null; // Ultima pagina

  const btnName = nextBtn.attr('name');
  if (!btnName) return null;

  const formData = buildFormData($, session.hiddenFields);
  formData.set('__EVENTTARGET', '');
  formData.set('__EVENTARGUMENT', '');
  formData.append(`${btnName}.x`, '10');
  formData.append(`${btnName}.y`, '10');

  const headers = { ...AGENAS_HEADERS };
  if (session.cookies) headers['Cookie'] = session.cookies;

  const resp = await fetch(AGENAS_URL, {
    method: 'POST',
    headers,
    body: formData.toString(),
  });
  if (!resp.ok) return null;
  const html = await resp.text();
  const $next = cheerio.load(html);
  return {
    $: $next,
    hiddenFields: getHiddenFields($next),
    cookies: session.cookies,
  };
}

// ---- Main sync logic ----

const CONSECUTIVE_EMPTY_STOP = 5; // Stop dopo 5 pagine consecutive senza eventi validi

async function syncProfession(
  professioneId: string,
  professioneLabel: string,
  _startPage: number // parametro mantenuto per compatibilità, ma sempre si parte da 1
): Promise<{ totalEvents: number; lastPage: number; done: boolean }> {
  const startTime = Date.now();
  let totalEvents = 0;
  let consecutiveEmpty = 0;

  console.log(
    `🔄 ECM Sync: inizio ${professioneLabel} (${professioneId})`
  );

  // 1. Start session
  const session = await startSession();

  // 2. Search
  let current = await searchProfession(session, professioneId);

  // Parse total results
  const totalText = current.$('body').text().match(/(\d+)\s*Risultat/i);
  const totalResults = totalText ? parseInt(totalText[1]) : 0;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);
  console.log(`   Totale: ${totalResults} eventi, ${totalPages} pagine`);

  if (totalResults === 0) {
    return { totalEvents: 0, lastPage: 1, done: true };
  }

  // 3. Itera le pagine (sempre da pagina 1)
  let currentPage = 1;
  while (currentPage <= totalPages) {
    // Timeout check
    if (Date.now() - startTime > MAX_RUN_MS) {
      console.log(`   ⏱️ Timeout raggiunto a pagina ${currentPage}, ${totalEvents} eventi salvati`);
      return { totalEvents, lastPage: currentPage, done: false };
    }

    // Parse eventi dalla pagina corrente
    const pageIndex = (currentPage - 1) * PAGE_SIZE;
    const events = parseEventsFromPage(
      current.$,
      professioneId,
      professioneLabel,
      pageIndex
    );
    totalEvents += events.length;

    // Upsert in Firestore
    await upsertEvents(events);

    // Early stop: se troviamo N pagine consecutive senza eventi validi,
    // le pagine successive avranno eventi ancora più vecchi → tutti scaduti
    if (events.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= CONSECUTIVE_EMPTY_STOP) {
        console.log(`   🛑 Stop anticipato: ${CONSECUTIVE_EMPTY_STOP} pagine consecutive vuote a pagina ${currentPage}`);
        return { totalEvents, lastPage: currentPage, done: true };
      }
    } else {
      consecutiveEmpty = 0;
    }

    // Prossima pagina
    if (currentPage >= totalPages) break;

    const next = await navigateNextPage(current);
    if (!next) break;
    current = next;
    currentPage++;

    await delay(PAGE_DELAY_MS);
  }

  console.log(
    `   ✅ Sync completato: ${totalEvents} eventi, ${currentPage} pagine`
  );
  return { totalEvents, lastPage: currentPage, done: true };
}

// ---- Cloud Functions ----

/**
 * Funzione schedulata che ogni 15 minuti controlla se c'è una professione
 * da sincronizzare. Ne processa UNA per invocazione.
 */
export const syncECMAutomatic = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('every 15 minutes')
  .timeZone('Europe/Rome')
  .onRun(async () => {
    const db = admin.firestore();
    const statusCol = db.collection('ecmSyncStatus');

    // Se c'è una professione in-progress (timeout precedente), marcala come completata
    const inProgress = await statusCol
      .where('status', '==', 'in-progress')
      .limit(1)
      .get();

    if (!inProgress.empty) {
      const doc = inProgress.docs[0];
      await statusCol.doc(doc.id).update({
        status: 'idle',
        lastSynced: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`📋 ECM Sync: marcato ${doc.data().label} come completato (timeout precedente)`);
    }

    // Trova la professione più vecchia
    const oldest = await statusCol
      .orderBy('lastSynced', 'asc')
      .limit(1)
      .get();

    if (oldest.empty) {
      // Prima esecuzione: inizializza tutte le professioni
      await initializeSyncStatus();
      return;
    }

    const doc = oldest.docs[0];
    const data = doc.data();
    const syncAge = Date.now() - (data.lastSynced?.toMillis() || 0);

    if (syncAge < SYNC_STALE_MS) {
      // Tutte le professioni sono aggiornate
      return;
    }

    const profId = doc.id;
    const profLabel = data.label || profId;
    console.log(
      `📋 ECM Sync: inizio ${profLabel} (stale da ${Math.round(syncAge / 3600000)}h)`
    );

    try {
      // Marca come in-progress
      await statusCol.doc(profId).update({
        status: 'in-progress',
        syncStarted: admin.firestore.FieldValue.serverTimestamp(),
      });

      const result = await syncProfession(profId, profLabel, 1);

      // Sempre marca come completato (sia done che timeout)
      await statusCol.doc(profId).update({
        status: 'idle',
        lastSynced: admin.firestore.FieldValue.serverTimestamp(),
        totalEvents: result.totalEvents,
        currentPage: 0,
      });
    } catch (error: any) {
      console.error(`❌ ECM Sync errore per ${profLabel}:`, error.message);
      // Reset status per riprovare
      await statusCol.doc(profId).update({
        status: 'idle',
        error: error.message,
      });
    }
  });

/**
 * Inizializza la collezione ecmSyncStatus con tutte le professioni AGENAS.
 */
async function initializeSyncStatus(): Promise<void> {
  // Solo le professioni AGENAS rilevanti per le professioni del sito
  const professions = AGENAS_PROFESSIONS;

  const db = admin.firestore();
  const batch = db.batch();

  for (const [id, label] of Object.entries(professions)) {
    batch.set(db.collection('ecmSyncStatus').doc(id), {
      label,
      status: 'idle',
      lastSynced: admin.firestore.Timestamp.fromMillis(0), // Mai sincronizzato
      totalEvents: 0,
      currentPage: 0,
    });
  }

  await batch.commit();
  console.log(
    `✅ ECM Sync: inizializzate ${Object.keys(professions).length} professioni`
  );
}

/**
 * Funzione callable per forzare la sincronizzazione di una professione.
 * Solo per admin/debug.
 */
export const triggerECMSync = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onCall(async (data: { professioneId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Utente non autenticato'
      );
    }

    const { professioneId } = data;
    const statusDoc = await admin
      .firestore()
      .collection('ecmSyncStatus')
      .doc(professioneId)
      .get();

    if (!statusDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Professione non trovata'
      );
    }

    const label = statusDoc.data()?.label || professioneId;
    const result = await syncProfession(professioneId, label, 1);

    await admin
      .firestore()
      .collection('ecmSyncStatus')
      .doc(professioneId)
      .update({
        status: 'idle',
        lastSynced: admin.firestore.FieldValue.serverTimestamp(),
        totalEvents: result.totalEvents,
        currentPage: 0,
      });

    return {
      professioneId,
      label,
      totalEvents: result.totalEvents,
      pages: result.lastPage,
    };
  });

/**
 * Pulisce eventi ECM scaduti (dataFine nel passato da più di 30 giorni).
 */
export const cleanupECMStaleEvents = functions
  .region('europe-west1')
  .pubsub.schedule('0 4 * * *') // Ogni giorno alle 4 AM
  .timeZone('Europe/Rome')
  .onRun(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stale = await admin
      .firestore()
      .collection('ecmEvents')
      .where(
        'dataFineTimestamp',
        '<',
        admin.firestore.Timestamp.fromDate(thirtyDaysAgo)
      )
      .limit(500)
      .get();

    if (stale.empty) {
      console.log('🗑️ ECM cleanup: nessun evento scaduto');
      return;
    }

    const batch = admin.firestore().batch();
    stale.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`🗑️ ECM cleanup: rimossi ${stale.size} eventi scaduti`);
  });
