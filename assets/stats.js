/* Anonymní počítání návštěv (Vercel Web Analytics).
 * Běží jen na protect.pebmedia.cz, ne lokálně ani v náhledech.
 * Bez cookies. Odesílá se jen adresa stránky bez části za # a z parametrů
 * jen "ref" (odkud člověk přišel). Text zpráv, obrázky ani výsledky kontrol se
 * do adresy nikdy nedostávají a nic z toho se neodesílá.
 */
(function () {
  if (location.hostname !== 'protect.pebmedia.cz') return;
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  window.va('beforeSend', function (event) {
    try {
      var u = new URL(event.url);
      var ref = u.searchParams.get('ref');
      var clean = u.origin + u.pathname + (ref ? '?ref=' + encodeURIComponent(ref.slice(0, 40)) : '');
      return Object.assign({}, event, { url: clean });
    } catch (e) {
      return null;
    }
  });
  var s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.appendChild(s);
})();
