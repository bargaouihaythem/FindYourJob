# Cahier des charges corrigé — JOB4YOU

## 1. Présentation du projet

JOB4YOU est une plateforme web destinée à centraliser le processus de recrutement interne. Elle permet de gérer les offres d’emploi, les candidatures, les CV, les entretiens, les feedbacks, les décisions et les notifications.

Le projet est développé avec un frontend Angular 20, un backend Spring Boot 3.2, une base PostgreSQL, un service de scoring Cohere et des workflows n8n optionnels. Le présent document décrit l’état réellement observé dans le dépôt et distingue les fonctions disponibles des évolutions encore nécessaires.

## 2. Problématique

Le processus de recrutement nécessite une meilleure centralisation des données, une traçabilité des décisions, une collaboration contrôlée entre RH et managers et une réduction des tâches répétitives. JOB4YOU répond à ces besoins par une application web à rôles, des transitions de statut contrôlées, un scoring assisté et des notifications automatisées.

## 3. Objectif général

L’objectif est de fournir une base fonctionnelle permettant de gérer le cycle de recrutement interne depuis la publication d’une offre jusqu’à la décision finale, tout en conservant une validation humaine des décisions importantes.

## 4. Objectifs fonctionnels

| Objectif | État réel |
|---|---|
| Publier, modifier, filtrer et clôturer des offres | Réalisé dans l’application |
| Recevoir des candidatures et stocker les CV | Réalisé, avec stockage local |
| Extraire le texte des CV PDF/DOC/DOCX | Réalisé côté backend |
| Calculer un score par critères technique, communication et séniorité | Réalisé via Cohere si disponible, avec fallback dégradé |
| Corriger manuellement le score avec justification | Réalisé avec audit |
| Gérer les entretiens, statuts, feedbacks et rappels | Réalisé dans le périmètre actuel |
| Appliquer un périmètre de visibilité manager | Réalisé côté backend et testé |
| Envoyer des emails transactionnels | Réalisé via Spring Mail et n8n selon le flux |
| Consulter les offres externes Remotive | Réalisé comme fonctionnalité de comparaison |
| Créer des événements Google Calendar authentifiés | Non réalisé dans le workflow actuel |
| Fournir un lien Google Meet réel | Non réalisé ; un lien de démonstration est actuellement préparé |

## 5. Acteurs

| Acteur | Responsabilités |
|---|---|
| Candidat | Consulter les offres, déposer une candidature, suivre son dossier et consulter ses entretiens |
| Responsable RH | Gérer les offres, examiner les candidatures, valider les dossiers, planifier les étapes et contrôler les décisions |
| Manager | Consulter les dossiers de son périmètre, participer à l’évaluation, fournir un feedback et prendre une décision autorisée |
| Administrateur | Gérer les utilisateurs, les rôles, les départements, les profils de pondération et l’audit |
| Backend | Appliquer les règles métier, sécuriser les accès, persister les données et orchestrer les traitements |
| n8n | Orchestrer des notifications et des callbacks lorsque les webhooks sont activés |
| Cohere | Fournir le scoring structuré et le matching lorsque la clé de service est configurée |

## 6. Règles métier principales

Une candidature possède un cycle de vie contrôlé. Les transitions incohérentes, les décisions sur un dossier non examiné et la planification d’un entretien sur un dossier clos doivent être refusées par le backend.

Le score IA est une aide à la présélection. Le seuil actuel est de 60/100. Une correction manuelle nécessite une justification et doit être journalisée. Un rejet automatique doit pouvoir être réexaminé selon les règles du rôle RH ou administrateur.

Un manager ne doit consulter et modifier que les dossiers relevant de son offre, de son département ou de son périmètre métier configuré. Ce contrôle doit être appliqué aux routes de lecture comme aux routes d’écriture.

## 7. Scoring et intelligence artificielle

Le backend construit un texte à partir du contenu extrait du CV et, si nécessaire, de la lettre de motivation. Cohere reçoit un prompt structuré et doit retourner trois valeurs comprises entre 0 et 100 :

- score technique ;
- score de communication ;
- score d’adéquation de la séniorité.

Les pondérations par défaut sont configurées à 50 % pour la technique, 20 % pour la communication et 30 % pour la séniorité. Elles peuvent être adaptées par profil de métier selon la configuration du projet.

Lorsque Cohere est indisponible ou non configuré, le backend utilise un mode dégradé. Ce mode garantit la continuité du dépôt de candidature, mais il ne doit pas être présenté comme une évaluation IA équivalente à Cohere.

