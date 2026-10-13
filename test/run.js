#!/usr/bin/env node
/* Regresní testy PEBMedia Protect.
 * Spuštění: node test/run.js
 * Běží lokálně v Node, bez API a bez síťového připojení. Při selhání končí kódem 1.
 * Testy se sporným očekáváním (review: true) se vypíší zvlášť a neovlivní výsledek.
 */
'use strict';
const path = require('path');
const A = require('../assets/analyzer.js');
let R = null, G = null;
try { R = require('../assets/report.js'); } catch (e) { R = null; }
try { G = require('../assets/guides.js'); } catch (e) { G = null; }

const messages = require('./cases/messages.js');
const urls = require('./cases/urls.js');
const answers = require('./cases/answers.js');
const ocr = require('./cases/ocr.js');
const emails = require('./cases/emails.js');

const LEVELS = { low: 0, mid: 1, high: 2 };
const results = { pass: 0, fail: 0, review: [] };
const failures = [];

function matchLevel(expect, level) {
  if (expect === 'notLow') return level !== 'low';
  if (expect === 'notHigh') return level !== 'high';
  return expect === level;
}
function codesOf(a) {
  const c = new Set();
  a.textFindings.forEach(f => c.add(f.rule || f.code));
  a.urls.forEach(u => u.findings.forEach(f => c.add(f.code)));
  return c;
}
function record(group, c, ok, detail) {
  if (ok) { results.pass++; return; }
  if (c.review) { results.review.push({ group, id: c.id || c.url, detail, why: c.why }); return; }
  results.fail++;
  failures.push({ group, id: c.id || c.url, detail, why: c.why });
}
function levelFromScore(score) { return score >= 55 ? 'high' : (score >= 25 ? 'mid' : 'low'); }

/* ---------- 1. Zprávy ---------- */
const byId = {};
messages.forEach(c => { byId[c.id] = c; });
for (const c of messages) {
  const a = A.analyze(c.input);
  const e = A.evaluate(a, {});
  const codes = codesOf(a);
  const missing = (c.codes || []).filter(x => !codes.has(x));
  const consistent = levelFromScore(e.score) === e.level;
  const ok = matchLevel(c.expect, e.level) && !missing.length && consistent;
  record('zprávy', c, ok, {
    vstup: c.input, očekáváno: c.expect, výsledek: e.level + ' (skóre ' + e.score + ')',
    chybí_vysvětlení: missing.length ? missing : undefined,
    nekonzistentní_skóre: consistent ? undefined : true,
    nalezeno: [...codes].join(', ') || 'nic'
  });
}

/* ---------- 2. Odkazy ---------- */
for (const c of urls) {
  const found = A.findUrls('Odkaz: ' + c.url + ' konec');
  let ok, detail;
  if (c.expect === 'none') {
    ok = found.length === 0;
    detail = { vstup: c.url, očekáváno: 'žádný odkaz', výsledek: found.map(f => f.raw).join(', ') };
  } else {
    const u = found.length ? A.analyzeUrl(found[0].raw) : null;
    if (!u) { ok = false; detail = { vstup: c.url, očekáváno: c.expect, výsledek: 'odkaz nenalezen' }; }
    else {
      const sev = u.findings.map(f => f.sev);
      const hasHigh = sev.includes('high');
      const hasMid = hasHigh || sev.includes('mid');
      const codes = new Set(u.findings.map(f => f.code));
      const missing = (c.codes || []).filter(x => !codes.has(x));
      const lvl = { official: u.official && !hasMid, safe: !hasMid, suspicious: hasMid, high: hasHigh }[c.expect];
      ok = lvl && !missing.length;
      detail = { vstup: c.url, očekáváno: c.expect, výsledek: (u.official ? 'oficiální, ' : '') + (u.findings.map(f => f.sev + ':' + f.code).join(', ') || 'bez nálezu'),
        chybí_vysvětlení: missing.length ? missing : undefined };
    }
  }
  record('odkazy', c, ok, detail);
}

/* ---------- 3. Odpovědi na otázky ---------- */
for (const c of answers) {
  const m = byId[c.msg];
  if (!m) { record('odpovědi', c, false, { chyba: 'neznámá zpráva ' + c.msg }); continue; }
  const a = A.analyze(m.input);
  const asked = A.questionsFor(a).map(q => q.id);
  const e = A.evaluate(a, c.answers);
  const consistent = levelFromScore(e.score) === e.level;
  const missAsk = (c.mustAsk || []).filter(q => !asked.includes(q));
  const badAsk = (c.mustNotAsk || []).filter(q => asked.includes(q));
  const ok = matchLevel(c.expect, e.level) && consistent && !missAsk.length && !badAsk.length;
  record('odpovědi', c, ok, {
    vstup: m.input, odpovědi: JSON.stringify(c.answers), očekáváno: c.expect, výsledek: e.level + ' (skóre ' + e.score + ')',
    nekonzistentní_skóre: consistent ? undefined : true,
    chybí_otázka: missAsk.length ? missAsk : undefined, zbytečná_otázka: badAsk.length ? badAsk : undefined
  });
}

