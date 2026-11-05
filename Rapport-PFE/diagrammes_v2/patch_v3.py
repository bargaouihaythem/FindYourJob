# -*- coding: utf-8 -*-
import zipfile, re, struct, os

SRC = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Bargaoui_Haythem_Corrige_New.docx'
DST = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
PNG = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\diagrammes_v2\png'

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
USABLE = {'portrait': (523.0, 700.0), 'landscape': (760.0, 470.0)}
SECTPR = {
 'portrait':  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>',
 'landscape': '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>',
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

# drop intermediate orientation-flip sectPr (keep first front-matter & final body)
spans = [m.span() for m in re.finditer(r'<w:sectPr\b.*?</w:sectPr>', xml, re.S)]
for (s, e) in reversed(spans[1:-1]):
    ps = xml.rfind('<w:p ', 0, s)
    pe = xml.find('</w:p>', s) + len('</w:p>')
    para = xml[ps:pe]
    inner = re.sub(r'<w:sectPr\b.*?</w:sectPr>', '', para, flags=re.S)
    has_content = re.search(r'<w:t[^>]*>\s*\S', inner) or 'v:imagedata' in inner
    xml = xml[:ps] + (inner if has_content else '') + xml[pe:]

newbytes, aspects = {}, {}
for media, rel in media2rel.items():
    w, h = png_size(os.path.join(PNG, FIG[media]))
    with open(os.path.join(PNG, FIG[media]), 'rb') as f:
        newbytes['word/media/' + media] = f.read()
    aspects[rel] = h / w

order = [(m.group(1), m.start()) for m in re.finditer(r'<v:imagedata[^>]*r:id="([^"]+)"', xml) if m.group(1) in aspects]

def para_bounds(pos):
    s = xml.rfind('<w:p ', 0, pos)
    e = xml.find('</w:p>', pos) + len('</w:p>')
    return s, e

def fit(orient, a):
    W, H = USABLE[orient]
    w = W; h = w * a
    if h > H:
        h = H; w = h / a
    return w, h

def add_ppr_elem(block, elem, append=False):
    m = re.search(r'<w:pPr>(.*?)</w:pPr>', block, re.S)
    if m:
        if elem.split(':')[0].strip('<') in m.group(1):
            return block
        if append:
            new = '<w:pPr>' + m.group(1) + elem + '</w:pPr>'
        else:
            new = '<w:pPr>' + elem + m.group(1) + '</w:pPr>'
        return block.replace(m.group(0), new, 1)
    om = re.search(r'<w:p\b[^>]*>', block)
    return block.replace(om.group(0), om.group(0) + '<w:pPr>' + elem + '</w:pPr>', 1)

edits = []  # (start,end,replacement)
for rel, pos in order:
    orient = 'landscape' if aspects[rel] <= 0.85 else 'portrait'
    is_, ie_ = para_bounds(pos)
    cs = ie_; cap_end = ie_
    while True:
        ns = xml.find('<w:p ', cs)
        if ns == -1: break
        ne = xml.find('</w:p>', ns) + len('</w:p>')
        txt = ' '.join(re.sub(r'<[^>]+>', '', xml[ns:ne]).split())
        if txt[:6].lower() == 'figure':
            cap_end = ne; break
        if txt: break
        cs = ne
    # image paragraph: size + pageBreakBefore + keepNext
    img = xml[is_:ie_]
    w, h = fit(orient, aspects[rel])
    sm = re.search(r'style="([^"]*)"', img)
    st = re.sub(r'width:\s*[\d.]+pt', 'width:%.1fpt' % w, sm.group(1))
    st = re.sub(r'height:\s*[\d.]+pt', 'height:%.1fpt' % h, st)
    img = img.replace(sm.group(0), 'style="%s"' % st)
    img = add_ppr_elem(img, '<w:pageBreakBefore/>')
    if '<w:keepNext/' not in img:
        img = add_ppr_elem(img, '<w:keepNext/>')
    edits.append((is_, ie_, img))
    # caption paragraph: close figure section with its orientation
    cap = xml[cap_end and (xml.rfind('<w:p ', 0, cap_end)):cap_end]
    caps = xml.rfind('<w:p ', 0, cap_end)
    cap = xml[caps:cap_end]
    cap = add_ppr_elem(cap, SECTPR[orient], append=True)
    edits.append((caps, cap_end, cap))
    # preceding paragraph: close previous text section as portrait (only for landscape figures)
    if orient == 'landscape':
        pe = xml.rfind('</w:p>', 0, is_)
        ps = xml.rfind('<w:p ', 0, pe)
        prev = xml[ps:pe]
        if '<w:sectPr' not in prev:
            prev = add_ppr_elem(prev, SECTPR['portrait'], append=True)
            edits.append((ps, pe, prev))

for s, e, rep in sorted(edits, reverse=True):
    xml = xml[:s] + rep + xml[e:]

# Scrum paragraph after methodology heading
SCRUM = ('<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t xml:space="preserve">Le projet a été conduit selon la méthodologie agile Scrum. Le travail a été découpé en sprints de deux semaines, chacun clos par une démonstration et une rétrospective avec l&#8217;encadrant. Les rôles (Product Owner, Scrum Master, équipe de développement), les cérémonies (planification de sprint, mêlée quotidienne, revue et rétrospective) et les artefacts (backlog de produit, backlog de sprint, incrément) ont structuré l&#8217;avancement et permis d&#8217;ajuster en continu le périmètre aux retours reçus.</w:t></w:r></w:p>')
m = re.search(r'<w:p\b[^>]*>(?:(?!</w:p>).)*?Méthodologie de travail adoptée.*?</w:p>', xml, re.S)
if m:
    nxt = xml.find('<w:p ', m.end())
    ne = xml.find('</w:p>', nxt) + len('</w:p>')
    xml = xml[:ne] + SCRUM + xml[ne:]
    print('scrum inserted')

tmp = DST + '.tmp'
zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == 'word/document.xml':
        data = xml.encode('utf-8')
    elif item.filename in newbytes:
        data = newbytes[item.filename]
    zout.writestr(item, data)
zout.close(); zin.close()
os.replace(tmp, DST)
print('Wrote', DST, '| figures:', len(order), '| edits:', len(edits))
