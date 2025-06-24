# Guide de Test Complet - Application de Recrutement

## Prérequis
1. Backend Spring Boot démarré sur `http://localhost:8080`
2. Frontend Angular démarré sur `http://localhost:4200`
3. Base de données configurée
4. Configuration SMTP Gmail activée

## Étape 1 : Créer les données de test

### 1.1 Créer un scénario complet avec l'endpoint de test
```bash
curl -X POST "http://localhost:8080/api/test/setup-complete-scenario"
```

Cette commande créera :
- Plusieurs utilisateurs avec différents rôles
- Des offres d'emploi
- Des candidatures
- Des entretiens programmés

### 1.2 Ou créer manuellement les utilisateurs

#### Créer un utilisateur HR
```bash
curl -X POST "http://localhost:8080/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "hr@company.com",
    "email": "hr@company.com",
    "password": "hr123456",
    "role": ["hr"]
  }'
```

#### Créer un utilisateur Admin
```bash
curl -X POST "http://localhost:8080/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin@company.com",
    "email": "admin@company.com",
    "password": "admin123456",
    "role": ["admin"]
  }'
```

#### Créer un Manager
```bash
curl -X POST "http://localhost:8080/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "manager@company.com",
    "email": "manager@company.com",
    "password": "manager123456",
    "role": ["manager"]
  }'
```

#### Créer un Team Lead
```bash
curl -X POST "http://localhost:8080/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "teamlead@company.com",
    "email": "teamlead@company.com",
    "password": "teamlead123456",
    "role": ["team_lead"]
  }'
```

#### Créer un Senior Developer
```bash
curl -X POST "http://localhost:8080/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "seniordev@company.com",
    "email": "seniordev@company.com",
    "password": "seniordev123456",
    "role": ["senior_dev"]
  }'
```

#### Créer un Candidat
```bash
curl -X POST "http://localhost:8080/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "candidate@company.com",
    "email": "candidate@company.com",
    "password": "candidate123456",
    "role": ["user"]
  }'
```

## Étape 2 : Tester les permissions avec le script PowerShell

Exécutez le script de test des permissions :
```powershell
.\test_permissions.ps1
```

Ce script testera automatiquement :
- L'authentification pour chaque rôle
- Les permissions de consultation d'entretiens
- Les permissions de création d'entretiens

## Étape 3 : Tests manuels dans l'interface web

### 3.1 Test avec un utilisateur HR

1. **Connexion** : Allez sur `http://localhost:4200/login`
   - Email : `hr@company.com`
   - Mot de passe : `hr123456`

2. **Navigation attendue** :
   - ✅ Doit voir le menu "Administration"
   - ✅ Doit voir "Gestion des entretiens"
   - ✅ Doit voir "Gestion des candidatures"

3. **Créer un entretien** :
   - Allez dans "Administration" → "Entretiens"
   - Cliquez sur "Planifier un entretien"
   - Remplissez le formulaire :
     - Candidat : Sélectionnez un candidat
     - Offre d'emploi : Sélectionnez une offre
     - Interviewer : Sélectionnez un utilisateur
     - Date et heure : Choisissez une date future
     - Durée : 60 minutes
     - Lieu : "Bureau" ou "Visioconférence"
     - Type : "TECHNICAL" ou "HR"
   - ✅ L'entretien doit être créé avec succès
   - ✅ Une notification email doit être envoyée

4. **Gérer les entretiens** :
   - ✅ Doit voir tous les entretiens
   - ✅ Peut modifier les entretiens
   - ✅ Peut supprimer les entretiens
   - ✅ Peut changer le statut des entretiens

### 3.2 Test avec un utilisateur Manager

1. **Connexion** :
   - Email : `manager@company.com`
   - Mot de passe : `manager123456`

2. **Navigation attendue** :
   - ✅ Doit voir le menu "Administration" (limité)
   - ✅ Peut voir les entretiens
   - ❌ Ne doit PAS voir le bouton "Créer un entretien"

3. **Consulter les entretiens** :
   - ✅ Peut voir les entretiens existants
   - ✅ Peut voir les détails d'un entretien
   - ✅ Peut modifier le statut d'un entretien
   - ❌ Ne peut PAS créer de nouveaux entretiens
   - ❌ Ne peut PAS supprimer d'entretiens

### 3.3 Test avec un candidat

1. **Connexion** :
   - Email : `candidate@company.com`
   - Mot de passe : `candidate123456`

2. **Navigation attendue** :
   - ❌ Ne doit PAS voir le menu "Administration"
   - ✅ Doit voir "Mes candidatures"
   - ✅ Doit voir "Mes entretiens"
   - ✅ Doit voir "Offres d'emploi"

3. **Postuler à une offre** :
   - Allez dans "Offres d'emploi"
   - Cliquez sur une offre
   - Cliquez sur "Postuler"
   - Remplissez le formulaire de candidature
   - ✅ La candidature doit être soumise

4. **Voir ses entretiens** :
   - Allez dans "Mes entretiens"
   - ✅ Doit voir uniquement ses propres entretiens
   - ✅ Ne peut PAS modifier les entretiens
   - ✅ Peut voir les détails (date, lieu, type)

## Étape 4 : Tests des notifications email

### 4.1 Vérifier la configuration Gmail SMTP

Dans `application.properties` :
```properties
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=votre-email@gmail.com
spring.mail.password=votre-mot-de-passe-application
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
```

### 4.2 Tester l'envoi d'emails

1. **Créer un entretien avec HR** :
   - Planifiez un entretien avec un candidat réel (avec votre vraie adresse email)
   - ✅ Le candidat doit recevoir un email de confirmation
   - ✅ L'interviewer doit recevoir une notification

2. **Modifier le statut d'un entretien** :
   - Changez le statut d'un entretien (ex: SCHEDULED → IN_PROGRESS)
   - ✅ Les parties concernées doivent recevoir des notifications

## Étape 5 : Tests de bout en bout

### Workflow complet candidat :
1. **Inscription** → Connexion → **Consultation des offres** → **Candidature** → **Réception d'email de confirmation**
2. **HR crée un entretien** → **Candidat reçoit invitation** → **Entretien a lieu** → **Statut mis à jour**

### Workflow complet HR :
1. **Connexion HR** → **Consultation candidatures** → **Planification entretien** → **Gestion des statuts** → **Suivi des candidats**

## Résultats attendus

### ✅ Permissions correctes :
- **HR & ADMIN** : Contrôle total (CRUD sur entretiens)
- **MANAGER, TEAM_LEAD, SENIOR_DEV** : Consultation et modification de statut
- **USER (candidats)** : Consultation de leurs propres entretiens uniquement

### ✅ Fonctionnalités opérationnelles :
- Authentification et autorisation
- Création et gestion d'entretiens
- Envoi d'emails de notification
- Interface utilisateur adaptée aux rôles

### ✅ Workflow de recrutement :
- Les candidats peuvent postuler
- HR peut gérer tout le processus
- Les managers/seniors peuvent participer aux entretiens
- Les notifications sont envoyées automatiquement

## Dépannage

### Erreur 403 Forbidden :
- Vérifiez que l'utilisateur a le bon rôle
- Vérifiez que le token d'authentification est valide
- Consultez les logs du backend pour plus de détails

### Emails non reçus :
- Vérifiez la configuration SMTP
- Vérifiez que le mot de passe d'application Gmail est correct
- Consultez les logs pour voir les erreurs d'envoi

### Interface utilisateur :
- Actualisez la page après connexion
- Vérifiez la console du navigateur pour les erreurs JavaScript
- Assurez-vous que le backend est accessible depuis le frontend
