#!/usr/bin/env python3
"""Vygeneruje 10 testovacích obrázků pro OCR (vyžaduje Pillow a písmo DejaVuSans)."""
import os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = os.path.join(os.path.dirname(__file__), 'fixtures')
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
os.makedirs(OUT, exist_ok=True)

def sms(name, text, dark=False, size=34, width=900, scale=1.0, jpeg_q=None, blur=False):
    font = ImageFont.truetype(F, size)
    bg = (0, 0, 0) if dark else (255, 255, 255); bub = (38, 38, 40) if dark else (233, 233, 235); fg = (240, 240, 240) if dark else (20, 20, 20)
    d = ImageDraw.Draw(Image.new('RGB', (10, 10))); lines = []; cur = ''
    for w in text.split(' '):
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) > width - 120: lines.append(cur); cur = w
        else: cur = t
    lines.append(cur)
    lh = int(size * 1.35); h = lh * len(lines) + 160
    im = Image.new('RGB', (width, h), bg); dr = ImageDraw.Draw(im)
    dr.rounded_rectangle((30, 60, width - 30, h - 40), radius=36, fill=bub)
    for i, l in enumerate(lines): dr.text((60, 80 + i * lh), l, font=font, fill=fg)
    dr.text((40, 15), '+420 731 555 019', font=ImageFont.truetype(F, 24), fill=(120, 120, 120))
    if scale != 1.0: im = im.resize((int(im.width * scale), int(im.height * scale)))
    if blur: im = im.filter(ImageFilter.GaussianBlur(1.2))
    p = os.path.join(OUT, name)
    im.save(p, 'JPEG', quality=jpeg_q) if jpeg_q else im.save(p)

TC = 'Česká pošta: Vaše zásilka nemohla být doručena, adresa je neúplná. Uhraďte doplatek 1,50 Kč do 24 hodin: https://ceskaposta-doruceni.top/cz/track?id=88231'
sms('light.png', TC)
sms('dark.png', TC, dark=True)
sms('small.png', TC, scale=0.42)
sms('lowq.jpg', TC, scale=0.55, jpeg_q=18, blur=True)
sms('english.png', 'DHL Express: Your parcel is on hold due to unpaid customs fee of 2.99 EUR. Pay within 24 hours: https://dhl-customs-pay.com/track')
sms('long.png', TC + ' ' + ' '.join(['Pokud platbu neuhradíte, zásilka bude vrácena odesílateli a bude účtován poplatek za skladování.'] * 6))
font = ImageFont.truetype(F, 34)
im = Image.new('RGB', (560, 330), 'white'); d = ImageDraw.Draw(im)
d.rounded_rectangle((10, 10, 550, 320), radius=30, fill=(233, 233, 235))
for i, l in enumerate(['Zasilkovna: balik ceka', 'na doplatek 29 Kc. Zaplatte:', 'https://zasilkovna-platba', '.top/z/88123']):
    d.text((30, 30 + i * 70), l, font=font, fill=(20, 20, 20))
im.save(os.path.join(OUT, 'wrapped.png'))
random.seed(1); im = Image.new('RGB', (600, 400)); px = im.load()
for x in range(600):
    for y in range(400): px[x, y] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
im.save(os.path.join(OUT, 'noise.png'))
Image.new('RGB', (600, 400), 'white').save(os.path.join(OUT, 'blank.png'))
open(os.path.join(OUT, 'broken.png'), 'wb').write(b'\x89PNG\r\n\x1a\nnot really a png')
open(os.path.join(OUT, 'document.pdf'), 'wb').write(b'%PDF-1.4\n%test\n')
print('ok')
