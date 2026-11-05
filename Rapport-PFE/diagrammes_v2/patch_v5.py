# -*- coding: utf-8 -*-
import zipfile, re, struct, os, sys

SRC = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Bargaoui_Haythem_Corrige_New.docx'
DST = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
PNG = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\diagrammes_v2\png'
DRY = '--apply' not in sys.argv

FIG = {
    'image4.png':  'fig2_1.png', 'image5.png':  'fig2_2.png', 'image6.png':  'fig2_3.png',
    'image7.png':  'fig3_1.png', 'image8.png':  'fig3_2.png', 'image9.png':  'fig3_3.png',
    'image10.png': 'fig3_4.png', 'image11.png': 'fig3_5.png', 'image12.png': 'fig3_6.png',
    'image13.png': 'fig3_7.png', 'image14.png': 'fig3_8.png', 'image15.png': 'fig3_9.png',
    'image16.png': 'fig3_10.png', 'image17.png': 'fig3_11.png',
}
W_MAX, H_MAX = 450.0, 620.0
WL_MAX, HL_MAX = 760.0, 470.0
# media files rendered full-page LANDSCAPE (wide diagrams -> readable text)
LANDSCAPE_MEDIA = {'image11.png', 'image15.png', 'image16.png', 'image17.png'}
SECT_PORTRAIT = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1140" '
                 'w:bottom="1417" w:left="1700" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>')
SECT_LAND = ('<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" '
             'w:right="720" w:bottom="900" w:left="720" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>')
NB = '\u00a0'; EL = '\u2026'

def P(s):  # straight apostrophe -> typographic
    return s.replace("'", '\u2019')

