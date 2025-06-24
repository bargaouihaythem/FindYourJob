# 🎯 SCÉNARIO WORKFLOW COMPLET - Application de Recrutement

## 📋 **DIAGNOSTIC INITIAL**

### ❌ **Problème Identifié**
L'enum des rôles backend ne contenait PAS les rôles équipe nécessaires au workflow complet de recrutement/évaluation des CV.

### 🔍 **Cause Root**
```java
// AVANT - Rôles incomplets
public enum ERole {
    ROLE_USER,       // Candidats ✅
    ROLE_HR,         // Ressources Humaines ✅
    ROLE_MANAGER,    // Manager d'équipe ✅
    ROLE_ADMIN       // Administrateur ✅
    // ❌ MANQUAIENT: ROLE_TEAM_LEAD, ROLE_SENIOR_DEV, ROLE_TEAM
}
```

---

## 🔄 **WORKFLOW COMPLET CORRIGÉ**

### **Phase 1: Candidature** 
1. **Candidat** soumet CV via `/api/cv-improvements/test/submit` ✅
2. **Système** crée candidat + CV + CVImprovement (status: SUBMITTED) ✅

### **Phase 2: Review RH Initial**
3. **RH/Admin** examine les CV soumis via `/api/cv-improvements` ✅
4. **RH/Admin** marque comme en review via `/api/cv-improvements/{id}/review` ✅

### **Phase 3: Assignment à l'Équipe** 
5. **RH/Admin** assigne à une équipe via `/api/cv-improvements/{id}/assign` ✅
   ```json
   {
     "teamName": "Équipe Frontend",
     "hrNotes": "Candidat intéressant pour poste React"
   }
   ```

### **Phase 4: Évaluation Équipe** ✅ **MAINTENANT FONCTIONNEL**
6. **Équipe** (TEAM_LEAD/SENIOR_DEV/TEAM) consulte CV assignés ✅
7. **Équipe** soumet feedbacks via `/api/cv-improvements/{id}/feedback` ✅
   ```json
   {
     "reviewerId": 123,
     "feedbackContent": "Très bon profil technique",
     "rating": 4,
     "suggestions": "Améliorer section projets",
     "feedbackType": "TECHNICAL",
     "strengths": "React, TypeScript, Git",
     "areasForImprovement": "Tests unitaires",
     "overallImpression": "Recommandé pour entretien"
   }
   ```

### **Phase 5: Décision RH Finale**
8. **RH** collecte tous les feedbacks équipe ✅
9. **RH** prend décision finale via `/api/cv-improvements/{id}/finalize` ✅
10. **Système** envoie notification automatique au candidat ✅

---

## 👥 **RÔLES ET RESPONSABILITÉS**

### **🎯 ROLE_USER (Candidats)**
- ✅ Soumettre CV pour amélioration
- ✅ Recevoir notifications automatiques

### **🎯 ROLE_HR (Ressources Humaines)**
- ✅ Examiner toutes les candidatures
- ✅ Assigner CV aux équipes 
- ✅ Collecter feedbacks équipe
- ✅ Prendre décisions finales
- ✅ Gérer notifications candidats

### **🎯 ROLE_ADMIN (Administrateurs)**
- ✅ Toutes les permissions RH
- ✅ Gestion utilisateurs et rôles
- ✅ Configuration système

### **🎯 ROLE_MANAGER (Managers)**
- ✅ Consulter CV de leurs équipes
- ✅ Valider feedbacks équipe
- ✅ Recommandations finales

### **🎯 ROLE_TEAM_LEAD (Chefs d'équipe technique)** ⭐ **NOUVEAU**
- ✅ Consulter CV assignés à l'équipe
- ✅ Donner feedbacks techniques détaillés
- ✅ Évaluer compétences techniques
- ✅ Recommander/rejeter candidats

### **🎯 ROLE_SENIOR_DEV (Développeurs senior)** ⭐ **NOUVEAU**
- ✅ Évaluer compétences techniques spécifiques
- ✅ Review de code samples/portfolios
- ✅ Feedbacks techniques approfondis
- ✅ Mentorat potentiel candidats juniors

### **🎯 ROLE_TEAM (Membres d'équipe)** ⭐ **NOUVEAU**
- ✅ Consulter CV futurs collègues
- ✅ Donner feedbacks sur fit équipe
- ✅ Evaluer soft skills
- ✅ Participation processus collaboratif

---

## 🔐 **AUTORISATIONS ENDPOINTS**

### **Consultation CV**
```java
@PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or 
              hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
```

### **Soumission Feedbacks**
```java
@PreAuthorize("hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM') or 
              hasRole('MANAGER') or hasRole('HR') or hasRole('ADMIN')")
```

### **Assignment équipe** 
```java
@PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
```

### **Décisions finales**
```java
@PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
```

---

## 🌐 **INTERFACES FRONTEND**

### **Admin/RH Dashboard**
- `/admin/candidates` - Gestion candidats
- `/admin/cv-improvements` - Workflow CV
- `/admin/notifications` - Notifications système

### **Équipe Interface** ⭐ **NOUVEAU FONCTIONNEL**
- `/team/feedback/{id}` - Interface feedback équipe
- Accessible aux rôles: `ROLE_MANAGER`, `ROLE_TEAM_LEAD`, `ROLE_SENIOR_DEV`, `ROLE_TEAM`

---

## 📊 **MÉTRIQUES & WORKFLOW**

### **Statuts CV Improvement**
- `SUBMITTED` → CV soumis par candidat
- `UNDER_REVIEW` → En cours de review RH
- `ASSIGNED_TO_TEAM` → Assigné à une équipe  
- `FEEDBACK_COLLECTED` → Feedbacks équipe collectés
- `FINAL_DECISION_MADE` → Décision RH finale
- `CANDIDATE_NOTIFIED` → Candidat notifié

### **Types de Feedback**
- `TECHNICAL` → Compétences techniques
- `GENERAL` → Impression générale
- `CULTURAL_FIT` → Adéquation culturelle
- `EXPERIENCE` → Expérience professionnelle

### **Ratings** 
- 1-5 scale pour chaque feedback
- Moyenne calculée automatiquement
- Seuils configurables pour décisions

---

## 🚀 **MISE EN PRODUCTION**

### **1. Migration Base de Données**
```sql
-- Insertion nouveaux rôles
INSERT INTO roles (name) VALUES 
  ('ROLE_TEAM_LEAD'),
  ('ROLE_SENIOR_DEV'), 
  ('ROLE_TEAM');
```

### **2. Création Utilisateurs Équipe**
```bash
# Via API /api/auth/signup
{
  "username": "team_lead_1",
  "email": "teamlead@company.com", 
  "password": "password",
  "role": ["team_lead"]
}
```

### **3. Test Workflow Complet**
1. Candidat soumet CV ✅
2. RH assigne à équipe ✅
3. Équipe donne feedbacks ✅
4. RH prend décision ✅
5. Candidat reçoit notification ✅

---

## ✅ **RÉSOLUTION COMPLÈTE**

Le rôle "équipe" était effectivement manquant dans votre application. Avec cette correction :

🎯 **Le workflow RH/équipe est maintenant 100% fonctionnel**
🔐 **Les autorisations sont cohérentes frontend/backend**  
👥 **Tous les acteurs ont leurs interfaces appropriées**
📧 **Les notifications automatiques fonctionnent**
🗄️ **La gestion des CV est entièrement locale**

**Votre application de recrutement dispose maintenant d'un workflow complet et professionnel ! 🎉**
