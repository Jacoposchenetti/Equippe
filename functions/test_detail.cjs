// Test if DettaglioEvento.aspx can be accessed directly,
// and follow the redirect to see the detail page content
const cheerio = require('cheerio');

const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';
const DETAIL_URL = 'https://ape.agenas.it/Tools/DettaglioEvento.aspx';

async function main() {
  // === TEST 1: Try direct access to DettaglioEvento.aspx ===
  console.log('=== TEST 1: Direct access to DettaglioEvento.aspx ===');
  const directResp = await fetch(DETAIL_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    redirect: 'manual',
  });
  console.log('Direct status:', directResp.status);
  if (directResp.status >= 300 && directResp.status < 400) {
    console.log('Redirect:', directResp.headers.get('location'));
  } else {
    const html = await directResp.text();
    const $ = cheerio.load(html);
    console.log('Title:', $('title').text());
    console.log('Body text (first 500):', $('body').text().trim().substring(0, 500));
  }

  // === TEST 2: Try with query params ===
  console.log('\n=== TEST 2: DettaglioEvento.aspx?IdEvento=453313 ===');
  const paramResp = await fetch(`${DETAIL_URL}?IdEvento=453313`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    redirect: 'manual',
  });
  console.log('Param status:', paramResp.status);
  if (paramResp.status >= 300 && paramResp.status < 400) {
    console.log('Redirect:', paramResp.headers.get('location'));
  } else {
    const html = await paramResp.text();
    const $ = cheerio.load(html);
    console.log('Title:', $('title').text());
    const bodyText = $('body').text().trim().substring(0, 500);
    console.log('Body:', bodyText);
  }

  // === TEST 3: Full flow - search, click detail, follow redirect with cookies ===
  console.log('\n=== TEST 3: Full flow with session cookies ===');
  
  // Step 1: GET
  const getResp = await fetch(AGENAS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  const cookies = (getResp.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const getHtml = await getResp.text();
  const $ = cheerio.load(getHtml);
  
  // Step 2: Search
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

  const baseHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Referer': AGENAS_URL,
    'Origin': 'https://ape.agenas.it',
    'Cookie': cookies,
  };

  const searchResp = await fetch(AGENAS_URL, {
    method: 'POST',
    headers: baseHeaders,
    body: formData.toString(),
  });
  const searchHtml = await searchResp.text();
  const $r = cheerio.load(searchHtml);
  
  // Capture new cookies if any
  const searchCookies = searchResp.headers.getSetCookie?.() || [];
  let allCookies = cookies;
  if (searchCookies.length > 0) {
    allCookies = [...new Set([...cookies.split('; '), ...searchCookies.map(c => c.split(';')[0])])].join('; ');
  }
  
  // Step 3: Click Dettaglio
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
  detailForm.set('__EVENTTARGET', '');
  detailForm.set('__EVENTARGUMENT', '');
  detailForm.append('ctl00$cphMain$Eventi1$ResultTable$ctrl0$ibDettaglioEvento.x', '10');
  detailForm.append('ctl00$cphMain$Eventi1$ResultTable$ctrl0$ibDettaglioEvento.y', '10');

  const detailResp = await fetch(AGENAS_URL, {
    method: 'POST',
    headers: { ...baseHeaders, Cookie: allCookies },
    body: detailForm.toString(),
    redirect: 'manual',
  });
  
  console.log('Detail click status:', detailResp.status);
  const detailLocation = detailResp.headers.get('location');
  console.log('Detail redirect to:', detailLocation);
  
  // Capture redirect cookies
  const detailCookies = detailResp.headers.getSetCookie?.() || [];
  if (detailCookies.length > 0) {
    allCookies = [...new Set([...allCookies.split('; '), ...detailCookies.map(c => c.split(';')[0])])].join('; ');
  }
  
  // Step 4: Follow redirect to detail page
  if (detailLocation) {
    const fullUrl = new URL(detailLocation, 'https://ape.agenas.it').href;
    console.log('Following redirect to:', fullUrl);
    
    const detailPageResp = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Cookie': allCookies,
        'Referer': AGENAS_URL,
      },
    });
    
    console.log('Detail page status:', detailPageResp.status);
    const detailPageHtml = await detailPageResp.text();
    const $d = cheerio.load(detailPageHtml);
    console.log('Title:', $d('title').text());
    console.log('HTML length:', detailPageHtml.length);
    
    // Check for event details
    console.log('\n--- DETAIL PAGE STRUCTURE ---');
    
    // Look for all spans with event data
    $d('[id*="cphMain"]').each((_, el) => {
      const id = $d(el).attr('id') || '';
      const text = $d(el).text().trim();
      if (text && text.length < 200 && id.includes('lb')) {
        console.log(`  ${id}: "${text}"`);
      }
    });
    
    // Look for section headers / key content
    console.log('\n--- KEY SECTIONS ---');
    $d('.DettaglioInformazioni, .headerLista, .dettaglio, [class*="detail"], [class*="Dettaglio"]').each((_, el) => {
      const cls = $d(el).attr('class');
      console.log(`  class="${cls}" text="${$d(el).text().trim().substring(0, 200)}"`);
    });
    
    // Dump body text (first 3000 chars)
    console.log('\n--- BODY TEXT (first 3000) ---');
    console.log($d('body').text().replace(/\s+/g, ' ').trim().substring(0, 3000));
  }
}

main().catch(console.error);
