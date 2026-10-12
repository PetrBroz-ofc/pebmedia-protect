const A = require('../assets/analyzer.js');
const samples = {
  posta: 'Česká pošta: Vaše zásilka nemohla být doručena, adresa je neúplná. Uhraďte doplatek 1,50 Kč do 24 hodin: https://сeskapоsta-cz.info/track',
  posta2: 'CP: zasilka CZ4481 ceka na doplatek cla 39 Kc. ceskaposta.cz.doruceni-info.top/pay',
  mami: 'Ahoj mami, rozbil se mi telefon, tohle je moje nové číslo. Ulož si ho. Napiš mi na WhatsApp, potřebuju rychle zaplatit fakturu.',
  bank: 'Dobrý den, zde bezpečnostní oddělení vaší banky. Zaznamenali jsme podezřelou transakci. Je nutné převést prostředky na bezpečný účet. Nainstalujte si prosím aplikaci AnyDesk.',
  legit: 'Vaše zásilka bude dnes doručena. Sledovat můžete na https://www.ppl.cz/vyhledat-zasilku?id=123',
  apple: 'Apple Store: děkujeme za objednávku, podrobnosti na apple.com/cz',
  short: 'Vyhrál jste iPhone! Vyzvedněte si ho na bit.ly/3xYz',
  vinted: 'Dobrý den, zboží jsem vám zaplatil přes Vinted. Pro přijetí platby klikněte: vinted-cz.payment-secure.online/item/552',
  dalnice: 'Kupte si dálniční známku 2027 na edalnice-cz.com',
  email: 'Napište mi na jan.novak@seznam.cz, díky. Konec.Další věta.',
};
let ok = true;
for (const [k,t] of Object.entries(samples)) {
  const a = A.analyze(t); const e = A.evaluate(a, {});
  console.log('\n==', k, '->', e.level, e.score);
  a.urls.forEach(u => { console.log('  URL', JSON.stringify(t.slice(u.start,u.end)), u.summary.kind, u.worst, u.findings.map(f=>f.title).join(' ; ')); if (t.slice(u.start,u.end)!==u.raw) ok=false; });
  a.textFindings.forEach(f => console.log('  T', f.sev, f.title, f.spans.map(s=>JSON.stringify(t.slice(s[0],s[1]))).join(' ')));
}
console.log('\nspans ok:', ok);
