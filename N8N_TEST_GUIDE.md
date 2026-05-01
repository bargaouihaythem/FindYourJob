# Guide de Test — Webhooks n8n & Captures d'écran

## Avant de commencer

Vérifier que les 3 services tournent :

```bash
# Terminal 1 — Backend
cd JOB4YOU-backend && mvn spring-boot:run
# Attendu : "Started RecrutementAppApplication on port 8080"

# Terminal 2 — Frontend
cd JOB4YOU-frontend && npm start
# Attendu : "Angular Live Development Server listening on localhost:4200"

# Terminal 3 — n8n
npx n8n start
# Attendu : "Editor is now accessible via: http://localhost:5678"
```

---

## Étape 1 — Configurer les webhooks dans n8n

### Créer le workflow Agent 1 (CV Parser)

1. Ouvrir http://localhost:5678
2. Cliquer **New workflow** → renommer `Agent 1 — CV Parser`
3. Ajouter le nœud **Webhook** :
   - Method : `POST`
   - Path : `cv-parser`
   - Copier l'URL affichée : `http://localhost:5678/webhook/cv-parser`
4. Ajouter nœud **OpenAI** (ou Code) pour simuler le scoring
5. Ajouter nœud **Send Email** (Gmail) pour l'email candidat
6. Cliquer **Activate** (toggle en haut à droite)

> **Screenshot à prendre ici** → `screenshot_agent1_workflow.png`

### Créer le workflow Agent 2 (Notificateur RH)

1. **New workflow** → renommer `Agent 2 — RH Notifier`
2. Ajouter nœud **Schedule Trigger** : toutes les 24h à 18h00
3. Ajouter nœud **HTTP Request** :
   - URL : `http://localhost:8080/api/n8n/candidatures-du-jour`
   - Header : `X-N8N-API-Key: <votre-clé>`
4. Ajouter nœud **OpenAI** pour le résumé
5. Ajouter nœud **Send Email** vers le manager
6. Cliquer **Activate**

> **Screenshot à prendre ici** → `screenshot_agent2_workflow.png`

### Créer le workflow Agent 3 (Interview Scheduler)

1. **New workflow** → renommer `Agent 3 — Interview Scheduler`
2. Ajouter nœud **Webhook** :
   - Method : `POST`
   - Path : `interview-scheduler`
   - URL : `http://localhost:5678/webhook/interview-scheduler`
3. Ajouter nœud **Google Calendar** → Create Event
4. Ajouter nœud **Send Email** avec lien Meet
5. Cliquer **Activate**

> **Screenshot à prendre ici** → `screenshot_agent3_workflow.png`

---

## Étape 2 — Renseigner les URLs dans application.properties

```properties
n8n.webhook.agent1=http://localhost:5678/webhook/cv-parser
n8n.webhook.agent3=http://localhost:5678/webhook/interview-scheduler
n8n.api.key=votre-cle-api-n8n
```

Redémarrer le backend après modification.

---

## Étape 3 — Vérifier la connectivité via API

Récupérer d'abord un token JWT admin :

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"haythemadmin","password":"admin123"}'
```

Puis tester les webhooks :

```bash
# Vérifier les URLs configurées (sans appel réseau)
curl http://localhost:8080/api/n8n/status \
  -H "Authorization: Bearer <TOKEN>"

# Tester tous les webhooks en 1 appel
curl http://localhost:8080/api/n8n/test-all \
  -H "Authorization: Bearer <TOKEN>"
