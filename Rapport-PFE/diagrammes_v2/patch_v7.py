# -*- coding: utf-8 -*-
"""Correct le paragraphe de synthese du scoring IA (page ~45) : l'agent n8n ne
contacte PAS directement Cohere ; il rappelle le back-end (POST
/api/candidates/{id}/ai-score/recompute) qui, via AiScoringService + CohereClient,
interroge Cohere. Verifie contre le code (AI_SCORE_THRESHOLD = 60,
saveAiScore/recomputeAiScore : >=60 -> CV_REVIEWED, <60 -> AUTO_REJECTED).
Idempotent ; n'ecrit que si un changement est necessaire."""
import re, sys, zipfile, os
import xml.etree.ElementTree as ET

DOCX = r'C:/Users/hbargaoui/OneDrive - Sopra Steria/Desktop/projetpfeee/FindYourJob/Rapport-PFE/sesame/Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
P_RE = re.compile(r'<w:p(?:\s[^>]*)?/>|<w:p(?:\s[^>]*)?>.*?</w:p>', re.S)
T_RE = re.compile(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', re.S)

OLD_MARK = 'agent n8n (CV Parser) → appel de l’API de Cohere'
NEW_TEXT = ('Le cheminement d’une candidature à travers le scoring IA peut se résumer ainsi : '
            'CV candidat → extraction du texte du CV côté back-end → déclenchement asynchrone de '
            'l’agent n8n « CV Parser » → rappel du back-end via POST /api/candidates/{id}/ai-score/recompute '
            '→ AiScoringService + CohereClient qui interrogent l’API de Cohere → calcul du score global '
            'sur 100 → orientation automatique vers CV_REVIEWED (score ≥ 60) ou AUTO_REJECTED (score < 60) '
            '→ validation humaine possible via le mécanisme de surcharge (manualScore).')


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def set_text(b, text):
    ms = list(T_RE.finditer(b))
    assert ms, 'pas de w:t'
    for m in reversed(ms[1:]):
        b = b[:m.start()] + '<w:t xml:space="preserve"></w:t>' + b[m.end():]
    m0 = ms[0]
    return b[:m0.start()] + '<w:t xml:space="preserve">' + esc(text) + '</w:t>' + b[m0.end():]


def ptxt(b):
    return ''.join(T_RE.findall(b))


def main():
    zin = zipfile.ZipFile(DOCX)
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}
    xml = data['word/document.xml'].decode('utf-8')

    ms = list(P_RE.finditer(xml))
    pre = xml[:ms[0].start()]
    blocks = []
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(xml)
        blocks.append(xml[m.start():end])

    hits = [i for i, b in enumerate(blocks) if OLD_MARK in ptxt(b)]
    if not hits:
        if any(NEW_TEXT.split(' → ')[2] in ptxt(b) for b in blocks):
            print('deja corrige — aucun changement')
            return
        raise SystemExit('paragraphe cible introuvable')
    assert len(hits) == 1, hits
    i = hits[0]
    assert len(T_RE.findall(blocks[i])) == 1, 'run multiple inattendu'
    blocks[i] = set_text(blocks[i], NEW_TEXT)
    print('paragraphe %d remplace' % i)

    xml2 = pre + ''.join(blocks)
    assert xml2.count('<w:tbl>') == xml.count('<w:tbl>')
    ET.fromstring(xml2.encode('utf-8'))
    data['word/document.xml'] = xml2.encode('utf-8')

    if '--apply' not in sys.argv:
        print('DRY RUN')
        return
    tmp = DOCX + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, data[n])
    print('ecrit (a deplacer) :', tmp)


if __name__ == '__main__':
    main()
