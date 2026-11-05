# -*- coding: utf-8 -*-
"""Restructure les chapitres 2 et 3 du rapport beta selon l'audit UML.

Ch2 : 2.2.4 activite (venue du ch3), 2.2.5 UC macro + 3 sous-UC (2.3-2.5),
      2.2.6 description textuelle, 2.2.7 DSS boite noire (2.6).
Ch3 : 3.1 intro, 3.2 paquetages, 3.3 classes, 3.4 sequence technique (ancien
      DSS technique du ch2), 3.5 sequences objet (3.5.1-3.5.4), 3.6 etats,
      3.7 relationnel, 3.8 composants, 3.9 deploiement, 3.10 conclusion.

L'original aaa/ n'est jamais touche ; on lit/ecrit le docx beta dans sesame/.
Chaque paragraphe est stocke AVEC son blanc inter-paragraphe (gap) afin de
preserver integralement le markup des tableaux lors de la reconstruction.
"""
import re, sys, zipfile, os

BASE = r'C:/Users/hbargaoui/OneDrive - Sopra Steria/Desktop/projetpfeee/FindYourJob/Rapport-PFE'
DOCX = BASE + '/sesame/Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
PNG = BASE + '/diagrammes_v2/png/'
APPLY = '--apply' in sys.argv

P_RE = re.compile(r'<w:p(?:\s[^>]*)?/>|<w:p(?:\s[^>]*)?>.*?</w:p>', re.S)
T_RE = re.compile(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', re.S)

NEW_MEDIA = [
    ('image33.png', 'uc_macro.png', 'rId43'),
    ('image34.png', 'uc_portail.png', 'rId44'),
    ('image35.png', 'uc_recrutement.png', 'rId45'),
    ('image36.png', 'uc_admin.png', 'rId46'),
    ('image37.png', 'dss_noir.png', 'rId47'),
]
# tailles imprimees : meme gabarit que les figures existantes (grande, lisible)
W_MAX, H_MAX = 450.0, 600.0
NB = '\xa0'  # espace insecable utilise dans les legendes "Figure X.Y :"


def ptxt(b):
    return ''.join(T_RE.findall(b))


def nrm(s):
    return s.replace('\xa0', ' ')


def set_text(b, text):
    if text.startswith('Figure '):
        text = re.sub(r'^(Figure \d+\.\d+)\s+:', '\\1' + NB + ':', text)
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    ms = list(T_RE.finditer(b))
    assert ms, 'pas de w:t : ' + b[:80]
    # vider les w:t suivants d'abord (en ordre inverse pour garder les offsets valides)
    for m in reversed(ms[1:]):
        b = b[:m.start()] + '<w:t xml:space="preserve"></w:t>' + b[m.end():]
    m0 = ms[0]
    b = b[:m0.start()] + '<w:t xml:space="preserve">' + text + '</w:t>' + b[m0.end():]
    return b


def clean_clone(b):
    b = re.sub(r'<w:bookmarkStart[^>]*/>', '', b)
    b = re.sub(r'<w:bookmarkEnd[^>]*/>', '', b)
    b = re.sub(r'\s+w14:paraId="[^"]*"', '', b)
    b = re.sub(r'\s+w14:textId="[^"]*"', '', b)
    return b


_uid = [1050]


def img_para(tpl, rid, wpx, hpx, tag):
    s = min(W_MAX / wpx, H_MAX / hpx)
    w, h = wpx * s, hpx * s
    b = clean_clone(tpl)
    b = re.sub(r'r:id="rId\d+"', 'r:id="%s"' % rid, b, count=1)
    b = re.sub(r'style="width:[\d.]+pt;height:[\d.]+pt',
               'style="width:%.1fpt;height:%.1fpt' % (w, h), b, count=1)
    _uid[0] += 1
    b = re.sub(r'<v:shape id="[^"]*"', '<v:shape id="Img %d"' % _uid[0], b, count=1)
    b = re.sub(r'o:spid="[^"]*"', 'o:spid="_x0000_i%d"' % _uid[0], b, count=1)
    b = re.sub(r'\s+w14:anchorId="[^"]*"', '', b)
    return b


def main():
    zin = zipfile.ZipFile(DOCX)
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}
    xml = data['word/document.xml'].decode('utf-8')
    n_tbl0 = xml.count('<w:tbl>')

    ms = list(P_RE.finditer(xml))
    pre = xml[:ms[0].start()]
    # blocks[i] = paragraphe i + blanc qui le suit (gap) ; la reconstruction est exacte
    blocks = []
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(xml)
        blocks.append(xml[m.start():end])
    N0 = len(blocks)

    def find(prefix, start=0, style=None, dot=False):
        prefix = nrm(prefix)
        for i in range(start, len(blocks)):
            b = blocks[i]
            if dot and 'leader="dot"' not in b:
                continue
            if not dot and 'leader="dot"' in b:
                continue
            t = nrm(ptxt(b).strip())
            if t.startswith(prefix):
                if style is None or ('<w:pStyle w:val="%s"/>' % style) in b:
                    return i
        raise SystemExit('introuvable : ' + prefix)

    # ---------- gabarits (captures avant toute mutation) ----------
    tpl_t3 = blocks[329]      # Titre3 + bookmark
    tpl_intro = blocks[330]   # paragraphe keepNext
    tpl_img = blocks[331]     # image rId12 (pageBreakBefore, keepNext, center)
    tpl_cap = blocks[332]     # legende i sz21
    tpl_t2 = blocks[405]      # Titre2
    tpl_tm3 = blocks[75]      # entree TOC niveau 3
    tpl_tm2 = blocks[78]      # entree TOC niveau 2
    tpl_lof = blocks[133]     # entree liste des figures
    for nm, t in [('tpl_t3', tpl_t3), ('tpl_intro', tpl_intro), ('tpl_img', tpl_img),
                  ('tpl_cap', tpl_cap), ('tpl_t2', tpl_t2)]:
        assert '<v:imagedata' in t or '<w:t' in t, nm
    assert '<v:imagedata' in tpl_img and 'rId12' in tpl_img

    # ================= A. extraire l'activite du ch3 =================
    h_act = find('3.9 Diagramme d’activité', 200, 'Titre2')
    assert h_act == 449, h_act
    act_intro = blocks[h_act + 1]
    act_img = blocks[h_act + 2]
    act_cap = blocks[h_act + 3]
    act_after = blocks[h_act + 4]
    assert '<w:sectPr' in act_intro and 'rId25' in act_img and '<w:sectPr' in act_cap
    del blocks[h_act:h_act + 5]
    act_intro = set_text(act_intro,
        'Avant de détailler les fonctionnalités attendues, ce diagramme d’activité pose le flux '
        'métier global : il décrit l’enchaînement des activités du processus de recrutement, de la '
        'publication de l’offre jusqu’à la décision finale, ainsi que les acteurs qui les portent, '
        'indépendamment de toute considération technique.')
    act_cap = set_text(act_cap,
        'Figure 2.1 : Diagramme d’activité — Vue d’ensemble du processus de recrutement')
    act = [act_intro, act_img, act_cap, act_after]

    # ================= B. inserer l'activite comme 2.2.4 au ch2 =================
    h_uc = find('2.2.4 Diagramme de cas d’utilisation', 200, 'Titre3')
    new_head = set_text(clean_clone(tpl_t3),
        '2.2.4 Diagramme d’activité — Vue d’ensemble du processus de recrutement')
    blocks[h_uc:h_uc] = [new_head] + act

    # ================= C. UC macro -> 2.2.5, nouvelle figure 2.2 =================
    h_ucm = find('2.2.4 Diagramme de cas d’utilisation', 200, 'Titre3')
    blocks[h_ucm] = set_text(blocks[h_ucm], '2.2.5 Diagrammes de cas d’utilisation')
    blocks[h_ucm + 1] = set_text(blocks[h_ucm + 1],
        'Afin d’éviter l’effet « toile d’araignée », le périmètre fonctionnel est d’abord présenté '
        'en vue macro ci-dessous (figure 2.2), puis décliné en trois sous-diagrammes par module '
        '(figures 2.3 à 2.5). L’authentification par jeton JWT, bien qu’obligatoire pour les espaces '
        'sécurisés, est traitée comme une pré-condition textuelle et non comme un cas inclus ; les '
        'relations d’inclusion restantes pointent du cas principal vers le sous-cas requis, '
        'conformément à la norme UML, et le Candidat généralise le Visiteur.')
    assert 'rId12' in blocks[h_ucm + 2]
    blocks[h_ucm + 2] = img_para(tpl_img, 'rId43', 477, 1142, 'UC macro')
    blocks[h_ucm + 3] = set_text(blocks[h_ucm + 3],
        'Figure 2.2 : Diagramme de cas d’utilisation global')

    # ================= D. trois sous-diagrammes (figures 2.3-2.5) =================
    subs = [
        ('Le premier zoom couvre le portail public et candidat : consultation des offres, matching '
         '« Job idéal », dépôt de candidature et suivi en libre-service (figure 2.3).',
         'rId44', 791, 448, 'Figure 2.3 : Diagramme de cas d’utilisation — Portail Candidat & Visiteur'),
        ('Le deuxième zoom décrit le cœur du processus côté RH et manager : publication des offres, '
         'filtrage, entretiens, feedbacks et décision finale (figure 2.4). L’envoi des notifications '
         'par e-mail y est modélisé comme un cas inclus, déclenché par la planification ou par la '
         'décision, et non comme un cas autonome.',
         'rId45', 656, 596, 'Figure 2.4 : Diagramme de cas d’utilisation — Processus de Recrutement & Évaluation'),
        ('Le troisième zoom isole le périmètre d’administration : comptes et rôles, rattachements aux '
         'départements, pondérations du scoring IA et journal d’audit (figure 2.5).',
         'rId46', 486, 401, 'Figure 2.5 : Diagramme de cas d’utilisation — Administration & Paramétrage'),
    ]
    ins = []
    for txt_i, rid, wp, hp, cap in subs:
        ins.append(set_text(clean_clone(tpl_intro), txt_i))
        ins.append(img_para(tpl_img, rid, wp, hp, 'SubUC'))
        ins.append(set_text(clean_clone(tpl_cap), cap))
    blocks[h_ucm + 4:h_ucm + 4] = ins

    # ================= E. description textuelle -> 2.2.6 =================
    h_desc = find('2.2.5 Description textuelle', 200, 'Titre3')
    blocks[h_desc] = set_text(blocks[h_desc],
        '2.2.6 Description textuelle de quelques cas d’utilisation')

    # ================= F. DSS -> 2.2.7 boite noire ; image technique extraite =================
    h_dss = find('2.2.6 Diagramme de séquence système', 200, 'Titre3')
    tech_img = blocks[h_dss + 2]
    assert 'rId13' in tech_img, 'image technique rId13 attendue'
    blocks[h_dss] = set_text(blocks[h_dss],
        '2.2.7 Diagramme de séquence système (boîte noire)')
    blocks[h_dss + 1] = set_text(blocks[h_dss + 1],
        'Ce diagramme adopte une approche « boîte noire » stricte : il modélise uniquement les '
        'échanges entre l’acteur Candidat et le système JOB4YOU considéré comme un tout. Il met en '
        'évidence la requête de soumission du formulaire et le retour synchrone de confirmation '
        '(HTTP 201 Created), masquant à ce stade l’infrastructure interne et les traitements '
        'asynchrones, qui relèvent de la conception détaillée (section 3.4).')
    blocks[h_dss + 2] = img_para(blocks[h_dss + 2], 'rId47', 413, 348, 'DSS noir')
    blocks[h_dss + 3] = set_text(blocks[h_dss + 3],
        'Figure 2.6 : Diagramme de séquence système — Soumettre une candidature (boîte noire)')

    # ================= G. architecture physique cible : figure retiree =================
    h_phys = find('2.3.1 Architecture physique', 200, 'Titre3')
    blocks[h_phys] = set_text(blocks[h_phys], '2.3.1 Architecture physique cible')
    blocks[h_phys + 1] = set_text(blocks[h_phys + 1],
        'La plateforme cible une architecture distribuée par couches : un front-end Angular servi au '
        'navigateur, un back-end Spring Boot exposant des API REST sécurisées, une base PostgreSQL et '
        'une couche d’automatisation n8n relayant les services externes (Cohere, OpenRouter, Google '
        'Calendar, SMTP). Cette organisation physique est détaillée au chapitre 3 par les diagrammes '
        'de composants (figure 3.10) et de déploiement (figure 3.11) ; le tableau ci-dessous précise '
        'le rôle de chaque agent d’automatisation.')
    assert '<v:imagedata' in blocks[h_phys + 2] and ptxt(blocks[h_phys + 3]).strip().startswith('Figure 2.3')
    del blocks[h_phys + 2:h_phys + 4]

    # ================= H. nouvelle section 3.4 (sequence technique) =================
    h_seq = find('3.4 Diagrammes de séquence objet', 200, 'Titre2')
    sec34 = [
        set_text(clean_clone(tpl_t2),
            '3.4 Séquence technique — Soumission asynchrone et scoring IA'),
        set_text(clean_clone(tpl_intro),
            'Lors de la soumission d’une candidature, l’application orchestre plusieurs composants '
            'internes et externes de manière asynchrone afin de ne pas bloquer l’utilisateur. Comme '
            'l’illustre la figure 3.3, le front-end Angular transmet la charge utile au back-end '
            'Spring Boot, qui persiste immédiatement la candidature (statut APPLIED) ; un mécanisme '
            'de file d’attente (outbox) notifie ensuite le serveur d’automatisation n8n, chargé de '
            'l’extraction du texte, avant qu’un callback sécurisé ne permette au back-end de solliciter '
            'l’API Cohere et d’enregistrer le score de pertinence.'),
        clean_clone(tech_img),
        set_text(clean_clone(tpl_cap),
            'Figure 3.3 : Diagramme de séquence technique — Soumission asynchrone et scoring IA'),
    ]
    blocks[h_seq:h_seq] = sec34

    # ================= I. renumerotation ch3 (titres + legendes) =================
    R = [
        ('3.4 Diagrammes de séquence objet', '3.5 Diagrammes de séquence objet', 'Titre2'),
        ('3.4.1 Planifier un entretien', '3.5.1 Planifier un entretien', 'Titre3'),
        ('3.4.2 Décision finale de recrutement', '3.5.2 Décision finale de recrutement', 'Titre3'),
        ('3.4.3 Analyse IA du CV', '3.5.3 Analyse IA du CV (extraction, scoring via n8n et Cohere)', 'Titre3'),
        ('3.4.4 Passage en évaluation technique', '3.5.4 Passage en évaluation technique — routage et notification des managers', 'Titre3'),
        ('3.5 Diagramme d’états', '3.6 Diagramme d’états — Cycle de vie d’une candidature', 'Titre2'),
        ('3.6 Conception de la base de données', '3.7 Conception de la base de données', 'Titre2'),
        ('Figure 3.3 : Diagramme de séquence objet — Planifier un entretien', 'Figure 3.4 : Diagramme de séquence objet — Planifier un entretien', None),
        ('Figure 3.4 : Diagramme de séquence objet — Décision finale de recrutement', 'Figure 3.5 : Diagramme de séquence objet — Décision finale de recrutement', None),
        ('Figure 3.5 : Diagramme de séquence objet — Analyse IA du CV', 'Figure 3.6 : Diagramme de séquence objet — Analyse IA du CV', None),
        ('Figure 3.6 : Diagramme de séquence objet — Routage et notification des managers', 'Figure 3.7 : Diagramme de séquence objet — Routage et notification des managers', None),
        ('Figure 3.7 : Diagramme d’états du cycle de vie d’une candidature', 'Figure 3.8 : Diagramme d’états du cycle de vie d’une candidature', None),
        ('Figure 3.8 : Schéma relationnel de la base de données PostgreSQL', 'Figure 3.9 : Schéma relationnel de la base de données PostgreSQL', None),
    ]
    for old, new, sty in R:
        i = find(old, 200, sty)
        blocks[i] = set_text(blocks[i], new)

    # ================= J. inversion composants / deploiement =================
    h_dep = find('3.7 Diagramme de déploiement', 200, 'Titre2')
    h_comp = find('3.8 Diagramme de composants', 200, 'Titre2')
    assert h_dep + 5 == h_comp, (h_dep, h_comp)
    dep = blocks[h_dep:h_comp]          # 5 paragraphes
    comp = blocks[h_comp:h_comp + 5]    # 5 paragraphes
    assert len(dep) == 5 and len(comp) == 5
    blocks[h_dep:h_comp + 5] = comp + dep
    h_dep2 = find('3.7 Diagramme de déploiement', 200, 'Titre2')
    blocks[h_dep2] = set_text(blocks[h_dep2], '3.9 Diagramme de déploiement')
    i_capD = find('Figure 3.9 : Diagramme de déploiement', 200)
    blocks[i_capD] = set_text(blocks[i_capD],
        'Figure 3.11 : Diagramme de déploiement de la plateforme JOB4YOU')

    # ================= K. references croisees =================
    REFS = [
        ('(section 3.5)', '(section 3.6)'),
        ('section 3.4.4', 'section 3.5.4'),
        ('section 3.4.3', 'section 3.5.3'),
    ]
    for old, new in REFS:
        n = 0
        for i in range(len(blocks)):
            if 'leader="dot"' in blocks[i]:
                continue
            if old in ptxt(blocks[i]):
                blocks[i] = blocks[i].replace(old, new)
                n += 1
        print('ref %-18s -> %-18s : %d' % (old, new, n))
        assert n >= 1, old

    # ================= L. Table des matieres (ch2 puis ch3) =================
    toc_ch2 = [
        ('TM3', '2.2.4 Diagramme d’activité — Vue d’ensemble du processus de recrutement'),
        ('TM3', '2.2.5 Diagrammes de cas d’utilisation'),
        ('TM3', '2.2.6 Description textuelle de quelques cas d’utilisation'),
        ('TM3', '2.2.7 Diagramme de séquence système (boîte noire)'),
        ('TM2', '2.3 Étude technique'),
        ('TM3', '2.3.1 Architecture physique cible'),
        ('TM3', '2.3.2 Côté client — Angular'),
        ('TM3', '2.3.3 Côté serveur — Spring Boot'),
        ('TM3', '2.3.4 La sécurité — Spring Security et JWT'),
        ('TM2', '2.4 Conclusion'),
    ]
    toc_ch3 = [
        ('TM2', '3.1 Introduction'),
        ('TM2', '3.2 Diagramme des paquetages'),
        ('TM2', '3.3 Diagramme de classes global'),
        ('TM2', '3.4 Séquence technique — Soumission asynchrone et scoring IA'),
        ('TM2', '3.5 Diagrammes de séquence objet'),
        ('TM3', '3.5.1 Planifier un entretien'),
        ('TM3', '3.5.2 Décision finale de recrutement'),
        ('TM3', '3.5.3 Analyse IA du CV (extraction, scoring via n8n et Cohere)'),
        ('TM3', '3.5.4 Passage en évaluation technique — routage et notification des managers'),
        ('TM2', '3.6 Diagramme d’états — Cycle de vie d’une candidature'),
        ('TM2', '3.7 Conception de la base de données'),
        ('TM2', '3.8 Diagramme de composants'),
        ('TM2', '3.9 Diagramme de déploiement'),
        ('TM2', '3.10 Conclusion'),
    ]

    def build_toc(items):
        out = []
        for sty, title in items:
            tpl = tpl_tm3 if sty == 'TM3' else tpl_tm2
            out.append(set_text(clean_clone(tpl), title))
        return out

    a0 = find('2.2.4 Diagramme de cas d’utilisation', 0, dot=True)
    a1 = find('2.4 Conclusion', 0, dot=True)
    assert a1 > a0
    blocks[a0:a1 + 1] = build_toc(toc_ch2)

    b0 = find('3.1 Introduction', 0, dot=True)
    b1 = find('3.10 Conclusion', 0, dot=True)
    assert b1 > b0
    blocks[b0:b1 + 1] = build_toc(toc_ch3)

    # ================= M. Liste des figures (ch2 + ch3) =================
    lof = [
        'Figure 2.1 : Diagramme d’activité — Vue d’ensemble du processus de recrutement',
        'Figure 2.2 : Diagramme de cas d’utilisation global',
        'Figure 2.3 : Diagramme de cas d’utilisation — Portail Candidat & Visiteur',
        'Figure 2.4 : Diagramme de cas d’utilisation — Processus de Recrutement & Évaluation',
        'Figure 2.5 : Diagramme de cas d’utilisation — Administration & Paramétrage',
        'Figure 2.6 : Diagramme de séquence système — Soumettre une candidature (boîte noire)',
        'Figure 3.1 : Diagramme des paquetages',
        'Figure 3.2 : Diagramme de classes global',
        'Figure 3.3 : Diagramme de séquence technique — Soumission asynchrone et scoring IA',
        'Figure 3.4 : Diagramme de séquence objet — Planifier un entretien',
        'Figure 3.5 : Diagramme de séquence objet — Décision finale de recrutement',
        'Figure 3.6 : Diagramme de séquence objet — Analyse IA du CV',
        'Figure 3.7 : Diagramme de séquence objet — Routage et notification des managers',
        'Figure 3.8 : Diagramme d’états du cycle de vie d’une candidature',
        'Figure 3.9 : Schéma relationnel de la base de données PostgreSQL',
        'Figure 3.10 : Diagramme de composants de la plateforme JOB4YOU',
        'Figure 3.11 : Diagramme de déploiement de la plateforme JOB4YOU',
    ]
    c0 = find('Figure 2.1 :', 0, dot=True)
    c1 = find('Figure 3.11 :', 0, dot=True)
    assert c1 > c0
    blocks[c0:c1 + 1] = [set_text(clean_clone(tpl_lof), t) for t in lof]

    # ================= reconstruction =================
    xml2 = pre + ''.join(blocks)
    assert xml2.count('<w:tbl>') == n_tbl0, (xml2.count('<w:tbl>'), n_tbl0)
    import xml.etree.ElementTree as ET
    try:
        ET.fromstring(xml2.encode('utf-8'))
    except ET.ParseError as e:
        open('C:/tmp/xml2_bad.xml', 'w', encoding='utf-8').write(xml2)
        raise SystemExit('XML invalide apres patch : %s (dump C:/tmp/xml2_bad.xml)' % e)
    data['word/document.xml'] = xml2.encode('utf-8')

    # ================= media + rels =================
    rels = data['word/_rels/document.xml.rels'].decode('utf-8')
    add = ''
    for media, src, rid in NEW_MEDIA:
        assert ('Id="%s"' % rid) not in rels, 'rid deja present : ' + rid
        add += ('<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/'
                '2006/relationships/image" Target="media/%s"/>' % (rid, media))
        data['word/media/' + media] = open(PNG + src, 'rb').read()
    rels = rels.replace('</Relationships>', add + '</Relationships>')
    data['word/_rels/document.xml.rels'] = rels.encode('utf-8')

    print('paragraphes : %d -> %d ; tableaux preserves : %d' % (N0, len(blocks), xml2.count('<w:tbl>')))
    if not APPLY:
        print('DRY RUN (aucune ecriture)')
        return

    tmp = DOCX + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, data[n])
        for media, src, rid in NEW_MEDIA:
            if 'word/media/' + media not in names:
                zout.writestr('word/media/' + media, data['word/media/' + media])
    import time
    for attempt in range(6):
        try:
            os.replace(tmp, DOCX)
            break
        except PermissionError:
            if attempt == 5:
                raise
            time.sleep(1.5)
    print('ecrit :', DOCX)


if __name__ == '__main__':
    main()
