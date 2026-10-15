# PEBMedia Protect

Bezplatná webová aplikace, která pomáhá rozpoznat podvodné SMS, e-maily a odkazy a poradí, co dělat, když už se něco stalo.
Text zprávy ani obrázek se neodesílají: analýza i čtení obrázků (OCR) běží v prohlížeči a všechny soubory se načítají z vlastní domény.

Výsledek je orientační odhad podle pravidel, ne záruka bezpečnosti.

Návštěvy se počítají anonymně přes Vercel Web Analytics (`assets/stats.js`, jen na protect.pebmedia.cz, bez cookies). Odchází jen cesta stránky a parametr `ref`, nikdy obsah zpráv. Odkazy do skupin pište ve tvaru `https://protect.pebmedia.cz/?ref=nazev-skupiny`, ve statistikách pak uvidíte, odkud lidé přišli.

Co umí:

* **Kontrola zprávy** (text nebo screenshot přes OCR), **odkazu** (rozbor skutečné domény, subdomény, cesty, punycode, zkracovačů a HTTPS, odkaz se nikdy neotevírá) a **e-mailu** (jméno proti adrese, bezplatné schránky, Reply-To, výsledek SPF/DKIM/DMARC jen pokud je ve vložených hlavičkách).
* **Průvodce telefonátem**: otázky na bezpečný účet, instalaci aplikace, kódy a údaje, výsledek s postupem.
* **Nouzový plán** po podvodu: kroky seřazené na „hned“, „během hodiny“ a „v dalších dnech“, bez opakování, se seznamem podkladů pro policii.
* **Příprava oznámení** pro Policii ČR včetně průběhu události. Nic se neodesílá.
* **Naučit se**: knihovna 12 typů podvodů s ukázkami a trénink na 8 zprávách.

## Struktura

```
index.html                 stránka aplikace (kontrola, nahlášení pokusu, pomoc po podvodu, okno s oznámením)
assets/analyzer.js         pravidla, rozbor odkazů, vyhodnocení, pomocné funkce pro OCR (bez závislostí)
pravni-informace.html      provozovatel, podmínky používání, ochrana osobních údajů, úložiště v prohlížeči, licence
assets/licence/            texty licencí písem a Tesseractu
assets/guides.js           nouzový plán, průvodce telefonátem, trénink (čisté funkce a data, bez DOM)
assets/report.js           sestavení textu oznámení pro Policii ČR (čistá funkce, bez DOM)
assets/app.js              rozhraní, historie a tlačítko Zpět, OCR, formulář
assets/style.css           vzhled podle design systému pebmedia.cz
assets/pebai.js, pebai.css PEBAi, asistent PEBMedia (zatím ve vývoji, nic neodesílá)
assets/fonts.css, fonts/   písma hostovaná lokálně (GDPR)
assets/ocr/                Tesseract.js 5.1.1, worker, WASM jádro (SIMD i bez SIMD) a jazyková data ces
                           (bajtově shodné s balíčky z npm, licence Apache-2.0 a MIT)
vercel.json                CSP, HSTS a další bezpečnostní hlavičky
docs/                      návrh oddílu do zásad ochrany osobních údajů
test/run.js                regresní testy v Node (bez sítě a bez API)
test/cases/                korpus zpráv, odkazů, odpovědí a OCR s očekáváním a důvodem
test/browser/              testy v prohlížeči (Playwright): síť, CSP, OCR na 10 obrázcích, formulář, XSS, mobil
```

## Testy

Čtení obrázků: aplikace používá češtinu (bez angličtiny) a režim stránky 6. Na realistických snímcích z telefonu (`test/ocr-bench`) to snížilo chybovost znaků zhruba z 10 % na 1 %. Snímky se dají znovu vyrobit a změřit:

```
python3 test/ocr-bench/make_screens.py       # 43 snímků SMS (iOS, Android, tmavý režim, JPEG, celé obrazovky)
python3 test/ocr-bench/run_bench.py          # chybovost znaků a správnost odkazů pro různá nastavení
```

Velký korpus: `test/corpus/generate.js` skládá 10 000 podvodných zpráv ze vzorů skutečných kampaní (14 druhů, s diakritikou i bez, s chybami čtečky textu) a 3 000 běžných zpráv. `node test/corpus/measure.js --show 10` ukáže záchyt po druzích a nezachycené zprávy. Test v `test/run.js` hlídá záchyt aspoň 99,5 % a plané poplachy nejvýš 0,5 %.

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
* Ukázky v knihovně a tréninku hlídá `test/run.js`: podvod nesmí vyjít jako nízké riziko, zpráva v pořádku ano. Při změně ukázky zkontrolujte, že s ní analyzátor souhlasí.
* U e-mailu nikdy netvrďte, že jsme ověřili SPF, DKIM nebo DMARC. Jen čteme, co zapsal server příjemce.

## Nasazení

Statický web bez buildu, plánovaně protect.pebmedia.cz na Vercelu. Před zveřejněním je potřeba doplnit oddíl o Protectu do zásad ochrany osobních údajů na pebmedia.cz (návrh v `docs/`).
