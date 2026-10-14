/* Generátor velkého korpusu zpráv pro PEBMedia Protect.
 * Skládá podvodné zprávy z vzorů skutečných kampaní (Policie ČR, banky, ČOI, NÚKIB, zkušenosti z praxe)
 * a k nim běžné legitimní zprávy, aby šlo měřit záchyt i plané poplachy.
 * Je deterministický (pevné semínko), takže výsledky testů jsou opakovatelné.
 *
 * Použití: const { generate } = require('./generate'); generate({ scams: 10000, legit: 3000 })
 */
'use strict';

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generate(opts) {
  opts = opts || {};
  const R = rng(opts.seed || 20261014);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const chance = (p) => R() < p;
  const int = (a, b) => a + Math.floor(R() * (b - a + 1));
  const money = (a, b, dec) => {
    const v = int(a, b);
    const s = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return dec ? s + ',' + pick(['00', '50', '90', '99']) : s;
  };
  const amountSmall = () => pick([money(1, 99, true) + ' Kč', money(19, 89) + ' Kč', money(1, 5, true) + ' Kč', money(1, 3, true) + ' EUR', money(25, 69) + ',- Kč']);
  const amountBig = () => money(3000, 98000) + ' Kč';
  const deadline = () => pick(['do 24 hodin', 'do 12 hodin', 'do 48 hodin', 'ještě dnes', 'do dnešní půlnoci', 'do zítřka', 'neprodleně', 'ihned', 'do 2 dnů']);
  const phone = () => pick(['+420 ', '', '00420 ']) + pick(['7', '6', '2']) + int(10, 99) + ' ' + int(100, 999) + ' ' + int(100, 999);
  const acct = () => int(100000, 9999999) + '/' + pick(['0100', '0300', '0800', '2010', '0600', '5500', '3030']);

  // ---------- Odkazy ----------
  const RISKY = ['top', 'xyz', 'icu', 'click', 'online', 'site', 'live', 'shop', 'info', 'vip', 'cfd', 'sbs', 'buzz', 'store', 'life', 'fun'];
  const NEUTRAL = ['com', 'net', 'cz', 'eu', 'org', 'co', 'app'];
  const WORDS = ['doruceni', 'zasilka', 'platba', 'overeni', 'login', 'secure', 'track', 'vraceni', 'podpora', 'info', 'pay', 'cz', 'online', 'ucet', 'klient', 'service', 'portal', 'potvrzeni', 'update', 'id'];
  const FREEH = ['web.app', 'pages.dev', 'netlify.app', 'vercel.app', 'weebly.com', 'wixsite.com', 'github.io', 'glitch.me', 'workers.dev', 'blogspot.com'];
  const SHORT = ['bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 't.ly', 's.id'];
  const CYR = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у' };
  const path = () => pick(['', '/', '/cz', '/track', '/pay', '/login', '/form', '/' + int(1000, 99999), '/cz/' + pick(WORDS), '/?id=' + int(10000, 999999), '/s/' + Math.floor(R() * 1e8).toString(36)]);
  const slug = () => Math.floor(R() * 1e10).toString(36).slice(0, int(5, 8));
  function urlFor(brandKw) {
    const scheme = pick(['https://', 'https://', 'https://', 'http://', '', 'www.']);
    const style = R();
    let host;
    if (brandKw && style < 0.22) host = brandKw + '-' + pick(WORDS) + '.' + pick(RISKY.concat(NEUTRAL));                 // csob-overeni.top
    else if (brandKw && style < 0.34) host = brandKw + '.' + pick(['cz', 'com']) + '-' + pick(WORDS) + '.' + pick(RISKY);  // csob.cz-login.top
    else if (brandKw && style < 0.44) host = pick(['login', 'secure', 'www', 'klient']) + '.' + brandKw + '.cz.' + pick(WORDS) + '-' + slug() + '.' + pick(NEUTRAL.concat(RISKY)); // subdoména
    else if (brandKw && style < 0.52) host = brandKw + '-' + pick(WORDS) + '.' + pick(FREEH);                               // bezplatný hosting
    else if (brandKw && style < 0.58 && /[aeopcxy]/.test(brandKw)) host = brandKw.replace(/[aeopcxy]/, (c) => CYR[c]) + '.' + pick(['cz', 'com', 'info']); // homoglyf
    else if (brandKw && style < 0.64) host = brandKw + pick(['cz', 'online', 'info', '-cz', 'pay']) + '.' + pick(RISKY.concat(NEUTRAL));
    else if (style < 0.74) return pick(['https://', '']) + pick(SHORT) + '/' + slug();                                      // zkracovač
    else host = pick(WORDS) + '-' + pick(WORDS) + (chance(0.4) ? int(1, 99) : '') + '.' + pick(RISKY.concat(NEUTRAL));     // neutrální doména
    return scheme + host + path();
  }

  // ---------- Šablony podvodů ----------
  const PKG = [['Česká pošta', 'ceskaposta'], ['PPL', 'ppl'], ['DPD', 'dpd'], ['GLS', 'gls'], ['Zásilkovna', 'zasilkovna'], ['DHL', 'dhl'], ['Balíkovna', 'balikovna'], ['Packeta', 'packeta'], ['Pošta', 'posta']];
  const BANK = [['Česká spořitelna', 'csas'], ['ČSOB', 'csob'], ['Komerční banka', 'kb'], ['Raiffeisenbank', 'raiffeisen'], ['MONETA', 'moneta'], ['Air Bank', 'airbank'], ['Fio banka', 'fio'], ['mBank', 'mbank'], ['UniCredit', 'unicredit'], ['Revolut', 'revolut'], ['Banka', null]];
  const ACC = [['Seznam', 'seznam'], ['Microsoft', 'microsoft'], ['Apple', 'apple'], ['iCloud', 'icloud'], ['Netflix', 'netflix'], ['Facebook', 'facebook'], ['Instagram', 'instagram'], ['Outlook', 'outlook'], ['Email.cz', null], ['WhatsApp', 'whatsapp']];
  const FAM = ['mami', 'mamko', 'tati', 'tato', 'babi', 'dědo', 'maminko', 'tatínku', 'babičko'];
  const MKT = [['Bazoš', 'bazos'], ['Vinted', 'vinted'], ['Sbazar', 'sbazar'], ['Facebook Marketplace', 'facebook']];

  const T = {
    package: () => {
      const [b, k] = pick(PKG); const u = urlFor(chance(0.75) ? k : null);
      return pick([
        `${b}: Vaše zásilka nemohla být doručena, ${pick(['adresa je neúplná', 'chybí číslo domu', 'nebyl zaplacen poplatek'])}. ${pick(['Uhraďte', 'Zaplaťte', 'Doplaťte'])} ${amountSmall()} ${deadline()}: ${u}`,
        `${b}: Zásilka ${pick(['č. ', '', 'CZ'])}${int(10000000, 99999999)} čeká na ${pick(['doplatek cla', 'zaplacení dopravy', 'potvrzení adresy', 'doplacení poštovného'])} ${amountSmall()}. ${pick(['Zaplaťte zde', 'Podrobnosti', 'Pokračujte zde', 'Klikněte'])}: ${u}`,
        `Váš balík je zadržen ${pick(['na celnici', 've skladu', 'v depu'])}. Pro doručení ${pick(['uhraďte poplatek', 'doplaťte', 'potvrďte platbu'])} ${amountSmall()} ${deadline()}, jinak bude vrácen odesílateli. ${u}`,
        `${b}: Kurýr vás nezastihl. Zvolte nový termín doručení a uhraďte ${amountSmall()}: ${u}`,
        `Dobrý den, vaše zásilka bude ${pick(['zlikvidována', 'vrácena', 'uložena na náklady příjemce'])}, pokud ${deadline()} nepotvrdíte doručovací adresu: ${u}`,
        `${b}: Doručení zásilky selhalo. Aktualizujte údaje a zaplaťte ${amountSmall()} za nové doručení ${u}`
      ]);
    },
    bank: () => {
      const [b, k] = pick(BANK); const u = urlFor(k && chance(0.7) ? k : null);
      return pick([
        `${b}: Váš účet byl ${pick(['zablokován', 'pozastaven', 'omezen'])} kvůli podezřelé aktivitě. ${pick(['Ověřte svou totožnost', 'Přihlaste se a ověřte účet', 'Odblokujte ho'])} ${deadline()}: ${u}`,
        `${b}: Zaznamenali jsme podezřelou platbu ${amountBig()}. Pokud jste ji neprovedli, ${pick(['klikněte zde', 'zrušte ji zde', 'ověřte se zde'])}: ${u}`,
        `${b}: Platnost vašeho ${pick(['bankovnictví', 'přístupu do bankovnictví', 'certifikátu', 'zabezpečení'])} vyprší. Aktualizujte údaje ${deadline()}: ${u}`,
        `Upozornění ${pick(['banky', 'od vaší banky', b])}: kvůli novým pravidlům je nutné ${pick(['aktualizovat platební údaje', 'ověřit kartu', 'potvrdit identitu'])}. Bez aktualizace bude účet zrušen. ${u}`,
        `${b}: Na vašem účtu je ${pick(['nová zpráva', 'čekající platba', 'nevyřízený požadavek'])}. Pro zobrazení se přihlaste: ${u}`,
        `${b}: Vaše karta byla ${pick(['zablokována', 'deaktivována'])}. Pro obnovení zadejte údaje karty: ${u}`
      ]);
    },
    bankcall: () => pick([
      `Dobrý den, zde ${pick(['bezpečnostní oddělení', 'oddělení bezpečnosti', 'bezpečnostní tým'])} vaší banky. ${pick(['Váš účet je ohrožen', 'Zaznamenali jsme podezřelou transakci', 'Někdo se pokouší vybrat vaše peníze'])}. Převeďte ${pick(['úspory', 'prostředky', 'peníze'])} na bezpečný účet ${acct()}.`,
      `Volám z ${pick(['České národní banky', 'policie', 'vaší banky'])}. Kvůli ochraně vašich úspor je nutné převést peníze na ${pick(['bezpečný účet', 'chráněný účet', 'ochranný účet'])}. Nikomu o tom neříkejte.`,
      `Dobrý den, tady ${pick(['banka', 'podpora banky'])}. ${pick(['Nainstalujte si prosím aplikaci AnyDesk', 'Stáhněte si TeamViewer', 'Nainstalujte aplikaci pro vzdálenou správu'])}, pomůžeme vám zastavit podezřelou platbu.`,
      `${pick(['Banka', 'Vaše banka'])}: Na vašem účtu je podezřelá transakce ${amountBig()}. Pokud jste ji neprovedli, ${pick(['ihned volejte', 'zavolejte', 'kontaktujte nás na čísle'])} ${phone()}.`,
      `Dobrý den, z vašeho účtu odchází platba ${amountBig()}. Pro zastavení mi prosím nadiktujte kód z SMS, který vám právě přišel.`
    ]),
    family: () => {
      const f = pick(FAM);
      return pick([
        `${pick(['Ahoj ', '', 'Čau '])}${f}, ${pick(['rozbil se mi telefon', 'spadl mi mobil do vody', 'ztratil jsem telefon', 'mám nový mobil'])}, tohle je moje nové číslo. ${pick(['Potřebuju rychle zaplatit fakturu', 'Můžeš mi poslat peníze', 'Potřebuji nutně zaplatit nájem', 'Pošleš mi za mě platbu'])}, ${pick(['banku mám ve starém mobilu', 'zítra ti to vrátím', 'vysvětlím později'])}. ${pick(['Jde o ' + amountBig() + '.', '', 'Číslo účtu ' + acct() + '.'])}`,
        `${f.charAt(0).toUpperCase() + f.slice(1)}, to jsem já, mám nové číslo. Nemůžu teď volat. Potřebuju nutně ${amountBig()}, pošleš mi to na účet ${acct()}?`,
        `Ahoj ${f}, píšu z nového čísla, ulož si ho. Napiš mi na WhatsApp, potřebuju s něčím pomoct a je to spěchá.`,
        `${pick(['Ahoj', 'Čau'])}, tady ${pick(['Petra', 'Jana', 'Tomáš', 'Lukáš', 'Eva'])}, mám nový mobil. ${pick(['Půjčíš mi', 'Můžeš mi poslat'])} ${amountBig()}? Banka mi zablokovala účet, zítra vrátím.`,
        `Dobrý den, váš ${pick(['syn', 'vnuk', 'dcera'])} měl dopravní nehodu. Aby nešel do vazby, je potřeba zaplatit kauci ${amountBig()}. Pošleme pro peníze kurýra.`
      ]);
    },
    codeask: () => pick([
      `Ahoj, poslal jsem ti omylem ${pick(['šestimístný kód', 'kód z SMS', 'ověřovací kód'])}${pick([' z WhatsAppu', '', ' z aplikace'])}. Můžeš mi ho prosím přeposlat?`,
      `Dobrý den, pro dokončení ${pick(['ověření', 'zabezpečení', 'změny'])} nám prosím sdělte kód z SMS, který vám přišel.`,
      `Ahoj, omylem jsem ti poslala kód z WhatsAppu, pošli mi ho zpátky prosím, nutně ho potřebuju.`,
      `${pick(['Vodafone', 'O2', 'T-Mobile', 'Banka'])}: Pro aktivaci služby nám přepošlete ověřovací kód, který vám přijde SMS zprávou.`
    ]),
    marketplace: () => {
      const [b, k] = pick(MKT); const u = urlFor(chance(0.75) ? k : null);
      return pick([
        `Dobrý den, zboží ${pick(['beru', 'kupuji', 'jsem zaplatil'])}. ${pick(['Zaplatil jsem přes', 'Platba proběhla přes', 'Využil jsem bezpečnou platbu'])} ${b}, ${pick(['kurýr si zboží vyzvedne', 'kurýr si věc vyzvedne'])}. Pro přijetí platby ${pick(['potvrďte kartu', 'klikněte zde', 'zadejte údaje karty'])}: ${u}`,
        `Dobrý den, máte ještě ${pick(['ten kočárek', 'to kolo', 'tu bundu', 'ten telefon', 'tu sedačku'])}? Koupím bez prohlížení, pošlu kurýra. Napište mi na WhatsApp.`,
        `${b}: Platba za váš inzerát je připravena. Pro připsání peněz zadejte číslo karty: ${u}`,
        `Dobrý den, posílám zálohu. Kvůli limitu musíte nejdřív zaplatit poplatek ${amountSmall()} za ověření účtu: ${u}`,
        `Prodám ${pick(['iPhone 15', 'PlayStation 5', 'MacBook', 'Samsung Galaxy'])} za ${money(3000, 9000)} Kč. Pošlete zálohu ${money(1000, 3000)} Kč na účet ${acct()}, osobní předání nejde.`
      ]);
    },
    invest: () => pick([
      `Gratulujeme! Byli jste vybráni do investičního programu. Z vkladu ${money(2000, 9000)} Kč můžete mít do měsíce ${money(40000, 150000)} Kč. Zaručený výdělek bez rizika.`,
      `${pick(['Známý moderátor', 'Slavný podnikatel', 'Bývalý ministr'])} prozradil, jak vydělává na kryptoměnách ${money(10000, 50000)} Kč týdně. Registrujte se: ${urlFor(null)}`,
      `Váš investiční účet vykazuje zisk ${amountBig()}. Pro výběr je nutné uhradit daň ${money(1000, 9000)} Kč předem.`,
      `Přišli jste o peníze v online investicích? Vrátíme vám je. Stačí uhradit vstupní poplatek ${money(1000, 5000)} Kč.`,
      `Investujte do bitcoinu s garantovaným výnosem ${int(10, 40)} % měsíčně. Pasivní příjem bez práce: ${urlFor(null)}`
    ]),
    job: () => pick([
      `Dobrý den, nabízíme práci z domova, ${money(800, 2000)} až ${money(2500, 5000)} Kč denně za ${pick(['hodnocení produktů', 'lajkování videí', 'jednoduché úkoly'])}. Pro více informací napište na ${pick(['WhatsApp', 'Telegram'])}.`,
      `Hledáme brigádníky na ${pick(['lajkování videí', 'hodnocení hotelů', 'psaní recenzí'])}, ${money(200, 900)} Kč za úkol. Kontaktujte nás na Telegramu.`,
      `Nabízíme práci: přijmete na svůj účet platby a pošlete je dál, za každou dostanete ${int(5, 15)} %. Zájemci pište na WhatsApp.`,
      `Dobrý den, vaše CV nás zaujalo. Pro nástup je potřeba zaplatit vratnou kauci ${money(500, 3000)} Kč za pracovní materiály.`
    ]),
    refund: () => {
      const who = pick([['Finanční správa', 'financnisprava'], ['ČEZ', 'cez'], ['ČSSZ', 'cssz'], ['VZP', 'vzp'], ['O2', 'o2'], ['Vodafone', 'vodafone'], ['T-Mobile', 'tmobile'], ['Úřad práce', null]]);
      const u = urlFor(who[1] && chance(0.6) ? who[1] : null);
      return pick([
        `${who[0]}: Máte nárok na vrácení přeplatku ${money(800, 9000)} Kč. Pro výplatu ${pick(['vyplňte údaje platební karty', 'zadejte číslo karty', 'potvrďte kartu'])}: ${u}`,
        `${who[0]}: Byl vám přiznán příspěvek ${money(1000, 9000)} Kč. Pro vyplacení potvrďte údaje karty: ${u}`,
        `${who[0]}: Vratka daně ${money(800, 9000)} Kč čeká na vyplacení. Vyplňte formulář ${deadline()}: ${u}`,
        `${who[0]} vám vrací přeplatek ${money(500, 5000)} Kč. Peníze obdržíte po ověření karty: ${u}`
      ]);
    },
    account: () => {
      const [b, k] = pick(ACC); const u = urlFor(k && chance(0.7) ? k : null);
      return pick([
        `${b}: Váš účet bude ${deadline()} ${pick(['zablokován', 'smazán', 'deaktivován'])} kvůli neověřeným údajům. Přihlaste se a ověřte totožnost: ${u}`,
        `${b}: Platba za předplatné se nezdařila. Aktualizujte platební údaje, jinak bude účet zrušen: ${u}`,
        `${b}: Někdo se přihlásil k vašemu účtu z ${pick(['Ruska', 'Číny', 'neznámého zařízení'])}. Pokud jste to nebyli vy, okamžitě ověřte heslo: ${u}`,
        `Vaše e-mailová schránka je plná. Rozšiřte úložiště zdarma, jinak přestanete dostávat poštu: ${u}`,
        `${b}: Vaše stránka porušuje pravidla a bude smazána. Podejte odvolání ${deadline()}: ${u}`,
        `${b}: Vaše heslo vyprší. Pro zachování přístupu ho potvrďte zde: ${u}`
      ]);
    },
    threat: () => pick([
      `Policie ČR: Bylo zahájeno trestní řízení ${pick(['kvůli vašemu účtu', 've vaší věci', 'pro podezření z podvodu'])}. Kontaktujte vyšetřovatele na čísle ${phone()}, jinak hrozí zatčení.`,
      `Exekutorský úřad: Proti vám je vedena exekuce. Dluh ${money(2000, 30000)} Kč uhraďte ${deadline()} na účet ${acct()}, jinak zabavíme majetek.`,
      `Výzva k úhradě: ${pick(['nezaplacené parkovné', 'nezaplacené mýtné', 'pokuta za rychlost'])}. ${pick(['Naskenujte QR kód a uhraďte', 'Uhraďte'])} pokutu ${money(500, 5000)} Kč ${deadline()}, jinak předáme vymáhání. ${chance(0.5) ? urlFor(null) : ''}`,
      `Upozornění: Vaše elektřina bude dnes ve ${int(17, 22)}:00 odpojena kvůli nezaplacené faktuře. Uhraďte ihned: ${urlFor(chance(0.5) ? 'cez' : null)}`,
      `Soudní výzva: Jste předvolán ve věci dluhu ${amountBig()}. Pro odložení zaplaťte ${deadline()}: ${urlFor(null)}`
    ]),
    prize: () => pick([
      `Gratulujeme! Vyhráli jste ${pick(['iPhone 16', 'nákupní poukaz 10 000 Kč', 'Samsung Galaxy', 'dárkovou kartu'])}. Pro doručení uhraďte poštovné ${amountSmall()}: ${urlFor(pick(['vodafone', 'o2', 'alza', null]))}`,
      `${pick(['Lidl', 'Kaufland', 'Albert', 'Billa'])}: K výročí rozdáváme ${money(500, 2000)} Kč každému, kdo vyplní krátký dotazník: ${urlFor(null)}`,
      `Jste náš ${pick(['miliontý', 'vylosovaný'])} návštěvník! Získejte ${pick(['telefon', 'tablet', 'televizi'])} za 1 Kč, stačí zadat údaje karty: ${urlFor(null)}`,
      `Byli jste vylosováni v soutěži. Odměnu ${amountBig()} si vyzvedněte ${deadline()}: ${urlFor(null)}`
    ]),
    remote: () => pick([
      `Dobrý den, volám z technické podpory ${pick(['Microsoftu', 'Windows', 'vašeho operátora'])}. Ve vašem počítači jsme našli virus. Nainstalujte si prosím aplikaci ${pick(['AnyDesk', 'TeamViewer', 'RustDesk'])}.`,
      `Váš telefon je napaden ${int(2, 6)} viry! Okamžitě stáhněte čisticí aplikaci: ${urlFor(null)}`,
      `Omylem jsme vám vrátili ${money(3000, 9000)} Kč místo ${money(100, 900)} Kč. Připojte se prosím přes ${pick(['TeamViewer', 'AnyDesk'])}, ať to opravíme.`
    ]),
    vignette: () => pick([
      `Kupte si dálniční známku na rok ${int(2026, 2027)} rychle a bez front: ${urlFor(pick(['dalnicni', 'edalnice', null]))}`,
      `Vaše dálniční známka vyprší. Prodlužte ji nyní: ${urlFor(pick(['edalnice', 'dalnicni']))}`,
      `Elektronická dálniční známka: platnost končí ${deadline()}. Obnovte ji se slevou: ${urlFor('edalnice')}`
    ])
  };
  const WEIGHTS = { package: 16, bank: 12, bankcall: 9, family: 9, codeask: 4, marketplace: 9, invest: 6, job: 5, refund: 7, account: 9, threat: 6, prize: 4, remote: 3, vignette: 1 };

  // ---------- Legitimní zprávy ----------
  const LEGIT = [
    () => `Vaše zásilka ${pick(['PPL', 'DPD', 'od Zásilkovny', 'GLS'])} bude doručena ${pick(['zítra', 'dnes', 'v pátek'])} mezi ${int(8, 12)}:00 a ${int(13, 18)}:00.`,
    () => `Zásilka ${int(1000, 9999)} je připravena k vyzvednutí na výdejním místě ${pick(['Liberec', 'Jablonec', 'Praha 4', 'Brno'])}, ${pick(['Komenského', 'Nádražní', 'Masarykova'])} ${int(1, 80)}. Úložní doba je 7 dní.`,
    () => `Platba kartou ${money(49, 3999)} Kč v obchodě ${pick(['Albert', 'Lidl', 'Tesco', 'Billa', 'dm'])} byla provedena. Zůstatek najdete v aplikaci banky.`,
    () => `Váš ověřovací kód je ${int(100000, 999999)}. Kód nikomu nesdělujte, ani pracovníkům banky.`,
    () => `Na váš účet přišla platba ${money(1000, 45000)} Kč od ${pick(['zaměstnavatele', 'ČSSZ', 'pojišťovny'])}.`,
    () => `Ahoj, ${pick(['vlak má zpoždění', 'jsem na cestě', 'dorazím později'])}, budu tam asi za ${int(10, 50)} minut.`,
    () => `${pick(['Mami', 'Tati', 'Babi'])}, ${pick(['koupíš cestou chleba?', 'dorazila jsem v pořádku.', 'zavolám večer.', 'děkuju za dárek!'])}`,
    () => `Připomínáme ${pick(['kontrolu u zubaře', 'termín u lékaře', 'servis auta', 'stříhání'])} ${pick(['zítra', 'v pondělí', 've středu'])} v ${int(8, 17)}:${pick(['00', '30'])}. Pokud nemůžete přijít, dejte nám vědět.`,
    () => `Dobrý den, ještě je ${pick(['ta lednička', 'to kolo', 'ten stůl'])} k mání? Mohl bych se přijet podívat ${pick(['v sobotu', 'zítra večer'])} a zaplatit hotově?`,
    () => `Vaše objednávka č. ${int(1000000, 9999999)} byla odeslána. Doručení očekávejte do ${int(1, 3)} pracovních dnů.`,
    () => `Děkujeme za platbu. Faktura č. ${int(2026, 2026)}-${int(100, 999)} je uhrazená.`,
    () => `Odstávka vody v ulici ${pick(['Nádražní', 'Lipová', 'Školní'])} proběhne ${pick(['ve čtvrtek', 'v úterý'])} od ${int(7, 9)} do ${int(12, 15)} hodin.`,
    () => `Váš měsíční limit dat je z ${pick(['80', '90'])} % vyčerpaný. Další data si můžete dokoupit v aplikaci operátora.`,
    () => `Seznam.cz: Zaznamenali jsme nové přihlášení k vašemu účtu z prohlížeče ${pick(['Chrome', 'Firefox', 'Safari'])}. Pokud jste to byli vy, nemusíte nic dělat.`,
    () => `Kód eReceptu je ${Math.floor(R() * 1e12).toString(36).toUpperCase().slice(0, 4)} ${Math.floor(R() * 1e12).toString(36).toUpperCase().slice(0, 4)}, předložte ho v lékárně.`,
    () => `Dobrý den, peníze jsem vám poslal na účet, který jste uvedl. Zboží si vyzvednu ${pick(['zítra', 'v sobotu'])} v ${int(14, 19)}, jak jsme se domluvili.`,
    () => `Sledujte zásilku na ${pick(['https://www.ppl.cz', 'https://www.dpd.cz', 'https://www.zasilkovna.cz', 'https://www.ceskaposta.cz'])}, číslo zásilky ${int(10000000, 99999999)}.`,
    () => `Ahoj, posílám fotky z ${pick(['výletu', 'oslavy', 'dovolené'])}. Měj se hezky!`,
    () => `Zítra bude na lince ${int(1, 30)} výluka, spoje pojedou odklonem.`,
    () => `Kauce za byt je ${money(10000, 30000)} Kč, platí se při podpisu smlouvy. Prohlídka je ve ${pick(['čtvrtek', 'středu'])} v ${int(15, 18)}:00.`,
    () => `Dobrý den, servis potvrzuje opravu ${pick(['pračky', 'kotle', 'myčky'])} ve ${pick(['čtvrtek', 'středu'])} mezi ${int(8, 12)} a ${int(13, 16)} hodinou.`,
    () => `Vyúčtování ${pick(['elektřiny', 'plynu'])} je připraveno v zákaznickém portálu. Přeplatek vám pošleme na účet.`,
    () => `Pošli mi prosím ${money(100, 500)} Kč za ${pick(['lístek', 'oběd', 'pizzu'])}, díky!`,
    () => `Nezapomeň, zítra máme schůzku v ${int(9, 18)} v kavárně na náměstí.`,
    () => `${pick(['Policie hledá svědky nehody', 'Policie varuje před podvodníky', 'Banky mění poplatky'])}, víc tady: https://www.${pick(['idnes.cz', 'seznamzpravy.cz', 'novinky.cz', 'irozhlas.cz'])}/zpravy/${int(1000, 99999)}`,
    () => `Ahoj, ${pick(['v Lidlu', 'v Albertu', 'v Kauflandu'])} je sleva na ${pick(['kávu', 'máslo', 'pivo'])}, leták: https://www.kupi.cz/letaky`,
    () => `Alza: Vaše objednávka je připravena k vyzvednutí. Detail najdete na https://www.alza.cz/muj-ucet`,
    () => `ČEZ Distribuce: Odečet elektroměru proběhne ${pick(['v pondělí', 've středu'])}. Více informací na https://www.cezdistribuce.cz`,
    () => `Ahoj, koukni na ten seriál z ${pick(['Netflixu', 'HBO', 'Voyo'])}, recenze je tady https://www.csfd.cz/film/${int(1000, 99999)}`,
    () => `Zítra jdu do banky, pak se stavím. Sejdeme se tady: https://mapy.cz/s/${Math.floor(R() * 1e8).toString(36)}`,
    () => `Na Vinted jsem prodala bundu, díky za tip! Fotka: https://photos.app.goo.gl/${Math.floor(R() * 1e10).toString(36)}`,
    () => `Česká pošta: Zásilka ${int(10000000, 99999999)} je připravena k vyzvednutí na poště. Sledování: https://www.postaonline.cz/trackandtrace`
  ];

  // ---------- Úpravy stylu ----------
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  function ocrNoise(s) {
    // drobné chyby čtečky mimo adresy: ztráta háčku, l/I, rozdělené slovo
    return s.split(/(\S*\.\S+)/).map((part, i) => {
      if (i % 2) return part;
      return part.replace(/[ěščřžýáíéůú]/g, (c) => (R() < 0.15 ? strip(c) : c)).replace(/l/g, (c) => (R() < 0.04 ? 'I' : c));
    }).join('');
  }
  function style(text) {
    let t = text.replace(/\s+/g, ' ').trim();
    const r = R();
    if (r < 0.4) t = strip(t);                 // SMS bez diakritiky
    else if (r < 0.5) t = ocrNoise(t);         // text ze screenshotu
    if (chance(0.03)) t = t.toUpperCase();
    return t;
  }

  const out = [];
  const cats = Object.keys(WEIGHTS);
  const total = cats.reduce((a, c) => a + WEIGHTS[c], 0);
  for (let i = 0; i < (opts.scams || 10000); i++) {
    let x = R() * total, cat = cats[0];
    for (const c of cats) { x -= WEIGHTS[c]; if (x <= 0) { cat = c; break; } }
    out.push({ scam: true, cat, text: style(T[cat]()) });
  }
  for (let i = 0; i < (opts.legit || 3000); i++) out.push({ scam: false, cat: 'legit', text: style(pick(LEGIT)()) });
  return out;
}

module.exports = { generate };
