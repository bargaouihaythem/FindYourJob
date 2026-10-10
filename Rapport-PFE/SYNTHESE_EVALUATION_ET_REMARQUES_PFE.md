# Synthèse des Améliorations & Évaluations Expérimentales (Remarques PFE)

**Auteur :** Haythem Bargaoui  
**Entreprise d'accueil :** Sopra HR Software  
**Projet :** JOB4YOU — Plateforme de Recrutement Intelligent assistée par IA & Automatisation n8n  
**Date :** Octobre 2026  

---

## 1. Remarque 1 — Constitution du Gold Set & Évaluation Métrique du Matching

### 1.1. Méthodologie et Corpus de Référence
Pour évaluer objectivement la pertinence du moteur de matching sans compromettre la confidentialité des données réelles de Sopra HR Software, un **Gold Set de référence** composé de **16 CVs synthétiques complets au format PDF** a été constitué et annoté selon des critères RH explicites.

> [!NOTE]
> **Caractère préliminaire de l'évaluation :**
> Ce benchmark constitue une **évaluation expérimentale préliminaire** sur un corpus de test représentatif de 16 profils (comprenant des cas évidents et des cas limites/borderline). Les scores présentés sont issus de l'exécution dynamique réelle du moteur d'IA (API Cohere avec extraction PDF par Apache PDFBox et normalisation), et non de valeurs prédéterminées ou statiques.

Le corpus couvre les trois grands métiers de Sopra HR Software :
1. **R&D / Produits SIRH (Offre 115) :** Profils Développeur Backend & Full Stack Java / Spring Boot / Angular (Senior, Intermédiaire, Débutant, Reconversion C++, et hors-sujet PHP/Symfony).
2. **ProdOps / Plateforme SaaS RH (Offre 117) :** Profils Ingénieurs DevOps / Cloud (Senior AWS/K8s, Intermédiaire Azure/Docker, Technicien Linux borderline, Admin Réseau traditionnel, et UI/UX designer).
3. **Consulting Services (CS - Offre 122) :** Consultants Fonctionnels SIRH, Paie & Business Analysts (Consultant SIRH Senior, BA Agile, QA/Recette borderline, Comptable généraliste, et Data Scientist).

Chaque profil est associé à une vérité terrain binaire (`PERTINENT` vs `NON_PERTINENT`) établie sur des critères métier formalisés.

---

### 1.2. Résultats Expérimentaux & Matrice de Confusion

L'exécution du benchmark automatisé (`scripts/evaluate_gold_set.js`) sur l'ensemble des 16 profils produit les métriques réelles suivantes :

| Seuil de Décision | Vrais Positifs (TP) | Faux Positifs (FP) | Vrais Négatifs (TN) | Faux Négatifs (FN) | Précision | Rappel (Recall) | F1-Score | Exactitude (Accuracy) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Seuil = 50** | 9 | 0 | 7 | 0 | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| **Seuil = 60 (Standard)** | **9** | **0** | **7** | **0** | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| **Seuil = 70** | 8 | 0 | 7 | 1 | **100.0%** | **88.9%** | **94.1%** | **93.8%** |

---

### 1.3. Analyse Critique des Seuils & Nuances Méthodologiques

L'observation des résultats expérimentaux appelle deux nuances scientifiques essentielles :

1. **Équivalence observée entre 50 et 60 sur ce corpus :**
   - Sur ces 16 profils, les seuils 50 et 60 produisent une classification identique (aucun profil du jeu de test ne se situe entre 50 et 60).
   - Le maintien du seuil de 60 se justifie donc comme un **compromis opérationnel raisonnable** retenu par l'application JOB4YOU, mais ne constitue pas une démonstration statistique définitive d'optimalité absolue en environnement de production réel.
2. **Interprétation de la marge observée :**
   - La marge de 13 points observée entre le score du profil non pertinent le mieux noté (47/100 pour `GOLD_13`) et le seuil de 60 est une **propriété mesurée sur ce jeu de test contrôlé**, et non une garantie d'infaillibilité sur des candidatures réelles non standardisées.
