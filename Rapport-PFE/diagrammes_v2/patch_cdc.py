# -*- coding: utf-8 -*-
"""Regenere le cahier des charges en version beta (nouveau fichier, source jamais modifiee)."""
import re, sys, shutil, zipfile
from xml.sax.saxutils import escape

BASE = r'C:/Users/hbargaoui/OneDrive - Sopra Steria/Desktop/projetpfeee/FindYourJob/Rapport-PFE'
SRC = BASE + '/aaa/CAHIER_DES_CHARGES_JOB4YOU_Haythem_Bargaoui.docx'
OUT = BASE + '/sesame/CAHIER_DES_CHARGES_JOB4YOU_Haythem_Bargaoui_version_beta.docx'

APPLY = '--apply' in sys.argv

TBL_RE = re.compile(r'<w:tbl>.*?</w:tbl>', re.S)
ROW_RE = re.compile(r'<w:tr(?:\s[^>]*)?>.*?</w:tr>', re.S)
CELL_RE = re.compile(r'<w:tc>.*?</w:tc>', re.S)
T_RE = re.compile(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', re.S)
P_RE = re.compile(r'<w:p(?:\s[^>]*)?/>|<w:p(?:\s[^>]*)?>.*?</w:p>', re.S)

REPL = [
    # RM-07 : l'acceptation est possible des PHONE_SCREENING (code : assertValidTransition)
    ("L’acceptation d’un candidat n’est possible qu’après l’entretien téléphonique RH (statut PHONE_SCREENING) et le passage en évaluation technique ; la transition directe de CV_REVIEWED vers ACCEPTED n’existe pas.",
     "L’acceptation d’un candidat n’est possible qu’à partir du statut PHONE_SCREENING ou au-delà : l’entretien téléphonique RH constitue le premier filtre humain obligatoire et la transition directe de CV_REVIEWED vers ACCEPTED n’existe pas."),
    # RM-09 : formulation
    ("via le point d’entrée garde-fouté.",
     "via le point d’entrée protégé par ce garde-fou."),
    # RM-12 : politique de nouvelle tentative reelle (5 s, 10 s, 20 s, 40 s)
    ("avec un mécanisme de nouvelle tentative automatique (5 tentatives, délai croissant de 5 s à 5 min).",
     "avec un mécanisme de nouvelle tentative automatique (5 tentatives au maximum, délai doublé à chaque échec : 5, 10, 20 puis 40 secondes)."),
    # BNF-01 : completions securite
    ("Authentification par JWT, hachage BCrypt des mots de passe, contrôle d’accès RBAC sur chaque point d’entrée de l’API.",
     "Authentification par JWT, hachage BCrypt des mots de passe, contrôle d’accès RBAC sur chaque point d’entrée de l’API, jeton de réinitialisation de mot de passe valable 15 minutes et limitation du nombre de tentatives de connexion."),
    # BNF-02 : faute d'accord
    ("Un manager ne list ni ne consulte aucun dossier",
     "Un manager ne liste ni ne consulte aucun dossier"),
    # BNF-03 : objectifs de temps de reponse
    ("Traitements longs exécutés de façon asynchrone (scoring IA, envoi d’e-mails) afin de ne pas bloquer l’utilisateur.",
     "Traitements longs exécutés de façon asynchrone (scoring IA, envoi d’e-mails) afin de ne pas bloquer l’utilisateur ; temps de réponse cible inférieur à 500 ms en lecture et à 2 s en écriture."),
    # 7.1 : etats terminaux reels
    ("Les états terminaux (HIRED, MANAGER_REJECTED, AUTO_REJECTED, WITHDRAWN) n’autorisent plus aucune modification du statut depuis l’interface d’administration.",
     "Les états terminaux (HIRED, MANAGER_REJECTED, WITHDRAWN) n’autorisent plus aucune modification du statut depuis l’interface d’administration. L’état AUTO_REJECTED n’est pas définitif : une correction manuelle justifiée du score le ramène vers CV_REVIEWED."),
    # 7.1 : sens de INTERVIEW_SCHEDULED aligne sur le rapport
    ("Entretien confirmé au planning (agenda), sans effet sur le statut du dossier.",
     "Convocation à l’entretien final de cadrage RH et à la signature de la promesse d’embauche, consécutive à l’acceptation."),
    # LV-07 : pagination du rapport beta
    ("Rapport de stage (63 pages), présentations des interfaces, documentation interactive Swagger.",
     "Rapport de stage (76 pages), présentations des interfaces, documentation interactive Swagger."),
    # 13 : methode Scrum
    ("Le projet s’est déroulé sur sept mois, du 02 février au 31 août 2026, selon une démarche itérative inspirée d’Agile : chaque fonctionnalité était analysée, conçue, développée puis validée avant de passer à la suivante, avec des points de synchronisation réguliers avec l’encadrant.",
     "Le projet s’est déroulé sur sept mois, du 02 février au 31 août 2026, selon la méthode Agile Scrum adaptée au contexte d’un développeur seul : chaque fonctionnalité était analysée, conçue, développée puis validée au sein de sprints de deux à trois semaines, les points de synchronisation réguliers avec l’encadrant tenant lieu de revue de sprint."),
    ("ce projet a permis de mettre en pratique une démarche Agile adaptée à un besoin évolutif",
     "ce projet a permis de mettre en pratique la méthode Agile Scrum, adaptée à un besoin évolutif et au contexte d’un développeur seul"),
    # 4.1 : nature du candidat
    ("<w:t>Utilisateur externe (authentifié ou visiteur)</w:t>",
     "<w:t>Utilisateur externe authentifié (compte candidat)</w:t>"),
]

VISITEUR = ["Visiteur",
            "Utilisateur externe non authentifié",
            "Consulter et rechercher les offres publiées, consulter le détail d’une offre active et interroger l’assistant conversationnel ; l’authentification est exigée pour postuler."]

FEEDBACK_ROW = ["Saisir un feedback", "Oui", "Oui (son périmètre)", "Oui", "Non"]
VALIDATE_ROW = ["Valider et transmettre un feedback au candidat", "Oui", "Non", "Oui", "Non"]

TRANSITIONS = [
    ["Dépôt du CV", "APPLIED", "Candidat", "Candidature créée et CV enregistré."],
    ["APPLIED", "CV_REVIEWED", "Système (agent n8n / IA)", "Score IA supérieur ou égal au seuil (60/100)."],
    ["APPLIED", "AUTO_REJECTED", "Système (agent n8n / IA)", "Score IA inférieur au seuil."],
    ["AUTO_REJECTED", "CV_REVIEWED", "RH / Administrateur", "Surcharge manuelle du score justifiée et journalisée."],
    ["CV_REVIEWED", "PHONE_SCREENING", "RH", "Entretien téléphonique de pré-sélection planifié."],
    ["CV_REVIEWED", "AUTO_REJECTED", "RH / Administrateur", "Score corrigé ramené sous le seuil."],
    ["CV_REVIEWED", "MANAGER_REJECTED", "RH", "Refus possible sans attendre l’entretien téléphonique."],
    ["PHONE_SCREENING", "TECHNICAL_TEST", "RH", "Issue positive de l’entretien téléphonique ; routage et notification des managers du département."],
    ["PHONE_SCREENING", "ACCEPTED", "RH / Manager", "Acceptation prononcée dès l’issue de l’entretien téléphonique."],
    ["PHONE_SCREENING", "MANAGER_REJECTED", "RH", "Profil écarté à l’issue de l’entretien téléphonique."],
    ["TECHNICAL_TEST", "INTERVIEW", "Manager", "Entretien technique réalisé."],
    ["TECHNICAL_TEST", "ACCEPTED / MANAGER_REJECTED", "Manager / RH", "Décision prise sans entretien complémentaire."],
    ["INTERVIEW", "FINAL_INTERVIEW", "Manager", "Poursuite du processus."],
    ["INTERVIEW / FINAL_INTERVIEW", "ACCEPTED", "Manager / RH", "Décision positive à l’issue des entretiens."],
    ["INTERVIEW / FINAL_INTERVIEW", "MANAGER_REJECTED", "Manager / RH", "Décision négative à l’issue des entretiens."],
    ["ACCEPTED", "INTERVIEW_SCHEDULED", "RH", "Convocation à l’entretien final de cadrage RH et à la signature de la promesse d’embauche."],
    ["ACCEPTED / INTERVIEW_SCHEDULED", "HIRED", "RH / Manager", "Décision finale confirmée."],
    ["Tout statut non terminal", "WITHDRAWN", "Candidat", "Retrait en libre-service tant que le dossier n’est pas clos."],
]

PERSPECTIVE = ("Politique explicite de conservation et d’effacement des données candidats "
               "(durée de rétention, purge automatique) et recueil du consentement au dépôt du CV, "
               "conformément à la loi organique n° 2004-63 relative à la protection des données à caractère personnel.")


def cell_text(c):
    return ''.join(T_RE.findall(c))


def set_cell_text(cell, text):
    ts = list(T_RE.finditer(cell))
    if not ts:
        raise SystemExit('cellule sans <w:t>')
    m = ts[0]
    cell = cell[:m.start()] + '<w:t xml:space="preserve">' + escape(text) + '</w:t>' + cell[m.end():]
    for m2 in reversed(ts[1:]):
        cell = cell[:m2.start()] + '<w:t xml:space="preserve"></w:t>' + cell[m2.end():]
    return cell


def set_row_cells(row, texts):
    cells = list(CELL_RE.finditer(row))
    assert len(cells) == len(texts), (len(cells), len(texts))
    out = row
    for m, t in zip(reversed(cells), reversed(texts)):
        out = out[:m.start()] + set_cell_text(m.group(0), t) + out[m.end():]
    return out


def make_row(template, widths, texts):
    row = template
    cells = list(CELL_RE.finditer(row))
    assert len(cells) == len(widths) == len(texts)
    out = row
    for m, w, t in zip(reversed(cells), reversed(widths), reversed(texts)):
        c = set_cell_text(m.group(0), t)
        c = re.sub(r'<w:tcW[^/]*/>', '<w:tcW w:type="dxa" w:w="%d"/>' % w, c, count=1)
        out = out[:m.start()] + c + out[m.end():]
    return out


def main():
    with zipfile.ZipFile(SRC) as z:
        names = z.namelist()
        data = {n: z.read(n) for n in names}
    xml = data['word/document.xml'].decode('utf-8')
    orig = xml

    miss = 0
    for old, new in REPL:
        n = xml.count(old)
        if n != 1:
            print('MISS(%d): %s' % (n, old[:70]))
            miss += 1
        else:
            xml = xml.replace(old, new, 1)
    print('replacements texte : %d/%d' % (len(REPL) - miss, len(REPL)))

    tbls = [m for m in TBL_RE.finditer(xml)]
    print('tableaux :', len(tbls))

    # --- Table 1 : acteurs -> ligne Visiteur en tete
    t = tbls[1]
    block = t.group(0)
    widths = [int(w) for w in re.findall(r'<w:gridCol w:w="(\d+)"/>', block)]
    body = ROW_RE.findall(block)
    newrow = make_row(body[1], widths, VISITEUR)
    k = block.index(body[1])
    block = block[:k] + newrow + block[k:]
    xml = xml[:t.start()] + block + xml[t.end():]

    # --- Table 2 : matrice des responsabilites
    tbls = [m for m in TBL_RE.finditer(xml)]
    block = tbls[2].group(0)
    widths = [int(w) for w in re.findall(r'<w:gridCol w:w="(\d+)"/>', block)]
    body = ROW_RE.findall(block)
    idx = [i for i, r in enumerate(body) if cell_text(r).startswith('Saisir un feedback')]
    assert len(idx) == 1
    i = idx[0]
    body[i] = set_row_cells(body[i], FEEDBACK_ROW)
    body.insert(i + 1, make_row(body[i], widths, VALIDATE_ROW))
    head = block[:block.index(ROW_RE.findall(block)[0])]
    xml = xml[:tbls[2].start()] + head + ''.join(body) + '</w:tbl>' + xml[tbls[2].end():]

    # --- Table 5 : statuts (AUTO_REJECTED non terminal)
    tbls = [m for m in TBL_RE.finditer(xml)]
    block = tbls[5].group(0)
    body = ROW_RE.findall(block)
    done = 0
    for i, r in enumerate(body):
        if cell_text(r).startswith('AUTO_REJECTED'):
            body[i] = set_row_cells(r, ['AUTO_REJECTED',
                                        'Rejeté automatiquement par l’IA (score inférieur au seuil) ; réversible par surcharge manuelle justifiée.',
                                        'Non'])
            done += 1
    assert done == 1, done
    head = block[:block.index(body[0])] if False else block[:block.index(ROW_RE.findall(block)[0])]
    xml = xml[:tbls[5].start()] + head + ''.join(body) + '</w:tbl>' + xml[tbls[5].end():]

    # --- Table 6 : transitions autorisees (reconstruction complete)
    tbls = [m for m in TBL_RE.finditer(xml)]
    block = tbls[6].group(0)
    widths = [int(w) for w in re.findall(r'<w:gridCol w:w="(\d+)"/>', block)]
    body = ROW_RE.findall(block)
    head = block[:block.index(body[0])]
    tpl = body[1]
    rows = [body[0]] + [make_row(tpl, widths, r) for r in TRANSITIONS]
    xml = xml[:tbls[6].start()] + head + ''.join(rows) + '</w:tbl>' + xml[tbls[6].end():]
    print('transitions : %d lignes (avant %d)' % (len(rows), len(body) - 1))

    # --- 14.1 : perspective RGPD tunisienne
    bullet = ('<w:p><w:pPr><w:spacing w:after="40"/><w:ind w:left="425" w:hanging="198"/></w:pPr>'
              '<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>•</w:t><w:tab/><w:t>'
              + escape(PERSPECTIVE) + '</w:t></w:r></w:p>')
    anchor = '<w:t>Renforcement de la sécurité : analyse antivirus des fichiers déposés et durcissement du point d’entrée de test de connectivité des webhooks.</w:t></w:r></w:p>'
    assert xml.count(anchor) == 1
    xml = xml.replace(anchor, anchor + bullet, 1)

    # --- Pied de page numerote (aligne sur le rapport beta)
    rels = data['word/_rels/document.xml.rels'].decode('utf-8')
    ids = [int(i) for i in re.findall(r'Id="rId(\d+)"', rels)]
    rid = 'rId%d' % (max(ids) + 1)
    rels = rels.replace('</Relationships>',
                        '<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>' % rid)
    data['word/_rels/document.xml.rels'] = rels.encode('utf-8')

    ct = data['[Content_Types].xml'].decode('utf-8')
    if 'wordprocessingml.footer+xml' not in ct:
        ct = ct.replace('</Types>',
                        '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>')
        data['[Content_Types].xml'] = ct.encode('utf-8')

    data['word/footer1.xml'] = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'
        '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>'
        '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
        '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>'
        '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r>'
        '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>'
        '</w:p></w:ftr>').encode('utf-8')

    ref = '<w:footerReference w:type="default" r:id="%s"/>' % rid
    k = xml.rfind('<w:sectPr')
    k2 = xml.index('>', k) + 1
    xml = xml[:k2] + ref + xml[k2:]
    xml = xml.replace('<w:pgNumType w:start="1"/></w:sectPr>',
                      '<w:pgNumType w:start="1"/><w:titlePg/></w:sectPr>', 1)

    print('caracteres : %d -> %d' % (len(orig), len(xml)))
    if not APPLY:
        print('DRY RUN (ajouter --apply pour ecrire)')
        return
    data['word/document.xml'] = xml.encode('utf-8')
    shutil.copyfile(SRC, OUT)
    with zipfile.ZipFile(SRC) as zin, zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in zin.namelist():
            zout.writestr(n, data[n])
        for n in ('word/footer1.xml',):
            if n in data and n not in zin.namelist():
                zout.writestr(n, data[n])
    print('ecrit :', OUT)


if __name__ == '__main__':
    main()
