# -*- coding: utf-8 -*-
"""Correction du narratif (audit de coherence diagrammes/code, 2026-10-19).

Remplace des paragraphes entiers du rapport par leur version corrigee.
Chaque paragraphe cible n'a qu'un seul run : la reecriture integrale est sure.
"""
import shutil
import zipfile

from docx import Document

DOCX = (r"C:/Users/hbargaoui/OneDrive - Sopra Steria/Desktop/projetpfeee/"
        r"FindYourJob/Rapport-PFE/finalreport/Rapport_PFE_Haythem_Bargaoui_beta.docx")
BACKUP = DOCX + ".pre-patch-v12.bak"

# index du paragraphe -> (debut attendu du texte actuel, nouveau texte)
PATCHES = {
    303: (
        "La figure 3.2 donne une vue d’ensemble",
        "La figure 3.2 donne une vue d’ensemble du modèle de données : neuf entités "
        "métier principales de la plateforme, leurs attributs caractéristiques et les "
        "associations réellement mappées par JPA. Quatorze entités JPA sont persistées "
        "au total ; les cinq restantes — notes internes, profils de pondération du "
        "scoring, file d’attente n8n, rappels et jetons de réinitialisation — sont des "
        "tables d’accompagnement, que l’on retrouve sur le schéma relationnel de la "
        "figure 3.9. Les deux figures suivantes en proposent des zooms thématiques — le "
        "recrutement (figure 3.2a), puis les utilisateurs, la sécurité et l’audit "
        "(figure 3.2b) — afin d’en conserver une lecture confortable.",
    ),
    329: (
        "Ce diagramme détaille, au niveau objet,",
        "Ce diagramme détaille, au niveau objet, le cheminement du scoring : le texte du "
        "CV est extrait par le back-end au moment même de la soumission, puis la "
        "candidature (statut APPLIED) est placée dans la file d’attente interne ; l’agent "
        "« CV Parser » n8n est déclenché en arrière-plan et rappelle le back-end via POST "
        "/api/candidates/{id}/ai-score/recompute, et c’est le back-end — au travers de son "
        "client CohereClient — qui interroge l’API de Cohere, calcule le score et le "
        "persiste. Le statut bascule ensuite automatiquement vers CV_REVIEWED ou "
        "AUTO_REJECTED selon le seuil configuré, sans intervention humaine à ce stade — "
        "sauf si le dossier est signalé pour arbitrage, comme le décrit la suite du "
        "diagramme. Deux étapes complémentaires figurent sur le diagramme. Avant l’appel "
        "au modèle, SkillNormalizationService harmonise les compétences extraites (k8s "
        "devient Kubernetes, postgres devient PostgreSQL) et conserve, après nettoyage, "
        "les termes absents du dictionnaire d’alias, afin qu’une compétence rare ne "
        "disparaisse pas du comparatif. Après le calcul, le service positionne le drapeau "
        "needsHumanReview lorsque le texte extrait est absent ou plus court de cinquante "
        "caractères, lorsqu’un écart de séniorité sévère plafonne le score, lorsque "
        "celui-ci tombe dans la zone grise comprise entre 55 et 65, ou lorsque l’API de "
        "Cohere est indisponible ; dans ce dernier cas le score est marqué SIMULATED et le "
        "dossier est dirigé vers un arbitrage humain plutôt que vers une décision "
        "automatique (section 4.4.6).",
    ),
    339: (
        "On y distingue notamment un embranchement",
        "On y distingue notamment un embranchement automatique piloté par le score de "
        "l’analyse IA : le dossier passe en CV_REVIEWED lorsque le score atteint le seuil "
        "de 60/100, en AUTO_REJECTED lorsqu’il descend sous ce seuil. Les dossiers signalés "
        "par le drapeau needsHumanReview — texte de CV inexploitable, écart de séniorité "
        "sévère plafonnant le score, zone grise de 55 à 65 ou mode dégradé — font exception "
        "à cette règle : ils rejoignent CV_REVIEWED pour un arbitrage RH et ne sont jamais "
        "rejetés automatiquement (section 4.4.6). Le statut CV_REVIEWED y garde un sens "
        "unique, le dossier est prêt pour l’examen humain, mais la plateforme ne distingue "
        "pas par un état séparé le cas où le score suffit et le cas où un arbitrage est "
        "requis : ces deux situations sont signalées par le drapeau et par le motif "
        "enregistrés, non par le statut. La décision elle-même est à deux niveaux : "
        "ACCEPTED et MANAGER_REJECTED ne sont que des avis du manager, en attente du "
        "contreseing du RH, qui seul atteint HIRED (moyennant la date de présentation des "
        "documents) ou REJECTED (moyennant un motif) ; le RH peut aussi prononcer un refus "
        "final depuis n’importe quelle étape d’évaluation, et le candidat peut se retirer "
        "(WITHDRAWN) tant que le dossier n’est pas clos. Les états véritablement terminaux "
        "(HIRED, REJECTED, WITHDRAWN) n’admettent plus aucune modification depuis "
        "l’interface d’administration ; AUTO_REJECTED ne fait plus partie de cette liste et "
        "reste entièrement révisable par le RH, qui confirme le refus après examen — "
        "REJECTED motivé, sans seconde notification au candidat — ou corrige le score, ce "
        "qui réintègre le dossier en CV_REVIEWED ; la transition vers INTERVIEW_SCHEDULED, "
        "qui suit l’avis favorable, est définie dans la note sous la figure 3.8.",
    ),
    340: (
        "Ce rejet automatique n’a rien de définitif",
        "Ce rejet automatique n’a rien de définitif, ni d’entièrement hors de contrôle "
        "humain : à tout moment, le RH ou l’Administrateur dispose de deux issues. Soit il "
        "confirme le refus après examen : le dossier passe alors en REJECTED avec un motif "
        "obligatoire, et le candidat ne reçoit pas second e-mail, la notification ayant "
        "déjà été émise par l’agent IA. Soit il corrige manuellement le score via un "
        "mécanisme de surcharge (manualScore) : la justification y est obligatoire, la "
        "correction est journalisée dans l’audit, et le dossier reprend la règle de "
        "l’embranchement automatique — une note corrigée à 60 ou plus le réintègre en "
        "CV_REVIEWED et le remet dans le pipeline, une note corrigée sous le seuil le "
        "replonge en AUTO_REJECTED, cette fois sous décision humaine assumée. Le score IA "
        "joue ainsi un rôle de filtre de présélection assisté — pas celui d’une autorité "
        "décisionnelle autonome.",
    ),
    341: (
        "Le cheminement d’une candidature à travers",
        "Le cheminement d’une candidature à travers le scoring IA peut se résumer ainsi : "
        "CV candidat → dépôt et extraction du texte du CV par le back-end → mise en file "
        "d’attente et déclenchement asynchrone de l’agent n8n « CV Parser » → rappel du "
        "back-end via POST /api/candidates/{id}/ai-score/recompute → AiScoringService + "
        "CohereClient qui interrogent l’API de Cohere → calcul du score global sur 100 → "
        "orientation automatique vers CV_REVIEWED (score ≥ 60, ou dossier signalé "
        "needsHumanReview) ou AUTO_REJECTED (score < 60 hors zone grise) → arbitrage humain "
        "possible via le mécanisme de surcharge (manualScore).",
    ),
    343: (
        "La réponse est ensuite relue côté serveur",
        "La réponse est ensuite relue côté serveur : le bloc JSON est extrait du texte "
        "renvoyé, les intitulés de clés sont tolérants aux variantes et une note écrite sous "
        "forme de texte numérique (« 86/100 ») est relue comme le nombre 86, avant "
        "bornage entre 0 et 100. En revanche, aucune valeur n’est inventée : si l’une des "
        "trois clés manque ou n’est pas lisible, l’appel échoue et le mode dégradé local "
        "prend le relais, le score étant marqué SIMULATED et signalé pour arbitrage humain "
        "(section 4.4.6). La valeur neutre de 50 demandée au modèle reste donc une "
        "consigne du prompt, non une garantie du serveur : une note absente fait échouer "
        "l’appel plutôt que d’être remplacée par un chiffre plus favorable, et un 0 "
        "explicitement renvoyé est accepté tel quel. Le score final sur 100 est la moyenne "
        "pondérée arrondie (technique × w1 + communication × w2 + séniorité × w3), où les "
        "trois poids proviennent du profil de pondération associé à la famille de métier et "
        "au niveau de séniorité de l’offre (table scoring_weight_profiles, douze profils "
        "initialisés, valeurs par défaut 0,5 / 0,2 / 0,3, somme contrôlée à 1 à ±0,01 "
        "près). Un CV noté 80 en technique, 70 en communication et 60 en séniorité obtient "
        "ainsi 72 avec les poids par défaut, ce que vérifie un test dédié. Les compétences "
        "présentées comme correspondantes ou manquantes (matchedSkills / missingSkills), en "
        "revanche, ne sont pas revendiquées par le modèle : elles sont calculées localement "
        "par le service de normalisation des compétences, à partir d’un dictionnaire d’alias "
        "et de recherches à frontière de mot, afin de ne pas reposer sur la seule parole du "
        "LLM.",
    ),
    430: (
        "La modale « Confirmer le refus »",
        "La modale « Confirmer le refus » de la figure 4.14 : le RH contre-signe le refus "
        "proposé par le manager. Le motif y est obligatoire, mais il ne part pas dans "
        "l’e-mail adressé au candidat — celui-ci ne reprend que le nom du candidat et "
        "l’intitulé de l’offre : le motif est la trace humaine de la décision, enregistrée "
        "sur le dossier (statusReason) et journalisée dans l’audit.",
    ),
}


