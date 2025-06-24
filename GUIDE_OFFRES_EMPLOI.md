# Guide Rapide - Résolution du problème "Pas d'offres d'emploi"

## Problème
Vous êtes connecté en tant qu'utilisateur simple (candidat) mais vous ne voyez pas d'offres d'emploi.

## Solutions rapides

### 1. Vérifier l'état de l'application
```powershell
.\check-api-status.ps1
```
Ce script vérifie :
- Si l'API backend fonctionne
- Combien d'offres existent dans la base
- Si les endpoints sont accessibles

### 2. Créer des offres d'emploi rapidement
```powershell
.\create-job-offers.ps1
```
Ce script crée **8 offres d'emploi variées** :
- Développeur Full Stack Java/Angular
- Développeur Backend Python  
- Développeur Frontend React
- DevOps Engineer
- Analyste Data/BI
- Développeur Mobile Flutter
- Stage Développement Web
- Chef de Projet IT

### 3. Démarrer l'application complète
```powershell
.\start-complete-app.ps1
```
Ce script démarre automatiquement :
- Backend Spring Boot (port 8080)
- Frontend Angular (port 4200)

## Ordre d'exécution recommandé

1. **Démarrer l'application**
   ```powershell
   .\start-complete-app.ps1
   ```

2. **Attendre 30 secondes** que tout soit démarré

3. **Vérifier l'état**
   ```powershell
   .\check-api-status.ps1
   ```

4. **Si pas d'offres, en créer**
   ```powershell
   .\create-job-offers.ps1
   ```

5. **Aller sur l'application web**
   - http://localhost:4200
   - Se connecter avec un compte candidat
   - Aller sur "Offres d'emploi"

## Causes possibles du problème

### ✅ Backend non démarré
- Vérifiez que le Spring Boot tourne sur le port 8080
- Consultez les logs pour les erreurs

### ✅ Base de données vide
- Aucune offre d'emploi créée
- Utilisez le script `create-job-offers.ps1`

### ✅ Problème de permissions
- Vérifiez que les offres sont marquées `isActive = true`
- Vérifiez les rôles utilisateur

### ✅ Problème de filtrage
- Les offres peuvent être filtrées par statut
- Vérifiez les paramètres de recherche

## URLs importantes
- **Application web** : http://localhost:4200
- **API Backend** : http://localhost:8080
- **Offres d'emploi** : http://localhost:4200/job-offers
- **Amélioration CV** : http://localhost:4200/cv-improvement

## Debugging
Si le problème persiste :
1. Ouvrez les outils développeur (F12)
2. Consultez l'onglet "Network" pour voir les requêtes API
3. Vérifiez les logs de la console
4. Consultez les logs du backend Spring Boot
