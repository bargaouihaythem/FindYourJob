# Rapport final des corrections et développements — JOB4YOU

**Projet :** JOB4YOU / FindYourJob
**Nature de l’intervention :** correction de sécurité, fiabilisation des intégrations, développement de fonctionnalités métier et validation complète
**Statut GitHub :** corrections publiées sur `main` après validation locale et vérification par nouveau clone

## 1. Synthèse exécutive

La structure initiale du projet reste adaptée à un projet PFE : Angular pour l’interface, Spring Boot pour l’API métier, PostgreSQL/H2 pour la persistance, Cohere pour l’analyse assistée et n8n pour l’automatisation. Les corrections ont été appliquées sans remplacer cette architecture. Le commit publié est `451c9179c6225e3d2038dd379220665fcaa5a934` sur `main` dans le dépôt [bargaouihaythem/FindYourJob](https://github.com/bargaouihaythem/FindYourJob). Les configurations privées Gmail, Cohere, n8n et les secrets d’environnement restent hors du dépôt public.

Les risques prioritaires identifiés lors de la revue ont été traités. Les CV ne sont plus accessibles anonymement, les appels n8n exigent une authentification machine, les endpoints de statut et de scoring ne sont plus ouverts sans authentification, les motifs de rejet sont conservés, les transitions passent par la machine à états, et les événements n8n sont maintenant persistés dans une outbox avec déduplication et reprises.

> **Résultat global :** le backend passe la suite Maven complète avec **96 tests, 0 échec, 0 erreur et 0 test ignoré**. Le frontend Angular se compile avec succès en production. Les scénarios live candidat → RH → manager pour les six départements ont également été rejoués avec succès.

## 2. Corrections de sécurité appliquées

| Zone | Correction réalisée | Vérification |
|---|---|---|
| Téléchargement CV | `/api/files/**` n’est plus public ; l’accès vérifie JWT, propriétaire, RH/Admin ou périmètre manager | Appel anonyme live : HTTP 401 |
| Appels n8n | Ajout du filtre `X-N8N-API-Key` avec autorité `ROLE_N8N` | Appel sans clé : HTTP 401 ; clé locale valide reconnue |
| Scoring et statuts | Endpoints de statut, score et recalcul protégés par rôles internes ou authentification n8n | Tests Spring Security passants |
| CORS | Suppression des annotations wildcard des contrôleurs et centralisation par allowlist configurable | Configuration `app.cors.allowed-origins` |
| Reset password | Réponse générique, code plus long, expiration réduite, limitation des demandes et absence de code dans les logs | Tests backend passants |
| JWT | Démarrage refusé avec secret absent ou trop faible | Validation ajoutée dans `JwtUtils` |
| Fichiers CV | Vérification de la signature binaire PDF, DOC et DOCX ; extension générée selon MIME validé | Build backend passant |
| DTO CV | Retrait de `filePath`, qui exposait l’arborescence locale du serveur | `CVResponse` corrigé |
| Endpoints de test | Restrictions ajoutées aux endpoints internes et au test de connectivité n8n, avec contrôle des URLs configurées | Code et tests de sécurité vérifiés |
| Erreurs | Ajout d’un gestionnaire global pour éviter de divulguer les exceptions internes | `GlobalExceptionHandler` ajouté |

## 3. Fiabilisation de Cohere, n8n et des emails

Le fallback de scoring IA n’est plus aléatoire : il est déterministe et explicable. Un même CV analysé avec la même offre produit donc le même résultat de secours. Le client Cohere utilise une sortie JSON structurée, accepte le format `scores` et reste tolérant à l’ancien format tableau pour la compatibilité. Les réponses brutes potentiellement sensibles ne sont plus injectées dans les messages d’erreur.

Les appels métier vers n8n passent désormais par `N8nOutboxService`. Chaque événement contient une clé métier idempotente, un payload JSON persistant, un statut, un compteur de tentatives, une prochaine échéance et une erreur limitée. Le dispatcher réessaie avec backoff puis marque l’événement `FAILED` après cinq tentatives. Cela remplace le modèle purement fire-and-forget pour les événements de workflow.

L’accusé de réception de candidature n’est plus envoyé deux fois lorsque l’Agent 1 n8n est configuré. Dans ce cas, n8n est l’expéditeur principal ; Spring Boot reste le fallback lorsque l’Agent 1 n’est pas configuré. Les trois appels Agent 1/2/3 live ont été reçus par le mock n8n avec le header API key présent.

## 4. Fonctionnalités métier développées

### 4.1 Retrait d’une candidature

Un candidat authentifié peut retirer sa propre candidature avec `POST /api/candidates/{id}/withdraw`. Le retrait est contrôlé par ownership, interdit après un état terminal et enregistré avec un motif, un auteur et une date. Une action correspondante a été ajoutée dans l’écran Angular « Mes candidatures ».

### 4.2 Motifs de décision

Les décisions de rejet manuel exigent maintenant un motif. Le motif est transmis par l’API, enregistré dans `Candidate.statusReason`, avec `statusChangedBy` et `statusChangedAt`, puis renvoyé dans `CandidateResponse`. Le tableau RH/manager et le Kanban demandent le motif avant d’envoyer un rejet.

### 4.3 Machine à états renforcée

L’endpoint générique de mise à jour d’un candidat ne peut plus modifier directement le statut. Les changements doivent utiliser l’endpoint de statut ou de décision dédié afin d’appliquer les transitions autorisées, l’audit et les notifications. Les contrôles de périmètre ont aussi été ajoutés aux modifications et suppressions de dossiers.

### 4.4 Configuration frontend et déploiement

Les URLs Angular `localhost:8080` ont été remplacées par `environment.apiUrl`. Le build production utilise un environnement same-origin `/api`, un Dockerfile Angular et une configuration Nginx avec fallback SPA et proxy vers le backend. Le Compose inclut maintenant un service frontend séparé, avec persistance PostgreSQL déjà configurée.

### 4.5 Calendrier et rappels manager

Une page **Mon calendrier** a été ajoutée pour le manager. Elle affiche une vue mensuelle en lecture seule, les trois prochains entretiens et des badges visuels lorsque le rendez-vous approche. Elle utilise l’endpoint `GET /api/interviews/my-calendar`, réservé au rôle manager. Le filtrage est appliqué côté backend via le contrôle de périmètre existant : département, famille de métier ou affectation directe du manager.

Les rappels email existaient déjà : le candidat reçoit un rappel à J-1 et l’intervieweur, donc le manager lorsqu’il est désigné, reçoit un rappel deux heures avant l’entretien. La nouvelle vue rend ces rendez-vous et leurs alertes visibles dans l’interface, sans dépendre d’une intégration Google Calendar.

## 5. Résultats des tests

| Campagne | Résultat |
|---|---:|
| Tests Maven backend | **96 tests / 0 échec / 0 erreur / 0 ignoré** |
| Compilation backend `mvn -DskipTests package` | **Réussie** |
| Build Angular production | **Réussi** |
| Healthcheck Actuator live | **HTTP 200 / UP** |
| Téléchargement CV anonyme live | **HTTP 401** |
| Statut n8n sans clé live | **HTTP 401** |
| Scénario six départements | **Réussi** |
| Routage RH → manager | **Réussi pour R&D, QA, HRAccess, 4YOU, ProdOps et DevOps** |
| Agent 1/2/3 mock n8n | **Événements reçus avec API key** |
| Décision manager acceptation | **HTTP 200** |
| Décision manager rejet / isolation | **Réussi, accès hors périmètre refusé** |
| Calendrier manager | **Vue Angular compilée ; filtrage métier et sécurité HTTP validés** |
| Endpoint calendrier anonyme / RH | **HTTP 401 / HTTP 403 en test MockMvc** |
| Contrôle `git diff --check` | **Réussi** |
| Publication GitHub et nouveau clone de vérification | **Commit `451c9179c6225e3d2038dd379220665fcaa5a934` confirmé sur `main`** |
| Configurations privées dans le clone public | **Aucune trouvée** |
| Scan statique ciblé des motifs de secrets | **Aucun motif détecté dans le périmètre scanné** |

Les preuves brutes sont conservées dans les fichiers temporaires et dans le dossier `test-evidence` lorsqu’elles ne contiennent pas de secrets. Les scénarios live finaux ont notamment été enregistrés dans `/tmp/job4you_workflow_final.log` et `/tmp/job4you_manager_final.log`.

## 6. Limites restantes

La clé Cohere réelle n’était pas disponible dans l’environnement de validation ; le chemin Cohere a donc été couvert par les tests unitaires et le fallback déterministe, mais une requête réelle devra encore être exécutée avec une clé renouvelée. Les emails Gmail réels n’ont pas été testés : le SMTP local a été utilisé pour éviter d’exposer des identifiants. Le n8n réel n’a pas été importé et exécuté avec ses credentials ; le comportement webhook a été validé par le récepteur local mocké.

Docker n’était pas installé dans l’environnement de validation, donc la syntaxe Compose et la construction des images n’ont pas pu être exécutées ici. Les fichiers Dockerfile et Nginx ont toutefois été ajoutés et doivent être vérifiés sur une machine disposant de Docker avant déploiement.

Les migrations Flyway/Liquibase complètes ne sont pas ajoutées dans cette itération. En production, il faudra migrer explicitement les colonnes `status_reason`, `status_changed_by`, `status_changed_at` et la table `n8n_outbox_events`, puis passer progressivement de `ddl-auto=update` à une stratégie de migration versionnée.

## 7. Recommandations avant production

La première action doit être de révoquer et renouveler toute clé Cohere, SMTP, n8n ou JWT historiquement exposée dans le dépôt public ou son historique Git. Les valeurs du fichier `.env.example` ne sont que des modèles et ne doivent jamais être remplacées par des secrets réels dans Git.

La deuxième action consiste à installer Docker sur l’environnement cible, lancer `docker compose config`, construire les deux images et vérifier le proxy Nginx. Il faudra également fournir un vrai `SPRING_MAIL_PASSWORD`, une vraie clé Cohere et une clé n8n indépendante des environnements de développement.

Enfin, il est recommandé d’ajouter une migration versionnée, un stockage objet privé pour les CV avec URLs signées, un mécanisme de rotation des clés, une MFA pour Admin/RH, une politique de conservation RGPD et une supervision des événements `FAILED` dans l’outbox. Le jeton GitHub temporaire utilisé pour la publication doit être révoqué après la vérification finale.

## 8. Fichiers principaux ajoutés ou modifiés

| Fichier ou zone | Rôle |
|---|---|
| `JOB4YOU-backend/.../N8nOutboxEvent.java` | Entité persistante des événements n8n |
| `JOB4YOU-backend/.../N8nOutboxEventRepository.java` | Recherche et verrouillage des événements à envoyer |
| `JOB4YOU-backend/.../N8nOutboxService.java` | Déduplication, envoi, retries et backoff |
| `JOB4YOU-backend/.../N8nApiKeyAuthenticationFilter.java` | Authentification machine n8n |
| `JOB4YOU-backend/.../AccessControlService.java` | Ownership et périmètre d’accès aux dossiers/CV |
| `JOB4YOU-backend/.../CandidateService.java` | Retrait, motifs, machine à états et contrôle de périmètre |
| `JOB4YOU-frontend/src/environments/` | Configuration API dev/production |
| `JOB4YOU-frontend/Dockerfile` | Image Angular/Nginx reproductible |
| `JOB4YOU-frontend/nginx.conf` | SPA fallback et proxy `/api` |
| `JOB4YOU-frontend/.../my-applications/` | Action de retrait côté candidat |
| `JOB4YOU-backend/docker-compose.yml` | Service frontend et configuration durcie |

## Références

[1]: https://docs.cohere.com/docs/structured-outputs "Cohere — Structured Outputs"

[2]: ./REVUE_ARCHITECTURE_CODE_JOB4YOU.md "Revue d’architecture et du code JOB4YOU"

[3]: ./N8N_TEST_GUIDE.md "Guide de test n8n JOB4YOU"

[4]: ./PUBLICATION_GITHUB_CHECKLIST.md "Checklist de publication GitHub"