/* ---------- 3b. Invarianty: odpovědi nikdy nesmí sestřelit zásadní signály ---------- */
const HARD = ['payment', 'credentials', 'remote', 'bankstaff', 'marketplace'];
for (const m of messages) {
  const a = A.analyze(m.input);
  const base = A.evaluate(a, {});
  const qs = A.questionsFor(a);
  // nejvíce uklidňující kombinace odpovědí (nejnižší delta u každé otázky)
  const calm = {};
  qs.forEach(q => { const best = q.options.slice().sort((x, y) => x.delta - y.delta)[0]; calm[q.id] = best.v; });
  const e = A.evaluate(a, calm);
  const codes = codesOf(a);
  const hard = HARD.filter(h => codes.has(h));
  const urlHigh = a.urls.some(u => u.findings.some(f => f.sev === 'high'));
  let ok = levelFromScore(e.score) === e.level;
  if (urlHigh) ok = ok && e.level === 'high';
  else if (hard.length && base.level !== 'low') ok = ok && e.level !== 'low';
  record('invarianty', { id: m.id + ' + nejklidnější odpovědi', why: 'Odpovědi nesmí odstranit zásadní signály: ' + (urlHigh ? 'falešný odkaz' : hard.join(', ') || 'žádné') }, ok, {
    vstup: m.input, odpovědi: JSON.stringify(calm), před: base.level, po: e.level + ' (skóre ' + e.score + ')'
  });
}

/* ---------- 4. OCR: normalizace a čitelnost ---------- */
for (const c of ocr.normalize) {
  if (typeof A.normalizeOcrText !== 'function') { record('ocr', c, false, { chyba: 'chybí A.normalizeOcrText' }); continue; }
  const out = A.normalizeOcrText(c.input);
  let ok;
  if (c.mustEqual !== undefined) ok = out === c.mustEqual;
  else ok = A.findUrls(out).some(u => { const x = A.analyzeUrl(u.raw); return x && x.ascii.indexOf(c.mustContainUrl) !== -1 && x.registrable === c.mustContainUrl; });
  record('ocr', c, ok, { vstup: JSON.stringify(c.input), výsledek: JSON.stringify(out) });
}
for (const c of ocr.readability) {
  if (typeof A.assessOcr !== 'function') { record('ocr', c, false, { chyba: 'chybí A.assessOcr' }); continue; }
  const r = A.assessOcr(c.text, c.confidence);
  record('ocr', c, r.readable === c.readable, { vstup: c.text.slice(0, 60) + '…', jistota: c.confidence, očekáváno: c.readable, výsledek: JSON.stringify(r) });
}

/* ---------- 5. Podklady pro policii ---------- */
function reportCase(id, why, fn) {
  let ok = false, detail = {};
  try {
    if (!R) throw new Error('chybí assets/report.js');
    const res = fn();
    ok = res.ok; detail = res.detail || {};
  } catch (e) { detail = { chyba: e.message }; }
  record('oznámení', { id, why }, ok, detail);
}
const base = { kind: 'attempt', channel: 'přes SMS', region: 'krpl', createdAt: new Date(2026, 9, 13) };
reportCase('bez-data-udalosti', 'Datum události se nesmí doplnit samo.', () => {
  const r = R.build(Object.assign({}, base));
  return { ok: !/Dne 13\. 10\. 2026/.test(r.text) && /neuvedeno|nevím/i.test(r.text.split('Co se stalo')[1] || ''), detail: { text: r.text.slice(0, 400) } };
});
reportCase('bez-kraje', 'Bez zvoleného kraje se oznámení nesestaví.', () => {
  const r = R.build(Object.assign({}, base, { region: '' }));
  return { ok: !!r.error && r.error === 'region', detail: { výsledek: JSON.stringify(r).slice(0, 200) } };
});
reportCase('adresa-kraje', 'Adresa podatelny odpovídá kraji (policie.gov.cz/e-podatelna).', () => {
  const r = R.build(Object.assign({}, base, { region: 'krpa' }));
  return { ok: r.address === 'krpa.podatelna@policie.gov.cz', detail: { adresa: r.address } };
});
reportCase('dukazy-nepotvrzene', 'Bez potvrzení se v textu netvrdí, že oznamovatel má důkazy.', () => {
  const r = R.build(Object.assign({}, base, { evidence: {} }));
  return { ok: !/snímky obrazovky/i.test(r.text), detail: { text: r.text.slice(-300) } };
});
reportCase('dukazy-potvrzene', 'Potvrzené důkazy se v textu uvedou.', () => {
  const r = R.build(Object.assign({}, base, { evidence: { screens: true } }));
  return { ok: /snímky obrazovky/i.test(r.text), detail: { text: r.text.slice(-300) } };
});
reportCase('dlouhy-text', 'Dlouhý text se nesmí tiše zkrátit.', () => {
  const msg = 'X'.repeat(5000) + ' KONEC';
  const r = R.build(Object.assign({}, base, { msg }));
  const m = R.mailto(r.address, r.subject, r.text);
  return { ok: r.text.indexOf('KONEC') !== -1 && m.includesBody === false && m.href.indexOf('KONEC') === -1, detail: { includesBody: m.includesBody, délka: r.text.length } };
});
reportCase('kratky-text-mailto', 'Krátký text může jít celý do e-mailu.', () => {
  const r = R.build(Object.assign({}, base, { desc: 'Krátký popis.' }));
  const m = R.mailto(r.address, r.subject, r.text);
  return { ok: m.includesBody === true && decodeURIComponent(m.href).indexOf('Krátký popis.') !== -1, detail: { includesBody: m.includesBody } };
});
reportCase('zadne-odeslano', 'Text oznámení netvrdí, že bylo odesláno.', () => {
  const r = R.build(Object.assign({}, base));
  return { ok: !/odeslán[oa] (policii|na policii)|bylo odesláno/i.test(r.text), detail: {} };
});


