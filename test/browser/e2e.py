#!/usr/bin/env python3
"""Testy v prohlížeči (Playwright + Chromium). Bez internetu: vše se načítá z lokálního serveru.

Spuštění:  python3 test/browser/make_fixtures.py   (jednou)
           python3 test/browser/e2e.py
Ověřuje: síťové požadavky a únik obsahu, CSP při OCR, OCR na 10 obrázcích, nepodporovaný soubor,
tlačítko Zpět, fokus, reset vstupu, formulář pro policii, XSS a šířky 320 a 360 px.
"""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, 'fixtures')
PORT = 8799
BASE = 'http://127.0.0.1:%d/index.html' % PORT
SECRET = 'TAJNY-OBSAH-ZPRAVY-12345'
results = []


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('OK    ' if ok else 'CHYBA ') + name + ('  | ' + str(detail) if detail else ''))


def wait_result(pg, timeout=120):
    t = time.time()
    while time.time() - t < timeout:
        if pg.is_visible('#crop'):
            pg.click('#crop-all')
        if pg.is_visible('#verdict'):
            return 'verdict'
        if pg.is_visible('#ocr-note') and 'is-error' in (pg.get_attribute('#ocr-note', 'class') or ''):
            return 'error'
        pg.wait_for_timeout(200)
    return 'timeout'


