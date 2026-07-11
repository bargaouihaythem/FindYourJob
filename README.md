# JOB4YOU — AI-assisted Recruitment Platform

> Plateforme de recrutement intelligente avec agents IA intégrés (n8n) pour l'analyse automatique de CV, les notifications RH et la planification d'entretiens.

## Stack Technique

| Couche | Technologie | Rôle |
|---|---|---|
| **Frontend** | Angular 20 + Bootstrap 5 | Interface candidat, RH, manager |
| **Backend** | Spring Boot 3.2 + JWT | Logique métier, sécurité, API REST |
| **Automation IA** | n8n (self-hosted) | Orchestration des emails, calendrier, décisions |
| **Scoring IA** | Cohere (Chat API) | Score CV par critères (technique/communication/séniorité), fallback simulé automatique |
| **Base de données** | PostgreSQL 15 | Persistance |
| **Email** | Gmail SMTP | Notifications transactionnelles |

## Architecture Multi-Agents

```
  Candidat          RH / Manager         n8n (Automation IA)        Externe
     │                   │                       │                      │
     │── POST /apply ────►                       │                      │
     │                   │── triggerAgent1() ───►│ Agent 1 : score CV   │
     │                   │   (asynchrone)        │  (Cohere / fallback) │
     │                   │                       │── email confirmation ► Gmail
     │                   │                       │── callback score ────► Spring Boot
     │                   │                       │                      │
     │                   │── PATCH /status ──────►                      │
     │                   │   (CV_REVIEWED)       │ Agent 2 : profil     │
     │                   │                       │  retenu + entretien  │
     │                   │                       │── email candidat ───► Gmail
     │                   │                       │                      │
     │                   │── PATCH /status ──────►                      │
     │                   │   (validation RH)     │ Agent 3 : RH→Manager │
     │                   │── manager-decision ───►│  + décision finale   │
     │                   │                       │── email manager ────► Gmail
     │                   │                       │── email candidat ───► Gmail
```

### Agent 1 — CV Parser & Scorer
- Déclencheur : nouvelle candidature (`POST /api/candidates/apply`)
- Actions n8n : parse CV, email de confirmation candidat
- Score IA : recalculé via `AiScoringService` (Cohere Chat API), avec 3 critères pondérés — technique / communication / adéquation séniorité. Bascule automatique en mode simulé si l'API IA est indisponible (aucun blocage du flux de candidature)

### Agent 2 — Profil retenu & Planification entretien
- Déclencheur : passage en `CV_REVIEWED` (score IA ≥ seuil ou validation RH)
- Actions n8n : email "profil retenu" au candidat, notification email lors de la planification d'un entretien (`POST /api/interviews`)

### Agent 3 — RH → Manager & Décision finale
- Déclencheur : validation RH (`CV_REVIEWED`) ou décision finale (`ACCEPTED` / `AUTO_REJECTED` / `MANAGER_REJECTED`)
- Actions n8n : notifie le manager avec le dossier complet, branche conditionnelle (accepté → email manager, rejeté → email de refus au candidat)

## Fonctionnalités

### Recrutement
- Offres d'emploi avec filtres (domaine, contrat, localisation)
- Candidatures avec upload CV (PDF)
- Score IA par critères (technique / communication / séniorité) affiché dans le dashboard admin
- Correction manuelle du score IA par le RH (avec justification, traçabilité)
- Classement (ranking) des candidats par offre selon le score effectif
- Suivi de statut candidature en temps réel

