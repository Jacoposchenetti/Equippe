const cheerio = require('cheerio');
const URL = 'https://ape.agenas.it/Tools/Eventi.aspx';
const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': URL,
  'Origin': 'https://ape.agenas.it',
};

function buildForm($) {
  const fd = new URLSearchParams();
  $('input[type="hidden"]').each((_, el) => { const n = $(el).attr('name'); if (n) fd.append(n, $(el).attr('value') || ''); });
  $('input[type="text"]').each((_, el) => { const n = $(el).attr('name'); if (n) fd.append(n, $(el).attr('value') || ''); });
  $('select').each((_, el) => { const n = $(el).attr('name'); const c = $(el).find('option').length; if (!n || c === 0) return; fd.append(n, $(el).find('option[selected]').attr('value') || $(el).find('option').first().attr('value') || ''); });
  return fd;
}

async function main() {
  // GET
  const r1 = await fetch(URL, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
  const cookies = (r1.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const $ = cheerio.load(await r1.text());

  // Test 1: Postback regione Lazio=8
  console.log('=== POSTBACK Regione=8 (Lazio) ===');
  const fd1 = buildForm($);
  fd1.set('__EVENTTARGET', 'ctl00$cphMain$Eventi1$ddlRegioni');
  fd1.set('__EVENTARGUMENT', '');
  fd1.set('ctl00$cphMain$Eventi1$ddlRegioni', '8');
  
  const h1 = { ...HEADERS, Cookie: cookies };
  const r2 = await fetch(URL, { method: 'POST', headers: h1, body: fd1.toString() });
  const $2 = cheerio.load(await r2.text());
  
  const err1 = $2('[id*="lblEcm"]').text();
  if (err1 && err1.includes('Errore')) { console.log('ERRORE:', err1); }
  else {
    console.log('Province Lazio:');
    $2('select[name*="ddlProvince"] option').each((_, el) => {
      console.log('  value="' + $2(el).attr('value') + '" label="' + $2(el).text().trim() + '"');
    });
  }

  // Test 2: Verifica se hfCrediti viene usato nella ricerca AGENAS
  // Cerchiamo se c'è un campo crediti nel form
  console.log('\n=== CAMPI CREDITI ===');
  $('input').each((_, el) => {
    const name = $(el).attr('name') || '';
    if (name.toLowerCase().includes('credit')) {
      console.log('  input:', name, '=', $(el).attr('value'));
    }
  });
  $('select').each((_, el) => {
    const name = $(el).attr('name') || '';
    if (name.toLowerCase().includes('credit')) {
      console.log('  select:', name);
      $(el).find('option').each((_, o) => {
        console.log('    value="' + $(o).attr('value') + '" label="' + $(o).text().trim() + '"');
      });
    }
  });
  // Check il hidden hfCrediti
  console.log('  hfCrediti value:', $('[name*="hfCrediti"]').val());
}

main().catch(console.error);
