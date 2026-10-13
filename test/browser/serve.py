#!/usr/bin/env python3
"""Lokální server pro testy v prohlížeči.

Posílá stejné bezpečnostní hlavičky jako Vercel podle vercel.json,
aby šlo ověřit CSP proti skutečnému běhu OCR, workeru a WASM.
Spuštění: python3 test/browser/serve.py [port]
"""
import json, os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CONF = json.load(open(os.path.join(ROOT, 'vercel.json'), encoding='utf-8'))


def vercel_source_to_regex(src):
    # Vercel "source" používá path-to-regexp; pro naše vzory stačí převod (.*) a escapování
    return '^' + src + '$'


RULES = [(re.compile(vercel_source_to_regex(h['source'])), h['headers']) for h in CONF.get('headers', [])]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        path = self.path.split('?')[0]
        for rx, headers in RULES:
            if rx.match(path):
                for h in headers:
                    self.send_header(h['key'], h['value'])
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.gz'):
            return 'application/octet-stream'
        if path.endswith('.js'):
            return 'text/javascript'
        if path.endswith('.webp'):
            return 'image/webp'
        if path.endswith('.woff2'):
            return 'font/woff2'
        return super().guess_type(path)

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
