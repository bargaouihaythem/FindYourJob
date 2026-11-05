# -*- coding: utf-8 -*-
import zipfile, shutil, re, struct, os

SRC = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Bargaoui_Haythem_Corrige_New.docx'
DST = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
PNG = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\diagrammes_v2\png'

# media -> new png (None = keep original media, only re-place/resize)
FIG = {
    'image4.png':  'fig2_1.png',
    'image5.png':  'fig2_2.png',
    'image6.png':  'fig2_3.png',
    'image7.png':  'fig3_1.png',
    'image8.png':  'fig3_2.png',
    'image9.png':  'fig3_3.png',
    'image10.png': 'fig3_4.png',
    'image11.png': 'fig3_5.png',
    'image12.png': 'fig3_6.png',
    'image13.png': 'fig3_7.png',
    'image14.png': 'fig3_8.png',
    'image15.png': 'fig3_9.png',
    'image16.png': 'fig3_10.png',
    'image17.png': 'fig3_11.png',
}

# usable area in points (A4 minus 720twip=36pt margins, minus caption room)
USABLE = {'portrait': (523.0, 700.0), 'landscape': (760.0, 470.0)}

SECT = {
 'portrait':  '<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720"/></w:sectPr></w:pPr></w:p>',
 'landscape': '<w:p><w:pPr><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720"/></w:sectPr></w:pPr></w:p>',
}

def png_size(path):
    with open(path, 'rb') as f:
        d = f.read(33)
    return struct.unpack('>II', d[16:24])

zin = zipfile.ZipFile(SRC)
rels = zin.read('word/_rels/document.xml.rels').decode('utf-8', 'ignore')
relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
media2rel = {t.split('/')[-1]: r for r, t in relmap.items() if t.split('/')[-1] in FIG}

xml = zin.read('word/document.xml').decode('utf-8', 'ignore')

# ---- 1. drop intermediate orientation-flip sectPr (keep first & final) ----
spans = [m.span() for m in re.finditer(r'<w:sectPr\b.*?</w:sectPr>', xml, re.S)]
for (s, e) in reversed(spans[1:-1]):
    ps = xml.rfind('<w:p ', 0, s)
    pe = xml.find('</w:p>', s) + len('</w:p>')
    para = xml[ps:pe]
    inner = re.sub(r'<w:sectPr\b.*?</w:sectPr>', '', para, flags=re.S)
    has_content = ('<w:t' in inner and re.search(r'<w:t[^>]*>\s*\S', inner)) or 'v:imagedata' in inner
    xml = xml[:ps] + (inner if has_content else '') + xml[pe:]

# ---- 2. locate figures in order ----
newbytes = {}
aspects = {}
for media, rel in media2rel.items():
    src_png = os.path.join(PNG, FIG[media]) if FIG[media] else None
    if src_png:
        w, h = png_size(src_png)
        with open(src_png, 'rb') as f:
            newbytes['word/media/' + media] = f.read()
    else:
        import io
        w, h = png_size(io.BytesIO(zin.read('word/media/' + media)).getbuffer())
    aspects[rel] = h / w

order = []
for m in re.finditer(r'<v:imagedata[^>]*r:id="([^"]+)"', xml):
    rel = m.group(1)
    if rel in aspects:
        order.append((rel, m.start()))

def para_bounds(pos):
    s = xml.rfind('<w:p ', 0, pos)
    e = xml.find('</w:p>', pos) + len('</w:p>')
    return s, e

def fit(orient, a):
    W, H = USABLE[orient]
    w = W
    h = w * a
    if h > H:
        h = H
        w = h / a
    return w, h

def set_size(block, rel, orient):
    a = aspects[rel]
    w, h = fit(orient, a)
    sm = re.search(r'style="([^"]*)"', block)
    style = sm.group(1)
    style = re.sub(r'width:\s*[\d.]+pt', 'width:%.1fpt' % w, style)
    style = re.sub(r'height:\s*[\d.]+pt', 'height:%.1fpt' % h, style)
    return block.replace(sm.group(0), 'style="%s"' % style)

