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
# portrait usable area in points (A4, 720-twip side margins, room for caption)
W_MAX, H_MAX = 450.0, 610.0

def png_size(path):
    with open(path, 'rb') as f:
        d = f.read(33)
    return struct.unpack('>II', d[16:24])

zin = zipfile.ZipFile(SRC)
rels = zin.read('word/_rels/document.xml.rels').decode('utf-8', 'ignore')
relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
media2rel = {t.split('/')[-1]: r for r, t in relmap.items() if t.split('/')[-1] in FIG}
xml = zin.read('word/document.xml').decode('utf-8', 'ignore')

# remove intermediate orientation-flip section breaks -> single clean portrait flow
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

def add_ppr_elem(block, elem):
    m = re.search(r'<w:pPr>(.*?)</w:pPr>', block, re.S)
    if m:
        if elem in m.group(1):
            return block
        return block.replace(m.group(0), '<w:pPr>' + elem + m.group(1) + '</w:pPr>', 1)
    om = re.search(r'<w:p\b[^>]*>', block)
    return block.replace(om.group(0), om.group(0) + '<w:pPr>' + elem + '</w:pPr>', 1)

edits = []
for rel, pos in order:
    is_, ie_ = para_bounds(pos)
    a = aspects[rel]
    w = W_MAX; h = w * a
    if h > H_MAX:
        h = H_MAX; w = h / a
    img = xml[is_:ie_]
    sm = re.search(r'style="([^"]*)"', img)
    st = re.sub(r'width:\s*[\d.]+pt', 'width:%.1fpt' % w, sm.group(1))
    st = re.sub(r'height:\s*[\d.]+pt', 'height:%.1fpt' % h, st)
    img = img.replace(sm.group(0), 'style="%s"' % st)
    img = add_ppr_elem(img, '<w:pageBreakBefore/>')
    img = add_ppr_elem(img, '<w:keepNext/>')
    edits.append((is_, ie_, img))

for s, e, rep in sorted(edits, key=lambda t: t[0], reverse=True):
    xml = xml[:s] + rep + xml[e:]

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
print('Wrote', DST, '| figures:', len(order))
