# Matrice d’aiguillage RH → manager destinataire

**Date :** 05/11/2026 13:18:21 — lecture seule, aucune transmission déclenchée.
**Dossiers testés :** 20 (les 20 dossiers du rejeu du Gold Set, scores réels).
**Règle testée :** `ManagerRoutingService.resolve` — manager désigné sur l’offre, puis département, puis famille de métier, puis e-mail historique. **Le score IA n’entre dans aucune branche.**

## 1. Annuaire des managers (la donnée qui décide)

| Département | Managers rattachés |
| :-- | :-- |
| (sans département) | Admin JOB4YOU, Marwen Demmo |
| Consulting Services | Manager CS (Consulting), Pierre Durand (Manager CS) |
| DevOps | Karim DevOps (Manager DevOps) |
| ProdOps | Marc ProdOps (Manager ProdOps) |
| Quality Assurance | Khaled Gharbi (Manager QA) |
| Recherche & Développement | Paul Martin (Manager R&D) |

## 2. Rattachement des offres utilisées par les dossiers testés

| Offre | Titre | Département | Manager désigné | Famille de métier | E-mail historique |
| --: | :-- | :-- | :-- | :-- | :-- |
| 115 | Développeur Backend Java/Spring | Consulting Services | (aucun) | CS | (aucun) |
| 117 | DevOps Engineer - Mission Freelance | ProdOps | (aucun) | PRODOPS | (aucun) |
| 122 | Business Analyst - CDD 18 mois | (aucun) | (aucun) | OTHER | (aucun) |

## 3. Destination résolue par la plateforme, dossier par dossier

| Gold | Dossier | Candidat | Offre | Score | Statut | Base d’aiguillage | Destinataire proposé |
| :-- | --: | :-- | --: | --: | :-- | :-- | :-- |
| GOLD_01 | #159 | Alexandre Mercier | 115 | 89 | CV_REVIEWED | le département de l’offre | Manager CS (Consulting) <manager1@exemple.com>, Pierre Durand (Manager CS) <manager.cs@job4you.com> |
| GOLD_02 | #160 | Camille Bernard | 115 | 85 | CV_REVIEWED | le département de l’offre | Manager CS (Consulting) <manager1@exemple.com>, Pierre Durand (Manager CS) <manager.cs@job4you.com> |
| GOLD_03 | #161 | Julien Rouve | 115 | 84 | CV_REVIEWED | le département de l’offre | Manager CS (Consulting) <manager1@exemple.com>, Pierre Durand (Manager CS) <manager.cs@job4you.com> |
| GOLD_04 | #162 | Guillaume Delorme | 115 | 59 | CV_REVIEWED | le département de l’offre | Manager CS (Consulting) <manager1@exemple.com>, Pierre Durand (Manager CS) <manager.cs@job4you.com> |
| GOLD_05 | #163 | Sébastien Vasseur | 117 | 91 | CV_REVIEWED | le département de l’offre | Marc ProdOps (Manager ProdOps) <manager.prodops@job4you.com> |
| GOLD_06 | #164 | Nadia Khemir | 117 | 88 | CV_REVIEWED | le département de l’offre | Marc ProdOps (Manager ProdOps) <manager.prodops@job4you.com> |
| GOLD_07 | #165 | Thierry Gauthier | 117 | 54 | AUTO_REJECTED | le département de l’offre | Marc ProdOps (Manager ProdOps) <manager.prodops@job4you.com> |
| GOLD_08 | #166 | Éléonore Faure | 117 | 30 | AUTO_REJECTED | le département de l’offre | Marc ProdOps (Manager ProdOps) <manager.prodops@job4you.com> |
| GOLD_09 | #167 | Marc Lemaire | 122 | 85 | CV_REVIEWED | la famille de métier de l’offre | Karim DevOps (Manager DevOps) <manager.devops@job4you.com> |
| GOLD_10 | #168 | Sophie Moreau | 122 | 88 | CV_REVIEWED | la famille de métier de l’offre | Karim DevOps (Manager DevOps) <manager.devops@job4you.com> |
| GOLD_11 | #169 | Valérie Dubois | 122 | 47 | AUTO_REJECTED | la famille de métier de l’offre | Karim DevOps (Manager DevOps) <manager.devops@job4you.com> |
| GOLD_12 | #170 | Karim Belhadj | 122 | 52 | AUTO_REJECTED | la famille de métier de l’offre | Karim DevOps (Manager DevOps) <manager.devops@job4you.com> |
| GOLD_13 | #171 | Lucas Pires | 115 | 52 | AUTO_REJECTED | le département de l’offre | Manager CS (Consulting) <manager1@exemple.com>, Pierre Durand (Manager CS) <manager.cs@job4you.com> |
| GOLD_14 | #172 | Manon Girard | 115 | 71 | CV_REVIEWED | le département de l’offre | Manager CS (Consulting) <manager1@exemple.com>, Pierre Durand (Manager CS) <manager.cs@job4you.com> |
| GOLD_15 | #173 | Romain Mercier | 117 | 44 | CV_REVIEWED | le département de l’offre | Marc ProdOps (Manager ProdOps) <manager.prodops@job4you.com> |
| GOLD_16 | #174 | Inès Benali | 122 | 81 | CV_REVIEWED | la famille de métier de l’offre | Karim DevOps (Manager DevOps) <manager.devops@job4you.com> |
| GOLD_17 | #175 | Hugo Delaunay | 115 | 81 | CV_REVIEWED | le département de l’offre | Manager CS (Consulting) <manager1@exemple.com>, Pierre Durand (Manager CS) <manager.cs@job4you.com> |
| GOLD_18 | #176 | Nadia Ostermann | 117 | 81 | CV_REVIEWED | le département de l’offre | Marc ProdOps (Manager ProdOps) <manager.prodops@job4you.com> |
| GOLD_19 | #177 | Claire Fontaine | 122 | 78 | CV_REVIEWED | la famille de métier de l’offre | Karim DevOps (Manager DevOps) <manager.devops@job4you.com> |
| GOLD_20 | #178 | Yanis Moureaux | 122 | 57 | CV_REVIEWED | la famille de métier de l’offre | Karim DevOps (Manager DevOps) <manager.devops@job4you.com> |

## 4. Ce que la matrice démontre

- Bases d’aiguillage rencontrées : `le département de l’offre` (13 dossier(s)), `la famille de métier de l’offre` (7 dossier(s)).
- Destinataires distincts observés sur les 20 dossiers : **3**.
- Les destinations diffèrent selon l’offre testée : l’aiguillage suit bien le rattachement de l’offre (§2), il n’est pas figé sur un compte.
- Le score n’intervient pas : deux dossiers du même département, l’un à 30 et l’autre à 91, reçoivent la même destination.

## 5. Comment le vérifier soi-même en trois gestes

1. Côté RH, **Offres d’emploi** → modifier une offre → *département* : choisir un autre département, enregistrer.
2. Ouvrir un dossier rattaché à cette offre → statut **« Test technique »** → la modale de transmission propose désormais les managers de l’autre département (la base affichée passe de « le département de l’offre » à un autre rattachement si le département est vide).
3. Désigner un **manager recruteur** sur l’offre : la proposition passe immédiatement à « le manager désigné sur l’offre », qui prime sur le département.
