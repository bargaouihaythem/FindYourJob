# Guide : Fonctionnalité "Se souvenir de moi"

## 🔐 Fonctionnement

### Ce qui est mémorisé
- ✅ **Nom d'utilisateur** : Sauvegardé dans le localStorage
- ✅ **État de la checkbox** : Reste cochée lors du retour
- ❌ **Mot de passe** : Jamais sauvegardé (sécurité)

### Comportement
1. **Première connexion avec "Se souvenir de moi" coché** :
   - Le nom d'utilisateur est sauvegardé
   - Le token est stocké dans localStorage (persistant)

2. **Retour sur la page login** :
   - Le champ username est pré-rempli
   - La checkbox "Se souvenir de moi" est cochée
   - Le focus va automatiquement sur le champ mot de passe
   - Une bordure verte indique que le champ est pré-rempli

3. **Sans "Se souvenir de moi"** :
   - Le token est stocké dans sessionStorage (session courante)
   - Aucune donnée n'est mémorisée

## 🎯 UX Améliorée

### Indicateurs visuels
- **Bordure verte** sur le champ username pré-rempli
- **Focus automatique** sur le mot de passe
- **Bouton "Effacer le souvenir"** si des données sont mémorisées

### Actions disponibles
- **Icône info** (ℹ️) : Explique pourquoi le mot de passe n'est pas mémorisé
- **Bouton effacer** (❌) : Supprime les données mémorisées

## 🔒 Sécurité

### Pourquoi le mot de passe n'est pas mémorisé ?
1. **Sécurité** : Évite l'exposition en cas de compromission
2. **Standards** : Respect des bonnes pratiques web
3. **Navigateur** : Le gestionnaire du navigateur gère déjà cela de façon sécurisée

### Bonnes pratiques appliquées
- Utilisation des attributs `autocomplete` appropriés
- Stockage différencié (localStorage vs sessionStorage)
- Pas de stockage des mots de passe en clair
- Nettoyage approprié lors de la déconnexion

## 💡 Pour l'utilisateur

### Message explicatif
"Pour votre sécurité, seul le nom d'utilisateur est mémorisé. Le navigateur peut proposer de sauvegarder votre mot de passe de façon sécurisée."

### Avantages
- **Gain de temps** : Pas besoin de retaper le username
- **Sécurité maintenue** : Le mot de passe reste protégé
- **Contrôle utilisateur** : Possibilité d'effacer les données
- **UX moderne** : Indicateurs visuels clairs

## 🔧 Techniques

### Storage utilisé
- **localStorage** : Token et username si "Se souvenir de moi"
- **sessionStorage** : Token uniquement si pas de "Se souvenir de moi"

### Méthodes du service
```typescript
saveToken(token, rememberMe)           // Stockage approprié
saveLoginCredentials(username, rememberMe)  // Sauvegarde username
getRememberedUsername()                // Récupération username
isRememberMeEnabled()                  // État du "Se souvenir"
clearRememberedCredentials()           // Nettoyage données
```

### Cycle de vie
1. **Login** → Sauvegarde selon choix utilisateur
2. **Retour** → Pré-remplissage si activé
3. **Logout** → Nettoyage token, conservation username
4. **Effacement** → Suppression complète des données

Cette implémentation respecte les standards de sécurité tout en offrant une expérience utilisateur optimale.
