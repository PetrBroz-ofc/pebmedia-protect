/* PEBMedia Protect: smazání dat, která si nástroj uložil v tomto prohlížeči. */
(function () {
  'use strict';
  var btn = document.getElementById('clear-storage');
  var msg = document.getElementById('clear-msg');
  if (!btn) return;
  btn.addEventListener('click', function () {
    try { localStorage.removeItem('pp-training-seen'); } catch (e) { /* úložiště nedostupné */ }
    var done = function () { msg.textContent = 'Hotovo, data z tohoto prohlížeče jsou smazaná.'; };
    try {
      if (window.indexedDB) {
        var req = indexedDB.deleteDatabase('keyval-store');
        req.onsuccess = req.onerror = req.onblocked = done;
      } else done();
    } catch (e) { done(); }
  });
})();