def main():
    srv = subprocess.Popen([sys.executable, os.path.join(HERE, 'serve.py'), str(PORT)])
    time.sleep(1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            ctx = b.new_context(viewport={'width': 400, 'height': 860})
            ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin='http://127.0.0.1:%d' % PORT)
            pg = ctx.new_page()
            reqs, csp, errors = [], [], []
            pg.on('request', lambda r: reqs.append((r.url, r.method, (r.post_data_buffer or b''))))
            pg.on('console', lambda m: (csp.append(m.text) if 'Content Security Policy' in m.text or 'Refused' in m.text else None))
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('worker', lambda w: w.on('console', lambda m: csp.append('worker: ' + m.text) if 'Refused' in m.text else None))
            pg.add_init_script("document.addEventListener('securitypolicyviolation', e => console.log('Refused CSP: ' + e.violatedDirective + ' ' + e.blockedURI));")

            pg.goto(BASE); pg.wait_for_load_state('networkidle')
            # --- běžná kontrola textu ---
            pg.fill('#msg', 'Česká pošta: ' + SECRET + ' doplatek 30 Kč https://ceskaposta-platba.top/x'); pg.click('#go')
            pg.wait_for_selector('#verdict')
            check('fokus po kontrole je na nadpisu výsledku', pg.evaluate("document.activeElement && document.activeElement.id") == 'verdict-title')
            check('aria-live není na celém výsledku', pg.get_attribute('#result', 'aria-live') is None)
            # --- zpět ---
            pg.go_back(); pg.wait_for_timeout(300)
            check('tlačítko Zpět vrátí z výsledku na zadání', pg.is_visible('#ask') and not pg.is_visible('#result'))
            pg.go_forward(); pg.wait_for_timeout(300)
            check('tlačítko Vpřed vrátí výsledek i s obsahem', pg.is_visible('#verdict') and 'ceskaposta-platba' in pg.inner_text('.specimen'))
            pg.click('#nav-help'); pg.wait_for_timeout(200); pg.go_back(); pg.wait_for_timeout(300)
            check('Zpět ze sekce Už se to stalo', pg.is_visible('#view-check'))
            # --- reset vstupu ---
            check('po Zpět ze sekce se vrátí výsledek', pg.is_visible('[data-act="again"]'))
            pg.click('[data-act="again"]')
            check('nová kontrola vyčistí pole se zprávou', pg.is_visible('#msg') and pg.input_value('#msg') == '')

            # --- OCR na obrázcích ---
            expect = {
                'light.png': ('verdict', 'notlow'), 'dark.png': ('verdict', 'notlow'), 'small.png': ('verdict', 'notlow'),
                'english.png': ('verdict', 'notlow'), 'long.png': ('verdict', 'notlow'), 'wrapped.png': ('verdict', 'notlow'),
                'lowq.jpg': ('any', 'notlow'), 'noise.png': ('error', None), 'blank.png': ('error', None), 'broken.png': ('error', None),
            }
            for img, (kind, lvl) in expect.items():
                if pg.is_visible('[data-act="again"]'):
                    pg.click('[data-act="again"]')
                if pg.is_visible('#crop'):
                    pg.click('#crop-cancel')
                pg.fill('#msg', 'STARY TEXT ' + SECRET)
                pg.set_input_files('#file', os.path.join(FIX, img))
                res = wait_result(pg)
                detail = res
                ok = res != 'timeout' and (kind == 'any' or res == kind)
                if res == 'verdict':
                    pill = pg.inner_text('#verdict .risk')
                    spec = pg.inner_text('.specimen')
                    banner = pg.is_visible('.ocr-banner')
                    detail = pill + ' | banner=' + str(banner) + ' | ' + spec.replace('\n', ' ')[:90]
                    ok = ok and banner and 'STARY TEXT' not in spec and (lvl != 'notlow' or 'Nízké' not in pill)
                    if img == 'wrapped.png':
                        doms = [e.inner_text() for e in pg.query_selector_all('.domain')]
                        ok = ok and any('zasilkovna-platba.top' in d.replace('\n', '') for d in doms)
                        detail += ' | domény=' + str(doms)
                check('OCR ' + img, ok, detail)
            # nepodporovaný soubor
            if pg.is_visible('[data-act="again"]'):
                pg.click('[data-act="again"]')
            # --- výřez fotky, druhé čtení, sdílení a zpětná vazba ---
            if pg.is_visible('[data-act="again"]'):
                pg.click('[data-act="again"]')
            pg.set_input_files('#file', os.path.join(FIX, 'light.png'))
            pg.wait_for_selector('#crop:not([hidden])')
            check('po nahrání fotky se ukáže výběr výřezu', pg.is_visible('#crop-box') and not pg.is_visible('#msg'))
            box = pg.query_selector('#crop-stage').bounding_box()
            # rámeček jen přes spodní část s bublinou (bez čísla odesílatele nahoře)
            pg.mouse.move(box['x'] + 4, box['y'] + box['height'] * 0.22); pg.mouse.down()
            pg.mouse.move(box['x'] + box['width'] - 4, box['y'] + box['height'] - 4, steps=6); pg.mouse.up()
            r = pg.evaluate("[parseFloat(document.getElementById('crop-box').style.top), parseFloat(document.getElementById('crop-box').style.height)]")
            check('rámeček jde nakreslit tažením', r[0] > 15 and r[1] < 85, r)
            pg.click('#crop-go')
            res = wait_result(pg)
            spec = pg.inner_text('.specimen') if res == 'verdict' else ''
            check('výřez se přečte a vyhodnotí', res == 'verdict' and 'ceskaposta' in spec.replace(' ', '') and '731 555' not in spec, spec[:120])
            check('u výsledku z fotky je vidět i přečtený výřez', pg.is_visible('.ocr-thumb'))
            href = pg.get_attribute('#fb-mail', 'href')
            check('zpětná vazba bez souhlasu neobsahuje text zprávy', href.startswith('mailto:info.pebmedia@gmail.com') and 'doru%C4%8Dena' not in href, href[:120])
            pg.check('#fb-incl')
            check('se souhlasem e-mail obsahuje text zprávy', 'doru%C4%8Dena' in pg.get_attribute('#fb-mail', 'href'))
            pg.click('[data-act="share"]'); pg.wait_for_timeout(300)
            clip = pg.evaluate('navigator.clipboard.readText()')
            check('sdílení zkopíruje verdikt bez textu zprávy', 'protect.pebmedia.cz' in clip and 'podvod' in clip and 'doručena' not in clip and 'ceskaposta-doruceni' not in clip, clip[:160])
            if pg.is_visible('[data-act="again"]'):
                pg.click('[data-act="again"]')
            pg.set_input_files('#file', os.path.join(FIX, 'document.pdf'))
            pg.wait_for_timeout(300)
            check('PDF: srozumitelné upozornění', pg.is_visible('#ocr-note') and 'neumíme přečíst' in pg.inner_text('#ocr-note'))

            # --- síť a CSP ---
            hosts = sorted(set(u.split('/')[2] for u, m, d in reqs if u.startswith('http')))
            leaks = [u for u, m, d in reqs if SECRET.encode() in d or SECRET in u]
            posts = [u for u, m, d in reqs if m != 'GET']
            check('všechny požadavky jdou jen na vlastní doménu', hosts == ['127.0.0.1:%d' % PORT], hosts)
            check('obsah zprávy není v žádném požadavku', not leaks, leaks)
            check('žádné POST ani jiné odesílání dat', not posts, posts)
            check('CSP nic neblokuje při běhu OCR a aplikace', not csp, csp[:5])
            check('bez chyb JavaScriptu', not errors, errors[:3])

            # --- formulář pro policii ---
            pg.click('[data-act="again"]') if pg.is_visible('[data-act="again"]') else None
            pg.fill('#msg', 'Ahoj mami, mám nové číslo, pošli mi 5000 Kč na účet 123456/0800')
            pg.click('#go'); pg.wait_for_selector('#verdict')
            while pg.query_selector('#result .opt'):
                opts = pg.query_selector_all('#result .opt')
                pick = [o for o in opts if o.inner_text().strip() == 'Ano'] or [opts[0]]
                pick[0].click(); pg.wait_for_timeout(80)
            pg.click('[data-act="report-yes"]'); pg.wait_for_timeout(300)
            check('okno pro policii se otevře', pg.is_visible('#police'))
            check('datum události není předvyplněné', pg.input_value('#r-when') == '')
            check('kraj nemá výchozí hodnotu', pg.input_value('#r-region') == '')
            check('po odpovědi „už jsem klikl“ není předvybraný „jen pokus“', not pg.is_checked('input[name="r-kind"][value="attempt"]'))
            pg.click('#report button[type=submit]'); pg.wait_for_timeout(200)
            check('bez kraje a rozsahu se text nesestaví', not pg.is_visible('#report-out') and pg.is_visible('#r-region-err'))
            pg.check('input[name="r-kind"][value="loss"]')
            pg.select_option('#r-region', 'krpa'); pg.fill('#r-desc', '<img src=x onerror="window.__x=1">')
            pg.fill('#r-name', '<b>Jana</b>')
            pg.click('#report button[type=submit]'); pg.wait_for_timeout(300)
            txt = pg.inner_text('#report-text')
            check('text oznámení vznikl a má adresáta', 'Krajské ředitelství policie hl. m. Prahy' in txt)
            check('upozornění „Zatím nic nebylo odesláno“', pg.is_visible('.not-sent'))
            check('bez potvrzení se netvrdí, že má důkazy', 'snímky obrazovky' not in txt)
            check('XSS ve formuláři se nespustí', pg.evaluate('window.__x') is None and pg.query_selector('#report-text img') is None)
            check('adresa podatelny podle kraje', pg.inner_text('#r-addr') == 'krpa.podatelna@policie.gov.cz')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            check('Esc zavře okno', not pg.is_visible('#police'))

            # --- XSS ve zprávě ---
            payloads = ['<img src=x onerror="window.__y=1">', '"><svg onload="window.__y=2">', 'https://evil.top/"><img src=x onerror="window.__y=3">',
                        'https://<img src=x onerror=window.__y=4>.com', 'Ahoj mami <script>window.__y=6</script> nové číslo', 'https://ceskaposta.cz@"><b>x</b>.top/a']
            bad = []
            for s in payloads:
                if pg.is_visible('[data-act="again"]'):
                    pg.click('[data-act="again"]')
                pg.fill('#msg', s); pg.click('#go'); pg.wait_for_selector('#verdict')
                if pg.evaluate('window.__y') is not None or pg.evaluate("document.querySelectorAll('#result script, .specimen img, .specimen svg, .specimen b').length"):
                    bad.append(s)
            check('XSS ve zprávě se nespustí (6 vstupů)', not bad, bad)


            # --- nové režimy: odkaz, e-mail, telefonát, nouzový plán, trénink ---
            pg.goto(BASE); pg.wait_for_timeout(200)
            pg.click('#tab-url')
            check('záložka Odkaz ukáže formulář', pg.is_visible('#url-in') and not pg.is_visible('#msg'))
            pg.fill('#url-in', 'ahoj tohle neni odkaz'); pg.click('#url-form button[type=submit]'); pg.wait_for_timeout(150)
            check('text bez adresy ukáže chybu', pg.is_visible('#url-err') and not pg.is_visible('#verdict'))
            pg.fill('#url-in', 'https://login.csob.cz.overeni-klienta.com/prihlaseni'); pg.click('#url-form button[type=submit]'); pg.wait_for_selector('#verdict')
            bd = pg.inner_text('.breakdown')
            check('rozbor ukáže skutečnou doménu a subdoménu', 'overeni-klienta.com' in bd and 'login.csob.cz' in bd, bd[:120])
            check('rozbor vysvětlí, že HTTPS nezaručuje důvěryhodnost', 'Zámek mají i podvodné stránky' in bd)
            check('odkaz s bankou v subdoméně je vysoké riziko', 'vysoké' in pg.inner_text('#verdict').lower())
            pg.click('[data-act="again"]'); pg.wait_for_timeout(150)
            check('Rozebrat jiný odkaz vrátí do záložky Odkaz', pg.is_visible('#url-in') and pg.input_value('#url-in') == '')
            pg.fill('#url-in', 'https://www.csob.cz'); pg.click('#url-form button[type=submit]'); pg.wait_for_selector('#verdict')
            check('oficiální adresa neslibuje bezpečnost', 'neznamená, že je stránka bezpečná' in pg.inner_text('#verdict'))

            pg.click('[data-act="again"]'); pg.click('#tab-mail')
            pg.fill('#m-name', 'Česká spořitelna'); pg.fill('#m-addr', 'ceska.sporitelna@gmail.com')
            pg.fill('#m-body', 'Váš účet bude zablokován, ověřte se.'); pg.click('#mail-form button[type=submit]'); pg.wait_for_selector('#verdict')
            res = pg.inner_text('#result')
            check('e-mail z gmailu jménem banky je vysoké riziko', 'vysoké' in pg.inner_text('#verdict').lower())
            check('bez hlaviček se netvrdí ověření SPF/DKIM', 'nevložili' in res and 'SPF' not in res, res[:200])
            pg.click('[data-act="report-yes"]'); pg.wait_for_timeout(200)
            check('oznámení u e-mailu předvyplní adresu odesílatele', pg.input_value('#r-from') == 'ceska.sporitelna@gmail.com')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

            pg.click('[data-act="again"]'); pg.click('#tab-call'); pg.wait_for_selector('#call-q')
            def ans(label):
                pg.click('#call-box .opt:text-is("%s")' % label); pg.wait_for_timeout(60)
            ans('Za banku'); ans('Ano'); ans('Ne'); ans('Ne'); ans('Ne'); ans('Ano'); ans('Poslal(a) jsem peníze')
            cr = pg.inner_text('#call-result')
            check('telefonát s bezpečným účtem je vysoké riziko', 'vysoké' in cr.lower())
            check('průvodce upozorní, že číslo na displeji nic nedokazuje', 'Číslo na displeji nic nedokazuje' in cr)
            pg.click('[data-call-plan]'); pg.wait_for_timeout(200)
            checked = pg.evaluate("[...document.querySelectorAll('#sit-list input:checked')].map(c=>c.value)")
            check('z telefonátu se otevře nouzový plán s penězi', pg.is_visible('#view-help') and checked == ['money'], checked)
            first = pg.inner_text('.phase-now .plan-steps li')
            check('první krok plánu je zavolat bance', 'Zavolejte své bance' in first, first)
            pg.check('#sit-list input[value="card"]'); pg.wait_for_timeout(100)
            n = pg.evaluate("[...document.querySelectorAll('.plan-steps b')].filter(b=>b.textContent==='Zavolejte své bance').length")
            check('stejný krok se v plánu neopakuje', n == 1, n)
            check('plán ukáže, co si připravit pro policii', pg.is_visible('.prep'))

            pg.click('#nav-learn'); pg.wait_for_timeout(150)
            check('sekce Naučit se má trénink i knihovnu', pg.is_visible('#training') and pg.evaluate("document.querySelectorAll('.lib').length") >= 10)
            def play_round():
                texts = []
                for i in range(8):
                    texts.append(pg.inner_text('#training .tr-msg'))
                    pg.click('#training [data-tr="scam"]'); pg.wait_for_timeout(40)
                    pg.click('#training [data-tr-next]'); pg.wait_for_timeout(40)
                return texts
            r1 = play_round()
            import re as _re
            check('trénink dojde do konce a ukáže skóre', bool(_re.search(r'Správně [0-8] z 8', pg.inner_text('#training'))), pg.inner_text('#training')[:80])
            pg.click('#training [data-tr-again]'); pg.wait_for_timeout(80)
            r2 = play_round()
            check('další kolo ukáže jiné zprávy', len(set(r1) | set(r2)) == 16, len(set(r1) | set(r2)))
            pg.reload(); pg.click('#nav-learn'); pg.wait_for_timeout(80)
            r3 = [pg.inner_text('#training .tr-msg')]
            check('po obnovení stránky se neopakuje viděná zpráva', r3[0] not in r1 + r2)
            pg.click('#podvod-balik summary'); pg.click('#podvod-balik [data-lib-ex]'); pg.wait_for_selector('#verdict')
            check('ukázka z knihovny se zkontroluje', pg.is_visible('#view-check') and 'vysoké' in pg.inner_text('#verdict').lower())
            check('po nových režimech stále jen vlastní doména', sorted(set(u.split('/')[2] for u, m, d in reqs if u.startswith('http'))) == ['127.0.0.1:%d' % PORT])
            check('po nových režimech žádné CSP ani JS chyby', not csp and not errors, (csp + errors)[:3])

            # --- mobil ---
            for w, hgt in ((280, 653), (320, 568), (360, 740), (390, 844), (430, 932), (568, 320), (768, 1024)):
                m = b.new_page(viewport={'width': w, 'height': hgt}); m.goto(BASE)
                over = []
                def ov(name):
                    d = m.evaluate('document.documentElement.scrollWidth - window.innerWidth')
                    if d > 0: over.append((name, d))
                ov('úvod'); m.click('[data-ex="posta"]'); m.wait_for_selector('#verdict'); ov('výsledek')
                m.click('[data-act="report-yes"]'); m.wait_for_timeout(300); ov('okno'); m.keyboard.press('Escape')
                m.click('#nav-report'); ov('nahlásit'); m.click('#nav-help'); ov('pomoc')
                m.check('#sit-list input[value="money"]'); m.check('#sit-list input[value="id"]'); ov('plán')
                m.click('#nav-learn'); ov('naučit'); m.click('#podvod-bazar summary'); ov('knihovna')
                m.click('#nav-check'); m.click('#tab-url'); ov('odkaz'); m.fill('#url-in', 'https://login.csob.cz.overeni-klienta-velmi-dlouha-domena.com/prihlaseni/a/b/c?x=1234567890')
                m.click('#url-form button[type=submit]'); m.wait_for_selector('#verdict'); ov('rozbor')
                m.click('[data-act="again"]'); m.click('#tab-mail'); ov('e-mail'); m.click('#tab-call'); ov('telefonát')
                small = m.evaluate('''[...document.querySelectorAll('a,button,input,select,summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<32}).map(e=>(e.innerText||e.id).trim().slice(0,25))''')
                check('šířka %d px bez přetékání' % w, not over, over)
                check('šířka %d px: klikací plochy aspoň 32 px' % w, not small, small[:6])
                m.close()
            b.close()
    finally:
        srv.terminate()
    failed = [r for r in results if not r[1]]
    print('\nVýsledek: %d prošlo, %d selhalo' % (len(results) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
