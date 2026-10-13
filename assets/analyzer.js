/* PEBMedia Protect: analyzátor zpráv a odkazů
 * Čistě klientská logika, nic se neodesílá. Funguje v prohlížeči (window.PPAnalyzer)
 * i v Node (module.exports) kvůli testům.
 */
(function (root) {
  'use strict';

  /* ---------- Data ---------- */

  // Písmena, která vypadají jako latinka (cyrilice, řečtina) a záměny číslic.
  var HOMO = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j',
    'ѕ': 's', 'ԁ': 'd', 'ӏ': 'l', 'һ': 'h', 'ԛ': 'q', 'ԝ': 'w', 'к': 'k', 'м': 'm', 'т': 't',
    'в': 'b', 'н': 'h', 'г': 'r', 'ɡ': 'g', 'ο': 'o', 'α': 'a', 'ε': 'e', 'ι': 'i', 'κ': 'k',
    'ν': 'v', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x',
    '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b'
  };

  // Značky, za které se podvodníci v Česku nejčastěji vydávají.
  // kw: názvy, které hledáme v adrese. Musí tvořit celé slovo adresy, nebo jeho začátek
  //     (u názvů od 5 znaků). Nikdy je nehledáme uprostřed jiného slova.
  // official: domény ověřené 13. 10. 2026 (web odpovídá značce nebo na ni přesměrovává).
  //     Neověřené domény sem nepatří: neznámá adresa se značkou dostane jen informační nález.
  // govOfficial: u úřadů je oficiální i jakákoli adresa pod gov.cz (např. edalnice.gov.cz).
  var BRANDS = [
    { name: 'Česká pošta', kw: ['ceskaposta', 'postaonline', 'balikovna', 'posta'], official: ['ceskaposta.cz', 'postaonline.cz', 'balikovna.cz'], cat: 'package' },
    { name: 'PPL', kw: ['ppl'], official: ['ppl.cz'], cat: 'package' },
    { name: 'Zásilkovna', kw: ['zasilkovna', 'packeta'], official: ['zasilkovna.cz', 'packeta.com', 'packeta.cz'], cat: 'package' },
    { name: 'DPD', kw: ['dpd'], official: ['dpd.cz', 'dpd.com'], cat: 'package' },
    { name: 'GLS', kw: ['gls'], official: ['gls-group.eu', 'gls-group.com'], cat: 'package' },
    { name: 'DHL', kw: ['dhl'], official: ['dhl.com', 'dhl.de'], cat: 'package' },
    { name: 'Alza', kw: ['alza'], official: ['alza.cz', 'alza.sk'], cat: 'shop' },
    { name: 'ČEZ', kw: ['cez'], official: ['cez.cz'], cat: 'energy' },
    { name: 'ČSOB', kw: ['csob'], official: ['csob.cz'], cat: 'bank' },
    { name: 'Komerční banka', kw: ['kb', 'komercni', 'komercnibanka'], official: ['kb.cz'], cat: 'bank' },
    { name: 'Česká spořitelna', kw: ['ceskasporitelna', 'sporitelna', 'csas'], official: ['csas.cz', 'ceskasporitelna.cz'], cat: 'bank' },
    { name: 'Raiffeisenbank', kw: ['rb', 'raiffeisen'], official: ['rb.cz'], cat: 'bank' },
    { name: 'MONETA', kw: ['moneta'], official: ['moneta.cz'], cat: 'bank' },
    { name: 'Air Bank', kw: ['airbank'], official: ['airbank.cz'], cat: 'bank' },
    { name: 'Fio banka', kw: ['fio', 'fiobanka'], official: ['fio.cz'], cat: 'bank' },
    { name: 'mBank', kw: ['mbank'], official: ['mbank.cz'], cat: 'bank' },
    { name: 'UniCredit Bank', kw: ['unicredit'], official: ['unicreditbank.cz'], cat: 'bank' },
    { name: 'Revolut', kw: ['revolut'], official: ['revolut.com'], cat: 'bank' },
    { name: 'PayPal', kw: ['paypal'], official: ['paypal.com'], cat: 'bank' },
    { name: 'státní správa', kw: ['identita', 'datovaschranka', 'mojedatovaschranka', 'datovka', 'mojedane', 'financnisprava'], official: ['gov.cz', 'mojedatovaschranka.cz', 'financnisprava.cz', 'mojedane.cz'], govOfficial: true, cat: 'gov' },
    { name: 'elektronická dálniční známka', kw: ['edalnice', 'dalnicni', 'dalnicniznamka'], official: ['edalnice.cz'], govOfficial: true, cat: 'vignette' },
    { name: 'ČSSZ', kw: ['cssz'], official: ['cssz.cz'], govOfficial: true, cat: 'gov' },
    { name: 'VZP', kw: ['vzp'], official: ['vzp.cz'], cat: 'gov' },
    { name: 'Seznam', kw: ['seznam'], official: ['seznam.cz', 'email.cz'], cat: 'account' },
    { name: 'O2', kw: ['o2'], official: ['o2.cz'], cat: 'telco' },
    { name: 'T-Mobile', kw: ['tmobile'], official: ['t-mobile.cz'], cat: 'telco' },
    { name: 'Vodafone', kw: ['vodafone'], official: ['vodafone.cz'], cat: 'telco' },
    { name: 'Netflix', kw: ['netflix'], official: ['netflix.com'], cat: 'account' },
    { name: 'Apple', kw: ['apple', 'icloud'], official: ['apple.com', 'icloud.com'], cat: 'account' },
    { name: 'Microsoft', kw: ['microsoft', 'outlook', 'office365'], official: ['microsoft.com', 'outlook.com', 'live.com', 'office.com'], cat: 'account' },
    { name: 'Facebook', kw: ['facebook', 'instagram'], official: ['facebook.com', 'instagram.com', 'meta.com', 'fb.com'], cat: 'account' },
    { name: 'WhatsApp', kw: ['whatsapp'], official: ['whatsapp.com'], cat: 'account' },
    { name: 'České dráhy', kw: ['ceskedrahy'], official: ['cd.cz'], cat: 'shop' },
    { name: 'Vinted', kw: ['vinted'], official: ['vinted.cz', 'vinted.com'], cat: 'marketplace' },
    { name: 'Bazoš', kw: ['bazos'], official: ['bazos.cz', 'bazos.sk'], cat: 'marketplace' },
    { name: 'Sbazar', kw: ['sbazar'], official: ['sbazar.cz'], cat: 'marketplace' }
  ];

  // Slova, která podvodníci přidávají k názvu značky v adrese (csob-overeni, ppl-delivery, edalnice-cz).
  var SCAM_TOKENS = ['login', 'prihlaseni', 'prihlasit', 'overeni', 'overit', 'secure', 'security', 'verify', 'verification',
    'update', 'billing', 'payment', 'payments', 'platba', 'platby', 'pay', 'doruceni', 'delivery', 'track', 'tracking',
    'zasilka', 'balik', 'vraceni', 'refund', 'preplatek', 'podpora', 'support', 'account', 'ucet', 'bezpecnost',
    'customs', 'clo', 'online', 'service', 'servis', 'help', 'info', 'id', 'auth', 'confirm', 'potvrzeni'];

  // Bezplatné hostingy a služby, kde si web nebo formulář založí kdokoli.
  // Fungují jako veřejné přípony: o vlastníkovi rozhoduje až část před nimi.
  var FREE_HOSTING = ['web.app', 'firebaseapp.com', 'pages.dev', 'workers.dev', 'vercel.app', 'netlify.app', 'github.io',
    'glitch.me', 'herokuapp.com', 'onrender.com', 'wixsite.com', 'weebly.com', 'blogspot.com', 'webflow.io',
    'ngrok-free.app', 'ngrok.io', 'replit.app', 'square.site', 'godaddysites.com'];
  // Služby, kde obsah určuje až cesta v adrese.
  var PATH_HOSTING = ['sites.google.com', 'forms.gle', 'docs.google.com', 'forms.office.com', 'drive.google.com'];

  var BRAND_ACC = {"Česká pošta": "Českou poštu", "Zásilkovna": "Zásilkovnu", "Alza": "Alzu", "Komerční banka": "Komerční banku", "Česká spořitelna": "Českou spořitelnu", "MONETA": "MONETU", "Fio banka": "Fio banku", "státní správa": "státní úřad", "elektronická dálniční známka": "oficiální prodej dálničních známek"};
  function brandAcc(n) { return BRAND_ACC[n] || n; }

  var SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'ow.ly',
    'buff.ly', 'rebrand.ly', 'tiny.cc', 's.id', 't.ly', 'goo.gl', 'qrco.de', 'v.gd', 'shorturl.ac', 'urlz.fr', 'surl.li', 'bit.do'];

  // Koncovky, které jsou levné a v podvodných kampaních velmi časté.
  var RISKY_TLD = ['top', 'xyz', 'icu', 'click', 'online', 'site', 'live', 'cfd', 'sbs', 'buzz', 'rest',
    'cyou', 'monster', 'lol', 'mom', 'vip', 'win', 'bond', 'qpon', 'shop', 'support', 'help', 'cam',
    'fun', 'work', 'life', 'store', 'info', 'pw', 'tk', 'ml', 'ga', 'cf', 'gq', 'ru', 'su', 'cn'];

  var COMMON_TLD = ['cz', 'sk', 'com', 'net', 'org', 'eu', 'de', 'at', 'pl', 'io', 'app', 'me', 'co', 'uk', 'us', 'biz'].concat(RISKY_TLD);

  var MULTI_SUFFIX = ['co.uk', 'org.uk', 'com.au', 'com.br', 'co.jp', 'com.pl', 'com.ua', 'co.za', 'com.tr', 'com.cn'];

  // Neviditelné znaky, které prohlížeč z adresy zahodí, ale filtry spamu oklamou.
  var INVISIBLE_RE = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;

  // Pravidla pro text. Hledáme v textu bez diakritiky a malými písmeny (délka textu zůstává stejná,
  // takže umíme podezřelá místa podtrhnout přímo v původní zprávě).
  var TEXT_RULES = [
    { id: 'urgency', w: 15, title: 'Spěchá na vás',
      detail: 'Chce, abyste jednali hned a nestihli si nic ověřit.',
      re: /\b(ihned|okamzit\w*|neprodlen\w*|nalehav\w*|posledni (vyzv|upozorn|sanc)\w*|do \d{1,2} (hod|hodin|dnu|dni)\w*|do (zitr|pulnoc)\w*|vyprs\w*|propadn\w*|jeste dnes|dnes do)\b/ },
    // Žádost o zaplacení nebo poslání peněz. Pouhá zmínka o platbě (např. příchozí platba) sem nepatří.
    { id: 'payment', w: 15, cat: 'payment', title: 'Chce peníze',
      detail: 'U malých doplatků jim jde často o údaje z vaší karty. Každou žádost o peníze si ověřte jinou cestou.',
      re: /\b(doplat\w*|poplat\w*|clo|cla|celni\w*|dobirk\w*|uhrad\w*|zaplat(te|it|i|ime|ite)|neuhrazen\w*|dluzn\w*|posl\w* (mi |nam |prosim )*(penize|castku|to na ucet|\d)|na (muj |tento |nasledujici )?ucet|cislo uctu|\d{2,10}\/\d{4})\b/ },
    { id: 'amount', w: 5, title: 'Uvádí částku',
      detail: 'Nízká částka má vypadat nevinně, aby vám nepřišlo divné ji zaplatit.',
      re: /\b\d{1,3}([ .,]\d{3})*([.,]\d{1,2})?\s?(kc|czk|eur|€|,-)/ },
    { id: 'package', w: 5, cat: 'package', title: 'Píše o balíku',
      detail: 'Falešné zprávy o zásilkách jsou u nás jedním z nejčastějších podvodů.',
      re: /\b(zasilk\w*|balik\w*|baliku|doruc\w*|kuryr\w*|sledovaci cislo|prepravc\w*|vyzvednout|vyzvednuti|nedorucen\w*|postovn\w*|adres\w* (je )?neuplna|neuplna adres\w*)\b/ },
    { id: 'credentials', w: 20, cat: 'credentials', title: 'Chce vaše údaje',
      detail: 'Pošta, banka ani úřad po vás přes odkaz nikdy nechtějí heslo, PIN, kartu ani kód z SMS.',
      re: /\b(heslo|hesla|prihlas\w*|overte|overit|overeni (uctu|totoznosti|udaju)|aktualizuj\w* (udaje|informace|ucet)|potvrdte kartu|cislo karty|udaje (z|o) karty|udaje karty|cvv|cvc|pin|kod z sms|overovaci kod|jednorazov\w* kod|potvrzovaci kod|nadiktuj\w*)\b/ },
    { id: 'bankstaff', w: 30, cat: 'bank', title: 'Scénář falešného bankéře',
      detail: 'Bezpečný účet neexistuje. Skutečná banka nikdy nechce, abyste peníze někam převáděli.',
      re: /\b(bezpecn\w* ucet|bezpecnostni\w* oddeleni\w*|podezrel\w* (transakc|platb|prihlas)\w*|vas ucet (je|byl) (ohrozen|napaden|zneuzit)\w*|prevedte (penize|uspory|prostredky)|prevest (penize|uspory|prostredky)|ochran\w* (vasich )?(uspor|penez))\b/ },
    { id: 'threat', w: 15, title: 'Straší vás',
      detail: 'Hrozí zablokováním, pokutou, exekucí nebo policií, abyste zpanikařili.',
      re: /\b(zablokovan\w*|zablokujeme|blokac\w*|pozastaven\w*|zrusen\w* (uctu|sluzby|zasilky)|exekuc\w*|pokut\w*|trestni (oznameni|rizeni|stihani)|soudni\w*|vymahan\w*|bude vracen\w*)\b/ },
    { id: 'prize', w: 15, cat: 'prize', title: 'Slibuje výhru',
      detail: 'Výhra v soutěži, do které jste se nepřihlásili, je klasická návnada.',
      re: /\b(vyhral\w*|vyhra|vyhry|gratulujeme|odmen\w*|darek zdarma|zdarma ziskat|losovani|vylosovan\w*|byli jste vybran\w*)\b/ },
    { id: 'invest', w: 15, cat: 'invest', title: 'Slibuje snadný zisk',
      detail: 'Garantovaný zisk neexistuje. Takhle často začínají investiční podvody.',
      re: /\b(investic\w*|investov\w*|kryptomen\w*|bitcoin\w*|garantovan\w* (zisk|vynos)\w*|zhodnocen\w*|pasivni prijem|obchodni platform\w*|broker\w*)\b/ },
    { id: 'job', w: 20, cat: 'job', title: 'Nabízí snadný výdělek',
      detail: 'Vysoký výdělek za lajkování, hodnocení nebo jednoduché úkoly je známý pracovní podvod. Nakonec chtějí peníze po vás.',
      re: /\b(prace z domova|brigadnik\w*|privydel\w*|vydel\w* (az |si )?\d|vydelek (az )?\d|\d+ ?kc (denne|za hodinu|za den|mesicne)|hodnoceni produkt\w*|lajkovan\w*|jednoduche ukoly)\b/ },
    { id: 'family', w: 15, cat: 'family', title: 'Píše jako někdo z rodiny',
      detail: 'Ahoj mami nebo ahoj tati z neznámého čísla je typický začátek podvodu, který končí prosbou o peníze.',
      re: /\b(ahoj (mami|mamko|mamino|maminko|tati|tato|tatinku|babi|babicko|dedo|dedecku)|rozbil\w* (se mi )?(telefon|mobil)|ztratil\w* (jsem )?(telefon|mobil))\b/ },
    { id: 'newnumber', w: 10, cat: 'newnumber', title: 'Oznamuje nové číslo',
      detail: 'Samo o sobě je to běžné. Pokud ale z nového čísla přijde prosba o peníze, nejdřív zavolejte na staré číslo.',
      re: /\b((moje )?nove cislo|uloz\w* si (ho|toto|tohle|me|moje|cislo))\b/ },
    { id: 'messenger', w: 10, cat: 'messenger', title: 'Chce pokračovat jinde',
      detail: 'Podvodníci rádi převádějí hovor na WhatsApp nebo Telegram, kde je bazar ani banka nechrání.',
      re: /\b(napis\w* (mi|nam) (na|pres) (whats\s?app|telegram\w*|signal|viber)|kontaktujte nas (na|pres) (whats\s?app|telegram\w*)|na telegramu|pres whats\s?app)\b/ },
    { id: 'remote', w: 30, cat: 'remote', title: 'Chce se dostat do vašeho zařízení',
      detail: 'Přes AnyDesk nebo TeamViewer by cizí člověk viděl a ovládal i vaše bankovnictví.',
      re: /\b(anydesk|teamviewer|rustdesk|quick ?support|vzdalen\w* (pristup|sprav\w*|plo\w*)|nainstalujte (si )?(prosim )?(aplikaci|program)|stahnete (si )?(aplikaci|program))\b/ },
    { id: 'refund', w: 15, cat: 'gov', title: 'Slibuje vrácení peněz',
      detail: 'Přeplatek vám nikdo nevrací přes odkaz, kde máte zadat kartu.',
      re: /\b(preplat\w*|vratk\w* dane|vraceni (penez|platby|dane|preplatku)|refundac\w*|narok na vraceni)\b/ },
    { id: 'vignette', w: 10, cat: 'vignette', title: 'Dálniční známka',
      detail: 'Elektronickou dálniční známku prodává stát na edalnice.cz.',
      re: /\b(dalnicni znamk\w*|edalnic\w*|e-znamk\w*)\b/ },
    { id: 'qr', w: 0, cat: 'qr', title: 'Chce naskenovat QR kód',
      detail: 'QR kód skrývá, kam vede nebo komu platíte. Ve spojení s výhrůžkou nebo nátlakem je to varovný znak.',
      re: /\b(naskenuj\w*|naskenovan\w*|qr ?kod\w*|qr platb\w*)\b/ },
    { id: 'callback', w: 5, cat: 'callback', title: 'Chce, abyste zavolali',
      detail: 'Číslo ve zprávě může patřit podvodníkovi. Volejte jen na číslo z oficiálního webu nebo z karty.',
      re: /\b((za)?volejte|ozvete se|kontaktujte nas) (ihned |prosim |na )*(tel\w*|cislo|\+?\d{3})/ },
    { id: 'marketplace', w: 20, cat: 'marketplace', title: 'Chce kartu, abyste dostali peníze',
      detail: 'K přijetí platby kartu nikdy nezadáváte. Kupujícímu stačí číslo vašeho účtu.',
      re: /\b(prijmout platbu|prijeti platby|obdrzet (penize|platbu)|obdrzeni (penez|platby)|zaplatil\w* (jsem )?vam|platba (je )?(pripravena|cekajici)|bezpecn\w* (platb|prodej|nakup)\w*|kuryr si (zbozi|vec)\w* vyzvedne|odkaz na prijeti)\b/ },
    { id: 'generic', w: 5, title: 'Neosobní oslovení',
      detail: 'Zpráva nejspíš odešla hromadně na tisíce lidí.',
      re: /\b(vazen\w* (zakazni|klient|uzivatel)\w*|dear customer)\b/ }
  ];

  // Kombinace, které jsou nebezpečnější než jednotlivé znaky dohromady.
  // floor: minimální úroveň, kterou kombinace vyžaduje; answerFloor: úroveň, pod kterou ji nestáhne žádná odpověď.
  var COMBOS = [
    { id: 'family-money', needs: ['family|newnumber', 'payment'], w: 30, floor: 'high', answerFloor: 'mid', title: 'Nové číslo a žádost o peníze',
      detail: 'Někdo z neznámého čísla píše jako váš blízký a chce peníze. Než cokoli pošlete, zavolejte na jeho staré číslo.' },
    { id: 'qr-pressure', needs: ['qr', 'threat|urgency|credentials|payment'], w: 20, floor: 'mid', answerFloor: 'mid', title: 'QR kód pod nátlakem',
      detail: 'Výzva naskenovat QR kód spolu s výhrůžkou nebo spěchem je známý podvod. Kód může vést na falešnou stránku nebo cizí účet.' },
    { id: 'job-contact', needs: ['job', 'messenger|callback'], w: 15, floor: 'mid', answerFloor: 'mid', title: 'Výdělek přes chat',
      detail: 'Nabídka snadné práce s přesunem na WhatsApp nebo Telegram je typický pracovní podvod.' },
    { id: 'callback-threat', needs: ['callback', 'threat|bank'], w: 15, floor: 'mid', answerFloor: 'mid', title: 'Výhrůžka a telefonní číslo',
      detail: 'Zpráva straší a chce, abyste zavolali na její číslo. Volejte jen na číslo, které si sami najdete.' }
  ];

  /* ---------- Pomocné funkce ---------- */

  function stripDiacritics(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // Normalizace znak po znaku: stejná délka jako originál, aby seděly pozice.
  function normKeep(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (/\s/.test(ch)) { out += ' '; continue; }
      var d = ch.normalize('NFD').charAt(0).toLowerCase().charAt(0);
      out += d || ch;
    }
    return out;
  }

  function skeleton(s) {
    var out = '';
    var lower = String(s).toLowerCase();
    for (var i = 0; i < lower.length; i++) {
      var ch = lower[i];
      out += Object.prototype.hasOwnProperty.call(HOMO, ch) ? HOMO[ch] : ch;
    }
    return stripDiacritics(out).replace(/rn/g, 'm').replace(/vv/g, 'w');
  }

  function scriptOf(ch) {
    if (/[\u0400-\u04FF\u0500-\u052F]/.test(ch)) return 'cyrillic';
    if (/[\u0370-\u03FF]/.test(ch)) return 'greek';
    if (/[a-z]/i.test(ch)) return 'latin';
    if (/[\u00C0-\u024F]/.test(ch)) return 'latin';
    return 'other';
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1);
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      cur[0] = i;
      for (var k = 1; k <= n; k++) {
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  function registrable(host) {
    var p = host.split('.').filter(Boolean);
    if (p.length <= 2) return p.join('.');
    var last2 = p.slice(-2).join('.');
    if (MULTI_SUFFIX.indexOf(last2) !== -1 || FREE_HOSTING.indexOf(last2) !== -1) return p.slice(-3).join('.');
    return last2;
  }

  // Dekódování punycode (RFC 3492), aby šly odhalit domény jako xn--80ak6aa92e (apple v azbuce).
  function punyDecodeLabel(label) {
    if (label.indexOf('xn--') !== 0) return label;
    var input = label.slice(4);
    var base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, n = 128, bias = 72, i = 0, output = [];
    var basic = input.lastIndexOf('-');
    if (basic > 0) for (var j = 0; j < basic; j++) output.push(input.charCodeAt(j));
    var idx = basic > 0 ? basic + 1 : 0;
    function adapt(delta, numPoints, first) {
      delta = first ? Math.floor(delta / damp) : delta >> 1;
      delta += Math.floor(delta / numPoints);
      var k = 0;
      while (delta > ((base - tMin) * tMax) >> 1) { delta = Math.floor(delta / (base - tMin)); k += base; }
      return k + Math.floor((base - tMin + 1) * delta / (delta + skew));
    }
    while (idx < input.length) {
      var oldi = i, w = 1;
      for (var k = base; ; k += base) {
        if (idx >= input.length) return label;
        var c = input.charCodeAt(idx++);
        var digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
        if (digit >= base) return label;
        i += digit * w;
        var t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
        if (digit < t) break;
        w *= base - t;
      }
      var len = output.length + 1;
      bias = adapt(i - oldi, len, oldi === 0);
      n += Math.floor(i / len);
      i %= len;
      output.splice(i++, 0, n);
    }
    try { return String.fromCodePoint.apply(null, output); } catch (e) { return label; }
  }
  function punyDecode(host) { return host.split('.').map(punyDecodeLabel).join('.'); }

  function endsWithDomain(host, domain) {
    return host === domain || host.slice(-(domain.length + 1)) === '.' + domain;
  }

  /* ---------- Hledání odkazů ---------- */

  var STOP = '\\s<>"\'„“”‚‘’«»';
  var SCHEME_RE = new RegExp('(?:https?:\\/\\/|www\\.)[^' + STOP + ']+', 'gi');
  var BARE_RE = new RegExp('(^|[\\s(\\[<"\'„“:,;])((?:[a-z0-9\\u00a1-\\uffff](?:[a-z0-9\\u00a1-\\uffff-]{0,61}[a-z0-9\\u00a1-\\uffff])?\\.)+([a-z\\u00a1-\\uffff]{2,24}))((?::\\d{2,5})?(?:\\/[^' + STOP + ']*)?)', 'gi');

  function trimTrail(s) {
    return s.replace(/[.,;:!?)\]}"'»”“…\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]+$/, '');
  }

  // Vrací odkazy i s pozicí v textu: [{ raw, start, end }]
  function findUrls(text) {
    var found = [];
    var m;
    SCHEME_RE.lastIndex = 0;
    while ((m = SCHEME_RE.exec(text))) {
      var raw = trimTrail(m[0]);
      found.push({ raw: raw, start: m.index, end: m.index + raw.length });
    }
    BARE_RE.lastIndex = 0;
    while ((m = BARE_RE.exec(text))) {
      var start = m.index + m[1].length;
      var inside = found.some(function (f) { return start >= f.start && start < f.end; });
      if (inside) continue;
      var tld = skeleton(m[3]);
      var hasPath = m[4] && m[4].length > 1;
      if (COMMON_TLD.indexOf(tld) === -1 && !hasPath) continue;
      if (text[start - 1] === '@') continue;
      var r = trimTrail(m[2] + (m[4] || ''));
      found.push({ raw: r, start: start, end: start + r.length });
    }
    var seen = {};
    return found.filter(function (u) {
      var k = u.raw.toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    }).sort(function (a, b) { return a.start - b.start; });
  }

  function parseUrl(raw) {
    var s = trimTrail(raw);
    var hadScheme = /^https?:\/\//i.test(s);
    var withScheme = hadScheme ? s : 'http://' + s;
    var u;
    try { u = new URL(withScheme); } catch (e) { return null; }
    var am = withScheme.match(/^https?:\/\/([^\/?#]+)/i);
    var authority = am ? am[1] : '';
    var userinfo = '';
    var at = authority.lastIndexOf('@');
    if (at !== -1) { userinfo = authority.slice(0, at); authority = authority.slice(at + 1); }
    var rawHost = authority.replace(/:\d+$/, '').toLowerCase().replace(/\.$/, '');
    var asciiHost = u.hostname.toLowerCase().replace(/\.$/, '');
    return {
      raw: s,
      hadScheme: hadScheme,
      secure: /^https:/i.test(s),
      rawHost: rawHost,
      asciiHost: asciiHost,
      userinfo: userinfo,
      path: (u.pathname === '/' ? '' : u.pathname) + u.search
    };
  }

  /* ---------- Rozbor jednoho odkazu ---------- */

  // Najde značku v adrese. Název musí být celé slovo adresy nebo jeho začátek (od 5 znaků),
  // u víceslovných názvů i přes pomlčky (financni-sprava). Nikdy uprostřed jiného slova.
  function matchBrand(labels) {
    // labels: [{ text: 'csob-overeni', sub: true|false }] v kostře (bez diakritiky a záměn písmen)
    for (var b = 0; b < BRANDS.length; b++) {
      var br = BRANDS[b];
      for (var l = 0; l < labels.length; l++) {
        var lab = labels[l];
        var tokens = lab.text.split('-').filter(Boolean);
        var joined = lab.text.replace(/-/g, '');
        for (var k = 0; k < br.kw.length; k++) {
          var kw = br.kw[k];
          var exact = tokens.indexOf(kw) !== -1 || joined === kw;
          var prefix = !exact && kw.length >= 5 && (tokens.some(function (t) { return t.indexOf(kw) === 0; }) || joined.indexOf(kw) === 0);
          if (exact || prefix) return { brand: br, how: exact ? 'exact' : 'prefix', sub: lab.sub, label: lab.text };
        }
      }
    }
    // Překlep: slovo se liší o jedno písmeno (u dlouhých názvů o dvě) a začíná stejně.
    for (var b2 = 0; b2 < BRANDS.length; b2++) {
      var br2 = BRANDS[b2];
      for (var l2 = 0; l2 < labels.length; l2++) {
        var toks = labels[l2].text.split('-').filter(Boolean);
        for (var k2 = 0; k2 < br2.kw.length; k2++) {
          var kw2 = br2.kw[k2];
          if (kw2.length < 6) continue;
          var lim = kw2.length >= 9 ? 2 : 1;
          var hit = toks.some(function (t) {
            return t.length >= 5 && t[0] === kw2[0] && t !== kw2 && t.indexOf(kw2) !== 0 &&
              Math.abs(t.length - kw2.length) <= lim && levenshtein(t, kw2) <= lim;
          });
          if (hit) return { brand: br2, how: 'typo', sub: labels[l2].sub, label: labels[l2].text };
        }
      }
    }
    return null;
  }

  function isOfficial(brand, ascii) {
    if (brand.govOfficial && endsWithDomain(ascii, 'gov.cz')) return true;
    return brand.official.some(function (d) { return endsWithDomain(ascii, d); });
  }

  function analyzeUrl(raw) {
    var p = parseUrl(raw);
    if (!p) return null;
    var findings = [];
    var invisible = INVISIBLE_RE.test(p.rawHost);
    INVISIBLE_RE.lastIndex = 0;
    var cleanRaw = p.rawHost.replace(INVISIBLE_RE, '');
    var ascii = p.asciiHost;
    // Pro rozbor písmen použijeme dekódovanou podobu (punycode → unicode).
    var host = /(^|\.)xn--/.test(cleanRaw) ? punyDecode(cleanRaw) : cleanRaw;
    var reg = registrable(ascii);
    var regRaw = registrable(host);
    var tld = ascii.split('.').pop();
    var add = function (code, sev, title, detail) { findings.push({ code: code, sev: sev, title: title, detail: detail }); };

    var chars = [];
    var scripts = {};
    for (var i = 0; i < host.length; i++) {
      var ch = host[i];
      var sc = scriptOf(ch);
      if (sc !== 'other') scripts[sc] = true;
      chars.push({ ch: ch, kind: (sc === 'cyrillic' || sc === 'greek') ? sc : 'plain' });
    }
    var foreign = chars.filter(function (c) { return c.kind !== 'plain'; });
    var otherScript = /[^\u0000-ɏ.\-]/.test(host.replace(/[Ͱ-ϿЀ-ԯ]/g, ''));

    if (foreign.length) {
      add('homoglyph', 'high', 'Falešná písmena v adrese',
        'Červeně označená písmena jsou z azbuky nebo řečtiny. Vypadají jako naše, ale adresa vede jinam, než se zdá.');
    } else if (otherScript) {
      add('idn-script', 'low', 'Neobvyklé písmo v adrese', 'Adresa používá písmo, které české weby běžně nemají.');
    }
    if (invisible) {
      add('invisible', 'mid', 'Neviditelný znak v adrese',
        'V adrese je skrytý znak, který není vidět. Podvodníci ho vkládají, aby obešli filtry spamu.');
    }
    if (p.userinfo) {
      add('userinfo', 'high', 'Trik se zavináčem', 'Všechno před znakem @ je jen kulisa. Ve skutečnosti se otevře ' + host + '.');
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ascii)) {
      add('ip', 'high', 'Místo názvu jen čísla', 'Slušné firmy neposílají odkazy na číselnou adresu serveru.');
    }
    var isShort = SHORTENERS.some(function (d) { return endsWithDomain(ascii, d); });
    if (isShort) {
      add('shortener', 'mid', 'Zkrácený odkaz', 'Nevidíte, kam doopravdy vede. Seriózní firmy ve zprávách zkracovače používají jen výjimečně.');
    }

    // Značka v adrese
    var hostLabels = skeleton(host).split('.');
    var regLabelCount = regRaw.split('.').length;
    var labels = hostLabels.map(function (t, idx) { return { text: t, sub: idx < hostLabels.length - regLabelCount }; })
      .slice(0, -1); // koncovku (.cz, .com) za značku nepovažujeme
    var hosting = FREE_HOSTING.filter(function (d) { return endsWithDomain(ascii, d); })[0] ||
      PATH_HOSTING.filter(function (d) { return endsWithDomain(ascii, d); })[0] || null;
    // u hostingů hledáme značku i v cestě (sites.google.com/view/ceskaposta)
    var pathLabels = hosting ? skeleton(decodeURIComponentSafe(p.path)).split(/[\/?=&_.#]+/).filter(Boolean).map(function (t) { return { text: t, sub: false, path: true }; }) : [];
    if (hosting) {
      // vlastní název hostingu (web, app, github…) za značku nepovažujeme
      var hostingParts = hosting.split('.').length;
      labels = hostLabels.slice(0, hostLabels.length - hostingParts).map(function (t) { return { text: t, sub: false }; });
    }
    var match = matchBrand(labels.concat(pathLabels));
    var brand = match ? match.brand : null;
    var official = !!brand && !foreign.length && !hosting && isOfficial(brand, ascii);
    // Oficiální doména bez rozpoznané značky v adrese (např. cd.cz)
    if (!brand && !foreign.length) {
      for (var b = 0; b < BRANDS.length && !brand; b++) {
        if (isOfficial(BRANDS[b], ascii)) { brand = BRANDS[b]; official = true; }
      }
    }

    var summary;
    if (official) {
      add('official', 'ok', 'Oficiální web: ' + brand.name,
        'Adresa patří mezi oficiální adresy, které máme ověřené. I tak je nejjistější otevřít aplikaci nebo web sami, ne přes odkaz ve zprávě.');
      summary = { kind: 'official', brand: brand.name, goes: reg };
    } else if (brand) {
      var regLabel = skeleton(regRaw.split('.')[0]);
      var regTokens = regLabel.split('-');
      var scamToken = regTokens.filter(function (t) { return SCAM_TOKENS.indexOf(t) !== -1 || (t === 'cz' && tld !== 'cz') || (t === 'sk' && tld !== 'sk'); })[0];
      var risky = RISKY_TLD.indexOf(tld) !== -1;
      var prefixOfficial = brand.official.filter(function (d) {
        return ascii.indexOf(d + '.') === 0 || ascii.indexOf('.' + d + '.') !== -1 || ascii.indexOf(d + '-') === 0 || ascii.indexOf('.' + d + '-') !== -1;
      })[0];
      var acc = brandAcc(brand.name);
      if (hosting) {
        add('free-hosting', 'high', 'Název ' + brand.name + ' na bezplatném webu',
          'Stránka běží na službě ' + hosting + ', kde si web založí kdokoli. ' + brand.name + ' tam své služby neprovozuje, nikde tam nic nevyplňujte.');
        summary = { kind: 'fake', brand: brand.name, brandAcc: acc, real: brand.official[0], goes: hosting };
      } else if (foreign.length) {
        add('brand-fake', 'high', 'Napodobuje ' + acc, 'Název je složený z písmen, která jen vypadají jako latinka. Oficiální web je ' + brand.official[0] + '.');
        summary = { kind: 'fake', brand: brand.name, brandAcc: acc, real: brand.official[0], goes: reg };
      } else if (match.how === 'typo') {
        add('brand-typo', 'high', 'Napodobuje ' + acc, 'Název se od skutečného liší jen o písmeno. Oficiální web je ' + brand.official[0] + '.');
        summary = { kind: 'fake', brand: brand.name, brandAcc: acc, real: brand.official[0], goes: reg };
      } else if (match.sub || prefixOfficial) {
        add('brand-subdomain', 'high', 'Napodobuje ' + acc,
          (prefixOfficial ? 'Adresa začíná jako ' + prefixOfficial + ', ale rozhoduje její konec: ' + reg + '.' : 'Název ' + brand.name + ' je jen na začátku adresy. Rozhoduje její konec: ' + reg + '.') +
          ' Oficiální web je ' + brand.official[0] + '.');
        summary = { kind: 'fake', brand: brand.name, brandAcc: acc, real: brand.official[0], goes: reg };
      } else if (scamToken || risky) {
        add('brand-fake', 'high', 'Napodobuje ' + acc,
          'Adresa spojuje název ' + brand.name + (scamToken ? ' se slovem „' + scamToken + '“' : '') + (risky ? (scamToken ? ' a' : '') + ' s koncovkou .' + tld : '') +
          '. Tak podvodníci stavějí falešné weby. Oficiální web je ' + brand.official[0] + '.');
        summary = { kind: 'fake', brand: brand.name, brandAcc: acc, real: brand.official[0], goes: reg };
      } else {
        add('brand-mention', 'info', 'Adresa obsahuje název ' + brand.name,
          'Tuto adresu nemáme mezi ověřenými adresami ' + brand.name + '. Samo o sobě to nic neznamená, ale pokud po vás chce údaje nebo platbu, ověřte si ji. Oficiální web je ' + brand.official[0] + '.');
        summary = { kind: 'mention', brand: brand.name, goes: reg };
      }
    } else {
      summary = { kind: 'unknown', goes: reg };
    }

    if (hosting && !brand) {
      add('free-hosting', 'low', 'Web na bezplatné službě', 'Stránka běží na ' + hosting + ', kde si web nebo formulář založí kdokoli. Nemusí to být podvod, ale nic tam nevyplňujte bez ověření.');
    }
    if (!official && RISKY_TLD.indexOf(tld) !== -1 && !isShort) {
      add('risky-tld', 'mid', 'Podezřelá koncovka .' + tld, 'Levná koncovka, kterou podvodníci často používají. České firmy mají většinou .cz.');
    }
    var hostParts = ascii.split('.');
    if (!official && !hosting && (hostParts.length >= 5 || (regRaw.split('.')[0].match(/-/g) || []).length >= 2)) {
      add('complex', 'low', 'Zamotaná adresa', 'Spousta teček a pomlček má schovat, kam odkaz opravdu vede.');
    }
    if (p.hadScheme && !p.secure && !official) {
      add('http', 'low', 'Nešifrovaná stránka', 'Odkaz nepoužívá https. Na takové stránce nikdy nic nevyplňujte.');
    }

    var score = 0;
    findings.forEach(function (f) {
      if (f.sev === 'high') score += 40;
      else if (f.sev === 'mid') score += 15;
      else if (f.sev === 'low') score += 5;
    });
    if (official && score === 0) score = -10;

    var order = { high: 4, mid: 3, low: 2, info: 1, ok: 0 };
    var worst = findings.reduce(function (acc2, f) { return order[f.sev] > order[acc2] ? f.sev : acc2; }, findings.length ? 'ok' : 'none');

    return {
      raw: p.raw,
      host: host,
      ascii: ascii,
      registrable: reg,
      registrableRaw: regRaw,
      path: p.path,
      chars: chars,
      foreign: foreign.length > 0,
      brand: brand ? brand.name : null,
      brandCat: brand ? brand.cat : null,
      official: official,
      hosting: hosting,
      summary: summary,
      findings: findings,
      worst: worst,
      score: score
    };
  }

  function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  /* ---------- Rozbor textu ---------- */

  function analyzeText(text, skip) {
    skip = skip || [];
    var inSkip = function (sp) { return skip.some(function (k) { return sp[0] < k[1] && sp[1] > k[0]; }); };
    var norm = normKeep(text);
    var byId = {};
    var findings = [];
    var cats = {};
    var score = 0;

    TEXT_RULES.forEach(function (r) {
      var re = new RegExp(r.re.source, 'g');
      var m, spans = [];
      while ((m = re.exec(norm)) && spans.length < 4) {
        if (!m[0]) { re.lastIndex++; continue; }
        var sp = [m.index, m.index + m[0].length];
        if (!inSkip(sp)) spans.push(sp);
      }
      if (!spans.length) return;
      var key = r.group || r.id;
      if (byId[key]) {
        byId[key].spans = byId[key].spans.concat(spans);
      } else {
        byId[key] = { sev: r.w >= 25 ? 'high' : (r.w >= 15 ? 'mid' : 'low'), title: r.title, detail: r.detail, rule: key, code: key, spans: spans };
        findings.push(byId[key]);
      }
      score += r.w;
      if (r.cat) cats[r.cat] = true;
    });

    // Slova, která míchají latinku s azbukou
    var wre = /\S+/g, w, mixed = [];
    while ((w = wre.exec(text))) {
      var wsp = [w.index, w.index + w[0].length];
      if (/[a-z]/i.test(w[0]) && /[\u0400-\u04FF]/.test(w[0]) && !inSkip(wsp)) mixed.push(wsp);
    }
    if (mixed.length) {
      findings.push({
        sev: 'high',
        title: 'Falešná písmena v textu',
        detail: 'Některá písmena jsou z azbuky. Běžná firma tohle nedělá, podvodníci tak obcházejí filtry spamu.',
        rule: 'mixedscript',
        code: 'mixedscript',
        spans: mixed.slice(0, 4)
      });
      score += 25;
    }

    // U bazarového podvodu je „zaplatil jsem vám“ součást triku, ne žádost o zaplacení
    if (byId.marketplace && byId.payment) {
      findings = findings.filter(function (f) { return f.rule !== 'payment'; });
      delete byId.payment;
      score -= 15;
    }
    if (mixed.length) byId.mixedscript = true;

    var order = { high: 0, mid: 1, low: 2 };
    findings.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    return { findings: findings, cats: cats, score: score, ids: Object.keys(byId) };
  }

  /* ---------- Doptávací otázky ---------- */

  // risky: ctx.risky = zpráva chce peníze, údaje, kód, vzdálený přístup nebo obsahuje neověřený odkaz
  var QUESTIONS = [
    {
      id: 'expect',
      when: function (c) { return c.cats.package; },
      text: 'Čekáte teď nějaký balík?',
      options: [
        { v: 'no', label: 'Nečekám', delta: 20, note: 'Zpráva o balíku, který nečekáte, bývá podvod. Nic neplaťte a nic nevyplňujte.' },
        { v: 'yes', label: 'Čekám', delta: 0, note: 'Podvodníci sázejí právě na to. Stav zásilky si ověřte v aplikaci dopravce, ne přes odkaz ve zprávě.' },
        { v: 'unsure', label: 'Nevím', delta: 5 }
      ]
    },
    {
      id: 'familycheck',
      when: function (c) { return c.cats.family || c.cats.newnumber; },
      text: 'Zkusili jste zavolat na jeho staré, uložené číslo?',
      options: [
        { v: 'no', label: 'Ještě ne', delta: 15, note: 'Zavolejte na číslo, které máte uložené. Pokud to opravdu píše vaše dítě nebo vnouče, hned se to vysvětlí.' },
        { v: 'yes-other', label: 'Ano, o ničem neví', delta: 40, note: 'Pak se za vašeho blízkého někdo vydává. Nic neposílejte a číslo zablokujte.' },
        { v: 'yes-ok', label: 'Ano, potvrdil to', delta: -25, clears: ['family', 'newnumber'],
          note: 'Ověřit hlas na starém čísle je správný krok. Pokud ale chce peníze, nechte si číslo účtu potvrdit přímo v tom hovoru. Podvodník může psát i po skutečném hovoru.' }
      ]
    },
    {
      id: 'call',
      when: function (c) { return c.cats.bank || c.cats.remote || c.cats.invest; },
      text: 'Volal vám k tomu někdo, kdo tvrdil, že je z banky nebo z policie?',
      options: [
        { v: 'yes', label: 'Ano, volal', delta: 30, note: 'Zavěste. Pak sami zavolejte své bance na číslo ze zadní strany karty a zeptejte se, jestli je všechno v pořádku.' },
        { v: 'no', label: 'Ne', delta: 0 }
      ]
    },
    {
      id: 'selling',
      when: function (c) { return c.cats.marketplace || (c.cats.payment && c.hasUrl && c.trade); },
      text: 'Prodáváte teď něco na bazaru nebo na Vinted?',
      options: [
        { v: 'yes', label: 'Ano, prodávám', delta: 20, note: 'Kupující, který vám posílá odkaz k přijetí peněz, je podvodník. Stačí mu dát číslo účtu.' },
        { v: 'no', label: 'Ne', delta: 0 }
      ]
    },
    {
      id: 'sender',
      when: function () { return true; },
      text: 'Znáte číslo nebo adresu, odkud zpráva přišla?',
      options: [
        // Neznámý odesílatel zvyšuje riziko jen tam, kde zpráva něco chce.
        { v: 'unknown', label: 'Neznám', delta: 10, onlyIfRisky: true },
        { v: 'known', label: 'Znám', delta: -5, note: 'I známý účet může někdo ukrást. Když chce peníze nebo údaje, ověřte si to telefonem.' },
        { v: 'unsure', label: 'Nevím', delta: 5, onlyIfRisky: true }
      ]
    },
    {
      id: 'acted',
      when: function () { return true; },
      text: 'Už jste na něco klikli, něco vyplnili nebo zaplatili?',
      options: [
        { v: 'no', label: 'Zatím ne', delta: 0, note: 'Výborně. Tak to nechte.' },
        { v: 'yes', label: 'Ano', delta: 0, help: true }
      ]
    }
  ];

  /* ---------- Celkové vyhodnocení ---------- */

  var TRADE_RE = /\b(prodej\w*|prodava\w*|koupi\w*|kupuj\w*|kupec|inzer\w*|bazar\w*|vinted|bazos|sbazar|zbozi)\b/;
  var RISKY_CATS = ['payment', 'credentials', 'remote', 'bank', 'marketplace', 'invest', 'job', 'qr', 'prize'];
  var LEVEL_ORDER = { low: 0, mid: 1, high: 2 };
  var LEVEL_MIN = { low: 0, mid: 25, high: 55 };
  function levelOf(score) { return score >= 55 ? 'high' : (score >= 25 ? 'mid' : 'low'); }
  function maxLevel(a, b) { return LEVEL_ORDER[a] >= LEVEL_ORDER[b] ? a : b; }

  function analyze(text) {
    text = String(text || '');
    var found = findUrls(text);
    var urls = found.map(function (f) {
      var u = analyzeUrl(f.raw);
      if (u) { u.start = f.start; u.end = f.end; }
      return u;
    }).filter(Boolean);
    var t = analyzeText(text, found.map(function (f) { return [f.start, f.end]; }));
    var cats = t.cats;
    urls.forEach(function (u) { if (u.brandCat && !u.official && u.summary.kind === 'fake') cats[u.brandCat] = true; });
    var present = {};
    t.ids.forEach(function (id) { present[id] = true; });
    Object.keys(cats).forEach(function (c) { present[c] = true; });

    // Kombinace znaků
    var combos = [];
    var comboScore = 0;
    COMBOS.forEach(function (c) {
      var ok = c.needs.every(function (alt) { return alt.split('|').some(function (x) { return present[x]; }); });
      if (!ok) return;
      combos.push(c);
      comboScore += c.w;
      t.findings.push({ sev: c.floor === 'high' ? 'high' : 'mid', title: c.title, detail: c.detail, rule: c.id, code: c.id, spans: [], combo: true });
    });

    return {
      text: text,
      urls: urls,
      textFindings: t.findings,
      textScore: t.score + comboScore,
      combos: combos,
      cats: cats,
      present: present,
      trade: TRADE_RE.test(normKeep(text)),
      hasUrl: urls.length > 0,
      empty: !text.trim()
    };
  }

  function questionsFor(a) {
    var ctx = { cats: a.cats, hasUrl: a.hasUrl, trade: a.trade };
    return QUESTIONS.filter(function (q) { return q.when(ctx); });
  }

  /* Vyhodnocení.
   * 1) Obsah zprávy dá skóre a minimální úrovně (tvrdé signály).
   * 2) Odpovědi skóre upraví, ale tvrdé signály neodstraní:
   *    - falešný odkaz, falešný bankéř, vzdálený přístup a azbuka v textu: vždy vysoké riziko,
   *    - podezřelé kombinace (nové číslo + peníze, QR pod nátlakem…): aspoň jejich úroveň,
   *      jen „nové číslo + peníze“ smí potvrzení identity snížit, nejvýš na zvýšené riziko,
   *    - žádost o peníze, údaje, kód nebo prodej přes odkaz: aspoň zvýšené riziko, pokud jím zpráva byla.
   * 3) Skóre a úroveň jsou vždy v souladu: úroveň odpovídá prahu skóre.
   */
  function evaluate(a, answers) {
    answers = answers || {};
    var score = a.textScore;
    var urlHigh = false, unknownLink = false;
    a.urls.forEach(function (u) {
      score += u.score;
      if (u.findings.some(function (f) { return f.sev === 'high'; })) urlHigh = true;
      if (!u.official) unknownLink = true;
    });
    if (unknownLink && (a.present.payment || a.present.credentials)) score += 15;
    var ids = a.present;

    // Minimální úrovně z obsahu
    var floors = [];
    if (urlHigh) floors.push({ level: 'high', why: 'odkaz' });
    ['bankstaff', 'remote', 'mixedscript'].forEach(function (k) { if (ids[k]) floors.push({ level: 'high', why: k }); });
    a.combos.forEach(function (c) { floors.push({ level: c.floor, why: c.id, clearedBy: c.id === 'family-money' ? 'family' : null, clearedTo: c.answerFloor }); });
    var contentScore = Math.max(0, Math.min(100, score));
    var contentLevel = floors.reduce(function (l, f) { return maxLevel(l, f.level); }, levelOf(contentScore));
    if (contentLevel !== 'low' && ['payment', 'credentials', 'marketplace', 'invest', 'job'].some(function (k) { return ids[k]; })) {
      floors.push({ level: 'mid', why: 'zadost' });
    }

    // Odpovědi
    var risky = unknownLink || RISKY_CATS.some(function (k) { return ids[k]; });
    var notes = {}, needHelp = false, cleared = {};
    questionsFor(a).forEach(function (q) {
      var opt = q.options.filter(function (o) { return o.v === answers[q.id]; })[0];
      if (!opt) return;
      if (!(opt.onlyIfRisky && !risky)) score += opt.delta;
      if (opt.note) notes[q.id] = opt.note;
      if (opt.help) needHelp = true;
      if (opt.delta >= 30) floors.push({ level: 'high', why: 'odpoved-' + q.id });
      (opt.clears || []).forEach(function (c) { cleared[c] = true; });
    });

    var minLevel = floors.reduce(function (l, f) {
      var lvl = (f.clearedBy && cleared[f.clearedBy]) ? f.clearedTo : f.level;
      return maxLevel(l, lvl);
    }, 'low');

    score = Math.max(0, Math.min(100, score));
    var level = maxLevel(levelOf(score), minLevel);
    if (score < LEVEL_MIN[level]) score = LEVEL_MIN[level];
    return { score: score, level: level, notes: notes, needHelp: needHelp, floors: floors.map(function (f) { return f.why; }), cleared: cleared };
  }

  /* ---------- Text z OCR ---------- */

  // Opraví typické chyby OCR v odkazech: chybějící dvojtečka a odkaz zalomený na víc řádků.
  function normalizeOcrText(text) {
    var t = String(text || '').replace(/\r/g, '');
    t = t.replace(/\b(https?)\s*[:;.,]?\s*\/\s*\/\s*/gi, function (m, p) { return p.toLowerCase() + '://'; });
    var lines = t.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var prev = out.length ? out[out.length - 1] : null;
      if (prev !== null) {
        var lastTok = (prev.match(/(\S+)\s*$/) || [])[1] || '';
        var first = line.replace(/^\s+/, '');
        var urlish = /^(https?:\/\/|www\.)/i.test(lastTok) || /^[a-z0-9-]+\.[a-z0-9.-]+\//i.test(lastTok);
        var prevOpen = /[-.\/?=&_%]$/.test(lastTok);
        var nextCont = /^[.\/?=&_%-]/.test(first) || (/^[a-z0-9]/i.test(first) && prevOpen);
        if (urlish && (prevOpen || /^[.\/?=&_%-]/.test(first)) && nextCont && !/\s/.test(first.split(/\s/)[0] === '' ? ' ' : '')) {
          out[out.length - 1] = prev.replace(/\s+$/, '') + first;
          continue;
        }
      }
      out.push(line);
    }
    return out.join('\n');
  }

  // Posoudí, jestli je text z OCR použitelný. Jistotu OCR nebereme jako záruku:
  // kontrolujeme i to, jestli text obsahuje smysluplná slova.
  function assessOcr(text, confidence) {
    var t = String(text || '');
    var tokens = t.split(/\s+/).filter(Boolean).filter(function (w) {
      return !/^(https?:|www\.)/i.test(w) && !/^[\d.,:%+\/-]+$/.test(w);
    });
    var good = tokens.filter(function (w) {
      var core = w.replace(/^[„“"'(\[]+|[.,:;!?)"'“\]]+$/g, '');
      return /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]?[a-záčďéěíňóřšťúůýž]{2,}$/.test(core);
    }).length;
    var letters = (t.match(/[A-Za-zÁ-ž]/g) || []).length;
    var ratio = tokens.length ? good / tokens.length : 0;
    var conf = typeof confidence === 'number' ? confidence : 0;
    var readable = letters >= 15 && ratio >= 0.5 && conf >= 50;
    var quality = !readable ? 'unreadable' : (conf < 75 || ratio < 0.7 ? 'uncertain' : 'good');
    return { readable: readable, quality: quality, ratio: Math.round(ratio * 100) / 100, confidence: conf, letters: letters };
  }

  var api = {
    analyze: analyze,
    evaluate: evaluate,
    questionsFor: questionsFor,
    findUrls: findUrls,
    analyzeUrl: analyzeUrl,
    skeleton: skeleton,
    normalizeOcrText: normalizeOcrText,
    assessOcr: assessOcr,
    levelOf: levelOf,
    BRANDS: BRANDS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PPAnalyzer = api;
})(typeof window !== 'undefined' ? window : this);
