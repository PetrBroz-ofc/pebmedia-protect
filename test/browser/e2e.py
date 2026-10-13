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
            while pg.query_selector('.opt'):
                opts = pg.query_selector_all('.opt')
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

            # --- mobil ---
            for w in (320, 360):
                m = b.new_page(viewport={'width': w, 'height': 700}); m.goto(BASE)
                over = []
                def ov(name):
                    d = m.evaluate('document.documentElement.scrollWidth - window.innerWidth')
                    if d > 0: over.append((name, d))
                ov('úvod'); m.click('[data-ex="posta"]'); m.wait_for_selector('#verdict'); ov('výsledek')
                m.click('[data-act="report-yes"]'); m.wait_for_timeout(300); ov('okno'); m.keyboard.press('Escape')
                m.click('#nav-report'); ov('nahlásit'); m.click('#nav-help'); ov('pomoc')
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
