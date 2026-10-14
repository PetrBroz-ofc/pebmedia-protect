// assets/pebai.js
// PEBAi, AI asistent PEBMedia, v pravém dolním rohu Protectu.
// Stejný vzhled jako na pebmedia.cz (js/pebai.js). Teď je ve vývoji: tlačítko je
// „prasklé“, po otevření okno svítí červeně a přes chat je vrstva s kladívkem.
// Tato verze nic neodesílá a nic nenačítá ze sítě, takže platí slib Protectu,
// že zprávy zůstávají jen v prohlížeči.

(function () {
  'use strict';

  var LOGO = '<svg viewBox="0 0 400 400"><rect x="12" y="12" width="376" height="376" rx="88" fill="#0B6E63"></rect><rect x="130" y="88" width="49" height="224" rx="10" fill="#F6F6F3"></rect><rect x="130" y="88" width="140" height="42" rx="10" fill="#F6F6F3"></rect><rect x="228" y="88" width="42" height="126" rx="10" fill="#F6F6F3"></rect><rect x="130" y="172" width="140" height="42" rx="10" fill="#F6F6F3"></rect></svg>';
  var EMAIL = 'info.pebmedia@gmail.com';
  var UVITANI = 'Dobrý den, jsem PEBAi. Až mě dokončíme, pomůžu vám tady v Protectu s podezřelými zprávami, odkazy a telefonáty a poradím, co dělat, když už se něco stalo.';

  function vlozitOkno() {
    if (document.getElementById('helpWidget')) return;
    var obal = document.createElement('div');
    obal.innerHTML = '<div class="help-widget" id="helpWidget">' +
'  <div class="help-widget-panel" id="helpWidgetPanel" role="dialog" aria-labelledby="helpWidgetTitle">' +
'    <div class="help-widget-header">' +
'      <span class="pebai-avatar pebai-avatar-lg" aria-hidden="true">' + LOGO + '<i class="pebai-online"></i></span>' +
'      <div class="help-widget-header-text">' +
'        <div class="help-widget-header-title" id="helpWidgetTitle">PEBAi <span class="pebai-vyvoj">Ve vývoji</span></div>' +
'        <div class="help-widget-header-sub">AI pomocník Protectu · připravujeme</div>' +
'      </div>' +
'      <button type="button" class="help-widget-icon-btn" id="helpWidgetClose" aria-label="Zavřít PEBAi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg></button>' +
'    </div>' +
'    <div class="help-widget-body">' +
'      <div class="pebai-stavba" role="note" aria-labelledby="pebaiStavbaTitulek">' +
'        <span class="pebai-stavba-ikona"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"></path><path d="m18 15 4-4"></path><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"></path></svg></span>' +
'        <p class="pebai-stavba-titulek" id="pebaiStavbaTitulek">PEBAi je ve vývoji</p>' +
'        <p class="pebai-stavba-text">Na asistentovi ještě pracujeme. Podezřelou zprávu si zatím zkontrolujte přímo tady v Protectu. Když si nevíte rady, napište nám.</p>' +
'        <button type="button" class="btn btn-accent pebai-stavba-btn" id="pebaiStavbaKontrola">Zkontrolovat zprávu</button>' +
'        <a class="pebai-stavba-email" href="mailto:' + EMAIL + '">' + EMAIL + '</a>' +
'      </div>' +
'      <div class="help-widget-messages" id="helpWidgetMessages" inert=""></div>' +
'      <div class="help-widget-footer">' +
'        <p class="help-widget-ai-note">PEBAi zatím nic neodesílá. Kontrola zpráv v Protectu dál běží jen ve vašem prohlížeči.</p>' +
'      </div>' +
'    </div>' +
'  </div>' +
'  <button class="help-widget-toggle" id="helpWidgetToggle" type="button" aria-label="Otevřít PEBAi, AI asistenta PEBMedia" aria-expanded="false" aria-controls="helpWidgetPanel">' +
'    <svg class="icon-chat" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>' +
'    <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>' +
'    <span class="help-widget-toggle-label">Zeptejte se PEBAi</span>' +
'    <span class="pebai-prazdno" aria-hidden="true"><i class="pebai-vzduch"></i></span><span class="pebai-praskliny" aria-hidden="true">' +
'      <svg viewBox="0 0 200 56" preserveAspectRatio="none"><path class="pebai-prasklina" d="M47 0 L42 13 L49 22 L41 33 L46 43 L42 56"></path><path class="pebai-prasklina pebai-prasklina-vetev" d="M42 13 L34 16 L30 12"></path><path class="pebai-prasklina pebai-prasklina-vetev" d="M49 22 L55 25"></path><path class="pebai-prasklina pebai-prasklina-vetev" d="M41 33 L33 37"></path><path class="pebai-prasklina pebai-prasklina-vetev" d="M46 43 L52 47"></path><path class="pebai-prasklina pebai-prasklina-2" d="M188 0 L182 10 L190 19 L183 30 L189 41 L184 56"></path><path class="pebai-prasklina pebai-prasklina-vetev pebai-prasklina-2" d="M182 10 L174 7"></path><path class="pebai-prasklina pebai-prasklina-vetev pebai-prasklina-2" d="M190 19 L197 23"></path><path class="pebai-prasklina pebai-prasklina-vetev pebai-prasklina-2" d="M183 30 L175 35 L170 32"></path><path class="pebai-prasklina pebai-prasklina-vetev pebai-prasklina-2" d="M189 41 L196 47"></path><path class="pebai-prasklina pebai-prasklina-vlas" d="M28 28 L17 20 M28 28 L13 31 M28 28 L21 44 M28 28 L35 41 M28 28 L36 14 M20 23 L16 29 L19 38 L30 41 L35 34 L34 19 L22 18"></path><path class="pebai-prasklina pebai-prasklina-vlas" d="M55 25 L72 19 L90 24 L108 18 L126 23"></path><path class="pebai-prasklina pebai-prasklina-vlas" d="M52 47 L70 42 L86 46 L104 40"></path><path class="pebai-prasklina pebai-prasklina-vlas" d="M174 7 L160 12 L148 9 L136 14"></path><path class="pebai-prasklina pebai-prasklina-vlas" d="M170 32 L156 38 L142 35 L130 41 L118 56"></path><path class="pebai-prasklina pebai-prasklina-3" d="M128 0 L123 11 L131 21 L124 32 L130 44 L126 56"></path><path class="pebai-prasklina pebai-prasklina-vetev pebai-prasklina-3" d="M123 11 L115 14"></path><path class="pebai-prasklina pebai-prasklina-vetev pebai-prasklina-3" d="M131 21 L139 18 L145 22"></path><path class="pebai-prasklina pebai-prasklina-vetev pebai-prasklina-3" d="M124 32 L116 36"></path><path class="pebai-prasklina pebai-prasklina-vetev pebai-prasklina-3" d="M130 44 L138 49"></path><path class="pebai-prasklina pebai-prasklina-vlas pebai-prasklina-vlas-2" d="M139 18 L152 24 L164 20"></path><path class="pebai-prasklina pebai-prasklina-vlas pebai-prasklina-vlas-2" d="M116 36 L100 31 L86 34"></path><path class="pebai-prasklina pebai-prasklina-vlas pebai-prasklina-vlas-2" d="M60 8 L74 4 L84 10"></path><path class="pebai-prasklina pebai-prasklina-vlas pebai-prasklina-vlas-2" d="M150 50 L162 46 L170 52"></path><path class="pebai-prasklina pebai-prasklina-vlas pebai-prasklina-vlas-2" d="M138 49 L146 56"></path><path class="pebai-odstep pebai-odstep-2" d="M150 56 L156 49 L163 56 Z"></path><path class="pebai-odstep" d="M95 0 L100 7 L108 0 Z"></path></svg>' +
'      <i class="pebai-stek pebai-stek-1"></i><i class="pebai-stek pebai-stek-2"></i><i class="pebai-stek pebai-stek-3"></i><i class="pebai-kapka pebai-kapka-1"></i><i class="pebai-kapka pebai-kapka-2"></i><i class="pebai-kapka pebai-kapka-3"></i><i class="pebai-kapka pebai-kapka-4"></i><i class="pebai-kapka pebai-kapka-5"></i><i class="pebai-kapka pebai-kapka-6"></i><i class="pebai-stek pebai-stek-4"></i><i class="pebai-kapka pebai-kapka-7"></i><i class="pebai-kapka pebai-kapka-8"></i>' +
'    </span>' +
'  </button>' +
'</div>';
    document.body.appendChild(obal.firstElementChild);
  }

  function uvitani(messages) {
    var radek = document.createElement('div');
    radek.className = 'help-row help-row-bot';
    var avatar = document.createElement('span');
    avatar.className = 'pebai-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = LOGO;
    var zprava = document.createElement('div');
    zprava.className = 'help-msg help-msg-bot';
    zprava.textContent = UVITANI;
    radek.appendChild(avatar);
    radek.appendChild(zprava);
    messages.appendChild(radek);
  }

  function init() {
    vlozitOkno();
    var widget = document.getElementById('helpWidget');
    var toggle = document.getElementById('helpWidgetToggle');
    var closeBtn = document.getElementById('helpWidgetClose');
    var kontrola = document.getElementById('pebaiStavbaKontrola');
    uvitani(document.getElementById('helpWidgetMessages'));

    function otevrit(stav) {
      widget.classList.toggle('is-open', stav);
      toggle.setAttribute('aria-expanded', String(stav));
    }

    toggle.addEventListener('click', function () { otevrit(!widget.classList.contains('is-open')); });
    closeBtn.addEventListener('click', function () { otevrit(false); toggle.focus(); });

    // „Zkontrolovat zprávu“ zavře okno a přenese uživatele k poli pro vložení zprávy.
    var pole = document.getElementById('msg');
    if (pole) {
      kontrola.addEventListener('click', function () {
        otevrit(false);
        pole.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pole.focus({ preventScroll: true });
      });
    } else {
      kontrola.addEventListener('click', function () { window.location.href = './'; });
    }

    document.addEventListener('click', function (e) {
      if (!widget.contains(e.target) && e.target.isConnected && widget.classList.contains('is-open')) otevrit(false);
    });

    // Escape zavře okno a vrátí fokus na přepínač (WCAG 2.1.2)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && widget.classList.contains('is-open')) {
        otevrit(false);
        toggle.focus();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
