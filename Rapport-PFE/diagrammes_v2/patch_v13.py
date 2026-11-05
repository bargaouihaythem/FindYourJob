# -*- coding: utf-8 -*-
"""Corrections du narratif liees aux figures 2.5 et 4.7 (audit 2026-10-19)."""
import shutil

from docx import Document

DOCX = (r"C:/Users/hbargaoui/OneDrive - Sopra Steria/Desktop/projetpfeee/"
        r"FindYourJob/Rapport-PFE/finalreport/Rapport_PFE_Haythem_Bargaoui_beta.docx")
BACKUP = DOCX + ".pre-patch-v13.bak"

SUBPATCHES = {
    270: [
        ("comptes et rôles, référentiel des départements et des familles de métier, "
         "rattachements correspondants, pondérations du scoring IA et journal d’audit "
         "(figure 2.5).",
         "comptes et rôles, rattachement d’un utilisateur à un département ou à une "
         "famille de métier, pondérations du scoring IA et journal d’audit "
         "(figure 2.5). Le référentiel lui-même n’est pas administrable : les "
         "départements sont créés au démarrage et exposés en lecture seule, les "
         "familles de métier sont un énuméré figé dans le code."),
    ],
    409: [
        ("Le bandeau supérieur résume l’état du vivier (à valider, rejetés, retirés, "
         "embauchés).",
         "Le bandeau supérieur résume l’état du vivier par quatre compteurs cliquables "
         "— « À valider », « Rejetés », « Retirées », « Embauchés » — qui basculent la "
         "liste sur le filtre correspondant."),
    ],
}


def fr(t):
    t = t.replace("\xa0", " ")
    t = t.replace(" :", "\xa0:").replace(" ;", "\xa0;")
    return t.replace("« ", "«\xa0").replace(" »", "\xa0»")


def main():
    shutil.copy2(DOCX, BACKUP)
    d = Document(DOCX)
    for idx, subs in sorted(SUBPATCHES.items()):
        runs = [r for r in d.paragraphs[idx].runs if r.text]
        assert len(runs) == 1, (idx, len(runs))
        text = runs[0].text
        for old, new in subs:
            old, new = fr(old), fr(new)
            assert text.count(old) == 1, (idx, old[:50], text.count(old))
            text = text.replace(old, new)
        runs[0].text = text
        print("corrige", idx)
    d.save(DOCX)
    print("Sauvegarde :", BACKUP)


if __name__ == "__main__":
    main()
