/* Regresní testy kontroly e-mailu.
 * expect: high | mid | low | notLow | notHigh; codes: nálezy, které musí být uvedeny;
 * noCodes: nálezy, které se objevit nesmí (např. tvrzení o SPF bez hlaviček).
 */
module.exports = [
  { id: 'mail-bank-gmail', expect: 'high', codes: ['sender-brand-free'],
    why: 'Česká spořitelna podle jména, ale adresa na gmail.com a výzva k přihlášení.',
    email: { fromName: 'Česká spořitelna', fromAddr: 'ceska.sporitelna.cz@gmail.com', subject: 'Ověřte účet', body: 'Váš účet bude zablokován. Přihlaste se: https://csas-overeni.top' } },
  { id: 'mail-police-seznam', expect: 'notLow', codes: ['sender-inst-free'],
    why: 'Policie z bezplatné schránky a výhrůžka pokutou.',
    email: { fromName: 'Policie ČR', fromAddr: 'policie.cr@seznam.cz', subject: 'Předvolání', body: 'Dostavte se, jinak hrozí pokuta.' } },
  { id: 'mail-netflix-lookalike', expect: 'high', codes: ['sender-brand-fake'],
    why: 'Odesílací doména napodobuje Netflix.',
    email: { fromName: 'Netflix', fromAddr: 'info@netflix-billing.com', subject: 'Platba se nezdařila', body: 'Aktualizujte platební údaje.' } },
  { id: 'mail-name-mismatch', expect: 'notLow', codes: ['sender-mismatch'],
    why: 'Jméno PPL, adresa na neznámé doméně bez dalších triků.',
    email: { fromName: 'PPL CZ', fromAddr: 'notify@parcel-info.eu', subject: 'Zásilka', body: 'Vaše zásilka čeká na doručení.' } },
  { id: 'mail-headers-fail', expect: 'high', codes: ['reply-to', 'auth-fail'],
    why: 'Hlavičky uvádějí DMARC fail a odpovědi míří na jinou doménu.',
    email: { fromName: 'Jan', fromAddr: 'jan@firma.cz', subject: 'Faktura', body: 'Posílám fakturu.',
      headers: 'From: Jan <jan@firma.cz>\nReply-To: jan.firma@gmail.com\nAuthentication-Results: mx.seznam.cz; spf=fail smtp.mailfrom=firma.cz; dkim=none; dmarc=fail' } },
  { id: 'mail-headers-pass', expect: 'low', codes: ['auth-info'],
    why: 'Oficiální Seznam a hlavičky s pass. Úspěšné ověření se jen popíše, výsledek nezlepší.',
    email: { fromName: 'Seznam.cz', fromAddr: 'noreply@seznam.cz', subject: 'Nové přihlášení', body: 'Zaznamenali jsme nové přihlášení k vašemu účtu z prohlížeče Chrome.',
      headers: 'Authentication-Results: mx.seznam.cz; spf=pass; dkim=pass; dmarc=pass' } },
  { id: 'mail-no-headers', expect: 'low', noCodes: ['auth-info', 'auth-fail', 'reply-to'],
    why: 'Bez hlaviček nesmí aplikace nic tvrdit o SPF, DKIM ani DMARC.',
    email: { fromName: 'Alza.cz', fromAddr: 'info@alza.cz', subject: 'Vaše objednávka', body: 'Objednávka 123456 byla odeslána.' } },
  { id: 'mail-friend-gmail', expect: 'low',
    why: 'Kamarádka z gmailu, běžná zpráva. Bezplatná schránka sama o sobě nic neznamená.',
    email: { fromName: 'Jana Nováková', fromAddr: 'jana.novakova@gmail.com', subject: 'Sobota', body: 'Ahoj, v sobotu přijdu kolem šesté. Jana' } },
  { id: 'mail-headers-only', expect: 'high', codes: ['sender-brand-free'],
    why: 'Odesílatel se vezme z vložených hlaviček.',
    email: { headers: 'From: "Komerční banka" <kb.podpora@outlook.com>\nSubject: Blokace', body: 'Váš účet byl zablokován, ověřte se.' } },
  { id: 'mail-invalid-sender', expect: 'notLow', codes: ['sender-invalid'],
    why: 'Adresa odesílatele bez zavináče.',
    email: { fromName: 'Banka', fromAddr: 'banka-podpora', subject: 'Účet', body: 'Ověřte svůj účet.' } }
];
