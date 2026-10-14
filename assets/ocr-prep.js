/* PEBMedia Protect: příprava obrázku před čtením textu (OCR).
 * Běží jen v prohlížeči, obrázek nikam neodchází.
 *
 * Režim 'contrast' (pokusný, v měření vyšel hůř):
 * 1) Zvětšení tak, aby písmo mělo pro čtečku dost pixelů (malé snímky až 3x).
 * 2) Odstíny šedi.
 * 3) Odhad místního pozadí (průměr okolí) a zvýraznění všeho, co se od pozadí liší.
 *    Text je pak tmavý na bílém v jakékoli bublině: šedé, modré, zelené i v tmavém režimu,
 *    i když se na jednom snímku mísí tmavé a světlé části.
 * Režim 'basic' (používá aplikace): zvětšení malých snímků 2x, odstíny šedi, převrácení tmavého režimu.
 * Podle měření v test/ocr-bench dává s češtinou a režimem stránky 6 nejmenší chybovost.
 */
(function (root) {
  'use strict';

  function toGray(px, n) {
    var g = new Float32Array(n);
    for (var i = 0, j = 0; j < n; i += 4, j++) g[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    return g;
  }

  // Průměr v okně (2r+1)x(2r+1) přes integrální obraz, O(n).
  function boxMean(g, w, h, r) {
    var I = new Float64Array((w + 1) * (h + 1));
    for (var y = 0; y < h; y++) {
      var row = 0;
      for (var x = 0; x < w; x++) {
        row += g[y * w + x];
        I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
      }
    }
    var out = new Float32Array(w * h);
    for (var yy = 0; yy < h; yy++) {
      var y0 = Math.max(0, yy - r), y1 = Math.min(h, yy + r + 1);
      for (var xx = 0; xx < w; xx++) {
        var x0 = Math.max(0, xx - r), x1 = Math.min(w, xx + r + 1);
        var s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
        out[yy * w + xx] = s / ((x1 - x0) * (y1 - y0));
      }
    }
    return out;
  }

  function scaleFor(w, mode) {
    if (mode === 'basic' || mode === 'legacy') return w < 1000 ? 2 : 1;
    // Cíl: šířka kolem 1600 až 2400 px. Snímky z telefonu (1080 až 1290 px) zvětšíme 1,5x až 2x, malé až 3x.
    var s = 2000 / w;
    return Math.max(1, Math.min(3, s));
  }

  function prepareCanvas(img, mode) {
    mode = mode || 'basic';
    var w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    var scale = scaleFor(w0, mode);
    // Pojistka proti obřím snímkům (dlouhé screenshoty): max. 12 milionů pixelů.
    var maxPx = 12e6;
    if (w0 * scale * h0 * scale > maxPx) scale = Math.sqrt(maxPx / (w0 * h0));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * scale)); c.height = Math.max(1, Math.round(h0 * scale));
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    var w = c.width, h = c.height, n = w * h;
    var d = ctx.getImageData(0, 0, w, h), px = d.data;
    var g = toGray(px, n), i;

    if (mode === 'basic' || mode === 'legacy' || mode === 'gray') {
      var sum = 0;
      for (i = 0; i < n; i++) sum += g[i];
      var inv = sum / n < 110;
      for (i = 0; i < n; i++) { var v = inv ? 255 - g[i] : g[i]; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; }
      ctx.putImageData(d, 0, 0);
      return c;
    }

    // Okno pro pozadí zhruba 3x větší než výška písma; písmo odhadujeme z šířky snímku.
    var r = Math.max(8, Math.round(w / 45));
    var bg = boxMean(g, w, h, r);
    // Kontrast vůči pozadí; zesílení volíme tak, aby běžný text vyšel téměř černý.
    var gain = 2.2;
    for (i = 0; i < n; i++) {
      var diff = Math.abs(g[i] - bg[i]) * gain;
      var o = 255 - (diff > 255 ? 255 : diff);
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = o;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  }

  var api = { prepareCanvas: prepareCanvas, scaleFor: scaleFor };
  root.PPOcrPrep = api;
})(typeof window !== 'undefined' ? window : this);
