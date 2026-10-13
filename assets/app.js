/* PEBMedia Protect: rozhraní
 * Text zprávy ani obrázek se nikam neodesílají. OCR běží v prohlížeči a všechny jeho soubory
 * (Tesseract.js, worker, WASM jádro, jazyková data) se načítají z vlastní domény (assets/ocr).
 */
(function () {
  'use strict';

  var A = window.PPAnalyzer;
  var R = window.PPReport;
  var G = window.PPGuides;
  var $ = function (id) { return document.getElementById(id); };
  var OCR_BASE = new URL('assets/ocr/', document.baseURI).href;
  // Skutečná velikost souborů stahovaných při prvním čtení obrázku (tesseract.min.js, worker.min.js,
  // tesseract-core-simd-lstm.wasm.js, ces + eng traineddata.gz) = 9 306 978 B.
  var OCR_DOWNLOAD_MB = '9,3';
  var state = { analysis: null, answers: {}, source: 'text', ocr: null, kind: 'msg', mode: 'msg', call: {}, preselect: null };
  var EBOOK_URL = 'https://pebmedia.cz/obchod/ebooky/';
  var EBOOK_COVER = 'assets/img/ebook-nenech-se-nachytat.webp';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function announce(msg) { var el = $('sr-status'); el.textContent = ''; setTimeout(function () { el.textContent = msg; }, 30); }

  var EXAMPLES = {
    posta: 'Česká pošta: Vaše zásilka nemohla být doručena, adresa je neúplná. Uhraďte doplatek 1,50 Kč do 24 hodin, jinak bude vrácena odesílateli: https://сeskapоsta-cz.info/track',
    mami: 'Ahoj mami, rozbil se mi telefon, tohle je moje nové číslo. Ulož si ho. Napiš mi na WhatsApp, potřebuju rychle zaplatit fakturu a banku mám ve starém mobilu.',
    bank: 'Dobrý den, zde bezpečnostní oddělení vaší banky. Zaznamenali jsme podezřelou transakci na vašem účtu. Pro ochranu úspor je nutné převést prostředky na bezpečný účet. Nainstalujte si prosím aplikaci AnyDesk, pomůžeme vám.',
    vinted: 'Dobrý den, zboží jsem vám zaplatil přes Vinted, kurýr si věc vyzvedne. Pro přijetí platby klikněte zde a potvrďte kartu: vinted-cz.payment-secure.online/item/552'
  };

  /* ---------- Stránky a historie (tlačítko Zpět) ---------- */
  var VIEWS = ['check', 'report', 'help', 'learn'];
  var HASH = { check: '#kontrola', report: '#nahlasit', help: '#pomoc', learn: '#naucit' };

  function setView(v) {
    VIEWS.forEach(function (name) {
      $('view-' + name).hidden = name !== v;
      $('nav-' + name).removeAttribute('aria-current');
    });
    $('nav-' + v).setAttribute('aria-current', 'page');
  }
  // Historie prohlížeče: v některých vložených prohlížečích může být zakázaná, aplikace pak funguje bez ní.
  function hist(method, st, hash) { try { history[method](st, '', hash); } catch (e) { /* bez historie */ } }
  // Přechod, který se zapíše do historie prohlížeče, aby fungovalo tlačítko Zpět.
  function go(v, opts) {
    opts = opts || {};
    var st = { view: v, result: !!opts.result };
    var hash = opts.result ? '#vysledek' : HASH[v];
    hist(opts.replace ? 'replaceState' : 'pushState', st, hash);
    applyState(st);
  }
  var ignoreNextPop = false;
  function applyState(st) {
    if (dlg.open) { closePolice(true); return; }
    setView(st.view);
    if (st.view === 'check') {
      if (st.result && state.analysis) {
        $('ask').hidden = true;
        if (!$('result').innerHTML) renderResult();
        $('result').hidden = false;
      } else resetCheck(true);
    }
    if (st.view === 'help' && state.preselect) {
      var pre = state.preselect;
      state.preselect = null;
      each('#sit-list input', function (c) { c.checked = pre.indexOf(c.value) !== -1; });
      renderPlan();
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', function (e) {
    if (ignoreNextPop) { ignoreNextPop = false; return; }
    var st = e.state || { view: viewFromHash(), result: false };
    if (st.modal) return;
    applyState(st);
  });
  function viewFromHash() {
    if (location.hash === '#pomoc') return 'help';
    if (location.hash === '#nahlasit') return 'report';
    if (location.hash === '#naucit') return 'learn';
    return 'check';
  }
  each('[data-view]', function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var v = a.getAttribute('data-view');
      if (v === 'check' && (a.classList.contains('logo') || a.hasAttribute('data-top'))) resetCheck();
      go(v);
    });
  });

  /* ---------- Kontrola ---------- */
  function runCheck(source) {
    var text = $('msg').value;
    if (!text.trim()) { $('msg').focus(); return; }
    state.source = source === 'ocr' ? 'ocr' : 'text';
    if (state.source !== 'ocr') state.ocr = null;
    showAnalysis(A.analyze(text), 'msg');
  }
  // Společné zobrazení výsledku pro zprávu, odkaz i e-mail.
  function showAnalysis(analysis, kind) {
    state.kind = kind;
    if (kind !== 'msg') { state.source = 'text'; state.ocr = null; }
    state.analysis = analysis;
    state.answers = {};
    state.reportChoice = null;
    state.lastLevel = null;
    $('ask').hidden = true;
    renderResult();
    go('check', { result: true });
    var h = $('verdict-title');
    if (h) h.focus();
    var ev = A.evaluate(state.analysis, {});
    announce('Výsledek kontroly: ' + VERDICT[ev.level].pill + '.');
  }
  // Nová kontrola: vyčistí pole, výsledek i předchozí stav OCR, aby se nemíchaly dvě zprávy.
  function resetCheck(keepText) {
    $('ask').hidden = false;
    $('result').hidden = true;
    if (!keepText) $('result').innerHTML = '';
    $('ocr').hidden = true;
    $('ocr-note').hidden = true;
    $('url-err').hidden = true;
    $('mail-err').hidden = true;
    if (!keepText) {
      $('msg').value = '';
      ['url-in', 'm-name', 'm-addr', 'm-subj', 'm-body', 'm-head'].forEach(function (id) { $(id).value = ''; });
      state.analysis = null;
      state.ocr = null;
      state.source = 'text';
    }
  }

  $('go').addEventListener('click', function () { runCheck('text'); });
  $('msg').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runCheck('text');
  });
  each('[data-ex]', function (b) {
    b.addEventListener('click', function () {
      $('msg').value = EXAMPLES[b.getAttribute('data-ex')];
      runCheck('text');
    });
  });

  /* ---------- Režimy kontroly: zpráva, odkaz, e-mail, telefonát ---------- */
  var MODES = ['msg', 'url', 'mail', 'call'];
  var MODE_TEXT = {
    msg: 'Vložte sem zprávu, která vám přišla. Projdeme ji s vámi a ukážeme, co na ní nesedí.',
    url: 'Vložte odkaz, kterému nevěříte. Ukážeme, kam doopravdy vede, a nic přitom neotevřeme.',
    mail: 'Opište odesílatele a vložte text e-mailu. Ukážeme, co na něm nesedí.',
    call: 'Volal vám někdo divný? Odpovězte na pár otázek a poradíme, co dělat.'
  };
  var MODE_FIRST = { msg: 'msg', url: 'url-in', mail: 'm-name' };
  function setMode(m, focusTab) {
    state.mode = m;
    MODES.forEach(function (x) {
      var tab = $('tab-' + x);
      var on = x === m;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      $('mode-' + x).hidden = !on;
    });
    $('hero-text').textContent = MODE_TEXT[m];
    if (m === 'call') renderCall();
    if (focusTab) $('tab-' + m).focus();
  }
  each('.mode', function (b) {
    b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    b.addEventListener('keydown', function (e) {
      var i = MODES.indexOf(state.mode);
      var n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: MODES.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      setMode(MODES[(n + MODES.length) % MODES.length], true);
    });
  });

  function runUrl() {
    var raw = $('url-in').value.trim();
    var a = raw ? A.analyze(raw) : null;
    if (!a || !a.urls.length) { $('url-err').hidden = false; $('url-in').focus(); return; }
    $('url-err').hidden = true;
    showAnalysis(a, 'url');
  }
  $('url-form').addEventListener('submit', function (e) { e.preventDefault(); runUrl(); });
  $('url-in').addEventListener('input', function () { $('url-err').hidden = true; });
  each('[data-url-ex]', function (b) {
    b.addEventListener('click', function () { $('url-in').value = b.getAttribute('data-url-ex'); runUrl(); });
  });

  function runMail() {
    var input = { fromName: val('m-name'), fromAddr: val('m-addr'), subject: val('m-subj'), body: val('m-body'), headers: $('m-head').value };
    if (!input.fromAddr && !input.body && !input.headers.trim()) { $('mail-err').hidden = false; $('m-addr').focus(); return; }
    $('mail-err').hidden = true;
    showAnalysis(A.analyzeEmail(input), 'mail');
  }
  $('mail-form').addEventListener('submit', function (e) { e.preventDefault(); runMail(); });

  var VERDICT = {
    high: { pill: 'Vysoké riziko', title: 'Tohle vypadá jako podvod', say: 'Na odkaz neklikejte, nic neplaťte a nikde nevyplňujte své údaje. Zprávu klidně smažte.' },
    mid: { pill: 'Zvýšené riziko', title: 'Něco tady nesedí', say: 'Než cokoli uděláte, ověřte si to jinak než přes tuhle zprávu. Třeba v aplikaci firmy nebo telefonem.' },
    low: { pill: 'Nízké riziko', title: 'Nic podezřelého jsme nenašli', say: 'Kdyby ale po vás chtěla peníze, heslo nebo kód z SMS, zbystřete.' }
  };

  var NEXT = {
    high: [
      'Zprávu smažte a odesílatele zablokujte.',
      'Volá vám k tomu někdo? Zavěste. Banka ani policie po vás nikdy nebudou chtít, abyste někam převáděli peníze.',
      'Chcete si něco ověřit? Otevřete aplikaci nebo web firmy sami, ne přes odkaz.'
    ],
    mid: [
      'Zatím na nic neklikejte a nic neplaťte.',
      'Ověřte si to v aplikaci firmy nebo telefonem na číslo, které znáte.',
      'Nejste si jistí? Ukažte zprávu někomu blízkému. Ve dvou se to posuzuje líp.'
    ],
    low: [
      'Přihlašujte se vždycky přes aplikaci nebo web, který napíšete sami.',
      'Kdyby přišla další zpráva s žádostí o peníze, zkontrolujte ji znovu.'
    ]
  };

  // Seznam důvodů (odkazy + nálezy v textu) s čísly
  function buildReasons(a, ev) {
    var list = [];
    a.urls.forEach(function (u) {
      var s = u.summary;
      var sev = u.worst === 'none' ? 'info' : u.worst;
      var rest = u.findings.slice();
      var head;
      if (s.kind === 'official') {
        head = { title: 'Odkaz vede na oficiální web ' + s.brand, detail: rest[0].detail };
        rest = rest.filter(function (f) { return f.code !== 'official'; });
      } else if (rest.length) {
        var order = { high: 0, mid: 1, low: 2, info: 3, ok: 4 };
        rest.sort(function (x, y) { return order[x.sev] - order[y.sev]; });
        head = rest[0];
        rest = rest.slice(1);
      } else {
        head = { title: 'Odkaz vede na web, který neznáme', detail: 'Sám o sobě nemusí být nebezpečný. Pokud po vás chce údaje nebo platbu, buďte opatrní.' };
      }
      list.push({ sev: sev, title: head.title, detail: head.detail, url: u, more: rest, spans: [[u.start, u.end]] });
    });
    a.textFindings.forEach(function (f) {
      var cleared = ev && ev.cleared && ev.cleared[f.rule];
      list.push({ sev: cleared ? 'info' : f.sev, title: f.title + (cleared ? ' (ověřeno)' : ''), detail: f.detail, spans: f.spans });
    });
    var ord = { high: 0, mid: 1, ok: 2, low: 3, info: 4 };
    list.sort(function (x, y) { return ord[x.sev] - ord[y.sev]; });
    list.forEach(function (r, i) { r.n = i + 1; });
    return list;
  }

  function domainHtml(u) {
    var subLen = Math.max(0, u.host.length - u.registrableRaw.length);
    var out = '';
    u.chars.forEach(function (c, i) {
      var ch = esc(c.ch);
      if (c.kind !== 'plain') ch = '<span class="fake" title="Písmeno z jiné abecedy">' + ch + '</span>';
      out += i < subLen ? '<span class="dim">' + ch + '</span>' : '<span class="main">' + ch + '</span>';
    });
    return out;
  }

  // Zvýraznění ve zprávě. Když se dvě místa překrývají, čísla obou důvodů se zobrazí u jednoho zvýraznění.
  function bubbleHtml(text, reasons) {
    var marks = [];
    reasons.forEach(function (r) {
      r.spans.forEach(function (sp, i) {
        marks.push({ s: sp[0], e: sp[1], nums: i === 0 ? [r.n] : [], sev: r.sev });
      });
    });
    marks.sort(function (x, y) { return x.s - y.s || (y.e - y.s) - (x.e - x.s); });
    var merged = [];
    var sevOrder = { high: 0, mid: 1, ok: 2, low: 3, info: 4 };
    marks.forEach(function (m) {
      var last = merged[merged.length - 1];
      if (last && m.s < last.e) {
        last.e = Math.max(last.e, m.e);
        last.nums = last.nums.concat(m.nums);
        if (sevOrder[m.sev] < sevOrder[last.sev]) last.sev = m.sev;
      } else merged.push({ s: m.s, e: m.e, nums: m.nums.slice(), sev: m.sev });
    });
    var out = '', pos = 0;
    merged.forEach(function (m) {
      out += esc(text.slice(pos, m.s));
      var inner = '';
      var seg = text.slice(m.s, m.e);
      for (var i = 0; i < seg.length; i++) {
        var ch = seg[i];
        inner += /[Ѐ-ӿͰ-Ͽ]/.test(ch) ? '<span class="fake">' + esc(ch) + '</span>' : esc(ch);
      }
      m.nums.sort(function (a, b) { return a - b; });
      out += '<mark class="hl ' + m.sev + '">' + inner + (m.nums.length ? '<sup>' + m.nums.join(',') + '</sup>' : '') + '</mark>';
      pos = m.e;
    });
    return out + esc(text.slice(pos));
  }

  // Rozbor jedné adresy: skutečná doména, subdoména, cesta a šifrování.
  function breakdownHtml(u) {
    var row = function (dt, dd, note) { return '<div class="bd-row"><dt>' + dt + '</dt><dd>' + dd + (note ? '<p class="bd-note">' + note + '</p>' : '') + '</dd></div>'; };
    var h = '<div class="card breakdown"><p class="bd-domain domain">' + domainHtml(u) + '</p><dl>';
    h += row('Skutečná doména', '<code>' + esc(u.registrable) + '</code>',
      u.official ? 'Patří mezi ověřené adresy: ' + esc(u.brand) + '.' : 'Tahle část rozhoduje, kdo web provozuje. Podle ní poznáte, kam odkaz opravdu vede.');
    if (u.foreign) h += row('Jak ji čte počítač', '<code>' + esc(u.ascii) + '</code>', 'Adresa obsahuje písmena z jiné abecedy nebo diakritiku. Na pohled může vypadat jako známý web, ale vede jinam.');
    h += row('Subdoména', u.subdomain ? '<code>' + esc(u.subdomain) + '</code>' : 'žádná',
      u.subdomain ? 'Text před skutečnou doménou si vlastník pojmenuje, jak chce. Klidně i jménem banky nebo pošty, a nic to neznamená.' : '');
    h += row('Cesta', u.path ? '<code>' + esc(u.path) + '</code>' : 'žádná', u.path ? 'Část za lomítkem o cíli nerozhoduje. Jména firem v ní nic nedokazují.' : '');
    h += row('Šifrování', u.secure ? 'HTTPS' : u.hadScheme ? 'HTTP, nešifrované' : 'neuvedeno',
      u.secure ? 'Spojení je šifrované. Neříká ale nic o tom, kdo web provozuje. Zámek mají i podvodné stránky.'
        : u.hadScheme ? 'Spojení není šifrované, údaje by šlo cestou přečíst. Nikam nic nezadávejte.'
          : 'Adresa nezačíná https:// ani http://. Prohlížeč si začátek doplní sám. Ani zámek by ale nic nezaručil.');
    h += '</dl><p class="small-note">Odkaz jsme neotevřeli. Kam případně přesměrovává, odsud bezpečně ověřit nejde.</p></div>';
    return h;
  }
  function senderHtml(a) {
    var e = a.email || {}, m = a.emailMeta || {};
    var h = '<div class="card sender"><dl>';
    h += '<div class="bd-row"><dt>Odesílatel</dt><dd>' + (e.fromName ? '<b>' + esc(e.fromName) + '</b> ' : '') + (e.fromAddr ? '<code>' + esc(e.fromAddr) + '</code>' : 'adresa neuvedena') + '</dd></div>';
    if (m.domain) h += '<div class="bd-row"><dt>Doména adresy</dt><dd><code>' + esc(m.domain) + '</code>' + (m.freeMail ? '<p class="bd-note">Bezplatná schránka, adresu si tu založí kdokoli.</p>' : '') + '</dd></div>';
    if (e.subject) h += '<div class="bd-row"><dt>Předmět</dt><dd>' + esc(e.subject) + '</dd></div>';
    h += '</dl><p class="small-note">' + (m.headersChecked
      ? 'Výsledek ověření odesílatele jsme převzali z vložených hlaviček. Sami jsme ho neprováděli.'
      : (e.headers && e.headers.present
        ? 'Ve vložených hlavičkách jsme nenašli výsledek ověření odesílatele, takže o něm nic neříkáme.'
        : 'Technické hlavičky jste nevložili. Neověřovali jsme proto, odkud e-mail skutečně přišel. Posuzujeme jen jméno, adresu a text.')) + '</p></div>';
    return h;
  }

  function renderResult() {
    var a = state.analysis;
    var ev = A.evaluate(a, state.answers);
    var base = A.evaluate(a, {});
    var v = VERDICT[ev.level];
    var reasons = buildReasons(a, ev);
    var fromOcr = state.source === 'ocr';

    var kind = state.kind;
    var AGAIN = { msg: 'Zkontrolovat jinou zprávu', url: 'Rozebrat jiný odkaz', mail: 'Zkontrolovat jiný e-mail' };
    var h = '<p class="back"><button type="button" class="link" data-act="again">← ' + AGAIN[kind] + '</button></p>';

    var answeredAny = Object.keys(state.answers).length > 0;
    var changed = state.lastLevel && state.lastLevel !== ev.level;
    state.lastLevel = ev.level;
    if (answeredAny && ev.level !== base.level) {
      v = {
        pill: v.pill,
        title: ev.level === 'low' ? 'Podle vašich odpovědí to vypadá spíš v pořádku' : ev.level === 'mid' ? 'Pořád tu něco nesedí' : 'Vypadá to na podvod ještě víc',
        say: ev.level === 'low' ? 'Riziko jsme snížili podle toho, co jste odpověděli. Peníze ani údaje ale nikomu neposílejte, dokud si to sami neověříte.' : v.say
      };
    }
    // U textu z obrázku neuklidňujeme: OCR mohlo část zprávy přečíst špatně.
    // U samotného odkazu nesmí „nízké riziko“ znít jako záruka: stránku jsme neotevřeli.
    if (kind === 'url' && ev.level === 'low' && !answeredAny) {
      v = { pill: v.pill, title: 'V adrese jsme nenašli varovné znaky', say: 'To ale neznamená, že je stránka bezpečná. Posoudili jsme jen, jak adresa vypadá, ne co na stránce je. Údaje a platby zadávejte jen na webech, které znáte.' };
    }
    if (kind === 'mail' && ev.level === 'low' && !answeredAny) {
      v = { pill: v.pill, title: 'V e-mailu jsme nenašli varovné znaky', say: 'Kdyby ale po vás chtěl peníze, heslo nebo údaje z karty, ověřte si ho jinak než odpovědí na e-mail.' };
    }
    if (fromOcr && ev.level === 'low') {
      v = { pill: v.pill, title: 'V přečteném textu jsme nenašli varovné znaky', say: 'Text jsme četli z obrázku a mohli jsme něco přečíst špatně, hlavně v odkazu. Zkontrolujte ho níže, nebo zprávu zkopírujte a vložte jako text.' };
    }

    h += '<div class="verdict' + (changed ? ' is-updated' : '') + '" id="verdict"><div class="verdict-top"><span class="mono-label">' +
      (answeredAny ? 'Přehodnoceno podle vašich odpovědí' : 'Výsledek kontroly') + '</span><span class="risk ' + ev.level + '">' + v.pill + '</span></div>' +
      '<h1 id="verdict-title" tabindex="-1">' + esc(v.title) + '</h1><p>' + esc(v.say) + '</p>' +
      '<div class="meter ' + ev.level + '" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="meter-legend" aria-hidden="true"><span>Nízké</span><span>Zvýšené</span><span>Vysoké</span></div></div>';

    if (fromOcr) {
      var q = state.ocr && state.ocr.quality === 'uncertain';
      h += '<div class="ocr-banner' + (q ? ' is-uncertain' : '') + '"><p class="mono-label">Text z obrázku</p>' +
        '<p>' + (q ? 'Obrázek se četl hůř, text může obsahovat chyby. ' : '') +
        'Text jsme přečetli z obrázku. Čtení může splést podobné znaky, hlavně v odkazu, a písmena z jiných abeced pozná jen u vloženého textu. Opravte ho podle originálu a zkontrolujte znovu.</p>' +
        '<label class="sr" for="ocr-edit">Přečtený text</label><textarea id="ocr-edit" rows="5" spellcheck="false">' + esc(a.text) + '</textarea>' +
        '<button type="button" class="btn btn-secondary" data-act="recheck">Zkontrolovat opravený text</button></div>';
    }

    if (ev.level !== 'low') {
      if (state.reportChoice === 'no') {
        h += '<div class="report-ask is-done"><p>Dobře. Kdybyste si to rozmysleli, podvod můžete nahlásit kdykoli. Podvodnou SMS stačí přeposlat na <b>7726</b>.</p>' +
          '<button type="button" class="link" data-act="report-page">Další možnosti nahlášení</button></div>';
      } else {
        h += '<div class="report-ask"><div><p class="mono-label">Nahlášení</p><p class="report-ask-q">Chcete to nahlásit policii?</p>' +
          '<p class="report-ask-sub">Pomůžeme vám připravit text oznámení. Policii ho pak pošlete nebo zanesete sami, za vás nic neodešleme.</p></div>' +
          '<div class="report-ask-btns"><button type="button" class="btn btn-primary" data-act="report-yes">Připravit oznámení <span class="arrow" aria-hidden="true">→</span></button>' +
          '<button type="button" class="btn btn-secondary" data-act="report-no">Teď ne</button></div></div>';
      }
    }

    if (ev.needHelp) {
      h += '<div class="callout"><p>Už jste na něco klikli nebo něco zaplatili? Poradíme, co udělat hned teď.</p><button type="button" class="btn btn-primary" data-act="help">Co mám dělat <span class="arrow" aria-hidden="true">→</span></button></div>';
    }

    if (kind === 'url') {
      h += '<section class="block"><p class="mono-label">Rozbor odkazu</p>' + a.urls.map(breakdownHtml).join('');
    } else if (kind === 'mail') {
      h += '<section class="block"><p class="mono-label">Váš e-mail</p>' + senderHtml(a) +
        (a.text.trim() ? '<div class="specimen-wrap"><span class="corner tl" aria-hidden="true"></span><span class="corner br" aria-hidden="true"></span><div class="specimen">' + bubbleHtml(a.text, reasons) + '</div></div>' : '');
    } else {
      h += '<section class="block"><p class="mono-label">Vaše zpráva</p><div class="specimen-wrap"><span class="corner tl" aria-hidden="true"></span><span class="corner br" aria-hidden="true"></span>' +
        '<div class="specimen">' + bubbleHtml(a.text, reasons) + '</div></div>';
    }

    if (reasons.length) {
      h += '<ol class="reasons">' + reasons.map(function (r) {
        var extra = '';
        if (kind !== 'url' && r.url && (r.url.foreign || r.url.summary.kind === 'fake')) {
          extra += '<span class="domain">' + domainHtml(r.url) + '</span>';
          if (r.url.foreign) extra += '<p class="domain-note">Počítač tu adresu ve skutečnosti čte jako <code>' + esc(r.url.ascii) + '</code></p>';
        }
        if (r.more && r.more.length) {
          extra += '<ul class="more">' + r.more.map(function (f) { return '<li>' + esc(f.title) + '</li>'; }).join('') + '</ul>';
        }
        return '<li class="reason ' + r.sev + '"><span class="num">' + (r.n < 10 ? '0' : '') + r.n + '</span><div><h3>' + esc(r.title) + '</h3><p>' + esc(r.detail) + '</p>' + extra + '</div></li>';
      }).join('') + '</ol>';
    } else {
      h += '<p class="none">' + (kind === 'url' ? 'V adrese jsme nenašli žádné typické triky podvodníků.' : kind === 'mail' ? 'V e-mailu jsme nenašli žádné typické triky podvodníků.' : 'Ve zprávě jsme nenašli žádné typické triky podvodníků.') + '</p>';
    }
    h += '</section>';

    // Otázky ve stylu kalkulačky: odpovězené shrnuté, aktuální jedna
    var qs = A.questionsFor(a);
    var done = qs.filter(function (qq) { return state.answers[qq.id]; }).length;
    var current = qs.filter(function (qq) { return !state.answers[qq.id]; })[0];
    h += '<section class="block"><p class="mono-label">Upřesnění</p><h2>Pomozte nám to upřesnit</h2><div class="card quiz">' +
      '<div class="quiz-head"><span class="mono-label">' + (current ? 'Otázka ' + (done + 1) + ' z ' + qs.length : 'Hotovo') + '</span>' +
      '<div class="progress"><i data-progress="' + Math.round((done / qs.length) * 100) + '"></i></div>' +
      (done ? '<span class="live risk ' + ev.level + '">' + v.pill + '</span>' : '') + '</div>';
    if (done) {
      h += '<ul class="answered">' + qs.filter(function (qq) { return state.answers[qq.id]; }).map(function (qq) {
        var opt = qq.options.filter(function (o) { return o.v === state.answers[qq.id]; })[0];
        return '<li><span class="q">' + esc(qq.text) + '</span><span class="a">' + esc(opt.label) + '</span>' +
          '<button type="button" class="link" data-undo="' + qq.id + '">změnit</button>' +
          (ev.notes[qq.id] ? '<p class="note">' + esc(ev.notes[qq.id]) + '</p>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    if (current) {
      h += '<div class="quiz-body"><p class="quiz-q" id="quiz-q" tabindex="-1">' + esc(current.text) + '</p><div class="opts">' + current.options.map(function (o) {
        return '<button type="button" class="opt" data-q="' + current.id + '" data-v="' + o.v + '">' + esc(o.label) + '</button>';
      }).join('') + '</div></div>';
    } else {
      var order = { low: 0, mid: 1, high: 2 };
      var dir = order[ev.level] - order[base.level];
      var RE = {
        up: 'Vaše odpovědi riziko zvýšily. Teď to vypadá vážněji než na první pohled, takže buďte hodně opatrní.',
        down: 'Podle vašich odpovědí to vypadá líp, než se zdálo. Pořád ale platí, že peníze ani údaje nikomu neposílejte, dokud si to neověříte.',
        same: ev.level === 'low' ? 'Vaše odpovědi hodnocení potvrdily.' : 'Vaše odpovědi hodnocení potvrdily. Na tuhle zprávu raději nereagujte.'
      };
      if (dir < 0 && ev.level !== 'low') RE.down = 'Podle vašich odpovědí to vypadá o něco líp. Zpráva ale pořád obsahuje varovné znaky, které odpovědi nevysvětlí.';
      h += '<div class="reeval ' + ev.level + '" id="reeval" tabindex="-1"><p class="mono-label">Přehodnoceno</p>' +
        '<div class="reeval-row">' +
          (dir !== 0 ? '<span class="risk ' + base.level + ' is-old">' + VERDICT[base.level].pill + '</span><span class="reeval-arrow" aria-hidden="true">→</span>' : '') +
          '<span class="risk ' + ev.level + '">' + v.pill + '</span></div>' +
        '<p class="reeval-title">' + esc(v.title) + '</p>' +
        '<p class="reeval-text">' + esc(dir > 0 ? RE.up : dir < 0 ? RE.down : RE.same) + '</p>' +
        '<button type="button" class="link" data-act="to-verdict">Zobrazit celé hodnocení nahoře</button></div>';
    }
    h += '</div></section>';

    h += '<section class="block"><p class="mono-label">Doporučení</p><h2>Co dělat teď</h2><ol class="steps">' + NEXT[ev.level].map(function (t) { return '<li><span>' + esc(t) + '</span></li>'; }).join('') + '</ol></section>';
    h += '<a class="ebook-card" href="' + EBOOK_URL + '" target="_blank" rel="noopener">' +
      '<img src="' + EBOOK_COVER + '" alt="Obálka e-booku Nenech se nachytat" width="96" height="136" loading="lazy">' +
      '<span class="ebook-card-text"><span class="mono-label">E-book od PEBMedia</span>' +
      '<b>Chcete podvody poznat dřív, než vám přijdou?</b>' +
      '<span>Nenech se nachytat vysvětluje nejčastější triky podvodníků srozumitelně a s příklady. Hodí se pro celou rodinu.</span>' +
      '<span class="ebook-card-cta">Prohlédnout e-book <span class="arrow" aria-hidden="true">→</span></span></span></a>';
    h += '<p class="disclaimer">Hodnocení je orientační odhad podle známých triků podvodníků. Nový nebo neobvyklý podvod nemusí poznat a bezpečnost zprávy nezaručuje.</p>';

    var box = $('result');
    box.innerHTML = h;
    box.hidden = false;
    // Šířku průběhu nastavujeme přes CSSOM, aby nebyl potřeba inline styl (CSP).
    each('#result [data-progress]', function (el) { el.style.width = el.getAttribute('data-progress') + '%'; });

    box.querySelector('[data-act="again"]').addEventListener('click', function () { resetCheck(); go('check'); setMode(kind); $(MODE_FIRST[kind]).focus(); });
    var hb = box.querySelector('[data-act="help"]');
    if (hb) hb.addEventListener('click', function () { go('help'); });
    var tv = box.querySelector('[data-act="to-verdict"]');
    if (tv) tv.addEventListener('click', function () { $('verdict').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('verdict-title').focus({ preventScroll: true }); });
    var ry = box.querySelector('[data-act="report-yes"]');
    if (ry) ry.addEventListener('click', function () { openPolice(true); });
    var rn = box.querySelector('[data-act="report-no"]');
    if (rn) rn.addEventListener('click', function () { state.reportChoice = 'no'; rerender(); });
    var rp = box.querySelector('[data-act="report-page"]');
    if (rp) rp.addEventListener('click', function () { go('report'); });
    var rc = box.querySelector('[data-act="recheck"]');
    if (rc) rc.addEventListener('click', function () {
      $('msg').value = $('ocr-edit').value;
      state.ocr = state.ocr ? { quality: 'edited' } : null;
      runCheck('ocr-edited');
    });
    Array.prototype.forEach.call(box.querySelectorAll('.opt'), function (b) {
      b.addEventListener('click', function () {
        state.answers[b.getAttribute('data-q')] = b.getAttribute('data-v');
        var before = state.lastLevel;
        rerender();
        var after = state.lastLevel;
        var re = $('reeval');
        var next = $('quiz-q');
        if (re) { re.scrollIntoView({ behavior: 'smooth', block: 'center' }); re.focus({ preventScroll: true }); }
        else if (next) next.focus({ preventScroll: true });
        announce(before !== after ? 'Hodnocení se změnilo na: ' + VERDICT[after].pill + '.' : (re ? 'Hodnocení zůstává: ' + VERDICT[after].pill + '.' : 'Další otázka.'));
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-undo]'), function (b) {
      b.addEventListener('click', function () {
        delete state.answers[b.getAttribute('data-undo')];
        rerender();
        var next = $('quiz-q');
        if (next) next.focus();
      });
    });
  }

  function rerender() {
    var y = window.scrollY;
    renderResult();
    window.scrollTo(0, y);
  }

  /* ---------- Screenshot (OCR) ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.Tesseract) return resolve();
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('network')); };
      document.head.appendChild(s);
    });
  }

  // Zvětšení malých snímků, odstíny šedi a převrácení tmavého režimu pro lepší čtení
  function prepareImage(file) {
    return new Promise(function (resolve) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var scale = img.width < 1000 ? 2 : 1;
          var c = document.createElement('canvas');
          c.width = img.width * scale; c.height = img.height * scale;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, c.width, c.height);
          var d = ctx.getImageData(0, 0, c.width, c.height), px = d.data, sum = 0, i;
          for (i = 0; i < px.length; i += 4) {
            var g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            px[i] = px[i + 1] = px[i + 2] = g; sum += g;
          }
          if (sum / (px.length / 4) < 110) for (i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
          ctx.putImageData(d, 0, 0);
          resolve(c);
        } catch (e) { resolve(file); } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function ocrStatus(text, detail, pct) {
    $('ocr-status').textContent = text;
    $('ocr-detail').textContent = detail || '';
    $('ocr-detail').hidden = !detail;
    if (typeof pct === 'number') $('ocr-bar').style.width = Math.max(3, Math.min(100, pct)) + '%';
  }
  function ocrNote(msg, kind) {
    var n = $('ocr-note');
    n.textContent = msg;
    n.className = 'ocr-note' + (kind ? ' is-' + kind : '');
    n.hidden = false;
  }

  var busy = false;
  function runOcr(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      resetCheck();
      go('check', { replace: true });
      ocrNote('Tenhle soubor neumíme přečíst. Nahrajte snímek obrazovky jako obrázek (PNG nebo JPG), nebo text zprávy zkopírujte a vložte do pole.', 'error');
      return;
    }
    if (busy) return;
    busy = true;
    resetCheck();
    go('check', { replace: true });
    $('ocr').hidden = false;
    var firstTime = !window.Tesseract;
    ocrStatus('Připravuji čtení textu', firstTime ? 'Poprvé se stahuje čtečka textu (asi ' + OCR_DOWNLOAD_MB + ' MB). Příště už to bude rychlejší.' : '', 3);
    announce('Čtu text z obrázku.');
    var r = new FileReader();
    r.onload = function () { $('ocr-img').src = r.result; };
    r.readAsDataURL(file);
    var stage = 'download';

    loadScript(OCR_BASE + 'tesseract.min.js')
      .then(function () { return prepareImage(file); })
      .then(function (img) {
        if (!img) { stage = 'image'; throw new Error('image'); }
        return window.Tesseract.recognize(img, 'ces+eng', {
          workerPath: OCR_BASE + 'worker.min.js',
          corePath: OCR_BASE,
          langPath: OCR_BASE + 'lang',
          workerBlobURL: false,
          logger: function (m) {
            var p = typeof m.progress === 'number' ? m.progress : 0;
            if (m.status === 'loading tesseract core') ocrStatus('Stahuji čtečku textu', $('ocr-detail').textContent, 5 + p * 25);
            else if (m.status === 'loading language traineddata') ocrStatus('Stahuji češtinu a angličtinu pro čtení', $('ocr-detail').textContent, 30 + p * 35);
            else if (m.status === 'initializing api' || m.status === 'initializing tesseract') ocrStatus('Připravuji čtení', '', 66);
            else if (m.status === 'recognizing text') { stage = 'recognize'; ocrStatus('Čtu text z obrázku', '', 70 + p * 30); }
          }
        });
      })
      .then(function (res) {
        var raw = (res && res.data && res.data.text || '').replace(/\n{3,}/g, '\n\n').trim();
        var conf = res && res.data ? res.data.confidence : 0;
        var text = A.normalizeOcrText(raw);
        var q = A.assessOcr(text, conf);
        $('ocr').hidden = true;
        if (!q.readable) {
          // Nečitelný výsledek nevyhodnocujeme, aby nevzniklo falešné „nízké riziko“.
          $('msg').value = '';
          ocrNote('Z obrázku se nepodařilo spolehlivě přečíst text, takže zprávu nemůžeme posoudit. Opište sem prosím aspoň odkaz a hlavní větu, nebo nahrajte ostřejší snímek.', 'error');
          announce('Text z obrázku se nepodařilo přečíst.');
          $('msg').focus();
          return;
        }
        $('msg').value = text;
        state.ocr = { quality: q.quality, confidence: q.confidence };
        runCheck('ocr');
      })
      .catch(function () {
        $('ocr').hidden = true;
        if (stage === 'download') {
          ocrNote(navigator.onLine === false
            ? 'Jste offline, takže se čtečka textu nemohla stáhnout. Připojte se k internetu, nebo text zprávy opište do pole.'
            : 'Čtečku textu se nepodařilo stáhnout. Zkuste to za chvíli znovu, nebo text zprávy opište do pole.', 'error');
        } else if (stage === 'image') {
          ocrNote('Obrázek se nepodařilo otevřít. Zkuste jiný snímek obrazovky, nebo text zprávy opište do pole.', 'error');
        } else {
          ocrNote('Z obrázku se text přečíst nepodařilo. Opište sem prosím aspoň odkaz a hlavní větu ze zprávy.', 'error');
        }
        announce('Čtení obrázku se nepovedlo.');
      })
      .then(function () { busy = false; });
  }

  $('pick').addEventListener('click', function () { $('file').click(); });
  $('file').addEventListener('change', function () {
    if (this.files && this.files[0]) runOcr(this.files[0]);
    this.value = '';
  });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) runOcr(f);
  });
  document.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        e.preventDefault();
        runOcr(items[i].getAsFile());
        return;
      }
    }
  });

  /* ---------- Už se to stalo: nouzový plán ---------- */
  $('sit-list').insertAdjacentHTML('beforeend', G.SITUATIONS.map(function (sit) {
    return '<label class="check' + (sit.urgent ? ' is-urgent' : '') + '"><input type="checkbox" value="' + sit.id + '"><span>' + esc(sit.label) + '</span></label>';
  }).join(''));
  each('#sit-list input', function (c) { c.addEventListener('change', function () { renderPlan(); }); });

  function selectedSituations() {
    return Array.prototype.filter.call(document.querySelectorAll('#sit-list input'), function (c) { return c.checked; }).map(function (c) { return c.value; });
  }
  function renderPlan() {
    var sel = selectedSituations();
    var box = $('plan');
    if (!sel.length) { box.innerHTML = '<p class="plan-empty">Označte, co se stalo, a ukážeme vám kroky seřazené podle naléhavosti.</p>'; return; }
    var plan = G.buildPlan(sel);
    var h = '';
    var n = 0;
    G.PHASES.forEach(function (ph, i) {
      var steps = plan[ph.id];
      if (!steps.length) return;
      h += '<div class="phase phase-' + ph.id + '"><div class="phase-head"><span class="phase-num">0' + (i + 1) + '</span><h3>' + esc(ph.title) + '</h3>' +
        (ph.id === 'now' && plan.urgent ? '<span class="urgent-tag">Jednejte hned</span>' : ph.note ? '<span class="phase-note">' + esc(ph.note) + '</span>' : '') + '</div>' +
        '<ol class="plan-steps" start="' + (n + 1) + '">' + steps.map(function (st) {
          n++;
          return '<li><span class="plan-n">' + (n < 10 ? '0' : '') + n + '</span><div><b>' + esc(st.title) + '</b><span>' + esc(st.detail) + '</span></div></li>';
        }).join('') + '</ol></div>';
    });
    plan.tips.forEach(function (t) { h += '<p class="tip">' + esc(t) + '</p>'; });
    if (plan.police) {
      h += '<div class="prep"><p class="mono-label">K oznámení na policii</p><h3>Co si připravit</h3><ul>' +
        G.POLICE_PREP.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        '<button type="button" class="btn btn-primary" data-open-police>Připravit text oznámení <span class="arrow" aria-hidden="true">→</span></button>' +
        '<p class="small-note">Oznámení za vás nepodáváme. Připravíme jen text, který pak policii podáte sami.</p></div>';
    }
    box.innerHTML = h;
    box.querySelectorAll('[data-open-police]').forEach(function (b) { b.addEventListener('click', function () { openPolice(false); }); });
  }
  renderPlan();

  /* ---------- Průvodce podezřelým telefonátem ---------- */
  var CALL_VERDICT = {
    high: { pill: 'Vysoké riziko', title: 'Tohle vypadá jako podvodný hovor', say: 'Přesně takhle podvodníci postupují. Nic z toho, co chtěl, nedělejte a hovor ukončete.' },
    mid: { pill: 'Zvýšené riziko', title: 'Na tom hovoru něco nesedí', say: 'Než cokoli uděláte, ověřte si to sami jinou cestou.' },
    low: { pill: 'Nízké riziko', title: 'Podle odpovědí nic typického pro podvod', say: 'Kdyby ale volající začal chtít peníze, kódy nebo instalaci aplikace, zavěste.' }
  };
  function callQuestions() {
    var a = state.call;
    var hard = ['transfer', 'app', 'code', 'details'].some(function (k) { return a[k] === 'yes'; });
    return G.CALL_QUESTIONS.filter(function (q) { return q.id !== 'did' || hard; });
  }
  function optsOf(q) { return q.yesno ? [{ v: 'yes', label: 'Ano' }, { v: 'no', label: 'Ne' }] : q.options; }
  function renderCall(focus) {
    var box = $('call-box');
    var qs = callQuestions();
    var done = qs.filter(function (q) { return state.call[q.id]; });
    var current = qs.filter(function (q) { return !state.call[q.id]; })[0];
    var h = '<div class="quiz-head"><span class="mono-label">' + (current ? 'Otázka ' + (done.length + 1) + ' z ' + qs.length : 'Hotovo') + '</span>' +
      '<div class="progress"><i data-progress="' + Math.round(done.length / qs.length * 100) + '"></i></div></div>';
    if (done.length) {
      h += '<ul class="answered">' + done.map(function (q) {
        var o = optsOf(q).filter(function (x) { return x.v === state.call[q.id]; })[0];
        return '<li><span class="q">' + esc(q.text) + '</span><span class="a">' + esc(o.label) + '</span><button type="button" class="link" data-call-undo="' + q.id + '">změnit</button></li>';
      }).join('') + '</ul>';
    }
    if (current) {
      h += '<div class="quiz-body"><p class="quiz-q" id="call-q" tabindex="-1">' + esc(current.text) + '</p><div class="opts">' +
        optsOf(current).map(function (o) { return '<button type="button" class="opt" data-call-q="' + current.id + '" data-v="' + o.v + '">' + esc(o.label) + '</button>'; }).join('') + '</div></div>';
    } else {
      var r = G.assessCall(state.call);
      var v = CALL_VERDICT[r.level];
      h += '<div class="call-result" id="call-result" tabindex="-1"><div class="verdict-top"><span class="mono-label">Výsledek</span><span class="risk ' + r.level + '">' + v.pill + '</span></div>' +
        '<h3 class="call-title">' + esc(v.title) + '</h3><p>' + esc(v.say) + '</p>';
      if (r.signs.length) {
        h += '<ol class="reasons">' + r.signs.map(function (sg, i) {
          return '<li class="reason high"><span class="num">0' + (i + 1) + '</span><div><h3>' + esc(sg.title) + '</h3><p>' + esc(sg.detail) + '</p></div></li>';
        }).join('') + '</ol>';
      }
      if (r.emergency.length) {
        h += '<div class="callout"><p>Udělali jste něco z toho, co chtěl? Pár kroků je potřeba udělat hned.</p><button type="button" class="btn btn-primary" data-call-plan>Co mám dělat <span class="arrow" aria-hidden="true">→</span></button></div>';
      }
      h += '<p class="mono-label call-steps-label">Co dělat</p><ol class="steps">' + r.steps.map(function (st) {
        return '<li><span><b>' + esc(st.title) + '</b><br>' + esc(st.detail) + '</span></li>';
      }).join('') + '</ol>';
      if (r.report158) h += '<p class="small-note">Podvodný hovor můžete oznámit policii na lince 158. Číslo, ze kterého volali, nahlaste i operátorovi na 7726.</p>';
      h += '<div class="call-actions"><button type="button" class="btn btn-secondary" data-call-reset>Začít znovu</button>' +
        (r.level !== 'low' ? '<button type="button" class="btn btn-secondary" data-call-report>Připravit oznámení</button>' : '') + '</div>' +
        '<p class="disclaimer">Hodnocení je orientační. Vychází jen z vašich odpovědí a hovor samotný jsme neslyšeli.</p></div>';
    }
    box.innerHTML = h;
    each('#call-box [data-progress]', function (el) { el.style.width = el.getAttribute('data-progress') + '%'; });
    each('#call-box [data-call-q]', function (b) {
      b.addEventListener('click', function () {
        state.call[b.getAttribute('data-call-q')] = b.getAttribute('data-v');
        renderCall(true);
      });
    });
    each('#call-box [data-call-undo]', function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-call-undo');
        delete state.call[id];
        if (id !== 'who' && id !== 'did' && callQuestions().every(function (q) { return q.id !== 'did'; })) delete state.call.did;
        renderCall(true);
      });
    });
    var rs = box.querySelector('[data-call-reset]');
    if (rs) rs.addEventListener('click', function () { state.call = {}; renderCall(true); });
    var pl = box.querySelector('[data-call-plan]');
    if (pl) pl.addEventListener('click', function () { state.preselect = G.assessCall(state.call).emergency; go('help'); });
    var rp = box.querySelector('[data-call-report]');
    if (rp) rp.addEventListener('click', function () {
      $('r-channel').value = 'telefonátem';
      openPolice(false);
    });
    if (focus) {
      var f = $('call-q') || $('call-result');
      if (f) f.focus({ preventScroll: false });
      if (!$('call-q')) announce('Výsledek: ' + CALL_VERDICT[G.assessCall(state.call).level].pill + '.');
    }
  }

  /* ---------- Naučit se: trénink a knihovna ---------- */
  var tr = { i: 0, picked: null, score: 0 };
  function renderTraining(focus) {
    var box = $('training');
    var list = G.TRAINING;
    var h;
    if (tr.i >= list.length) {
      var pct = tr.score / list.length;
      h = '<div class="quiz-head"><span class="mono-label">Hotovo</span><div class="progress"><i data-progress="100"></i></div></div>' +
        '<div class="quiz-body" id="tr-focus" tabindex="-1"><p class="quiz-q">Správně ' + tr.score + ' z ' + list.length + '</p><p class="tr-sum">' +
        (pct === 1 ? 'Výborně, nenachytali jste se ani jednou. Pravidlo zní: když po vás někdo chce peníze, údaje nebo kód, ověřte si ho jinou cestou.'
          : pct >= 0.6 ? 'Dobrá práce. Projděte si níže triky, které vás zaskočily, a příště je poznáte hned.'
            : 'Podvodníci jsou šikovní, nic si z toho nedělejte. Projděte si níže nejčastější triky a zkuste to znovu.') +
        '</p><button type="button" class="btn btn-primary" data-tr-again>Zkusit znovu</button></div>';
    } else {
      var t = list[tr.i];
      h = '<div class="quiz-head"><span class="mono-label">Zpráva ' + (tr.i + 1) + ' z ' + list.length + '</span><div class="progress"><i data-progress="' + Math.round(tr.i / list.length * 100) + '"></i></div>' +
        '<span class="tr-score">Správně ' + tr.score + '</span></div><div class="quiz-body"><div class="specimen tr-msg">' + esc(t.text) + '</div>';
      if (tr.picked === null) {
        h += '<p class="quiz-q" id="tr-focus" tabindex="-1">Je to podvod?</p><div class="opts">' +
          '<button type="button" class="opt" data-tr="scam">Je to podvod</button><button type="button" class="opt" data-tr="ok">Je v pořádku</button></div>';
      } else {
        var right = (tr.picked === 'scam') === t.scam;
        h += '<div class="tr-feedback ' + (right ? 'is-right' : 'is-wrong') + '" id="tr-focus" tabindex="-1"><p class="tr-verdict">' +
          (right ? 'Správně. ' : 'Tentokrát ne. ') + (t.scam ? 'Je to podvod.' : 'Tahle zpráva je v pořádku.') + '</p><p>' + esc(t.explain) + '</p></div>' +
          '<button type="button" class="btn btn-primary" data-tr-next>' + (tr.i + 1 < list.length ? 'Další zpráva' : 'Zobrazit výsledek') + ' <span class="arrow" aria-hidden="true">→</span></button>';
      }
      h += '</div>';
    }
    box.innerHTML = h;
    each('#training [data-progress]', function (el) { el.style.width = el.getAttribute('data-progress') + '%'; });
    each('#training [data-tr]', function (b) {
      b.addEventListener('click', function () {
        tr.picked = b.getAttribute('data-tr');
        if ((tr.picked === 'scam') === list[tr.i].scam) tr.score++;
        renderTraining(true);
      });
    });
    var nx = box.querySelector('[data-tr-next]');
    if (nx) nx.addEventListener('click', function () { tr.i++; tr.picked = null; renderTraining(true); });
    var ag = box.querySelector('[data-tr-again]');
    if (ag) ag.addEventListener('click', function () { tr = { i: 0, picked: null, score: 0 }; renderTraining(true); });
    if (focus && $('tr-focus')) $('tr-focus').focus();
  }
  renderTraining();

  each('[data-lib-ex]', function (b) {
    b.addEventListener('click', function () {
      resetCheck();
      setMode('msg');
      $('msg').value = b.getAttribute('data-lib-ex');
      runCheck('text');
    });
  });
  each('[data-lib-call]', function (b) {
    b.addEventListener('click', function () {
      state.call = {};
      go('check');
      setMode('call');
      var q = $('call-q'); if (q) q.focus();
    });
  });

  /* ---------- Příprava oznámení pro policii (vyskakovací okno) ---------- */
  var dlg = $('police');
  var CHANNEL_GUESS = [[/whats\s?app|messenger|telegram|signal/i, 'přes WhatsApp nebo jiný chat'], [/vinted|bazos|bazar|sbazar/i, 'přes inzerát nebo bazar'], [/@|e-?mail/i, 'e-mailem']];

  function val(id) { return $(id).value.trim(); }
  function kind() { var r = dlg.querySelector('input[name="r-kind"]:checked'); return r ? r.value : ''; }
  function syncKind() {
    var loss = kind() === 'loss';
    each('.loss-only', function (el) { el.hidden = !loss; });
  }
  each('input[name="r-kind"]', function (r) { r.addEventListener('change', function () { syncKind(); $('r-kind-err').hidden = true; }); });

  function syncRegion() {
    var reg = $('r-region').value;
    $('r-addr').textContent = reg ? reg + '.podatelna@policie.gov.cz' : 'nejdřív vyberte kraj';
  }
  $('r-region').addEventListener('change', function () { syncRegion(); $('r-region-err').hidden = true; if (!$('report-out').hidden) buildReport(); });

  function prefillReport() {
    var a = state.analysis;
    if (!a) return;
    if (!$('r-msg').value) $('r-msg').value = a.text.trim();
    if (!$('r-link').value && a.urls.length) $('r-link').value = a.urls.map(function (u) { return u.raw + (u.foreign ? ' (skutečná adresa: ' + u.ascii + ')' : ''); }).join(', ');
    if (state.kind === 'mail' && a.email) {
      $('r-channel').value = 'e-mailem';
      if (!$('r-from').value && a.email.fromAddr) $('r-from').value = a.email.fromAddr;
    } else CHANNEL_GUESS.some(function (g) {
      if (g[0].test(a.text)) { $('r-channel').value = g[1]; return true; }
      return false;
    });
    // Když uživatel u otázek odpověděl, že už klikl nebo zaplatil, nepředvybíráme „jen pokus“.
    var acted = state.answers.acted === 'yes';
    each('input[name="r-kind"]', function (r) { r.checked = !acted && r.value === 'attempt'; });
    $('r-kind-hint').hidden = !acted;
  }

  function openPolice(fromResult) {
    if (fromResult) prefillReport();
    else if (!$('view-help').hidden) {
      // Ze sekce „Už se to stalo“ nepředpokládáme, že šlo jen o pokus.
      each('input[name="r-kind"]', function (r) { r.checked = false; });
    }
    syncKind();
    syncRegion();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    hist('pushState', { modal: true, view: (history.state && history.state.view) || 'check', result: history.state && history.state.result }, location.hash);
    dlg.querySelector('.modal-body').scrollTop = 0;
  }
  function closePolice(fromHistory) {
    if (typeof dlg.close === 'function') { if (dlg.open) dlg.close(); } else dlg.removeAttribute('open');
    if (!fromHistory && history.state && history.state.modal) { ignoreNextPop = true; history.back(); }
  }
  each('[data-open-police]', function (b) { b.addEventListener('click', function () { openPolice(false); }); });
  dlg.querySelector('[data-close]').addEventListener('click', function () { closePolice(false); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closePolice(false); });
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); closePolice(false); });

  function buildReport() {
    var res = R.build({
      kind: kind(),
      region: $('r-region').value,
      when: val('r-when'),
      channel: $('r-channel').value,
      from: val('r-from'),
      link: val('r-link'),
      amount: val('r-amount'),
      account: val('r-account'),
      actions: Array.prototype.map.call(dlg.querySelectorAll('.checks input:checked'), function (c) { return c.value; }),
      desc: val('r-desc'),
      timeline: $('r-timeline').value,
      msg: val('r-msg'),
      name: val('r-name'),
      born: val('r-born'),
      address: val('r-address'),
      contact: val('r-contact'),
      claim: $('r-claim').checked,
      evidence: { screens: $('r-ev-screens').checked, payment: $('r-ev-payment').checked, message: $('r-ev-message').checked }
    });
    if (res.error) return res;
    $('report-text').textContent = res.text;
    var m = R.mailto(res.address, res.subject, res.text);
    $('r-mail').href = m.href;
    $('r-mail-note').textContent = m.includesBody
      ? 'E-mail se otevře i s textem oznámení.'
      : 'Text je na e-mail moc dlouhý, aby se do něj vložil sám. Otevře se jen e-mail s předmětem, text do něj vložte tlačítkem Zkopírovat text.';
    return res;
  }

  $('report').addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = null;
    if (!kind()) { $('r-kind-err').hidden = false; bad = bad || dlg.querySelector('input[name="r-kind"]'); }
    if (!$('r-region').value) { $('r-region-err').hidden = false; bad = bad || $('r-region'); }
    if (bad) { bad.focus(); return; }
    var res = buildReport();
    if (res.error) { $('r-region-err').hidden = false; $('r-region').focus(); return; }
    $('report-out').hidden = false;
    $('copy-msg').textContent = '';
    $('report-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('report-out-title').focus({ preventScroll: true });
  });

  function copyText(text, node, msgEl, okMsg) {
    var done = function () { msgEl.textContent = okMsg; };
    var fallback = function () {
      var rng = document.createRange();
      rng.selectNodeContents(node);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rng);
      msgEl.textContent = 'Text je označený, zkopírujte si ho';
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    } catch (err) { fallback(); }
  }
  $('copy').addEventListener('click', function () { copyText($('report-text').textContent, $('report-text'), $('copy-msg'), 'Zkopírováno. Zatím nic nebylo odesláno.'); });
  $('copy-addr').addEventListener('click', function () {
    if (!$('r-region').value) { $('r-region-err').hidden = false; $('r-region').focus(); return; }
    copyText($('r-addr').textContent, $('r-addr'), $('copy-msg'), 'Adresa zkopírována');
  });

  /* ---------- Start ---------- */
  hist('replaceState', { view: viewFromHash(), result: false }, HASH[viewFromHash()]);
  setView(viewFromHash());
})();
