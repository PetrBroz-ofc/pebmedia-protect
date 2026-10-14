#!/usr/bin/env python3
"""Vyrobí realistické snímky obrazovky SMS a e-mailů pro měření kvality čtení (OCR).
Vykresluje je Chromium, takže písmo, vyhlazování i rozlišení odpovídají skutečným telefonům.
Spuštění: python3 test/ocr-bench/make_screens.py  ->  test/ocr-bench/screens/*.png|jpg + truth.json
"""
import json, os, io
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'screens'); os.makedirs(OUT, exist_ok=True)

MSGS = [
 'Česká pošta: Vaše zásilka nemohla být doručena, adresa je neúplná. Uhraďte doplatek 1,50 Kč do 24 hodin: https://ceskaposta-doruceni.top/cz/track',
 'Dobrý den, zde bezpečnostní oddělení vaší banky. Zaznamenali jsme podezřelou platbu 18 450 Kč. Převeďte úspory na bezpečný účet.',
 'Ahoj mami, rozbil se mi telefon, tohle je moje nové číslo. Ulož si ho. Potřebuji rychle zaplatit fakturu, pošleš mi 8 900 Kč?',
 'Finanční správa: Máte nárok na vrácení přeplatku daně 4 210 Kč. Vyplňte údaje platební karty: https://vraceni-dane.online/form',
 'Příliš žluťoučký kůň úpěl ďábelské ódy. Řeřicha, čeština, ďolíček, ťuťínek, nůše, ěščřžýáíé.',
]

CSS = {
 'ios-light': ("#fff", "#e9e9eb", "#000", "-apple-system, Inter, sans-serif", 17),
 'ios-sent': ("#fff", "#0b84fe", "#fff", "Inter, sans-serif", 17),
 'ios-dark': ("#000", "#262628", "#fff", "Inter, sans-serif", 17),
 'android': ("#fff", "#e8eef7", "#1f1f1f", "'Liberation Sans', Arial, sans-serif", 16),
 'android-dark': ("#121212", "#2b2f36", "#e3e3e3", "'Liberation Sans', Arial, sans-serif", 16),
 'green-sent': ("#ece5dd", "#d9fdd3", "#111", "'DejaVu Sans', sans-serif", 15),
}

def page(style, text, width=390):
    bg, bub, fg, font, size = CSS[style]
    return f"""<!doctype html><meta charset=utf-8><style>
    body{{margin:0;background:{bg};font-family:{font};width:{width}px}}
    .top{{padding:14px 16px;color:{'#8e8e93' if bg!='#ece5dd' else '#555'};font-size:13px;text-align:center;border-bottom:1px solid rgba(128,128,128,.25)}}
    .top b{{display:block;color:{fg if bg not in ('#fff','#ece5dd') else '#000'};font-size:15px}}
    .wrap{{padding:16px 12px 24px;display:flex;flex-direction:column;align-items:{'flex-end' if style in ('ios-sent','green-sent') else 'flex-start'}}}
    .time{{align-self:center;color:#8e8e93;font-size:11px;margin:4px 0 8px}}
    .b{{background:{bub};color:{fg};font-size:{size}px;line-height:1.3;padding:9px 13px;border-radius:18px;max-width:78%;word-wrap:break-word}}
    </style><div class=top><b>+420 731 555 019</b>Textová zpráva</div><div class=wrap><div class=time>Dnes 14:32</div><div class=b>{text}</div></div>"""

def run():
    truth = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        n = 0
        for style in CSS:
            for dpr in (3, 2):
                for mi, msg in enumerate(MSGS):
                    if (mi + len(style) + dpr) % 2: continue  # polovina kombinací stačí
                    pg = b.new_page(viewport={'width': 390, 'height': 400}, device_scale_factor=dpr)
                    pg.set_content(page(style, msg)); pg.wait_for_timeout(50)
                    h = pg.evaluate('document.body.scrollHeight')
                    png = pg.screenshot(clip={'x': 0, 'y': 0, 'width': 390, 'height': h})
                    pg.close()
                    name = f'{style}-{dpr}x-m{mi}'
                    im = Image.open(io.BytesIO(png)).convert('RGB')
                    if n % 3 == 0:  # část uložit jako JPEG, jak ji pošle messenger
                        im.save(os.path.join(OUT, name + '.jpg'), quality=60); fn = name + '.jpg'
                    else:
                        im.save(os.path.join(OUT, name + '.png')); fn = name + '.png'
                    truth[fn] = msg; n += 1
        # zmenšený snímek (přeposlaný přes chat) a e-mail
        pg = b.new_page(viewport={'width': 390, 'height': 400}, device_scale_factor=3)
        pg.set_content(page('ios-light', MSGS[0])); h = pg.evaluate('document.body.scrollHeight')
        im = Image.open(io.BytesIO(pg.screenshot(clip={'x': 0, 'y': 0, 'width': 390, 'height': h}))).convert('RGB')
        im.resize((im.width // 3, im.height // 3), Image.LANCZOS).save(os.path.join(OUT, 'ios-light-downscaled-m0.jpg'), quality=70)
        truth['ios-light-downscaled-m0.jpg'] = MSGS[0]
        # celé obrazovky telefonu: stavový řádek, starší zprávy, podvodná zpráva, pole pro psaní
        FULL = '''<!doctype html><meta charset=utf-8><style>
        body{{margin:0;background:{bg};font-family:{font};width:390px;height:844px;position:relative;color:{fg}}}
        .sb{{display:flex;justify-content:space-between;padding:14px 26px 6px;font-size:15px;font-weight:600}}
        .top{{text-align:center;padding:6px 0 10px;border-bottom:1px solid rgba(128,128,128,.25);font-size:12px;color:#8e8e93}}
        .top b{{display:block;font-size:15px;color:{fg}}}
        .w{{padding:10px 12px;display:flex;flex-direction:column;gap:8px}}
        .t{{align-self:center;color:#8e8e93;font-size:11px}}
        .b{{background:{bub};color:{bfg};font-size:{size}px;line-height:1.3;padding:9px 13px;border-radius:18px;max-width:78%}}
        .me{{align-self:flex-end;background:#0b84fe;color:#fff}}
        .in{{position:absolute;left:10px;right:10px;bottom:30px;border:1px solid rgba(128,128,128,.4);border-radius:20px;padding:9px 14px;color:#8e8e93;font-size:15px}}
        </style><div class=sb><span>14:41</span><span>5G 87 %</span></div><div class=top><b>+420 731 555 019</b>Textová zpráva</div>
        <div class=w><div class=t>Včera 18:02</div><div class=b>Dobrý den, připomínáme termín.</div><div class="b me">Děkuji, dorazím.</div>
        <div class=t>Dnes 14:32</div><div class=b>{msg}</div></div><div class=in>Textová zpráva</div>'''
        for style, (bg, bub, fg, font, size) in CSS.items():
            if style in ('ios-sent', 'green-sent'): continue
            for mi in (0, 3, 4):
                pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=3)
                pg.set_content(FULL.format(bg=bg, bub=bub, fg=fg if bg != '#fff' else '#000', bfg=fg, font=font, size=size, msg=MSGS[mi]))
                pg.wait_for_timeout(50)
                im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB'); pg.close()
                fn = f'full-{style}-m{mi}.png'; im.save(os.path.join(OUT, fn)); truth[fn] = MSGS[mi]
        b.close()
    json.dump(truth, open(os.path.join(HERE, 'truth.json'), 'w'), ensure_ascii=False, indent=1)
    print(len(truth), 'snímků')

run()
