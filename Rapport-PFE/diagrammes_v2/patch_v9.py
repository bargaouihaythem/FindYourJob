# -*- coding: utf-8 -*-
"""patch_v9 : split Fig 3.2 into 3.2a/3.2b and put Fig 3.9 (BDD) on a landscape page.
- overwrite media/image8.png  = fig3_2a.png  (classes recrutement)
- overwrite media/image14.png = fig3_8w.png  (BDD large)
- add      media/image38.png = fig3_2b.png  (classes utilisateurs/securite) + rId48
Writes to <docx>.tmp (manual mv because of OneDrive lock)."""
import zipfile, re, os, struct
import xml.etree.ElementTree as ET

BASE = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE'
DOCX = BASE + r'\sesame\Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
PNG = BASE + r'\diagrammes_v2\png' + '\\'
NB = '\xa0'

SECT_PORTRAIT = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1140" w:bottom="1417" w:left="1700" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
SECT_LAND = '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="900" w:left="720" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'

PORTRAIT_W = 453.0
LAND_W = 714.0

def dims(fn):
    d = open(PNG + fn, 'rb').read()
    w, h = struct.unpack('>II', d[16:24])
    return w, h

def fit(fn, wmax):
    w, h = dims(fn)
    return wmax, wmax * h / w

zin = zipfile.ZipFile(DOCX)
xml = zin.read('word/document.xml').decode('utf-8')
rels = zin.read('word/_rels/document.xml.rels').decode('utf-8')

P_RE = re.compile(r'<w:p(?:\s[^>]*)?/>|<w:p(?:\s[^>]*)?>.*?</w:p>', re.S)
T_RE = re.compile(r'<w:t(?:\s[^>]*)?>.*?</w:t>', re.S)
ms = list(P_RE.finditer(xml))
pre = xml[:ms[0].start()]
blocks = []
for i, m in enumerate(ms):
    end = ms[i + 1].start() if i + 1 < len(ms) else len(xml)
    blocks.append(xml[m.start():end])

def nrm(s):
    return s.replace('\xa0', ' ')

