/* PEBMedia Protect: rozhraní */
(function () {
  'use strict';

  var A = window.PPAnalyzer;
  var $ = function (id) { return document.getElementById(id); };
  var TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var state = { analysis: null, answers: {} };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  var EXAMPLES = {
    posta: 'Česká pošta: Vaše zásilka nemohla být doručena, adresa je neúplná. Uhraďte doplatek 1,50 Kč do 24 hodin, jinak bude vrácena odesílateli: https://сeskapоsta-cz.info/track',
    mami: 'Ahoj mami, rozbil se mi telefon, tohle je moje nové číslo. Ulož si ho. Napiš mi na WhatsApp, potřebuju rychle zaplatit fakturu a banku mám ve starém mobilu.',
    bank: 'Dobrý den, zde bezpečnostní oddělení vaší banky. Zaznamenali jsme podezřelou transakci na vašem účtu. Pro ochranu úspor je nutné převést prostředky na bezpečný účet. Nainstalujte si prosím aplikaci AnyDesk, pomůžeme vám.',
    vinted: 'Dobrý den, zboží jsem vám zaplatil přes Vinted, kurýr si věc vyzvedne. Pro přijetí platby klikněte zde a potvrďte kartu: vinted-cz.payment-secure.online/item/552'
  };

  /* ---------- Přepínání stránek ---------- */
  var VIEWS = ['check', 'report', 'help'];
  function showView(v) {
    VIEWS.forEach(function (name) {
      $('view-' + name).hidden = name !== v;
      $('nav-' + name).removeAttribute('aria-current');
    });
    $('nav-' + v).setAttribute('aria-current', 'page');
    window.scrollTo(0, 0);
  }
  each('[data-view]', function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var v = a.getAttribute('data-view');
      if (v === 'check' && (a.classList.contains('logo') || a.hasAttribute('data-top'))) resetCheck();
      showView(v);
    });
  });
  if (location.hash === '#pomoc') showView('help');
  if (location.hash === '#nahlasit') showView('report');

  /* ---------- Kontrola ---------- */
  function runCheck() {
    var text = $('msg').value;
    if (!text.trim()) { $('msg').focus(); return; }
    state.analysis = A.analyze(text);
    state.answers = {};
    state.reportChoice = null;
    $('ask').hidden = true;
    renderResult();
    window.scrollTo(0, 0);
  }
  function resetCheck() {
    $('ask').hidden = false;
    $('result').hidden = true;
    $('result').innerHTML = '';
  }

  $('go').addEventListener('click', runCheck);
  $('msg').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runCheck();
  });
  each('[data-ex]', function (b) {
    b.addEventListener('click', function () {
      $('msg').value = EXAMPLES[b.getAttribute('data-ex')];
      runCheck();
    });
  });

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

  // Sestaví seznam důvodů (odkazy + nálezy v textu) a přidělí jim čísla
  function buildReasons(a) {
    var list = [];
    a.urls.forEach(function (u) {
      var s = u.summary;
      var head, sev = u.worst === 'none' ? 'info' : u.worst;
      var rest = u.findings.slice();
      if (s.kind === 'fake') {
        head = { title: 'Odkaz se tváří jako ' + s.brand, detail: 'Ve skutečnosti vede na úplně jiný web. Pravý je ' + s.real + '.' };
        rest = rest.filter(function (f) { return f.title.indexOf('Vydává se za') !== 0; });
      } else if (s.kind === 'official') {
        head = { title: 'Odkaz vede na pravý web ' + s.brand, detail: rest[0].detail };
        rest = [];
      } else if (rest.length) {
        head = { title: rest[0].title, detail: rest[0].detail };
        rest = rest.slice(1);
      } else {
        head = { title: 'Odkaz vede na web, který neznáme', detail: 'Sám o sobě nemusí být nebezpečný. Pokud po vás chce údaje nebo platbu, buďte opatrní.' };
      }
      list.push({ sev: sev, title: head.title, detail: head.detail, url: u, more: rest, spans: [[u.start, u.end]] });
    });
    a.textFindings.forEach(function (f) {
      list.push({ sev: f.sev, title: f.title, detail: f.detail, spans: f.spans });
    });
    var order = { high: 0, mid: 1, ok: 2, low: 3, info: 4 };
    list.sort(function (x, y) { return order[x.sev] - order[y.sev]; });
    list.forEach(function (r, i) { r.n = i + 1; });
    return list;
  }

  function domainHtml(u) {
    var subLen = Math.max(0, u.host.length - u.registrableRaw.length);
    var out = '';
    u.chars.forEach(function (c, i) {
      var ch = esc(c.ch);
      if (c.kind !== 'plain') ch = '<span class="fake" title="Písmeno z azbuky">' + ch + '</span>';
      out += i < subLen ? '<span class="dim">' + ch + '</span>' : '<span class="main">' + ch + '</span>';
    });
    return out;
  }

  function bubbleHtml(text, reasons) {
    var marks = [];
    reasons.forEach(function (r) {
      r.spans.forEach(function (sp, i) {
        marks.push({ s: sp[0], e: sp[1], n: i === 0 ? r.n : null, sev: r.sev, url: r.url });
      });
    });
    marks.sort(function (x, y) { return x.s - y.s || (y.e - y.s) - (x.e - x.s); });
    var out = '', pos = 0;
    marks.forEach(function (m) {
      if (m.s < pos) return;
      out += esc(text.slice(pos, m.s));
      var inner = '';
      var seg = text.slice(m.s, m.e);
      for (var i = 0; i < seg.length; i++) {
        var ch = seg[i];
        inner += /[Ѐ-ӿͰ-Ͽ]/.test(ch) ? '<span class="fake">' + esc(ch) + '</span>' : esc(ch);
      }
      out += '<mark class="hl ' + m.sev + '">' + inner + (m.n ? '<sup>' + m.n + '</sup>' : '') + '</mark>';
      pos = m.e;
    });
    return out + esc(text.slice(pos));
  }

  function renderResult() {
    var a = state.analysis;
    var ev = A.evaluate(a, state.answers);
    var v = VERDICT[ev.level];
    var reasons = buildReasons(a);

    var h = '<p class="back"><button type="button" class="link" data-act="again">← Zkontrolovat jinou zprávu</button></p>';

    h += '<div class="verdict"><div class="verdict-top"><span class="mono-label">Výsledek kontroly</span><span class="risk ' + ev.level + '">' + v.pill + '</span></div>' +
      '<h1>' + v.title + '</h1><p>' + v.say + '</p>' +
      '<div class="meter ' + ev.level + '" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="meter-legend" aria-hidden="true"><span>Nízké</span><span>Zvýšené</span><span>Vysoké</span></div></div>';

    if (ev.level !== 'low') {
      if (state.reportChoice === 'no') {
        h += '<div class="report-ask is-done"><p>Dobře. Kdybyste si to rozmysleli, podvod můžete nahlásit kdykoli. Podvodnou SMS stačí přeposlat na <b>7726</b>.</p>' +
          '<button type="button" class="link" data-act="report-page">Další možnosti nahlášení</button></div>';
      } else {
        h += '<div class="report-ask"><div><p class="mono-label">Nahlášení</p><p class="report-ask-q">Chcete tenhle pokus nahlásit policii?</p>' +
          '<p class="report-ask-sub">Pomůžeme vám sepsat oznámení. Zabere to pár minut a nic se neodešle bez vás.</p></div>' +
          '<div class="report-ask-btns"><button type="button" class="btn btn-primary" data-act="report-yes">Ano, nahlásit <span class="arrow" aria-hidden="true">→</span></button>' +
          '<button type="button" class="btn btn-secondary" data-act="report-no">Teď ne</button></div></div>';
      }
    }

    if (ev.needHelp) {
      h += '<div class="callout"><p>Už jste na něco klikli nebo něco zaplatili? Poradíme, co udělat hned teď.</p><button type="button" class="btn btn-primary" data-act="help">Co mám dělat <span class="arrow" aria-hidden="true">→</span></button></div>';
    }

    h += '<section class="block"><p class="mono-label">Vaše zpráva</p><div class="specimen-wrap"><span class="corner tl" aria-hidden="true"></span><span class="corner br" aria-hidden="true"></span>' +
      '<div class="specimen">' + bubbleHtml(a.text, reasons) + '</div></div>';

    if (reasons.length) {
      h += '<ol class="reasons">' + reasons.map(function (r) {
        var extra = '';
        if (r.url && (r.url.foreign || r.url.summary.kind === 'fake')) {
          extra += '<span class="domain">' + domainHtml(r.url) + '</span>';
          if (r.url.foreign) extra += '<p class="domain-note">Počítač tu adresu ve skutečnosti čte jako <code>' + esc(r.url.ascii) + '</code></p>';
        }
        if (r.more && r.more.length) {
          extra += '<ul class="more">' + r.more.map(function (f) { return '<li>' + esc(f.title) + '</li>'; }).join('') + '</ul>';
        }
        return '<li class="reason ' + r.sev + '"><span class="num">' + (r.n < 10 ? '0' : '') + r.n + '</span><div><h3>' + esc(r.title) + '</h3><p>' + esc(r.detail) + '</p>' + extra + '</div></li>';
      }).join('') + '</ol>';
    } else {
      h += '<p class="none">Ve zprávě jsme nenašli žádné typické triky podvodníků.</p>';
    }
    h += '</section>';

    // Otázky ve stylu kalkulačky: odpovězené shrnuté, aktuální jedna
    var qs = A.questionsFor(a);
    var done = qs.filter(function (q) { return state.answers[q.id]; }).length;
    var current = qs.filter(function (q) { return !state.answers[q.id]; })[0];
    h += '<section class="block"><p class="mono-label">Upřesnění</p><h2>Pomozte nám to upřesnit</h2><div class="card quiz">' +
      '<div class="quiz-head"><span class="mono-label">' + (current ? 'Otázka ' + (done + 1) + ' z ' + qs.length : 'Hotovo') + '</span>' +
      '<div class="progress"><i style="width:' + Math.round((done / qs.length) * 100) + '%"></i></div></div>';
    if (done) {
      h += '<ul class="answered">' + qs.filter(function (q) { return state.answers[q.id]; }).map(function (q) {
        var opt = q.options.filter(function (o) { return o.v === state.answers[q.id]; })[0];
        return '<li><span class="q">' + esc(q.text) + '</span><span class="a">' + esc(opt.label) + '</span>' +
          '<button type="button" class="link" data-undo="' + q.id + '">změnit</button>' +
          (ev.notes[q.id] ? '<p class="note">' + esc(ev.notes[q.id]) + '</p>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    if (current) {
      h += '<div class="quiz-body"><p class="quiz-q">' + esc(current.text) + '</p><div class="opts">' + current.options.map(function (o) {
        return '<button type="button" class="opt" data-q="' + current.id + '" data-v="' + o.v + '">' + esc(o.label) + '</button>';
      }).join('') + '</div></div>';
    } else {
      h += '<p class="quiz-done">Díky. Výsledek nahoře už počítá s tím, co jste odpověděli.</p>';
    }
    h += '</div></section>';

    h += '<section class="block"><p class="mono-label">Doporučení</p><h2>Co dělat teď</h2><ol class="steps">' + NEXT[ev.level].map(function (t) { return '<li><span>' + esc(t) + '</span></li>'; }).join('') + '</ol></section>';
    h += '<p class="disclaimer">Hodnocení je orientační. Vychází ze známých triků podvodníků, úplně nový podvod nemusí poznat.</p>';

    var box = $('result');
    box.innerHTML = h;
    box.hidden = false;

    box.querySelector('[data-act="again"]').addEventListener('click', function () { resetCheck(); $('msg').focus(); window.scrollTo(0, 0); });
    var hb = box.querySelector('[data-act="help"]');
    if (hb) hb.addEventListener('click', function () { showView('help'); });
    var ry = box.querySelector('[data-act="report-yes"]');
    if (ry) ry.addEventListener('click', function () { openPolice(true); });
    var rn = box.querySelector('[data-act="report-no"]');
    if (rn) rn.addEventListener('click', function () { state.reportChoice = 'no'; rerender(); });
    var rp = box.querySelector('[data-act="report-page"]');
    if (rp) rp.addEventListener('click', function () { showView('report'); });
    Array.prototype.forEach.call(box.querySelectorAll('.opt'), function (b) {
      b.addEventListener('click', function () {
        state.answers[b.getAttribute('data-q')] = b.getAttribute('data-v');
        rerender();
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-undo]'), function (b) {
      b.addEventListener('click', function () {
        delete state.answers[b.getAttribute('data-undo')];
        rerender();
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
      s.onerror = function () { reject(new Error('load')); };
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
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  var busy = false;
  function runOcr(file) {
    if (!file || !/^image\//.test(file.type) || busy) return;
    busy = true;
    resetCheck();
    showView('check');
    $('ocr').hidden = false;
    $('ocr-note').hidden = true;
    $('ocr-bar').style.width = '5%';
    $('ocr-status').textContent = 'Čtu text z obrázku';
    var r = new FileReader();
    r.onload = function () { $('ocr-img').src = r.result; };
    r.readAsDataURL(file);

    loadScript(TESSERACT_SRC)
      .then(function () { return prepareImage(file); })
      .then(function (img) {
        return window.Tesseract.recognize(img, 'ces+eng', {
          logger: function (m) {
            if (m.status === 'recognizing text') $('ocr-bar').style.width = Math.max(10, Math.round(m.progress * 100)) + '%';
          }
        });
      })
      .then(function (res) {
        var text = (res && res.data && res.data.text || '').replace(/\n{3,}/g, '\n\n').trim();
        if (!text) throw new Error('empty');
        $('ocr').hidden = true;
        var cur = $('msg').value.trim();
        $('msg').value = cur ? cur + '\n\n' + text : text;
        $('ocr-note').textContent = 'Text jsme z obrázku přečetli. Zkontrolujte hlavně odkaz, čtení může splést podobné znaky.';
        $('ocr-note').hidden = false;
        runCheck();
      })
      .catch(function () {
        $('ocr').hidden = true;
        $('ocr-note').textContent = 'Z obrázku se text přečíst nepodařilo. Opište sem prosím aspoň odkaz a hlavní větu ze zprávy.';
        $('ocr-note').hidden = false;
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

  /* ---------- Už se to stalo ---------- */
  var SCENARIOS = [
    {
      title: 'Klikl(a) jsem na odkaz, ale nic nevyplnil(a)',
      steps: [
        ['Zavřete stránku.', 'Nic na ní nevyplňujte a nic nestahujte.'],
        ['Pokud se něco stáhlo, neotevírejte to.', 'Soubor smažte. Aplikace z cizích stránek nikdy neinstalujte.'],
        ['Pár dní hlídejte účty.', 'Všímejte si neobvyklých SMS, přihlášení nebo plateb.']
      ],
      tip: 'Samotné kliknutí většinou nic vážného nezpůsobí. Nejdůležitější je nic nevyplnit.'
    },
    {
      title: 'Zadal(a) jsem heslo',
      steps: [
        ['Hned heslo změňte.', 'Přihlaste se přes oficiální aplikaci nebo web, který napíšete ručně.'],
        ['Změňte ho i všude jinde, kde ho používáte.', 'Podvodníci ho zkusí i na e-mailu, Facebooku a dalších službách.'],
        ['Zapněte dvoufázové ověření.', 'Pak se do účtu nedostane nikdo jen s heslem.'],
        ['Odhlaste ostatní zařízení.', 'Najdete to v nastavení zabezpečení účtu.'],
        ['Šlo o bankovnictví? Volejte bance.', 'Ověří, jestli se s účtem něco nedělo.']
      ]
    },
    {
      title: 'Zadal(a) jsem údaje z karty',
      steps: [
        ['Kartu hned zablokujte.', 'V aplikaci banky, nebo na čísle ze zadní strany karty.'],
        ['Zavolejte bance.', 'Řekněte, co se stalo. Může zastavit čekající platby.'],
        ['Nic, co jste sami nezadali, neschvalujte.', 'Když vám přijde žádost o potvrzení platby, odmítněte ji.'],
        ['Projděte výpis.', 'Neznámé platby u banky co nejdřív reklamujte.'],
        ['Podejte oznámení na policii.', 'Podklady si připravíte níže.']
      ]
    },
    {
      title: 'Poslal(a) jsem peníze',
      steps: [
        ['Hned volejte bance.', 'Požádejte o zastavení nebo vrácení platby. Rozhodují minuty.'],
        ['Už nic neposílejte.', 'Podvodníci často chtějí další platbu, třeba na vrácení té první.'],
        ['Schovejte si důkazy.', 'Zprávy, screenshoty, čísla, odkazy a potvrzení plateb.'],
        ['Podejte oznámení na policii.', 'Na kterékoli služebně. Podklady si připravíte níže.']
      ],
      tip: 'Pozor na lidi, kteří vám později nabídnou vrácení peněz za poplatek. Jsou to další podvodníci.'
    },
    {
      title: 'Nainstaloval(a) jsem aplikaci nebo pustil(a) někoho do počítače',
      steps: [
        ['Odpojte se od internetu.', 'Vypněte Wi-Fi i mobilní data.'],
        ['Z jiného telefonu volejte bance.', 'Ať zablokuje bankovnictví i kartu.'],
        ['Aplikaci odinstalujte.', 'Hlavně AnyDesk, TeamViewer, RustDesk nebo cokoli, co neznáte.'],
        ['Z jiného zařízení si změňte hesla.', 'K bance, e-mailu a dalším důležitým účtům.'],
        ['Nechte zařízení zkontrolovat.', 'Antivirem nebo u odborníka.']
      ]
    },
    {
      title: 'Řekl(a) jsem někomu kód z SMS',
      steps: [
        ['Hned volejte bance nebo dané službě.', 'Kód mohl schválit platbu, přihlášení nebo kartu v cizím mobilu.'],
        ['U WhatsAppu se znovu přihlaste.', 'Tím útočníka vyhodíte. Pak si zapněte ověření pomocí PIN.'],
        ['Varujte známé.', 'Z vašeho účtu jim mohou přijít prosby o peníze.']
      ]
    }
  ];

  $('scenarios').innerHTML = SCENARIOS.map(function (s) {
    return '<details><summary>' + esc(s.title) + '</summary><div class="inner"><ol>' +
      s.steps.map(function (st) { return '<li><div><b>' + esc(st[0]) + '</b><span>' + esc(st[1]) + '</span></div></li>'; }).join('') +
      '</ol>' + (s.tip ? '<p class="tip">' + esc(s.tip) + '</p>' : '') + '</div></details>';
  }).join('');
  // Vždy otevřená jen jedna položka
  each('#scenarios details', function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) each('#scenarios details', function (o) { if (o !== d) o.open = false; });
    });
  });

  /* ---------- Oznámení pro policii (vyskakovací okno) ---------- */
  var dlg = $('police');
  var REGIONS = {
    krpa: 'Krajské ředitelství policie hl. m. Prahy', krps: 'Krajské ředitelství policie Středočeského kraje',
    krpc: 'Krajské ředitelství policie Jihočeského kraje', krpp: 'Krajské ředitelství policie Plzeňského kraje',
    krpk: 'Krajské ředitelství policie Karlovarského kraje', krpu: 'Krajské ředitelství policie Ústeckého kraje',
    krpl: 'Krajské ředitelství policie Libereckého kraje', krph: 'Krajské ředitelství policie Královéhradeckého kraje',
    krpe: 'Krajské ředitelství policie Pardubického kraje', krpj: 'Krajské ředitelství policie kraje Vysočina',
    krpb: 'Krajské ředitelství policie Jihomoravského kraje', krpm: 'Krajské ředitelství policie Olomouckého kraje',
    krpz: 'Krajské ředitelství policie Zlínského kraje', krpt: 'Krajské ředitelství policie Moravskoslezského kraje'
  };
  var CHANNEL_GUESS = [[/whats\s?app|messenger|telegram|signal/i, 'přes WhatsApp nebo jiný chat'], [/vinted|bazos|bazar|sbazar/i, 'přes inzerát nebo bazar'], [/@|e-?mail/i, 'e-mailem']];

  function val(id) { return $(id).value.trim(); }
  function kind() { var r = document.querySelector('input[name="r-kind"]:checked'); return r ? r.value : 'attempt'; }

  function syncKind() {
    var loss = kind() === 'loss';
    each('.loss-only', function (el) { el.hidden = !loss; });
  }
  each('input[name="r-kind"]', function (r) { r.addEventListener('change', syncKind); });

  function syncRegion() { $('r-addr').textContent = $('r-region').value + '.podatelna@policie.gov.cz'; }
  $('r-region').addEventListener('change', function () { syncRegion(); if (!$('report-out').hidden) buildReport(); });

  function prefillReport() {
    var a = state.analysis;
    if (!a) return;
    if (!$('r-msg').value) $('r-msg').value = a.text.trim();
    if (!$('r-link').value && a.urls.length) $('r-link').value = a.urls.map(function (u) { return u.raw + (u.foreign ? ' (skutečná adresa: ' + u.ascii + ')' : ''); }).join(', ');
    if (!$('r-when').value) $('r-when').value = new Date().toLocaleDateString('cs-CZ');
    CHANNEL_GUESS.some(function (g) {
      if (g[0].test(a.text)) { $('r-channel').value = g[1]; return true; }
      return false;
    });
  }

  function openPolice(fromResult) {
    if (fromResult) prefillReport();
    syncKind();
    syncRegion();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.querySelector('.modal-body').scrollTop = 0;
  }
  function closePolice() { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  each('[data-open-police]', function (b) { b.addEventListener('click', function () { openPolice(false); }); });
  dlg.querySelector('[data-close]').addEventListener('click', closePolice);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closePolice(); });

  function buildReport() {
    var loss = kind() === 'loss';
    var checked = Array.prototype.map.call(dlg.querySelectorAll('.checks input:checked'), function (c) { return c.value; });
    var region = $('r-region').value;
    var L = [];
    L.push('Policie České republiky');
    L.push(REGIONS[region]);
    L.push('');
    L.push('Věc: Oznámení o ' + (loss ? 'podvodu' : 'pokusu o podvod'));
    L.push('');
    L.push('Oznamovatel');
    if (val('r-name') || val('r-born') || val('r-address') || val('r-contact')) {
      L.push('Jméno a příjmení: ' + (val('r-name') || 'neuvedeno'));
      L.push('Datum narození: ' + (val('r-born') || 'neuvedeno'));
      L.push('Bydliště: ' + (val('r-address') || 'neuvedeno'));
      if (val('r-contact')) L.push('Kontakt: ' + val('r-contact'));
    } else {
      L.push('Oznámení podávám anonymně.');
    }
    L.push('');
    L.push('Co se stalo');
    var intro = (val('r-when') ? 'Dne ' + val('r-when') + ' ' : '') + 'mě kontaktoval neznámý člověk ' + $('r-channel').value +
      (val('r-from') ? ' z čísla nebo adresy ' + val('r-from') : '') + '.';
    L.push(intro.charAt(0).toUpperCase() + intro.slice(1));
    if (val('r-desc')) L.push(val('r-desc'));
    if (val('r-link')) L.push('Zpráva obsahovala odkaz: ' + val('r-link'));
    if (checked.length) { L.push(''); checked.forEach(function (c) { L.push('• ' + c); }); }
    L.push('');
    L.push('Škoda');
    if (loss) {
      L.push('Přišel(a) jsem o ' + (val('r-amount') || 'částku, kterou ještě upřesním') + '.');
      if (val('r-account')) L.push('Peníze odešly na účet: ' + val('r-account'));
      L.push($('r-claim').checked ? 'Žádám, aby mi pachatel způsobenou škodu nahradil.' : '');
    } else {
      L.push('Žádná škoda mi nevznikla, šlo o pokus. Oznamuji ho, aby se mohl prověřit a nenaletěl někdo další.');
    }
    L.push('');
    L.push('Důkazy');
    L.push('Mám k dispozici snímky obrazovky zpráv' + (loss ? ' a potvrzení o platbě' : '') + ' a na vyžádání je předložím.');
    if (val('r-msg')) { L.push(''); L.push('Text zprávy, jak mi přišla:'); L.push('„' + val('r-msg') + '“'); }
    L.push('');
    L.push('Děkuji za prošetření.');
    L.push('');
    L.push((val('r-name') || '') + (val('r-name') ? ', ' : '') + new Date().toLocaleDateString('cs-CZ'));

    var text = L.filter(function (line, i, arr) { return !(line === '' && arr[i - 1] === ''); }).join('\n');
    $('report-text').textContent = text;
    var addr = region + '.podatelna@policie.gov.cz';
    var subject = loss ? 'Oznámení o podvodu' : 'Oznámení o pokusu o podvod';
    $('r-mail').href = 'mailto:' + addr + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text.slice(0, 1800));
    return text;
  }

  $('report').addEventListener('submit', function (e) {
    e.preventDefault();
    buildReport();
    $('report-out').hidden = false;
    $('copy-msg').textContent = '';
    $('report-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  $('copy').addEventListener('click', function () { copyText($('report-text').textContent, $('report-text'), $('copy-msg'), 'Zkopírováno'); });
  $('copy-addr').addEventListener('click', function () { copyText($('r-addr').textContent, $('r-addr'), $('copy-msg'), 'Adresa zkopírována'); });
})();
