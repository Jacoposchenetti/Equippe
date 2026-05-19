// Deep inspect the DataPager and try to navigate pages
const cheerio = require('cheerio');

const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';

function getHiddenFields($) {
  const fields = {};
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) fields[name] = val;
  });
  return fields;
}

function buildFormData($, hiddenFields) {
  const formData = new URLSearchParams();
  for (const [name, val] of Object.entries(hiddenFields)) {
    formData.append(name, val);
  }
  $('input[type="text"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) formData.append(name, val);
  });
  $('select').each((_, el) => {
    const name = $(el).attr('name');
    const optCount = $(el).find('option').length;
    if (!name || optCount === 0) return;
    const selected = $(el).find('option[selected]').attr('value');
    const firstOpt = $(el).find('option').first().attr('value');
    formData.append(name, selected || firstOpt || '');
  });
  return formData;
}

const headers = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Referer': AGENAS_URL,
  'Origin': 'https://ape.agenas.it',
};

async function main() {
  // GET
  const getResp = await fetch(AGENAS_URL, {
    headers: { 'User-Agent': headers['User-Agent'], Accept: 'text/html,application/xhtml+xml' },
  });
  const cookies = (getResp.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  headers['Cookie'] = cookies;
  let $ = cheerio.load(await getResp.text());
  let hiddenFields = getHiddenFields($);

  // Search
  let formData = buildFormData($, hiddenFields);
  formData.set('ctl00$cphMain$Eventi1$ddlProfessione', '5');
  formData.set('__EVENTTARGET', '');
  formData.set('__EVENTARGUMENT', '');
  formData.append('ctl00$cphMain$Eventi1$btnCerca', 'Cerca');

  let resp = await fetch(AGENAS_URL, { method: 'POST', headers, body: formData.toString() });
  let html = await resp.text();
  $ = cheerio.load(html);
  hiddenFields = getHiddenFields($);

  // Inspect pager area deeply
  console.log('=== PAGER HTML ===');
  const pagerPanel = $('[id="cphMain_Eventi1_pnlPaginazione"]');
  console.log('Pager panel outer HTML:');
  console.log(pagerPanel.html());

  console.log('\n=== DataPager1 HTML ===');
  const dataPager = $('[id="cphMain_Eventi1_DataPager1"]');
  console.log(dataPager.html());

  // Check all elements inside pager
  console.log('\n=== All elements in pager ===');
  pagerPanel.find('*').each((_, el) => {
    const tag = el.tagName;
    const id = $(el).attr('id') || '';
    const cls = $(el).attr('class') || '';
    const name = $(el).attr('name') || '';
    const text = $(el).text().trim().substring(0, 100);
    const href = $(el).attr('href') || '';
    console.log(`  <${tag}> id="${id}" class="${cls}" name="${name}" href="${href}" text="${text}"`);
  });

  // Look for total events count pattern
  console.log('\n=== TOTAL COUNT ===');
  // The "1150 Risultati" text - where is it exactly?
  $('span, div, label').each((_, el) => {
    const text = $(el).text().trim();
    if (text.match(/\d{3,}/) && text.match(/risultat|eventi|trovati|totale/i)) {
      console.log(`  id="${$(el).attr('id') || ''}" text="${text.substring(0, 200)}"`);
    }
  });

  // Try: use EVENTARGUMENT to navigate pages
  // ASP.NET DataPager often uses __EVENTARGUMENT='Page$N'
  console.log('\n=== TRYING PAGE NAVIGATION ===');
  
  // Method 1: __EVENTTARGET = DataPager with page argument
  console.log('\n--- Method 1: DataPager postback ---');
  formData = buildFormData($, hiddenFields);
  formData.set('__EVENTTARGET', 'ctl00$cphMain$Eventi1$DataPager1');
  formData.set('__EVENTARGUMENT', '2');
  
  resp = await fetch(AGENAS_URL, { method: 'POST', headers, body: formData.toString() });
  html = await resp.text();
  let $p = cheerio.load(html);
  let count = $p('.lista').length;
  console.log('Method 1 results:', count);
  if (count > 0) {
    console.log('First event:', $p('[id$="lbTitoloEvento_0"]').text().trim().substring(0, 80));
    console.log('First ID:', $p('[id$="lbValoreEvento_0"]').text().trim());
  }

  if (count === 0) {
    // Method 2: Try with ResultTable
    console.log('\n--- Method 2: ResultTable postback ---');
    formData = buildFormData($, hiddenFields);
    formData.set('__EVENTTARGET', 'ctl00$cphMain$Eventi1$ResultTable');
    formData.set('__EVENTARGUMENT', 'Page$2');
    
    resp = await fetch(AGENAS_URL, { method: 'POST', headers, body: formData.toString() });
    html = await resp.text();
    $p = cheerio.load(html);
    count = $p('.lista').length;
    console.log('Method 2 results:', count);
    if (count > 0) {
      console.log('First event:', $p('[id$="lbTitoloEvento_0"]').text().trim().substring(0, 80));
      console.log('First ID:', $p('[id$="lbValoreEvento_0"]').text().trim());
    }
  }

  if (count === 0) {
    // Method 3: ASYNCPOSTBACK with ScriptManager
    console.log('\n--- Method 3: ScriptManager async postback ---');
    formData = buildFormData($, hiddenFields);
    formData.set('ctl00$ScriptManager', 'ctl00$cphMain$Eventi1$UpdatePanel1|ctl00$cphMain$Eventi1$DataPager1');
    formData.set('__EVENTTARGET', 'ctl00$cphMain$Eventi1$DataPager1');
    formData.set('__EVENTARGUMENT', '2');
    formData.set('__ASYNCPOST', 'true');
    
    resp = await fetch(AGENAS_URL, { 
      method: 'POST', 
      headers: { ...headers, 'X-Requested-With': 'XMLHttpRequest', 'X-MicrosoftAjax': 'Delta=true' }, 
      body: formData.toString() 
    });
    html = await resp.text();
    console.log('Method 3 response length:', html.length);
    console.log('First 500 chars:', html.substring(0, 500));
    
    // Check if it contains event data
    $p = cheerio.load(html);
    count = $p('.lista').length;
    console.log('Method 3 results:', count);
  }

  if (count === 0) {
    // Method 4: Try Page$Next
    console.log('\n--- Method 4: Page$Next ---');
    formData = buildFormData($, hiddenFields);
    formData.set('__EVENTTARGET', 'ctl00$cphMain$Eventi1$DataPager1');
    formData.set('__EVENTARGUMENT', 'Page$Next');
    
    resp = await fetch(AGENAS_URL, { method: 'POST', headers, body: formData.toString() });
    html = await resp.text();
    $p = cheerio.load(html);
    count = $p('.lista').length;
    console.log('Method 4 results:', count);
    if (count > 0) {
      console.log('First event:', $p('[id$="lbTitoloEvento_0"]').text().trim().substring(0, 80));
    }
  }
}

main().catch(console.error);
