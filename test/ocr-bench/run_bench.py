#!/usr/bin/env python3
"""Změří přesnost OCR (chybovost znaků v textu bubliny) pro různé nastavení.
Spuštění: python3 test/ocr-bench/run_bench.py [nastavení...]
"""
import json, os, subprocess, sys, time, unicodedata, re
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PORT = 8811
TRUTH = json.load(open(os.path.join(HERE, 'truth.json')))

def norm(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', s)).strip()

def semiglobal(t, o):
    # nejmenší editační vzdálenost pravdy t k libovolnému podřetězci výstupu o
    n, m = len(t), len(o)
    prev = [0] * (m + 1)
    for i in range(1, n + 1):
        cur = [i] + [0] * m
        ti = t[i - 1]
        for j in range(1, m + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ti != o[j - 1]))
        prev = cur
    return min(prev)

CZ = set('áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ')
def score(truth, out):
    t, o = norm(truth), norm(out)
    cer = semiglobal(t, o) / len(t)
    url = re.search(r'https?://\S+', t)
    url_ok = (url.group(0) in o.replace(' ', '')) if url else None
    return cer, url_ok

CONFIGS = {
 'legacy-cesEng': {'mode': 'legacy', 'lang': 'ces+eng', 'psm': 3},
 'contrast-cesEng': {'mode': 'contrast', 'lang': 'ces+eng', 'psm': 3},
 'contrast-ces': {'mode': 'contrast', 'lang': 'ces', 'psm': 3},
 'contrast-ces-psm6': {'mode': 'contrast', 'lang': 'ces', 'psm': 6},
 'contrast-ces-psm11': {'mode': 'contrast', 'lang': 'ces', 'psm': 11},
 'legacy-ces': {'mode': 'legacy', 'lang': 'ces', 'psm': 3},
 'legacy-ces-psm4': {'mode': 'legacy', 'lang': 'ces', 'psm': 4},
 'legacy-ces-psm6': {'mode': 'legacy', 'lang': 'ces', 'psm': 6},
 'legacy-cesEng-psm4': {'mode': 'legacy', 'lang': 'ces+eng', 'psm': 4},
 'legacy-cesEng-psm6': {'mode': 'legacy', 'lang': 'ces+eng', 'psm': 6},
 'gray-ces-psm6': {'mode': 'gray', 'lang': 'ces', 'psm': 6},
 'gray-cesEng-psm6': {'mode': 'gray', 'lang': 'ces+eng', 'psm': 6},
 'legacy-engCes-psm6': {'mode': 'legacy', 'lang': 'eng+ces', 'psm': 6},
 'gray-ces': {'mode': 'gray', 'lang': 'ces', 'psm': 3},
 'gray-ces-psm4': {'mode': 'gray', 'lang': 'ces', 'psm': 4},
 'gray-cesEng': {'mode': 'gray', 'lang': 'ces+eng', 'psm': 3},
}

def main(names):
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'test', 'browser', 'serve.py'), str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2.5)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page()
            pg.goto('http://127.0.0.1:%d/test/ocr-bench/bench.html' % PORT)
            pg.wait_for_function('window.runOcr && window.PPOcrPrep')
            for name in names:
                cfg = CONFIGS[name]
                cers, urls, ms, worst = [], [], 0, []
                only = os.environ.get('ONLY', '').split(',') if os.environ.get('ONLY') else None
                for fn, truth in TRUTH.items():
                    if only and fn not in only: continue
                    r = pg.evaluate('([s,c]) => runOcr(s,c)', ['screens/' + fn, cfg])
                    if os.environ.get('SHOW'):
                        print('==', fn, 'conf', round(r['conf'])); print('  PRAVDA:', truth); print('  OCR   :', ' '.join(r['text'].split()), flush=True)
                    cer, url_ok = score(truth, r['text'])
                    cers.append(cer); ms += r['ms']
                    if url_ok is not None: urls.append(url_ok)
                    if url_ok is False and os.environ.get('URLS'): print('   URL chyba', fn, '|', ' '.join(r['text'].split())[-90:], flush=True)
                    worst.append((cer, fn))
                worst.sort(reverse=True)
                print('%-20s CER prumer %.2f %%  median %.2f %%  URL ok %d/%d  cas %.1f s  nejhorsi: %s' % (
                    name, 100 * sum(cers) / len(cers), 100 * sorted(cers)[len(cers) // 2], sum(urls), len(urls), ms / 1000,
                    ', '.join('%s %.0f%%' % (f, 100 * c) for c, f in worst[:3])), flush=True)
            b.close()
    finally:
        srv.terminate()

main(sys.argv[1:] or list(CONFIGS))
