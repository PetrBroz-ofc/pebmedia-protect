/* PEBMedia Protect: rozhraní aplikace */
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

  /* ---------- Ukázkové zprávy ---------- */
  var EXAMPLES = {
    posta: 'Česká pošta: Vaše zásilka nemohla být doručena, adresa je neúplná. Uhraďte doplatek 1,50 Kč do 24 hodin, jinak bude vrácena odesílateli: https://сeskapоsta-cz.info/track',
    mami: 'Ahoj mami, rozbil se mi telefon, tohle je moje nové číslo. Ulož si ho. Napiš mi na WhatsApp, potřebuju rychle zaplatit fakturu, banku mám ve starém mobilu.',
    bank: 'Dobrý den, zde bezpečnostní oddělení vaší banky. Zaznamenali jsme podezřelou transakci na vašem účtu. Pro ochranu úspor je nutné převést prostředky na bezpečný účet. Nainstalujte si prosím aplikaci AnyDesk, pomůžeme vám.',
    vinted: 'Dobrý den, zboží jsem vám zaplatil přes Vinted, kurýr si věc vyzvedne. Pro přijetí platby klikněte zde a potvrďte kartu: vinted-cz.payment-secure.online/item/552'
  };

  /* ---------- Záložky ---------- */
  function showTab(name) {
    var check = name === 'check';
    $('tab-check').setAttribute('aria-selected', String(check));
    $('tab-help').setAttribute('aria-selected', String(!check));
    $('panel-check').hidden = !check;
    $('panel-help').hidden = check;
  }
  $('tab-check').addEventListener('click', function () { showTab('check'); });
  $('tab-help').addEventListener('click', function () { showTab('help'); });
  if (location.hash === '#pomoc') showTab('help');

  /* ---------- Kontrola ---------- */
  function runCheck() {
    var text = $('msg').value;
    if (!text.trim()) {
      $('msg').focus();
      return;
    }
    state.analysis = A.analyze(text);
    state.answers = {};
    renderResult(true);
  }

  $('go').addEventListener('click', runCheck);
  $('msg').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runCheck();
  });
  $('clear').addEventListener('click', function () {
    $('msg').value = '';
    $('result').hidden = true;
    $('result').innerHTML = '';
    $('ocr').hidden = true;
    state.analysis = null;
    $('msg').focus();
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-ex]'), function (b) {
    b.addEventListener('click', function () {
      $('msg').value = EXAMPLES[b.getAttribute('data-ex')];
      runCheck();
    });
  });

  var VERDICT = {
    high: {
      kicker: 'Vysoké riziko',
      title: 'Tahle zpráva má jasné znaky podvodu',
      say: 'Na odkaz neklikejte, nic neplaťte a nikam nezadávejte údaje. Zprávu můžete smazat.',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 7v6m0 4h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>'
    },
    mid: {
      kicker: 'Zvýšené riziko',
      title: 'Buďte opatrní, zpráva má podezřelé znaky',
      say: 'Ověřte si ji jinou cestou, než nabízí zpráva: otevřete aplikaci nebo web sami, nebo zavolejte na číslo, které znáte.',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 8v5m0 3.5h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>'
    },
    low: {
      kicker: 'Nízké riziko',
      title: 'Nenašli jsme výrazné varovné znaky',
      say: 'To ale neznamená, že je zpráva určitě v pořádku. Pokud po vás někdo chce peníze, heslo, kód nebo údaje z karty, zpozorněte.',
      icon: '<svg viewBox="0 0 24 24"><path d="m7 12.5 3.2 3.2L17 9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
    }
  };

  var TODO = {
    high: [
      'Na odkaz neklikejte a na zprávu neodpovídejte.',
      'Pokud vám někdo volá, zavěste. Skutečná banka ani policie vás nikdy nepožádají o převod peněz nebo instalaci aplikace.',
      'Chcete-li si něco ověřit, otevřete aplikaci nebo web firmy sami, ne přes zprávu.',
      'Číslo nebo odesílatele zablokujte a zprávu smažte. Varujte blízké, ať jim nepřijde také.'
    ],
    mid: [
      'Zatím na nic neklikejte a nic neplaťte.',
      'Ověřte si zprávu u odesílatele jinou cestou: v jeho aplikaci, na webu, který napíšete ručně, nebo telefonem na známé číslo.',
      'Pokud si nejste jistí, poraďte se s někým blízkým. Podvodníci spoléhají na to, že jednáte sami a rychle.'
    ],
    low: [
      'Pokud zpráva po čase přece jen začne chtít peníze nebo údaje, zkontrolujte ji znovu.',
      'Přihlašujte se vždy přes oficiální aplikaci nebo web, který napíšete sami.'
    ]
  };

  function renderUrl(u) {
    var host = u.host;
    var regLen = u.registrableRaw.length;
    var subLen = Math.max(0, host.length - regLen);
    var hostHtml = '';
    u.chars.forEach(function (c, i) {
      var ch = esc(c.ch);
      var cls = i < subLen ? 'sub' : 'reg';
      if (c.kind !== 'plain') {
        ch = '<mark class="glyph-foreign" title="Písmeno z ' + (c.kind === 'cyrillic' ? 'cyrilice' : 'řečtiny') + '">' + ch + '</mark>';
      }
      hostHtml += '<span class="' + cls + '">' + ch + '</span>';
    });
    var scheme = /^https?:\/\//i.test(u.raw) ? u.raw.match(/^https?:\/\//i)[0] : '';
    var path = u.path ? '<span class="path">' + esc(u.path.length > 60 ? u.path.slice(0, 60) + '…' : u.path) + '</span>' : '';

    var owner;
    if (u.official) owner = 'Oficiální web: ' + esc(u.brand);
    else if (u.brand) owner = 'Neznámý web, vydává se za: ' + esc(u.brand);
    else owner = 'Neznámý web';

    var foreign = u.chars.some(function (c) { return c.kind !== 'plain'; });
    var html = '<div class="card url-card"><h3 class="section-title">Rozbor odkazu</h3>' +
      '<div class="url-line"><span class="scheme">' + esc(scheme) + '</span>' + hostHtml + path + '</div>' +
      '<dl class="url-meta">' +
      '<dt>Skutečná doména</dt><dd><code>' + esc(u.registrable) + '</code></dd>' +
      (foreign ? '<dt>Jak ji vidí počítač</dt><dd><code>' + esc(u.ascii) + '</code></dd>' : '') +
      '<dt>Komu patří</dt><dd>' + owner + '</dd>' +
      '</dl>';
    if (u.findings.length) html += findingsList(u.findings);
    return html + '</div>';
  }

  function findingsList(list) {
    var order = { high: 0, mid: 1, low: 2, ok: 3 };
    return '<ul class="findings">' + list.slice().sort(function (a, b) { return order[a.sev] - order[b.sev]; }).map(function (f) {
      return '<li class="finding ' + f.sev + '"><span class="dot" aria-hidden="true"></span><div><b>' + esc(f.title) + '</b><p>' + esc(f.detail) + '</p></div></li>';
    }).join('') + '</ul>';
  }

  function renderResult(scroll) {
    var a = state.analysis;
    if (!a) return;
    var ev = A.evaluate(a, state.answers);
    var v = VERDICT[ev.level];
    var on = { low: 1, mid: 2, high: 3 }[ev.level];

    var html = '';
    html += '<div class="verdict ' + ev.level + '"><div class="verdict-top"><div class="verdict-icon" aria-hidden="true">' + v.icon + '</div>' +
      '<div><p class="verdict-kicker">' + v.kicker + '</p><h2>' + v.title + '</h2></div></div>' +
      '<p class="say">' + v.say + '</p>' +
      '<div class="meter" aria-hidden="true">' + [1, 2, 3].map(function (i) { return '<span class="' + (i <= on ? 'on' : '') + '"></span>'; }).join('') + '</div>' +
      '<div class="meter-labels" aria-hidden="true"><span>Nízké</span><span>Zvýšené</span><span>Vysoké</span></div></div>';

    if (ev.needHelp) {
      html += '<div class="help-callout"><p>Už jste klikli nebo něco zadali? Řekneme vám přesně, co teď udělat.</p>' +
        '<button type="button" class="btn btn-primary" data-go-help>Co dělat teď</button></div>';
    }

    a.urls.forEach(function (u) { html += renderUrl(u); });

    html += '<div class="card"><h3 class="section-title">Co jsme ve zprávě našli</h3>';
    if (a.textFindings.length) html += findingsList(a.textFindings);
    else html += '<p class="empty-note">V samotném textu jsme nenašli typické fráze podvodníků.</p>';
    html += '</div>';

    var qs = A.questionsFor(a);
    if (qs.length) {
      html += '<div class="card"><h3 class="section-title">Upřesněte vyhodnocení</h3><div class="questions">';
      qs.forEach(function (q) {
        html += '<div class="q"><p id="q-' + q.id + '">' + esc(q.text) + '</p><div class="q-opts" role="group" aria-labelledby="q-' + q.id + '">' +
          q.options.map(function (o) {
            return '<button type="button" class="q-opt" data-q="' + q.id + '" data-v="' + o.v + '" aria-pressed="' + (state.answers[q.id] === o.v) + '">' + esc(o.label) + '</button>';
          }).join('') + '</div></div>';
      });
      html += '</div>';
      if (ev.notes.length) {
        html += '<div class="answer-notes">' + ev.notes.map(function (n) { return '<p>' + esc(n) + '</p>'; }).join('') + '</div>';
      }
      html += '</div>';
    }

    html += '<div class="card"><h3 class="section-title">Co doporučujeme</h3><ol class="todo">' +
      TODO[ev.level].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol></div>';

    html += '<p class="disclaimer">Vyhodnocení je orientační a vychází z pravidel a známých triků podvodníků. Nový nebo neobvyklý podvod nemusí zachytit. Rozhodnutí je vždy na vás.</p>';

    var box = $('result');
    box.innerHTML = html;
    box.hidden = false;

    Array.prototype.forEach.call(box.querySelectorAll('.q-opt'), function (b) {
      b.addEventListener('click', function () {
        var q = b.getAttribute('data-q');
        var val = b.getAttribute('data-v');
        state.answers[q] = state.answers[q] === val ? undefined : val;
        var y = window.scrollY;
        renderResult(false);
        window.scrollTo(0, y);
      });
    });
    var hb = box.querySelector('[data-go-help]');
    if (hb) hb.addEventListener('click', function () {
      prefillReport();
      showTab('help');
      $('panel-help').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Čtení screenshotu (OCR) ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.Tesseract) return resolve();
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Nepodařilo se načíst čtečku textu.')); };
      document.head.appendChild(s);
    });
  }

  // Úprava obrázku pro lepší čtení: zvětšení malých snímků, odstíny šedi, převrácení tmavého režimu.
  function prepareImage(file) {
    return new Promise(function (resolve) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var scale = img.width < 1000 ? 2 : 1;
          var c = document.createElement('canvas');
          c.width = img.width * scale;
          c.height = img.height * scale;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, c.width, c.height);
          var d = ctx.getImageData(0, 0, c.width, c.height);
          var px = d.data, sum = 0, i;
          for (i = 0; i < px.length; i += 4) {
            var g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            px[i] = px[i + 1] = px[i + 2] = g;
            sum += g;
          }
          if (sum / (px.length / 4) < 110) {
            for (i = 0; i < px.length; i += 4) { px[i] = px[i + 1] = px[i + 2] = 255 - px[i]; }
          }
          ctx.putImageData(d, 0, 0);
          resolve(c);
        } catch (e) {
          resolve(file);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  var ocrBusy = false;
  function runOcr(file) {
    if (!file || !/^image\//.test(file.type) || ocrBusy) return;
    ocrBusy = true;
    $('ocr').hidden = false;
    $('ocr-note').hidden = true;
    $('ocr-bar').style.width = '4%';
    $('ocr-status').textContent = 'Připravuji čtení textu';
    var reader = new FileReader();
    reader.onload = function () { $('ocr-img').src = reader.result; };
    reader.readAsDataURL(file);

    loadScript(TESSERACT_SRC)
      .then(function () { return prepareImage(file); })
      .then(function (img) {
        $('ocr-status').textContent = 'Čtu text z obrázku';
        return window.Tesseract.recognize(img, 'ces+eng', {
          logger: function (m) {
            if (m.status === 'recognizing text') $('ocr-bar').style.width = Math.max(8, Math.round(m.progress * 100)) + '%';
            else if (/load/.test(m.status)) $('ocr-status').textContent = 'Načítám češtinu pro čtení textu';
          }
        });
      })
      .then(function (r) {
        var text = (r && r.data && r.data.text || '').replace(/\n{3,}/g, '\n\n').trim();
        $('ocr-bar').style.width = '100%';
        if (!text) throw new Error('empty');
        var cur = $('msg').value.trim();
        $('msg').value = cur ? cur + '\n\n' + text : text;
        $('ocr-status').textContent = 'Text jsme přečetli';
        $('ocr-note').textContent = 'Zkontrolujte prosím hlavně odkaz. Čtení z obrázku může splést podobné znaky, například l a 1.';
        $('ocr-note').hidden = false;
        runCheck();
      })
      .catch(function () {
        $('ocr-status').textContent = 'Text z obrázku se nepodařilo přečíst';
        $('ocr-note').textContent = 'Opište prosím do pole výše hlavní část zprávy, hlavně odkaz. Kontrola pak funguje stejně.';
        $('ocr-note').hidden = false;
        $('ocr-bar').style.width = '0';
      })
      .then(function () { ocrBusy = false; });
  }

  $('pick').addEventListener('click', function () { $('file').click(); });
  $('file').addEventListener('change', function () {
    if (this.files && this.files[0]) runOcr(this.files[0]);
    this.value = '';
  });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
  });
  drop.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) runOcr(f);
  });
  document.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        e.preventDefault();
        showTab('check');
        runOcr(items[i].getAsFile());
        return;
      }
    }
  });

  /* ---------- Pomoc obětem ---------- */
  var SCENARIOS = [
    {
      id: 'click', title: 'Klikl(a) jsem na odkaz', sub: 'ale nic jsem nezadal(a)',
      steps: [
        ['Zavřete stránku', 'Nic dalšího na ní nevyplňujte a nic nestahujte.'],
        ['Pokud se něco stáhlo, neotevírejte to', 'Soubor smažte. Na Androidu nikdy neinstalujte aplikaci, kterou vám nabídne cizí stránka.'],
        ['Sledujte účty a zprávy', 'Pár dní si všímejte neobvyklých SMS, přihlášení nebo plateb.'],
        ['Zprávu smažte a odesílatele zablokujte', 'Ve většině případů se samotným kliknutím nic vážného nestane.']
      ],
      tip: 'Pokud se po kliknutí stáhla a nainstalovala aplikace, pokračujte podle bodu Nainstaloval(a) jsem aplikaci.'
    },
    {
      id: 'password', title: 'Zadal(a) jsem heslo', sub: 'do e-mailu, banky nebo sociální sítě',
      steps: [
        ['Hned změňte heslo', 'Přihlaste se přes oficiální aplikaci nebo web, který napíšete ručně, a heslo změňte.'],
        ['Změňte ho všude, kde jste ho použili', 'Podvodníci zkouší stejné heslo i na dalších službách.'],
        ['Zapněte dvoufázové ověření', 'Účet pak nepůjde otevřít jen s heslem.'],
        ['Odhlaste všechna ostatní zařízení', 'Většina služeb to umí v nastavení zabezpečení.'],
        ['U e-mailu zkontrolujte přeposílání', 'Útočníci si často nastaví tiché přeposílání vaší pošty.'],
        ['Pokud šlo o bankovnictví, volejte bance', 'Banka může účet ochránit a zkontrolovat pohyby.']
      ]
    },
    {
      id: 'card', title: 'Zadal(a) jsem údaje z karty', sub: 'číslo karty, platnost nebo CVV',
      steps: [
        ['Okamžitě kartu zablokujte', 'V bankovní aplikaci, nebo telefonem na čísle ze zadní strany karty.'],
        ['Zavolejte bance', 'Řekněte, co se stalo. Banka může zastavit čekající platby.'],
        ['Neschvalujte nic, co jste nezadali', 'Pokud vám přijde žádost o potvrzení platby, kterou jste nedělali, odmítněte ji.'],
        ['Projděte výpis', 'Neznámé platby u banky reklamujte co nejdříve.'],
        ['Podejte oznámení na policii', 'Podklady si připravte níže.']
      ]
    },
    {
      id: 'money', title: 'Poslal(a) jsem peníze', sub: 'převodem, kartou nebo v hotovosti',
      steps: [
        ['Hned volejte své bance', 'Požádejte o zastavení nebo vrácení platby. Čím dřív, tím větší šance.'],
        ['Nic dalšího neposílejte', 'Podvodníci často chtějí další platbu, třeba na vrácení předchozí.'],
        ['Uložte si důkazy', 'Zprávy, snímky obrazovky, čísla, odkazy a potvrzení plateb.'],
        ['Podejte oznámení na policii', 'Na kterékoli služebně. Podklady si připravte níže.'],
        ['Pozor na falešné vymahače', 'Kdo slibuje vrácení peněz za poplatek, je další podvodník.']
      ]
    },
    {
      id: 'app', title: 'Nainstaloval(a) jsem aplikaci', sub: 'nebo jsem někomu dal(a) přístup k počítači',
      steps: [
        ['Odpojte zařízení od internetu', 'Vypněte Wi-Fi i mobilní data, aby útočník ztratil přístup.'],
        ['Volejte bance z jiného telefonu', 'Ať zablokuje přístup do bankovnictví a karty.'],
        ['Odinstalujte aplikaci', 'Hlavně AnyDesk, TeamViewer, RustDesk a podobné aplikace, nebo cokoli neznámého.'],
        ['Z jiného zařízení změňte hesla', 'K bankovnictví, e-mailu a dalším důležitým účtům.'],
        ['Nechte zařízení zkontrolovat', 'Antivirem nebo u odborníka. V horším případě pomůže obnovení továrního nastavení.']
      ]
    },
    {
      id: 'code', title: 'Sdělil(a) jsem kód z SMS', sub: 'nebo potvrdil(a) něco v aplikaci',
      steps: [
        ['Hned kontaktujte banku nebo službu', 'Kód mohl schválit přihlášení, platbu nebo přidání karty do cizího telefonu.'],
        ['U WhatsAppu se znovu přihlaste', 'Tím útočníka odhlásíte. Pak zapněte dvoufázové ověření s PIN.'],
        ['Varujte své kontakty', 'Z vašeho účtu mohou chodit prosby o peníze.'],
        ['Podejte oznámení na policii', 'Zvlášť pokud odešly peníze.']
      ]
    }
  ];

  function renderScenarios() {
    $('scenarios').innerHTML = SCENARIOS.map(function (s) {
      return '<button type="button" class="scenario" data-sc="' + s.id + '" aria-pressed="false"><b>' + esc(s.title) + '</b><span>' + esc(s.sub) + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.scenario'), function (b) {
      b.addEventListener('click', function () { openScenario(b.getAttribute('data-sc')); });
    });
  }

  function openScenario(id) {
    var s = SCENARIOS.filter(function (x) { return x.id === id; })[0];
    Array.prototype.forEach.call(document.querySelectorAll('.scenario'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-sc') === id));
    });
    var box = $('steps');
    box.innerHTML = '<h3>' + esc(s.title) + ': co udělat teď</h3><ol>' +
      s.steps.map(function (st) { return '<li><b>' + esc(st[0]) + '</b>' + esc(st[1]) + '</li>'; }).join('') + '</ol>' +
      (s.tip ? '<p class="tip">' + esc(s.tip) + '</p>' : '') +
      '<p class="tip">Uložte si důkazy dřív, než cokoli smažete: snímky obrazovky, číslo odesílatele, odkaz a potvrzení plateb.</p>';
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- Podklady pro policii ---------- */
  function prefillReport() {
    var a = state.analysis;
    if (!a) return;
    if (!$('r-msg').value) $('r-msg').value = a.text.trim();
    if (!$('r-link').value && a.urls.length) $('r-link').value = a.urls.map(function (u) { return u.raw; }).join(', ');
  }

  $('report').addEventListener('submit', function (e) {
    e.preventDefault();
    var val = function (id) { return $(id).value.trim(); };
    var checked = Array.prototype.map.call(document.querySelectorAll('.checks input:checked'), function (c) { return c.value; });
    var now = new Date();
    var lines = [
      'PODKLADY K OZNÁMENÍ PODVODU',
      'Připraveno ' + now.toLocaleDateString('cs-CZ') + ' pomocí PEBMedia Protect',
      '',
      'Kdy se to stalo: ' + (val('r-when') || 'neuvedeno'),
      'Způsob kontaktu: ' + $('r-channel').value,
      'Odesílatel (číslo nebo adresa): ' + (val('r-from') || 'neuvedeno'),
      'Odkaz ze zprávy: ' + (val('r-link') || 'neuvedeno'),
      ''
    ];
    lines.push('Co se stalo:');
    if (checked.length) checked.forEach(function (c) { lines.push('  • ' + c); });
    else lines.push('  • neuvedeno');
    lines.push('');
    if (val('r-amount') || val('r-account')) {
      lines.push('Způsobená škoda: ' + (val('r-amount') || 'neuvedeno'));
      lines.push('Účet příjemce: ' + (val('r-account') || 'neuvedeno'));
      lines.push('');
    }
    if (val('r-desc')) { lines.push('Popis události:'); lines.push(val('r-desc')); lines.push(''); }
    if (val('r-msg')) { lines.push('Text podvodné zprávy:'); lines.push(val('r-msg')); lines.push(''); }
    lines.push('Mám k dispozici: snímky obrazovky zpráv, číslo odesílatele' + (val('r-amount') ? ', potvrzení o platbě' : '') + '.');
    $('report-text').textContent = lines.join('\n');
    $('report-out').hidden = false;
    $('copy-msg').textContent = '';
    $('report-out').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('copy').addEventListener('click', function () {
    var text = $('report-text').textContent;
    var done = function () { $('copy-msg').textContent = 'Zkopírováno'; };
    var fallback = function () {
      var r = document.createRange();
      r.selectNodeContents($('report-text'));
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      $('copy-msg').textContent = 'Text je označený, zkopírujte ho pomocí Ctrl+C';
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    } catch (err) { fallback(); }
  });

  renderScenarios();
})();