def esc(s):
    return P(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

report = []
def ok(tag, cond):
    report.append(('OK ' if cond else 'MISS') + ' | ' + tag)
    return cond

# ---------- load ----------
zin = zipfile.ZipFile(SRC)
rels = zin.read('word/_rels/document.xml.rels').decode('utf-8', 'ignore')
relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
media2rel = {t.split('/')[-1]: r for r, t in relmap.items() if t.split('/')[-1] in FIG}
xml = zin.read('word/document.xml').decode('utf-8', 'ignore')

# ---------- helpers ----------
def pstarts(s, upto):
    return [m.start() for m in re.finditer(r'<w:p[ >]', s[:upto])]

def para_span(s, i):
    st = pstarts(s, i)[-1]
    en = s.find('</w:p>', i) + len('</w:p>')
    return st, en

def rewrite_para(s, anchor, new_text, floor=0, tag=''):
    i = s.find(P(anchor), floor)
    if i < 0:
        ok('rewrite:' + (tag or anchor[:30]), False); return s
    a, b = para_span(s, i)
    block = s[a:b]
    state = {'n': 0}
    def rep(m):
        state['n'] += 1
        if state['n'] == 1:
            return '<w:t xml:space="preserve">' + esc(new_text) + '</w:t>'
        return '<w:t xml:space="preserve"></w:t>'
    nb = re.sub(r'<w:t(?:\s[^>]*)?>.*?</w:t>', rep, block, flags=re.S)
    ok('rewrite:' + (tag or anchor[:30]), state['n'] >= 1)
    return s[:a] + nb + s[b:]

def raw_replace(s, old, new, cnt=1, tag=''):
    o = P(old)
    c = s.count(o)
    ok('raw:' + (tag or old[:30]) + ' (found %d)' % c, c >= cnt)
    return s.replace(o, P(new), cnt)

def delete_para(s, anchor, floor=0, tag=''):
    i = s.find(P(anchor), floor)
    if i < 0:
        ok('delete:' + (tag or anchor[:30]), False); return s
    a, b = para_span(s, i)
    ok('delete:' + (tag or anchor[:30]), True)
    return s[:a] + s[b:]

BODY_PARA = '<w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>'
def mk_body(t): return BODY_PARA % esc(t)
def mk_bullet(t, numid):
    return ('<w:p><w:pPr><w:pStyle w:val="Paragraphedeliste"/><w:numPr><w:ilvl w:val="0"/>'
            '<w:numId w:val="%d"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>' % (numid, esc(t)))
def mk_caption(t):
    return ('<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:i/><w:sz w:val="21"/></w:rPr></w:pPr>'
            '<w:r><w:rPr><w:i/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p>' % esc(t))

def insert_after_para(s, anchor, newxml, floor=0, tag=''):
    i = s.find(P(anchor), floor)
    if i < 0:
        ok('insert:' + (tag or anchor[:30]), False); return s
    a, b = para_span(s, i)
    ok('insert:' + (tag or anchor[:30]), True)
    return s[:b] + newxml + s[b:]

def n8n_table():
    def cell(t, hdr=False):
        rpr = '<w:rPr><w:b/><w:sz w:val="21"/></w:rPr>' if hdr else '<w:rPr><w:sz w:val="21"/></w:rPr>'
        shd = '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' if hdr else ''
        return ('<w:tc><w:tcPr><w:tcW w:w="1667" w:type="pct"/>%s</w:tcPr>'
                '<w:p><w:pPr>%s</w:pPr><w:r>%s<w:t xml:space="preserve">%s</w:t></w:r></w:p></w:tc>' % (shd, rpr, rpr, esc(t)))
    def row(cells, hdr=False):
        tr = '<w:tr><w:trPr><w:cantSplit/>' + ('<w:tblHeader/>' if hdr else '') + '</w:trPr>'
        return tr + ''.join(cell(c, hdr) for c in cells) + '</w:tr>'
    rows = [
        row(['Agent', 'Déclencheur', 'Rôle et traitement'], hdr=True),
        row(['Agent 1 — « CV Parser » (scoring IA)',
             'Webhook déclenché à la création d’une candidature (statut APPLIED)',
             'Extrait le texte du CV puis rappelle le back-end (POST /api/candidates/{id}/ai-score/recompute). C’est le back-end, via son client CohereClient, qui interroge l’API de Cohere, calcule le score et le persiste ; le statut bascule ensuite vers CV_REVIEWED ou AUTO_REJECTED selon le seuil.']),
        row(['Agent 2 — « Entretiens » (Google Meet et convocations)',
             'Webhook déclenché à la planification d’un entretien',
             'Crée réellement l’événement Google Calendar, génère le lien Google Meet correspondant, ajoute les participants et envoie les invitations et rappels au candidat et à l’intervieweur.']),
        row(['Agent 3 — « Décisions et routage managers »',
             'Webhooks déclenchés à l’entrée en évaluation technique (TECHNICAL_TEST) et à la décision finale',
             'Résout les managers destinataires (ManagerRoutingService) et envoie les notifications de décision au candidat ainsi qu’aux managers concernés, sans dupliquer l’e-mail candidat.']),
    ]
    return ('<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>'
            '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            '</w:tblBorders><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar>'
            '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0"/></w:tblPr>'
            '<w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="2600"/><w:gridCol w:w="3400"/></w:tblGrid>'
            + ''.join(rows) + '</w:tbl>')

# ---------- BODY floor (skip TOC/LOF/LOT) ----------
FLOOR = xml.find('La fonction Ressources Humaines prend une place')

# =========================================================
# 1) FIGURES: drop intermediate orientation sections, resize
# =========================================================
spans = [m.span() for m in re.finditer(r'<w:sectPr\b.*?</w:sectPr>', xml, re.S)]
for (s0, e0) in reversed(spans[1:-1]):
    ps = xml.rfind('<w:p ', 0, s0); pe = xml.find('</w:p>', s0) + len('</w:p>')
    para = xml[ps:pe]
    inner = re.sub(r'<w:sectPr\b.*?</w:sectPr>', '', para, flags=re.S)
    has_content = re.search(r'<w:t[^>]*>\s*\S', inner) or 'v:imagedata' in inner
    xml = xml[:ps] + (inner if has_content else '') + xml[pe:]

def png_size(path):
    with open(path, 'rb') as f: d = f.read(33)
    return struct.unpack('>II', d[16:24])

newbytes, aspects = {}, {}
for media, rel in media2rel.items():
    w, h = png_size(os.path.join(PNG, FIG[media]))
    with open(os.path.join(PNG, FIG[media]), 'rb') as f:
        newbytes['word/media/' + media] = f.read()
    aspects[rel] = h / w

order = [(m.group(1), m.start()) for m in re.finditer(r'<v:imagedata[^>]*r:id="([^"]+)"', xml) if m.group(1) in aspects]
rel2media = {r: m for m, r in media2rel.items()}
PPR_ORDER = ['w:pStyle', 'w:keepNext', 'w:keepLines', 'w:pageBreakBefore']
def add_ppr_elem(block, elem):
    """insert elem into <w:pPr> respecting the CT_PPr schema child order"""
    name = re.match(r'<([\w:]+)', elem).group(1)
    m = re.search(r'<w:pPr>(.*?)</w:pPr>', block, re.S)
    if not m:
        om = re.search(r'<w:p(?:\s[^>]*)?>', block)
        return block.replace(om.group(0), om.group(0) + '<w:pPr>' + elem + '</w:pPr>', 1)
    inner = m.group(1)
    if '<' + name in inner:
        return block
    idx = PPR_ORDER.index(name) if name in PPR_ORDER else len(PPR_ORDER)
    at = len(inner)
    for cm in re.finditer(r'<([\w:]+)[ />]', inner):
        ci = PPR_ORDER.index(cm.group(1)) if cm.group(1) in PPR_ORDER else len(PPR_ORDER)
        if ci > idx:
            at = cm.start(); break
    return block[:m.start()] + '<w:pPr>' + inner[:at] + elem + inner[at:] + '</w:pPr>' + block[m.end():]
edits = []
for rel, pos in order:
    st0 = pstarts(xml, pos)[-1]; en0 = xml.find('</w:p>', pos) + 6
    land = rel2media.get(rel) in LANDSCAPE_MEDIA
    wm, hm = (WL_MAX, HL_MAX) if land else (W_MAX, H_MAX)
    a = aspects[rel]; w = wm; h = w * a
    if h > hm: h = hm; w = h / a
    img = xml[st0:en0]
    sm = re.search(r'style="([^"]*)"', img)
    stt = re.sub(r'width:\s*[\d.]+pt', 'width:%.1fpt' % w, sm.group(1))
    stt = re.sub(r'height:\s*[\d.]+pt', 'height:%.1fpt' % h, stt)
    img = img.replace(sm.group(0), 'style="%s"' % stt)
    img = add_ppr_elem(img, '<w:pageBreakBefore/>')
    img = add_ppr_elem(img, '<w:keepNext/>')
    edits.append((st0, en0, img))
for s0, e0, rep in sorted(edits, key=lambda t: t[0], reverse=True):
    xml = xml[:s0] + rep + xml[e0:]
report.append('OK | figures embedded: %d' % len(order))

# ---- landscape full-page sections for the wide diagrams ----
P_RE = re.compile(r'<w:p(?:\s[^>]*)?/>|<w:p(?:\s[^>]*)?>.*?</w:p>', re.S)

def all_paras(s):
    return [(m.start(), m.end()) for m in P_RE.finditer(s)]

def para_text(block):
    return ''.join(re.findall(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', block, re.S))

def is_spacer(block):
    """empty paragraph, safe to delete (no image, no table, no bookmark)"""
    if 'v:imagedata' in block or '<w:tbl' in block or 'bookmarkStart' in block:
        return False
    return not para_text(block).strip()

def add_sect(block, sect):
    m = re.search(r'<w:pPr>(.*?)</w:pPr>', block, re.S)
    if m:
        if '<w:sectPr' in m.group(1): return block
        return block.replace(m.group(0), '<w:pPr>' + m.group(1) + sect + '</w:pPr>', 1)
    om = re.search(r'<w:p(?:\s[^>]*)?>', block)
    return block.replace(om.group(0), om.group(0) + '<w:pPr>' + sect + '</w:pPr>', 1)

def is_heading(block):
    return re.search(r'<w:pStyle w:val="Titre[123]"/>', block) is not None

nland = 0
for rel in [r for r, _ in order if rel2media.get(r) in LANDSCAPE_MEDIA]:
    paras = all_paras(xml)
    kimg = next((i for i, (s, e) in enumerate(paras)
                 if 'v:imagedata' in xml[s:e] and ('r:id="%s"' % rel) in xml[s:e]), None)
    if kimg is None:
        ok('landscape:' + rel, False); continue
    kcap = next((j for j in range(kimg + 1, min(kimg + 6, len(paras)))
                 if 'Figure' in para_text(xml[paras[j][0]:paras[j][1]])), None)
    kprev = next((j for j in range(kimg - 1, max(kimg - 6, -1), -1)
                  if not is_spacer(xml[paras[j][0]:paras[j][1]])), None)
    if kcap is None or kprev is None:
        ok('landscape:' + rel, False); continue
    # a heading must not be stranded at the bottom of the portrait page:
    # close the portrait section one paragraph earlier so the heading opens the landscape page
    if is_heading(xml[paras[kprev][0]:paras[kprev][1]]):
        kprev = next((j for j in range(kprev - 1, max(kprev - 6, -1), -1)
                      if not is_spacer(xml[paras[j][0]:paras[j][1]])), kprev)

    edits = []
    # drop spacer paragraphs so the caption sits right under its diagram
    for j in list(range(kprev + 1, kimg)) + list(range(kimg + 1, kcap)):
        jb = xml[paras[j][0]:paras[j][1]]
        if is_spacer(jb):
            edits.append((paras[j][0], paras[j][1], ''))
        elif '<w:pageBreakBefore/>' in jb:
            edits.append((paras[j][0], paras[j][1], jb.replace('<w:pageBreakBefore/>', '')))
    edits.append((paras[kprev][0], paras[kprev][1],
                  add_sect(xml[paras[kprev][0]:paras[kprev][1]], SECT_PORTRAIT)))
    cap = xml[paras[kcap][0]:paras[kcap][1]].replace('<w:keepNext/>', '')
    edits.append((paras[kcap][0], paras[kcap][1], add_sect(cap, SECT_LAND)))
    # the landscape caption already opens a new portrait page: no extra break needed
    j = kcap + 1
    while j < len(paras) and is_spacer(xml[paras[j][0]:paras[j][1]]):
        edits.append((paras[j][0], paras[j][1], ''))
        j += 1
    if j < len(paras):
        b = xml[paras[j][0]:paras[j][1]]
        if '<w:pageBreakBefore/>' in b:
            edits.append((paras[j][0], paras[j][1], b.replace('<w:pageBreakBefore/>', '')))
    for s0, e0, rep in sorted(edits, key=lambda t: t[0], reverse=True):
        xml = xml[:s0] + rep + xml[e0:]
    nland += 1
    ok('landscape:' + rel2media.get(rel), True)
report.append('OK | landscape sections: %d' % nland)

# ---- never strand a heading alone on its own page above a full-page figure ----
orphans = 0
while True:
    paras = all_paras(xml)
    hit = None
    for i in range(1, len(paras)):
        s, e = paras[i]
        b = xml[s:e]
        if 'v:imagedata' not in b or '<w:pageBreakBefore/>' not in b:
            continue
        ps, pe = paras[i - 1]
        pb = xml[ps:pe]
        if is_heading(pb) and '<w:sectPr' not in pb:
            hit = (ps, pe, pb, s, e, b)
            break
    if not hit:
        break
    ps, pe, pb, s, e, b = hit
    hb = add_ppr_elem(pb.replace('<w:pageBreakBefore/>', ''), '<w:pageBreakBefore/>')
    hb = add_ppr_elem(hb, '<w:keepNext/>')
    xml = xml[:s] + b.replace('<w:pageBreakBefore/>', '') + xml[e:]
    xml = xml[:ps] + hb + xml[pe:]
    orphans += 1
report.append('OK | heading/figure page-breaks moved: %d' % orphans)

# ---- the final (body-level) section must not swallow the folio of its first page ----
body_sect = xml.rfind('<w:sectPr')
if body_sect >= 0 and '<w:titlePg/>' in xml[body_sect:]:
    xml = xml[:body_sect] + xml[body_sect:].replace('<w:titlePg/>', '', 1)
    ok('titlePg removed from body section', True)
else:
    ok('titlePg removed from body section', False)

# prevent table rows splitting across pages (keep <w:tr> intact)
xml = re.sub(r'<w:trPr>(?:(?!</w:trPr>).)*?</w:trPr>', lambda m: m.group(0) if 'cantSplit' in m.group(0) else m.group(0)[:-len('</w:trPr>')] + '<w:cantSplit/></w:trPr>', xml, flags=re.S)
xml = xml.replace('<w:tr>', '<w:tr><w:trPr><w:cantSplit/></w:trPr>') if False else xml

# =========================================================
# 2) RAW REPLACEMENTS (typos, cross-refs, small fixes)
# =========================================================
xml = raw_replace(xml, 'FIN D’ETUDES', 'FIN D’ÉTUDES', 1, 'ETUDES accent')
xml = raw_replace(xml, '4.2.3 Autres', '4.2.3 Gestion de version', 2, '4.2.3 heading+TOC')
xml = raw_replace(xml, 'Java 17/21', 'Java 17', 1, 'Java 17')
xml = raw_replace(xml, 'Le garde-fou décrit en 4.5.2 empêchait', 'Le garde-fou décrit en 4.5.3 empêchait', 1, 'xref 4.5.2->4.5.3')
xml = raw_replace(xml, 'ni par le garde-fou décrit en 4.5.4', 'ni par le garde-fou décrit en 4.5.3', 1, 'xref 4.5.4->4.5.3')
xml = raw_replace(xml, 'elles-mêmes garde-foutées', 'elles-mêmes protégées par des garde-fous', 1, 'garde-foutees')
xml = raw_replace(xml, 'via l’endpoint garde-fouté', 'via l’endpoint protégé par ce même garde-fou', 1, 'garde-foute endpoint')
xml = raw_replace(xml, 'Conformément au choix retenu, ces candidatures', 'Ces candidatures', 1, 'dangling conforme')
xml = raw_replace(xml, 'qui a consulté ou modifié un dossier donné', 'qui a modifié un dossier donné', 1, 'audit consulte->modifie')
xml = raw_replace(xml,
    '(5' + NB + 's, 10' + NB + 's, 20' + NB + 's' + EL + ' plafonné à 5' + NB + 'min)',
    '(5' + NB + 's, 10' + NB + 's, 20' + NB + 's, 40' + NB + 's puis 80' + NB + 's' + NB + '; le plafond théorique de 300' + NB + 's n’est jamais atteint avec cinq tentatives)',
    1, 'outbox numbers')
xml = raw_replace(xml,
    "une limitation du nombre de tentatives de connexion pour freiner les attaques par force brute, une validation du contenu réel de chaque fichier déposé (au-delà de la simple extension déclarée) pour bloquer un upload malveillant, et un garde-fou contre les redirections internes non autorisées sur le point d’API utilisé pour tester la connectivité des webhooks n8n.",
    "une limitation du nombre de tentatives de connexion pour freiner les attaques par force brute et un garde-fou contre les redirections internes non autorisées sur le point d’API utilisé pour tester la connectivité des webhooks n8n. Une validation du contenu réel des fichiers déposés, au-delà de la seule extension déclarée, reste en revanche une amélioration prévue pour la mise en production (section 4.2.4).",
    1, 'content-validation reconcile')

# =========================================================
# 3) INSERTIONS (run before rewrites; anchors are original)
# =========================================================
# 3a. new Candidat bullet right after the (soon Visiteur) actor bullet
candidat_bullet = mk_bullet("Le Candidat : utilisateur authentifié disposant d’un compte (rôle ROLE_USER), qui soumet ses candidatures, en suit l’avancement, échange avec l’assistant conversationnel et peut retirer un dossier tant qu’il n’est pas clos.", 17)
xml = insert_after_para(xml, "utilisateur externe, non authentifié ou disposant", candidat_bullet, FLOOR, 'Candidat bullet')

# 3b. ATS benchmark paragraph at end of 1.3
ats = mk_body("Il existe sur le marché des logiciels de suivi des candidatures (ATS, Applicant Tracking System) tels que Workday Recruiting, SAP SuccessFactors Recruiting, Greenhouse ou les modules de recrutement des grands SIRH. Ces outils couvrent la diffusion d’offres, le suivi des candidatures et la planification d’entretiens, mais ils sont pensés pour de grands groupes, coûteux à licencier et à paramétrer, et rarement adaptés au périmètre et aux contraintes d’une entité locale. JOB4YOU se positionne comme une alternative interne, sur mesure et maîtrisée : il reprend les fonctions essentielles d’un ATS (pipeline de candidatures, entretiens, feedbacks, décision finale) tout en y ajoutant un scoring IA des CV paramétrable par famille de métier, un matching inverse « Job idéal » et un assistant conversationnel candidat, le tout intégré aux processus et aux rôles propres à Sopra HR Software Tunisie.")
xml = insert_after_para(xml, "un processus chronophage à mesure que le volume de candidatures augmente", ats, FLOOR, 'ATS benchmark')

# 3c. RGPD / INPDP paragraph in 4.6
rgpd = mk_body("Le traitement des données des candidats soulève plusieurs points de conformité qu’il convient d’expliciter. Premièrement, des transferts vers des services d’IA tiers ont lieu : le scoring des CV transite par l’API de Cohere et l’assistant conversationnel par l’API OpenRouter ; ces flux doivent être encadrés (clauses contractuelles, minimisation des données transmises, information claire des candidats). Deuxièmement, le modèle de langage utilisé pour le chatbot est volontairement un modèle « stealth » (stealth/ox-alpha via OpenRouter) : ce choix, qui masque l’identité exacte du fournisseur du modèle, doit être documenté et justifié au regard de la loyauté du traitement. Troisièmement, la plateforme ne prévoit pas encore de politique explicite de durée de conservation et d’effacement des données des candidats (CV, évaluations) : il faudra la définir et l’outiller (archivage, purge automatique, exercice du droit à l’effacement). Quatrièmement, au niveau national, la loi organique tunisienne n° 2004-63 du 27 juillet 2004 relative à la protection des données à caractère personnel s’applique : elle impose notamment un consentement éclairé du candidat, qui devra se matérialiser par une case à cocher explicite lors du dépôt de candidature. Cinquièmement, un système de scoring utilisé dans un processus de recrutement est susceptible d’être qualifié de système d’IA à « haut risque » au sens du règlement européen sur l’IA (AI Act, règlement (UE) 2024/1689) ; il appelle à ce titre une traçabilité renforcée, une supervision humaine effective et une documentation du modèle — principes déjà partiellement mis en œuvre ici (surcharge manuelle justifiée, journal d’audit, contrôle humain sur toute décision).")
xml = insert_after_para(xml, "dérivées côté serveur à partir du jeton JWT", rgpd, FLOOR, 'RGPD/INPDP')

# 3d. planning table caption (Tableau 1.1)
xml = insert_after_para(xml, "la macro-planification temporelle des grandes phases du stage est résumée dans le tableau suivant",
                         mk_caption("Tableau 1.1 : Macro-planification des phases du projet"), FLOOR, 'caption Tableau 1.1')

# 3e. use-case table caption (Tableau 2.2)
xml = insert_after_para(xml, "Le tableau qui suit détaille le scénario nominal de deux cas d’utilisation représentatifs",
                         mk_caption("Tableau 2.2 : Description textuelle de deux cas d’utilisation représentatifs"), FLOOR, 'caption Tableau 2.2')

# 3f. n8n agents table + caption after Figure 2.3 body caption
n8nxml = mk_caption("Tableau 2.3 : Rôle des agents d’automatisation n8n") + n8n_table()
xml = insert_after_para(xml, "Architecture physique de la plateforme JOB4YOU", n8nxml, FLOOR, 'n8n agents table')

# 3g. bibliography additions after [14]
bib = ''.join(mk_bullet(t, 22) for t in [
    "[15] SCRUM.ORG — The Scrum Guide (2020), Schwaber K. & Sutherland J. Disponible sur : https://scrumguides.org. Consulté le 03/08/2026.",
    "[16] OpenRouter — Documentation de l’API. Disponible sur : https://openrouter.ai/docs. Consulté le 03/08/2026.",
    "[17] Google Calendar API — Documentation développeur. Disponible sur : https://developers.google.com/calendar. Consulté le 03/08/2026.",
    "[18] JUnit 5 et Mockito — Documentation. Disponibles sur : https://junit.org/junit5/ et https://site.mockito.org. Consulté le 03/08/2026.",
    "[19] Loi organique n° 2004-63 du 27 juillet 2004 relative à la protection des données à caractère personnel (République tunisienne).",
    "[20] Règlement (UE) 2024/1689 (AI Act) — systèmes d’intelligence artificielle à haut risque. Disponible sur : https://eur-lex.europa.eu. Consulté le 03/08/2026.",
    "[21] Sopra Steria — Site officiel du groupe. Disponible sur : https://www.soprasteria.com. Consulté le 03/08/2026.",
])
xml = insert_after_para(xml, "ISO 30415:2021", bib, FLOOR, 'biblio adds')

# =========================================================
# 4) DELETIONS
# =========================================================
xml = delete_para(xml, "Des points de synchronisation réguliers avec mon encadrant", FLOOR, 'dup Git para 1.7')

# =========================================================
# 5) PARAGRAPH REWRITES (last)
# =========================================================
xml = rewrite_para(xml, "Je dédie ce travail à mes parents",
    "Je dédie ce travail à mes parents, dont l’amour inconditionnel, le soutien de chaque instant et les sacrifices ont rendu ce parcours possible. Aucun mot ne saurait pleinement exprimer ma gratitude à leur égard.", 0, 'dedicace1')
xml = rewrite_para(xml, "Mes frères et sœurs m’ont accompagné",
    "À mes frères et sœurs, dont les encouragements et la présence, y compris dans les moments les plus difficiles, m’ont accompagné tout au long de ce parcours.", 0, 'dedicace2')
xml = rewrite_para(xml, "Mes amis et collègues ont eux aussi",
    "À mes amis et collègues, pour leur soutien moral et les bons moments partagés durant cette expérience.", 0, 'dedicace3')
xml = rewrite_para(xml, "Je n’oublie enfin personne d’autre",
    "À toutes les personnes qui, de près ou de loin, ont contribué à la réussite de ce travail.", 0, 'dedicace4')

xml = rewrite_para(xml, "Les besoins évoluant au fil du stage",
    "Les besoins évoluant au fil du stage, et les retours réguliers de mon encadrant entreprise étant essentiels, j’ai adopté une démarche itérative et incrémentale inspirée des principes Agile/Scrum. Le développement s’est organisé en cycles courts (sprints de 2 à 3 semaines), chacun débutant par la sélection et le dimensionnement des user stories prioritaires du Product Backlog, puis enchaînant analyse, conception, implémentation et tests unitaires et fonctionnels. Chaque sprint se clôturait par une revue d’itération (Sprint Review) et une démonstration à mon encadrant entreprise, suivies d’une rétrospective visant à ajuster priorités et spécifications. S’agissant d’un projet mené seul, j’ai endossé les trois rôles Scrum : Product Owner (priorisation du backlog avec l’encadrant), Scrum Master (respect des cérémonies et du rythme des itérations) et équipe de développement (conception, code et tests). Git/GitHub a servi tout du long à assurer la traçabilité du code, faciliter les retours en arrière et documenter l’évolution du projet à travers l’historique des commits.", FLOOR, 'scrum 1.7')

xml = rewrite_para(xml, "Le Manager, qui intervient dans le processus de sélection après validation RH",
    "Le Manager, qui intervient à partir de l’entrée du dossier en évaluation technique (statut TECHNICAL_TEST), mène ou participe aux entretiens et fournit un feedback structuré sur les candidats évalués.", FLOOR, 'manager 1.6')

xml = rewrite_para(xml, "Quatre acteurs interviennent sur la plateforme",
    "Cinq acteurs interviennent sur la plateforme JOB4YOU, chacun avec ses propres privilèges et fonctionnalités :", FLOOR, 'acteurs count')
xml = rewrite_para(xml, "utilisateur externe, non authentifié ou disposant",
    "Le Visiteur : utilisateur anonyme, non authentifié, qui consulte les offres d’emploi publiées et peut déposer son CV dans la fonctionnalité « Job idéal » pour obtenir des suggestions ; il doit créer un compte et s’authentifier pour soumettre une candidature.", FLOOR, 'visiteur 2.2.1')
xml = rewrite_para(xml, "intervient une fois le dossier validé par le RH",
    "Le Manager : intervient à partir de l’entrée du dossier en évaluation technique (statut TECHNICAL_TEST) ; il consulte les candidatures relevant de son périmètre, mène ou participe aux entretiens, fournit un feedback structuré et peut prendre la décision finale (acceptation ou refus) sur les dossiers de son périmètre.", FLOOR, 'manager 2.2.1')

xml = rewrite_para(xml, "authentification robuste par JWT",
    "Sécurité : authentification robuste par jeton JWT signé d’une durée de vie de 24 heures, hachage des mots de passe avec BCrypt, contrôle d’accès basé sur les rôles (RBAC) appliqué à la fois côté front-end et côté back-end, jeton de réinitialisation de mot de passe valable 15 minutes et limitation du nombre de tentatives de connexion.", FLOOR, 'NFR securite')
xml = rewrite_para(xml, "temps de réponse adapté à une utilisation interne",
    "Performance : temps de réponse cible inférieur à 500 ms pour les opérations de lecture courantes et inférieur à 2 s pour les opérations d’écriture, chargement asynchrone des traitements longs (scoring IA, envoi d’e-mails) afin de ne pas bloquer l’utilisateur, et taille maximale des CV déposés fixée à 10 Mo (formats PDF, DOC, DOCX).", FLOOR, 'NFR perf')

xml = rewrite_para(xml, "prise de décision est soumise aux règles de transition",
    "Ce second diagramme illustre un autre garde-fou central de l’application : la prise de décision est soumise aux règles de transition du cycle de vie (section 3.5). Un refus (MANAGER_REJECTED) peut intervenir dès que le dossier a été validé par le RH (statut CV_REVIEWED ou ultérieur), tandis qu’une acceptation (ACCEPTED) exige d’être passé par l’entretien téléphonique RH (statut PHONE_SCREENING) — l’entrée en évaluation technique n’étant pas un prérequis à l’acceptation. Ce garde-fou empêche qu’une candidature soit acceptée sans ce premier filtre humain (section 4.5.8).", FLOOR, '3.4.2')
xml = rewrite_para(xml, "webhook n8n déclenche l’analyse asynchrone",
    "Ce diagramme détaille, au niveau objet, le cheminement du scoring : dès l’enregistrement de la candidature (statut APPLIED), le texte du CV est extrait, puis un webhook n8n déclenche l’analyse asynchrone. L’agent n8n « CV Parser » ne contacte pas directement Cohere : il rappelle le back-end via POST /api/candidates/{id}/ai-score/recompute, et c’est le back-end — au travers de son client CohereClient — qui interroge l’API de Cohere, calcule le score et le persiste. Le statut bascule ensuite automatiquement vers CV_REVIEWED ou AUTO_REJECTED selon le seuil configuré, sans intervention humaine à ce stade.", FLOOR, '3.4.3 cohere')
xml = rewrite_para(xml, "des états terminaux (HIRED",
    "On y distingue notamment un embranchement automatique piloté par le score de l’analyse IA — statut CV_REVIEWED si le score atteint le seuil de 60/100, AUTO_REJECTED sinon — ainsi que des états véritablement terminaux (HIRED, MANAGER_REJECTED, WITHDRAWN), au-delà desquels l’interface d’administration n’autorise plus aucune modification du statut. L’état AUTO_REJECTED n’est, lui, pas définitif : il peut être révisé par une correction manuelle du score décrite ci-après. À la suite de la décision d’acceptation (statut ACCEPTED) prononcée par le manager et le RH, la transition vers l’état INTERVIEW_SCHEDULED matérialise la convocation à l’entretien final de cadrage RH et de signature de la promesse d’embauche, qui conduit directement au statut définitif de collaborateur recruté (HIRED).", FLOOR, '3.5 terminaux')

xml = rewrite_para(xml, "Ce travail couvre désormais l’ensemble du cycle",
    "Ce travail couvre désormais l’ensemble du cycle de recrutement, de la publication d’une offre jusqu’à la décision finale d’embauche, en passant par la soumission des candidatures, l’analyse automatique des CV par intelligence artificielle, la planification des entretiens et la collecte des feedbacks des managers. La plateforme intègre également deux fonctionnalités différenciantes : le matching inverse « Job idéal », qui suggère à un candidat les offres les plus compatibles avec son CV, et un assistant conversationnel (chatbot) permettant à chacun de suivre ses candidatures en langage naturel — ce dernier étant strictement cloisonné aux données du candidat connecté, à l’exclusion de toute information interne (score IA, notes RH, identité de l’intervieweur). Un système de notifications automatiques par e-mail et un tableau de pilotage visuel de type Kanban complètent l’ensemble et donnent aux équipes RH et aux managers une visibilité en temps réel sur l’avancement de chaque dossier.", FLOOR, 'conclusion features')
xml = rewrite_para(xml, "Plusieurs pistes d’évolution restent ouvertes",
    "Plusieurs pistes d’évolution restent ouvertes pour poursuivre ce travail. Côté fonctionnel, la plateforme pourrait accueillir un module d’analyse prédictive du taux de transformation des candidatures, une intégration plus poussée avec des plateformes d’emploi externes (LinkedIn, Indeed), ou un espace candidat plus riche pour un suivi encore plus détaillé de son parcours. Côté technique, la suite de tests automatisés — qui compte déjà 108 méthodes de test unitaires et de contrôleur (JUnit 5 / Mockito) — gagnerait à être complétée par des tests d’intégration couvrant les services et la base de données, des tests de bout en bout (par exemple Playwright ou Cypress) rejouant les parcours métier complets, et des tests front-end automatisés sur les composants Angular. Une chaîne d’intégration et de déploiement continus (CI/CD) ainsi qu’un déploiement sur une infrastructure cloud constitueraient des évolutions naturelles pour renforcer la fiabilité et la scalabilité de la plateforme sur le long terme.", FLOOR, 'perspectives tests')

# =========================================================
# 6) TABLE 2.1 : feedback row + new row
# =========================================================
def set_cell_text(tr, idx, text):
    cells = list(re.finditer(r'<w:tc>.*?</w:tc>', tr, re.S))
    c = cells[idx].group(0)
    nc = re.sub(r'(<w:t(?:\s[^>]*)?>).*?(</w:t>)', lambda m: m.group(1) + esc(text) + m.group(2), c, count=1, flags=re.S)
    return tr[:cells[idx].start()] + nc + tr[cells[idx].end():]

i = xml.find('Saisir un feedback')
if i >= 0:
    ts = xml.rfind('<w:tr', 0, i); te = xml.find('</w:tr>', i) + len('</w:tr>')
    row = xml[ts:te]
    newrow = set_cell_text(row, 1, 'Oui')      # RH
    newrow = set_cell_text(newrow, 3, 'Oui')   # Admin
    # build the extra row (Valider / transmettre un feedback)
    extra = set_cell_text(newrow, 0, 'Valider / transmettre un feedback au candidat')
    extra = set_cell_text(extra, 1, 'Oui')
    extra = set_cell_text(extra, 2, 'Non')
    extra = set_cell_text(extra, 3, 'Oui')
    extra = set_cell_text(extra, 4, 'Non')
    xml = xml[:ts] + newrow + extra + xml[te:]
    ok('table 2.1 feedback rows', True)
else:
    ok('table 2.1 feedback rows', False)

# =========================================================
# 7) GLOSSARY : drop MLD, add terms, alphabetical reorder
# =========================================================
gi = xml.find('>Glossaire<', FLOOR)
if gi >= 0:
    # collect consecutive glossary bullets (numId 23) after heading
    pos = xml.find('</w:p>', gi) + 6
    items = []
    cursor = pos
    while True:
        m = re.match(r'\s*<w:p[ >].*?</w:p>', xml[cursor:], re.S)
        if not m: break
        blk = m.group(0)
        if 'w:numId w:val="23"' not in blk: break
        ts = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', blk, re.S))
        ts = ts.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
        items.append(ts)
        cursor += m.end()
    if items:
        terms = {}
        for it in items:
            if ':' in it:
                k, v = it.split(':', 1)
                terms[k.strip().rstrip(NB)] = v.strip()
        terms.pop('MLD', None)
        new_terms = {
            'RGPD': "Règlement Général sur la Protection des Données (règlement (UE) 2016/679).",
            'INPDP': "Instance Nationale de Protection des Données Personnelles (Tunisie).",
            'LLM': "Large Language Model — modèle de langage de grande taille.",
            'SMTP': "Simple Mail Transfer Protocol — protocole d’envoi de courriel.",
            'SPA': "Single Page Application — application web monopage.",
            'SGBD': "Système de Gestion de Base de Données.",
            'OWASP': "Open Worldwide Application Security Project — référentiel des principaux risques de sécurité applicatifs.",
            'Outbox': "file d’attente interne garantissant la livraison fiable des événements (webhooks n8n), avec journalisation et nouvelles tentatives en cas d’échec.",
        }
        terms.update(new_terms)
        import unicodedata
        def keyf(k):
            return unicodedata.normalize('NFD', k.lower()).encode('ascii', 'ignore').decode()
        ordered = sorted(terms.items(), key=lambda kv: keyf(kv[0]))
        newblock = ''.join(mk_bullet('%s%s: %s' % (k, NB, v), 23) for k, v in ordered)
        xml = xml[:pos] + newblock + xml[cursor:]
        ok('glossary rebuilt (%d terms)' % len(ordered), True)
    else:
        ok('glossary rebuilt', False)
else:
    ok('glossary rebuilt', False)

# =========================================================
# 8) LISTE DES TABLEAUX : register the 3 new tables
# =========================================================
def lot_entry(xml, title_prefix):
    for s, e in all_paras(xml):
        b = xml[s:e]
        if 'leader="dot"' in b and para_text(b).startswith(title_prefix):
            return s, e, b
    return None

def mk_lot_entry(tpl, title):
    ts = list(re.finditer(r'<w:t(?:\s[^>]*)?>.*?</w:t>', tpl, re.S))
    out = tpl[:ts[0].start()] + '<w:t xml:space="preserve">' + esc(title) + '</w:t>' + tpl[ts[0].end():]
    ts2 = list(re.finditer(r'<w:t(?:\s[^>]*)?>.*?</w:t>', out, re.S))
    return out[:ts2[-1].start()] + '<w:t>0</w:t>' + out[ts2[-1].end():]

hit = lot_entry(xml, 'Tableau 2.1' + NB)
if hit:
    ls, le, tpl = hit
    before = mk_lot_entry(tpl, 'Tableau 1.1' + NB + ': Macro-planification des phases du projet')
    after = (mk_lot_entry(tpl, 'Tableau 2.2' + NB + ': Description textuelle de deux cas d’utilisation représentatifs')
             + mk_lot_entry(tpl, 'Tableau 2.3' + NB + ': Rôle des agents d’automatisation n8n'))
    xml = xml[:ls] + before + tpl + after + xml[le:]
    ok('LOT entries added', True)
else:
    ok('LOT entries added', False)

# =========================================================
# WRITE
# =========================================================
print('\n'.join(report))
miss = [r for r in report if r.startswith('MISS')]
print('\n== MISSES: %d ==' % len(miss))
if DRY:
    print('DRY RUN — not writing. Pass --apply to write.')
    sys.exit(0)

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
print('Wrote', DST)
