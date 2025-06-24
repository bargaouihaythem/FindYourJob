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
  "password": "hr123456",
  "role": ["hr"]
}
```

### Test avec ROLE_MANAGER :
```json
{
  "username": "manager@company.com",
  "email": "manager@company.com", 
  "password": "manager123456",
  "role": ["manager"]
}
```

### Test avec ROLE_ADMIN :
```json
{
  "username": "admin@company.com",
  "email": "admin@company.com",
  "password": "admin123456", 
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