L’IA ne doit pas être considérée comme l’autorité finale de recrutement. Les résultats doivent rester explicables, révisables et soumis à une validation humaine.

## 8. Architecture technique

```text
Frontend Angular 20
        │ HTTP/JWT
        ▼
Backend Spring Boot 3.2
        ├── API REST et règles métier
        ├── Spring Security et JWT
        ├── Extraction des CV
        ├── Scoring Cohere ou fallback
        ├── Audit et rappels
        └── Webhooks n8n optionnels
                │
                ▼
PostgreSQL + services de notification
```

Le calcul principal du score est exécuté par le backend. n8n orchestre les notifications et certains flux asynchrones. Cette distinction doit être conservée dans la documentation technique et dans le rapport PFE.

## 9. Workflows n8n

### Agent 1 — Candidature et scoring

Le workflow reçoit l’événement de candidature, demande au backend de recalculer le score et peut envoyer un email enrichi. L’extraction du CV et l’appel Cohere sont réalisés par le backend.

### Agent 2 — Planification des entretiens

Le workflow reçoit l’événement de création d’un entretien et envoie les informations au candidat et à l’intervieweur. Le backend conserve l’entretien, met à jour le statut et crée les rappels. Google Calendar et Google Meet ne sont pas encore intégrés de façon authentifiée.

### Agent 3 — Routage RH vers manager et décision finale

Le workflow transmet les informations utiles au manager et envoie l’email correspondant à la décision finale. Le backend reste responsable de l’autorisation et de la transition de statut.

## 10. Sécurité et données personnelles

Les mots de passe doivent être hachés avec BCrypt et les routes doivent être protégées par Spring Security et JWT. Les règles de rôle doivent être complétées par un contrôle du périmètre métier pour les managers.

Les CV et données de candidature sont des données personnelles. Le système doit prévoir une politique de conservation, une suppression contrôlée, une limitation des accès, une protection des URLs de fichiers, une validation approfondie du contenu téléversé et une analyse antivirus avant un déploiement de production.

Les clés Cohere, JWT, n8n, SMTP et PostgreSQL ne doivent jamais être inscrites en clair dans le dépôt. Elles doivent être injectées par des variables d’environnement ou par une configuration locale ignorée par Git. Tout secret déjà exposé doit être révoqué et renouvelé, puis retiré de l’historique Git.

## 11. Tests et validation

Le dépôt contient huit classes de tests backend couvrant notamment le scoring, les transitions, les workflows candidats, le routage manager et les contrôles de sécurité. Le nombre de méthodes annotées `@Test` doit être recalculé à chaque version ; la branche inspectée contient environ 90 méthodes.

Avant un déploiement de production, il est nécessaire d’ajouter ou de documenter :

- tests d’intégration avec une base PostgreSQL de test ;
- tests d’intégration des webhooks n8n ;
- tests de sécurité sur les callbacks et les téléchargements de CV ;
- tests de charge et de temps de réponse ;
- rapport de couverture de code ;
- tests de non-régression du cycle de vie des candidatures.

## 12. Installation et déploiement

Le projet peut être démarré localement avec Java 17, Maven, Node.js, PostgreSQL et, si nécessaire, n8n. Des fichiers Docker sont présents pour faciliter un déploiement local, mais la préparation à la production exige encore la gestion des secrets, des migrations versionnées, du HTTPS, des sauvegardes, de la supervision et d’une configuration CORS restrictive.

## 13. Livrables

Les livrables sont :

1. le frontend Angular ;
2. le backend Spring Boot ;
3. les scripts et configurations PostgreSQL ;
4. les trois workflows n8n ;
5. la collection Postman et la documentation Swagger ;
6. la documentation technique et le rapport PFE ;
7. les tests backend et frontend présents dans le dépôt.

## 14. Évolutions prévues

Les évolutions prioritaires sont l’intégration authentifiée de Google Calendar et Google Meet, le stockage sécurisé ou externalisé des CV, l’analyse antivirus, le nettoyage de l’historique Git, la mise en place de migrations Flyway ou Liquibase, l’ajout d’une CI/CD, la couverture de tests complémentaire et la formalisation de la conservation des données personnelles.

## 15. Statut du projet

**Statut recommandé : prototype fonctionnel ou pilote interne en environnement de développement.** Le projet ne doit pas être décrit comme totalement prêt pour la production tant que les secrets, les URLs de CV, les webhooks, la protection des données et les intégrations externes ne sont pas durcis.

**Auteur :** Haythem Bargaoui — Projet de fin d’études.
