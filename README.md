# PEBMedia Protect

Bezplatná webová aplikace, která pomáhá rozpoznat podvodné SMS, e-maily a odkazy a poradí, co dělat, když už se něco stalo.
Vše běží v prohlížeči uživatele, nic se neodesílá na server.

## Struktura

```
index.html            stránka aplikace
assets/analyzer.js    pravidla a vyhodnocení (bez závislostí, testovatelné v Node)
assets/app.js         rozhraní, čtení screenshotů, pomoc obětem, podklady pro policii
assets/style.css      vzhled v zelené paletě PEBMedia, světlý i tmavý režim
test/run.js           rychlý test na ukázkových podvodech: node test/run.js
vercel.json           bezpečnostní hlavičky pro Vercel
```

## Co umí verze 0.1

* Najde v textu odkazy, i bez https a www.
* Odhalí písmena z cyrilice a řečtiny v adrese a v textu.
* Pozná napodobení zhruba 35 značek, za které se podvodníci v Česku vydávají (pošta, dopravci, banky, státní správa, eDálnice, Vinted a další), včetně překlepů a triku s oficiální doménou na začátku adresy.
* Upozorní na zkracovače odkazů, rizikové koncovky, IP adresy, trik se zavináčem a http.
* V textu hledá nátlak, platby, žádosti o údaje, falešného bankéře, Ahoj mami, vzdálený přístup, výhry, investice a bazarové podvody.
* Doptá se podle typu zprávy a vyhodnocení zpřesní.
* Čte screenshoty přes Tesseract.js (čeština + angličtina), tmavé snímky převrací.
* Sekce Už se to stalo: postup pro 6 situací a generátor podkladů k oznámení.

## Nasazení

Statický web, žádný build. Stačí nový repozitář a projekt na Vercelu (doporučeno protect.pebmedia.cz).

## Další kroky

1. GitHub Action, která denně stáhne otevřené seznamy phishingových domén do `data/blocklist.json`.
2. Rozšíření seznamu značek a testovacích vzorků o skutečné podvodné zprávy.
3. Sekce na pebmedia.cz, která projekt představí.