/* ---------- 6. E-mail ---------- */
for (const c of emails) {
  if (typeof A.analyzeEmail !== 'function') { record('e-mail', c, false, { chyba: 'chybí A.analyzeEmail' }); continue; }
  const a = A.analyzeEmail(c.email);
  const e = A.evaluate(a, {});
  const codes = codesOf(a);
  const missing = (c.codes || []).filter(x => !codes.has(x));
  const forbidden = (c.noCodes || []).filter(x => codes.has(x));
  const allText = a.textFindings.map(f => f.title + ' ' + f.detail).join(' ');
  const spfClaim = !(c.email.headers) && /SPF|DKIM|DMARC/.test(allText);
  const ok = matchLevel(c.expect, e.level) && !missing.length && !forbidden.length && !spfClaim && levelFromScore(e.score) === e.level;
  record('e-mail', c, ok, { vstup: JSON.stringify(c.email).slice(0, 160), očekáváno: c.expect, výsledek: e.level + ' (skóre ' + e.score + ')',
    chybí_vysvětlení: missing.length ? missing : undefined, zakázané: forbidden.length ? forbidden : undefined,
    tvrzení_o_spf_bez_hlaviček: spfClaim || undefined, nalezeno: [...codes].join(', ') });
}

/* ---------- 7. Nouzový plán a telefonát ---------- */
function guideCase(id, why, fn) {
  let ok = false, detail = {};
  try { if (!G) throw new Error('chybí assets/guides.js'); const r = fn(); ok = r.ok; detail = r.detail || {}; }
  catch (e) { detail = { chyba: e.message }; }
  record('průvodci', { id, why }, ok, detail);
}
guideCase('plan-card-code-dedupe', 'Při výběru karty i kódu se „zavolejte bance“ objeví jen jednou a hned.', () => {
  const p = G.buildPlan(['card', 'code']);
  const all = p.now.concat(p.hour, p.later).map(x => x.key);
  return { ok: all.filter(k => k === 'bank-call').length === 1 && p.now.some(x => x.key === 'bank-call') && new Set(all).size === all.length, detail: { kroky: all.join(', ') } };
});
guideCase('plan-money-first', 'U odeslaných peněz je první krok volat bance.', () => {
  const p = G.buildPlan(['money']);
  return { ok: p.now[0].key === 'bank-call' && p.urgent === true, detail: { hned: p.now.map(x => x.key) } };
});
guideCase('plan-remote-disconnect', 'U vzdáleného přístupu je první krok odpojit zařízení.', () => {
  const p = G.buildPlan(['remote']);
  return { ok: p.now[0].key === 'disconnect', detail: { hned: p.now.map(x => x.key) } };
});
guideCase('plan-id-15days', 'U dokladu je ohlášení hned a nový průkaz do 15 dnů (portal.gov.cz).', () => {
  const p = G.buildPlan(['id']);
  return { ok: p.now[0].key === 'id-report' && p.later.some(x => /15 dnů/.test(x.detail)), detail: {} };
});
guideCase('plan-clicked-not-urgent', 'Samotné kliknutí není označené jako naléhavé.', () => {
  const p = G.buildPlan(['clicked']);
  return { ok: p.urgent === false && p.now[0].key === 'close-page', detail: {} };
});
guideCase('plan-every-step-has-text', 'Každý krok ve všech situacích má text.', () => {
  const p = G.buildPlan(G.SITUATIONS.map(s => s.id));
  const all = p.now.concat(p.hour, p.later);
  return { ok: all.length > 0 && all.every(x => x.title && x.detail), detail: { počet: all.length } };
});
guideCase('call-safe-account', 'Převod na bezpečný účet je vysoké riziko.', () => {
  const r = G.assessCall({ who: 'bank', transfer: 'yes', app: 'no', code: 'no', details: 'no', pressure: 'yes', did: 'nothing' });
  return { ok: r.level === 'high' && r.report158 === true, detail: { level: r.level } };
});
guideCase('call-spoofing-note', 'Postup vždy upozorní, že číslo na displeji nic nedokazuje.', () => {
  const r = G.assessCall({ who: 'other', transfer: 'no', app: 'no', code: 'no', details: 'no', pressure: 'no' });
  return { ok: r.steps.some(s => /displeji/.test(s.title)) && r.level === 'low', detail: { level: r.level } };
});
guideCase('call-did-money', 'Kdo poslal peníze, dostane nouzový plán pro peníze.', () => {
  const r = G.assessCall({ who: 'bank', transfer: 'yes', did: 'money' });
  return { ok: r.emergency.indexOf('money') !== -1, detail: { emergency: r.emergency } };
});
guideCase('call-family', 'Volání „příbuzného“ je aspoň zvýšené riziko a radí zavolat na uložené číslo.', () => {
  const r = G.assessCall({ who: 'family', transfer: 'no', app: 'no', code: 'no', details: 'no', pressure: 'no' });
  return { ok: r.level === 'mid' && r.steps.some(s => /uložené číslo/.test(s.title)), detail: { level: r.level } };
});

