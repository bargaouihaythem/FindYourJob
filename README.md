# JOB4YOU — Plateforme de recrutement assistée par IA

JOB4YOU est une plateforme web de gestion du recrutement interne. Elle centralise les offres, les candidatures, les CV, les entretiens, les feedbacks, les décisions et les notifications. Le projet est composé d’un frontend Angular, d’un backend Spring Boot, d’une base PostgreSQL et de workflows n8n optionnels pour l’orchestration des notifications et des traitements asynchrones.

## État réel de l’implémentation

Le socle fonctionnel est opérationnel dans un environnement de développement ou de démonstration. Le backend réalise l’extraction du texte des CV et le scoring par critères via Cohere lorsque la clé est configurée. En cas d’indisponibilité de Cohere, un mode dégradé est utilisé afin de ne pas bloquer le dépôt d’une candidature.

Les workflows n8n orchestrent les événements et les emails. Ils ne remplacent pas le backend : le calcul du score et les principales règles métier restent exécutés par Spring Boot. L’intégration complète avec Google Calendar et Google Meet n’est pas encore opérationnelle ; le workflow d’entretien prépare les informations et génère actuellement un lien de démonstration pour les entretiens vidéo.

## Stack technique

| Couche | Technologie | Responsabilité |
|---|---|---|
| Frontend | Angular 20, TypeScript, Bootstrap 5, RxJS | Interfaces candidat, RH, manager et administrateur |
| Backend | Java 17, Spring Boot 3.2, Spring Security | API REST, règles métier, authentification et autorisation |
| Persistance | PostgreSQL, Spring Data JPA/Hibernate | Stockage des utilisateurs, offres, candidatures, CV, entretiens et audits |
| Scoring IA | Cohere Chat API, avec fallback dégradé | Évaluation technique, communication et séniorité |
| Automatisation | n8n self-hosted, optionnel | Orchestration des notifications et des callbacks |
| Emails | Spring Mail et n8n | Notifications transactionnelles et messages de workflow |
| Documentation API | springdoc OpenAPI / Swagger | Documentation et vérification des endpoints |
| Tests | JUnit 5, Mockito, MockMvc, tests Angular | Tests unitaires et tests de contrôleur |

## Architecture et responsabilités

```text
Candidat / RH / Manager
          │
          ▼
Frontend Angular ── HTTP/JWT ──► Backend Spring Boot ──► PostgreSQL
                                      │
                                      ├── Extraction texte CV
                                      ├── Scoring Cohere ou fallback
                                      ├── Règles métier et transitions d’état
                                      ├── Audit, rappels et emails Spring
                                      └── Webhooks n8n optionnels
                                                │
                                                ▼
                                      Workflows n8n et emails
```

Le backend est la source de vérité pour les données et les règles de recrutement. n8n reçoit des événements via des webhooks, déclenche des notifications et peut rappeler le backend pour certains traitements. Les secrets et URLs de services doivent être fournis par variables d’environnement ou par un fichier local non suivi par Git.

## Workflows n8n

### Agent 1 — Candidature et scoring

Le workflow est déclenché par une nouvelle candidature. Il appelle l’endpoint backend de recalcul du score. Le backend extrait le texte du CV, appelle Cohere et applique les pondérations configurées pour les critères technique, communication et séniorité. Le workflow peut ensuite envoyer un email de confirmation enrichi avec le résultat retourné par le backend.

### Agent 2 — Planification des entretiens

Le workflow est déclenché lors de la création d’un entretien. Il envoie les informations de convocation au candidat et à l’intervieweur. La planification, les transitions de statut et les rappels sont gérés par le backend. La création réelle d’événements Google Calendar ou de liens Google Meet authentifiés reste une évolution à intégrer.

### Agent 3 — Routage RH vers manager et décision finale

Le workflow est déclenché lors de la transmission d’un dossier au manager ou lors d’une décision finale. Il envoie la notification au manager concerné et, selon le statut, un message de décision au candidat. Le filtrage du périmètre manager et la validation des transitions sont réalisés côté backend.

## Fonctionnalités disponibles

### Recrutement

La plateforme permet de publier et filtrer les offres, de déposer une candidature avec un CV, d’extraire le texte d’un CV PDF/DOC/DOCX, de suivre le statut d’un dossier, de classer les candidats par score et de réaliser un matching inverse entre un CV et des offres externes ou internes selon la configuration.

Le score IA comprend trois composantes : adéquation technique, qualité de la communication et adéquation de la séniorité. Les pondérations sont configurables. Un RH ou un administrateur peut corriger manuellement le score avec une justification obligatoire ; la correction est conservée dans l’audit.

