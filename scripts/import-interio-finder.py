#!/usr/bin/env python3
"""
import-interio-finder.py — import an "Interio Finder" HTML export into the app.

The Interio Finder (InterioFinder.WebApp) is a single HTML file that carries:
  • <script id="data">       — the price book (every product, MOP, scheme flags)
  • <script id="offers">     — the Bestfest & Sweetener offer list
  • <script id="visualData"> — the product catalogue (photos + F-A-B + sizes)
  • const VPMAP / BED_IDS     — catalogue → product links, the real-beds list

This script copies all of it into the app:
  • index.html + mobile-app/www/index.html
        <script id="4s-price-data">   ← price book (null fields dropped)
        <script id="4s-offer-data">   ← offers
        <script id="4s-finder-meta">  ← beds list
  • catalog/catalog.json            ← catalogue entries (no images) + VPMAP
  • catalog/img/NNN.jpg             ← one JPEG per catalogue entry (lazy-loaded)

Usage:  python3 scripts/import-interio-finder.py path/to/InterioFinder.html
Run from the repository root.
"""
import json, os, re, sys, base64

def main(src_path):
    src = open(src_path, encoding='utf-8').read()

    def block(i):
        m = re.search(r'<script id="%s" type="application/json">(.*?)</script>' % i, src, re.S)
        if not m: sys.exit('missing <script id="%s"> in %s' % (i, src_path))
        return json.loads(m.group(1))

    data, offers, visual = block('data'), block('offers'), block('visualData')
    m = re.search(r'const VPMAP\s*=\s*(\{.*?\});\s*\n', src, re.S)
    vpmap = json.loads(m.group(1)) if m else {}
    m = re.search(r'const BED_IDS\s*=\s*(\[.*?\]);', src)
    beds = json.loads(m.group(1)) if m else []

    # ── price book: drop empty fields to keep the bundled page small ─────────
    def compact(r):
        return {k: v for k, v in r.items() if v is not None and v is not False and v != ''}
    price = [compact(r) for r in data]
    assert all(r['id'] == i for i, r in enumerate(price)), 'ids must equal row index'

    # ── catalogue: images to files, metadata to JSON ─────────────────────────
    os.makedirs('catalog/img', exist_ok=True)
    for f in os.listdir('catalog/img'):
        if f.endswith('.jpg'): os.remove(os.path.join('catalog/img', f))
    entries = []
    for i, v in enumerate(visual):
        img = v.get('image') or ''
        name = ''
        mm = re.match(r'data:image/(jpeg|jpg|png|webp);base64,(.*)$', img, re.S)
        if mm:
            ext = 'jpg' if mm.group(1) in ('jpeg', 'jpg') else mm.group(1)
            name = '%03d.%s' % (i, ext)
            open(os.path.join('catalog/img', name), 'wb').write(base64.b64decode(mm.group(2)))
        e = {'room': v.get('room', ''), 'sub': v.get('subcategory', ''), 'name': v.get('name', ''), 'img': name}
        if v.get('sz'):  e['sz'] = v['sz']
        if v.get('fab'): e['fab'] = v['fab']
        entries.append(e)
    json.dump({'v': entries, 'map': vpmap}, open('catalog/catalog.json', 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))

    # ── embed into both app pages ─────────────────────────────────────────────
    j = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    blocks = {
        '4s-price-data':  j(price),
        '4s-offer-data':  j(offers),
        '4s-finder-meta': j({'beds': beds}),
    }
    for page in ('index.html', 'mobile-app/www/index.html'):
        html = open(page, encoding='utf-8').read()
        for bid, payload in blocks.items():
            tag = '<script id="%s" type="application/json">' % bid
            pat = re.compile(re.escape(tag) + r'.*?</script>', re.S)
            new = tag + payload + '</script>'
            if pat.search(html):
                html = pat.sub(lambda _: new, html, count=1)
            else:   # insert right after the price book block
                anchor = re.compile(r'(<script id="4s-price-data" type="application/json">.*?</script>)', re.S)
                html = anchor.sub(lambda mm: mm.group(1) + '\n' + new, html, count=1)
        open(page, 'w', encoding='utf-8').write(html)
        print('updated', page)
    print('%d products · %d offers · %d catalogue entries · %d beds' % (len(price), len(offers), len(entries), len(beds)))

if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    main(sys.argv[1])
