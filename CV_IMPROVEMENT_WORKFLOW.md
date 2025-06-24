# 📋 WORKFLOW COMPLET - Amélioration CV

## 🎯 Fonctionnalité à implémenter

**Scénario :** Une personne dépose son CV → CV envoyé aux RH → RH le transmettent à l'équipe concernée → L'équipe donne 3 feedbacks aux RH → RH retournent les feedbacks à la personne avec des suggestions d'amélioration par email.

## 🏗️ Architecture

### 1. **Entités Backend**
- `CVImprovement` (nouvelle)
- `CVFeedback` (nouvelle) 
- `CVSuggestion` (nouvelle)
- Extension de `Candidate`

### 2. **Nouveaux Endpoints**
- `/api/public/cv/submit` - Dépôt public de CV
- `/api/cv-improvements` - Gestion workflow
- `/api/cv-feedbacks` - Feedbacks équipe
- `/api/cv-suggestions` - Suggestions RH

### 3. **Frontend**
- Page publique de dépôt CV
- Interface RH workflow
- Interface équipe feedback
- Templates email

## 📊 Base de Données

### Table `cv_improvements`
```sql
- id (Long)
- candidate_id (Long)
- cv_id (Long) 
- status (SUBMITTED, UNDER_REVIEW, FEEDBACK_PENDING, COMPLETED)
- assigned_to_team (String)
- created_at (DateTime)
- completed_at (DateTime)
```

### Table `cv_feedbacks`
```sql
- id (Long)
- cv_improvement_id (Long)
- reviewer_id (Long)
- feedback_content (Text)
- rating (Integer 1-5)
- suggestions (Text)
- created_at (DateTime)
```

### Table `cv_suggestions`
```sql
- id (Long)
- cv_improvement_id (Long)
- section (HEADER, EXPERIENCE, SKILLS, EDUCATION, FORMATTING)
- suggestion_text (Text)
- priority (HIGH, MEDIUM, LOW)
- created_by (Long)
```

## 🔄 Workflow Statuts

1. **SUBMITTED** - CV déposé, en attente de review RH
2. **UNDER_REVIEW** - RH examine le CV
3. **ASSIGNED_TO_TEAM** - CV assigné à une équipe
4. **FEEDBACK_PENDING** - En attente des 3 feedbacks équipe
5. **CONSOLIDATING** - RH consolide les feedbacks
6. **COMPLETED** - Suggestions envoyées au candidat

## 📧 Templates Email

1. **cv-submission-confirmation** - Confirmation dépôt CV
2. **cv-assignment-notification** - Notification équipe
3. **cv-feedback-reminder** - Rappel feedback équipe  
4. **cv-improvement-suggestions** - Suggestions finales au candidat

## 🚀 Plan d'implémentation

### Phase 1: Backend
1. Créer nouvelles entités
2. Implémenter services
3. Créer controllers
4. Templates email

### Phase 2: Frontend  
1. Page publique dépôt CV
2. Interface workflow RH
3. Interface feedback équipe
4. Dashboard suivi

### Phase 3: Intégration
1. Tests workflow complet
2. Notifications email
3. Déploiement
