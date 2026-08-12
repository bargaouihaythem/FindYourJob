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

## Étape 1 — Importer les workflows présents dans le dépôt

Les workflows sont déjà exportés dans `n8n-workflows/`. Il ne faut pas recréer des workflows OpenAI ou Google Calendar qui ne correspondent pas à la version actuelle.

### Agent 1 — Candidature et scoring backend

Importer `n8n-workflows/agent1-cv-parser.json`. Le webhook est :

```text
POST http://localhost:5678/webhook/agent1-cv-parser
```

Le workflow appelle le backend pour le recalcul du score. L’extraction du CV et l’appel Cohere sont réalisés côté Spring Boot. n8n envoie ensuite l’email de confirmation si les identifiants SMTP du workflow sont configurés par variables locales.

### Agent 2 — Planification des entretiens

Importer `n8n-workflows/agent2-entretien.json`. Le webhook est :

```text
POST http://localhost:5678/webhook/agent2-entretien
```

Le workflow envoie les emails de convocation au candidat et à l’intervieweur. La planification, les statuts et les rappels sont conservés par le backend. La version actuelle ne crée pas d’événement Google Calendar authentifié.

### Agent 3 — Routage RH vers manager et décision finale

Importer `n8n-workflows/agent3-rh-manager.json`. Le webhook est :

```text
POST http://localhost:5678/webhook/agent3-rh-manager
```

Le workflow envoie la notification au manager et le message de décision au candidat selon l’événement transmis par le backend.

Activer les trois workflows après avoir configuré les credentials SMTP dans n8n. Ne pas écrire d’adresse personnelle, de clé API ou de mot de passe directement dans les fichiers JSON exportés.

> **Captures recommandées :** `screenshot_agent1_workflow.png`, `screenshot_agent2_workflow.png` et `screenshot_agent3_workflow.png`

---

## Étape 2 — Renseigner les URLs dans application.properties

```properties
n8n.webhook.agent1=http://localhost:5678/webhook/agent1-cv-parser
n8n.webhook.agent2=http://localhost:5678/webhook/agent2-entretien
n8n.webhook.agent3=http://localhost:5678/webhook/agent3-rh-manager
n8n.api.key=${N8N_API_KEY}
```

Redémarrer le backend après modification.

---

## Étape 3 — Vérifier la connectivité via API

Récupérer d'abord un token JWT admin :

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<admin-local>","password":"<mot-de-passe-local>"}'
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
2. Se connecter avec un compte candidat créé localement ; ne jamais publier le mot de passe dans ce guide.
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

### Scénario B : Planification d’entretien → notifications et rappels

1. Se connecter en tant que manager/RH
2. Aller dans **Entretiens** → **Planifier**
3. Choisir un candidat, une date, un type (Visio)
4. Confirmer

**Vérifications :**
- [ ] Entretien créé dans la base (liste mise à jour)
- [ ] Dans n8n → **Executions** de l’Agent 2 : exécution visible
- [ ] Email de convocation reçu par le candidat et l’intervieweur
- [ ] Pour un entretien vidéo, vérifier qu’un lien de démonstration est affiché ; aucun événement Google Calendar authentifié n’est créé par la version actuelle

> **Screenshots à prendre :**
> - `screenshot_entretien_formulaire.png`
> - `screenshot_n8n_agent2_execution.png`
> - `screenshot_email_invitation.png`

### Scénario C : Endpoint de synthèse quotidienne (optionnel)

Ce scénario ne s’applique que si un workflow de synthèse quotidienne a été configuré séparément. Dans la version actuelle, vérifier uniquement l’endpoint protégé et son comportement lorsque n8n est indisponible.

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
| `agent1_workflow.png` | *Figure X — Workflow n8n Agent 1 : déclenchement du scoring backend et email de confirmation* |
| `agent2_workflow.png` | *Figure X — Workflow n8n Agent 2 : notifications liées aux entretiens* |
| `agent3_workflow.png` | *Figure X — Workflow n8n Agent 3 : transmission RH-manager et décision finale* |
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
[n8n Agent 1] déclenchement du recalcul backend → extraction CV/Cohere côté Spring Boot → email enrichi → Gmail
     │
     ▼
[Candidat]   Reçoit 2 emails : confirmation immédiate + analyse IA
```

Si n8n est éteint → le candidat reçoit quand même l'email Spring Boot. L'intégration n8n est **non-bloquante**.
