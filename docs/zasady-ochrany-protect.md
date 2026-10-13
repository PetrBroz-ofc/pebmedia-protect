# Návrh oddílu do Zásad ochrany osobních údajů na pebmedia.cz

Stav: návrh k vložení na https://pebmedia.cz/privacy.html před spuštěním protect.pebmedia.cz.
Body označené **[OVĚŘIT]** závisí na nastavení hostingu a je potřeba je potvrdit před zveřejněním.

---

## PEBMedia Protect (protect.pebmedia.cz)

PEBMedia Protect je bezplatný nástroj, který pomáhá posoudit podezřelé zprávy a odkazy.

**Text zpráv a obrázky.** Text, který do nástroje vložíte, a snímky obrazovky, které nahrajete, zpracovává jen váš prohlížeč. Nástroj je neodesílá na náš server ani žádné třetí straně a nikde je neukládá. Čtení textu z obrázku (OCR) probíhá také ve vašem prohlížeči. Program pro čtení textu a jazyková data se stahují z naší domény, ne od třetích stran.

**Údaje ve formuláři pro policii.** Údaje, které vyplníte při přípravě textu oznámení (například jméno, datum narození nebo adresa), zůstávají jen ve vašem prohlížeči a po zavření stránky zmizí. Nástroj oznámení nikam neodesílá. Pokud zvolíte „Otevřít e-mail“, otevře se váš vlastní e-mailový program a o odeslání rozhodujete vy.

**Data uložená ve vašem prohlížeči.** Pro rychlejší čtení obrázků si prohlížeč uloží jazyková data pro češtinu a angličtinu (úložiště IndexedDB s názvem `keyval-store`). Neobsahují žádné vaše zprávy ani osobní údaje. Smažete je vymazáním dat webu v nastavení prohlížeče.

**Cookies a analytika.** Nástroj nepoužívá cookies, analytické ani reklamní nástroje. **[OVĚŘIT po nasazení: hosting nesmí přidávat vlastní cookies ani analytiku.]**

**Hosting.** Nástroj běží na hostingu Vercel Inc. Při načtení stránky může hosting jako každý webový server zpracovat technické údaje o přístupu (IP adresu, čas, požadovanou adresu stránky a typ prohlížeče). Tyto údaje neobsahují text ani obrázky, které do nástroje vložíte. **[OVĚŘIT: doba uchování logů a předávání mimo EU podle aktuálních podmínek Vercelu, doplnit právní titul.]**

**Odkazy na jiné weby.** Nástroj obsahuje odkazy na weby Policie ČR, NÚKIB, České obchodní inspekce, Google a dalších. Po kliknutí se řídí zásadami těchto webů.

---

Technické ověření (13. 10. 2026, lokální testy v prohlížeči, test/browser/e2e.py): všechny síťové požadavky aplikace šly jen na vlastní doménu, žádný požadavek neobsahoval text zprávy, aplikace neodeslala žádný POST požadavek. Content-Security-Policy povoluje připojení jen k vlastní doméně (`connect-src 'self'`).
