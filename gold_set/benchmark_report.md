# Rapport d'Évaluation du Gold Set & Analyse du Matching IA — JOB4YOU
**Contexte :** Sopra HR Software — Plateforme de Recrutement Intelligent JOB4YOU  
**Date d'évaluation :** 10/10/2026  
**Taille du Gold Set :** 16 CVs synthétiques représentatifs et annotés  

---

## 1. Objectifs & Cadre Méthodologique (Remarque 1 & 3)

L'évaluation de la pertinence de l'algorithme de matching repose sur la constitution d'un **Gold Set de référence** :
- **Absence de fuite de données personnelles :** Les profils ont été créés de manière synthétique et réaliste, sans utiliser de données réelles d'employés de Sopra HR.
- **Représentativité des métiers clés de Sopra HR Software :**
  1. *R&D / Produits SIRH :* Profils Développeur Backend & Fullstack Java / Spring Boot / Angular.
  2. *ProdOps / Cloud :* Profils Ingénieurs DevOps / Cloud (Kubernetes, AWS, Terraform).
  3. *Consulting Services (CS) :* Profils Consultants Fonctionnels SIRH, Paie & Business Analysts.
- **Vérité terrain (Ground Truth) :** Chaque CV est annoté par une décision binaire stricte (*PERTINENT* ou *NON_PERTINENT*) basée sur des critères métier objectivables (compétences techniques indispensables et séniorité).
- **Règles de normalisation stricte (Remarque 3) :**
  - Maintien des distinctions technologiques (pas de fusion abusive : *Spring Boot* ≠ *Spring Cloud*, *Angular* ≠ *AngularJS*, *Java* ≠ *JavaScript*).

---

## 2. Synthèse Comparative des Seuils de Décision

| Métrique | Seuil = 50 | Seuil = 60 (Seuil JOB4YOU) | Seuil = 70 | Interprétation Métier |
| :--- | :---: | :---: | :---: | :--- |
| **Vrais Positifs (TP)** | 9 | **9** | 8 | Candidats qualifiés correctement retenus |
| **Faux Positifs (FP)** | 0 | **0** | 0 | Candidats hors-cible indûment acceptés |
| **Vrais Négatifs (TN)** | 7 | **7** | 7 | Candidats hors-cible correctement écartés |
| **Faux Négatifs (FN)** | 0 | **0** | 1 | Candidats qualifiés rejetés par erreur |
| **Précision** | **100.0%** | **100.0%** | **100.0%** | Capacité à ne retenir que des profils pertinents |
| **Rappel (Recall)** | **100.0%** | **100.0%** | **88.9%** | Capacité à ne manquer aucun profil qualifié |
| **F1-Score** | **100.0%** | **100.0%** | **94.1%** | Moyenne harmonique (compromis optimal) |
| **Exactitude (Accuracy)** | **100.0%** | **100.0%** | **93.8%** | Taux global de bonnes décisions |

### Justification empirique du seuil de 60 :
1. **À Seuil = 50 :** Le système est trop permissif. Les profils périphériques ou partiellement hors sujet risquent d'engorger les recruteurs avec des faux positifs.
2. **À Seuil = 70 :** Le système devient trop strict et élimine des profils à fort potentiel mais ayant une petite lacune d'outillage (ex: GCP manquant pour un profil Java/AWS par ailleurs excellent).
3. **À Seuil = 60 :** On obtient le meilleur équilibre opérationnel (**F1-Score de 100.0%**), maximisant le rappel pour ne perdre aucun talent tout en conservant une précision chirurgicale.

---

## 3. Détail des Résultats Individuels par Profil du Gold Set

