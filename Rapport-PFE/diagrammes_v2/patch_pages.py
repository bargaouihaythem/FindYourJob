# -*- coding: utf-8 -*-
"""Recompute the static TOC/LOF/LOT page numbers of the beta docx from its PDF."""
import zipfile, re, sys, os, fitz, html

DOCX = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
PDF = r'C:\Users\hbargaoui\AppData\Local\Temp\beta_work.pdf'
DRY = '--apply' not in sys.argv

def arg(name, default):
    for a in sys.argv:
        if a.startswith('--%s=' % name):
            return a.split('=', 1)[1]
    return default

DOCX = arg('docx', DOCX)
PDF = arg('pdf', PDF)

def norm(s):
    return re.sub(r'\s+', ' ', s.replace('\u00a0', ' ')).strip()

zin = zipfile.ZipFile(DOCX)
xml = zin.read('word/document.xml').decode('utf-8')

P_RE = re.compile(r'<w:p(?:\s[^>]*)?/>|<w:p(?:\s[^>]*)?>.*?</w:p>', re.S)
entries = []
for m in P_RE.finditer(xml):
    b = m.group(0)
    if 'leader="dot"' not in b:
        continue
    ts = re.findall(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', b, re.S)
    if len(ts) < 2:
        continue
    title = norm(html.unescape(''.join(ts[:-1])))
    entries.append({'title': title, 'num': ts[-1], 's': m.start(), 'e': m.end(), 'b': b})

doc = fitz.open(PDF)
pages, list_pages = [], set()
for p in range(len(doc)):
    lines = [norm(l) for l in doc[p].get_text().split('\n') if l.strip()]
    pages.append(lines)
    dotted = [l for l in lines if re.search(r'\.{4,}\s*\d*\s*$', l)]
    if len(dotted) >= 5:
        list_pages.add(p)

exact = fallback = missed = 0
for en in entries:
    hit = None
    cands = [p + 1 for p in range(len(pages)) if en['title'] in pages[p]]
    pref = [p for p in cands if p - 1 not in list_pages]
    if pref:
        hit = pref[0]
    elif cands:
        hit = cands[0]
    if hit:
        exact += 1
    else:
        for p in range(len(pages)):
            if p in list_pages:
                continue
            for cut in (45, 30, 20):
                if doc[p].search_for(en['title'][:cut]):
                    hit = p + 1
                    break
            if hit:
                break
        if hit:
            fallback += 1
        else:
            missed += 1
            print('UNMATCHED:', repr(en['title'][:70]))
    en['page'] = hit

print('entries %d | exact %d | fallback %d | unmatched %d' % (len(entries), exact, fallback, missed))

if missed:
    print('aborting: unmatched entries')
    sys.exit(1)

out = xml
for en in sorted(entries, key=lambda x: x['s'], reverse=True):
    b = en['b']
    ts = list(re.finditer(r'<w:t(?:\s[^>]*)?>.*?</w:t>', b, re.S))
    nb = b[:ts[-1].start()] + '<w:t>%d</w:t>' % en['page'] + b[ts[-1].end():]
    out = out[:en['s']] + nb + out[en['e']:]

changed = sum(1 for en in entries if en['num'] != str(en['page']))
print('numbers changed: %d' % changed)
for en in entries:
    if en['num'] != str(en['page']):
        print('   %-72s %s -> %d' % (en['title'][:72], en['num'], en['page']))

if DRY:
    print('DRY RUN')
    sys.exit(0)

tmp = DOCX + '.tmp'
zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == 'word/document.xml':
        data = out.encode('utf-8')
    zout.writestr(item, data)
zout.close(); zin.close()
os.replace(tmp, DOCX)
print('Wrote', DOCX)
