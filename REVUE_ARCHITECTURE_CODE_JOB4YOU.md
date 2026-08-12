# Revue d’architecture et du code actuel — JOB4YOU

**Date :** 12 août 2026
**Périmètre :** backend Spring Boot, frontend Angular, sécurité JWT, stockage CV, scoring Cohere, workflows n8n, emails et déploiement Docker.

## Verdict général

L’architecture actuelle est **bonne et cohérente pour un projet PFE**. Le découpage Angular → Spring Boot → PostgreSQL/H2 → n8n → email/IA est compréhensible, démontrable et déjà validé par un scénario multi-rôles. Il n’est pas nécessaire de remplacer Angular, Spring Boot, Cohere ou n8n.

En revanche, le projet n’est pas encore suffisamment durci pour une **mise en production réelle**. Les principales faiblesses concernent la protection des fichiers CV, les endpoints anonymes utilisés par n8n, la configuration CORS, le stockage du JWT, le reset password, la gestion des erreurs et la fiabilité des traitements asynchrones.

> **Recommandation principale :** conserver l’architecture générale, mais renforcer d’abord les frontières de sécurité et les contrats d’intégration avant d’ajouter de nouvelles fonctionnalités.

## Points forts déjà présents

| Domaine | Constat |
|---|---|
| Architecture globale | Séparation claire entre interface Angular, logique métier Spring Boot, automatisation n8n et moteur Cohere. |
| Authentification | JWT stateless, mots de passe encodés avec BCrypt, inscription publique limitée à `ROLE_USER`. |
| Routage métier | Routage manager par département, famille métier puis email de secours. Les six départements ont été testés. |
| Machine à états | Les transitions principales des candidatures sont contrôlées dans `CandidateService`. |
| Scoring | Cohere est découplé dans `CohereClient`, avec fallback lorsqu’il est indisponible. |
| Tests backend | 89 tests Maven validés avec 0 échec, 0 erreur et 0 test ignoré. |
| Isolation manager | Le manager hors périmètre a reçu HTTP 403 dans le test live. |
| Documentation | README, architecture n8n, guide de démarrage et documents de sécurité ont été améliorés. |

## Corrections prioritaires avant production

### P0 — À corriger impérativement

| Priorité | Problème constaté | Localisation | Correction recommandée |
|---|---|---|---|
| P0 | **Les fichiers CV sont accessibles sans authentification.** `WebSecurityConfig` autorise `/api/files/**` et `FileController.serveFile()` ne vérifie ni JWT ni ownership. Un test live a obtenu HTTP 200 et 1715 octets sans header Authorization pour un CV existant. | `WebSecurityConfig.java`, `FileController.java` | Supprimer `permitAll()` sur `/api/files/**`. Servir le fichier par un endpoint autorisé après vérification candidat propriétaire, RH/Admin ou manager du bon département. Idéalement utiliser une URL signée à durée courte ou un téléchargement streamé par le backend. |
| P0 | **Les endpoints n8n anonymes peuvent être appelés directement par Internet.** Les routes `/{id}/status`, `/{id}/ai-score` et `/{id}/ai-score/recompute` permettent potentiellement de modifier le score ou le statut d’un candidat sans authentification applicative. | `WebSecurityConfig.java`, `CandidateController.java` | Créer une authentification machine dédiée : header API key obligatoire avec comparaison constante, mTLS ou signature HMAC. La clé doit être vérifiée côté backend sur chaque endpoint agent. En cas de clé absente, refuser par défaut ; ne jamais considérer une clé vide comme valide. |
| P0 | **CORS est trop permissif.** Plusieurs contrôleurs utilisent `@CrossOrigin(origins = "*")`, tandis que la configuration globale autorise tous les origins avec `allowCredentials=true`. | `WebSecurityConfig.java`, contrôleurs | Définir une allowlist par environnement, par exemple `https://app.job4you.tld` et l’URL staging. Interdire `*` avec credentials. |
| P0 | **Le reset password expose des informations sensibles dans les logs.** Le code de réinitialisation est écrit en clair et ne doit jamais apparaître dans les logs. Le code de six chiffres facilite les attaques par essais répétés. | `PasswordResetService.java`, `AuthController.java` | Supprimer les logs du code et du token. Stocker un hash du token, utiliser un token aléatoire plus long, ajouter expiration courte, compteur d’essais, rate limiting par IP/email et réponse générique même si l’email n’existe pas. |
| P0 | **Endpoints de test présents dans l’API applicative.** `/api/auth/test`, `/api/auth/test-email` et plusieurs routes `/api/cvs/test` ou `/fix-*` doivent être isolés du produit final. | `AuthController.java`, `CVController.java` | Les supprimer du profil production ou les placer dans un module/profil `dev` conditionnel. Ne jamais laisser `/test-email` envoyer un email arbitraire depuis une API publique. |
| P0 | **Le reset, login, inscription, matching et upload ne disposent pas d’un rate limiting visible.** | Authentification et endpoints métier | Ajouter une limitation par IP, utilisateur et adresse email. Mettre une limite spécifique aux appels Cohere et aux recalculs de score. |

