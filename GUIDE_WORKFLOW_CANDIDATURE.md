# Guide du Workflow de Candidature

## 🎯 **WORKFLOW UNIQUE : CANDIDATURE AUX OFFRES D'EMPLOI**

Cette application de recrutement utilise un **workflow unique et simplifié** pour les candidatures aux offres d'emploi.

## 📋 **PROCESSUS DE CANDIDATURE**

### 👨‍💼 **1. Pour les Candidats**

#### **Étape 1 : Consulter les offres**
- Aller sur `http://localhost:4200/job-offers`
- Parcourir les offres d'emploi disponibles
- Cliquer sur une offre pour voir les détails

#### **Étape 2 : Postuler à une offre**
- Sur la page de détail d'une offre, cliquer sur **"Postuler"**
- Remplir le formulaire avec :
  - Prénom et nom
  - Email
  - Téléphone  
  - Télécharger votre CV (PDF, DOC, DOCX)
- Cliquer sur **"Envoyer ma candidature"**

#### **Étape 3 : Confirmation**
- Réception d'un email de confirmation
- Votre candidature est maintenant dans le système

### 👩‍💼 **2. Pour les RH/Administrateurs**

#### **Gestion des candidatures**
- Dashboard : `http://localhost:4200/admin/dashboard`
- Candidats : `http://localhost:4200/admin/candidates`
- Voir toutes les candidatures reçues
- Filtrer par statut : `APPLIED`, `CV_REVIEWED`, `INTERVIEW`, etc.

#### **Processus RH**
1. **Examiner les candidatures** → Changer statut vers `CV_REVIEWED`
2. **Inviter aux entretiens** → Créer des entretiens via `/admin/interviews`
3. **Donner des feedbacks** → Via `/admin/feedbacks`
4. **Prendre des décisions** → `ACCEPTED` ou `REJECTED`

### 🔧 **3. Pour les Équipes Techniques**

#### **Participation aux évaluations**
- Les membres de l'équipe (TEAM_LEAD, SENIOR_DEV, TEAM) peuvent :
  - Participer aux entretiens techniques
  - Donner des feedbacks sur les candidats
  - Évaluer les compétences techniques

## 🚀 **ENDPOINTS API PRINCIPAUX**

### **Candidature publique**
```bash
POST /api/candidates/apply
Content-Type: multipart/form-data

Form data:
- candidateData: {"firstName":"John","lastName":"Doe","email":"john.doe@email.com","phone":"0123456789","jobOfferId":1}
- cv: [file]
```

### **Gestion administrative**
```bash
GET /api/candidates                    # Toutes les candidatures
GET /api/candidates/{id}               # Une candidature spécifique
PUT /api/candidates/{id}/status        # Changer le statut
GET /api/job-offers/public             # Offres publiques
```

## ✅ **STATUTS DES CANDIDATURES**

- `APPLIED` : Candidature reçue
- `CV_REVIEWED` : CV examiné par RH
- `PHONE_SCREENING` : Entretien téléphonique prévu
- `TECHNICAL_TEST` : Test technique à passer
- `INTERVIEW` : Entretien en cours/prévu
- `FINAL_INTERVIEW` : Entretien final
- `ACCEPTED` : Candidature acceptée ✅
- `REJECTED` : Candidature rejetée ❌

## 🎉 **AVANTAGES DE CE WORKFLOW**

1. **Simple et efficace** : Un seul processus clair
2. **Centré sur les offres** : Les candidats postulent à des postes précis
3. **Traçable** : Chaque candidature est liée à une offre spécifique
4. **Collaboratif** : Équipes techniques impliquées dans l'évaluation
5. **Automatisé** : Notifications email à chaque étape

## 🔗 **LIENS UTILES**

- **Interface candidat** : http://localhost:4200/job-offers
- **Administration RH** : http://localhost:4200/admin/dashboard
- **API Documentation** : http://localhost:8080/swagger-ui.html

---

> **Note** : Ce système remplace l'ancien workflow d'amélioration de CV pour se concentrer uniquement sur les candidatures aux offres d'emploi réelles.
