# 👥 Comptes de Test - Application de Recrutement

## Utilisateurs créés automatiquement

L'application crée automatiquement 3 utilisateurs de test au premier démarrage pour tester tous les scénarios :

### 🔐 ADMINISTRATEUR
- **Username:** `haythemadmin`  
- **Password:** `haythemadmin`
- **Email:** haythemadmin@admin.com
- **Rôle:** ROLE_ADMIN
- **Permissions:** Accès complet à toutes les fonctionnalités

#### Fonctionnalités disponibles :
- ✅ Création/modification/suppression d'offres d'emploi
- ✅ Gestion des candidats et candidatures
- ✅ Planification des entretiens
- ✅ Gestion des utilisateurs
- ✅ Accès aux statistiques et rapports
- ✅ Configuration système

---

### 🏢 RESSOURCES HUMAINES
- **Username:** `rh_user`
- **Password:** `rh123`  
- **Email:** rh@company.com
- **Rôle:** ROLE_HR
- **Permissions:** Gestion du recrutement

#### Fonctionnalités disponibles :
- ✅ Création/modification d'offres d'emploi
- ✅ Consultation des candidatures
- ✅ Planification des entretiens
- ✅ Envoi de notifications aux candidats
- ✅ Gestion des feedbacks
- ❌ Pas d'accès à la configuration système

---

### 👤 CANDIDAT
- **Username:** `candidat_test`
- **Password:** `candidat123`
- **Email:** candidat@test.com  
- **Rôle:** ROLE_USER
- **Permissions:** Consultation et candidature

#### Fonctionnalités disponibles :
- ✅ Consultation des offres d'emploi publiques
- ✅ Candidature aux offres
- ✅ Amélioration de CV
- ✅ Suivi de ses candidatures
- ✅ Consultation de ses entretiens
- ❌ Pas d'accès aux fonctions administratives
- ❌ Ne voit pas les boutons "Créer un compte" quand connecté

---

## 🧪 Scénarios de Test

### Test 1: Workflow Admin
1. Connectez-vous avec `haythemadmin`
2. Allez dans "Administration" > "Gestion des offres"
3. Créez 2-3 offres d'emploi
4. Vérifiez qu'elles apparaissent dans la liste

### Test 2: Workflow RH  
1. Connectez-vous avec `rh_user`
2. Vérifiez l'accès au menu "Administration"
3. Créez une offre d'emploi
4. Consultez les candidatures

### Test 3: Workflow Candidat
1. Connectez-vous avec `candidat_test`
2. Vérifiez que les boutons "Créer un compte" n'apparaissent pas
3. Consultez les offres d'emploi
4. Postulez à une offre
5. Utilisez la fonctionnalité "Améliorer mon CV"
6. Vérifiez le menu "Mon espace"

### Test 4: Navigation Conditionnelle
1. Visitez l'application sans être connecté → Boutons d'inscription visibles
2. Connectez-vous comme candidat → Boutons d'inscription cachés, menu candidat visible
3. Connectez-vous comme admin → Menu administration visible

---

## 🚀 Démarrage Rapide

```powershell
# Redémarrer avec création automatique des utilisateurs
.\restart-with-users.ps1

# Vérifier que l'API fonctionne
.\check-api-status.ps1

# Créer des offres d'emploi (avec compte admin)
# Se connecter sur l'interface web et créer manuellement
```

---

## 🐛 Résolution de Problèmes

### Problème: "Pas d'offres d'emploi visibles"
**Solution:** Se connecter avec le compte admin et créer des offres via l'interface web

### Problème: "Erreur 401 lors de la création d'offres"  
**Solution:** Seuls les comptes Admin/RH peuvent créer des offres

### Problème: "Un candidat voit des boutons admin"
**Solution:** C'est maintenant corrigé - les candidats ne voient que leurs fonctionnalités

### Problème: "Utilisateurs non créés"
**Solution:** Redémarrer l'application avec `.\restart-with-users.ps1`

---

## 📝 Notes Importantes

- Les mots de passe sont encodés avec BCrypt dans la base
- Les utilisateurs sont créés uniquement s'ils n'existent pas déjà
- La création se fait au démarrage de l'application Spring Boot
- Les logs de création sont visibles dans la console Spring Boot