```

Réponse attendue si tout est OK :
```json
{
  "agent1": { "ok": true, "status": 200, "responseTimeMs": 42 },
  "agent3": { "ok": true, "status": 200, "responseTimeMs": 38 },
  "allReachable": true,
  "summary": "Tous les webhooks n8n répondent"
}
```

> **Screenshot à prendre ici** → `screenshot_api_test_all.png`

---

## Étape 4 — Test du flux complet (Scénario de bout en bout)

### Scénario A : Nouvelle candidature → email + score IA

1. Ouvrir http://localhost:4200
2. Se connecter en tant que candidat : `candidat_test` / `candidat123`
3. Aller sur **Offres d'emploi** → choisir une offre → **Postuler**
4. Remplir le formulaire et uploader un CV PDF
5. Cliquer **Envoyer**

**Vérifications :**
- [ ] Réponse HTTP 200 dans le navigateur (pas d'erreur)
- [ ] Email de confirmation reçu sur la boîte du candidat (Spring Boot)
- [ ] Dans n8n → onglet **Executions** du workflow Agent 1 : une exécution apparaît
- [ ] Email enrichi avec score IA reçu (n8n)

> **Screenshots à prendre :**
> - `screenshot_candidature_formulaire.png` — formulaire rempli
> - `screenshot_n8n_agent1_execution.png` — exécution réussie dans n8n
> - `screenshot_email_candidat.png` — email reçu avec score

### Scénario B : Planification d'entretien → Google Calendar

1. Se connecter en tant que manager/RH
2. Aller dans **Entretiens** → **Planifier**
3. Choisir un candidat, une date, un type (Visio)
4. Confirmer

**Vérifications :**
- [ ] Entretien créé dans la base (liste mise à jour)
- [ ] Dans n8n → **Executions** de l'Agent 3 : exécution visible
- [ ] Email avec lien Google Meet reçu par le candidat ET l'interviewer
- [ ] Événement créé dans Google Calendar

> **Screenshots à prendre :**
> - `screenshot_entretien_formulaire.png`
> - `screenshot_n8n_agent3_execution.png`
> - `screenshot_email_invitation.png`

### Scénario C : Résumé RH quotidien (Agent 2)

Pour tester sans attendre 18h, modifier le Schedule Trigger en n8n pour s'exécuter **toutes les minutes**, déclencher manuellement, puis remettre à 18h.

**Vérifications :**
- [ ] Appel visible sur `GET /api/n8n/candidatures-du-jour` dans les logs Spring Boot
- [ ] Email de résumé reçu par le manager

> **Screenshot** : `screenshot_n8n_agent2_execution.png`

---

## Étape 5 — Où placer les screenshots dans le rapport

### Structure recommandée pour le rapport PFE

```
Chapitre 4 — Réalisation
  4.1 Interface utilisateur
      → screenshot_candidature_formulaire.png
      → screenshot_entretien_formulaire.png
  4.2 Intégration n8n — Agents IA
      → screenshot_agent1_workflow.png        (workflow complet)
      → screenshot_agent2_workflow.png
      → screenshot_agent3_workflow.png
  4.3 Résultats des tests
      → screenshot_n8n_agent1_execution.png   (panneau Executions)
      → screenshot_api_test_all.png           (réponse JSON test-all)
      → screenshot_email_candidat.png         (email reçu)
      → screenshot_email_invitation.png
```

### Légendes suggérées pour les captures n8n

| Screenshot | Légende dans le rapport |
|---|---|
| `agent1_workflow.png` | *Figure X — Workflow n8n Agent 1 : parse CV, scoring IA et email de confirmation* |
| `agent2_workflow.png` | *Figure X — Workflow n8n Agent 2 : agrégation quotidienne et résumé managérial* |
| `agent3_workflow.png` | *Figure X — Workflow n8n Agent 3 : planification entretien et intégration Google Calendar* |
| `agent1_execution.png` | *Figure X — Panneau d'exécutions n8n : traitement réussi d'une candidature (HTTP 200)* |

---

## Résumé du flux de bout en bout

```
[Candidat]   Soumet formulaire
     │
     ▼
[Angular]    POST /api/candidates (avec CV)
     │
     ▼
[Spring Boot] saveCandidate() → email basique envoyé → réponse 200 immédiate
     │
     ▼ (asynchrone, après réponse)
[N8nService]  triggerAgent1CvParser() → POST webhook n8n
     │
     ▼
[n8n Agent 1] parse CV → OpenAI score → email enrichi → Gmail
     │
     ▼
[Candidat]   Reçoit 2 emails : confirmation immédiate + analyse IA
```

Si n8n est éteint → le candidat reçoit quand même l'email Spring Boot. L'intégration n8n est **non-bloquante**.
