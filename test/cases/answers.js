/* Regresní testy doplňujících otázek.
 * Odpovědi smí upřesnit výsledek, ale nesmí odstranit zásadní varovné signály
 * (platba, údaje, kódy, vzdálený přístup, falešný odkaz).
 *
 * msg:      id zprávy z messages.js
 * answers:  odpovědi { idOtázky: hodnota }
 * expect:   high | mid | low | notLow | notHigh
 * mustAsk / mustNotAsk: otázky, které se (ne)smí zobrazit
 */
module.exports = [
  { id: 'family-money+yes-ok', msg: 'family-money', answers: { familycheck: 'yes-ok', sender: 'known' }, expect: 'notLow',
    why: 'Potvrzená identita nesnižuje riziko žádosti o 18 500 Kč na účet.' },
  { id: 'family-money+yes-other', msg: 'family-money', answers: { familycheck: 'yes-other' }, expect: 'high',
    why: 'Blízký o ničem neví, je to podvod.' },
  { id: 'family-greet+yes-ok', msg: 'family-greet-only', answers: { familycheck: 'yes-ok' }, expect: 'low',
    why: 'Bez žádosti o peníze a s potvrzenou identitou nic nezůstává.' },
  { id: 'pkg-cyr+reassuring', msg: 'pkg-cyr', answers: { expect: 'yes', sender: 'known' }, expect: 'high',
    why: 'Falešný odkaz žádná odpověď nevyčistí.' },
  { id: 'bank-safe-acct+reassuring', msg: 'bank-safe-acct', answers: { sender: 'known', call: 'no' }, expect: 'high',
    why: 'Bezpečný účet a vzdálený přístup zůstávají vysoké riziko.' },
  { id: 'bank-code-ask+known', msg: 'bank-code-ask', answers: { sender: 'known' }, expect: 'notLow',
    why: 'Žádost o ověřovací kód zůstává varováním.' },
  { id: 'invest+reassuring', msg: 'invest-crypto', answers: { sender: 'known', call: 'no' }, expect: 'notLow',
    why: 'Garantovaný zisk zůstává varováním.' },
  { id: 'qr-parking+known', msg: 'qr-parking', answers: { sender: 'known' }, expect: 'notLow',
    why: 'Platba přes QR pod výhrůžkou pokuty zůstává varováním.' },
  { id: 'legit-incoming+unknown', msg: 'legit-incoming', answers: { sender: 'unknown' }, expect: 'low',
    why: 'Oznámení o příchozí platbě nic nechce, neznámý odesílatel ho nemá zvednout.' },
  { id: 'legit-ppl+expect', msg: 'legit-ppl', answers: { expect: 'yes', sender: 'known' }, expect: 'low',
    why: 'Očekávaná zásilka na oficiální doméně.' },
  { id: 'legit-ppl+notexpect', msg: 'legit-ppl', answers: { expect: 'no', sender: 'unknown' }, expect: 'notHigh',
    why: 'Nečekaná zásilka může být omyl, ale odkaz je oficiální.' },
  { id: 'legit-newnumber+known', msg: 'legit-newnumber', answers: { sender: 'known' }, expect: 'low',
    why: 'Známý člověk oznamuje nové číslo.' },
  { id: 'pkg-nolink+expect', msg: 'pkg-nolink', answers: { expect: 'yes', sender: 'known' }, expect: 'notLow',
    why: 'Požadavek na clo pod nátlakem zůstává varováním i u očekávané zásilky.' },

  // relevance otázek
  { id: 'q-alza-no-selling', msg: 'legit-alza', answers: {}, expect: 'notHigh', mustNotAsk: ['selling'],
    why: 'U objednávky z e-shopu nedává otázka na prodej na bazaru smysl.' },
  { id: 'q-pages-dev-no-selling', msg: 'pkg-pages-dev', answers: {}, expect: 'notLow', mustNotAsk: ['selling'],
    why: 'U zprávy o poštovném nedává otázka na bazar smysl.' },
  { id: 'q-vinted-selling', msg: 'bazar-vinted', answers: {}, expect: 'high', mustAsk: ['selling'],
    why: 'U bazarového podvodu je otázka na prodej klíčová.' },
  { id: 'q-family', msg: 'family-money', answers: {}, expect: 'high', mustAsk: ['familycheck'],
    why: 'U Ahoj mami se musí zeptat na ověření starého čísla.' }
];
