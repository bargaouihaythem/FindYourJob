# Architecture JOB4YOU — Intégration n8n

## Objectif

n8n est une couche d’orchestration optionnelle. Le backend Spring Boot reste responsable de la persistance, de l’authentification, des règles métier, des transitions de statut, de l’extraction des CV et du calcul du score Cohere. Les workflows n8n reçoivent des événements via des webhooks et exécutent principalement les notifications et les callbacks.

## Vue générale

```text
┌─────────────┐       HTTP/JWT       ┌─────────────────┐       JDBC       ┌──────────────┐
│ Angular 20  │ ───────────────────► │ Spring Boot 3.2│ ───────────────► │ PostgreSQL   │
│ Interface   │ ◄─────────────────── │ API + métier    │                  │ Persistance  │
└─────────────┘                     └────────┬────────┘                  └──────────────┘
                                             │
                              Extraction CV + Cohere + audit
                                             │ Webhooks optionnels
                                             ▼
                                      ┌─────────────┐
                                      │ n8n         │
                                      │ Emails      │
                                      │ Callbacks   │
                                      └──────┬──────┘
                                             ▼
                                      SMTP / services externes
```

## Responsabilités par composant

| Composant | Responsabilités réelles |
|---|---|
| Angular | Formulaires, tableaux, Kanban, calendrier local, guards et appels REST |
| Spring Boot | API REST, règles métier, JWT, RBAC, persistance, extraction CV, scoring Cohere, audit, rappels et emails directs |
| Cohere | Évaluation structurée du CV par critères et matching inverse lorsque la clé est configurée |
| n8n | Réception des webhooks, orchestration des emails, branchement des décisions et rappels de workflow |
| PostgreSQL | Persistance des utilisateurs, offres, candidatures, CV, entretiens, feedbacks et audits |
| Remotive | Consultation facultative d’offres externes pour comparaison |

## Workflows

### Agent 1 — Candidature et scoring

**Fichier :** `n8n-workflows/agent1-cv-parser.json`.

```text
Nouvelle candidature
        │
        ▼
Webhook n8n Agent 1
        │
        ▼
Backend POST /api/candidates/{id}/ai-score/recompute
        │
        ├── Extraction texte du CV par Spring Boot
        ├── Appel Cohere si COHERE_API_KEY est configurée
        ├── Fallback dégradé si Cohere est indisponible
        └── Persistance du score et transition de statut
        │
        ▼
Email de confirmation n8n
```

Le workflow n8n ne réalise pas lui-même l’extraction ni le calcul principal du score ; il déclenche le traitement backend et exploite sa réponse.

### Agent 2 — Planification des entretiens

**Fichier :** `n8n-workflows/agent2-entretien.json`.

```text
Création d’un entretien
        │
        ▼
Webhook n8n Agent 2
        │
        ├── Email de convocation au candidat
        └── Email de confirmation à l’intervieweur
```

La planification et les rappels sont enregistrés par le backend. Le workflow prépare actuellement un lien de démonstration pour un entretien vidéo. **Aucun événement Google Calendar authentifié n’est créé par le workflow actuel.** L’intégration Google Calendar/Meet est une évolution prévue.

### Agent 3 — Routage RH vers manager et décision finale

**Fichier :** `n8n-workflows/agent3-rh-manager.json`.

```text
Dossier transmis au manager ou décision finale
        │
        ▼
Webhook n8n Agent 3
        │
        ├── Transmission de la notification au manager
        └── Email de décision au candidat
```

Le backend détermine le périmètre du manager, valide la transition d’état et sélectionne les destinataires. n8n orchestre l’envoi des emails.

## Déclencheurs backend

| Événement | Déclencheur backend | Workflow |
|---|---|---|
| Nouvelle candidature | Dépôt d’une candidature et enregistrement du CV | Agent 1 |
| Entretien créé | Création et sauvegarde d’un entretien | Agent 2 |
| Dossier transmis au manager | Passage à la phase d’évaluation technique | Agent 3 |
| Décision finale | Acceptation, rejet automatique, rejet manager ou embauche | Agent 3 |

## Sécurité des webhooks

Les URLs n8n et les clés d’API ne doivent pas être stockées avec des valeurs réelles dans Git. En production, chaque webhook doit être protégé par une clé de service, une signature HMAC ou un mécanisme équivalent. Les appels n8n doivent être journalisés sans enregistrer de CV ou de secrets dans les logs.

## Test de connectivité

Les endpoints de diagnostic n8n sont destinés à l’environnement de développement et doivent être protégés par un rôle administrateur ou RH. Avant la production, il faut vérifier la protection des callbacks, le contrôle des origines, les timeouts, le comportement lorsque n8n est indisponible et la non-duplication des emails.

## Limites connues

L’architecture actuelle ne démontre pas une intégration Google Calendar/Google Meet complète. Le stockage des CV est local et doit être durci avant une production : contrôle d’accès par dossier, analyse antivirus, validation du contenu, politique de conservation et sauvegarde. Les secrets présents dans les configurations historiques doivent être révoqués et retirés de l’historique Git.
