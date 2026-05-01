# Architecture FindYourJob — Intégration n8n

---

## Vue Simple (pour la soutenance)

```
┌───────────┐     HTTP      ┌───────────────┐    webhook    ┌───────┐    API     ┌──────────────┐
│  Angular  │ ────────────► │  Spring Boot  │ ────────────► │  n8n  │ ─────────► │  Email /     │
│  (UI)     │ ◄──────────── │  (Backend)    │               │  (IA) │           │  Calendar    │
└───────────┘    JSON/JWT   └───────────────┘               └───────┘           └──────────────┘
```

**4 composants — 3 flèches — Spring Boot déclenche n8n, n8n agit sur le monde extérieur.**

---

## Vue Détaillée (pour le rapport)

```
ACTEUR           ANGULAR            SPRING BOOT             n8n                 EXTERNE
────────         ────────           ──────────────          ─────────────────   ──────────────

CANDIDAT ──────► POST /apply        saveCandidate()  ──────► Agent 1            Gmail API
                 (upload CV)        sendEmail()              │ Parse CV         ► email confirmation
                                    triggerAgent1()          │ Score IA 0–100   ► score calculé
                                    (async)                  └─────────────────►

RH       ──────► PATCH /status      updateStatus()  ──────────► Agent 2           Gmail API
                 (CV_REVIEWED)      triggerAgent2()              │ Notifier manager ► email dossier
                                    (async)                      │ Envoyer dossier  ► avec CV
                                                                 │ Relance 48h auto ► si pas retour
                                                                 └────────────────►

MANAGER  ──────► POST /interviews   scheduleInterview() ────► Agent 3           Google Calendar
                 (planif.)          sendEmail()               │ Créer événement ► invitation Meet
                                    triggerAgent3()           │ Lien Google Meet ► email complet
                                    (async)                   └────────────────►

n8n CRON ──────────────────────────► GET /candidatures-du-jour Agent 2           Gmail API
(18h)                                (sécurisé API-Key)        │ Résumé IA      ► email résumé RH
                                                               └────────────────►
```

---

## Tableau des Responsabilités

| Couche | Rôle métier | Technologie |
|---|---|---|
| **Angular** | UI : formulaires, tableaux, calendrier | TypeScript, Bootstrap 5 |
| **Spring Boot** | Logique métier, sécurité JWT, CRUD BDD | Java 17, Spring Security, JPA |
| **n8n** | Automation IA : scoring, emails, calendrier | Workflows visuels, OpenAI API |
| **PostgreSQL** | Persistance | PostgreSQL 15 |

---

## Les 3 Agents n8n

### Agent 1 — CV Parser
- **Déclencheur** : POST webhook depuis Spring Boot (nouvelle candidature)
- **Actions** : parse CV → score IA 0–100 → email candidat enrichi

### Agent 2 — RH → Manager (transmission du dossier validé)
- **Déclencheur** : RH valide le dossier administratif (`PATCH /candidates/{id}/status?status=CV_REVIEWED`)
- **Actions n8n** : notifier le manager par email, envoyer le dossier complet, relance automatique si pas de retour sous 48h

### Agent 3 — Interview Scheduler
- **Déclencheur** : POST webhook depuis Spring Boot (nouvel entretien)
- **Actions** : Google Calendar → Google Meet → email invitation candidat + interviewer

---

## Tester la connectivité

```bash
# Statut des URLs configurées
GET  /api/n8n/status       (ADMIN/HR)

# Tester tous les webhooks
GET  /api/n8n/test-all     (ADMIN/HR)

# Tester un webhook spécifique
POST /api/n8n/test-webhook
     { "webhookUrl": "http://localhost:5678/webhook/cv-parser" }
```


---

## Flux par cas d'usage

### Cas 1 : Nouvelle candidature

```
Candidat          Angular           Spring Boot              n8n Agent 1
   │                 │                    │                       │
   │── formulaire ──►│                    │                       │
   │                 │── POST /apply ────►│                       │
   │                 │                    │── saveCandidate() ─── │
   │                 │                    │── sendEmail() ──────  │  (email basique Spring)
   │                 │◄── 200 OK ─────────│                       │
   │◄── confirmation─│                    │── triggerAgent1() ───►│
   │   immédiate     │                    │   (ASYNC)             │── parse CV ──────────────►
   │                 │                    │                       │── score IA ──────────────►
   │                 │                    │                       │── email enrichi ─────────► Gmail
```

### Cas 2 : Planification d'entretien

```
Manager           Angular           Spring Boot              n8n Agent 3
   │                 │                    │                       │
   │── formulaire ──►│                    │                       │
   │                 │── POST /interviews►│                       │
   │                 │                    │── saveInterview() ─── │
   │                 │                    │── sendEmail() ──────  │  (email basique Spring)
   │                 │◄── 200 OK ─────────│                       │
   │◄── confirmation─│                    │── triggerAgent3() ───►│
   │   immédiate     │                    │   (ASYNC)             │── Google Calendar ───────► Google API
   │                 │                    │                       │── lien Meet ─────────────►
   │                 │                    │                       │── email avec lien ───────► Gmail
```

### Cas 3 : Résumé RH quotidien (Agent 2)

```
n8n CRON          Spring Boot                    RH / Manager
(18h)                  │                              │
   │                   │                              │
   │── GET /api/n8n/ ──►                              │
   │   candidatures-du-jour                           │
   │   (X-N8N-API-Key)  │                             │
   │◄── JSON {total,    │                             │
   │    candidatures[]} │                             │
   │                    │                             │
   │── OpenAI résumé ───────────────────────────────  │
   │── email résumé ───────────────────────────────► Gmail
```

---

## Test de connectivité (Amélioration #3)

Pour vérifier que Spring Boot peut joindre n8n **avant** la mise en production :

```bash
# 1. Vérifier les URLs configurées (sans appel réseau)
GET  http://localhost:8080/api/n8n/status
Authorization: Bearer <jwt-admin-ou-hr>

# 2. Tester un webhook spécifique
POST http://localhost:8080/api/n8n/test-webhook
Authorization: Bearer <jwt-admin-ou-hr>
Content-Type: application/json
{ "webhookUrl": "http://localhost:5678/webhook/mon-agent1" }

# 3. Tester tous les webhooks configurés
GET  http://localhost:8080/api/n8n/test-all
Authorization: Bearer <jwt-admin-ou-hr>
```

Réponse attendue si n8n est actif :
```json
{
  "ok": true,
  "status": 200,
  "message": "Webhook joignable — HTTP 200",
  "responseTimeMs": 45
}
```
