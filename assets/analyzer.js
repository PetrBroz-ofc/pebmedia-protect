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

  // Pravidla pro text. Hledáme v textu bez diakritiky a malými písmeny (délka textu zůstává stejná,
  // takže umíme podezřelá místa podtrhnout přímo v původní zprávě).
  var TEXT_RULES = [
    { id: 'urgency', w: 15, title: 'Spěchá na vás',
      detail: 'Chce, abyste jednali hned a nestihli si nic ověřit.',
      re: /\b(ihned|okamzit\w*|neprodlen\w*|nalehav\w*|posledni (vyzv|upozorn|sanc)\w*|do \d{1,2} (hod|hodin|dnu|dni)\w*|do (zitr|pulnoc)\w*|vyprs\w*|propadn\w*|jeste dnes|dnes do)\b/ },
    { id: 'payment', w: 15, cat: 'payment', title: 'Chce peníze',
      detail: 'U malých doplatků jim jde ve skutečnosti o údaje z vaší karty. Každou žádost o peníze si ověřte jinou cestou.',
      re: /\b(doplat\w*|poplat\w*|clo|cla|celni\w*|dobirk\w*|uhrad\w*|zaplat\w*|platb\w*|neuhrazen\w*|dluzn\w*)\b/ },
    { id: 'amount', group: 'payment', w: 5, cat: 'payment', title: 'Uvádí malou částku',
      detail: 'Nízká částka má vypadat nevinně, aby vám nepřišlo divné ji zaplatit.',
      re: /\b\d{1,3}([.,]\d{1,2})?\s?(kc|czk|eur|€|,-)/ },
    { id: 'package', w: 5, cat: 'package', title: 'Píše o balíku',
      detail: 'Falešné zprávy o zásilkách jsou u nás vůbec nejčastější podvod.',
      re: /\b(zasilk\w*|balik\w*|baliku|doruc\w*|kuryr\w*|sledovaci cislo|prepravc\w*|vyzvednout|vyzvednuti|nedorucen\w*|adres\w* (je )?neuplna|neuplna adres\w*)\b/ },
    { id: 'credentials', w: 20, cat: 'credentials', title: 'Chce vaše údaje',
      detail: 'Pošta, banka ani úřad po vás přes odkaz nikdy nechtějí heslo, PIN, kartu ani kód z SMS.',
      re: /\b(heslo|hesla|prihlas\w*|overte|overit|overeni (uctu|totoznosti|udaju)|aktualizuj\w* (udaje|informace|ucet)|potvrdte kartu|cislo karty|udaje (z|o) karty|udaje karty|cvv|cvc|pin|kod z sms|overovaci kod|jednorazov\w* kod|potvrzovaci kod)\b/ },
    { id: 'bankstaff', w: 30, cat: 'bank', title: 'Falešný bankéř',
      detail: 'Žádný bezpečný účet neexistuje. Skutečná banka nikdy nechce, abyste peníze někam převáděli.',
      re: /\b(bezpecn\w* ucet|bezpecnostni\w* oddeleni\w*|podezrel\w* (transakc|platb|prihlas)\w*|vas ucet (je|byl) (ohrozen|napaden|zneuzit)\w*|prevedte (penize|uspory|prostredky)|prevest (penize|uspory|prostredky)|ochran\w* (vasich )?(uspor|penez))\b/ },
    { id: 'threat', w: 15, title: 'Straší vás',
      detail: 'Hrozí zablokováním, pokutou nebo exekucí, abyste zpanikařili.',
      re: /\b(zablokovan\w*|blokac\w*|pozastaven\w*|zrusen\w* (uctu|sluzby|zasilky)|exekuc\w*|pokut\w*|trestni oznameni|soudni\w*|vymahan\w*|bude vracen\w*)\b/ },
    { id: 'prize', w: 15, cat: 'prize', title: 'Slibuje výhru',
      detail: 'Výhra v soutěži, do které jste se nepřihlásili, je klasická návnada.',
      re: /\b(vyhral\w*|vyhra|vyhry|gratulujeme|odmen\w*|darek zdarma|zdarma ziskat|losovani|vylosovan\w*|byli jste vybran\w*)\b/ },
    { id: 'invest', w: 15, cat: 'invest', title: 'Slibuje snadný zisk',
      detail: 'Garantovaný zisk neexistuje. Přesně takhle začínají investiční podvody.',
      re: /\b(investic\w*|investov\w*|kryptomen\w*|bitcoin\w*|garantovan\w* (zisk|vynos)\w*|zhodnocen\w*|pasivni prijem|obchodni platform\w*|broker\w*)\b/ },
    { id: 'family', w: 25, cat: 'family', title: 'Vydává se za někoho z rodiny',
      detail: 'Ahoj mami, mám nové číslo. Tak začíná podvod, který končí prosbou o peníze.',
      re: /\b(ahoj (mami|mamko|mamino|tati|tato|babi|dedo|dedecku)|(moje )?nove cislo|rozbil\w* (se mi )?(telefon|mobil)|ztratil\w* (jsem )?(telefon|mobil)|napis mi na whats\s?app|uloz\w* si (ho|toto|tohle|me|moje|cislo))\b/ },
    { id: 'remote', w: 30, cat: 'remote', title: 'Chce se dostat do vašeho zařízení',
      detail: 'Přes AnyDesk nebo TeamViewer by cizí člověk viděl a ovládal i vaše bankovnictví.',
      re: /\b(anydesk|teamviewer|rustdesk|quick ?support|vzdalen\w* (pristup|sprav\w*|plo\w*)|nainstalujte (si )?(prosim )?(aplikaci|program)|stahnete (si )?(aplikaci|program))\b/ },
    { id: 'refund', w: 15, cat: 'gov', title: 'Slibuje vrácení peněz',
      detail: 'Přeplatek vám nikdo nevrací přes odkaz, kde máte zadat kartu.',
      re: /\b(preplat\w*|vratk\w* dane|vraceni (penez|platby|dane)|refundac\w*|narok na vraceni)\b/ },
    { id: 'vignette', w: 10, cat: 'vignette', title: 'Dálniční známka',
      detail: 'Pravou dálniční známku koupíte jen na edalnice.cz.',
      re: /\b(dalnicni znamk\w*|edalnic\w*|e-znamk\w*)\b/ },
    { id: 'marketplace', w: 20, cat: 'marketplace', title: 'Chce kartu, abyste dostali peníze',
      detail: 'K přijetí platby kartu nikdy nezadáváte. Kupujícímu stačí číslo vašeho účtu.',
      re: /\b(prijmout platbu|prijeti platby|obdrzet (penize|platbu)|zaplatil\w* (jsem )?vam|platba (je )?(pripravena|cekajici)|bezpecn\w* (platb|prodej|nakup)\w*|kuryr si (zbozi|vec)\w* vyzvedne)\b/ },
    { id: 'generic', w: 5, title: 'Neosobní oslovení',
      detail: 'Zpráva nejspíš odešla hromadně na tisíce lidí.',
      re: /\b(vazen\w* (zakazni|klient|uzivatel)\w*|dear customer)\b/ }
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

  function analyzeUrl(raw) {
    var p = parseUrl(raw);
    if (!p) return null;
    var findings = [];
    var host = p.rawHost;
    var ascii = p.asciiHost;
    var reg = registrable(ascii);
    var regRaw = registrable(host);
    var tld = ascii.split('.').pop();

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
      findings.push({
        sev: 'high',
        title: 'Falešná písmena v adrese',
        detail: 'Červeně označená písmena jsou z azbuky. Vypadají stejně jako naše, ale adresa vede úplně jinam.'
      });
    } else if (/(^|\.)xn--/.test(ascii)) {
      findings.push({ sev: 'mid', title: 'Zakódovaná adresa', detail: 'Adresa začíná xn--. Takhle se často maskují falešné weby.' });
    }

    if (p.userinfo) {
      findings.push({ sev: 'high', title: 'Trik se zavináčem', detail: 'Všechno před znakem @ je jen kulisa. Ve skutečnosti se otevře ' + host + '.' });
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ascii)) {
      findings.push({ sev: 'high', title: 'Místo názvu jen čísla', detail: 'Žádná slušná firma neposílá odkaz na číselnou adresu serveru.' });
    }

    var isShort = SHORTENERS.some(function (d) { return endsWithDomain(ascii, d); });
    if (isShort) {
      findings.push({ sev: 'mid', title: 'Zkrácený odkaz', detail: 'Nevidíte, kam doopravdy vede. Seriózní firmy ve zprávách zkracovače skoro nepoužívají.' });
    }

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

    var summary = null;
    if (brand && !official) {
      var prefixOfficial = brand.official.filter(function (d) {
        return ascii.indexOf(d + '.') === 0 || ascii.indexOf('.' + d + '.') !== -1;
      })[0];
      findings.push({
        sev: 'high',
        title: 'Vydává se za ' + brandAcc(brand.name),
        detail: prefixOfficial
          ? 'Adresa začíná jako ' + prefixOfficial + ', jenže rozhoduje její konec. Pravý web je ' + brand.official[0] + '.'
          : (typo
            ? 'Název se od skutečného liší jen o písmeno. Pravý web je ' + brand.official[0] + '.'
            : 'Pravý web je ' + brand.official[0] + '. Tenhle odkaz s ním nemá nic společného.')
      });
      summary = { kind: 'fake', brand: brand.name, brandAcc: brandAcc(brand.name), real: brand.official[0], goes: reg };
    } else if (official) {
      findings.push({
        sev: 'ok',
        title: 'Oficiální web: ' + brand.name,
        detail: 'Adresa je pravá. I tak je nejjistější otevřít aplikaci nebo web sami, ne přes odkaz ve zprávě.'
      });
      summary = { kind: 'official', brand: brand.name, goes: reg };
    } else {
      summary = { kind: 'unknown', goes: reg };
    }

    if (!official && RISKY_TLD.indexOf(tld) !== -1 && !isShort) {
      findings.push({ sev: 'mid', title: 'Podezřelá koncovka .' + tld, detail: 'Levná koncovka, kterou podvodníci často používají. České firmy mají většinou .cz.' });
    }

    var labels = ascii.split('.');
    if (!official && (labels.length >= 5 || (regRaw.split('.')[0].replace(/^xn--/, '').match(/-/g) || []).length >= 2)) {
      findings.push({ sev: 'low', title: 'Zamotaná adresa', detail: 'Spousta teček a pomlček má schovat, kam odkaz opravdu vede.' });
    }

    if (p.hadScheme && !p.secure && !official) {
      findings.push({ sev: 'low', title: 'Nešifrovaná stránka', detail: 'Odkaz nepoužívá https. Na takové stránce nikdy nic nevyplňujte.' });
    }

    var score = 0;
    findings.forEach(function (f) {
      if (f.sev === 'high') score += 40;
      else if (f.sev === 'mid') score += 15;
      else if (f.sev === 'low') score += 5;
    });
    if (official && score === 0) score = -10;

    var worst = findings.reduce(function (acc, f) {
      var o = { high: 3, mid: 2, low: 1, ok: 0 };
      return o[f.sev] > o[acc] ? f.sev : acc;
    }, findings.length ? 'ok' : 'none');

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
      summary: summary,
      findings: findings,
      worst: worst,
      score: score
    };
  }

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
        byId[key] = { sev: r.w >= 25 ? 'high' : (r.w >= 15 ? 'mid' : 'low'), title: r.title, detail: r.detail, rule: key, spans: spans };
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
        spans: mixed.slice(0, 4)
      });
      score += 25;
    }

    // U bazarového podvodu je platba od kupujícího součást triku, ne žádost o zaplacení
    if (byId.marketplace && byId.payment) {
      findings = findings.filter(function (f) { return f.rule !== 'payment'; });
      score -= 15;
    }

    var order = { high: 0, mid: 1, low: 2 };
    findings.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    return { findings: findings, cats: cats, score: score };
  }

  /* ---------- Doptávací otázky ---------- */

  var QUESTIONS = [
    {
      id: 'expect',
      when: function (c) { return c.cats.package; },
      text: 'Čekáte teď nějaký balík?',
      options: [
        { v: 'no', label: 'Nečekám', delta: 20, note: 'Zpráva o balíku, který nečekáte, je skoro jistě podvod.' },
        { v: 'yes', label: 'Čekám', delta: 0, note: 'Podvodníci sázejí právě na to. Stav zásilky si ověřte v aplikaci dopravce, ne přes odkaz ve zprávě.' },
        { v: 'unsure', label: 'Nevím', delta: 5 }
      ]
    },
    {
      id: 'familycheck',
      when: function (c) { return c.cats.family; },
      text: 'Zkusili jste zavolat na jeho staré číslo?',
      options: [
        { v: 'no', label: 'Ještě ne', delta: 20, note: 'Zavolejte na číslo, které máte uložené. Pokud to opravdu píše vaše dítě nebo vnouče, hned se to vysvětlí.' },
        { v: 'yes-other', label: 'Ano, o ničem neví', delta: 40, note: 'Pak je to jasné: někdo se za vašeho blízkého vydává. Nic neposílejte a číslo zablokujte.' },
        { v: 'yes-ok', label: 'Ano, potvrdil to', delta: -45, clears: 'family', note: 'Pokud to potvrdil hlas, který znáte, na staré číslo, je to v pořádku. Peníze ale posílejte jen na účet, který si s ním ověříte.' }
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
      when: function (c) { return c.cats.marketplace || (c.cats.payment && c.hasUrl && !c.cats.package); },
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
        { v: 'unknown', label: 'Neznám', delta: 10 },
        { v: 'known', label: 'Znám', delta: -5, note: 'Pozor, i známý účet může někdo ukrást. Když chce peníze nebo údaje, ověřte si to telefonem.' },
        { v: 'unsure', label: 'Nevím', delta: 5 }
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
    a.urls.forEach(function (u) {
      score += u.score;
      if (u.worst === 'high') anyHigh = true;
    });
    // Odpověď může vyvrátit konkrétní varování (např. člen rodiny se ozval na starém čísle)
    var cleared = {};
    questionsFor(a).forEach(function (q) {
      var opt = q.options.filter(function (o) { return o.v === answers[q.id]; })[0];
      if (opt && opt.clears) cleared[opt.clears] = true;
    });
    if (a.textFindings.some(function (f) { return f.sev === 'high' && !cleared[f.rule]; })) anyHigh = true;

    var notes = {};
    var needHelp = false;
    questionsFor(a).forEach(function (q) {
      var v = answers[q.id];
      if (!v) return;
      var opt = q.options.filter(function (o) { return o.v === v; })[0];
      if (!opt) return;
      score += opt.delta;
      if (opt.note) notes[q.id] = opt.note;
      if (opt.help) needHelp = true;
      if (opt.delta >= 30) anyHigh = true;
    });

    var unknownLink = a.urls.some(function (u) { return !u.official; });
    if (unknownLink && (a.cats.payment || a.cats.credentials)) score += 15;

    score = Math.max(0, Math.min(100, score));
    if (anyHigh) score = Math.max(score, 60);

    var level = score >= 55 ? 'high' : (score >= 25 ? 'mid' : 'low');
    return { score: score, level: level, notes: notes, needHelp: needHelp };
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
