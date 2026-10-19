# Consignes de ressaisie StarUML — audit de cohérence code / diagrammes (19/10/2026)

> **État au 19/10/2026 (fin de chantier) : les figures 2.1 à 2.6, 3.1 à 3.11 sont
> faites.** Les corrections listées ci-dessous ont été portées dans les sources
> `.puml` de `diagrammes_v2/src/`, rendues en PNG (fond blanc, Arial 13, 144 dpi,
> disposition smetana) puis insérées dans `Rapport_PFE_Haythem_Bargaoui_beta.docx`.
> La largeur d'affichage de chaque cadre a été conservée, seule la hauteur a été
> recalculée au nouveau ratio ; les renvois de pages ont été repaginés et le PDF
> réexporté (82 pages, aucune page blanche). Ce fichier reste donc l'historique des
> corrections apportées, plus une consigne de saisie.
>
> Une correction hors liste a été ajoutée en cours de route : **figure 3.2**
> (`fig3_2g.puml`) affichait `interviewDate : Date`, `deadline : Date`,
> `performedAt : Date`, `extractedText : Text` et `content : Text`, en contradiction
> avec les entités JPA (`LocalDateTime`, `String`) et avec la figure 3.2a. Types
> corrigés et figure rendue à l'identique.

Le texte à saisir donné ci-dessous correspond mot pour mot aux `.puml` aujourd'hui
rendus. Les sources antérieures à l'audit sont conservées dans
`diagrammes_v2/src_backup_2026-10-19-audit/`.

---

## Figure 2.1 — Diagramme d'activité (vue d'ensemble du processus)

1. Dans la ligne **Système**, remplacer l'activité
   `Extraction du texte du CV et calcul du score IA sur 100 (automatisation n8n + Cohere)`
   par
   `Extraction du texte du CV (Spring Boot, à la soumission) puis calcul du score IA sur 100 (Agent 1 n8n + Cohere)`.
2. Remplacer le libellé du losange `score ≥ 60 ?` par
   `Révision humaine requise ou score ≥ 60 ?`
   (branche « oui » → CV_REVIEWED, branche « non » → AUTO_REJECTED, inchangées).

## Figure 2.2 — Diagramme de cas d'utilisation global

1. Ajouter l'association **Responsable RH → Saisir un feedback d'entretien**
   (`POST /api/feedbacks` est ouvert à HR, MANAGER et ADMIN).
2. Les 7 relations `<<include>>` vers « S'authentifier » restent inchangées
   (le §262 du rapport dit bien « 7 cas »).

## Figure 2.4 — Cas d'utilisation : processus de recrutement

1. Ajouter l'association **Responsable RH → Saisir un feedback d'entretien**.
2. Remplacer la note sous « Contresigner la décision finale » par :

> La saisie d'un feedback (POST /api/feedbacks) est ouverte au RH, au Manager et à
> l'Administrateur ; sa validation (/approve, /reject, /send-to-candidate) est
> réservée au RH et à l'Admin. Le manager n'écrit qu'un avis sur un dossier déjà en
> évaluation (refus proposé dès CV_REVIEWED, avis favorable à partir de
> PHONE_SCREENING) : il alerte le RH, seul à trancher. Le contreseing (HIRED avec
> date de présentation des documents, REJECTED avec motif) est ouvert au RH et à
> l'Administrateur et déclenche l'e-mail de décision au candidat — sauf lorsque le
> RH se borne à confirmer un refus déjà notifié par l'IA, qui n'entraîne pas second
> envoi. La surcharge du score IA (PATCH /ai-score/override) est également ouverte
> à l'Admin.

## Figure 2.5 — Cas d'utilisation : administration et paramétrage

1. **Supprimer** le cas `Administrer les départements et les familles de métier`
   et l'association qui le relie à l'Administrateur. (Uniquement
   `GET /api/departments` existe ; les départements sont semés au démarrage par
   `DepartmentInitializer`, et `JobFamily` est un énuméré Java.)