def has_text(a, b):
    seg = xml[a:b]
    for t in re.findall(r'<w:t[^>]*>(.*?)</w:t>', seg, re.S):
        if t.strip():
            return True
    return False

out = []
cur = 0
prev_cap_end = 0
for rel, pos in order:
    orient = 'landscape' if aspects[rel] <= 0.85 else 'portrait'
    is_, ie_ = para_bounds(pos)
    # caption paragraph = next paragraph starting with 'Figure'
    cs = ie_
    cap_end = ie_
    while True:
        ns = xml.find('<w:p ', cs)
        if ns == -1:
            break
        ne = xml.find('</w:p>', ns) + len('</w:p>')
        txt = ' '.join(re.sub(r'<[^>]+>', '', xml[ns:ne]).split())
        if txt[:6].lower() == 'figure':
            cap_end = ne
            break
        if txt:
            break
        cs = ne
    out.append(xml[cur:is_])
    if orient != 'portrait' and has_text(prev_cap_end, is_):
        out.append(SECT['portrait'])
    imgpara = xml[is_:ie_]
    imgpara = set_size(imgpara, rel, orient)
    out.append(imgpara)
    out.append(xml[ie_:cap_end])
    out.append(SECT[orient])
    cur = cap_end
    prev_cap_end = cap_end
out.append(xml[cur:])
xml = ''.join(out)

# ---- 3. collapse stray empty paragraphs (blank-page cause) ----
def empty_para(m):
    b = m.group(0)
    if 'v:imagedata' in b or '<w:sectPr' in b or '<w:br' in b:
        return b
    if re.search(r'<w:t[^>]*>\s*\S', b):
        return b
    return ''
xml = re.sub(r'<w:p><w:pPr><w:sectPr.*?</w:p>', lambda m: m.group(0), xml, flags=re.S)  # keep breaks
prev = None
while prev != xml:
    prev = xml
    xml = re.sub(r'(<w:p\b[^>]*>(?:(?!</w:p>).)*?</w:p>)\s*(<w:p><w:pPr><w:sectPr)', lambda m: m.group(2) if not re.search(r'<w:t[^>]*>\s*\S', m.group(1)) and 'v:imagedata' not in m.group(1) else m.group(0), xml, flags=re.S)

# ---- 4. Scrum methodology paragraph ----
SCRUM = ('<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t xml:space="preserve">Le projet a été conduit selon la méthodologie agile Scrum. Le travail a été découpé en sprints de deux semaines, chacun clos par une démonstration et une rétrospective avec l&#8217;encadrant. Les rôles (Product Owner, Scrum Master, équipe de développement), les cérémonies (planification de sprint, mêlée quotidienne, revue et rétrospective) et les artefacts (backlog de produit, backlog de sprint, incrément) ont structuré l&#8217;avancement et permis d&#8217;ajuster en continu le périmètre aux retours reçus.</w:t></w:r></w:p>')
m = re.search(r'<w:p\b[^>]*>(?:(?!</w:p>).)*?Méthodologie de travail adoptée.*?</w:p>', xml, re.S)
if m:
    # insert after the first non-empty paragraph following the heading
    nxt = xml.find('<w:p ', m.end())
    ne = xml.find('</w:p>', nxt) + len('</w:p>')
    xml = xml[:ne] + SCRUM + xml[ne:]
    print('scrum inserted')
else:
    print('scrum heading NOT FOUND')

# ---- 5. write ----
tmp = DST + '.tmp'
zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == 'word/document.xml':
        data = xml.encode('utf-8')
    elif item.filename in newbytes:
        data = newbytes[item.filename]
    zout.writestr(item, data)
zout.close()
zin.close()
os.replace(tmp, DST)
print('Wrote', DST, '| figures:', len(order), '| media replaced:', len(newbytes))
