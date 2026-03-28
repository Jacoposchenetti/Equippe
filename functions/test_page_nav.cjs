// Test clicking page buttons to navigate AGENAS results
const cheerio = require('cheerio');
const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';

function getHiddenFields($) {
  const f = {};
  $('input[type="hidden"]').each((_, el) => { const n = $(el).attr('name'); if (n) f[n] = $(el).attr('value') || ''; });
  return f;
}
function buildFormData($, hf) {
  const fd = new URLSearchParams();
  for (const [n, v] of Object.entries(hf)) fd.append(n, v);
  $('input[type="text"]').each((_, el) => { const n = $(el).attr('name'); if (n) fd.append(n, $(el).attr('value') || ''); });
  $('select').each((_, el) => {
    const n = $(el).attr('name'), c = $(el).find('option').length;
    if (!n || c === 0) return;
    fd.append(n, $(el).find('option[selected]').attr('value') || $(el).find('option').first().attr('value') || '');
  });
  return fd;
}

async function main() {
  const getResp = await fetch(AGENAS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  const cookies = (getResp.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const h = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Referer': AGENAS_URL, 'Origin': 'https://ape.agenas.it', 'Cookie': cookies,
  };
  let $ = cheerio.load(await getResp.text());
  let hf = getHiddenFields($);

  // Search
  let fd = buildFormData($, hf);
  fd.set('ctl00$cphMain$Eventi1$ddlProfessione', '5');
  fd.set('__EVENTTARGET', ''); fd.set('__EVENTARGUMENT', '');
  fd.append('ctl00$cphMain$Eventi1$btnCerca', 'Cerca');

  let resp = await fetch(AGENAS_URL, { method: 'POST', headers: h, body: fd.toString() });
  let html = await resp.text();
  $ = cheerio.load(html);
  hf = getHiddenFields($);

  // Page 1 results
  const page1Ids = [];
  $('[id$="lbValoreEvento_0"]').each((_, el) => page1Ids.push($(el).text().trim()));
  console.log('PAGE 1 - First ID:', $('[id$="lbValoreEvento_0"]').text().trim(), ', Last ID:', $('[id$="lbValoreEvento_9"]').text().trim());

  // Click page 2 button by submitting the button's name
  console.log('\n=== CLICKING PAGE 2 BUTTON ===');
  fd = buildFormData($, hf);
  fd.set('__EVENTTARGET', '');
  fd.set('__EVENTARGUMENT', '');
  // The page 2 button name: ctl00$cphMain$Eventi1$DataPager1$ctl01$ctl01, value=2
  fd.append('ctl00$cphMain$Eventi1$DataPager1$ctl01$ctl01', '2');

  resp = await fetch(AGENAS_URL, { method: 'POST', headers: h, body: fd.toString() });
  html = await resp.text();
  $ = cheerio.load(html);
  hf = getHiddenFields($);
  
  let count = $('.lista').length;
  console.log('Page 2 results:', count);
  console.log('First ID:', $('[id$="lbValoreEvento_0"]').text().trim());
  console.log('First title:', $('[id$="lbTitoloEvento_0"]').text().trim().substring(0, 60));
  
  // Verify it's different from page 1
  const page2FirstId = $('[id$="lbValoreEvento_0"]').text().trim();
  console.log('Different from page 1?', page2FirstId !== page1Ids[0]);

  // Now try page 3 by clicking "Next" button (image)
  console.log('\n=== CLICKING NEXT (PAGE 3) ===');
  fd = buildFormData($, hf);
  fd.set('__EVENTTARGET', '');
  fd.set('__EVENTARGUMENT', '');
  fd.append('ctl00$cphMain$Eventi1$DataPager1$ctl02$ctl00.x', '10');
  fd.append('ctl00$cphMain$Eventi1$DataPager1$ctl02$ctl00.y', '10');

  resp = await fetch(AGENAS_URL, { method: 'POST', headers: h, body: fd.toString() });
  html = await resp.text();
  $ = cheerio.load(html);
  
  count = $('.lista').length;
  console.log('Page 3 results:', count);
  console.log('First ID:', $('[id$="lbValoreEvento_0"]').text().trim());
  console.log('Different from page 2?', $('[id$="lbValoreEvento_0"]').text().trim() !== page2FirstId);

  // Check pager state -- which page are we on?
  const pagerHtml = $('[id="cphMain_Eventi1_DataPager1"]').html();
  // Current page is a <span>, others are <input>
  const currentPage = $('[id="cphMain_Eventi1_DataPager1"] span').text().trim();
  console.log('Current page indicated:', currentPage);

  // Now the key question: how many total pages?
  // 1150 results / 10 per page = 115 pages
  console.log('\nTotal estimated pages:', Math.ceil(1150 / 10));
  
  // Can we go to page 21+ using the "..." button?
  console.log('\n=== CHECKING "..." BUTTON ===');
  // The "..." button is ctl00$cphMain$Eventi1$DataPager1$ctl01$ctl20 with value="..."
}

main().catch(console.error);
