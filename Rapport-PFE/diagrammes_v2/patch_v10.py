import zipfile, re, shutil, os

SRC = 'sesame/Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
TMP = SRC + '.tmp'
PNG = 'diagrammes_v2/png/uc_macro.png'

P_RE = re.compile(r'<w:p(?:\s[^>]*)?/>|<w:p(?:\s[^>]*)?>.*?</w:p>', re.S)

z = zipfile.ZipFile(SRC)
names = z.namelist()
doc = z.read('word/document.xml').decode('utf-8')
img = open(PNG, 'rb').read()

# 1) resize Fig 2.2 VML shape (rId43) to portrait width 453pt, aspect 1054/997
m = re.search(r'<v:shape\b[^>]*style="width:250\.6pt;height:600\.0pt;[^"]*"[^>]*>\s*<v:imagedata r:id="rId43"', doc)
assert m, 'shape rId43 not found'
doc = doc[:m.start()] + m.group(0).replace('width:250.6pt;height:600.0pt', 'width:453pt;height:478.8pt') + doc[m.end():]

# 2) insert transversal-auth paragraph after body caption "Figure 2.2 ..."
blocks = []
pos = 0
ms = list(P_RE.finditer(doc))
for k, mm in enumerate(ms):
    nxt = ms[k + 1].start() if k + 1 < len(ms) else len(doc)
    blocks.append(doc[mm.start():nxt])
pre = doc[:ms[0].start()]

i_cap = None
for i, b in enumerate(blocks):
    if 'Figure 2.2' in b and 'leader="dot"' not in b and 'Diagramme de cas d' in b:
        i_cap = i
assert i_cap is not None, 'caption 2.2 not found'

# template pPr from the following interpretation paragraph
mnext = re.search(r'<w:pPr>.*?</w:pPr>', blocks[i_cap + 1], re.S)
ppr = mnext.group(0) if mnext else '<w:pPr><w:jc w:val="both"/></w:pPr>'
# caption keeps with-next; strip keepNext/pageBreakBefore from copied pPr
ppr_body = re.sub(r'<w:keepNext/>|<w:pageBreakBefore/>', '', ppr)

TEXT = ("L'authentification constitue une fonctionnalité transversale de la plateforme : le cas d'utilisation "
        "« S'authentifier » est commun au Candidat, au Responsable RH, au Manager et à l'Administrateur, qui "
        "doivent s'identifier avant d'accéder à leur espace sécurisé. Les fonctionnalités des espaces internes "
        "nécessitent donc une authentification préalable ; seules la consultation et la recherche des offres ainsi "
        "que les suggestions « Job idéal » demeurent accessibles au visiteur non authentifié. Les autorisations "
        "sont ensuite contrôlées côté serveur selon le rôle et le périmètre métier de l'utilisateur.")

def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

newp = ('<w:p>' + ppr_body + '<w:r><w:t xml:space="preserve">' + esc(TEXT) + '</w:t></w:r></w:p>')
blocks.insert(i_cap + 1, newp)

doc = pre + ''.join(blocks)

import xml.etree.ElementTree as ET
ET.fromstring(doc.encode('utf-8'))

zin = zipfile.ZipFile(SRC)
zout = zipfile.ZipFile(TMP, 'w', zipfile.ZIP_DEFLATED)
for n in names:
    if n == 'word/document.xml':
        zout.writestr(n, doc.encode('utf-8'))
    elif n == 'word/media/image33.png':
        zout.writestr(n, img)
    else:
        zout.writestr(n, zin.read(n))
zout.close()
zin.close()
print('OK tmp written; caption block idx', i_cap)
