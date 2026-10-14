/* PEBMedia Protect: průvodci (nouzový plán po podvodu, podezřelý telefonát).
 * Čisté funkce bez DOM, testované v Node (test/run.js).
 *
 * Zdroje postupů:
 * - Policie ČR, vishing a spoofing: https://archiv.policie.gov.cz/clanek/web-informacni-servis-zpravodajstvi-soucasne-trendy-podvodniku-vishing-a-spoofing.aspx
 *   (číslo na displeji lze podvrhnout, nesdělovat kódy ani údaje, v pochybnostech kontaktovat banku, oznámit na 158)
 * - Policie ČR, podezřelá aktivita online (7726, uchování důkazů)
 * - portal.gov.cz, služba S186 (ohlášení nebezpečí zneužití občanského průkazu, nový průkaz do 15 dnů)
 * Ověřeno 13. 10. 2026.
 */
(function (root) {
  'use strict';

  /* ---------- Nouzový plán po podvodu ---------- */
  // Kroky jsou sdílené: když člověk vybere víc situací, stejný krok se zobrazí jen jednou
  // a v nejnaléhavější fázi, ve které se objevil.
  var STEPS = {
    'bank-call': { t: 'Zavolejte své bance', d: 'Na číslo ze zadní strany karty nebo z bankovní aplikace, ne na číslo ze zprávy. Řekněte přesně, co se stalo.' },
    'stop-payment': { t: 'Požádejte o zastavení nebo vrácení platby', d: 'Čím dřív bance zavoláte, tím větší je šance, že se platbu podaří zastavit.' },
    'no-more-money': { t: 'Už nic dalšího neposílejte', d: 'Podvodníci často chtějí další platbu, třeba na „vrácení“ té první nebo na „poplatek“.' },
    'block-card': { t: 'Zablokujte kartu', d: 'V bankovní aplikaci, nebo na čísle ze zadní strany karty.' },
    'deny-approvals': { t: 'Nic, co jste sami nezadali, neschvalujte', d: 'Když vám přijde žádost o potvrzení platby nebo přihlášení, odmítněte ji.' },
    'disconnect': { t: 'Odpojte zařízení od internetu', d: 'Vypněte Wi-Fi i mobilní data, aby cizí člověk ztratil přístup.' },
    'call-from-other': { t: 'Bance volejte z jiného telefonu', d: 'Zařízení s nainstalovanou aplikací teď nepoužívejte pro bankovnictví.' },
    'uninstall': { t: 'Odinstalujte aplikaci pro vzdálený přístup', d: 'Hlavně AnyDesk, TeamViewer, RustDesk nebo cokoli, co neznáte.' },
    'pw-bank': { t: 'Změňte heslo do bankovnictví', d: 'Přes oficiální aplikaci nebo web, který napíšete ručně. Klidně až s pomocí banky po telefonu.' },
    'pw-change': { t: 'Změňte heslo k účtu', d: 'Přes oficiální aplikaci nebo web, který napíšete ručně.' },
    'pw-other-device': { t: 'Z jiného zařízení si změňte důležitá hesla', d: 'K bance, e-mailu a dalším účtům.' },
    'pw-reuse': { t: 'Změňte stejné heslo i všude jinde', d: 'Podvodníci ho zkusí i na e-mailu, sociálních sítích a dalších službách.' },
    'sessions': { t: 'Odhlaste ostatní zařízení a zapněte dvoufázové ověření', d: 'Obojí najdete v nastavení zabezpečení účtu.' },
    'mail-forward': { t: 'U e-mailu zkontrolujte přeposílání a pravidla', d: 'Útočníci si někdy nastaví tiché přeposílání vaší pošty.' },
    'whatsapp': { t: 'Šlo o WhatsApp? Znovu se přihlaste', d: 'Tím útočníka odhlásíte. Pak si zapněte ověření pomocí PIN.' },
    'warn-contacts': { t: 'Varujte známé', d: 'Z vašeho účtu jim mohou přijít prosby o peníze.' },
    'evidence': { t: 'Uložte si důkazy a nic zatím nemažte', d: 'Screenshoty zpráv, čísla, jména, čísla účtů, odkazy a potvrzení plateb.' },
    'timeline': { t: 'Sepište si, co se stalo', d: 'Kdy a jak se ozvali, co chtěli a co jste udělali. Paměť se rychle ztrácí.' },
    'police': { t: 'Podejte oznámení na policii', d: 'Text oznámení vám pomůžeme připravit. Policii ho pak podáte sami.' },
    'check-statements': { t: 'Projděte výpisy a neznámé platby reklamujte', d: 'Několik dní sledujte účet. Neznámou platbu hlaste bance co nejdřív.' },
    'fake-recovery': { t: 'Pozor na „vymahače“ ztracených peněz', d: 'Kdo slibuje vrácení peněz za poplatek, bývá další podvodník.' },
    'device-check': { t: 'Nechte zařízení zkontrolovat', d: 'Antivirem nebo u odborníka. V horším případě pomůže obnovení do továrního nastavení.' },
    'id-report': { t: 'Ohlaste nebezpečí zneužití občanského průkazu', d: 'Bez odkladu na kterémkoli obecním úřadu obce s rozšířenou působností (v Praze na úřadu městské části Praha 1 až 22), nebo na služebně policie.' },
    'id-new': { t: 'Požádejte o nový občanský průkaz', d: 'Ohlášením starý průkaz přestane platit. O nový je potřeba požádat do 15 dnů.' },
    'close-page': { t: 'Zavřete stránku a nic na ní nevyplňujte', d: 'Pokud se něco stáhlo, soubor neotevírejte a smažte ho.' },
    'watch': { t: 'Pár dní hlídejte účty a zprávy', d: 'Všímejte si neobvyklých SMS, přihlášení nebo plateb.' }
  };

  var SITUATIONS = [
    { id: 'money', label: 'Poslal(a) jsem peníze', urgent: true,
      now: ['bank-call', 'stop-payment', 'no-more-money'], hour: ['evidence', 'timeline', 'police'], later: ['check-statements', 'fake-recovery'],
      tip: 'Pozor na lidi, kteří vám později nabídnou vrácení peněz za poplatek. Bývají to další podvodníci.' },
    { id: 'card', label: 'Zadal(a) jsem údaje z karty', urgent: true,
      now: ['block-card', 'bank-call', 'deny-approvals'], hour: ['check-statements', 'evidence'], later: ['police', 'watch'] },
    { id: 'code', label: 'Řekl(a) jsem kód z SMS nebo něco potvrdil(a) v aplikaci', urgent: true,
      now: ['bank-call', 'deny-approvals'], hour: ['whatsapp', 'warn-contacts', 'evidence'], later: ['police', 'watch'] },
    { id: 'remote', label: 'Nainstaloval(a) jsem aplikaci nebo pustil(a) někoho do zařízení', urgent: true,
      now: ['disconnect', 'call-from-other', 'bank-call'], hour: ['uninstall', 'pw-other-device', 'evidence'], later: ['device-check', 'police', 'watch'] },
    { id: 'bankpw', label: 'Zadal(a) jsem heslo do bankovnictví', urgent: true,
      now: ['bank-call', 'pw-bank'], hour: ['deny-approvals', 'sessions', 'evidence'], later: ['check-statements', 'police'] },
    { id: 'password', label: 'Zadal(a) jsem heslo k e-mailu nebo sociální síti',
      now: ['pw-change', 'sessions'], hour: ['mail-forward', 'pw-reuse', 'warn-contacts'], later: ['watch'] },
    { id: 'id', label: 'Poslal(a) jsem fotku občanského průkazu',
      now: ['id-report'], hour: ['evidence'], later: ['id-new', 'watch'],
      tip: 'Postup vychází z popisu služby na portal.gov.cz. U pasu nebo řidičského průkazu se může lišit, ověřte ho na úřadě. Poslali jste i údaje z karty? Označte i tuhle možnost.' },
    { id: 'clicked', label: 'Jen jsem klikl(a) na odkaz',
      now: ['close-page'], hour: [], later: ['watch'],
      tip: 'Samotné kliknutí většinou nic vážného nezpůsobí. Nejdůležitější je nic nevyplnit a nic neinstalovat.' }
  ];

  var PHASES = [
    { id: 'now', title: 'Hned teď', note: 'Rozhodují minuty.' },
    { id: 'hour', title: 'Během hodiny', note: 'Až máte hotové první kroky.' },
    { id: 'later', title: 'V dalších dnech', note: '' }
  ];

  function buildPlan(selected) {
    var chosen = SITUATIONS.filter(function (s) { return (selected || []).indexOf(s.id) !== -1; });
    var seen = {};
    var plan = { now: [], hour: [], later: [], urgent: chosen.some(function (s) { return s.urgent; }), situations: chosen.map(function (s) { return s.id; }),
      tips: chosen.filter(function (s) { return s.tip; }).map(function (s) { return s.tip; }) };
    PHASES.forEach(function (ph) {
      chosen.forEach(function (s) {
        s[ph.id].forEach(function (key) {
          if (seen[key]) return;
          seen[key] = true;
          plan[ph.id].push({ key: key, title: STEPS[key].t, detail: STEPS[key].d });
        });
      });
    });
    plan.police = plan.now.concat(plan.hour, plan.later).some(function (x) { return x.key === 'police'; });
    return plan;
  }

  // Co si připravit k oznámení. Jen praktický seznam, ne právní požadavky.
  var POLICE_PREP = [
    'Kdy přesně se to stalo, klidně i přibližný čas',
    'Telefonní čísla, e-maily, jména a odkazy, které podvodník použil',
    'Snímky obrazovky zpráv, chatů a seznamu hovorů',
    'Čísla účtů, kam peníze odešly, a potvrzení plateb nebo výpis',
    'Kolik peněz jste ztratili, pokud o nějaké',
    'Občanský průkaz, pokud jdete osobně'
  ];

  /* ---------- Podezřelý telefonát ---------- */
  var CALL_QUESTIONS = [
    { id: 'who', text: 'Za koho se volající vydával?', options: [
      { v: 'bank', label: 'Za banku' }, { v: 'police', label: 'Za policii' }, { v: 'office', label: 'Za úřad nebo jinou instituci' },
      { v: 'company', label: 'Za firmu (operátor, energie, Microsoft…)' }, { v: 'family', label: 'Za někoho z rodiny' }, { v: 'other', label: 'Jinak nebo nevím' } ] },
    { id: 'transfer', text: 'Chtěl, abyste převedli peníze, třeba na „bezpečný účet“?', yesno: true },
    { id: 'app', text: 'Chtěl, abyste si nainstalovali aplikaci nebo sdíleli obrazovku?', yesno: true },
    { id: 'code', text: 'Chtěl kód z SMS nebo potvrzení v bankovní aplikaci?', yesno: true },
    { id: 'details', text: 'Chtěl údaje z karty, hesla nebo přihlašovací údaje?', yesno: true },
    { id: 'pressure', text: 'Spěchal, vyhrožoval nebo chtěl, abyste o hovoru nikomu neříkali?', yesno: true },
    { id: 'did', text: 'Udělali jste něco z toho, co chtěl?', options: [
      { v: 'nothing', label: 'Nic jsem neudělal(a)' }, { v: 'money', label: 'Poslal(a) jsem peníze' }, { v: 'remote', label: 'Nainstaloval(a) jsem aplikaci' },
      { v: 'code', label: 'Řekl(a) jsem kód nebo něco potvrdil(a)' }, { v: 'card', label: 'Řekl(a) jsem údaje z karty' }, { v: 'bankpw', label: 'Řekl(a) jsem heslo' } ] }
  ];

  function assessCall(ans) {
    ans = ans || {};
    var yes = function (k) { return ans[k] === 'yes'; };
    var signs = [];
    if (yes('transfer')) signs.push({ code: 'transfer', title: 'Chtěl převést peníze', detail: 'Banka ani policie po vás nikdy nechtějí převod peněz na jiný, „bezpečný“ účet.' });
    if (yes('app')) signs.push({ code: 'app', title: 'Chtěl instalaci aplikace nebo sdílení obrazovky', detail: 'Přes vzdálený přístup by viděl a ovládal vaše zařízení i bankovnictví.' });
    if (yes('code')) signs.push({ code: 'code', title: 'Chtěl kód nebo potvrzení v aplikaci', detail: 'Kódy z SMS ani potvrzení v aplikaci nikomu nesdělujte. Schvalují platby a přihlášení.' });
    if (yes('details')) signs.push({ code: 'details', title: 'Chtěl údaje z karty nebo hesla', detail: 'Tyhle údaje po vás nikdo z banky ani úřadu po telefonu nechce.' });
    if (yes('pressure')) signs.push({ code: 'pressure', title: 'Spěchal nebo vyhrožoval', detail: 'Nátlak má zabránit tomu, abyste si to ověřili nebo se s někým poradili.' });
    var authority = ['bank', 'police', 'office'].indexOf(ans.who) !== -1;
    var hard = yes('transfer') || yes('app') || yes('code') || yes('details');
    var level = hard || (authority && yes('pressure')) ? 'high' : (yes('pressure') || ans.who === 'family' ? 'mid' : 'low');
    var steps = [
      { title: 'Pokud hovor ještě běží, zavěste', detail: 'Ukončit hovor můžete kdykoli. Skutečná banka ani policie vám to nebudou vyčítat.' },
      { title: 'Zavolejte sami na oficiální číslo', detail: 'Bance na číslo ze zadní strany karty nebo z aplikace. Nevolejte zpět na číslo, které vám volalo.' },
      { title: 'Číslo na displeji nic nedokazuje', detail: 'Podvodníci umí napodobit i číslo bankovní infolinky. Ověřit se dá jen tak, že zavoláte vy.' },
      { title: 'Zapište si, co volající říkal', detail: 'Jména, čísla účtů, odkazy a čas hovoru. Hodí se bance i policii.' }
    ];
    if (ans.who === 'family') steps.splice(1, 1, { title: 'Zavolejte na uložené číslo blízkého', detail: 'Pokud vás o peníze žádal „příbuzný“, ověřte si to na čísle, které máte uložené.' });
    var situations = { money: 'money', remote: 'remote', code: 'code', card: 'card', bankpw: 'bankpw' };
    var emergency = situations[ans.did] ? [situations[ans.did]] : [];
    return { level: level, signs: signs, steps: steps, emergency: emergency, report158: hard || (authority && yes('pressure')) };
  }

  var api = { buildPlan: buildPlan, POLICE_PREP: POLICE_PREP, SITUATIONS: SITUATIONS, PHASES: PHASES, STEPS: STEPS, assessCall: assessCall, CALL_QUESTIONS: CALL_QUESTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PPGuides = api;
})(typeof window !== 'undefined' ? window : this);