### Gestion RH et manager

Les espaces internes comprennent la gestion des offres, des candidats, des entretiens, des feedbacks, du tableau de bord, du pipeline Kanban, des notes internes, des utilisateurs, des profils de pondération et du journal d’audit. Un manager ne doit consulter et modifier que les dossiers relevant de son périmètre métier configuré.

Chaque manager dispose également d’une page **Mon calendrier** qui présente, en lecture seule, ses entretiens du mois et ses trois prochains rendez-vous. Les données sont filtrées côté serveur selon le département, la famille de métier ou l’affectation directe du manager ; les rappels email restent planifiés deux heures avant l’entretien lorsqu’il est intervieweur.

### Notifications et rappels

Les emails de confirmation, de présélection, de convocation, de décision, d’annulation et de reprogrammation sont pris en charge selon le parcours. Des rappels d’entretien peuvent être créés par le backend. n8n est utilisé comme couche d’orchestration complémentaire lorsque les webhooks sont configurés.

### Offres externes

Le projet contient une intégration de consultation de l’API publique Remotive pour une étude comparative des offres. Aucun scraping LinkedIn n’est utilisé.

## Installation locale

### Prérequis

Java 17, Maven 3.8 ou supérieur, Node.js 18 ou supérieur, npm, PostgreSQL et, si nécessaire, n8n.

### Base de données et backend

```bash
createdb job4you_db
cd JOB4YOU-backend
mvn clean install -DskipTests
mvn spring-boot:run
```

### Frontend

```bash
cd JOB4YOU-frontend
npm install --legacy-peer-deps
npm start
```

### n8n, optionnel

```bash
npx n8n start
```

Importer ensuite les trois workflows présents dans `n8n-workflows/` et renseigner les URLs dans la configuration locale du backend.

## Configuration par variables d’environnement

Ne jamais publier de mot de passe, de clé JWT, de clé Cohere, de clé n8n ou de mot de passe SMTP dans le dépôt. Utiliser les variables suivantes dans l’environnement local :

```text
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
APP_JWT_SECRET
COHERE_API_KEY
N8N_API_KEY
SPRING_MAIL_USERNAME
SPRING_MAIL_PASSWORD
```

Les paramètres de pondération peuvent être configurés ainsi :

```properties
ai.score.weight.technical=0.5
ai.score.weight.communication=0.2
ai.score.weight.seniority=0.3
```

Sans clé Cohere ou lorsque le service est indisponible, le backend utilise un mode dégradé documenté dans `AiScoringService`.

## URLs locales par défaut

| Service | URL |
|---|---|
| Frontend | `http://localhost:4200` |
| Backend API | `http://localhost:8080` |
| Swagger UI | `http://localhost:8080/swagger-ui.html` |
| n8n | `http://localhost:5678` |

## Comptes de test

Les comptes de test ne sont pas publiés dans ce README. Ils doivent être créés localement par l’initialisation de développement ou communiqués séparément dans un environnement privé. Il est interdit de réutiliser un mot de passe de démonstration en production.

## Endpoints principaux

```text
POST  /api/candidates/apply
POST  /api/candidates/{id}/ai-score/recompute
PATCH /api/candidates/{id}/ai-score/override
GET   /api/candidates/job-offer/{jobOfferId}/ranking
PATCH /api/candidates/{id}/manager-decision
GET   /api/interviews/my-calendar?startDate=&endDate=
GET   /api/external-offers/remotive?search=&limit=
```

Les endpoints sensibles doivent être protégés par JWT, par les rôles applicatifs et par le périmètre métier du manager. Les endpoints de callback n8n doivent utiliser une clé de service ou une signature de webhook dans un environnement de production.

## Tests

Le backend contient des tests unitaires et de contrôleur couvrant notamment le workflow candidat, le seuil IA, les transitions de statut, le routage manager, l’isolation de périmètre et le calendrier manager. Après cette évolution, la suite Maven exécute **96 tests sans échec ni erreur**. Des tests d’intégration, de charge et de sécurité complémentaires restent nécessaires avant une mise en production.

## Limites connues et évolutions

Les points suivants doivent être traités avant un déploiement de production : rotation et stockage sécurisé des secrets, nettoyage de l’historique Git, migrations versionnées de base de données, protection fine des URLs de CV, analyse antivirus des fichiers, configuration CORS restrictive, signature des webhooks, intégration Google Calendar/Meet réelle, stratégie de conservation des données personnelles, tests d’intégration et pipeline CI/CD.

## Auteur

**Haythem Bargaoui** — Projet de fin d’études.

## Licence

MIT.
