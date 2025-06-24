# 🔄 GUIDE COMPLET - Deux Workflows de Recrutement

## 🎯 **CLARIFICATION IMPORTANTE**

Votre application supporte **DEUX workflows distincts** :

---

## 📝 **WORKFLOW 1 : AMÉLIORATION DE CV**

### 🎯 **Objectif**
Les candidats soumettent leur CV pour obtenir des **conseils d'amélioration** de la part d'experts.

### 🔄 **Processus**
1. **Candidat** : Soumet CV via interface spéciale (sans offre d'emploi)
2. **RH** : Examine le CV soumis
3. **Équipe** : Donne des feedbacks détaillés (points forts, améliorations)  
4. **RH** : Compile les suggestions et les renvoie au candidat

### 🌐 **Endpoints**
- **Soumission** : `POST /api/cv-improvements/test/submit`
- **Gestion RH** : `GET /api/cv-improvements`
- **Feedback équipe** : `POST /api/cv-improvements/{id}/feedback`

### 📊 **Statuts**
- `SUBMITTED` → `UNDER_REVIEW` → `ASSIGNED_TO_TEAM` → `FEEDBACK_COLLECTED` → `SUGGESTIONS_SENT`

---

## 💼 **WORKFLOW 2 : CANDIDATURE À UNE OFFRE**

### 🎯 **Objectif**  
Les candidats **postulent** à des offres d'emploi spécifiques pour être recrutés.

### 🔄 **Processus**
1. **RH** : Crée une offre d'emploi
2. **Candidat** : Postule à l'offre avec son CV
3. **RH** : Examine la candidature  
4. **RH** : Planifie entretiens
5. **Équipe** : Réalise entretiens et donne feedbacks
6. **RH** : Prend décision finale (accepter/rejeter)

### 🌐 **Endpoints**
- **Voir offres** : `GET /api/job-offers/public`
- **Postuler** : `POST /api/candidates/apply`
- **Gestion RH** : `GET /api/candidates`
- **Entretiens** : `POST /api/interviews`

### 📊 **Statuts**
- `APPLIED` → `CV_REVIEWED` → `PHONE_SCREENING` → `INTERVIEW` → `ACCEPTED`/`REJECTED`

---

## 🚀 **COMMENT UTILISER CHAQUE WORKFLOW**

### 📝 **Pour améliorer un CV**
```bash
# Interface dédiée (à créer côté frontend)
# Ou utiliser l'endpoint direct
curl -X POST "http://localhost:8080/api/cv-improvements/test/submit" \
  -F "candidateData={\"firstName\":\"John\",\"lastName\":\"Doe\",\"email\":\"john@example.com\",\"phone\":\"123456789\"}" \
  -F "cv=@mon_cv.pdf"
```

### 💼 **Pour postuler à une offre**
```bash
# 1. Voir les offres disponibles
curl "http://localhost:8080/api/job-offers/public"

# 2. Postuler à une offre spécifique
curl -X POST "http://localhost:8080/api/candidates/apply" \
  -F "application={\"jobOfferId\":1,\"firstName\":\"John\",\"lastName\":\"Doe\",\"email\":\"john@example.com\"}" \
  -F "cv=@mon_cv.pdf"
```

---

## 💻 **INTERFACES FRONTEND**

### 👤 **Pour les Candidats**
- **Voir offres** : `http://localhost:4200/job-offers`
- **Postuler** : Clic sur une offre → "Postuler"
- **Améliorer CV** : Interface dédiée (à développer)

### 👨‍💼 **Pour les RH/Admin**
- **Gérer offres** : `http://localhost:4200/admin/job-offers`
- **Gérer candidats** : `http://localhost:4200/admin/candidates`  
- **CV improvements** : `http://localhost:4200/admin/cv-improvements`

### 👥 **Pour les Équipes**
- **Feedbacks CV** : `http://localhost:4200/team/feedback/{id}`
- **Évaluations candidats** : (dans les entretiens)

---

## ⚡ **ACTIONS IMMÉDIATES**

### ✅ **Ce qui fonctionne déjà**
1. **Candidature à offres** : Workflow complet opérationnel
2. **Amélioration CV** : Backend fonctionnel (avec nouveaux rôles équipe)
3. **Gestion RH** : Interface admin complète

### 🔧 **À développer/corriger**
1. **Interface candidat** pour amélioration CV (frontend)
2. **Tests des nouveaux rôles équipe**
3. **Documentation utilisateur**

---

## 🎉 **RÉSUMÉ**

**Votre confusion est compréhensible !** Vous avez deux systèmes :

1. **📝 CV Improvement** = Service d'aide aux candidats (feedback/conseils)
2. **💼 Job Application** = Recrutement classique (offres → candidatures → embauche)

**Les deux fonctionnent maintenant avec les rôles équipe !** 🚀

Pour **postuler à des offres**, les candidats doivent aller sur :
👉 **http://localhost:4200/job-offers** 👈
