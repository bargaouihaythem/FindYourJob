# CAHIER DES CHARGES - FindYourJob

## Table des matières
1. [Contexte et définition du problème](#contexte)
2. [Objectif de projet](#objectif)
3. [Acteurs](#acteurs)
4. [Les actions associées à chaque acteur](#actions)
5. [Choix de technologie](#choix-techno)
6. [Modules à développer](#modules)
7. [Méthodologie de conception adoptée](#methodologie)
8. [Architecture](#architecture)
9. [Choix technologiques](#choix-technologiques)

---

## 1 - Contexte et définition du problème {#contexte}

### Contexte
FindYourJob est une plateforme de recrutement innovante développée en partenariat entre **Sesame** et **Sopra Steria HR Software**. Elle vise à moderniser et automatiser le processus de recrutement en offrant une solution intégrée pour les candidats et les responsables RH.

### Problème identifié
- **Processus de recrutement fragmenté** : Les solutions RH actuelles manquent d'intégration efficace
- **Absence d'analyse automatisée des CV** : Les recruteurs passent trop de temps à trier manuellement les candidatures
- **Communication inefficace** : Manque de notifications automatisées et de suivi en temps réel
- **Manque de transparence** : Les candidats ne suivent pas l'état de leurs candidatures

### Enjeux
- Réduire le temps de traitement des candidatures de 60%
- Améliorer l'expérience candidate par une communication automatisée
- Offrir une solution de scoring IA pour prioriser les candidats
- Intégrer l'entretien technique directement dans la plateforme

---

## 2 - Objectif de projet {#objectif}

### Objectif général
Créer une plateforme SaaS complète de gestion du recrutement permettant :

### Objectifs spécifiques
1. **Gestion des candidatures** : Recevoir, trier et analyser les candidatures automatiquement
2. **Scoring IA** : Évaluer automatiquement les CV avec un score de pertinence (65-95%)
3. **Notifications automatisées** : Envoyer des confirmations et mises à jour par email
4. **Gestion des entretiens** : Planifier, notifier et suivre les entretiens techniques
5. **Tableaux de bord** : Fournir des dashboards de suivi pour RH et administrateurs
6. **Sécurité et RGPD** : Implémenter l'authentification JWT et la gestion des rôles

### Livrables attendus
- ✅ Plateforme web responsive (Frontend Angular 20)
- ✅ API REST complète (Backend Spring Boot 3.2)
- ✅ 3 agents n8n automatisés (CV Parser, RH Manager, Interview Manager)
- ✅ Intégration Groq LLM pour l'analyse de CV
- ✅ Base de données PostgreSQL sécurisée
- ✅ Documentation complète et déployable sur Docker

---

## 3 - Acteurs {#acteurs}

### Acteurs identifiés

| Acteur | Description | Rôle |
|--------|------------|------|
| **Candidat** | Personne en recherche d'emploi | Consulter offres, postuler, suivre candidature |
| **Responsable RH** | Gestionnaire des ressources humaines | Gérer offres, évaluer candidats, planifier entretiens |
| **Administrateur** | Gestionnaire système | Gérer utilisateurs, permissions, configurations |
| **Interviewer/Manager technique** | Responsable entretiens techniques | Évaluer candidats, noter entretiens |
| **Système n8n** | Orchestrateur automatisé | Traiter CV, envoyer notifications, gérer entretiens |
| **Groq LLM** | Intelligence artificielle | Analyser et scorer les CV |

---

## 4 - Les actions associées à chaque acteur {#actions}

### Actions Candidat
- ✅ S'inscrire/Se connecter
- ✅ Consulter offres d'emploi
- ✅ Postuler à une offre
- ✅ Télécharger/améliorer son CV
- ✅ Recevoir confirmations et notifications
- ✅ Suivre l'état de ses candidatures
- ✅ Programmer ses entretiens
- ✅ Accéder à ses résultats d'entretien

### Actions Responsable RH
- ✅ Créer/publier offres d'emploi
- ✅ Consulter les candidatures reçues
- ✅ Visualiser les scores IA des CV
- ✅ Filtrer/trier les candidats
- ✅ Programmer des entretiens
- ✅ Envoyer notifications
- ✅ Consulter tableau de bord (dashboard)
- ✅ Exporter rapports de candidatures

### Actions Administrateur
- ✅ Gérer les utilisateurs et leurs rôles
- ✅ Configurer les paramètres système
- ✅ Visualiser les logs et audit
- ✅ Gérer les permissions d'accès
- ✅ Monitorer la santé du système

### Actions Interviewer
- ✅ Consulter liste des entretiens programmés
- ✅ Accéder aux informations du candidat
- ✅ Noter l'entretien
- ✅ Soumettre le verdict (accepté/rejeté)
- ✅ Fournir feedback au candidat

---

## 5 - Choix de technologie {#choix-techno}

### Justification des choix

| Technologie | Justification |
|-------------|--------------|
| **Angular 20** | Framework moderne, réactif, performant pour interfaces RH complexes |
| **Spring Boot 3.2** | Framework Java robuste pour APIs REST, écosystème mature |
| **PostgreSQL** | SGBDR performant, sécurisé, adapté aux données sensibles RH |
| **n8n v2.8.4** | Orchestration workflow low-code, parfait pour automation RH |
| **Groq LLM** | API LLM rapide et économique pour scoring CV en temps réel |
| **Docker** | Containerisation pour déploiement uniforme et scalable |
| **JWT** | Authentification stateless, sécurisée et scalable |
| **Gmail SMTP** | Serveur mail fiable pour notifications candidat/RH |

---

## 6 - Modules à développer {#modules}

### Module M1 : Gestion des Candidatures

| Tâche | Acteur(s) | Statut |
|-------|-----------|--------|
| Créer formulaire candidature | Candidat | ✅ Complété |
| Recevoir et valider candidature | Système n8n | ✅ Complété |
| Analyser CV avec IA | Groq LLM | ✅ Complété |
| Générer score de pertinence | Système n8n | ✅ Complété |
| Notifier candidat de réception | Système n8n (Email) | ✅ Complété |
| Sauvegarder score en base | API Spring Boot | ✅ Complété |

### Module M2 : Gestion des Offres d'Emploi

| Tâche | Acteur(s) | Statut |
|-------|-----------|--------|
| Créer/publier offre | RH | ✅ Complété |
| Consulter offres disponibles | Candidat | ✅ Complété |
| Filtrer par domaine/localité | Candidat | ✅ Complété |
| Visualiser détails offre | Candidat | ✅ Complété |
| Archiver offre | RH | ✅ Complété |

### Module M3 : Gestion des Entretiens

| Tâche | Acteur(s) | Statut |
|-------|-----------|--------|
| Programmer entretien | RH | ✅ Complété |
| Notifier candidat | Système n8n | ✅ Complété |
| Notifier RH/Interviewer | Système n8n | ✅ Complété |
| Soumettre résultat entretien | Interviewer | ✅ Complété |
| Notifier candidat du résultat | Système n8n | ✅ Complété |

### Module M4 : Dashboard & Rapports

| Tâche | Acteur(s) | Statut |
|-------|-----------|--------|
| Dashboard RH (statistiques) | RH | ✅ Complété |
| Dashboard Candidat (suivi) | Candidat | ✅ Complété |
| Rapports exportables | RH/Admin | ✅ Complété |
| Logs audit | Admin | ✅ Complété |

### Module M5 : Authentification & Autorisation

| Tâche | Acteur(s) | Statut |
|-------|-----------|--------|
| Inscription utilisateur | Candidat/RH | ✅ Complété |
| Connexion JWT | Tous | ✅ Complété |
| Gestion des rôles | Admin | ✅ Complété |
| Protection des routes | Système | ✅ Complété |
| Réinitialisation mot de passe | Candidat/RH | ✅ Complété |

### Module M6 : Amélioration de CV

| Tâche | Acteur(s) | Statut |
|-------|-----------|--------|
| Analyse du CV | Groq LLM | ✅ Complété |
| Suggestions d'amélioration | Système | ✅ Complété |
| Téléchargement CV | Candidat | ✅ Complété |
| Versioning CV | Candidat | ✅ Complété |

---

## 7 - Méthodologie de conception adoptée {#methodologie}

### Approche globale : Agile Scrum

### Phases du projet
1. **Phase 1 - Analyse & Design** (Complété)
   - Analyse des besoins
   - Design UX/UI
   - Architecture système
   - Planification sprints

2. **Phase 2 - Développement Sprint 1-3** (Complété)
   - Frontend (Angular components)
   - Backend (Spring Boot APIs)
   - n8n workflows
   - Intégration base de données

3. **Phase 3 - Tests & Intégration** (En cours)
   - Tests unitaires
   - Tests d'intégration
   - Tests n8n workflows
   - Tests de charge

4. **Phase 4 - Déploiement** (À venir)
   - Dockerization
   - Configuration production
   - Déploiement
   - Documentation

### Outils & Conventions
- **Versioning** : Git (GitHub/GitLab)
- **Code Review** : Pull Requests obligatoires
- **Documentation** : Markdown + Swagger UI
- **Communication** : Daily standups
- **Sprints** : 2 semaines
- **Réunions** : Planning, Review, Retrospective

---

## 8 - Architecture {#architecture}

### Architecture générale (3-tiers)

```
┌─────────────────────────────────────┐
│    Frontend (Angular 20)            │
│  - Components                       │
│  - Services                         │
│  - Guards & Interceptors            │
│  - Responsive UI                    │
└──────────────┬──────────────────────┘
               │ HTTP/HTTPS
┌──────────────▼──────────────────────┐
│    Backend (Spring Boot 3.2)        │
│  - REST APIs                        │
│  - Business Logic                   │
│  - JWT Authentication               │
│  - Role-based Authorization         │
└──────────────┬──────────────────────┘
               │ JDBC
┌──────────────▼──────────────────────┐
│    Base de Données                  │
│  - PostgreSQL 14+                   │
│  - Tables métier (Candidates,       │
│    Offers, Applications, etc.)      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│    n8n Orchestration (localhost)    │
│  - Agent 1: CV Parser + Groq        │
│  - Agent 2: RH Manager              │
│  - Agent 3: Interview Manager       │
└──────────────┬──────────────────────┘
               │ Webhooks
        Spring Boot Backend
```

### Flux de données
1. **Candidature** : Candidat → Frontend → Backend → n8n (CV Parser) → Groq LLM → Backend → Email
2. **Entretien** : RH → Backend → n8n (Interview Manager) → Email (Candidat + Interviewer)
3. **Dashboard** : Backend → Frontend (données temps réel)

---

## 9 - Choix technologiques {#choix-technologiques}

### Frontend - Angular 20

**Stack technologique**
```
- Angular 20.x (latest)
- Bootstrap 5.3 (responsive grid)
- SCSS (styling préprocessé)
- TypeScript 5.x
- RxJS (reactive programming)
- ngx-toastr (notifications)
```

**Justification**
- Angular 20 : Framework moderne avec CLI robuste
- Bootstrap : Design responsive rapide
- SCSS : Maintainabilité CSS améliorée
- TypeScript : Type-safety et meilleure expérience dev
- RxJS : Gestion élégante des flux asynchrones

### Backend - Spring Boot 3.2

**Dépendances clés**
```xml
- spring-boot-starter-web (REST APIs)
- spring-boot-starter-data-jpa (ORM)
- spring-boot-starter-security (Authentication)
- spring-boot-starter-mail (SMTP)
- postgresql driver
- jwt-api (auth tokens)
- springdoc-openapi (Swagger UI)
- lombok (code generation)
```

**Justification**
- Spring Boot 3.2 : LTS, stabilité garantie
- JPA/Hibernate : ORM performant et standardisé
- Spring Security : Framework auth robuste
- Swagger : Documentation API automatique
- PostgreSQL driver : Support natif DB

### Base de Données - PostgreSQL

**Schéma principal**
```sql
Tables:
- users (id, username, email, password_hash, role)
- candidates (id, user_id, cv_url, phone, experience)
- job_offers (id, title, description, salary, posted_by)
- applications (id, candidate_id, offer_id, cv_score, status)
- interviews (id, application_id, scheduled_at, interviewer_id, feedback)
- ai_scores (id, candidate_id, score, analysis, created_at)
```

**Justification**
- PostgreSQL : SGBDR performant, fiable
- ACID compliance : Intégrité des données RH
- JSON support : Flexibilité données complexes
- Full-text search : Recherche CV rapide
- Replication : Haute disponibilité

### n8n - Orchestration Workflows

**3 Workflows automatisés**

**Workflow 1 : Agent 1 - CV Parser + Groq**
```
Webhook (POST /api/agent1-cv-parser)
  ↓
Extract candidature data
  ↓
Call Groq LLM (score + analysis)
  ↓
Send confirmation email
  ↓
Save score to Spring Boot API
  ↓
Return JSON response
```

**Workflow 2 : Agent 2 - RH Manager**
```
Webhook (POST /api/agent2-rh-manager)
  ↓
Process application status
  ↓
Send notifications (email)
  ↓
Update database
  ↓
Return status
```

**Workflow 3 : Agent 3 - Interview Manager**
```
Webhook (POST /api/agent3-entretien)
  ↓
Schedule interview
  ↓
Send notifications (candidate + interviewer)
  ↓
Update calendar
  ↓
Return confirmation
```

**Justification**
- n8n : Low-code automation platform
- Webhooks : Communication asynchrone
- Groq : LLM local/cloud rapide
- Email : Notifications instantanées
- Error handling : Retry automatique

### Intégrations externes

| Service | Usage | Credentials |
|---------|-------|-------------|
| **Groq API** | LLM scoring CV | API Key (gsk_...) |
| **Gmail SMTP** | Notifications email | bargaouihaythem1@gmail.com |
| **Docker Hub** | Registry conteneurs | Credentials optionnelles |

### Infrastructure - Docker

**Dockerfile structure**
```dockerfile
# Frontend
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 4200

# Backend
FROM openjdk:17-slim
WORKDIR /app
COPY *.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

# PostgreSQL (docker-compose)
postgres:14
  POSTGRES_DB: job4you_db
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
```

**Justification**
- Containerisation : Deployment uniforme
- Multi-stage builds : Images légères
- docker-compose : Orchestration locale
- Scalabilité : Kubernetes-ready

### Sécurité

**Mécanismes implémentés**
- ✅ JWT pour authentification stateless
- ✅ Spring Security pour autorisation
- ✅ HTTPS pour transport chiffré
- ✅ Password hashing (bcrypt)
- ✅ CORS configuré
- ✅ SQL injection prevention (JPA)
- ✅ Rate limiting (n8n)
- ✅ RGPD compliance (data export/delete)

---

## Résumé des indicateurs clés

| Indicateur | Valeur |
|-----------|--------|
| **Équipe** | 1 Developer Full Stack |
| **Durée estimation** | 16-20 semaines |
| **Budget** | À déterminer |
| **Utilisateurs cibles** | PME/ETI RH (100-1000 users) |
| **Disponibilité** | 99.5% SLA |
| **Support** | L+5 8h-18h |
| **Maintenance** | Incluse année 1 |

---

**Date document** : 22 juin 2026  
**Statut** : En cours de développement (Phase 3/4)  
**Version** : 1.0