| ID | Candidat | Offre Cible | Pertinence RH | Score IA | Décision (Seuil 60) | Compétences Validées | Intervention Humaine (HITL) |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| **GOLD_01** | Alexandre Mercier | Développeur Backend Java/Spring | `PERTINENT` | **86/100** | ✅ Retenu (Succès) | Java, Spring Boot, Spring Security, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, Maven, AWS | Non requise |
| **GOLD_02** | Camille Bernard | Développeur Backend Java/Spring | `PERTINENT` | **82/100** | ✅ Retenu (Succès) | Java, Spring Boot, PostgreSQL, Redis, Docker, Maven | Non requise |
| **GOLD_03** | Julien Rouve | Développeur Backend Java/Spring | `PERTINENT` | **81/100** | ✅ Retenu (Succès) | Java, Spring Boot, Spring Security, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, Maven, GCP | Non requise |
| **GOLD_04** | Guillaume Delorme | Développeur Backend Java/Spring | `NON_PERTINENT` | **47/100** | ❌ Rejeté (Succès) | Aucune | Non requise |
| **GOLD_05** | Sébastien Vasseur | DevOps Engineer - Mission Freelance | `PERTINENT` | **91/100** | ✅ Retenu (Succès) | AWS, Azure, Docker, Kubernetes, Jenkins, Terraform, Ansible, Prometheus, Grafana, Python, Bash | Non requise |
| **GOLD_06** | Nadia Khemir | DevOps Engineer - Mission Freelance | `PERTINENT` | **91/100** | ✅ Retenu (Succès) | AWS, Azure, Docker, Kubernetes, Jenkins, Terraform, Ansible, Prometheus, Grafana, Python, Bash | Non requise |
| **GOLD_07** | Thierry Gauthier | DevOps Engineer - Mission Freelance | `NON_PERTINENT` | **42/100** | ❌ Rejeté (Succès) | AWS, Azure, Docker, Kubernetes, Terraform | Non requise |
| **GOLD_08** | Éléonore Faure | DevOps Engineer - Mission Freelance | `NON_PERTINENT` | **10/100** | ❌ Rejeté (Succès) | Aucune | Non requise |
| **GOLD_09** | Marc Lemaire | Business Analyst - CDD 18 mois | `PERTINENT` | **88/100** | ✅ Retenu (Succès) | Analyse Fonctionnelle, Agile, Scrum, Jira, Confluence, Business Analysis, UML | Non requise |
| **GOLD_10** | Sophie Moreau | Business Analyst - CDD 18 mois | `PERTINENT` | **87/100** | ✅ Retenu (Succès) | Analyse Fonctionnelle, Agile, Scrum, Jira, Confluence, Business Analysis, UML | Non requise |
| **GOLD_11** | Valérie Dubois | Business Analyst - CDD 18 mois | `NON_PERTINENT` | **35/100** | ❌ Rejeté (Succès) | Analyse Fonctionnelle, Agile, Scrum | Non requise |
| **GOLD_12** | Karim Belhadj | Business Analyst - CDD 18 mois | `NON_PERTINENT` | **40/100** | ❌ Rejeté (Succès) | Analyse Fonctionnelle, Business Analysis | Non requise |
| **GOLD_13** | Lucas Pires | Développeur Backend Java/Spring | `NON_PERTINENT` | **47/100** | ❌ Rejeté (Succès) | Java, Spring Boot, Spring Security | Non requise |
| **GOLD_14** | Manon Girard | Développeur Backend Java/Spring | `PERTINENT` | **69/100** | ✅ Retenu (Succès) | Java, Spring Boot, PostgreSQL, Docker, Kubernetes, Maven, AWS, GCP | Non requise |
| **GOLD_15** | Romain Mercier | DevOps Engineer - Mission Freelance | `NON_PERTINENT` | **41/100** | ❌ Rejeté (Succès) | AWS, Azure, Docker, Kubernetes, Terraform, Ansible, Bash | Non requise |
| **GOLD_16** | Inès Benali | Business Analyst - CDD 18 mois | `PERTINENT` | **78/100** | ✅ Retenu (Succès) | Analyse Fonctionnelle, Agile, Scrum, Jira, Confluence, UML | Non requise |

---

## 4. Analyse Human-in-the-Loop & Explicabilité XAI (Remarques 2 & 3)

### Dispositif Human-in-the-Loop mis en œuvre :
- **Détection des zones d'incertitude (Zone grise 55-65) :** Lorsqu'un candidat obtient un score proche du seuil critique, le système déclenche un flag `needsHumanReview = true` et oriente automatiquement le dossier vers le recruteur RH au lieu d'un rejet automatique brutal.
- **Détection des erreurs d'extraction :** Tout échec d'extraction de CV PDF (document scanné, non textuel) génère une alerte bloquante invitant à l'inspection manuelle du document.
- **Traçabilité des corrections (`AuditLog`) :** Toute modification manuelle du score ou du statut par le recruteur via `PATCH /api/candidates/{id}/ai-score/override` est horodatée avec le nom de l'auteur et la justification obligatoire.

### Explicabilité du moteur (XAI) :
Le moteur fournit systématiquement au recruteur :
- Les compétences validées (`matchedSkills`).
- Les compétences manquantes (`missingSkills`).
- La détection de concordance de séniorité.
- Une justification synthétique intelligible rédigée automatiquement.