### P1 — À corriger avant une vraie mise en ligne

| Domaine | Constat | Recommandation |
|---|---|---|
| Réponse API | `CVResponse` expose `filePath`, `storedFilename`, `fileUrl`, `lastAccessed` et des métadonnées internes. `CandidateResponse` expose aussi les coordonnées, la lettre, les justifications et l’auteur du score manuel selon les endpoints. | Créer des DTO séparés : `CandidateSelfResponse`, `CandidateStaffResponse`, `CandidateManagerResponse` et `CVDownloadResponse`. Ne jamais renvoyer un chemin système local ni un chemin d’upload permanent. |
| Ownership candidature | `submitApplication()` prend l’email depuis le corps de la requête. Un utilisateur authentifié pourrait tenter de soumettre un dossier avec l’email d’une autre personne. | Pour un candidat connecté, utiliser l’email du JWT et ignorer celui reçu du client. Si les candidatures anonymes sont réellement nécessaires, créer un flux séparé avec vérification email et anti-abus. |
| Score IA | `saveAiScore()` n’a pas de contrôle métier visible au niveau du service avant modification. `recomputeAiScore()` est accessible anonymement et déclenche une transition de statut. | Séparer les endpoints internes n8n des endpoints RH. Valider source, seuil, idempotence, transition et acteur. Ajouter un audit systématique du score et de la décision. |
| Transitions | `updateCandidate()` permet au RH/Admin de modifier directement le statut sans passer par la même machine à états que `updateCandidateStatus()`. | Interdire la modification du statut dans l’endpoint général de mise à jour. Utiliser une commande dédiée de transition, avec acteur, raison et validation de l’état précédent. |
| n8n | Les appels sont `@Async`, fire-and-forget, avec deux tentatives et sans file durable, replay ni dead-letter. Les échecs ne sont pas persistés. `testWebhook()` n’envoie pas le même header API key que `sendWithRetry()`. | Ajouter une table/outbox `integration_events` avec statut `PENDING/SENT/FAILED`, nombre de tentatives, correlation ID et payload minimal. Faire l’envoi après commit avec `@TransactionalEventListener(AFTER_COMMIT)`. Corriger le test de connectivité pour utiliser exactement les mêmes headers. |
| SSRF n8n | `/api/n8n/test-webhook` accepte toute URL `https://`, ce qui peut permettre des appels vers des hôtes internes ou externes non prévus. | Ne tester que les URLs déjà configurées ou une allowlist stricte de domaines n8n. Ne jamais accepter une URL arbitraire du client. |
| Cohere | Le client envoie le texte complet du CV et de la lettre. Le parsing repose sur une extraction JSON permissive. Le bean s’appelle `huggingFaceRestTemplate` alors qu’il sert Cohere. Le modèle `command-r-08-2024` doit être confirmé avec la documentation actuelle du fournisseur. | Anonymiser les données non nécessaires, limiter le texte, protéger contre l’injection dans les CV, demander une sortie structurée stricte, valider chaque champ 0–100 et définir une version de modèle configurable. Renommer le bean `cohereRestTemplate`. |
| Fallback IA | `AiScoringService` utilise `ThreadLocalRandom` pour la communication et la séniorité en mode simulé. Le même CV peut donc obtenir des scores différents. | Remplacer l’aléatoire par un score déterministe ou une valeur neutre clairement marquée `SIMULATED`. Une décision de recrutement ne doit jamais dépendre d’un hasard. |
| Email | Spring Boot envoie déjà une confirmation lors de la candidature et le workflow Agent 1 n8n contient également un nœud d’email de confirmation. Cela peut produire des doublons en production. | Choisir un seul propriétaire de l’accusé de réception. Une option simple est : Spring Boot envoie uniquement si n8n est désactivé ; sinon n8n est le seul expéditeur. Ajouter un identifiant d’événement idempotent. |
| Erreurs | Beaucoup de contrôleurs renvoient `e.getMessage()` au client et utilisent `System.out`, `System.err` ou `printStackTrace()`. | Ajouter un `@RestControllerAdvice` avec réponses Problem Details, codes d’erreur stables et correlation ID. Journaliser côté serveur avec SLF4J sans données personnelles ni secrets. |
| Pagination | `CandidateService` charge parfois toute la liste puis simule la pagination en mémoire. | Implémenter pagination, filtre, tri et scope directement dans les requêtes repository/Specification. |
| Base de données | La configuration utilise encore `ddl-auto=update` par défaut côté application et le projet n’a pas de migration versionnée visible. | Ajouter Flyway ou Liquibase. En production, utiliser `ddl-auto=validate` et versionner les changements de schéma. |
| Stockage CV | Les fichiers sont stockés sur le disque local du conteneur, sans antivirus, chiffrement, sauvegarde ou politique de rétention. | Utiliser un stockage objet privé, URL signées, scan antivirus, contrôle MIME par signature binaire, chiffrement au repos et suppression selon une politique RGPD. |
| Docker | Le healthcheck appelle `/actuator/health`, mais `spring-boot-starter-actuator` n’apparaît pas dans `pom.xml`. Le compose contient aussi une variable JWT mal nommée (`APP_JWTSECRET`) et des mots de passe de démonstration en clair. | Ajouter Actuator ou modifier le healthcheck. Corriger `APP_JWT_SECRET`, déplacer les secrets vers un `.env` non suivi ou un secret manager, et ajouter un vrai `healthcheck` PostgreSQL avec condition de démarrage. |

