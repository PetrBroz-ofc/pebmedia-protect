/* PEBMedia Protect: sestavení podkladů pro oznámení Policii ČR.
 * Čistá funkce bez DOM: vstup jsou údaje z formuláře, výstup je text. Nic neodesílá.
 *
 * Náležitosti podle https://policie.gov.cz/trestni-oznameni-odkaz (ověřeno 13. 10. 2026):
 * adresát, identita oznamovatele, popis skutku, kdy, kde a jak, údaje o podezřelém,
 * důkazní prostředky, výše škody, nárok na náhradu škody.
 * Adresy podatelen podle https://policie.gov.cz/e-podatelna (ověřeno 13. 10. 2026).
 */
(function (root) {
  'use strict';

  var REGIONS = {
    krpa: { name: 'Hlavní město Praha', office: 'Krajské ředitelství policie hl. m. Prahy' },
    krps: { name: 'Středočeský kraj', office: 'Krajské ředitelství policie Středočeského kraje' },
    krpc: { name: 'Jihočeský kraj', office: 'Krajské ředitelství policie Jihočeského kraje' },
    krpp: { name: 'Plzeňský kraj', office: 'Krajské ředitelství policie Plzeňského kraje' },
    krpk: { name: 'Karlovarský kraj', office: 'Krajské ředitelství policie Karlovarského kraje' },
    krpu: { name: 'Ústecký kraj', office: 'Krajské ředitelství policie Ústeckého kraje' },
    krpl: { name: 'Liberecký kraj', office: 'Krajské ředitelství policie Libereckého kraje' },
    krph: { name: 'Královéhradecký kraj', office: 'Krajské ředitelství policie Královéhradeckého kraje' },
    krpe: { name: 'Pardubický kraj', office: 'Krajské ředitelství policie Pardubického kraje' },
    krpj: { name: 'Kraj Vysočina', office: 'Krajské ředitelství policie kraje Vysočina' },
    krpb: { name: 'Jihomoravský kraj', office: 'Krajské ředitelství policie Jihomoravského kraje' },
    krpm: { name: 'Olomoucký kraj', office: 'Krajské ředitelství policie Olomouckého kraje' },
    krpz: { name: 'Zlínský kraj', office: 'Krajské ředitelství policie Zlínského kraje' },
    krpt: { name: 'Moravskoslezský kraj', office: 'Krajské ředitelství policie Moravskoslezského kraje' }
  };

  // Do e-mailu vkládáme text jen do této délky. Delší text by některé e-mailové aplikace
  // tiše ořízly, proto ho uživatel zkopíruje sám.
  var MAILTO_BODY_LIMIT = 1500;

  function clean(v) { return String(v == null ? '' : v).trim(); }
  function fmtDate(d) {
    return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
  }

  function build(data) {
    data = data || {};
    var region = clean(data.region);
    if (!REGIONS[region]) return { error: 'region' };
    var kind = data.kind === 'loss' ? 'loss' : 'attempt';
    var ev = data.evidence || {};
    var L = [];

    L.push('Policie České republiky');
    L.push(REGIONS[region].office);
    L.push('');
    L.push('Věc: Oznámení o ' + (kind === 'loss' ? 'podvodu' : 'pokusu o podvod'));
    L.push('');

    L.push('Oznamovatel');
    var name = clean(data.name), born = clean(data.born), addr = clean(data.address), contact = clean(data.contact);
    if (name || born || addr || contact) {
      L.push('Jméno a příjmení: ' + (name || 'neuvedeno'));
      L.push('Datum narození: ' + (born || 'neuvedeno'));
      L.push('Bydliště: ' + (addr || 'neuvedeno'));
      if (contact) L.push('Kontakt: ' + contact);
    } else {
      L.push('Oznámení podávám anonymně.');
    }
    L.push('');

    L.push('Co se stalo');
    L.push('Kdy: ' + (clean(data.when) || 'neuvedeno'));
    L.push('Jak mě kontaktovali: ' + (clean(data.channel) || 'neuvedeno'));
    if (clean(data.from)) L.push('Číslo nebo adresa odesílatele: ' + clean(data.from));
    if (clean(data.link)) L.push('Odkaz ve zprávě: ' + clean(data.link));
    if (clean(data.desc)) { L.push(''); L.push(clean(data.desc)); }
    var actions = (data.actions || []).map(clean).filter(Boolean);
    if (actions.length) { L.push(''); actions.forEach(function (a) { L.push('• ' + a); }); }
    L.push('');

    L.push('Škoda');
    if (kind === 'loss') {
      L.push('Výše škody: ' + (clean(data.amount) || 'zatím neupřesněna'));
      if (clean(data.account)) L.push('Peníze odešly na účet: ' + clean(data.account));
      L.push(data.claim ? 'Žádám, aby soud rozhodl o mém nároku na náhradu škody.' : 'O náhradě škody se zatím nevyjadřuji.');
    } else {
      L.push('Škoda mi nevznikla, šlo o pokus. Oznamuji ho, aby se mohl prověřit.');
    }
    L.push('');

    var evid = [];
    if (ev.screens) evid.push('snímky obrazovky zpráv');
    if (ev.payment) evid.push('potvrzení o platbě nebo výpis z účtu');
    if (ev.message) evid.push('původní zprávu v telefonu nebo v e-mailu');
    L.push('Důkazy');
    L.push(evid.length ? 'Mám k dispozici ' + evid.join(', ') + ' a na vyžádání je předložím.' : 'Důkazy doplním na vyžádání.');
    if (clean(data.msg)) { L.push(''); L.push('Text zprávy, jak mi přišla:'); L.push('„' + clean(data.msg) + '“'); }
    L.push('');

    var created = data.createdAt instanceof Date ? data.createdAt : new Date();
    L.push('Sepsáno dne ' + fmtDate(created) + (name ? ', ' + name : ''));

    var text = L.filter(function (line, i, arr) { return !(line === '' && arr[i - 1] === ''); }).join('\n');
    return {
      text: text,
      subject: kind === 'loss' ? 'Oznámení o podvodu' : 'Oznámení o pokusu o podvod',
      address: region + '.podatelna@policie.gov.cz',
      office: REGIONS[region].office
    };
  }

  // Odkaz do e-mailu. Dlouhý text do něj nevkládáme, aby se tiše nezkrátil.
  function mailto(address, subject, text) {
    var includesBody = String(text || '').length <= MAILTO_BODY_LIMIT;
    var href = 'mailto:' + address + '?subject=' + encodeURIComponent(subject) +
      (includesBody ? '&body=' + encodeURIComponent(text) : '');
    return { href: href, includesBody: includesBody };
  }

  var api = { build: build, mailto: mailto, REGIONS: REGIONS, MAILTO_BODY_LIMIT: MAILTO_BODY_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PPReport = api;
})(typeof window !== 'undefined' ? window : this);
