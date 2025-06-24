# Guide - Workflow Unique : Candidature aux Offres d'Emploi

## 🎯 **CLARIFICATION IMPORTANTE**

Cette application utilise maintenant **UN SEUL WORKFLOW** :

### 💼 **WORKFLOW DE CANDIDATURE À UNE OFFRE D'EMPLOI**

**Processus complet :**

1. ✅ **Candidat** accède aux offres publiques via `/api/job-offers/public`
2. ✅ **Candidat** consulte une offre spécifique 
3. ✅ **Candidat** postule via le formulaire avec son CV (`/api/candidates/apply`)
4. ✅ **RH** examine les candidatures via l'interface admin
5. ✅ **RH** programme des entretiens avec les candidats sélectionnés
6. ✅ **Équipe** évalue les candidats durant les entretiens
7. ✅ **RH** prend la décision finale (accepter/refuser)

## 🔄 **WORKFLOW SUPPRIMÉ**

❌ **L'ancien système "Amélioration de CV"** a été complètement supprimé :
- Plus d'endpoint `/api/cv-improvements/*`
- Plus de soumission de CV pour feedback
- Plus d'interface d'administration pour les améliorations CV
- Plus de workflow d'équipe pour donner des conseils

## 🚀 **UTILISATION**

### **Pour les candidats :**
1. Aller sur "Offres d'emploi"
2. Consulter les offres disponibles
3. Cliquer sur "Postuler" sur l'offre qui vous intéresse
4. Remplir le formulaire avec vos informations et votre CV

### **Pour les RH/Admin :**
1. Aller sur "Administration" → "Candidats"
2. Consulter toutes les candidatures reçues
3. Programmer des entretiens
4. Suivre le processus de recrutement

### **Pour l'équipe (TEAM_LEAD, SENIOR_DEV, TEAM) :**
1. Participer aux entretiens programmés par les RH
2. Donner des feedbacks sur les candidats interviewés
3. Aider à la prise de décision finale

## ✅ **AVANTAGES DE CE NOUVEAU SYSTÈME**

- **Plus simple** : Un seul processus clair
- **Plus efficace** : Les candidats postulent directement aux offres qui les intéressent
- **Plus professionnel** : Processus de recrutement standard dans l'industrie
- **Meilleur suivi** : Les RH peuvent suivre toutes les candidatures centralisées

## 🔧 **ENDPOINTS ACTIFS**

### **Public (candidats) :**
- `GET /api/job-offers/public` - Lister les offres d'emploi
- `GET /api/job-offers/public/{id}` - Détail d'une offre
- `POST /api/candidates/apply` - Postuler à une offre

### **Administration (RH/Admin) :**
- `GET /api/candidates` - Lister tous les candidats
- `GET /api/candidates/{id}` - Détail d'un candidat
- `POST /api/interviews` - Programmer un entretien
- `GET /api/interviews` - Lister les entretiens

### **Équipe (évaluation) :**
- `POST /api/interviews/{id}/feedback` - Donner un feedback après entretien
- `GET /api/interviews/team` - Voir ses entretiens assignés

---

**Cette simplification améliore l'expérience utilisateur et aligne l'application sur les pratiques standards de recrutement.**