3. **Comportement du Seuil = 70 (Sur-sélection démontrée) :**
   - Le profil `GOLD_14` (*Manon Girard*, développeuse Java junior avec 2 ans d'expérience maîtrisant Spring Boot et PostgreSQL, mais sans Kubernetes ni Cloud) obtient un score réel de **69/100**.
   - À seuil 60 : elle est conservée (**Vrai Positif**).
   - À seuil 70 : elle est éliminée par le filtre (**Faux Négatif**), provoquant une baisse du Rappel à **88.9%** et du F1-Score à **94.1%**.
   - Cela prouve empiriquement qu'un seuil trop élevé risque de rejeter des profils juniors à fort potentiel.

---

## 2. Remarque 2 — Gestion des Erreurs de l’IA & Intervention Humaine (Human-in-the-Loop)

### 2.1. Détection des Anomalies et Cas Limites
Le système intègre dans `AiScoringService.java` une détection automatique des scénarios nécessitant un arbitrage humain (`needsHumanReview = true`) :
1. **Échec d'extraction textuelle du CV :** Fichier non textuel, scan image sans OCR ou document corrompu (`extractedText == null` ou longueur < 50 caractères).
2. **Score en zone grise incertaine (55 à 65/100) :** Candidat situé à proximité immédiate du seuil critique (60), pour lequel un rejet automatique arbitraire présenterait un risque de biais.
3. **Mode de secours dégradé (Fallback) :** En cas d'indisponibilité de l'API IA distante (erreur réseau, timeout HTTP, quota dépassé ou JSON invalide), le système bascule sur l'algorithme local, calcule le score de secours et active obligatoirement la demande de validation humaine.

### 2.2. Précision sur le Score Technique de Secours
En mode de secours dégradé (`source = "SIMULATED"`), le score technique est calculé localement selon la formule :
$$\text{TechnicalScore} = \max\left(30, \, \text{round}(\text{TechnicalMatchRate} \times 100)\right)$$
- Le plancher de **30 points** est un garde-fou technique destiné à éviter des notes nulles en cas de légères divergences d'écriture.
- Il s'agit explicitement d'un **score technique de secours dégradé**, qui ne remplace pas une évaluation IA complète et justifie pleinement l'activation du drapeau `needsHumanReview = true`.

### 2.3. Validation de Bout en Bout du Mécanisme de Reprise & Traçabilité
Le flux a été validé de bout en bout via `scripts/test_hitl_and_audit_e2e.js` :
1. **Soumission d'un CV non textuel :** Détection immédiate par l'analyse IA.
2. **Protection du candidat :** Orientation vers `CV_REVIEWED` avec `needsHumanReview = true` et motif explicite :  
   *« Échec d'extraction du texte du CV : vérification manuelle obligatoire du document. »*
3. **Intervention du recruteur RH :** Utilisation de l'endpoint de surcharge `PATCH /api/candidates/{id}/ai-score/override` avec note manuelle (75/100) et justification obligatoire.
4. **Acquittement automatique :** Le flag `needsHumanReview` repasse à `false` et le statut est confirmé en `CV_REVIEWED`.
5. **Traçabilité `AuditLog` :** Enregistrement dans la table `audit_logs` des attributs réels :
   - `entityType` : `"CANDIDATE"`
   - `entityId` : ID du candidat
   - `action` : `"SCORE_OVERRIDE"`
   - `oldValue` : ancien score (50)
   - `newValue` : nouveau score et motif (`"75 (motif : Correction manuelle RH...) "`)
   - `performedBy` : nom du recruteur connecté (`"rh"`)
   - `performedAt` : horodatage automatique de la décision

---

## 3. Remarque 3 — Amélioration du Matching, Normalisation & Explicabilité (XAI)

### 3.1. Normalisation Strictement Contrôlée (Validation Empirique)
Le service `SkillNormalizationService` garantit l'absence totale de fusions abusives :
- **Spring Cloud vs Spring Boot :** Un CV contenant *Spring Cloud* sans *Spring Boot* voit *Spring Boot* classé dans `missingSkills` et non dans `matchedSkills`.
- **AngularJS vs Angular :** Un CV contenant *AngularJS* (v1 legacy) ne valide pas l'exigence *Angular* (v2+).
- **JavaScript vs Java :** Un CV contenant *JavaScript* ne valide pas par sous-chaîne la compétence *Java*.

### 3.2. Explicabilité Dédiée aux Recruteurs (Explainable AI)
L'évaluation produit une fiche d'explicabilité complète :
- **Compétences validées (`matchedSkills`) :** Visualisées sous forme de badges verts dans l'interface candidat RH.
- **Compétences manquantes (`missingSkills`) :** Signalées sous forme de badges d'attention rouges/oranges.
- **Concordance de séniorité :** Analyse du niveau d'expérience constaté vs requis.
- **Justification rédigée :** Synthèse explicative rédigée automatiquement, visible par les recruteurs.
