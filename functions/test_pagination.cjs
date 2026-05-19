// Test AGENAS pagination: how to get all results beyond the first 10
const cheerio = require('cheerio');

const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';

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

function getHiddenFields($) {
  const fields = {};
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value') || '';
    if (name) fields[name] = val;
  });
  return fields;
}

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
  let $ = cheerio.load(getHtml);
  let hiddenFields = getHiddenFields($);

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Referer': AGENAS_URL,
    'Origin': 'https://ape.agenas.it',
    'Cookie': cookies,
  };

  // 2. Search for Psicologo (should give ~1000+ results)
  console.log('\n=== STEP 2: SEARCH Psicologo ===');
  let formData = buildFormData($, hiddenFields);
  formData.set('ctl00$cphMain$Eventi1$ddlProfessione', '5');
  formData.set('__EVENTTARGET', '');
  formData.set('__EVENTARGUMENT', '');
  formData.append('ctl00$cphMain$Eventi1$btnCerca', 'Cerca');

  let resp = await fetch(AGENAS_URL, { method: 'POST', headers, body: formData.toString() });
  let html = await resp.text();
  $ = cheerio.load(html);
  hiddenFields = getHiddenFields($);

  // Count results on page 1
  const page1Count = $('.lista').length;
  console.log('Page 1 results:', page1Count);

  // Look for total results count
  const totalText = $('[id*="lblTotEventi"], [id*="lblTotale"], [id*="lbTotale"]').text();
  console.log('Total results text:', totalText);
  
  // Search for text like "1151 eventi trovati" or similar
  const bodyText = $('body').text();
  const totalMatch = bodyText.match(/(\d+)\s*(eventi|risultat)/i);
  if (totalMatch) console.log('Found total:', totalMatch[0]);

  // 3. Look for pagination controls
  console.log('\n=== PAGINATION CONTROLS ===');
  
  // Check for ASP.NET DataPager/GridView pagination
  $('a[href*="Page"]').each((_, a) => {
    console.log(`  Link: href="${$(a).attr('href')}" text="${$(a).text().trim()}"`);
  });
  
  $('a[href*="__doPostBack"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const text = $(a).text().trim();
    if (text.match(/^\d+$/) || text.match(/^[.>»<«]/) || href.includes('Page') || href.includes('pag') || href.includes('Next') || href.includes('Prossim')) {
      console.log(`  Pager Link: href="${href}" text="${text}"`);
    }
  });

  // Check for specific pagination div/table
  console.log('\n  -- Checking for pager elements --');
  $('[class*="pag"], [class*="Pag"], [id*="pag"], [id*="Pag"], [class*="nav"], [id*="DataPager"]').each((_, el) => {
    const id = $(el).attr('id') || '';
    const cls = $(el).attr('class') || '';
    const text = $(el).text().trim().substring(0, 200);
    console.log(`  class="${cls}" id="${id}" text="${text}"`);
  });

  // Check for all __doPostBack links (look for page-related ones)
  console.log('\n  -- All postback links --');
  const postbackLinks = [];
  $('a[href*="__doPostBack"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const text = $(a).text().trim();
    // Extract event target from href
    const match = href.match(/__doPostBack\('([^']+)'/);
    if (match) {
      postbackLinks.push({ target: match[1], text });
    }
  });
  
  // Show unique targets
  const targets = [...new Set(postbackLinks.map(l => l.target))];
  targets.forEach(t => {
    const texts = postbackLinks.filter(l => l.target === t).map(l => l.text).join(', ');
    console.log(`  target="${t}" texts="${texts}"`);
  });

  // 4. Check for page size dropdown or total count label
  console.log('\n=== PAGE SIZE / TOTALS ===');
  $('select[id*="Page"], select[id*="page"], select[id*="size"], select[id*="Size"]').each((_, el) => {
    console.log(`  Page size select: id="${$(el).attr('id')}" name="${$(el).attr('name')}"`);
    $(el).find('option').each((_, opt) => {
      console.log(`    option: value="${$(opt).attr('value')}" text="${$(opt).text().trim()}" ${$(opt).attr('selected') ? 'SELECTED' : ''}`);
    });
  });

  // Check for hidden items per page fields
  $('[name*="PerPag"], [name*="PageSize"], [name*="pageSize"], [name*="perPage"]').each((_, el) => {
    console.log(`  Hidden page field: name="${$(el).attr('name')}" value="${$(el).attr('value')}"`);
  });

  // 5. Check how many total pages there are
  console.log('\n=== LOOKING FOR "PAGINA" or page numbers ===');
  const pageRegex = /pagina|page/gi;
  const allText = $('body').text();
  const pageMatches = allText.match(/.{0,50}(pagina|page).{0,50}/gi);
  if (pageMatches) {
    pageMatches.forEach(m => console.log(`  "${m.trim().replace(/\s+/g, ' ')}"`));
  }

  // 6. Try clicking "next page" if we found a target
  const nextPageTargets = targets.filter(t => t.includes('Next') || t.includes('Page$') || t.includes('pag'));
  if (nextPageTargets.length > 0) {
    console.log('\n=== TRYING NEXT PAGE ===');
    console.log('Target:', nextPageTargets[0]);
    
    formData = buildFormData($, hiddenFields);
    formData.set('__EVENTTARGET', nextPageTargets[0]);
    formData.set('__EVENTARGUMENT', '');
    
    resp = await fetch(AGENAS_URL, { method: 'POST', headers, body: formData.toString() });
    html = await resp.text();
    $ = cheerio.load(html);
    
    const page2Count = $('.lista').length;
    console.log('Page 2 results:', page2Count);
    
    // First event title on page 2
    const firstTitle = $('[id$="lbTitoloEvento_0"]').text().trim();
    console.log('First event on page 2:', firstTitle.substring(0, 80));
  } else {
    // Maybe all results are on one page? Or pagination uses different mechanism
    console.log('\nNo pagination targets found. All', page1Count, 'results on one page?');
    
    // Check if there's a "show all" option or the page just has 10
    console.log('Checking for ResultTable repeater count...');
    let maxIdx = -1;
    $('[id*="ResultTable"]').each((_, el) => {
      const id = $(el).attr('id') || '';
      const m = id.match(/_(\d+)$/);
      if (m) maxIdx = Math.max(maxIdx, parseInt(m[1]));
    });
    console.log('Max event index found:', maxIdx);
  }
}

main().catch(console.error);
