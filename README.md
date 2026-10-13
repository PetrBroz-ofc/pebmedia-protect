# PEBMedia Protect

Bezplatná webová aplikace, která pomáhá rozpoznat podvodné SMS, e-maily a odkazy a poradí, co dělat, když už se něco stalo.
Text zprávy ani obrázek se neodesílají: analýza i čtení obrázků (OCR) běží v prohlížeči a všechny soubory se načítají z vlastní domény.

Výsledek je orientační odhad podle pravidel, ne záruka bezpečnosti.

## Struktura

```
index.html                 stránka aplikace (kontrola, nahlášení pokusu, pomoc po podvodu, okno s oznámením)
assets/analyzer.js         pravidla, rozbor odkazů, vyhodnocení, pomocné funkce pro OCR (bez závislostí)
assets/report.js           sestavení textu oznámení pro Policii ČR (čistá funkce, bez DOM)
assets/app.js              rozhraní, historie a tlačítko Zpět, OCR, formulář
assets/style.css           vzhled podle design systému pebmedia.cz
assets/fonts.css, fonts/   písma hostovaná lokálně (GDPR)
assets/ocr/                Tesseract.js 5.1.1, worker, WASM jádro (SIMD i bez SIMD) a jazyková data ces + eng
                           (bajtově shodné s balíčky z npm, licence Apache-2.0 a MIT)
vercel.json                CSP, HSTS a další bezpečnostní hlavičky
docs/                      návrh oddílu do zásad ochrany osobních údajů
test/run.js                regresní testy v Node (bez sítě a bez API)
test/cases/                korpus zpráv, odkazů, odpovědí a OCR s očekáváním a důvodem
test/browser/              testy v prohlížeči (Playwright): síť, CSP, OCR na 10 obrázcích, formulář, XSS, mobil
```

## Testy

```
node test/run.js                         # regresní testy, při selhání exit kód 1
python3 test/browser/make_fixtures.py    # jednou: vygeneruje testovací obrázky
python3 test/browser/e2e.py              # testy v Chromiu proti lokálnímu serveru s hlavičkami z vercel.json
```

Testy s `review: true` mají sporné očekávání a čekají na odborné posouzení. Jejich selhání se vypíše, ale neovlivní výsledek.

## Zásady pro úpravy

* Seznam oficiálních domén v `analyzer.js` obsahuje jen ověřené domény (web odpovídá značce nebo na ni přesměrovává). Neověřenou doménu nepřidávejte.
* Samotný název značky v adrese nesmí znamenat vysoké riziko. Vysoké riziko vyžaduje rizikovou strukturu adresy (napodobenina, subdoména, překlep, písmena z jiné abecedy, bezplatný hosting, riziková koncovka).
* Odpovědi na doplňující otázky nesmí odstranit zásadní varovné signály. Hlídají to invarianty v `test/run.js`.
* Nové pravidlo vždy doplňte testem podvodné i legitimní zprávy.

## Nasazení

Statický web bez buildu, plánovaně protect.pebmedia.cz na Vercelu. Před zveřejněním je potřeba doplnit oddíl o Protectu do zásad ochrany osobních údajů na pebmedia.cz (návrh v `docs/`).
