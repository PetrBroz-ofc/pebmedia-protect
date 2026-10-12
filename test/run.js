const A = require('../assets/analyzer.js');
const samples = {
  posta: 'Ceska posta: Vase zasilka nemohla byt dorucena, adresa je neuplna. Doplatte 1,50 Kc do 24 hodin: https://сeskapоsta-cz.info/track',
  posta2: 'CP: zasilka CZ4481 ceka na doplatek cla 39 Kc. ceskaposta.cz.doruceni-info.top/pay',
  mami: 'Ahoj mami, rozbil se mi telefon, tohle je moje nove cislo. Napis mi na WhatsApp, potrebuju rychle zaplatit fakturu.',
  bank: 'Dobry den, volame z bezpecnostniho oddeleni vasi banky. Zaznamenali jsme podezrelou transakci, prevedte prosim uspory na bezpecny ucet a nainstalujte AnyDesk.',
  legit: 'Vase zasilka bude dnes dorucena. Sledovat muzete na https://www.ppl.cz/vyhledat-zasilku?id=123',
  apple: 'Apple Store: dekujeme za objednavku, podrobnosti na apple.com/cz',
  short: 'Vyhral jste iPhone! Vyzvednete si ho na bit.ly/3xYz',
  vinted: 'Dobry den, zaplatil jsem vam pres Vinted. Pro prijeti platby kliknete: vinted-cz.payment-secure.online/item/552',
  dalnice: 'Kupte si dalnicni znamku 2027 na edalnice-cz.com',
  email: 'Napiste mi na jan.novak@seznam.cz, diky. Konec.Dalsi veta.',
};
for (const [k,t] of Object.entries(samples)) {
  const a = A.analyze(t); const e = A.evaluate(a, {});
  console.log('\n==', k, '->', e.level, e.score, '| cats', Object.keys(a.cats).join(','));
  a.urls.forEach(u => console.log('  URL', u.raw, '|', u.ascii, '| reg', u.registrable, '| brand', u.brand, 'off', u.official, '|', u.findings.map(f=>f.sev+':'+f.title).join(' ; ')));
  a.textFindings.forEach(f => console.log('  T', f.sev, f.title));
  console.log('  Q:', A.questionsFor(a).map(q=>q.id).join(','));
}
