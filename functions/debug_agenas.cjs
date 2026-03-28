// Debug script per verificare la comunicazione con AGENAS
const cheerio = require('cheerio');

const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';

async function main() {
  console.log('=== STEP 1: GET pagina AGENAS ===');
  const getResp = await fetch(AGENAS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'it-IT,it;q=0.9',
    },
  });

  const cookies = getResp.headers.getSetCookie ? getResp.headers.getSetCookie() : [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
  const getHtml = await getResp.text();
  const $ = cheerio.load(getHtml);

  console.log('GET OK, HTML:', getHtml.length, 'Cookie:', cookieStr.substring(0, 60));

  // === STEP 2: Postback selezione professione (Psicologo=5) ===
  console.log('\n=== STEP 2: POSTBACK professione=5 (Psicologo) ===');
  const formData = new URLSearchParams();
  
  // Tutti gli hidden
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) formData.append(name, val);
  });
  
  // Tutti i text input
  $('input[type="text"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) formData.append(name, val);
  });
  
  // Tutti i select con opzioni
  $('select').each((_, el) => {
    const name = $(el).attr('name');
    const optCount = $(el).find('option').length;
    if (!name || optCount === 0) return;
    const selected = $(el).find('option[selected]').attr('value');
    const firstOpt = $(el).find('option').first().attr('value');
    formData.append(name, selected || firstOpt || '');
  });

  // POSTBACK: imposta __EVENTTARGET alla professione (AutoPostBack)
  formData.set('__EVENTTARGET', 'ctl00$cphMain$Eventi1$ddlProfessione');
  formData.set('__EVENTARGUMENT', '');
  formData.set('ctl00$cphMain$Eventi1$ddlProfessione', '5'); // Psicologo
  // NON aggiungere btnCerca — è un postback, non un submit

  const postbackHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://ape.agenas.it/Tools/Eventi.aspx',
    'Origin': 'https://ape.agenas.it',
  };
  if (cookieStr) postbackHeaders['Cookie'] = cookieStr;

  const pbResp = await fetch(AGENAS_URL, {
    method: 'POST',
    headers: postbackHeaders,
    body: formData.toString(),
  });

  const pbHtml = await pbResp.text();
  const $pb = cheerio.load(pbHtml);
  console.log('Postback status:', pbResp.status, 'HTML:', pbHtml.length);

  // Check se errore
  const errore = $pb('[id*="lblEcm"]').text();
  if (errore && errore.includes('Errore')) {
    console.log('❌ ERRORE nel postback:', errore);
    console.log($pb('[id*="cphMain"]').first().text().substring(0, 500));
    return;
  }

  // Mostra le discipline caricate
  console.log('\n=== DISCIPLINE dopo postback Psicologo ===');
  $pb('select[name*="ddlDisciplina"] option').each((_, el) => {
    console.log(`  value="${$pb(el).attr('value')}" label="${$pb(el).text().trim()}"`);
  });

  // Verifica anche le province dopo postback
  console.log('\n=== PROVINCE dopo postback ===');
  const provCount = $pb('select[name*="ddlProvince"] option').length;
  console.log(`  ${provCount} province options`);

  // === STEP 3: Prova anche hfCrediti ===
  console.log('\n=== Hidden hfCrediti ===');
  console.log('  value:', $pb('[name*="hfCrediti"]').val());

  // === STEP 4: Testiamo anche postback con Medico Chirurgo (1) ===
  console.log('\n=== STEP 4: POSTBACK professione=1 (Medico Chirurgo) ===');
  const formData2 = new URLSearchParams();
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) formData2.append(name, val);
  });
  $('input[type="text"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) formData2.append(name, val);
  });
  $('select').each((_, el) => {
    const name = $(el).attr('name');
    const optCount = $(el).find('option').length;
    if (!name || optCount === 0) return;
    const selected = $(el).find('option[selected]').attr('value');
    const firstOpt = $(el).find('option').first().attr('value');
    formData2.append(name, selected || firstOpt || '');
  });
  formData2.set('__EVENTTARGET', 'ctl00$cphMain$Eventi1$ddlProfessione');
  formData2.set('__EVENTARGUMENT', '');
  formData2.set('ctl00$cphMain$Eventi1$ddlProfessione', '1');

  const pbResp2 = await fetch(AGENAS_URL, {
    method: 'POST',
    headers: postbackHeaders,
    body: formData2.toString(),
  });

  const pbHtml2 = await pbResp2.text();
  const $pb2 = cheerio.load(pbHtml2);
  console.log('Postback status:', pbResp2.status, 'HTML:', pbHtml2.length);

  const errore2 = $pb2('[id*="lblEcm"]').text();
  if (errore2 && errore2.includes('Errore')) {
    console.log('❌ ERRORE:', errore2);
    return;
  }

  console.log('\n=== DISCIPLINE Medico Chirurgo ===');
  $pb2('select[name*="ddlDisciplina"] option').each((_, el) => {
    console.log(`  value="${$pb2(el).attr('value')}" label="${$pb2(el).text().trim()}"`);
  });
}

main().catch(console.error);