/* ---------- 8. Rozbor jedné adresy ---------- */
reportUrl('https://login.csob.cz.evil.com/a/b?x=1', u => u.subdomain === 'login.csob.cz' && u.registrable === 'evil.com' && u.secure === true, 'Rozbor rozdělí subdoménu a skutečnou doménu.');
reportUrl('http://www.ppl.cz/sledovani', u => u.secure === false && u.official === true, 'U http se pozná nešifrované spojení i u oficiálního webu.');
function reportUrl(url, pred, why) {
  const u = A.analyzeUrl(url);
  record('rozbor odkazu', { id: url, why }, !!u && pred(u), { výsledek: u ? JSON.stringify({ sub: u.subdomain, reg: u.registrable, secure: u.secure, official: u.official }) : 'null' });
}


/* ---------- 9. Trénink a knihovna: ukázky musí analyzátor hodnotit stejně jako text vysvětlení ---------- */
if (G) G.TRAINING.forEach(function (t) {
  const e = A.evaluate(A.analyze(t.text), {});
  const ok = t.scam ? e.level !== 'low' : e.level === 'low';
  record('trénink', { id: t.id, why: t.scam ? 'Ukázka je podvod, kontrola ji nesmí označit za nízké riziko.' : 'Ukázka je v pořádku, kontrola ji má označit za nízké riziko.' }, ok, { vstup: t.text, výsledek: e.level });
});
(function () {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const re = /data-lib-ex="([^"]*)"/g; let m, n = 0;
  const unesc = x => x.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  while ((m = re.exec(html))) {
    n++;
    const t = unesc(m[1]);
    const e = A.evaluate(A.analyze(t), {});
    record('knihovna', { id: 'ukazka-' + n, why: 'Ukázka podvodu z knihovny nesmí vyjít jako nízké riziko.' }, e.level !== 'low', { vstup: t, výsledek: e.level });
  }
})();

/* ---------- Výpis ---------- */
const total = results.pass + results.fail;
for (const f of failures) {
  console.log('\nSELHALO  [' + f.group + '] ' + f.id);
  console.log('  důvod očekávání: ' + f.why);
  Object.keys(f.detail).forEach(k => { if (f.detail[k] !== undefined) console.log('  ' + k + ': ' + (typeof f.detail[k] === 'string' ? f.detail[k] : JSON.stringify(f.detail[k]))); });
}
if (results.review.length) {
  console.log('\nK ODBORNÉMU POSOUZENÍ (neovlivní výsledek):');
  results.review.forEach(r => console.log('  [' + r.group + '] ' + r.id + ': ' + r.why + ' | ' + JSON.stringify(r.detail)));
}
console.log('\nVýsledek: ' + results.pass + ' prošlo, ' + results.fail + ' selhalo (celkem ' + total + '), ' + results.review.length + ' čeká na posouzení.');
process.exit(results.fail ? 1 : 0);