## Frontend Angular

Le frontend est fonctionnel, mais les URLs backend sont réparties dans de nombreux services et codées en dur vers `http://localhost:8080`. Cette approche empêchera un déploiement staging ou production sans recompilation manuelle ciblée. Il faut créer `environment.development.ts`, `environment.staging.ts` et `environment.production.ts`, puis injecter une seule `apiBaseUrl` dans tous les services.

Le JWT est conservé dans `localStorage`. Cette solution est pratique pour un PFE, mais expose le token à une compromission XSS. Pour une version production, préférer un access token court en mémoire avec refresh token `HttpOnly`, `Secure`, `SameSite`, ou au minimum renforcer CSP, durée d’expiration, rotation et invalidation serveur.

Le `RoleGuard` protège l’interface, mais la sécurité réelle doit rester exclusivement backend. La logique de rôles est dupliquée dans `AuthService`, `job-offers.ts` et plusieurs composants. Il faut centraliser les capacités dans une policy unique : `canApply`, `canViewCandidate`, `canDownloadCv`, `canDecide`, `canManageUsers`. Cela évitera le bug déjà observé où le candidat était connecté mais ne pouvait pas postuler à cause d’une détection de rôle incohérente.

Ajouter un intercepteur global pour les réponses 401/403, les erreurs réseau et les messages standardisés. Les tests frontend existants sont utiles, mais il faut aussi exécuter le build/test en mode headless et ajouter quelques tests de parcours : connexion, candidature avec multipart, manager hors périmètre et expiration JWT.

## Fonctionnalités à ajouter ou améliorer

