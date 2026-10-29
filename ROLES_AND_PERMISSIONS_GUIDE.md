# Guide des Rôles et Permissions - Application de Recrutement

## Rôles Disponibles

Voici les 7 rôles définis dans votre application :

### 1. **ROLE_USER** (Candidats)
- **Description** : Candidats qui postulent aux offres d'emploi
- **Permissions** :
  - ✅ Consulter les offres d'emploi
  - ✅ Postuler aux offres
  - ✅ Voir leurs propres entretiens (`/api/interviews/by-email/{email}`)
  - ✅ Voir leurs propres candidatures
  - ❌ Créer/modifier/supprimer des entretiens
  - ❌ Accéder aux sections admin

### 2. **ROLE_HR** (Ressources Humaines)
- **Description** : Personnel RH responsable du processus de recrutement
- **Permissions** :
  - ✅ **CRÉER** des entretiens (`POST /api/interviews`)
  - ✅ **CONSULTER** tous les entretiens (`GET /api/interviews`)
  - ✅ **MODIFIER** les entretiens (`PUT /api/interviews/{id}`)
  - ✅ **SUPPRIMER** des entretiens (`DELETE /api/interviews/{id}`)
  - ✅ Consulter les entretiens par statut, type, date
  - ✅ Gérer les candidatures
  - ✅ Envoyer des notifications

### 3. **ROLE_ADMIN** (Administrateurs)
- **Description** : Administrateurs système avec accès complet
- **Permissions** :
  - ✅ **TOUTES** les permissions HR
  - ✅ **CRÉER** des entretiens (`POST /api/interviews`)
  - ✅ **CONSULTER** tous les entretiens (`GET /api/interviews`)
  - ✅ **MODIFIER** les entretiens (`PUT /api/interviews/{id}`)
  - ✅ **SUPPRIMER** des entretiens (`DELETE /api/interviews/{id}`)
  - ✅ Gestion complète du système
  - ✅ Accès aux données de test

### 4. **ROLE_MANAGER** (Managers)
- **Description** : Managers d'équipe qui participent aux entretiens
- **Permissions** :
  - ✅ **CONSULTER** les entretiens (`GET /api/interviews/{id}`)
  - ✅ **CONSULTER** les entretiens par candidat (`GET /api/interviews/candidate/{candidateId}`)
  - ✅ **CONSULTER** leurs propres entretiens (`GET /api/interviews/interviewer/{interviewerId}`)
  - ✅ **MODIFIER** le statut des entretiens (`PATCH /api/interviews/{id}/status`)
  - ✅ Consulter les entretiens par période
  - ❌ **CRÉER** de nouveaux entretiens
  - ❌ **SUPPRIMER** des entretiens

### 5. **ROLE_TEAM_LEAD** (Chefs d'équipe technique)
- **Description** : Chefs d'équipe technique
- **Permissions actuelles** : Pas de permissions spécifiques définies
- **Recommandation** : Devrait avoir des permissions similaires à MANAGER

### 6. **ROLE_SENIOR_DEV** (Développeurs seniors)
- **Description** : Développeurs seniors qui peuvent participer aux entretiens techniques
- **Permissions actuelles** : Pas de permissions spécifiques définies
- **Recommandation** : Devrait pouvoir consulter et participer aux entretiens techniques

### 7. **ROLE_TEAM** (Membres d'équipe)
- **Description** : Membres d'équipe générique
- **Permissions actuelles** : Pas de permissions spécifiques définies

## Garde-fous du pipeline (cohérence des statuts)

La machine à états `CandidateStatus` (13 statuts) ne se parcourt que vers l'avant. Les arcs
arrière sont décidés par `CandidateService.isTransitionAllowed(from, to)` ; `from == to` est
idempotent et ne déclenche aucun e-mail. Cinq garde-fous complètent cette règle :

| Garde-fou | Règle | Verrouillé pour qui | Réponse renvoyée |
|---|---|---|---|
| **Réouverture après refus** | Sortir d'un `AUTO_REJECTED` ou `MANAGER_REJECTED` pour replacer le dossier en pipeline exige un **motif** non vide, tracé dans l'audit. | RH, ADMIN (le glissement kanban sans motif est refusé) | HTTP 400 — « Rouvrir un dossier après un refus exige une justification : précisez le motif de l'arbitrage. » |
| **Retrait après décision** | Un dossier déjà jugé ou déjà notifié (`HIRED`, `ACCEPTED`, `INTERVIEW_SCHEDULED`, `REJECTED`, `AUTO_REJECTED`, `MANAGER_REJECTED`, `WITHDRAWN`) ne se retire plus : la liste est dans `CandidateService.RETRAIT_IMPOSSIBLE`. | Le candidat (et tout rôle qui agit pour son dossier) | HTTP 400 — « Cette candidature ne peut plus être retirée : une décision a déjà été prise ou proposée. » |
| **Propriété du dossier** | Toute écriture sur un dossier est réservée à son auteur candidat ou à un rôle privilégié (`assertCandidateOwnerOrPrivileged`). | Candidature | 403 — « Authentification requise » / « Accès refusé » |
| **Auto-contre-signature RH** | Quand le RH qui valide la décision finale est aussi l'auteur de l'avis technique, la contre-signature est **autorisée mais justifiée** : motif obligatoire, et l'entrée d'audit garde la mention « contre-signature par l'auteur même de l'avis (…) ». | RH | HTTP 400 — « Vous avez vous-même rendu cet avis : justifiez votre contre-signature d'un motif. » |
| **Recalcul du score IA** | `POST /api/candidates/{id}/ai-score/recompute` et `PATCH /api/candidates/{id}/ai-score` = `ROLE_N8N`, `ROLE_HR`, `ROLE_ADMIN` ; `PATCH …/ai-score/override` = `ROLE_HR`, `ROLE_ADMIN`. Un MANAGER qui demande un recalcul reçoit un 403 : il consulte le score, il ne l'écrit pas. | MANAGER (exclu) | HTTP 403 |