2. Ajouter l'association **Responsable RH → Paramétrer le scoring IA**.
3. **Supprimer** la note actuelle — elle est fausse (« les endpoints exigent une
   session valide sans vérifier le rôle : l'écran reste le seul filtre effectif »).
   Les deux contrôleurs portent bien
   `@PreAuthorize("hasRole('ADMIN') or hasRole('HR')")`. La remplacer par :

> Le journal d'audit et les profils de pondération du scoring IA sont réservés à
> l'Administrateur et au Responsable RH : gardés par les gardes de route Angular,
> puis vérifiés côté serveur par @PreAuthorize ADMIN ou HR sur /api/audit et
> /api/scoring-profiles — la garde API fait foi. Le référentiel n'est pas
> administrable : les départements sont créés au démarrage et exposés en lecture
> seule (/api/departments), les familles de métier sont un énuméré figé dans le code.

## Figure 2.6 — Séquence système (boîte noire)

Remplacer la note « Traitements asynchrones en arrière-plan … » par :

> Traitements synchrones, dans la même requête : stockage du CV et extraction de son
> texte. Traitements asynchrones en arrière-plan : la candidature est placée dans la
> file d'attente (outbox) et l'Agent 1 n8n la reprend — appel du scoring IA puis
> e-mail de confirmation au candidat. Sans Agent 1 configuré, Spring Boot envoie
> lui-même l'accusé de réception.

## Figure 3.2a — Classes : modèle recrutement

1. Attributs : `Interview.interviewDate : Date` → `LocalDateTime` ;
   `JobOffer.deadline : Date` → `LocalDateTime` ;
   `Candidate.applicationDate : Date` → `LocalDateTime` ;
   `CV.extractedText : Text` → `String` ;
   `Feedback.content : Text` → `String`.
2. Ajouter `Interview.durationMinutes : Integer` et `Feedback.type : FeedbackType`.
3. Association `Interview — Feedback` : la multiplicité côté Interview passe de `1`
   à `0..1` (`Feedback.interview` est une `@ManyToOne` sans `nullable=false`, donc
   un feedback peut exister sans entretien).

## Figure 3.2b — Classes : utilisateurs et sécurité

1. Association `User — Department` : la multiplicité côté Department passe de `1`
   à `0..1` (`@JoinColumn(name = "department_id")` sans `nullable=false`).
2. `AuditLog.performedAt : DateTime` → `LocalDateTime`.

## Figure 3.3 — Séquence technique : soumission et scoring

1. Après `BE -> DB : Vérifier unicité et enregistrer la candidature + le CV`,
   ajouter un message **Backend → PostgreSQL**
   `File d'attente n8n (outbox) — événement PENDING`.
2. Ajouter **Backend → Frontend** `201 Created`, puis **Frontend → Candidat**
   `Confirmation de soumission` — la réponse HTTP part avant tout appel n8n.
3. Ajouter **Backend → Agent n8n 1**
   `N8nOutboxService, tâche planifiée (5 s) : webhook « nouvelle candidature »`.
4. Le message suivant devient **Agent n8n 1 → Backend** :
   `POST /api/candidates/{id}/ai-score/recompute (X-N8N-API-Key)`.

## Figure 3.4 — Séquence objet : planifier un entretien

1. Ajouter une ligne de vie **Spring Mail (SMTP)** entre PostgreSQL et l'agent n8n.
2. Message d'entrée : `POST /api/interviews — Planifier un entretien`.
3. Garde-fous (auto-message) : `dossier non clos, CV déjà examiné par le RH,
   créneau libre à l'agenda de l'interviewer`.
4. Ordre exact des messages après persistance :
   - `:InterviewService → PostgreSQL` : `Enregistrer l'entretien et avancer le statut du dossier`
   - `:InterviewService → PostgreSQL` : `Rappels : candidat J-1, interviewer H-2`
   - `:InterviewService → Spring Mail` : `Convocation du candidat`
   - `:InterviewService ⇢ Agent n8n 2` (flèche asynchrone) : `Webhook « ENTRETIEN_PLANIFIE » (appel asynchrone)`
   - `:InterviewService → RH` : `Entretien planifié`
   - `Agent n8n 2 → Google Calendar` : `Créer l'événement` ; retour `Lien Meet`
   - `Agent n8n 2 → :InterviewService` : `PATCH /api/interviews/{id}/meet-link (callback authentifié, rôle N8N)`
   - `:InterviewService → PostgreSQL` : `Mettre à jour l'entretien (lien Meet)`
5. **Supprimer** la mention `Entretien planifié + convocation candidat` en fin de
   séquence : la convocation part avant le déclenchement n8n, et le lien Meet
   revient par un callback distinct, dans une autre transaction.

## Figure 3.5 — Séquence objet : décision finale

1. Premier message d'entrée : `PATCH /api/candidates/{id}/manager-decision
   — décision = ACCEPTED ou REJECTED (+ motif)`.
2. Auto-garde du service : `Avis réservé aux dossiers transmis (TECHNICAL_TEST,
   INTERVIEW, FINAL_INTERVIEW)` — à la place de « Périmètre du manager et transition
   autorisée », qui est inexact.
3. Second message d'entrée : `PATCH /api/candidates/{id}/final-validation
   — décision = HIRED (+ date) ou REJECTED (+ motif)`.
4. Auto-garde : `Garde-fous : avis de manager en attente, date (HIRED) ou motif
   exigés, compte purement manager exclu`.

## Figure 3.6 — Séquence objet : analyse IA du CV

À ressaisir intégralement dans cet ordre (le diagramme actuel fait intervenir
l'extraction du CV et le seuil au mauvais endroit) :

1. `Agent n8n 1 → :CandidateController` : `POST /{id}/ai-score/recompute (X-N8N-API-Key)`
2. `:CandidateController → :CandidateService` : `recomputeAiScore()`
3. `:CandidateService → :AiScoringService` : `computeScore()`
4. `:AiScoringService → :SkillNormalizationService` : `analyzeMatching()` ;
   retour `compétences matchées / manquantes, taux de recouvrement technique`
5. `:AiScoringService → :CohereClient` : `scoreCandidate()` ;
   `:CohereClient → API Cohere` : `POST /v2/chat` ;
   retour `Sous-scores et synthèse` ; retour `Scores technique / communication / séniorité`
6. `:AiScoringService → PostgreSQL` : `Lire le profil de pondération` ;
   retour `Poids des critères`
7. Auto-message `:AiScoringService` : `Score global pondéré, garde de séniorité (plafond 45)`
8. `:AiScoringService → :CandidateService` : `Score, source et needsHumanReview`
9. `:CandidateService → PostgreSQL` : `Enregistrer score, sous-scores et explication`
10. Auto-message `:CandidateService` : `needsHumanReview ou score de 60 et plus :
    CV_REVIEWED, sinon AUTO_REJECTED`
11. `:CandidateService → :CandidateController` : `Résultat du scoring` ;
    `:CandidateController → Agent n8n 1` : `200 OK`
12. Note à droite de `:AiScoringService` :

> Seuil 60 et zone grise 55-65 : le dossier signalé rejoint CV_REVIEWED, jamais
> AUTO_REJECTED. La séniorité est calculée de façon déterministe dès que les années
> sont chiffrées des deux côtés. Le plancher de 30 ne vaut qu'en mode dégradé.

## Figure 3.7 — Séquence objet : routage vers le manager

1. Après la proposition, ajouter `:CandidateService → RH` : `proposition pré-sélectionnée`.
2. Ajouter `RH → :CandidateController` : `GET /api/job-offers/manager-candidates`,
   retour `liste des comptes MANAGER`.
3. Le message de transmission devient `PATCH /{id}/status : statut évaluation
   technique + managerId désigné`, puis `:CandidateController → :CandidateService` :
   `updateCandidateStatus(…, managerId)` et `:CandidateService → :ManagerRoutingService` :
   `resolveManual(managerId)`.
4. Dans la branche d'erreur de l'`alt`, écrire : `destinataire absent, sans rôle
   MANAGER ou sans e-mail (400), ou compte introuvable (404)`.

## Figure 3.8 — États du cycle de vie d'une candidature

Trois transitions sont mal attribuées (le manager n'a aucune prise sur un dossier
encore côté RH — `Candidate.isAwaitingManagerAdvice()` ne couvre que
TECHNICAL_TEST, INTERVIEW et FINAL_INTERVIEW) :

1. `CV_REVIEWED → MANAGER_REJECTED` devient `TECHNICAL_TEST → MANAGER_REJECTED`,
   libellé `refus proposé par le manager`.
2. `PHONE_SCREENING → ACCEPTED` devient `TECHNICAL_TEST → ACCEPTED`,
   libellé `avis favorable du manager`.
3. Ajouter `FINAL_INTERVIEW → ACCEPTED`, libellé `avis favorable du manager`.

## Figure 3.9 — Schéma relationnel PostgreSQL

1. Colonnes rendues à tort obligatoires (`* … <<FK>>`) alors que la `@JoinColumn`
   ne porte pas `nullable=false` : retirer l'astérisque sur
   `users.department_id`, `job_offers.department_id`, `job_offers.created_by`,
   `job_offers.hiring_manager_id`, `candidates.job_offer_id`,
   `candidates.routed_to_manager_id`, `feedbacks.interview_id`.
2. Cardinalités côté « un » à passer en 0..1 : departments→users,
   departments→job_offers, created_by, hiring_manager, job_offers→candidates,
   routed_to_manager, interviews→feedbacks.
3. `internal_notes.candidate_id` : **ce n'est pas une clé étrangère**
   (`@Column(name = "candidate_id") private Long candidateId`, aucune relation JPA).
   Retirer `<<FK>>`, lier `candidates` à `internal_notes` par un trait pointillé
   `concerne (sans contrainte)`, et compléter la note :

> Trois tables sans clé étrangère : internal_notes référence son dossier par une
> simple colonne candidate_id (liée par @Column, non par @ManyToOne), les rappels
> visent un objet désigné par related_type / related_id, et le jeton de
> réinitialisation est rattaché au compte par l'adresse e-mail.

4. Ajouter aux colonnes déjà listées de `internal_notes` : `created_at : timestamp`,
   `updated_at : timestamp`, `is_pinned : boolean`.
5. Dans la note sous `candidates`, remplacer « figurent dans le script DDL » par
   « sont générés par Hibernate avec le schéma » (aucun script DDL n'existe :
   `spring.jpa.hibernate.ddl-auto=update`).

## Figure 3.10 — Diagramme de composants

1. Dans le paquetage Backend, ajouter deux composants :
   `Chatbot (OpenRouter)` et `Stockage des CV (système de fichiers)`.
2. Ajouter `Services métier → Chatbot (OpenRouter)`,
   `Services métier → Stockage des CV : dépôt et lecture du CV`,
   `Chatbot (OpenRouter) → API externes`.
3. Renommer le nuage externe en
   `API externes (Cohere, OpenRouter, SMTP, Google Calendar)` — le chatbot
   n'appelle pas Cohere mais OpenRouter (`OpenRouterClient`, modèle
   `z-ai/glm-5.3-flash`).

## Figure 3.11 — Diagramme de déploiement

1. Ajouter les adresses locales : Angular `http://localhost:4200`,
   API `http://localhost:8080/api`, n8n `http://localhost:5678`,
   PostgreSQL `localhost:5432 / job4you_db`.
2. Renommer l'artefact `API LLM (chatbot)` en `API OpenRouter (chatbot)`.
3. **Ajouter la flèche manquante** `n8n → Serveur SMTP`, libellé
   `e-mails candidats, RH et managers (nodes emailSend)` : les trois agents envoient
   leurs propres e-mails, et non le back-end.
4. Libellé de la flèche Spring → SMTP : `e-mails transactionnels
   (EmailService / JavaMailSender)`.

---

# Volet déjà appliqué dans le document (aucune action requise)

Corrections de texte portées dans `Rapport_PFE_Haythem_Bargaoui_beta.docx`
(§255, §270, §303, §311, §321, §325, §329, §339-§343, §409, §430, §452, §458, §514),
puis recalcul des numéros de page statiques de la table des matières, de la liste
des figures et de la liste des tableaux. Le PDF régénéré compte **81 pages**, aucune
page blanche, et le contrôle de pagination converge à 0 écart.
Sauvegardes à côté du fichier : `.pre-patch-v12.bak`, `.pre-patch-v13.bak`,
`.pre-repage.bak`, `.pre-captures.bak`, `.pre-extent.bak`, `.pre-recrop.bak`,
`.pre-n8n-stats.bak`, `.pre-fig420.bak` ; l'ancien PDF est conservé en
`.pdf.pre-v20.bak` et `.pdf.pre-fig420.bak`.

**Après ressaisie des 16 figures**, réexécuter la pagination : les images
StarUML changeront de hauteur et les numéros de page statiques seront de nouveau
faux. Lancer `python scratch/repage.py --pdf <nouveau pdf>` (contrôle), puis
`--apply` (écriture), puis réexporter le PDF.

---

# Captures : statut au 19/10/2026

## Déjà reprises et insérées dans le document (aucune action)

| Figure | Contenu | Preuve |
|---|---|---|
| 4.5 | Chatbot, question « bonjour » et réponse réelle du modèle | widget connecté après correction TLS du SASE (`scratch/start_backend.ps1`, `-Djavax.net.ssl.trustStoreType=Windows-ROOT`) |
| 4.16 | Boutons lien Meet et avis manager | capture sur la pile locale |
| 4.19 | Historique d'audit, lignes `ROUTING` / `ROUTING_MANUAL` / système | capture sur la pile locale |
| 4.22 | E-mail de confirmation généré par l'Agent 1 pour une candidature réelle (score Cohere 85/100, source `COHERE`, horodaté du 19/10/2026) | l'ancienne trace du `70/100` inventé a disparu ; §458 et §514 décrivent désormais le repli « profil en cours d'analyse » |

Le paragraphe §452 a été réaligné sur la table d'exécutions de l'instance :
154 exécutions déclenchées par webhook, 124 abouties, 30 en échec — les 30 échecs
tant tous imputables à l'Agent 2 et concentrés sur la calibration des 15-18 octobre,
aucune exécution en échec après le 18 octobre, durée moyenne d'une exécution réussie
5,6 s.

## Capture à faire par toi : figure 4.20 (console n8n) — **FAITE le 19/10/2026**

Reprise depuis la console connectée : bandeau `119 / 30 / 25,2 % / 4,2 s` et les
trois flux à l'état **Published**. Insérée à la place de l'ancienne capture
(`15 / 0 / 0 % / 3,61 s`), cadre ajusté à 425,0 × 224,2 pt, pagination recalculée
(81 pages, 0 écart).

Point à connaître si ton encadrant pose la question : les compteurs de la console et
la table d'exécutions de l'instance ne comptent pas la même chose. La table
(`execution_entity`) donne **154 exécutions déclenchées par webhook, 124 abouties,
30 en échec, 5,57 s en moyenne sur les réussites** ; le bandeau, calculé sur
l'agrégat d'observations interne à n8n (`insights`), affiche **119 / 30 / 25,2 % /
4,2 s**. Les deux convergent exactement sur les 30 échecs. Le §452 énonce maintenant
les deux chiffres et désigne la table comme mesure de référence — il n'y a plus de
contradiction à corriger.

