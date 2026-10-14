/* Změří záchyt podvodů a plané poplachy na vygenerovaném korpusu.
 * node test/corpus/measure.js [--show N] [--cat kategorie] [--legit]
 */
'use strict';
const A = require('../../assets/analyzer.js');
const { generate } = require('./generate.js');
const args = process.argv.slice(2);
const show = args.includes('--show') ? +args[args.indexOf('--show') + 1] : 0;
const onlyCat = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null;
const corpus = generate({ scams: 10000, legit: 3000 });
const t0 = Date.now();
const stat = {}; const misses = {}; const fps = [];
for (const m of corpus) {
  const e = A.evaluate(A.analyze(m.text), {});
  const s = stat[m.cat] || (stat[m.cat] = { n: 0, low: 0, mid: 0, high: 0 });
  s.n++; s[e.level]++;
  if (m.scam && e.level === 'low') (misses[m.cat] = misses[m.cat] || []).push(m.text + '   [' + e.score + ']');
  if (!m.scam && e.level !== 'low') fps.push(e.level + ' ' + m.text);
}
const ms = Date.now() - t0;
let n = 0, caught = 0, high = 0;
for (const [c, s] of Object.entries(stat)) {
  if (c === 'legit') continue;
  n += s.n; caught += s.n - s.low; high += s.high;
  console.log(c.padEnd(12), 'n=' + String(s.n).padStart(5), ' zachyceno ' + (100 * (s.n - s.low) / s.n).toFixed(1).padStart(5) + ' %', ' vysoké ' + (100 * s.high / s.n).toFixed(1).padStart(5) + ' %');
}
const L = stat.legit;
console.log('CELKEM podvodů', n, 'zachyceno', (100 * caught / n).toFixed(2) + ' %', 'z toho vysoké', (100 * high / n).toFixed(1) + ' %');
console.log('Legitimní', L.n, 'planý poplach', (100 * (L.n - L.low) / L.n).toFixed(2) + ' %', '(zvýšené ' + L.mid + ', vysoké ' + L.high + ')', ' čas ' + ms + ' ms');
if (show) {
  for (const [c, list] of Object.entries(misses)) {
    if (onlyCat && c !== onlyCat) continue;
    console.log('\n--- nezachyceno: ' + c + ' (' + list.length + ')'); list.slice(0, show).forEach((t) => console.log('  ' + t));
  }
  if (!onlyCat || onlyCat === 'legit') { console.log('\n--- planý poplach (' + fps.length + ')'); fps.slice(0, show).forEach((t) => console.log('  ' + t)); }
}
module.exports = { stat };
