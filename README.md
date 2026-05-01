# JOB4YOU — AI-assisted Recruitment Platform

> Plateforme de recrutement intelligente avec agents IA intégrés (n8n) pour l'analyse automatique de CV, les notifications RH et la planification d'entretiens.

## Stack Technique

| Couche | Technologie | Rôle |
|---|---|---|
| **Frontend** | Angular 20 + Bootstrap 5 | Interface candidat, RH, manager |
| **Backend** | Spring Boot 3.2 + JWT | Logique métier, sécurité, API REST |
| **Automation IA** | n8n (self-hosted) | Scoring CV, emails enrichis, Google Calendar |
| **Base de données** | PostgreSQL 15 | Persistance |
| **Email** | Gmail SMTP | Notifications transactionnelles |

## Architecture Multi-Agents

```
  Candidat          RH / Manager         n8n (Automation IA)        Externe
     │                   │                       │                      │
     │── POST /apply ────►                       │                      │
     │                   │── triggerAgent1() ───►│ Score CV (0–100)     │
     │                   │   (asynchrone)        │── email confirmation ► Gmail
     │                   │                       │                      │
     │                   │── POST /interviews ───►                      │
     │                   │── triggerAgent3() ────►│ Calendrier          │
     │                   │   (asynchrone)        │── invitation Meet ──► Google
     │                   │                       │                      │
     │            CRON 18h (n8n) ───────────────►│ GET /candidatures-du-jour
     │                   │                       │── résumé IA ─────── ► Gmail RH
```

### Agent 1 — CV Parser & Scorer
- Déclencheur : nouvelle candidature (`POST /api/candidates`)
- Actions n8n : parse CV, score IA 0–100, email de confirmation enrichi

### Agent 2 — Notificateur RH (CRON)
- Déclencheur : cron quotidien à 18h (côté n8n)
- Actions n8n : appel `GET /api/n8n/candidatures-du-jour`, résumé IA, email manager

### Agent 3 — Planificateur d'entretiens
- Déclencheur : création d'entretien (`POST /api/interviews`)
- Actions n8n : événement Google Calendar, lien Google Meet, email d'invitation

## Fonctionnalités

### Recrutement
- Offres d'emploi avec filtres (domaine, contrat, localisation)
- Candidatures avec upload CV (PDF)
- Score IA automatique affiché dans le dashboard admin
- Suivi de statut candidature en temps réel

### Gestion RH
- Tableau de bord avec statistiques + score IA moyen
- Validation administrative des candidatures (RH)
- Planning des entretiens avec vue calendrier mensuelle
- Système de feedback post-entretien

### Notifications
- Email de confirmation immédiat (Spring Boot)
- Email enrichi par IA avec score CV (n8n Agent 1)
- Invitation entretien avec lien Google Meet (n8n Agent 3)
- Résumé quotidien pour le management (n8n Agent 2)

## Installation

### Prérequis
- Java 17+, Maven 3.8+
- Node.js 18+, npm
- PostgreSQL 15
- n8n (optionnel — la plateforme fonctionne sans)

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

## Configuration n8n

Dans `JOB4YOU-backend/src/main/resources/application.properties` :

```properties
n8n.webhook.agent1=http://localhost:5678/webhook/cv-parser
n8n.webhook.agent3=http://localhost:5678/webhook/interview-scheduler
n8n.api.key=votre-cle-api-n8n
```

Tester la connectivité (ADMIN/HR) :
```bash
GET  http://localhost:8080/api/n8n/status
GET  http://localhost:8080/api/n8n/test-all
POST http://localhost:8080/api/n8n/test-webhook
     Body: { "webhookUrl": "http://localhost:5678/webhook/..." }
```

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
| Admin | `haythemadmin` | `admin123` |
| RH | `rh_user` | `rh123` |
| Candidat | `candidat_test` | `candidat123` |

## Structure du Projet

```
FindYourJob/
├── JOB4YOU-backend/          # Spring Boot 3.2
│   └── src/main/java/com/recrutement/app/
│       ├── controller/        # REST endpoints
│       ├── service/           # Logique métier (N8nService, CandidateService...)
│       ├── config/            # JWT, RestTemplate, Async, Security
│       ├── entity/            # JPA entities
│       └── repository/        # Spring Data JPA
├── JOB4YOU-frontend/          # Angular 20
│   └── src/app/
│       ├── pages/             # Candidat, Admin, HR, Manager
│       ├── services/          # AuthService, JobOfferService...
│       └── guards/            # RoleGuard JWT
└── ARCHITECTURE_N8N.md        # Diagrammes et responsabilités
```

## Auteur

**Haythem Bargaoui** — Projet de fin d'études (PFE)

## Licence

MIT

