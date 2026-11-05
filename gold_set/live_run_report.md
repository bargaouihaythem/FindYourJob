# Rejeu du Gold Set dans le pipeline reel de la plateforme

**Date du rejeu :** 05/11/2026 12:44:07 (rapport relit ces memes dossiers le 05/11/2026 12:45:36)
**Volet teste :** entree reelle de l'application — `POST /api/candidates/apply`, e-mail de confirmation, agent 1 n8n, `POST /api/candidates/{id}/ai-score/recompute`, score stocke sur le dossier, transition de statut appliquee.
**Dossier crees :** 20 — rollback : `node scripts/gold_set_live.mjs --rollback`.
**Adresses :** alias de la boite de test (bargaouihaythem1+goldNN@gmail.com), aucun destinataire exterieur.

## 1. Metriques sur les scores stockes dans les dossiers

| Seuil | TP | FP | TN | FN | Precision | Rappel | F1 | Exactitude |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: |
| 50 | 11 | 6 | 3 | 0 | 64.7 % | 100.0 % | 78.6 % | 70.0 % |
| 60 | 11 | 1 | 8 | 0 | 91.7 % | 100.0 % | 95.7 % | 95.0 % |
| 70 | 11 | 1 | 8 | 0 | 91.7 % | 100.0 % | 95.7 % | 95.0 % |

Delai entre la soumission du CV et le score pose sur le dossier (agent 1 n8n compris) : median 0.9 min, maximum 1.1 min sur 20 dossiers scores.

## 2. Ce que la plateforme a decide

| Statut applique | Dossier |
| :-- | --: |
| AUTO_REJECTED | 5 |
| CV_REVIEWED | 15 |

- Decision de la plateforme alignee sur la verite terrain au seuil de 60 : **16** dossier(s).
- Non alignee : **2**.
- Scores en zone grise (55-65) : la plateforme ne tranche pas, elle transmet au RH — **2** (jamais comptes comme une erreur de l'IA).
- Sans score au bout du delai d'attente (90 s) : **0**.

## 3. Detail dossier par dossier

Derniere colonne : OUI = statut aligne sur la verite terrain, NON = statut contredit par elle, « Arbitrage RH » = score en zone grise (55-65), la plateforme ecarte volontairement le rejet automatique et transmet au RH.

| ID | Candidat | Dossier | Offre | Verite terrain | Score | Source | Statut applique | HITL | Score conforme | Decision de la plateforme |
| :-- | :-- | --: | --: | :-- | --: | :-- | :-- | :--: | :--: | :-- |
| GOLD_01 | Alexandre Mercier | #159 | 115 | PERTINENT | 89 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_02 | Camille Bernard | #160 | 115 | PERTINENT | 85 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_03 | Julien Rouve | #161 | 115 | PERTINENT | 84 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_04 | Guillaume Delorme | #162 | 115 | NON_PERTINENT | 59 | COHERE | CV_REVIEWED | oui | OUI | Arbitrage RH |
| GOLD_05 | Sébastien Vasseur | #163 | 117 | PERTINENT | 91 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_06 | Nadia Khemir | #164 | 117 | PERTINENT | 88 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_07 | Thierry Gauthier | #165 | 117 | NON_PERTINENT | 54 | COHERE | AUTO_REJECTED | non | OUI | OUI |
| GOLD_08 | Éléonore Faure | #166 | 117 | NON_PERTINENT | 30 | COHERE | AUTO_REJECTED | non | OUI | OUI |
| GOLD_09 | Marc Lemaire | #167 | 122 | PERTINENT | 85 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_10 | Sophie Moreau | #168 | 122 | PERTINENT | 88 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_11 | Valérie Dubois | #169 | 122 | NON_PERTINENT | 47 | COHERE | AUTO_REJECTED | non | OUI | OUI |
| GOLD_12 | Karim Belhadj | #170 | 122 | NON_PERTINENT | 52 | COHERE | AUTO_REJECTED | non | OUI | OUI |
| GOLD_13 | Lucas Pires | #171 | 115 | NON_PERTINENT | 52 | COHERE | AUTO_REJECTED | non | OUI | OUI |
| GOLD_14 | Manon Girard | #172 | 115 | PERTINENT | 71 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_15 | Romain Mercier | #173 | 117 | NON_PERTINENT | 44 | COHERE | CV_REVIEWED | oui | OUI | NON |
| GOLD_16 | Inès Benali | #174 | 122 | PERTINENT | 81 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_17 | Hugo Delaunay | #175 | 115 | PERTINENT | 81 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_18 | Nadia Ostermann | #176 | 117 | NON_PERTINENT | 81 | COHERE | CV_REVIEWED | non | NON | NON |
| GOLD_19 | Claire Fontaine | #177 | 122 | PERTINENT | 78 | COHERE | CV_REVIEWED | non | OUI | OUI |
| GOLD_20 | Yanis Moureaux | #178 | 122 | NON_PERTINENT | 57 | COHERE | CV_REVIEWED | oui | OUI | Arbitrage RH |

## 4. Limites

- Le score depend du modele : les memes CV peuvent donner des valeurs legerement differentes d'une course a l'autre (derive constatee de 4 a 10 points sur GOLD_18 et GOLD_14).
- Vingt dossiers construits pour l'evaluation ne mesurent pas la performance en production.
- Les dossiers de cette course sont des donnees de test : a supprimer apres lecture, pour ne pas polluer le pipeline de demonstration.