Ces garde-fous sont testés : 12 vérifications en base réelle (`test_garde_fous_statuts.mjs`,
`test_autoreseing_rh.mjs`) et les scénarios correspondants dans `CandidateServiceTest`.

Reflet côté interface, pour qu'aucun garde-fou ne se découvre seulement par un message d'erreur :
le kanban (`kanban-board.component.ts`) demande le motif au clavier avant un glissement qui refuse
ou qui rouvre un dossier, et « Mes candidatures » remplace le bouton **Retirer** par une ligne
cadenas (`fa-lock`) qui explique pourquoi le retrait est fermé sur ce statut.

## Convention de tri des dates dans les tableaux

Deux lectures coexistent volontairement, toutes deux accessibles au clic sur l'en-tête de colonne
(asc / desc) :

- **Files de travail** — candidatures, e-mails, journal d'audit, retours : **la demande la plus
  récente en premier** (`desc`). C'est ce que cherche un RH qui reprend la main.
- **Agendas d'entretiens** — `/candidate/my-interviews`, `/admin/interviews` : **l'entretien le
  plus proche en premier** (`asc`), y compris côté API (`findByCandidateEmailOrderBy… ASC`).

Le tri par défaut est déclaré dans chaque composant via `TableSort`
(`JOB4YOU-frontend/src/app/services/table-sort.ts`) ; les composants plus anciens
(Candidats, Retours, Entretiens admin, Offres) réinitialisent leur ordre avec
`defaultOrderFor(champ)`. Côté API la même règle est écrite dans la requête, avant que les
données n'arrivent au front : `CandidateRepository.findByEmailOrderByApplicationDateDesc` et
`ORDER BY i.interviewDate ASC` dans `InterviewRepository.findByCandidateEmail`.

## Qui peut effectuer des entretiens ?

### **Créer des entretiens** :
- ✅ **ROLE_HR** (Ressources Humaines)
- ✅ **ROLE_ADMIN** (Administrateurs)
- ❌ ROLE_MANAGER (ne peut que consulter et modifier le statut)
- ❌ Autres rôles

### **Participer comme interviewer** :
Tous les utilisateurs peuvent être assignés comme interviewers dans un entretien, mais seuls HR et ADMIN peuvent créer l'entretien.

### **Gérer les entretiens** :
- **HR & ADMIN** : Contrôle total (CRUD)
- **MANAGER** : Consultation et mise à jour du statut
- **USER** : Ne peut voir que ses propres entretiens

## Workflow recommandé

### Pour créer un entretien :
1. **HR ou ADMIN** se connecte
2. Va dans la section "Entretiens" 
3. Clique sur "Planifier un entretien"
4. Sélectionne :
   - Le candidat
   - L'offre d'emploi
   - L'interviewer (peut être n'importe quel utilisateur)
   - Date, heure, lieu, type

### Pour participer à un entretien :
1. L'interviewer assigné reçoit une notification
2. Il peut consulter les détails de l'entretien
3. Après l'entretien, il peut (selon ses permissions) :
   - Modifier le statut (MANAGER+)
   - Ajouter des commentaires/feedback

## Tests recommandés

### Test avec ROLE_HR :
```json
{
  "username": "hr@company.com",
  "email": "hr@company.com",
  "password": "{{test_password}}",
  "role": ["hr"]
}
```

### Test avec ROLE_MANAGER :
```json
{
  "username": "manager@company.com",
  "email": "manager@company.com", 
  "password": "{{test_password}}",
  "role": ["manager"]
}
```

### Test avec ROLE_ADMIN :
```json
{
  "username": "admin@company.com",
  "email": "admin@company.com",
  "password": "{{admin_password}}",
  "role": ["admin"]
}
```

## Actions à effectuer

### 1. Améliorer les permissions pour TEAM_LEAD et SENIOR_DEV :
Ajoutez ces rôles aux annotations de sécurité pour qu'ils puissent participer aux entretiens techniques.

### 2. Interface utilisateur :
- Les boutons de création d'entretien ne doivent apparaître que pour HR et ADMIN
- Les managers voient les boutons de consultation et modification de statut
- Les candidats ne voient que leurs propres entretiens

### 3. Tests de bout en bout :
1. Créer des utilisateurs de chaque rôle
2. Tester la création d'entretiens (HR/ADMIN uniquement)
3. Tester la consultation (selon les permissions)
4. Tester la modification (selon les permissions)
