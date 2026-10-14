/* Měření kvality OCR na snímcích v screens/. Ovládá ho run_bench.py přes Playwright. */
(function () {
  'use strict';
  var BASE = new URL('../../assets/ocr/', document.baseURI).href;
  var workers = {};
  async function worker(lang) {
    if (workers[lang]) return workers[lang];
    var w = await Tesseract.createWorker(lang, 1, { workerPath: BASE + 'worker.min.js', corePath: BASE, langPath: BASE + 'lang', workerBlobURL: false });
    workers[lang] = w;
    return w;
  }
  function load(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  window.runOcr = async function (src, cfg) {
    var img = await load(src);
    var c = PPOcrPrep.prepareCanvas(img, cfg.mode);
    var w = await worker(cfg.lang);
    await w.setParameters(Object.assign({ tessedit_pageseg_mode: String(cfg.psm || 3), user_defined_dpi: '300', preserve_interword_spaces: '1' }, cfg.params || {}));
    var t0 = performance.now();
    var r = await w.recognize(c);
    return { text: r.data.text, conf: r.data.confidence, ms: Math.round(performance.now() - t0), size: [c.width, c.height] };
  };
})();
