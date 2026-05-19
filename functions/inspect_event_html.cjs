// Inspect AGENAS event result HTML to find Dettaglio/PDF links
const cheerio = require('cheerio');

const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';

async function main() {
  // 1. GET page
  const getResp = await fetch(AGENAS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'it-IT,it;q=0.9',
    },
  });
  const cookies = (getResp.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const getHtml = await getResp.text();
  const $ = cheerio.load(getHtml);

  // 2. Build form data
  const formData = new URLSearchParams();
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) formData.append(name, val);
  });
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

  // Set Psicologo and search
  formData.set('ctl00$cphMain$Eventi1$ddlProfessione', '5');
  formData.set('__EVENTTARGET', '');
  formData.set('__EVENTARGUMENT', '');
  formData.append('ctl00$cphMain$Eventi1$btnCerca', 'Cerca');

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Referer': AGENAS_URL,
    'Origin': 'https://ape.agenas.it',
  };
  if (cookies) headers['Cookie'] = cookies;

  const searchResp = await fetch(AGENAS_URL, {
    method: 'POST',
    headers,
    body: formData.toString(),
  });
  const searchHtml = await searchResp.text();
  const $r = cheerio.load(searchHtml);

  // 3. Inspect first 3 .lista divs fully
  const listaItems = $r('.lista');
  console.log(`Found ${listaItems.length} .lista items\n`);

  listaItems.slice(0, 3).each((i, el) => {
    console.log(`\n========== EVENT ${i} ==========`);
    const item = $r(el);
    
    // Dump the full HTML of this event
    const html = item.html();
    console.log('FULL HTML:');
    console.log(html);
    
    // Look for all links
    console.log('\n--- ALL LINKS ---');
    item.find('a').each((_, a) => {
      console.log(`  href="${$r(a).attr('href')}" text="${$r(a).text().trim()}" id="${$r(a).attr('id') || ''}" onclick="${$r(a).attr('onclick') || ''}"`);
    });
    
    // Look for all buttons/inputs of type submit/button
    console.log('\n--- ALL BUTTONS/INPUTS ---');
    item.find('input[type="submit"], input[type="button"], button').each((_, btn) => {
      console.log(`  name="${$r(btn).attr('name')}" value="${$r(btn).attr('value')}" id="${$r(btn).attr('id') || ''}" onclick="${$r(btn).attr('onclick') || ''}"`);
    });
    
    // Look for anything with "dettaglio" or "programma" or "pdf"
    console.log('\n--- DETTAGLIO/PROGRAMMA matches ---');
    item.find('[id*="Dettaglio"], [id*="dettaglio"], [id*="Programma"], [id*="programma"], [id*="pdf"], [id*="PDF"]').each((_, el2) => {
      console.log(`  tag=${el2.tagName} id="${$r(el2).attr('id')}" href="${$r(el2).attr('href') || ''}" text="${$r(el2).text().trim().substring(0, 100)}"`);
    });
    
    // Also check for image buttons (common in ASP.NET)
    console.log('\n--- IMAGE BUTTONS ---');
    item.find('input[type="image"], img[onclick]').each((_, img) => {
      console.log(`  name="${$r(img).attr('name')}" src="${$r(img).attr('src')}" alt="${$r(img).attr('alt')}" onclick="${$r(img).attr('onclick') || ''}"`);
    });
  });

  // Also check for links outside .lista that might be detail page patterns
  console.log('\n\n========== CHECKING PAGE FOR DettaglioEvento PATTERNS ==========');
  $r('a[href*="Dettaglio"], a[href*="dettaglio"], a[href*="Evento"], a[href*="evento"]').each((_, a) => {
    console.log(`  href="${$r(a).attr('href')}" text="${$r(a).text().trim().substring(0, 80)}"`);
  });
  
  // Check for any onclick with postback containing "Dettaglio" or "Programma"
  console.log('\n========== ONCLICK PATTERNS ==========');
  $r('[onclick*="Dettaglio"], [onclick*="Programma"], [onclick*="programma"]').each((_, el2) => {
    console.log(`  tag=${el2.tagName} id="${$r(el2).attr('id')}" onclick="${$r(el2).attr('onclick')}"`);
  });

  // Check for JavaScript postback links in hrefs
  console.log('\n========== JAVASCRIPT POSTBACK LINKS ==========');
  $r('a[href*="__doPostBack"]').slice(0, 10).each((_, a) => {
    console.log(`  href="${$r(a).attr('href')}" text="${$r(a).text().trim().substring(0, 80)}" id="${$r(a).attr('id') || ''}"`);
  });
}

main().catch(console.error);
