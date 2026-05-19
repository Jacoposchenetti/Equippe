// Quick test: how many total events with NO filter?
const cheerio = require('cheerio');
const AGENAS_URL = 'https://ape.agenas.it/Tools/Eventi.aspx';

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
  const hf = {};
  $('input[type="hidden"]').each((_, el) => { const n = $(el).attr('name'); if (n) hf[n] = $(el).attr('value') || ''; });

  const fd = new URLSearchParams();
  for (const [n, v] of Object.entries(hf)) fd.append(n, v);
  $('input[type="text"]').each((_, el) => { const n = $(el).attr('name'); if (n) fd.append(n, $(el).attr('value') || ''); });
  $('select').each((_, el) => {
    const n = $(el).attr('name'), c = $(el).find('option').length;
    if (!n || c === 0) return;
    fd.append(n, $(el).find('option[selected]').attr('value') || $(el).find('option').first().attr('value') || '');
  });
  fd.set('__EVENTTARGET', ''); fd.set('__EVENTARGUMENT', '');
  fd.append('ctl00$cphMain$Eventi1$btnCerca', 'Cerca');

  // Search with NO filter at all
  console.log('=== SEARCH: NO FILTER ===');
  let resp = await fetch(AGENAS_URL, { method: 'POST', headers: h, body: fd.toString() });
  let html = await resp.text();
  $ = cheerio.load(html);
  
  const totalMatch = $('body').text().match(/(\d+)\s*Risultat/i);
  console.log('Total results (no filter):', totalMatch ? totalMatch[1] : 'not found');
  console.log('Page 1 items:', $('.lista').length);

  // Count total profession options
  console.log('\n=== PROFESSIONS ===');
  const professions = [];
  $('select[name*="ddlProfessione"] option').each((_, el) => {
    const v = $(el).attr('value') || '';
    const l = $(el).text().trim();
    if (v && v !== '-1') professions.push({ v, l });
  });
  console.log('Total professions:', professions.length);
  professions.forEach(p => console.log(`  ${p.v}: ${p.l}`));
}

main().catch(console.error);