def txt(b):
    return re.sub(r'\s+', ' ', nrm(''.join(re.findall(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', b, re.S))))

def find(marker, skip_dot=True):
    for i, b in enumerate(blocks):
        if skip_dot and 'leader="dot"' in b:
            continue
        if marker in txt(b):
            return i
    raise SystemExit('introuvable : ' + marker)

def set_title_keep_page(b, text):
    """TOC/LOF entries: replace only the first w:t (title), keep the page w:t."""
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    tms = list(T_RE.finditer(b))
    assert len(tms) >= 2, 'entree sans page : ' + b[:80]
    m0 = tms[0]
    return b[:m0.start()] + '<w:t xml:space="preserve">' + text + '</w:t>' + b[m0.end():]

def set_text(b, text):
    if text.startswith('Figure '):
        text = re.sub(r'^(Figure \d+\.\d+[a-z]?)\s*:', '\\1' + NB + ':', text)
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    tms = list(T_RE.finditer(b))
    assert tms, 'pas de w:t : ' + b[:80]
    for m in reversed(tms[1:]):
        b = b[:m.start()] + '<w:t xml:space="preserve"></w:t>' + b[m.end():]
    m0 = tms[0]
    b = b[:m0.start()] + '<w:t xml:space="preserve">' + text + '</w:t>' + b[m0.end():]
    return b

def clean_clone(b):
    b = re.sub(r'<w:bookmarkStart[^>]*/>', '', b)
    b = re.sub(r'<w:bookmarkEnd[^>]*/>', '', b)
    b = re.sub(r'\s+w14:paraId="[^"]*"', '', b)
    b = re.sub(r'\s+w14:textId="[^"]*"', '', b)
    b = re.sub(r'\s+w14:anchorId="[^"]*"', '', b)
    return b

def set_size(b, w, h):
    def rep(m):
        st = m.group(1)
        st = re.sub(r'width:[\d.]+pt', 'width:%.1fpt' % w, st)
        st = re.sub(r'height:[\d.]+pt', 'height:%.1fpt' % h, st)
        return 'style="%s"' % st
    b2, n = re.subn(r'style="([^"]*width:[^"]*)"', rep, b, count=1)
    assert n == 1, 'style introuvable'
    return b2

def add_sect(b, sect):
    """sectPr must be the LAST child of w:pPr."""
    if '</w:pPr>' in b:
        return b.replace('</w:pPr>', sect + '</w:pPr>', 1)
    m = re.match(r'<w:p(?:\s[^>]*)?>', b)
    assert m, 'pas de paragraphe'
    return b[:m.end()] + '<w:pPr>' + sect + '</w:pPr>' + b[m.end():]

# ---------- locate ----------
i_img32 = find('Figure 3.2 : Diagramme de classes global') - 1   # image para before caption
i_cap32 = i_img32 + 1
i_interp32 = i_cap32 + 2                                          # para 420
i_intro_bdd = find('Le schéma relationnel ci-dessous')
i_img_bdd = i_intro_bdd + 1
i_cap_bdd = i_img_bdd + 1
i_head33 = find('3.3 Diagramme de classes global')
i_toc33 = None
i_lof32 = None
for i, b in enumerate(blocks):
    if 'leader="dot"' not in b:
        continue
    t = txt(b)
    if i_toc33 is None and 'Diagramme de classes global' in t and t.startswith('3.3'):
        i_toc33 = i
    if i_lof32 is None and t.startswith('Figure 3.2 :'):
        i_lof32 = i
assert i_toc33 is not None and i_lof32 is not None
assert '<v:imagedata' in blocks[i_img32] and '<v:imagedata' in blocks[i_img_bdd]
tpl_interp = blocks[i_interp32]  # pristine single-paragraph template (before any append)
print('img32=%d cap32=%d interp=%d introBDD=%d imgBDD=%d capBDD=%d head33=%d toc=%d lof=%d'
      % (i_img32, i_cap32, i_interp32, i_intro_bdd, i_img_bdd, i_cap_bdd, i_head33, i_toc33, i_lof32))

# ---------- sizes ----------
w32a, h32a = fit('fig3_2a.png', PORTRAIT_W)
w32b, h32b = fit('fig3_2b.png', PORTRAIT_W)
wbd, hbd = fit('fig3_8w.png', LAND_W)
print('sizes 3.2a %.1fx%.1f | 3.2b %.1fx%.1f | BDD %.1fx%.1f' % (w32a, h32a, w32b, h32b, wbd, hbd))

# ---------- A: resize + rename 3.2 -> 3.2a ----------
blocks[i_img32] = set_size(blocks[i_img32], w32a, h32a)
blocks[i_cap32] = set_text(blocks[i_cap32], 'Figure 3.2a : Diagramme de classes — modèle recrutement')
blocks[i_head33] = set_text(blocks[i_head33], '3.3 Diagrammes de classes')
blocks[i_toc33] = set_title_keep_page(blocks[i_toc33], '3.3 Diagrammes de classes')
blocks[i_lof32] = set_title_keep_page(blocks[i_lof32], 'Figure 3.2a : Diagramme de classes — modèle recrutement')

# ---------- B: build 3.2b trio (image + caption + interpretation) ----------
img32b = clean_clone(blocks[i_img32])
img32b = img32b.replace('r:id="rId16"', 'r:id="rId48"')
img32b = set_size(img32b, w32b, h32b)
img32b = re.sub(r'<v:shape id="[^"]*"', '<v:shape id="Picture 32b"', img32b, count=1)
img32b = re.sub(r'o:spid="[^"]*"', 'o:spid="_x0000_i3201"', img32b, count=1)
cap32b = clean_clone(set_text(blocks[i_cap32], 'Figure 3.2b : Diagramme de classes — utilisateurs et sécurité'))
interp32b = clean_clone(set_text(blocks[i_interp32],
    'La vue sécurité isole les entités d’authentification et d’audit : chaque utilisateur porte un ou plusieurs rôles '
    '(ERole) et un rattachement à un département, ManagerRoutingService résout le périmètre de lecture d’un manager, '
    'et AuditLog journalise les actions sensibles.'))
# insert after interp32 (order: img, cap, interp)
blocks[i_interp32] = blocks[i_interp32] + img32b + cap32b + interp32b

# ---------- C: LOF new entry after 3.2a ----------
lof32b = clean_clone(blocks[i_lof32])
lof32b = set_title_keep_page(lof32b, 'Figure 3.2b : Diagramme de classes — utilisateurs et sécurité')
blocks[i_lof32] = blocks[i_lof32] + lof32b

# ---------- D: BDD landscape ----------
blocks[i_intro_bdd] = add_sect(blocks[i_intro_bdd], SECT_PORTRAIT)
blocks[i_img_bdd] = set_size(blocks[i_img_bdd], wbd, hbd)
bdd_interp = clean_clone(set_text(tpl_interp,
    'Le schéma relationnel reprend fidèlement les entités JPA : les clés primaires sont préfixées d’un astérisque et les '
    'clés étrangères suffixées « FK ». On y lit les relations structurantes : un département rattache les utilisateurs et '
    'les offres, une offre reçoit les candidatures, chaque candidature dépose un CV et passe des entretiens qui donnent '
    'lieu à des feedbacks rédigés par les utilisateurs.'))
bdd_interp = add_sect(bdd_interp, SECT_LAND)
blocks[i_cap_bdd] = blocks[i_cap_bdd] + bdd_interp

xml2 = pre + ''.join(blocks)
ET.fromstring(xml2)  # well-formedness guard
n_tbl = xml2.count('<w:tbl>')
print('tables:', n_tbl)
assert n_tbl == 10, 'tables perdues'

# ---------- E: rels + media ----------
assert 'rId48' not in rels and 'image38.png' not in rels
rels2 = rels.replace('</Relationships>',
    '<Relationship Id="rId48" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image38.png"/></Relationships>')

tmp = DOCX + '.tmp'
zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == 'word/document.xml':
        data = xml2.encode('utf-8')
    elif item.filename == 'word/_rels/document.xml.rels':
        data = rels2.encode('utf-8')
    elif item.filename == 'word/media/image8.png':
        data = open(PNG + 'fig3_2a.png', 'rb').read()
    elif item.filename == 'word/media/image14.png':
        data = open(PNG + 'fig3_8w.png', 'rb').read()
    zout.writestr(item, data)
zout.writestr('word/media/image38.png', open(PNG + 'fig3_2b.png', 'rb').read())
zout.close(); zin.close()
print('Wrote', tmp)
