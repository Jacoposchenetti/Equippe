// Test Dettaglio Evento and Scarica Programma postback buttons
const cheerio = require('cheerio');

const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';

async function main() {
  // 1. GET page
  console.log('=== STEP 1: GET page ===');
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
  console.log('GET OK, HTML:', getHtml.length);

  // 2. Search for Psicologo
  console.log('\n=== STEP 2: SEARCH Psicologo ===');
  const formData = new URLSearchParams();
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name'); const val = $(el).attr('value') || '';
    if (name) formData.append(name, val);
  });
  $('input[type="text"]').each((_, el) => {
    const name = $(el).attr('name'); const val = $(el).attr('value') || '';
    if (name) formData.append(name, val);
  });
  $('select').each((_, el) => {
    const name = $(el).attr('name'); const optCount = $(el).find('option').length;
    if (!name || optCount === 0) return;
    const selected = $(el).find('option[selected]').attr('value');
    const firstOpt = $(el).find('option').first().attr('value');
    formData.append(name, selected || firstOpt || '');
  });
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
    redirect: 'manual', // Don't follow redirects
  });
  const searchHtml = await searchResp.text();
  const $r = cheerio.load(searchHtml);
  console.log('Search status:', searchResp.status, 'HTML:', searchHtml.length);

  // Get first event ID
  const eventId = $r('#cphMain_Eventi1_ResultTable_lbValoreEvento_0').text().trim();
  console.log('First event ID:', eventId);

  // 3. Click "Dettaglio Evento" on first result
  console.log('\n=== STEP 3: CLICK Dettaglio Evento (event 0) ===');
  
  // Rebuild form data from search results page
  const detailForm = new URLSearchParams();
  $r('input[type="hidden"]').each((_, el) => {
    const name = $r(el).attr('name'); const val = $r(el).attr('value') || '';
    if (name) detailForm.append(name, val);
  });
  $r('input[type="text"]').each((_, el) => {
    const name = $r(el).attr('name'); const val = $r(el).attr('value') || '';
    if (name) detailForm.append(name, val);
  });
  $r('select').each((_, el) => {
    const name = $r(el).attr('name'); const optCount = $r(el).find('option').length;
    if (!name || optCount === 0) return;
    const selected = $r(el).find('option[selected]').attr('value');
    const firstOpt = $r(el).find('option').first().attr('value');
    detailForm.append(name, selected || firstOpt || '');
  });
  
  // Set the event target to the detail button of event 0
  detailForm.set('__EVENTTARGET', 'ctl00$cphMain$Eventi1$ResultTable$ctrl0$ibDettaglioEvento');
  detailForm.set('__EVENTARGUMENT', '');
  // Also add the image button coordinates (ASP.NET expects x,y for image buttons)
  detailForm.append('ctl00$cphMain$Eventi1$ResultTable$ctrl0$ibDettaglioEvento.x', '10');
  detailForm.append('ctl00$cphMain$Eventi1$ResultTable$ctrl0$ibDettaglioEvento.y', '10');

  const detailResp = await fetch(AGENAS_URL, {
    method: 'POST',
    headers,
    body: detailForm.toString(),
    redirect: 'manual',
  });
  
  console.log('Detail response status:', detailResp.status);
  console.log('Detail response headers:');
  for (const [key, value] of detailResp.headers.entries()) {
    console.log(`  ${key}: ${value}`);
  }
  
  if (detailResp.status >= 300 && detailResp.status < 400) {
    console.log('REDIRECT to:', detailResp.headers.get('location'));
  } else {
    const detailHtml = await detailResp.text();
    console.log('Detail HTML length:', detailHtml.length);
    // Check if it's a different page
    const $d = cheerio.load(detailHtml);
    console.log('Page title:', $d('title').text());
    // Look for the event detail content
    console.log('Has detail panel:', $d('[id*="DettaglioEvento"], [id*="dettaglio"], .dettaglio').length > 0);
    // Check URL in any meta refresh or JavaScript redirect
    const metaRefresh = $d('meta[http-equiv="refresh"]').attr('content');
    if (metaRefresh) console.log('Meta refresh:', metaRefresh);
    
    // Look for detail-specific content in first 5000 chars
    console.log('\nFirst 3000 chars of detail page body:');
    console.log($d('body').text().substring(0, 3000));
  }

  // 4. Now try "Scarica Programma" on first result
  console.log('\n\n=== STEP 4: CLICK Scarica Programma (event 0) ===');
  
  const pdfForm = new URLSearchParams();
  $r('input[type="hidden"]').each((_, el) => {
    const name = $r(el).attr('name'); const val = $r(el).attr('value') || '';
    if (name) pdfForm.append(name, val);
  });
  $r('input[type="text"]').each((_, el) => {
    const name = $r(el).attr('name'); const val = $r(el).attr('value') || '';
    if (name) pdfForm.append(name, val);
  });
  $r('select').each((_, el) => {
    const name = $r(el).attr('name'); const optCount = $r(el).find('option').length;
    if (!name || optCount === 0) return;
    const selected = $r(el).find('option[selected]').attr('value');
    const firstOpt = $r(el).find('option').first().attr('value');
    pdfForm.append(name, selected || firstOpt || '');
  });
  
  pdfForm.set('__EVENTTARGET', 'ctl00$cphMain$Eventi1$ResultTable$ctrl0$ibProgramma');
  pdfForm.set('__EVENTARGUMENT', '');
  pdfForm.append('ctl00$cphMain$Eventi1$ResultTable$ctrl0$ibProgramma.x', '10');
  pdfForm.append('ctl00$cphMain$Eventi1$ResultTable$ctrl0$ibProgramma.y', '10');

  const pdfResp = await fetch(AGENAS_URL, {
    method: 'POST',
    headers: {
      ...headers,
      'Accept': '*/*',
    },
    body: pdfForm.toString(),
    redirect: 'manual',
  });
  
  console.log('PDF response status:', pdfResp.status);
  console.log('PDF response headers:');
  for (const [key, value] of pdfResp.headers.entries()) {
    console.log(`  ${key}: ${value}`);
  }
  
  if (pdfResp.status >= 300 && pdfResp.status < 400) {
    console.log('REDIRECT to:', pdfResp.headers.get('location'));
  } else {
    const contentType = pdfResp.headers.get('content-type');
    const contentDisposition = pdfResp.headers.get('content-disposition');
    console.log('Content-Type:', contentType);
    console.log('Content-Disposition:', contentDisposition);
    
    if (contentType?.includes('pdf')) {
      const buffer = await pdfResp.arrayBuffer();
      console.log('PDF size:', buffer.byteLength, 'bytes');
    } else {
      const text = await pdfResp.text();
      console.log('Response text length:', text.length);
      console.log('First 1000 chars:', text.substring(0, 1000));
    }
  }
}

main().catch(console.error);