| Fonctionnalité | Valeur pour le projet | Priorité |
|---|---|---:|
| Retrait d’une candidature par le candidat | Complète le cycle de vie et respecte le contrôle utilisateur | Haute |
| Historique de statut immuable | Permet de comprendre qui a changé quoi et quand | Haute |
| Motif obligatoire pour rejet RH/manager | Améliore l’audit et l’explicabilité | Haute |
| Consentement et rétention RGPD | Indispensable pour les CV et données personnelles | Haute |
| Notifications persistées et marquées comme lues | Rend le workflow RH plus utilisable | Moyenne |
| Calendrier réel avec timezone, ICS et lien visio | Remplace le calendrier simulé dans le rapport | Moyenne |
| Recherche backend avec filtres et pagination | Nécessaire quand le nombre de candidatures augmente | Moyenne |
| Invitation des managers plutôt que création de mots de passe bootstrap | Réduit le risque des comptes de démonstration | Moyenne |
| MFA pour Admin/RH | Protège les fonctions les plus sensibles | Haute en production |
| Score IA versionné et explicable | Permet de comparer les modèles et de justifier une décision | Haute |
| Idempotence des candidatures et événements | Évite les doublons lors des retries n8n ou des double-clics | Haute |

## Ordre d’exécution recommandé

### Étape 1 — Sécurité immédiate

Protéger les CV, fermer les endpoints n8n anonymes avec une authentification machine, désactiver les endpoints de test en production, supprimer les codes de reset dans les logs, restreindre CORS et ajouter un rate limiting.

### Étape 2 — Fiabilité métier

Supprimer le statut des mises à jour générales, appliquer une machine à états unique, empêcher la falsification de l’email candidat, ajouter audit et idempotence, puis remplacer l’envoi n8n fire-and-forget par une outbox avec retry et replay.

### Étape 3 — Production technique

Introduire les migrations PostgreSQL, Actuator, une configuration Docker correcte, un stockage CV privé et durable, une gestion centralisée des erreurs, les URLs Angular par environnement et une stratégie JWT plus robuste.

### Étape 4 — Qualité IA et expérience utilisateur

Rendre le fallback déterministe, documenter le modèle Cohere réellement utilisé, anonymiser les CV, ajouter la sortie structurée et l’explicabilité, puis compléter le retrait de candidature, le calendrier réel et les notifications persistées.

## Conclusion

Pour la soutenance, le projet est **suffisamment riche et cohérent**. Pour la production, les changements les plus urgents sont clairement identifiés : **protéger les CV, sécuriser les endpoints n8n et IA, supprimer les secrets des logs, restreindre CORS et fiabiliser les événements asynchrones**. Ces corrections sont plus importantes que l’ajout immédiat de nouvelles pages.

L’architecture actuelle peut donc être conservée. La meilleure stratégie est une montée en maturité progressive, centrée sur les contrats de sécurité, les responsabilités exactes entre Spring Boot et n8n, la confidentialité des CV et l’observabilité.

## Références internes

[1] [Configuration Spring Security](JOB4YOU-backend/src/main/java/com/recrutement/app/config/WebSecurityConfig.java)
[2] [Contrôleur des candidatures](JOB4YOU-backend/src/main/java/com/recrutement/app/controller/CandidateController.java)
[3] [Contrôleur des fichiers](JOB4YOU-backend/src/main/java/com/recrutement/app/controller/FileController.java)
[4] [Service de candidatures](JOB4YOU-backend/src/main/java/com/recrutement/app/service/CandidateService.java)
[5] [Client Cohere](JOB4YOU-backend/src/main/java/com/recrutement/app/service/CohereClient.java)
[6] [Service n8n](JOB4YOU-backend/src/main/java/com/recrutement/app/service/N8nService.java)
[7] [Service de reset password](JOB4YOU-backend/src/main/java/com/recrutement/app/service/PasswordResetService.java)
[8] [Service Angular d’authentification](JOB4YOU-frontend/src/app/services/auth.ts)
[9] [Workflow n8n Agent 1](n8n-workflows/agent1-cv-parser.json)
[10] [Rapport final des tests live](RAPPORT_TEST_FINAL_JOB4YOU.md)