### Gestion RH & Manager
- Tableau de bord avec statistiques + score IA moyen
- Validation administrative des candidatures (RH)
- Décision manager (accepter/refuser) sur les dossiers déjà validés par le RH, avec garde-fou (refuse si le dossier n'a pas encore été validé)
- Planning des entretiens avec vue calendrier mensuelle
- Système de feedback post-entretien
- Étude comparative du marché de l'emploi via l'API publique Remotive (alternative légale au scraping LinkedIn, non implémenté car contraire aux conditions d'utilisation de LinkedIn)

### Notifications
- Email de confirmation immédiat (Spring Boot)
- Email enrichi par IA avec score CV (n8n Agent 1)
- Email "profil retenu" + invitation entretien (n8n Agent 2)
- Notification manager + décision finale accepté/refusé (n8n Agent 3)

## Installation

### Prérequis
- Java 17+, Maven 3.8+
- Node.js 18+, npm
- PostgreSQL 15
- n8n (optionnel — la plateforme fonctionne sans, avec scoring en mode simulé)

### 1. Base de données
```sql
CREATE DATABASE job4you_db;
```

### 2. Backend
```bash
cd JOB4YOU-backend
mvn clean install -DskipTests
mvn spring-boot:run
```

### 3. Frontend
```bash
cd JOB4YOU-frontend
npm install --legacy-peer-deps
npm start
```

### 4. n8n (optionnel)
```bash
npx n8n start
# Ouvrir http://localhost:5678
# Importer les workflows depuis /n8n-workflows/
# Copier les webhook URLs dans JOB4YOU-backend/src/main/resources/application.properties
```

## Configuration

### n8n
Dans `JOB4YOU-backend/src/main/resources/application.properties` :

```properties
n8n.webhook.agent1=http://localhost:5678/webhook/agent1-cv-parser
n8n.webhook.agent2=http://localhost:5678/webhook/agent2-entretien
n8n.webhook.agent3=http://localhost:5678/webhook/agent3-rh-manager
n8n.api.key=votre-cle-api-n8n
```

Tester la connectivité (ADMIN/HR) :
```bash
GET  http://localhost:8080/api/n8n/status
POST http://localhost:8080/api/n8n/test-webhook
     Body: { "webhookUrl": "http://localhost:5678/webhook/..." }
GET  http://localhost:8080/api/notifications/n8n/candidatures-du-jour
     Header: X-N8N-API-Key: <n8n.api.key>
```

### Score IA (Cohere)
Le token n'est **jamais** stocké en clair dans `application.properties` — il est lu depuis une variable d'environnement :

```properties
cohere.api.token=${COHERE_API_KEY:}
cohere.model=command-r-08-2024
ai.score.weight.technical=0.5
ai.score.weight.communication=0.2
ai.score.weight.seniority=0.3
```

```bash
setx COHERE_API_KEY "votre-cle-cohere"
```

Sans clé configurée (ou en cas d'indisponibilité), le service bascule automatiquement sur un mode simulé déterministe (le score technique reste basé sur le matching réel des compétences requises).

## Accès

| Service | URL |
|---|---|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| n8n | http://localhost:5678 |

## Comptes de Test

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Admin | `admin` | `Admin2026!` |
| RH | `rh1` | `Test2026!` |
| Manager | `manager1` | `Test2026!` |
| Candidat | `candidat1` | `Test2026!` |

## Endpoints Candidats — Score IA & Décisions

```bash
POST  /api/candidates/apply                              # Candidature avec CV
POST  /api/candidates/{id}/ai-score/recompute             # Recalcule le score IA (Cohere)
PATCH /api/candidates/{id}/ai-score/override               # Correction manuelle du score (RH/ADMIN)
GET   /api/candidates/job-offer/{jobOfferId}/ranking       # Classement des candidats d'une offre
PATCH /api/candidates/{id}/manager-decision                 # Décision manager (ACCEPTED/REJECTED)
GET   /api/external-offers/remotive?search=&limit=         # Étude comparative offres externes (Remotive)
```

## Structure du Projet

```
FindYourJob/
├── JOB4YOU-backend/          # Spring Boot 3.2
│   └── src/main/java/com/recrutement/app/
│       ├── controller/        # REST endpoints (Candidate, ExternalJobOffers, N8nTest...)
│       ├── service/           # Logique métier (N8nService, CandidateService, AiScoringService, CohereClient...)
│       ├── config/            # JWT, RestTemplate, Async, Security
│       ├── entity/            # JPA entities
│       └── repository/        # Spring Data JPA
├── JOB4YOU-frontend/          # Angular 20
│   └── src/app/
│       ├── pages/             # Candidat, Admin, HR, Manager
│       ├── services/          # AuthService, JobOfferService...
│       └── guards/            # RoleGuard JWT
├── n8n-workflows/             # Workflows n8n exportés (Agent 1, 2, 3)
└── ARCHITECTURE_N8N.md        # Diagrammes et responsabilités
```

## Auteur

**Haythem Bargaoui** — Projet de fin d'études (PFE)

## Licence

MIT


