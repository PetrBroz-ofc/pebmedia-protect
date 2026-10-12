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
  // kw: klíčová slova (5+ znaků hledáme jako podřetězec, kratší jen jako samostatnou část adresy)
  var BRANDS = [
    { name: 'Česká pošta', kw: ['ceskaposta', 'postaonline', 'balikovna', 'posta'], official: ['ceskaposta.cz', 'postaonline.cz', 'balikovna.cz', 'cpost.cz'], cat: 'package' },
    { name: 'PPL', kw: ['ppl'], official: ['ppl.cz', 'ppl.sk'], cat: 'package' },
    { name: 'Zásilkovna', kw: ['zasilkovna', 'packeta'], official: ['zasilkovna.cz', 'packeta.com', 'packeta.cz'], cat: 'package' },
    { name: 'DPD', kw: ['dpd'], official: ['dpd.cz', 'dpd.com'], cat: 'package' },
    { name: 'GLS', kw: ['gls'], official: ['gls-group.eu', 'gls-group.com'], cat: 'package' },
    { name: 'DHL', kw: ['dhl'], official: ['dhl.cz', 'dhl.com', 'dhl.de'], cat: 'package' },
    { name: 'Alza', kw: ['alza'], official: ['alza.cz', 'alza.sk'], cat: 'shop' },
    { name: 'ČEZ', kw: ['cez'], official: ['cez.cz'], cat: 'energy' },
    { name: 'ČSOB', kw: ['csob'], official: ['csob.cz'], cat: 'bank' },
    { name: 'Komerční banka', kw: ['komercni', 'komercnibanka'], official: ['kb.cz'], cat: 'bank' },
    { name: 'Česká spořitelna', kw: ['ceskasporitelna', 'sporitelna', 'csas'], official: ['csas.cz', 'ceskasporitelna.cz'], cat: 'bank' },
    { name: 'Raiffeisenbank', kw: ['raiffeisen'], official: ['rb.cz'], cat: 'bank' },
    { name: 'MONETA', kw: ['moneta'], official: ['moneta.cz'], cat: 'bank' },
    { name: 'Air Bank', kw: ['airbank'], official: ['airbank.cz'], cat: 'bank' },
    { name: 'Fio banka', kw: ['fio', 'fiobanka'], official: ['fio.cz'], cat: 'bank' },
    { name: 'mBank', kw: ['mbank'], official: ['mbank.cz'], cat: 'bank' },
    { name: 'UniCredit Bank', kw: ['unicredit'], official: ['unicreditbank.cz'], cat: 'bank' },
    { name: 'Revolut', kw: ['revolut'], official: ['revolut.com'], cat: 'bank' },
    { name: 'PayPal', kw: ['paypal'], official: ['paypal.com'], cat: 'bank' },
    { name: 'státní správa', kw: ['identita', 'datovaschranka', 'mojedatovaschranka', 'mojedane', 'financnisprava', 'gov'], official: ['gov.cz', 'mojedatovaschranka.cz', 'financnisprava.cz', 'mojedane.cz'], cat: 'gov' },
    { name: 'elektronická dálniční známka', kw: ['edalnice', 'dalnicni', 'dalnice', 'znamka'], official: ['edalnice.cz'], cat: 'vignette' },
    { name: 'ČSSZ', kw: ['cssz'], official: ['cssz.cz'], cat: 'gov' },
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

  var SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'ow.ly',
    'buff.ly', 'rebrand.ly', 'tiny.cc', 's.id', 't.ly', 'goo.gl', 'qrco.de', 'v.gd', 'shorturl.ac', 'urlz.fr', 'surl.li', 'bit.do'];

  // Koncovky, které jsou levné a v podvodných kampaních velmi časté.
  var RISKY_TLD = ['top', 'xyz', 'icu', 'click', 'online', 'site', 'live', 'cfd', 'sbs', 'buzz', 'rest',
    'cyou', 'monster', 'lol', 'mom', 'vip', 'win', 'bond', 'qpon', 'shop', 'support', 'help', 'cam',
    'fun', 'work', 'life', 'store', 'info', 'pw', 'tk', 'ml', 'ga', 'cf', 'gq', 'ru', 'su', 'cn'];

  var COMMON_TLD = ['cz', 'sk', 'com', 'net', 'org', 'eu', 'de', 'at', 'pl', 'io', 'app', 'me', 'co', 'uk', 'us', 'biz'].concat(RISKY_TLD);

  var MULTI_SUFFIX = ['co.uk', 'org.uk', 'com.au', 'com.br', 'co.jp', 'com.pl', 'com.ua', 'co.za', 'com.tr', 'com.cn'];

  // Pravidla pro text. Hledáme v textu bez diakritiky a malými písmeny.
  var TEXT_RULES = [
    { id: 'urgency', w: 15, cat: null, title: 'Nátlak na rychlé jednání',
      detail: 'Zpráva tlačí na to, abyste jednali hned. Podvodníci nechtějí, abyste měli čas si věc ověřit.',
      re: /\b(ihned|okamzit\w*|neprodlen\w*|nalehav\w*|posledni (vyzv|upozorn|sanc)\w*|do \d{1,2} (hod|hodin|dnu|dni)\w*|do (zitr|pulnoc)\w*|vyprs\w*|propadn\w*|jeste dnes|dnes do)\b/ },
    { id: 'payment', w: 15, cat: 'payment', title: 'Žádost o platbu nebo doplatek',
      detail: 'Zpráva chce zaplatit, typicky malou částku za doručení, clo nebo poplatek. Malá částka je návnada, cílem jsou údaje z karty.',
      re: /\b(doplat\w*|poplat\w*|clo|cla|celni\w*|dobirk\w*|uhrad\w*|zaplat\w*|platb\w*|neuhrazen\w*|dluzn\w*)\b/ },
    { id: 'amount', w: 5, cat: 'payment', title: 'Konkrétní malá částka',
      detail: 'Uvedená částka je typicky nízká, aby platba nevzbudila podezření.',
      re: /\b\d{1,3}([.,]\d{1,2})?\s?(kc|czk|eur|€|,-)/ },
    { id: 'package', w: 5, cat: 'package', title: 'Téma doručení zásilky',
      detail: 'Falešné zprávy o balících jsou v Česku nejčastějším typem podvodné SMS.',
      re: /\b(zasilk\w*|balik\w*|baliku|doruc\w*|kuryr\w*|sledovaci cislo|prepravc\w*|vyzvednout|vyzvednuti|nedorucen\w*|adres\w* (je )?neuplna|neuplna adres\w*)\b/ },
    { id: 'credentials', w: 20, cat: 'credentials', title: 'Žádost o přihlášení nebo citlivé údaje',
      detail: 'Banka, pošta ani úřad po vás nikdy přes odkaz ve zprávě nechtějí heslo, PIN, údaje z karty ani kód z SMS.',
      re: /\b(heslo|hesla|prihlas\w*|overte|overit|overeni (uctu|totoznosti|udaju)|aktualizuj\w* (udaje|informace|ucet)|cislo karty|udaje (z|o) karty|udaje karty|cvv|cvc|pin\b|kod z sms|overovaci kod|jednorazov\w* kod|potvrzovaci kod)\b/ },
    { id: 'bankstaff', w: 30, cat: 'bank', title: 'Typický scénář falešného bankéře',
      detail: 'Bezpečný účet, bezpečnostní oddělení nebo podezřelá transakce: přesně tak začíná podvod, kdy volající přemluví oběť k převodu peněz. Žádná banka nikdy nechce, abyste peníze přeposlali jinam.',
      re: /\b(bezpecn\w* ucet|bezpecnostni oddeleni|podezrel\w* (transakc|platb|prihlas)\w*|vas ucet (je|byl) (ohrozen|napaden|zneuzit)\w*|prevedte (penize|uspory|prostredky)|ochran\w* (vasich )?(uspor|penez))\b/ },
    { id: 'threat', w: 15, cat: null, title: 'Výhrůžka nebo strašení',
      detail: 'Zpráva straší zablokováním, pokutou, exekucí nebo policií. Strach má vypnout rozvahu.',
      re: /\b(zablokovan\w*|blokac\w*|pozastaven\w*|zrusen\w* (uctu|sluzby|zasilky)|exekuc\w*|pokut\w*|trestni oznameni|soudni\w*|vymahan\w*)\b/ },
    { id: 'prize', w: 15, cat: 'prize', title: 'Výhra, odměna nebo dárek',
      detail: 'Výhra v soutěži, do které jste se nepřihlásili, je klasická návnada.',
      re: /\b(vyhral\w*|vyhra\b|vyhry|gratulujeme|odmen\w*|darek zdarma|zdarma ziskat|losovani|vylosovan\w*|byli jste vybran\w*)\b/ },
    { id: 'invest', w: 15, cat: 'invest', title: 'Investice s nereálným ziskem',
      detail: 'Slib rychlého nebo garantovaného zisku, zejména u kryptoměn, je typický investiční podvod.',
      re: /\b(investic\w*|investov\w*|kryptomen\w*|bitcoin\w*|garantovan\w* (zisk|vynos)\w*|zhodnocen\w*|pasivni prijem|obchodni platform\w*|broker\w*)\b/ },
    { id: 'family', w: 25, cat: 'family', title: 'Někdo se vydává za člena rodiny',
      detail: 'Ahoj mami, tohle je moje nové číslo: tak začíná podvod, kdy se cizí člověk vydává za dítě nebo vnouče a brzy chce peníze.',
      re: /\b(ahoj (mami|mamko|mamino|tati|tato|babi|dedo|dedecku)|(moje )?nove cislo|rozbil\w* (se mi )?(telefon|mobil)|ztratil\w* (jsem )?(telefon|mobil)|napis mi na whats\s?app|ulozte? si (toto|tohle|me) cislo)\b/ },
    { id: 'remote', w: 30, cat: 'remote', title: 'Žádost o instalaci aplikace nebo vzdálený přístup',
      detail: 'Aplikace jako AnyDesk nebo TeamViewer dají cizímu člověku plnou kontrolu nad vaším zařízením a bankovnictvím.',
      re: /\b(anydesk|teamviewer|rustdesk|quick ?support|vzdalen\w* (pristup|sprav\w*|plo\w*)|nainstalujte (si )?(aplikaci|program)|stahnete (si )?(aplikaci|program))\b/ },
    { id: 'refund', w: 15, cat: 'gov', title: 'Přeplatek nebo vrácení peněz',
      detail: 'Úřady ani firmy vám přeplatek nevracejí přes odkaz ve zprávě, kde máte zadat kartu.',
      re: /\b(preplat\w*|vratk\w* dane|vraceni (penez|platby|dane)|refundac\w*|narok na vraceni)\b/ },
    { id: 'vignette', w: 10, cat: 'vignette', title: 'Téma dálniční známky',
      detail: 'Dálniční známku kupujte jen na oficiálním webu edalnice.cz. Podvodné weby ji prodávají dráž nebo vůbec.',
      re: /\b(dalnicni znamk\w*|edalnic\w*|e-znamk\w*)\b/ },
    { id: 'marketplace', w: 20, cat: 'marketplace', title: 'Platba přes odkaz při prodeji z bazaru',
      detail: 'Pokud něco prodáváte a kupující vám pošle odkaz, kde máte zadat kartu, abyste dostali peníze, jde o podvod. K přijetí peněz nikdy nezadáváte údaje z karty.',
      re: /\b(prijmout platbu|prijeti platby|obdrzet (penize|platbu)|zaplatil\w* jsem vam|platba (je )?(pripravena|cekajici)|bezpecn\w* (platb|prodej|nakup)\w*|kuryr si (zbozi|vec)\w* vyzvedne)\b/ },
    { id: 'generic', w: 5, cat: null, title: 'Neosobní oslovení',
      detail: 'Oslovení jako Vážený zákazníku naznačuje hromadně rozesílanou zprávu.',
      re: /\b(vazen\w* (zakazni|klient|uzivatel)\w*|dear customer)\b/ }
  ];

  /* ---------- Pomocné funkce ---------- */

  function stripDiacritics(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normText(s) {
    return stripDiacritics(String(s || '').toLowerCase()).replace(/\s+/g, ' ');
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
    if (MULTI_SUFFIX.indexOf(last2) !== -1) return p.slice(-3).join('.');
    return last2;
  }

  function endsWithDomain(host, domain) {
    return host === domain || host.slice(-(domain.length + 1)) === '.' + domain;
  }

  /* ---------- Hledání odkazů ---------- */

  var STOP = '\\s<>"\'„“”‚‘’«»';
  var SCHEME_RE = new RegExp('(?:https?:\\/\\/|www\\.)[^' + STOP + ']+', 'gi');
  var BARE_RE = new RegExp('(^|[\\s(\\[<"\'„“:,;])((?:[a-z0-9\\u00a1-\\uffff](?:[a-z0-9\\u00a1-\\uffff-]{0,61}[a-z0-9\\u00a1-\\uffff])?\\.)+([a-z\\u00a1-\\uffff]{2,24}))((?::\\d{2,5})?(?:\\/[^' + STOP + ']*)?)', 'gi');

  function trimTrail(s) {
    return s.replace(/[.,;:!?)\]}"'»”“…]+$/, '');
  }

  function findUrls(text) {
    var found = [];
    var spans = [];
    var m;
    SCHEME_RE.lastIndex = 0;
    while ((m = SCHEME_RE.exec(text))) {
      var raw = trimTrail(m[0]);
      found.push(raw);
      spans.push([m.index, m.index + m[0].length]);
    }
    BARE_RE.lastIndex = 0;
    while ((m = BARE_RE.exec(text))) {
      var start = m.index + m[1].length;
      var inside = spans.some(function (sp) { return start >= sp[0] && start < sp[1]; });
      if (inside) continue;
      var tld = skeleton(m[3]);
      var hasPath = m[4] && m[4].length > 1;
      if (COMMON_TLD.indexOf(tld) === -1 && !hasPath) continue;
      // Vynecháme e-maily (doména hned za @)
      if (text[start - 1] === '@') continue;
      found.push(trimTrail(m[2] + (m[4] || '')));
    }
    var seen = {};
    return found.filter(function (u) {
      var k = u.toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
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

  function analyzeUrl(raw) {
    var p = parseUrl(raw);
    if (!p) return null;
    var findings = [];
    var host = p.rawHost;
    var ascii = p.asciiHost;
    var reg = registrable(ascii);
    var regRaw = registrable(host);
    var tld = ascii.split('.').pop();

    // Znaky domény s označením písma (pro zvýraznění v rozhraní)
    var chars = [];
    var scripts = {};
    for (var i = 0; i < host.length; i++) {
      var ch = host[i];
      var sc = scriptOf(ch);
      if (sc === 'latin' || sc === 'cyrillic' || sc === 'greek') scripts[sc] = true;
      chars.push({ ch: ch, kind: (sc === 'cyrillic' || sc === 'greek') ? sc : 'plain' });
    }

    var foreign = chars.filter(function (c) { return c.kind !== 'plain'; });
    if (foreign.length) {
      var mixed = scripts.latin && (scripts.cyrillic || scripts.greek);
      findings.push({
        sev: 'high',
        title: mixed ? 'V adrese jsou schovaná písmena z cyrilice' : 'Adresa je napsaná jiným písmem',
        detail: (mixed
          ? 'Některá písmena vypadají jako běžná latinka, ale jsou z cyrilice nebo řečtiny. Adresa proto vede úplně jinam, než se zdá. Označili jsme je červeně.'
          : 'Adresa používá písmena, která v českých webech běžně nejsou.') +
          ' Skutečná podoba adresy pro počítač: ' + ascii
      });
    } else if (/(^|\.)xn--/.test(ascii)) {
      findings.push({
        sev: 'mid',
        title: 'Adresa v kódované podobě (punycode)',
        detail: 'Adresa začíná xn--, což je zápis neobvyklých znaků. Často slouží k napodobení známých webů.'
      });
    }

    if (p.userinfo) {
      findings.push({
        sev: 'high',
        title: 'Trik se zavináčem v adrese',
        detail: 'Část před znakem @ (' + p.userinfo + ') je jen klam. Prohlížeč otevře až to, co je za ním: ' + host + '.'
      });
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ascii)) {
      findings.push({
        sev: 'high',
        title: 'Místo názvu je v adrese jen číslo (IP adresa)',
        detail: 'Seriózní firmy posílají odkazy na své pojmenované weby, ne na číselné adresy serverů.'
      });
    }

    var isShort = SHORTENERS.some(function (d) { return endsWithDomain(ascii, d); });
    if (isShort) {
      findings.push({
        sev: 'mid',
        title: 'Zkrácený odkaz skrývá skutečný cíl',
        detail: 'Služba ' + reg + ' jen přesměrovává jinam. Nevidíte, kam odkaz doopravdy vede.'
      });
    }

    // Značky: napodobení nebo oficiální web
    var sk = skeleton(host);
    var joined = sk.replace(/[.\-]/g, '');
    var tokens = sk.split(/[.\-]/).filter(Boolean);
    var brand = null;
    var official = false;
    var typo = false;

    for (var b = 0; b < BRANDS.length && !brand; b++) {
      var br = BRANDS[b];
      var hit = br.kw.some(function (kw) {
        if (kw.length >= 5) return joined.indexOf(kw) !== -1;
        return tokens.indexOf(kw) !== -1;
      });
      if (!hit) {
        hit = br.kw.some(function (kw) {
          if (kw.length < 6) return false;
          var lim = kw.length >= 9 ? 2 : 1;
          return tokens.some(function (t) {
            return t.length >= 4 && t !== kw && Math.abs(t.length - kw.length) <= lim && levenshtein(t, kw) <= lim;
          });
        });
        if (hit) typo = true;
      }
      if (hit) {
        brand = br;
        official = !foreign.length && br.official.some(function (d) { return endsWithDomain(ascii, d); });
      }
    }

    if (brand && !official) {
      var prefixOfficial = brand.official.filter(function (d) {
        return ascii.indexOf(d + '.') === 0 || ascii.indexOf('.' + d + '.') !== -1;
      })[0];
      findings.push({
        sev: 'high',
        title: 'Napodobuje web: ' + brand.name,
        detail: (prefixOfficial
          ? 'Adresa začíná jako ' + prefixOfficial + ', ale rozhoduje konec adresy. Skutečná doména je ' + reg + '.'
          : (typo
            ? 'Název domény se jen o písmeno liší od skutečné značky. Skutečná doména je ' + reg + '.'
            : 'Adresa obsahuje název ' + brand.name + ', ale nepatří jí. Skutečná doména je ' + reg + '.')) +
          ' Oficiální web: ' + brand.official[0] + '.'
      });
    }

    if (official) {
      findings.push({
        sev: 'ok',
        title: 'Odkaz vede na oficiální web: ' + brand.name,
        detail: 'Doména ' + reg + ' patří ' + brand.name + '. I tak ale platí, že podvodník může napsat pravou adresu do textu a jinou schovat pod odkaz. Nejbezpečnější je otevřít aplikaci nebo web sami, ne přes zprávu.'
      });
    }

    if (!official && RISKY_TLD.indexOf(tld) !== -1 && !isShort) {
      findings.push({
        sev: 'mid',
        title: 'Neobvyklá koncovka .' + tld,
        detail: 'Koncovka .' + tld + ' je levná a v podvodných kampaních velmi častá. České firmy používají hlavně .cz.'
      });
    }

    var labels = ascii.split('.');
    if (!official && (labels.length >= 5 || (regRaw.split('.')[0].replace(/^xn--/, '').match(/-/g) || []).length >= 2)) {
      findings.push({
        sev: 'low',
        title: 'Nezvykle složitá adresa',
        detail: 'Hodně teček nebo pomlček v adrese často slouží k tomu, aby se pravá doména ztratila.'
      });
    }

    if (p.hadScheme && !p.secure && !official) {
      findings.push({
        sev: 'low',
        title: 'Nezabezpečené spojení (http)',
        detail: 'Odkaz nepoužívá šifrované spojení https. Na takové stránce nikdy nic nezadávejte.'
      });
    }

    var score = 0;
    findings.forEach(function (f) {
      if (f.sev === 'high') score += 40;
      else if (f.sev === 'mid') score += 15;
      else if (f.sev === 'low') score += 5;
    });
    if (official && score === 0) score = -10;

    return {
      raw: p.raw,
      host: host,
      ascii: ascii,
      registrable: reg,
      registrableRaw: regRaw,
      path: p.path,
      chars: chars,
      brand: brand ? brand.name : null,
      brandCat: brand ? brand.cat : null,
      official: official,
      findings: findings,
      score: score
    };
  }

  /* ---------- Rozbor textu ---------- */

  function analyzeText(text) {
    var norm = normText(text);
    var findings = [];
    var cats = {};
    var score = 0;
    TEXT_RULES.forEach(function (r) {
      if (r.re.test(norm)) {
        findings.push({ sev: r.w >= 25 ? 'high' : (r.w >= 15 ? 'mid' : 'low'), title: r.title, detail: r.detail, rule: r.id });
        score += r.w;
        if (r.cat) cats[r.cat] = true;
      }
    });

    // Slova, která míchají latinku s cyrilicí (častý trik k obejití filtrů)
    var mixedWords = String(text || '').split(/\s+/).filter(function (w) {
      return /[a-z]/i.test(w) && /[\u0400-\u04FF]/.test(w);
    });
    if (mixedWords.length) {
      findings.push({
        sev: 'high',
        title: 'Text obsahuje schovaná písmena z cyrilice',
        detail: 'Slova jako ' + mixedWords.slice(0, 3).join(', ') + ' míchají latinku a cyrilici. Běžná firma tohle nedělá, podvodníci tak obcházejí filtry spamu.',
        rule: 'mixedscript'
      });
      score += 25;
    }
    return { findings: findings, cats: cats, score: score };
  }

  /* ---------- Doptávací otázky ---------- */

  var QUESTIONS = [
    {
      id: 'expect',
      when: function (c) { return c.cats.package; },
      text: 'Čekáte teď opravdu nějakou zásilku?',
      options: [
        { v: 'no', label: 'Ne, nic nečekám', delta: 20, note: 'Zpráva o zásilce, kterou nečekáte, je téměř jistě podvod.' },
        { v: 'yes', label: 'Ano, čekám', delta: 0, note: 'Podvodníci spoléhají právě na to, že balík čekáte. Stav zásilky ověřte v aplikaci nebo na webu dopravce, který napíšete ručně.' },
        { v: 'unsure', label: 'Nevím', delta: 5 }
      ]
    },
    {
      id: 'sender',
      when: function (c) { return true; },
      text: 'Znáte odesílatele nebo číslo, ze kterého zpráva přišla?',
      options: [
        { v: 'unknown', label: 'Neznám ho', delta: 10 },
        { v: 'known', label: 'Znám, píše mi běžně', delta: -5, note: 'I známý účet může být napadený. Pokud chce peníze nebo údaje, ověřte si to telefonátem.' },
        { v: 'unsure', label: 'Nevím jistě', delta: 5 }
      ]
    },
    {
      id: 'familycheck',
      when: function (c) { return c.cats.family; },
      text: 'Zavolali jste na staré, uložené číslo tohoto člověka?',
      options: [
        { v: 'no', label: 'Ještě ne', delta: 20, note: 'Zavolejte na původní číslo, které máte uložené. Pokud to opravdu píše vaše dítě nebo vnouče, hned se to vysvětlí.' },
        { v: 'yes-other', label: 'Ano, o ničem neví', delta: 40, note: 'Potvrzeno: někdo se za vašeho blízkého vydává. Nic neposílejte a číslo zablokujte.' },
        { v: 'yes-ok', label: 'Ano, potvrdil to', delta: -15 }
      ]
    },
    {
      id: 'call',
      when: function (c) { return c.cats.bank || c.cats.remote || c.cats.invest; },
      text: 'Volal vám v souvislosti s tím někdo, kdo se představil jako banka, policie nebo úřad?',
      options: [
        { v: 'yes', label: 'Ano, volal', delta: 30, note: 'Skutečná banka ani policie po vás nikdy nechtějí převod peněz, instalaci aplikace ani kódy. Zavěste a zavolejte bance sami na číslo ze zadní strany karty.' },
        { v: 'no', label: 'Ne', delta: 0 }
      ]
    },
    {
      id: 'selling',
      when: function (c) { return c.cats.marketplace || (c.cats.payment && c.hasUrl && !c.cats.package); },
      text: 'Prodáváte teď něco přes bazar nebo inzerát?',
      options: [
        { v: 'yes', label: 'Ano, prodávám', delta: 20, note: 'Kupující, který posílá odkaz k přijetí platby, je podvodník. Peníze přijmete na číslo účtu, kartu k tomu nikdy nezadáváte.' },
        { v: 'no', label: 'Ne', delta: 0 }
      ]
    },
    {
      id: 'asks',
      when: function (c) { return c.hasUrl; },
      text: 'Co po vás stránka z odkazu chce? (pokud jste ji už otevřeli)',
      options: [
        { v: 'card', label: 'Údaje z karty', delta: 30 },
        { v: 'login', label: 'Přihlášení nebo heslo', delta: 25 },
        { v: 'app', label: 'Stáhnout aplikaci', delta: 30 },
        { v: 'notopened', label: 'Zatím jsem ji neotevíral(a)', delta: 0, note: 'Dobře. Odkaz neotevírejte, dokud si nejste jistí.' }
      ]
    },
    {
      id: 'acted',
      when: function (c) { return true; },
      text: 'Už jste na odkaz klikli, něco zadali nebo zaplatili?',
      options: [
        { v: 'no', label: 'Ne, nic', delta: 0 },
        { v: 'yes', label: 'Ano', delta: 0, help: true }
      ]
    }
  ];

  /* ---------- Celkové vyhodnocení ---------- */

  function analyze(text) {
    text = String(text || '');
    var urls = findUrls(text).map(analyzeUrl).filter(Boolean);
    var t = analyzeText(text);
    var cats = t.cats;
    urls.forEach(function (u) { if (u.brandCat && !u.official) cats[u.brandCat] = true; });
    return {
      text: text,
      urls: urls,
      textFindings: t.findings,
      textScore: t.score,
      cats: cats,
      hasUrl: urls.length > 0,
      empty: !text.trim()
    };
  }

  function questionsFor(a) {
    var ctx = { cats: a.cats, hasUrl: a.hasUrl };
    return QUESTIONS.filter(function (q) { return q.when(ctx); });
  }

  function evaluate(a, answers) {
    answers = answers || {};
    var score = a.textScore;
    var anyHigh = false;
    var allOfficial = a.urls.length > 0;
    a.urls.forEach(function (u) {
      score += u.score;
      if (u.findings.some(function (f) { return f.sev === 'high'; })) anyHigh = true;
      if (!u.official) allOfficial = false;
    });
    if (a.textFindings.some(function (f) { return f.sev === 'high'; })) anyHigh = true;

    var notes = [];
    var needHelp = false;
    questionsFor(a).forEach(function (q) {
      var v = answers[q.id];
      if (!v) return;
      var opt = q.options.filter(function (o) { return o.v === v; })[0];
      if (!opt) return;
      score += opt.delta;
      if (opt.note) notes.push(opt.note);
      if (opt.help) needHelp = true;
      if (opt.delta >= 30) anyHigh = true;
    });

    // Odkaz na neznámý web + platba nebo údaje = vysoké riziko
    var unknownLink = a.urls.some(function (u) { return !u.official; });
    if (unknownLink && (a.cats.payment || a.cats.credentials)) score += 15;

    score = Math.max(0, Math.min(100, score));
    if (anyHigh) score = Math.max(score, 60);

    var level = score >= 55 ? 'high' : (score >= 25 ? 'mid' : 'low');
    return { score: score, level: level, notes: notes, needHelp: needHelp, allOfficial: allOfficial };
  }

  var api = {
    analyze: analyze,
    evaluate: evaluate,
    questionsFor: questionsFor,
    findUrls: findUrls,
    analyzeUrl: analyzeUrl,
    skeleton: skeleton,
    BRANDS: BRANDS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PPAnalyzer = api;
})(typeof window !== 'undefined' ? window : this);
