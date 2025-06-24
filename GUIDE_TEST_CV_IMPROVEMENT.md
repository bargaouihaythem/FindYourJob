# 🚀 GUIDE DE TEST - CV Improvement Debug

## ✅ ÉTAT ACTUEL
Le backend est en cours de démarrage dans le terminal. 

## 📋 ÉTAPES DE TEST

### **1. Vérifier que le backend est démarré** ⏱️
Attendez de voir ce message dans le terminal :
```
Started RecrutementApplication in X.XXX seconds
```

### **2. Vérifier les endpoints disponibles** 🔍
Le backend expose maintenant ces endpoints :
- `GET http://localhost:8080/api/job-offers/public` (offres publiques)
- `POST http://localhost:8080/api/cv-improvements/public/submit` (soumission CV original)
- `POST http://localhost:8080/api/cv-improvements/test/submit` (soumission CV test)

### **3. Tester la soumission CV avec debug** 🧪

**Sur la page CV Improvement :**
1. Remplir le formulaire :
   - **Prénom** : `Test`
   - **Nom** : `Debug`
   - **Email** : `test.debug@gmail.com`
   - **Téléphone** : `0123456789`
   - **Fichier** : Un PDF léger (< 1MB)

2. **Soumettre le formulaire**

3. **Observer les logs dans le terminal backend** :
```
=== DEBUG: TEST submitCVForImprovement ===
candidateDataJson: {"firstName":"Test","lastName":"Debug",...}
cvFile: mon-cv.pdf
cvFile size: 123456
cvFile contentType: application/pdf
=== DEBUG: Validation OK ===
=== DEBUG: Saving candidate ===
=== DEBUG: Candidate saved with ID: 1 ===
=== DEBUG: Saving CV ===
=== DEBUG: CV saved with ID: 1 ===
=== DEBUG: Saving CVImprovement ===
=== DEBUG: CVImprovement saved with ID: 1 ===
=== DEBUG: Success! ===
```

### **4. Analyser les résultats** 📊

#### **✅ Si ça fonctionne :**
- Le message "CV soumis avec succès" apparaît
- Tous les logs de debug sont présents
- ➡️ **Le problème était Cloudinary !**

#### **❌ Si ça échoue encore :**
Les logs montreront exactement où ça plante :

**A. Erreur de validation** :
```
=== DEBUG: Validation OK ===
❌ Ne s'affiche pas
```
➡️ Problème de format des données

**B. Erreur de sauvegarde candidat** :
```
=== DEBUG: Saving candidate ===
❌ Erreur Java/SQL
```
➡️ Problème de base de données

**C. Erreur de sauvegarde CV** :
```
=== DEBUG: Saving CV ===
❌ Erreur Java/SQL
```
➡️ Problème de contraintes FK

**D. Erreur de sauvegarde CVImprovement** :
```
=== DEBUG: Saving CVImprovement ===
❌ Erreur Java/SQL
```
➡️ Problème de relation entre entités

---

## 🔧 ACTIONS SELON LES RÉSULTATS

### **Si le test fonctionne ✅**
1. **Identifier que Cloudinary est le problème**
2. Corriger la configuration Cloudinary :
   - Vérifier les credentials dans `application.properties`
   - Tester la connectivité Cloudinary
   - Ou désactiver temporairement l'upload

### **Si le test échoue ❌**
1. **Copier l'erreur exacte** du terminal backend
2. **Identifier la ligne qui plante** grâce aux logs
3. **Corriger l'entité/repository/contrainte** problématique

---

## 🎯 ENDPOINTS POUR TESTER

### **Test manuel avec curl (optionnel)** :
```bash
# Test de santé
curl http://localhost:8080/api/job-offers/public

# Test soumission CV (remplacer par vraies données)
curl -X POST \
  http://localhost:8080/api/cv-improvements/test/submit \
  -F "candidateData={\"firstName\":\"Test\",\"lastName\":\"User\",\"email\":\"test@example.com\",\"phone\":\"0123456789\"}" \
  -F "cv=@mon-cv.pdf"
```

---

## 📝 PROCHAINES ÉTAPES

1. **Attendre** que le backend finisse de démarrer
2. **Rafraîchir** la page Angular (F5)
3. **Tester** la soumission CV
4. **Observer** les logs backend
5. **Diagnostiquer** selon les résultats
6. **Corriger** le problème identifié

## 🎉 OBJECTIF

**Avoir une soumission CV 100% fonctionnelle** avec diagnostic complet des points de défaillance !

Le système de debug va nous dire **exactement** où et pourquoi ça plante. 🔍🚀
