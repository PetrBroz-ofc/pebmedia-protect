/* PEBMedia Protect: banka ukázek pro trénink (100 vymyšlených zpráv).
 * scam: true = podvod. Každé kolo vybere 8 zpráv, nejdřív ty, které uživatel ještě neviděl.
 * Testy (test/run.js) hlídají, že analyzátor každou ukázku hodnotí stejně jako vysvětlení.
 * Adresy v ukázkách jsou vymyšlené. Aktualizováno 14. 10. 2026.
 */
(function (root) {
  'use strict';
  var S = true, OK = false;
  var T = [
    // ---------- Zásilky ----------
    [S, 'PPL: Vaše zásilka čeká na doplatek cla 39 Kč. Zaplaťte do dnešní půlnoci, jinak bude vrácena: https://ppl-cz.delivery-fee.top/pay', 'Adresa jen napodobuje PPL, skutečná doména je delivery-fee.top. K tomu malá částka a termín do půlnoci.'],
    [S, 'Česká pošta: Zásilku nelze doručit kvůli neúplné adrese. Doplňte ji do 12 hodin: https://ceskaposta.adresa-doruceni.info', 'Na začátku adresy je ceskaposta, ale rozhoduje konec: adresa-doruceni.info. Pošta adresu přes SMS odkaz nedoplňuje.'],
    [S, 'Zásilkovna: Váš balík je uložen ve skladu. Za uskladnění uhraďte 25 Kč, jinak bude zlikvidován: https://zasilkovna-sklad.shop/platba', 'Hrozba likvidace a poplatek za sklad. Odkaz nevede na web Zásilkovny.'],
    [S, 'DPD: Kurýr vás nezastihl. Zvolte nový termín doručení a zaplaťte 19 Kč za nové doručení: dpd-cz.redelivery.online', 'Nové doručení se neplatí přes odkaz z SMS. Doména redelivery.online s DPD nemá nic společného.'],
    [S, 'GLS: Balík č. 7731 je zadržen na celnici. Uhraďte celní poplatek 54 Kč kartou: https://gls-celnice.top/form', 'Clo za drobný balík přes odkaz s kartou je klasický podvod. Koncovka .top je mezi podvodníky oblíbená.'],
    [S, 'Vaše zásilka byla vrácena do depa. Pro opětovné doručení potvrďte údaje karty: https://parcel-cz.help/d', 'Neuvádí ani přepravce, ale chce kartu. Skutečný přepravce se ozve konkrétně a kartu kvůli doručení nechce.'],
    [S, 'Alza: Gratulujeme, vaše objednávka čeká na doplatek dopravy 1 Kč. Zaplaťte zde: https://alza-cz.doprava-platba.com', 'Doplatek 1 Kč má jen získat údaje z karty. Alza má web alza.cz, ne doprava-platba.com.'],
    [S, 'Pošta: Doručení zásilky se nezdařilo. Naskenujte QR kód v příloze a zaplaťte 32 Kč, jinak bude zásilka do 24 hodin vrácena.', 'QR kód, spěch a výhrůžka vrácením. Pošta po vás placení přes QR kód v SMS nechce.'],
    [OK, 'Vaše zásilka od PPL bude doručena zítra mezi 9:00 a 12:00. Kurýr vám před příjezdem zavolá.', 'Jen informace o doručení, nechce peníze, údaje ani klik na odkaz.'],
    [OK, 'Zásilka 4471 je připravena k vyzvednutí na výdejním místě Jablonec, Komenského 12. Úložní doba je 7 dní.', 'Nic nechce zaplatit ani vyplnit. Když si nejste jistí, ověřte si to v aplikaci přepravce.'],
    [OK, 'Dobrý den, jsem kurýr DPD, stojím před domem s vaší zásilkou. Jste doma? Případně ji nechám u sousedů.', 'Běžná zpráva od kurýra. Nechce platbu ani odkaz.'],

    // ---------- Banka ----------
    [S, 'Banka: Zachytili jsme podezřelou platbu 15 000 Kč z vašeho účtu. Pokud jste ji neprovedli, ihned volejte na číslo 228 000 000.', 'Zpráva tlačí, abyste zavolali na číslo z ní. Bance volejte jen na číslo ze zadní strany karty nebo z aplikace.'],
    [S, 'Dobrý den, zde bezpečnostní oddělení vaší banky. Váš účet je ohrožen. Převeďte prostředky na bezpečný účet, číslo vám pošleme.', 'Bezpečný účet neexistuje. Banka po vás nikdy nechce převod peněz jinam.'],
    [S, 'Váš přístup do internetového bankovnictví vyprší. Aktualizujte údaje do 24 hodin: https://moje-banka-overeni.com/login', 'Výhrůžka a odkaz na cizí web. Do bankovnictví se přihlašujte jen přes aplikaci nebo adresu, kterou napíšete sami.'],
    [S, 'ČSOB: Vaše karta byla zablokována kvůli podezřelé aktivitě. Odblokujte ji zde: https://csob-cz.odblokovani.online', 'Napodobuje ČSOB, ale doména je odblokovani.online. Odblokování karty přes odkaz v SMS neexistuje.'],
    [S, 'Komerční banka: Pro dokončení nového zabezpečení nám prosím sdělte kód z SMS, který vám právě přišel.', 'Kód z SMS schvaluje platby a přihlášení. Banka ho po vás nikdy nechce.'],
    [S, 'Dobrý den, volám z banky. Na vašem účtu probíhá podezřelá transakce. Nainstalujte si prosím aplikaci AnyDesk, pomůžeme vám ji zastavit.', 'Banka nikdy nechce instalaci aplikace pro vzdálený přístup. Podvodník by viděl vaše bankovnictví.'],
    [S, 'Raiffeisenbank: Na vašem účtu byla zjištěna chyba. Ověřte svou totožnost na https://rb-klient.verify-cz.com', 'Doména verify-cz.com s bankou nesouvisí. Ověření totožnosti přes odkaz v SMS je podvod.'],
    [S, 'Upozornění banky: Kvůli novým pravidlům EU je nutné aktualizovat platební údaje. Bez aktualizace bude účet zrušen: https://eu-banka-update.info', 'Vymyšlená „nová pravidla“, hrozba zrušením a odkaz. Banka vás o změnách informuje v aplikaci.'],
    [OK, 'Platba kartou 349 Kč v obchodě Albert byla provedena. Zůstatek najdete v aplikaci své banky.', 'Jen oznámení o platbě. Nechce kód, údaje ani klik na odkaz.'],
    [OK, 'Váš ověřovací kód pro přihlášení je 482913. Kód nikomu nesdělujte, ani pracovníkům banky.', 'Kód, o který jste si sami řekli, je v pořádku. Pokud jste se ale nikam nepřihlašovali, kód nikomu nedávejte.'],
    [OK, 'Na váš účet přišla platba 12 400 Kč od zaměstnavatele. Přejeme hezký den.', 'Informace o příchozí platbě. Nic po vás nechce.'],
    [OK, 'Připomínáme, že vaše platební karta končí v listopadu. Novou kartu vám pošleme poštou na adresu, kterou u nás máte.', 'Nechce žádné údaje ani platbu. Novou kartu banka posílá sama.'],

    // ---------- Rodina a známí ----------
    [S, 'Ahoj tati, tohle je moje nové číslo, starý mobil mi spadl do vody. Můžeš mi rychle poslat 8 900 Kč? Zítra ti to vrátím.', 'Nové číslo a hned prosba o peníze. Zavolejte na číslo, které máte u blízkého uložené.'],
    [S, 'Ahoj mami, rozbil se mi telefon, píšu z nového čísla. Potřebuju zaplatit fakturu, bankovnictví mám ve starém mobilu. Pošleš to za mě?', 'Typický podvod „Ahoj mami“. Než pošlete peníze, zavolejte dítěti na staré číslo.'],
    [S, 'Babi, to jsem já, mám nové číslo. Nemůžu teď volat, jen psát. Potřebuju nutně 15 000 Kč, vysvětlím později.', 'Nechce volat, jen psát, a spěchá s penězi. Zavolejte vnukovi na číslo, které znáte.'],
    [S, 'Ahoj, tady Petra, mám nový mobil. Napiš mi na WhatsApp, potřebuju rychle půjčit na nájem, banka mi zablokovala účet.', 'Přesun na WhatsApp, nové číslo a peníze. Ověřte si to přímo u kamarádky.'],
    [S, 'Mami, ztratil jsem peněženku i kartu. Pošli mi prosím 3 000 Kč na tenhle účet kamaráda, je to fakt nutné.', 'Peníze na cizí účet a spěch. Zavolejte synovi na jeho číslo, než cokoli pošlete.'],
    [S, 'Ahoj, poslal jsem ti omylem šestimístný kód z WhatsAppu. Můžeš mi ho prosím přeposlat?', 'Kód z WhatsAppu je klíč k vašemu účtu. Kdo ho dostane, ovládne váš WhatsApp.'],
    [S, 'Dobrý den, váš syn měl dopravní nehodu. Aby nešel do vazby, je potřeba ihned zaplatit kauci 80 000 Kč. Pošleme pro peníze kurýra.', 'Policie ani soud kauci přes kurýra nevybírá. Zavolejte synovi a případně na 158.'],
    [OK, 'Ahoj, vlak má zpoždění asi 20 minut. Večeři klidně dejte bez nás, dorazíme kolem osmé.', 'Nic po vás nechce: žádné peníze, odkaz ani údaje. Tak vypadá běžná zpráva.'],
    [OK, 'Ahoj mami, koupíš cestou chleba a mléko? Díky, uvidíme se večer.', 'Běžná prosba od známého čísla. Nechce peníze ani údaje.'],
    [OK, 'Čau, v sobotu slavíme narozeniny u nás na zahradě od tří. Přijdeš?', 'Pozvánka bez odkazu a bez žádosti o peníze.'],
    [OK, 'Dědo, díky za dárek! Moc se mi líbí. Přijedeme v neděli na oběd.', 'Poděkování od blízkého. Nic nechce.'],
    [OK, 'Ahoj, posílám ti tu fotku z výletu, jak jsi chtěla. Měj se hezky!', 'Obyčejná zpráva. Kdyby ale z neznámého čísla chodily soubory nebo odkazy, buďte opatrní.'],

    // ---------- Bazar a prodej ----------
    [S, 'Dobrý den, zboží beru. Zaplatím přes Bazoš doručení, peníze si převezmete tady: https://bazos-cz.safe-pay.shop/prijem', 'Abyste peníze dostali, nikdy nic nevyplňujete. Odkaz vede na safe-pay.shop, ne na Bazoš.'],
    [S, 'Dobrý den, zboží jsem zaplatil přes Vinted, kurýr si ho vyzvedne. Pro přijetí platby potvrďte kartu: vinted-cz.prijem-platby.online/item/552', 'Prodávající nikdy nepotvrzuje kartu, aby dostal peníze. Doména prijem-platby.online není Vinted.'],
    [S, 'Dobrý den, máte ještě ten kočárek? Koupím ho bez prohlížení, pošlu kurýra. Napište mi na WhatsApp, tady to moc nesleduji.', 'Koupě bez prohlížení a přesun mimo bazar. Většinou pak přijde odkaz na „platbu“.'],
    [S, 'Platba za váš inzerát byla připravena. Pro připsání peněz zadejte číslo karty a CVV: https://sbazar-platby.com/receive', 'CVV kód nikdy nikomu nezadávejte. K přijetí peněz stačí číslo účtu.'],
    [S, 'Dobrý den, posílám zálohu za kolo. Kvůli limitu ale musíte nejdřív zaplatit poplatek 199 Kč za ověření účtu: https://overeni-bazar.top', 'Poplatek za přijetí peněz neexistuje. Kdo chce, abyste platili, když prodáváte, je podvodník.'],
    [S, 'Vinted: Váš účet byl pozastaven kvůli neověřenému prodeji. Ověřte se do 24 hodin: https://vinted-podpora.online', 'Výhrůžka pozastavením a cizí web. Oznámení od Vinted najdete přímo v jeho aplikaci.'],
    [S, 'Dobrý den, prodávám iPhone 15 za 9 000 Kč. Pošlete zálohu 3 000 Kč na účet a já ho hned odešlu, osobní předání nejde.', 'Podezřele nízká cena, záloha předem a odmítání osobního předání. Platbu předem neznámému prodejci neposílejte.'],
    [OK, 'Dobrý den, ještě je ta lednička k mání? Mohl bych se na ni přijet podívat v sobotu dopoledne?', 'Zájemce chce přijet osobně. Nic nechce vyplňovat ani posílat.'],
    [OK, 'Dobrý den, peníze jsem vám poslal na účet, který jste uvedl. Zboží si vyzvednu zítra v pět, jak jsme se domluvili.', 'Běžná domluva. Platbu si ale vždy zkontrolujte ve svém bankovnictví, ne podle zprávy.'],
    [OK, 'Dobrý den, kolo bych bral. Dáte 3 500 Kč? Můžu přijet dnes večer a zaplatit hotově.', 'Osobní předání a platba v hotovosti. Bez odkazu a bez žádosti o kartu.'],

    // ---------- Investice a výdělek ----------
    [S, 'Gratulujeme! Byli jste vybráni do investičního programu. Z vkladu 5 000 Kč můžete mít do měsíce 80 000 Kč. Zaručený výdělek bez rizika.', 'Zaručený výdělek bez rizika neexistuje. Takové sliby jsou typické pro investiční podvody.'],
    [S, 'Známý moderátor prozradil, jak vydělává na kryptoměnách 30 000 Kč týdně. Registrujte se zde: https://krypto-zisk.online', 'Známé tváře v reklamách podvodníci zneužívají. Rychlé zbohatnutí je vždy past.'],
    [S, 'Váš investiční účet vykazuje zisk 48 200 Kč. Pro výběr je nutné uhradit daň 4 900 Kč předem.', 'Poplatek nebo „daň“ předem, abyste dostali zisk, je klasický podvod. Peníze už neuvidíte.'],
    [S, 'Dobrý den, jsem váš osobní investiční poradce. Pro rychlejší spolupráci si nainstalujte AnyDesk, vše za vás nastavím.', 'Poradce, který chce vzdálený přístup, chce ovládnout váš počítač a bankovnictví.'],
    [S, 'Přišli jste o peníze v online investicích? Naše advokátní kancelář vám je vrátí. Stačí uhradit vstupní poplatek 2 500 Kč.', 'Lidé, kteří slibují vrácení ztracených peněz za poplatek, bývají další podvodníci.'],
    [S, 'Dobrý den, nabízíme práci z domova, 1 500 až 3 000 Kč denně za hodnocení produktů. Pro více informací napište na WhatsApp.', 'Velký výdělek za skoro žádnou práci a přesun do chatu. Časem chtějí vklad.'],
    [S, 'Hledáme brigádníky na lajkování videí, 500 Kč za úkol. Kontaktujte nás na Telegramu.', 'Platba za lajky je návnada. Pak přijde žádost o „vklad“ na odemčení výdělku.'],
    [S, 'Nabízíme práci: přijmete na svůj účet platby a pošlete je dál, za každou dostanete 10 %. Zájemci pište na WhatsApp.', 'Přeposílání cizích peněz je praní peněz. Můžete se dostat do potíží se zákonem.'],
    [S, 'Dobrý den, vaše CV nás zaujalo. Pro nástup je potřeba zaplatit vratnou kauci 1 200 Kč za pracovní materiály.', 'Seriózní zaměstnavatel po vás před nástupem žádné peníze nechce.'],
    [OK, 'Dobrý den, děkujeme za zaslaný životopis. Rádi bychom vás pozvali na pohovor ve středu v 10:00 na naší pobočce. Potvrdíte termín?', 'Pozvánka na osobní pohovor. Nechce peníze ani údaje.'],
    [OK, 'Připomínáme, že výplata za září bude připsána na váš účet 15. 10. Mzdový lístek najdete u vedoucího.', 'Informace od zaměstnavatele. Nic po vás nechce.'],

    // ---------- Úřady, energie, operátor ----------
    [S, 'Finanční správa: Máte nárok na vrácení přeplatku daně 4 210 Kč. Pro výplatu vyplňte údaje platební karty: https://vraceni-dane.online/form', 'Úřad po vás nikdy nechce údaje z karty přes odkaz v SMS. Přeplatek se vrací na účet.'],
    [S, 'ČEZ: Máte přeplatek za elektřinu 2 870 Kč. Pro vrácení zadejte údaje karty: https://cez-preplatek.com', 'Přeplatek vrací dodavatel na účet. Doména cez-preplatek.com mu nepatří.'],
    [S, 'Upozornění: Vaše elektřina bude dnes ve 20:00 odpojena kvůli nezaplacené faktuře. Uhraďte ihned: https://energie-platba.top', 'Hrozba odpojením ještě dnes. Dodavatel posílá upomínky a odpojení nikdy neohlašuje takhle narychlo.'],
    [S, 'Vodafone: Vyhráli jste iPhone 16! Pro doručení uhraďte poštovné 49 Kč: https://vodafone-vyhra.shop', 'Výhra, o kterou jste nesoutěžili, a poplatek za doručení. Skutečná výhra nic nestojí.'],
    [S, 'Policie ČR: Bylo zahájeno trestní řízení kvůli vašemu účtu. Kontaktujte vyšetřovatele na čísle 777 123 456, jinak hrozí zatčení.', 'Policie takhle nekomunikuje a nevyhrožuje přes SMS. Volejte jen na 158.'],
    [S, 'Exekutorský úřad: Proti vám je vedena exekuce. Dluh 6 340 Kč uhraďte do 24 hodin na účet 1234567/0100, jinak zabavíme majetek.', 'Exekuce se oznamuje doporučeným dopisem nebo do datovky, ne SMS s výzvou zaplatit do 24 hodin.'],
    [S, 'Výzva k úhradě: nezaplacené parkovné. Naskenujte QR kód a uhraďte pokutu 1 500 Kč do 3 dnů, jinak předáme vymáhání.', 'Nátlak, výhrůžka a QR kód. Pokutu si ověřte přímo u úřadu nebo města.'],
    [S, 'Kupte si dálniční známku na rok 2027 rychle a bez front: https://dalnicni-znamka-eshop.com', 'Elektronická dálniční známka se oficiálně prodává na edalnice.cz. Jiné weby si často účtují víc.'],
    [S, 'Vaše dálniční známka vyprší. Prodlužte ji nyní se slevou: https://edalnice-cz.renew.top', 'Na začátku je edalnice, ale doména je renew.top. Oficiální web je jen edalnice.cz.'],
    [S, 'ČSSZ: Byl vám přiznán příspěvek 3 900 Kč. Pro vyplacení potvrďte údaje karty: https://cssz-prispevek.online', 'Úřady peníze vyplácejí na účet nebo složenkou, ne přes potvrzení karty na cizím webu.'],
    [OK, 'Připomínáme zítřejší kontrolu u zubaře v 10:30. Pokud nemůžete přijít, dejte nám prosím vědět.', 'Jen připomínka, nic nechce zaplatit ani vyplnit.'],
    [OK, 'Vyúčtování elektřiny za rok 2026 je připraveno v zákaznickém portálu vašeho dodavatele. Přeplatek vám pošleme na účet.', 'Nechce údaje ani platbu přes odkaz. Vyúčtování si otevřete v portálu sami.'],
    [OK, 'Odstávka vody v ulici Nádražní proběhne ve čtvrtek od 8 do 14 hodin. Omlouváme se za komplikace.', 'Informace bez odkazu a bez žádosti o peníze.'],
    [OK, 'Váš měsíční limit dat je z 80 % vyčerpaný. Další data si můžete dokoupit v aplikaci operátora.', 'Upozornění bez odkazu. Data si koupíte v aplikaci, kterou znáte.'],

    // ---------- Účty a hesla ----------
    [S, 'Váš účet bude do 24 hodin zablokován kvůli neověřeným údajům. Přihlaste se a ověřte svou totožnost: https://seznam-overeni.com/login', 'Výhrůžka zablokováním a cizí web. Do schránky se přihlašujte jen přes adresu, kterou znáte.'],
    [S, 'Netflix: Platba za předplatné se nezdařila. Aktualizujte platební údaje, jinak bude účet zrušen: https://netflix-billing.top', 'Doména netflix-billing.top nepatří Netflixu. Platbu si zkontrolujte přímo v aplikaci.'],
    [S, 'Microsoft: Někdo se přihlásil k vašemu účtu z Ruska. Pokud jste to nebyli vy, okamžitě ověřte heslo: https://microsoft-security-alert.online', 'Strach z cizího přihlášení má donutit kliknout. Bezpečnost účtu řešte přes oficiální aplikaci.'],
    [S, 'Facebook: Vaše stránka porušuje pravidla a bude smazána. Podejte odvolání do 24 hodin: https://meta-appeal-center.com', 'Falešné „odvolání“ krade hesla k sociálním sítím. Upozornění najdete přímo ve Facebooku.'],
    [S, 'Apple: Vaše Apple ID bylo uzamčeno. Odemkněte ho zadáním hesla a kódu: https://apple-id-unlock.top', 'Heslo a kód na cizím webu znamenají ztrátu účtu. Apple ID řešte jen v nastavení telefonu.'],
    [S, 'Vaše e-mailová schránka je plná. Klikněte a rozšiřte úložiště zdarma, jinak přestanete dostávat poštu: https://mail-storage-upgrade.com', 'Hrozba ztráty pošty a odkaz na cizí web. Místo ve schránce zkontrolujte v nastavení pošty.'],
    [S, 'Instagram: Gratulujeme, váš účet získal ověřovací odznak. Pro aktivaci zadejte heslo: https://ig-verified-badge.online', 'Odznak za heslo je léčka. Nikde mimo aplikaci heslo nezadávejte.'],
    [OK, 'Seznam.cz: Zaznamenali jsme nové přihlášení k vašemu účtu z prohlížeče Chrome. Pokud jste to byli vy, nemusíte nic dělat.', 'Upozornění bez odkazu a bez žádosti o heslo. Pokud jste to nebyli vy, změňte heslo přes aplikaci.'],
    [OK, 'Vaše heslo bylo úspěšně změněno. Pokud jste ho neměnili, kontaktujte podporu přes nastavení účtu.', 'Potvrzení akce, kterou jste sami udělali. Nechce žádné údaje.'],
    [OK, 'Vaše objednávka č. 2041887 byla odeslána. Doručení očekávejte do 2 pracovních dnů.', 'Jen informuje, nic nechce. Pokud jste nic neobjednali, ignorujte ji.'],

    // ---------- Výhry a nákupy ----------
    [S, 'Gratulujeme! Vyhráli jste nákupní poukaz 10 000 Kč do Lidlu. Vyzvedněte si ho zde: https://lidl-poukaz.online', 'Soutěž, do které jste se nepřihlásili. Odkaz nevede na web Lidlu.'],
    [S, 'Jste náš miliontý návštěvník! Získejte Samsung Galaxy za 1 Kč, stačí zadat údaje karty: https://vyhra-dnes.shop', 'Telefon za 1 Kč má získat údaje z karty. Často se k nim připojí drahé předplatné.'],
    [S, 'Výprodej skladu! Značkové boty Nike za 299 Kč, jen dnes. Platba pouze předem: https://nike-vyprodej-cz.shop', 'Ceny, které jsou až moc dobré, a platba jen předem. Typický falešný e-shop.'],
    [S, 'Lidl: K 50. výročí rozdáváme 1 000 Kč každému, kdo vyplní krátký dotazník: https://lidl-vyroci.top', 'Lákavá odměna za dotazník je návnada. Na konci přijde žádost o kartu.'],
    [OK, 'Děkujeme za nákup. Účtenku najdete ve svém zákaznickém účtu. Těšíme se na další návštěvu.', 'Poděkování bez odkazu a bez žádosti o údaje.'],
    [OK, 'Vaše rezervace stolu na pátek v 19:00 pro 4 osoby je potvrzena. Pokud nemůžete přijít, zavolejte nám.', 'Potvrzení rezervace. Nic nechce.'],

    // ---------- Technická podpora a zařízení ----------
    [S, 'Dobrý den, volám z technické podpory Microsoftu. Ve vašem počítači jsme našli virus. Nainstalujte si prosím aplikaci AnyDesk, pomůžeme vám ho odstranit.', 'Firmy samy nevolají kvůli virům. Vzdálený přístup dává podvodníkovi kontrolu nad počítačem.'],
    [S, 'Váš telefon je napaden 3 viry! Okamžitě stáhněte čisticí aplikaci: https://telefon-cistic.online/apk', 'Vyskakovací strašení viry. Aplikace stahujte jen z oficiálního obchodu.'],
    [S, 'Dobrý den, omylem jsme vám vrátili 5 000 Kč místo 500 Kč. Připojte se prosím přes TeamViewer, ať to opravíme.', 'Falešné „vrácení“ a vzdálený přístup. Podvodník pak sám pošle peníze z vašeho účtu.'],
    [OK, 'Dobrý den, servis potvrzuje opravu vaší pračky ve čtvrtek mezi 13 a 15 hodinou. Technik se ozve před příjezdem.', 'Domluva servisu, kterou jste si objednali. Nic nechce předem.'],
    [OK, 'Aktualizace systému je připravena k instalaci. Telefon ji nainstaluje v noci při nabíjení.', 'Hlášení přímo ze systému telefonu, ne z SMS s odkazem.'],

    // ---------- Další běžné zprávy ----------
    [OK, 'Dobrý den, připomínáme třídní schůzky v úterý od 17 hodin. Těšíme se na vás.', 'Informace ze školy bez odkazu a bez žádosti o peníze.'],
    [OK, 'Váš recept je připraven. Kód eReceptu je 7HD2 5KQP 9X4M, předložte ho v lékárně.', 'eRecept od lékaře. Kód eReceptu je v pořádku ukázat v lékárně.'],
    [OK, 'Ahoj, nezapomeň, že zítra máme schůzku v 10 v kavárně na náměstí. Kdyby něco, zavolej.', 'Domluva schůzky. Nechce peníze ani odkaz.'],
    [OK, 'Dobrý den, vaše auto je po servisu připravené k vyzvednutí. Otevřeno máme do 17 hodin.', 'Zpráva ze servisu, kam jste auto dali. Platit budete na místě.'],
    [OK, 'Knihovna: Výpůjční lhůta knihy končí za 3 dny. Výpůjčku si můžete prodloužit při příští návštěvě.', 'Připomínka bez odkazu a bez platby.'],
    [OK, 'Ahoj tati, dorazila jsem v pořádku na kolej. Zavolám večer.', 'Zpráva od blízkého ze známého čísla. Nic nechce.'],
    [OK, 'Dobrý den, váš termín na stříhání ve středu v 16:00 platí. Kdybyste nemohli, napište.', 'Potvrzení termínu. Bez odkazu a bez platby.'],
    [OK, 'Děkujeme za vaši platbu. Faktura č. 2026-118 je uhrazená.', 'Potvrzení platby, kterou jste udělali. Nic dalšího nechce.'],
    [OK, 'Zítra bude na trase autobusu 24 výluka, spoje pojedou odklonem přes Rochlici.', 'Dopravní informace. Nic nechce.']
  ];
  var TRAINING = T.map(function (t, i) { return { id: 't' + (i + 1), scam: t[0], text: t[1], explain: t[2] }; });

  // Vybere n ukázek: nejdřív ty, které uživatel ještě neviděl, a vždy aspoň 2 podvody a 2 zprávy v pořádku.
  function pickRound(n, seen, rnd) {
    rnd = rnd || Math.random;
    seen = seen || [];
    var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
    var fresh = TRAINING.filter(function (t) { return seen.indexOf(t.id) === -1; });
    var pool = fresh.length >= n ? fresh : TRAINING;
    var scams = shuffle(pool.filter(function (t) { return t.scam; }));
    var oks = shuffle(pool.filter(function (t) { return !t.scam; }));
    var nOk = Math.min(oks.length, Math.max(2, Math.round(n * (2 + Math.floor(rnd() * 3)) / 8)));
    var nScam = Math.min(scams.length, n - nOk);
    var round = scams.slice(0, nScam).concat(oks.slice(0, n - nScam));
    if (round.length < n) round = round.concat(shuffle(TRAINING.filter(function (t) { return round.indexOf(t) === -1; })).slice(0, n - round.length));
    return { items: shuffle(round), reset: pool === TRAINING };
  }

  var api = { TRAINING: TRAINING, pickRound: pickRound };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PPTraining = api;
})(typeof window !== 'undefined' ? window : this);
