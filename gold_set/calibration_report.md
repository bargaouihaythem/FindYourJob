# Calibration du Gold Set dans l'application

- Mesuré le : 2026-11-05T21:43:22.5119966 · source des scores : COHERE
- Lecture : un seuil n'est proposé que si le noyau de référence du profil contient au moins 4 cas et que le F1 mesuré tient 90 %.

| Profil | Cas (référence) | Pertinents | Frontier | Seuil appliqué | F1 au seuil appliqué | Seuil recommandé | F1 recommandé | Marge | VP/FP/FN/VT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tous profils | 20 (20) | 11 | 30–91 | 60 (défaut) | 95.7 % | 64 | 95.7 % | 7 | 11/1/0/8 |
| CS / MID | 7 (7) | 5 | 52–89 | 60 (défaut) | 100.0 % | 64 | 100.0 % | 7 | 5/0/0/2 |
| PRODOPS / SENIOR | 6 (6) | 2 | 30–91 | 81 (calibré) | 100.0 % | 81 | 100.0 % | 7 | 2/0/0/4 |
| OTHER / MID | 7 (7) | 4 | 47–88 | 60 (défaut) | 100.0 % | 67 | 100.0 % | 10 | 4/0/0/3 |

## Étiquette « Profil Gold » sur le corpus

| Barre | Cas proposés | Dont hors cible | Références |
| --- | --- | --- | --- |
| ≥ 80 | 8 | 0 | GOLD_01, GOLD_02, GOLD_03, GOLD_05, GOLD_06, GOLD_09, GOLD_10, GOLD_16 |
| ≥ 85 | 6 | 0 | GOLD_01, GOLD_02, GOLD_05, GOLD_06, GOLD_09, GOLD_10 |
| ≥ 90 | 1 | 0 | GOLD_05 |

Barre appliquée en production : ≥ 85 (ou le seuil calibré du profil s'il est plus haut), jamais sur un dossier marqué « à arbitrer ».

## Détail par cas

| Cas | Profil | Vérité terrain | Limite | Score | Décision au seuil appliqué |
| --- | --- | --- | --- | --- | --- |
| GOLD_01 | CS/MID | PERTINENT | non | 89 | retenu |
| GOLD_02 | CS/MID | PERTINENT | non | 85 | retenu |
| GOLD_03 | CS/MID | PERTINENT | non | 84 | retenu |
| GOLD_04 | CS/MID | NON_PERTINENT | non | 57 | écarté |
| GOLD_13 | CS/MID | NON_PERTINENT | oui | 52 | écarté |
| GOLD_14 | CS/MID | PERTINENT | oui | 71 | retenu |
| GOLD_17 | CS/MID | PERTINENT | oui | 77 | retenu |
| GOLD_05 | PRODOPS/SENIOR | PERTINENT | non | 91 | retenu |
| GOLD_06 | PRODOPS/SENIOR | PERTINENT | non | 88 | retenu |
| GOLD_07 | PRODOPS/SENIOR | NON_PERTINENT | non | 54 | écarté |
| GOLD_08 | PRODOPS/SENIOR | NON_PERTINENT | non | 30 | écarté |
| GOLD_15 | PRODOPS/SENIOR | NON_PERTINENT | oui | 44 | écarté |
| GOLD_18 | PRODOPS/SENIOR | NON_PERTINENT | oui | 74 | écarté |
| GOLD_09 | OTHER/MID | PERTINENT | non | 85 | retenu |
| GOLD_10 | OTHER/MID | PERTINENT | non | 88 | retenu |
| GOLD_11 | OTHER/MID | NON_PERTINENT | non | 47 | écarté |
| GOLD_12 | OTHER/MID | NON_PERTINENT | non | 52 | écarté |
| GOLD_16 | OTHER/MID | PERTINENT | oui | 81 | retenu |
| GOLD_19 | OTHER/MID | PERTINENT | oui | 78 | retenu |
| GOLD_20 | OTHER/MID | NON_PERTINENT | oui | 57 | écarté |