def fr(t):
    """Reproduit la typographie du document : espace insécable avant : ; et dans « »."""
    t = t.replace("\xa0", " ")
    t = t.replace(" :", "\xa0:").replace(" ;", "\xa0;")
    return t.replace("« ", "«\xa0").replace(" »", "\xa0»")


# index du paragraphe -> remplacements localises (vieux, neuf) appliques au run unique
SUBPATCHES = {
    255: [
        ("un override justifié qui réintègre le dossier dans le pipeline.",
         "un override justifié qui le réintègre dans le pipeline, à condition "
         "que la note corrigée atteigne le seuil de 60/100."),
    ],
    311: [
        ("un ou plusieurs rôles (ERole) et un rattachement à un département",
         "un ou plusieurs rôles (ERole) et, le cas échéant, un rattachement "
         "à un département"),
    ],
    321: [
        ("Deux garde-fous ressortent de ce diagramme",
         "Trois garde-fous ressortent de ce diagramme"),
        ("la planification écarte un dossier clos (rejeté ou retiré) et refuse tout "
         "créneau",
         "la planification écarte un dossier clos (rejeté ou retiré) comme une "
         "candidature encore au stade APPLIED dont le CV n’a pas été examiné, et "
         "refuse tout créneau"),
        ("plusieurs entretiens le même jour restent possibles, jamais au même horaire.",
         "plusieurs entretiens le même jour restent possibles, jamais au même "
         "horaire. Un manager ne planifie enfin que dans son propre agenda, et "
         "pour un dossier de son périmètre."),
    ],
    325: [
        ("REJECTED exige un motif et déclenche le refus motivé.",
         "REJECTED exige un motif — enregistré sur le dossier et journalisé, non "
         "communiqué au candidat — et déclenche l’e-mail de réponse."),
        ("Un compte purement manager qui appelle ce point d’entrée, écrit HIRED ou un "
         "statut du pipeline reçoit une erreur 403.",
         "Un compte purement manager qui appelle ce point d’entrée, qu’il écrive HIRED "
         "ou un statut du pipeline, reçoit une erreur 403."),
    ],
}


def main():
    shutil.copy2(DOCX, BACKUP)
    d = Document(DOCX)
    applied = []
    for idx, (prefix, new_text) in sorted(PATCHES.items()):
        p = d.paragraphs[idx]
        expected = fr(prefix)
        assert p.text.startswith(expected), (idx, repr(p.text[:60]))
        assert len(p.runs) == 1, (idx, len(p.runs))
        p.runs[0].text = fr(new_text)
        applied.append(idx)
    for idx, subs in sorted(SUBPATCHES.items()):
        runs = [r for r in d.paragraphs[idx].runs if r.text]
        assert len(runs) == 1, (idx, len(runs))
        text = runs[0].text
        for old, new in subs:
            old, new = fr(old), fr(new)
            assert text.count(old) == 1, (idx, old[:50], text.count(old))
            text = text.replace(old, new)
        runs[0].text = text
        applied.append(idx)
    d.save(DOCX)
    print("Paragraphes touches :", applied)
    print("Sauvegarde :", BACKUP)


if __name__ == "__main__":
    main()
