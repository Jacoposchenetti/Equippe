import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as cheerio from 'cheerio';

const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';
const CACHE_TTL_DROPDOWNS = 24 * 60 * 60 * 1000; // 24 ore
const MAX_REQUESTS_PER_MINUTE = 10;

/** Mappa codici tipologia testuale → valore numerico AGENAS (ddlTipologiaEvento) */
const TIPOLOGIA_TO_AGENAS: Record<string, string> = {
  'FAD': '1',
  'FSC': '2',
  'RES': '3',
  'BLENDED': '4',
};

/** Parsa il valore costo AGENAS (es. "€ 150,00", "Gratuito") in un numero. */
function parseCosto(costo: string): number {
  if (!costo) return 0;
  const lower = costo.toLowerCase().trim();
  if (lower === 'gratuito' || lower === '') return 0;
  const cleaned = costo.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Interfacce
interface ECMEvent {
  id: string;
  titolo: string;
  provider: string;
  professione: string;
  disciplina: string;
  regione: string;
  crediti: string;
  dataInizio: string;
  dataFine: string;
  tipologia: string;
  costo: string;
  obiettivo: string;
}

interface ECMSearchParams {
  professione?: string;
  disciplina?: string;
  regione?: string;
  titolo?: string;
  dataInizio?: string;
  dataFine?: string;
  tipologia?: string;
  obiettivo?: string;
  provincia?: string;
}

interface DropdownValues {
  professioni: { value: string; label: string }[];
  regioni: { value: string; label: string }[];
  discipline: { value: string; label: string }[];
  tipologie: { value: string; label: string }[];
  obiettivi: { value: string; label: string }[];
  province: { value: string; label: string }[];
}

// ---------- HELPERS ----------

async function checkRateLimit(uid: string): Promise<boolean> {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const rateLimitRef = admin.firestore().collection('ecmRateLimit').doc(uid);

  return admin.firestore().runTransaction(async (tx) => {
    const doc = await tx.get(rateLimitRef);
    const data = doc.data();
    const timestamps: number[] = (data?.timestamps || []).filter(
      (t: number) => t > oneMinuteAgo
    );

    if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      return false;
    }

    timestamps.push(now);
    tx.set(rateLimitRef, { timestamps, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}

/**
 * Fetcha la pagina AGENAS e restituisce l'HTML + i token ViewState necessari al POST
 */
async function fetchAgenasPage(): Promise<{
  html: string;
  cookies: string;
  hiddenFields: Record<string, string>;
}> {
  const response = await fetch(AGENAS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (!response.ok) {
    throw new Error(`AGENAS non raggiungibile: ${response.status}`);
  }

  // Cattura cookies per la sessione
  const setCookies = response.headers.getSetCookie?.() || [];
  const cookies = setCookies.map((c: string) => c.split(';')[0]).join('; ');

  const html = await response.text();
  const $ = cheerio.load(html);

  // Raccogli TUTTI i campi hidden (ViewState, EventValidation, e altri custom)
  const hiddenFields: Record<string, string> = {};
  $('input[type="hidden"]').each((_: number, el: any) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) hiddenFields[name] = val;
  });

  return { html, cookies, hiddenFields };
}

const AGENAS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://ape.agenas.it/Tools/Eventi.aspx',
  'Origin': 'https://ape.agenas.it',
};

/**
 * Costruisce il body di un POST partendo dall'HTML della pagina AGENAS:
 * tutti hidden + text input + select con opzioni.
 */
function buildFormData(html: string, hiddenFields: Record<string, string>): URLSearchParams {
  const $ = cheerio.load(html);
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

/**
 * Simula un AutoPostBack ASP.NET selezionando una professione.
 * Restituisce la pagina aggiornata con le discipline caricate.
 */
async function postbackProfessione(
  professioneId: string,
  pageData: { html: string; cookies: string; hiddenFields: Record<string, string> }
): Promise<{ html: string; hiddenFields: Record<string, string> }> {
  const formData = buildFormData(pageData.html, pageData.hiddenFields);

  const P = 'ctl00$cphMain$Eventi1$';
  formData.set('__EVENTTARGET', `${P}ddlProfessione`);
  formData.set('__EVENTARGUMENT', '');
  formData.set(`${P}ddlProfessione`, professioneId);
  // Postback: nessun bottone submit

  const headers = { ...AGENAS_HEADERS };
  if (pageData.cookies) headers['Cookie'] = pageData.cookies;

  const response = await fetch(AGENAS_URL, {
    method: 'POST',
    headers,
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`AGENAS postback professione fallito: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const hiddenFields: Record<string, string> = {};
  $('input[type="hidden"]').each((_: number, el: any) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) hiddenFields[name] = val;
  });

  return { html, hiddenFields };
}

/**
 * Esegue un POST sulla pagina AGENAS con i parametri di ricerca.
 * Se è specificata una disciplina, prima simula il postback della professione
 * per caricare le discipline lato server.
 */
async function searchAgenas(
  params: ECMSearchParams,
  pageData: {
    html: string;
    cookies: string;
    hiddenFields: Record<string, string>;
  }
): Promise<string> {
  let currentHtml = pageData.html;
  let currentHidden = pageData.hiddenFields;

  // Se disciplina specificata, serve prima il postback della professione
  if (params.disciplina && params.professione) {
    const pbResult = await postbackProfessione(params.professione, pageData);
    currentHtml = pbResult.html;
    currentHidden = pbResult.hiddenFields;
  }

  const formData = buildFormData(currentHtml, currentHidden);

  const P = 'ctl00$cphMain$Eventi1$';
  if (params.professione) formData.set(`${P}ddlProfessione`, params.professione);
  if (params.disciplina) formData.set(`${P}ddlDisciplina`, params.disciplina);
  if (params.regione) formData.set(`${P}ddlRegioni`, params.regione);
  if (params.tipologia) {
    const agenasVal = TIPOLOGIA_TO_AGENAS[params.tipologia.toUpperCase()] || params.tipologia;
    formData.set(`${P}ddlTipologiaEvento`, agenasVal);
  }
  if (params.obiettivo) formData.set(`${P}ddlObiettivoFormativo`, params.obiettivo);
  if (params.titolo) formData.set(`${P}tbTitoloEvento`, params.titolo);
  if (params.dataInizio) formData.set(`${P}tbDataInizio`, params.dataInizio);
  if (params.dataFine) formData.set(`${P}tbDataFine`, params.dataFine);

  // Reset postback target e imposta bottone ricerca
  formData.set('__EVENTTARGET', '');
  formData.set('__EVENTARGUMENT', '');
  formData.append(`${P}btnCerca`, 'Cerca');

  const headers = { ...AGENAS_HEADERS };
  if (pageData.cookies) headers['Cookie'] = pageData.cookies;

  const response = await fetch(AGENAS_URL, {
    method: 'POST',
    headers,
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`AGENAS ricerca fallita: ${response.status}`);
  }

  return response.text();
}

/**
 * Parsa l'HTML dei risultati AGENAS ed estrae gli eventi dai div .lista
 */
function parseEventResults(html: string): ECMEvent[] {
  const $ = cheerio.load(html);
  const events: ECMEvent[] = [];

  // Ogni risultato è un div.lista con figli: .headerLista, .DettaglioInformazioni
  // Gli ID degli span usano il pattern: cphMain_Eventi1_ResultTable_lbXXX_N
  $('.lista').each((_: number, el: any) => {
    const item = $(el);

    // Trova l'indice N dal primo span con id contenente "ResultTable"
    const firstSpan = item.find('[id*="ResultTable"]').first();
    const idMatch = firstSpan.attr('id')?.match(/_(\d+)$/);
    const idx = idMatch ? idMatch[1] : '';
    const span = (suffix: string) =>
      item.find(`[id$="${suffix}_${idx}"]`).text().trim();

    const event: ECMEvent = {
      id: span('lbValoreEvento'),
      titolo: span('lbTitoloEvento'),
      provider: span('lbNomeProvider'),
      professione: span('lbValoreProfessioni'),
      disciplina: '',
      regione: '',
      crediti: span('lbValoreCrediti'),
      dataInizio: span('lbVAloreDataInizio'),
      dataFine: span('lbVAloreDataFine'),
      tipologia: span('lbValoreTipoEvento'),
      costo: span('lbValoreCosto'),
      obiettivo: '',
    };

    if (event.titolo && event.titolo.length > 2) {
      events.push(event);
    }
  });

  return events;
}

/**
 * Parsa i dropdown dalla pagina AGENAS per estrarre le opzioni selezionabili
 */
function parseDropdowns(html: string): DropdownValues {
  const $ = cheerio.load(html);

  const extractOptions = (selector: string): { value: string; label: string }[] => {
    const options: { value: string; label: string }[] = [];
    $(`${selector} option`).each((_, el) => {
      const value = $(el).attr('value') || '';
      const label = $(el).text().trim();
      if (value && label && value !== '' && value !== '0') {
        options.push({ value, label });
      }
    });
    return options;
  };

  return {
    professioni: extractOptions('[id*="ddlProfessione"]'),
    regioni: extractOptions('[id*="ddlRegioni"]'),
    discipline: extractOptions('[id*="ddlDisciplina"]'),
    tipologie: extractOptions('[id*="ddlTipologiaEvento"]'),
    obiettivi: extractOptions('[id*="ddlObiettivoFormativo"]'),
    province: extractOptions('[id*="ddlProvince"]'),
  };
}

/**
 * Esegue una sessione completa su AGENAS: GET → search → restituisce
 * l'HTML dei risultati + cookies + hiddenFields per successivi postback
 */
/**
 * Estrae il numero totale di pagine dal pager AGENAS.
 * I bottoni numerici nel DataPager rappresentano le pagine disponibili.
 */
function parseTotalPages(html: string): number {
  const $ = cheerio.load(html);
  let maxPage = 1;
  $('[id*="DataPager"] input[type="submit"]').each((_: number, el: any) => {
    const val = parseInt($(el).attr('value') || '', 10);
    if (!isNaN(val) && val > maxPage) maxPage = val;
  });
  return maxPage;
}

/**
 * Esegue una ricerca AGENAS raccogliendo TUTTE le pagine di risultati.
 * Naviga sempre di una pagina avanti (targetPage=2 dall'ultima sessione),
 * che equivale a "click Next" sequenziale.
 * Max 50 pagine (500 eventi) come limite di sicurezza.
 */
async function executeSearchAllPages(params: ECMSearchParams): Promise<ECMEvent[]> {
  const session = await executeSearchSession(params);
  const allEvents: ECMEvent[] = parseEventResults(session.resultsHtml);
  const totalPages = parseTotalPages(session.resultsHtml);

  const PAGE_DELAY_MS = 300;
  const MAX_PAGES = 50;
  const pages = Math.min(totalPages, MAX_PAGES);

  let currentSession: { resultsHtml: string; cookies: string; hiddenFields: Record<string, string> } = session;

  for (let page = 2; page <= pages; page++) {
    await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    // targetPage=2 con currentSession all'ultima pagina = click "Next" di un passo
    const nextSession = await navigateToPageFromSession(currentSession, 2);
    const pageEvents = parseEventResults(nextSession.resultsHtml);
    if (pageEvents.length === 0) break;
    allEvents.push(...pageEvents);
    currentSession = nextSession;
  }

  return allEvents;
}

async function executeSearchSession(params: ECMSearchParams): Promise<{
  resultsHtml: string;
  cookies: string;
  hiddenFields: Record<string, string>;
}> {
  const pageData = await fetchAgenasPage();
  const resultsHtml = await searchAgenas(params, pageData);
  const $ = cheerio.load(resultsHtml);

  const hiddenFields: Record<string, string> = {};
  $('input[type="hidden"]').each((_: number, el: any) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) hiddenFields[name] = val;
  });

  return { resultsHtml, cookies: pageData.cookies, hiddenFields };
}

/**
 * Naviga dalla pagina 1 dei risultati a una pagina target (1-based).
 * Usa i bottoni numerati del DataPager o il bottone Next.
 */
async function navigateToPageFromSession(
  session: { resultsHtml: string; cookies: string; hiddenFields: Record<string, string> },
  targetPage: number
): Promise<{ resultsHtml: string; cookies: string; hiddenFields: Record<string, string> }> {
  if (targetPage <= 1) return session;

  let currentPage = 1;
  let currentHtml = session.resultsHtml;
  let currentHidden = session.hiddenFields;
  const cookies = session.cookies;

  while (currentPage < targetPage) {
    const $ = cheerio.load(currentHtml);

    // Try to find a direct page button to click
    let clicked = false;
    const pagerBtns = $('[id="cphMain_Eventi1_DataPager1"] input[type="submit"]');
    for (let i = 0; i < pagerBtns.length; i++) {
      const btn = pagerBtns.eq(i);
      const val = parseInt(btn.attr('value') || '', 10);
      if (val === targetPage || (val > currentPage && val <= targetPage)) {
        const btnName = btn.attr('name');
        if (!btnName) continue;
        const formData = buildFormData(currentHtml, currentHidden);
        formData.set('__EVENTTARGET', '');
        formData.set('__EVENTARGUMENT', '');
        formData.append(btnName, String(val));

        const headers = { ...AGENAS_HEADERS };
        if (cookies) headers['Cookie'] = cookies;

        const resp = await fetch(AGENAS_URL, {
          method: 'POST',
          headers,
          body: formData.toString(),
        });
        if (!resp.ok) throw new Error(`Page nav fallita: ${resp.status}`);
        currentHtml = await resp.text();
        const $n = cheerio.load(currentHtml);
        currentHidden = {};
        $n('input[type="hidden"]').each((_: number, el: any) => {
          const name = $n(el).attr('name');
          const v = $n(el).attr('value') || '';
          if (name) currentHidden[name] = v;
        });
        currentPage = val;
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      // Use Next button
      const nextBtn = $('input[type="image"][alt="Next"]:not(.aspNetDisabled)');
      if (nextBtn.length === 0) break;
      const btnName = nextBtn.attr('name');
      if (!btnName) break;

      const formData = buildFormData(currentHtml, currentHidden);
      formData.set('__EVENTTARGET', '');
      formData.set('__EVENTARGUMENT', '');
      formData.append(`${btnName}.x`, '10');
      formData.append(`${btnName}.y`, '10');

      const headers = { ...AGENAS_HEADERS };
      if (cookies) headers['Cookie'] = cookies;

      const resp = await fetch(AGENAS_URL, {
        method: 'POST',
        headers,
        body: formData.toString(),
      });
      if (!resp.ok) break;
      currentHtml = await resp.text();
      const $n = cheerio.load(currentHtml);
      currentHidden = {};
      $n('input[type="hidden"]').each((_: number, el: any) => {
        const name = $n(el).attr('name');
        const v = $n(el).attr('value') || '';
        if (name) currentHidden[name] = v;
      });
      currentPage++;
    }
  }

  return { resultsHtml: currentHtml, cookies, hiddenFields: currentHidden };
}

/**
 * Trova la posizione di un evento in una sessione risultati AGENAS,
 * cercando per ID nelle prime pagine (default: 5).
 */
async function findEventInSession(
  session: { resultsHtml: string; cookies: string; hiddenFields: Record<string, string> },
  eventId: string,
  maxPages = 5
): Promise<{
  session: { resultsHtml: string; cookies: string; hiddenFields: Record<string, string> };
  indexOnPage: number;
} | null> {
  for (let page = 1; page <= maxPages; page++) {
    const pageSession = page === 1 ? session : await navigateToPageFromSession(session, page);
    const events = parseEventResults(pageSession.resultsHtml);
    const idx = events.findIndex((e) => e.id === eventId);
    if (idx !== -1) {
      return { session: pageSession, indexOnPage: idx };
    }
  }
  return null;
}

/**
 * Simula il click su un pulsante (Dettaglio o Programma) per un evento
 * nella pagina dei risultati di ricerca AGENAS.
 */
async function clickEventButton(
  session: { resultsHtml: string; cookies: string; hiddenFields: Record<string, string> },
  eventIndex: number,
  buttonSuffix: 'ibDettaglioEvento' | 'ibProgramma'
): Promise<Response> {
  const formData = buildFormData(session.resultsHtml, session.hiddenFields);

  const btnName = `ctl00$cphMain$Eventi1$ResultTable$ctrl${eventIndex}$${buttonSuffix}`;
  formData.set('__EVENTTARGET', '');
  formData.set('__EVENTARGUMENT', '');
  formData.append(`${btnName}.x`, '10');
  formData.append(`${btnName}.y`, '10');

  const headers: Record<string, string> = { ...AGENAS_HEADERS };
  if (session.cookies) headers['Cookie'] = session.cookies;

  return fetch(AGENAS_URL, {
    method: 'POST',
    headers,
    body: formData.toString(),
    redirect: 'manual',
  });
}

interface ECMEventDetail {
  id: string;
  edizione: string;
  titolo: string;
  idProvider: string;
  ragioneSociale: string;
  dataInizio: string;
  dataFine: string;
  durata: string;
  crediti: string;
  quota: string;
  numPartecipanti: string;
  tipologiaFAD: string;
  obiettivo: string;
  areaObiettivo: string;
  competenzeTecniche: string;
  competenzeProcesso: string;
  verificaApprendimento: string;
  professioni: string;
  programmaFilename: string;
  telefonoSegreteria: string;
  emailSegreteria: string;
  responsabileNome: string;
  responsabileCognome: string;
  sponsorizzato: string;
}

/**
 * Parsa l'HTML della pagina DettaglioEvento.aspx di AGENAS
 */
function parseEventDetail(html: string): ECMEventDetail {
  const $ = cheerio.load(html);
  const v = (suffix: string) =>
    $(`[id$="${suffix}"]`).text().trim();

  return {
    id: v('lbNumeroEventoValore'),
    edizione: v('lbNumeroEdizioneValore'),
    titolo: v('lblTitoloEventoValore'),
    idProvider: v('lbIDProviderValore'),
    ragioneSociale: v('lbDenominazioneProviderValore'),
    dataInizio: v('lblDataIniValore'),
    dataFine: v('lblDataEndiValore'),
    durata: v('lblDurataValore'),
    crediti: v('lblCreditiValore'),
    quota: v('lblQuotaPartecipazioneValore'),
    numPartecipanti: v('lblNumeroPartecipantiValore'),
    tipologiaFAD: v('lblTipologiaFADValore'),
    obiettivo: v('lblValoreObiettivoFormativo'),
    areaObiettivo: v('lblValoreAreaObiettivoFormativo'),
    competenzeTecniche: v('lblCompentenzeValore'),
    competenzeProcesso: v('lblCompentenzeProcessoValore'),
    verificaApprendimento: v('lblVerificaApprendimentoPartecipantiValore'),
    professioni: v('lbValoreProfessioni') || $('[id*="GridViewProfessioni"]').text().replace(/\s+/g, ' ').trim(),
    programmaFilename: v('lbProgrammaValore'),
    telefonoSegreteria: v('lblSegreOrgTelefonoValore'),
    emailSegreteria: v('lblSegreOrgEmailValore'),
    responsabileNome: v('lblResponsabileOrganizzativoNomeValore'),
    responsabileCognome: v('lblResponsabileOrganizzativoCognomeValore'),
    sponsorizzato: v('lblSponsorValore'),
  };
}

// ---------- CLOUD FUNCTIONS ----------

/**
 * Restituisce le discipline per una professione (postback AGENAS)
 * con cache di 24 ore per professione
 */
export const getECMDisciplines = functions
  .region('europe-west1')
  .https
  .onCall(async (data: { professioneId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }

    const { professioneId } = data;
    if (!professioneId || professioneId === '-1') {
      return { discipline: [] };
    }

    const CACHE_DOC = `ecm_discipline_${professioneId}`;

    // Controlla cache
    try {
      const cacheDoc = await admin.firestore()
        .collection('ecmCache')
        .doc(CACHE_DOC)
        .get();

      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data();
        const cacheAge = Date.now() - (cacheData?.timestamp?.toMillis() || 0);
        if (cacheAge < CACHE_TTL_DROPDOWNS) {
          return { discipline: cacheData?.discipline || [] };
        }
      }
    } catch (err) {
      console.warn('⚠️ Errore lettura cache discipline ECM:', err);
    }

    try {
      const pageData = await fetchAgenasPage();
      const pbResult = await postbackProfessione(professioneId, pageData);

      const $ = cheerio.load(pbResult.html);
      const discipline: { value: string; label: string }[] = [];
      $('select[name*="ddlDisciplina"] option').each((_: number, el: any) => {
        const value = $(el).attr('value') || '';
        const label = $(el).text().trim();
        if (value && value !== '-1' && label) {
          discipline.push({ value, label });
        }
      });

      // Salva in cache
      try {
        await admin.firestore()
          .collection('ecmCache')
          .doc(CACHE_DOC)
          .set({
            discipline,
            professioneId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
      } catch (err) {
        console.warn('⚠️ Errore scrittura cache discipline ECM:', err);
      }

      return { discipline };
    } catch (error: any) {
      console.error('❌ Errore fetch discipline ECM:', error.message);
      throw new functions.https.HttpsError(
        'unavailable',
        'Il servizio AGENAS non è al momento raggiungibile.'
      );
    }
  });

/**
 * Restituisce i valori dei dropdown della pagina AGENAS (professioni, regioni, ecc.)
 * con cache di 24 ore
 */
export const getECMDropdownValues = functions
  .region('europe-west1')
  .https
  .onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }

    const CACHE_DOC = 'ecm_dropdown_values';

    try {
      const cacheDoc = await admin.firestore()
        .collection('ecmCache')
        .doc(CACHE_DOC)
        .get();

      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data();
        const cacheAge = Date.now() - (cacheData?.timestamp?.toMillis() || 0);
        if (cacheAge < CACHE_TTL_DROPDOWNS) {
          return cacheData?.values || {};
        }
      }
    } catch (err) {
      console.warn('⚠️ Errore lettura cache dropdown ECM:', err);
    }

    try {
      const { html } = await fetchAgenasPage();
      const values = parseDropdowns(html);

      try {
        await admin.firestore()
          .collection('ecmCache')
          .doc(CACHE_DOC)
          .set({
            values,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
      } catch (err) {
        console.warn('⚠️ Errore scrittura cache dropdown ECM:', err);
      }

      return values;
    } catch (error: any) {
      console.error('❌ Errore fetch dropdown ECM:', error.message);
      throw new functions.https.HttpsError(
        'unavailable',
        'Il servizio AGENAS non è al momento raggiungibile. Riprova più tardi.'
      );
    }
  });

/**
 * Restituisce il dettaglio completo di un evento ECM da AGENAS.
 * Accetta l'eventId (ID AGENAS univoco) e cerca la posizione
 * dell'evento su AGENAS usando professioneId e globalIndex salvati
 * durante la sync.
 * Cache: 24 ore per evento ID.
 */
export const getECMEventDetail = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 120 })
  .https
  .onCall(async (data: { eventId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }

    const { eventId } = data;
    if (!eventId || typeof eventId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'ID evento non valido');
    }

    // Rate limiting
    const allowed = await checkRateLimit(context.auth.uid);
    if (!allowed) {
      throw new functions.https.HttpsError('resource-exhausted', 'Troppe richieste. Riprova tra un minuto.');
    }

    // 1. Controlla cache
    const cacheDoc = `ecm_detail_${eventId}`;
    try {
      const cached = await admin.firestore().collection('ecmCache').doc(cacheDoc).get();
      if (cached.exists) {
        const cacheData = cached.data();
        const cacheAge = Date.now() - (cacheData?.timestamp?.toMillis() || 0);
        if (cacheAge < CACHE_TTL_DROPDOWNS) {
          console.log('📦 ECM detail cache hit:', eventId);
          return { detail: cacheData?.detail };
        }
      }
    } catch (err) {
      console.warn('⚠️ Errore lettura cache detail ECM:', err);
    }

    try {
      // 2. Recupera info evento da Firestore per trovare la posizione su AGENAS
      const eventDoc = await admin.firestore().collection('ecmEvents').doc(eventId).get();
      if (!eventDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Evento non trovato nel database');
      }
      const eventData = eventDoc.data()!;
      const professioneId = eventData._syncProfessioneId;
      const titolo = String(eventData.titolo || '').trim();

      // 3. Esegui ricerca mirata (professione + titolo) per ridurre drasticamente la navigazione
      const targetedSession = await executeSearchSession({
        professione: professioneId,
        titolo: titolo.length >= 3 ? titolo : undefined,
      });

      // 4. Cerca l'evento per ID nelle prime pagine
      const found = await findEventInSession(targetedSession, eventId, 5);
      if (!found) {
        throw new functions.https.HttpsError('not-found', 'Evento non trovato su AGENAS');
      }

      // 5. Click Dettaglio Evento
      const detailResp = await clickEventButton(found.session, found.indexOnPage, 'ibDettaglioEvento');

      if (detailResp.status !== 302) {
        throw new Error(`Dettaglio non ha restituito redirect: ${detailResp.status}`);
      }

      // 6. Segui il redirect
      const location = detailResp.headers.get('location');
      if (!location) throw new Error('Nessun redirect dal dettaglio');

      const detailUrl = new URL(location, 'https://ape.agenas.it').href;
      const headers: Record<string, string> = {
        'User-Agent': AGENAS_HEADERS['User-Agent'],
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': AGENAS_URL,
      };
      if (found.session.cookies) headers['Cookie'] = found.session.cookies;

      const detailPageResp = await fetch(detailUrl, { headers });
      if (!detailPageResp.ok) throw new Error(`Dettaglio pagina fallita: ${detailPageResp.status}`);

      const detailHtml = await detailPageResp.text();
      const detail = parseEventDetail(detailHtml);

      // 7. Salva in cache
      try {
        await admin.firestore().collection('ecmCache').doc(cacheDoc).set({
          detail,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.warn('⚠️ Errore scrittura cache detail ECM:', err);
      }

      console.log(`✅ ECM dettaglio evento ${eventId} recuperato`);
      return { detail };
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      console.error('❌ Errore dettaglio ECM:', error.message);
      throw new functions.https.HttpsError(
        'unavailable',
        'Impossibile recuperare il dettaglio. Riprova più tardi.'
      );
    }
  });

/**
 * Scarica il programma PDF di un evento ECM da AGENAS.
 * Restituisce il PDF come stringa base64.
 */
export const downloadECMProgramma = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https
  .onCall(async (data: { eventId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }

    const { eventId } = data;
    if (!eventId || typeof eventId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'ID evento non valido');
    }

    const allowed = await checkRateLimit(context.auth.uid);
    if (!allowed) {
      throw new functions.https.HttpsError('resource-exhausted', 'Troppe richieste. Riprova tra un minuto.');
    }

    try {
      // 1. Recupera info evento da Firestore
      const eventDoc = await admin.firestore().collection('ecmEvents').doc(eventId).get();
      if (!eventDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Evento non trovato nel database');
      }
      const eventData = eventDoc.data()!;
      const professioneId = eventData._syncProfessioneId;
      const titolo = String(eventData.titolo || '').trim();

      // 2. Ricerca mirata e lookup per ID nelle prime pagine
      const targetedSession = await executeSearchSession({
        professione: professioneId,
        titolo: titolo.length >= 3 ? titolo : undefined,
      });
      const found = await findEventInSession(targetedSession, eventId, 5);
      if (!found) {
        throw new functions.https.HttpsError('not-found', 'Evento non trovato su AGENAS');
      }

      // 3. Click Scarica Programma
      const pdfResp = await clickEventButton(found.session, found.indexOnPage, 'ibProgramma');

      const contentType = pdfResp.headers.get('content-type') || '';
      const contentDisposition = pdfResp.headers.get('content-disposition') || '';

      if (pdfResp.status !== 200) {
        throw new Error(`Download programma fallito: ${pdfResp.status}`);
      }

      const filenameMatch = contentDisposition.match(/filename=(.+?)(?:;|$)/i);
      const filename = filenameMatch ? filenameMatch[1].replace(/"/g, '').trim() : 'programma.pdf';

      const buffer = await pdfResp.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      console.log(`✅ ECM programma scaricato: ${filename} (${buffer.byteLength} bytes)`);
      return { base64, filename, contentType: contentType || 'application/pdf' };
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      console.error('❌ Errore download programma ECM:', error.message);
      throw new functions.https.HttpsError(
        'unavailable',
        'Impossibile scaricare il programma. Riprova più tardi.'
      );
    }
  });

/**
 * Ricerca live su AGENAS con parametri avanzati (es. obiettivo formativo).
 * Usata quando i filtri richiesti non sono disponibili nel database locale.
 * I risultati vengono cachati in Firestore per 24 ore.
 */
export const searchECMLive = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 300 })
  .https
  .onCall(async (data: {
    professione?: string;
    tipologia?: string;
    obiettivo?: string;
    titolo?: string;
    regione?: string;
  }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }

    const allowed = await checkRateLimit(context.auth.uid);
    if (!allowed) {
      throw new functions.https.HttpsError('resource-exhausted', 'Troppe richieste. Riprova tra un minuto.');
    }

    const { professione, tipologia, obiettivo, titolo, regione } = data;

    // Costruisce la chiave cache dai filtri (solo campi valorizzati, ordinati)
    const cacheKey = ['p', professione, 't', tipologia, 'o', obiettivo, 'ti', titolo, 'r', regione]
      .map(v => (v || '_'))
      .join('_')
      .replace(/[^a-zA-Z0-9_\-]/g, '-');

    const CACHE_TTL_LIVE = 24 * 60 * 60 * 1000; // 24 ore
    const cacheRef = admin.firestore().collection('ecmLiveCache').doc(cacheKey);

    // Controlla cache
    try {
      const cacheDoc = await cacheRef.get();
      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data();
        const age = Date.now() - (cacheData?.timestamp?.toMillis() || 0);
        if (age < CACHE_TTL_LIVE) {
          console.log(`✅ ECM live cache hit: ${cacheKey}`);
          return { events: cacheData?.events || [], fromCache: true };
        }
      }
    } catch (err) {
      console.warn('⚠️ Errore lettura cache live ECM:', err);
    }

    try {
      const events = await executeSearchAllPages({
        professione: professione || undefined,
        tipologia: tipologia || undefined,
        obiettivo: obiettivo || undefined,
        titolo: titolo || undefined,
        regione: regione || undefined,
      });

      console.log(`✅ ECM live search: ${events.length} risultati (tutte le pagine)`);

      const mapped = events.map(e => ({
        id: e.id,
        titolo: e.titolo,
        provider: e.provider,
        professione: e.professione,
        crediti: e.crediti,
        creditiNum: parseFloat(e.crediti?.replace(',', '.') || '0') || 0,
        dataInizio: e.dataInizio,
        dataFine: e.dataFine,
        tipologia: e.tipologia,
        costo: e.costo,
        costoNum: parseCosto(e.costo),
        professioneLabel: e.professione,
        professioniIds: professione ? [professione] : [],
      }));

      // Salva in cache (fire-and-forget)
      cacheRef.set({
        events: mapped,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        filters: { professione, tipologia, obiettivo, titolo, regione },
      }).catch(err => console.warn('⚠️ Errore scrittura cache live ECM:', err));

      return { events: mapped, fromCache: false };
    } catch (error: any) {
      console.error('❌ Errore ricerca ECM live:', error.message);
      throw new functions.https.HttpsError(
        'unavailable',
        'Il servizio AGENAS non è al momento raggiungibile. Riprova più tardi.'
      );
    }
  });
