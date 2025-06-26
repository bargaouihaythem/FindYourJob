# JOB4YOU - Guide de Démarrage

## Prérequis
- Java 17 (installé dans `C:\Program Files\Java\jdk-17`)
- Node.js 20+ (installé)
- npm 10+ (installé)

## Problème résolu
✅ **Java 17 configuré** : Le projet nécessite Java 17, pas Java 8
✅ **Backend compilé** : Maven compile maintenant avec Java 17
✅ **Frontend buildé** : Angular 20 installé et compilé
✅ **Base de données** : Configuration H2 en mémoire pour le développement

## Démarrage

### 1. Backend (Spring Boot)
```bash
cd JOB4YOU-backend

# Option 1: Avec le script
start-backend.bat

# Option 2: Manuellement
set JAVA_HOME=C:\Program Files\Java\jdk-17
set PATH=%JAVA_HOME%\bin;%PATH%
set SPRING_PROFILES_ACTIVE=dev
java -jar target/job4you-backend-1.0.0-SNAPSHOT.jar
```

Le backend démarre sur http://localhost:8080

**Points d'accès importants :**
- API Documentation: http://localhost:8080/swagger-ui.html
- Console H2: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:testdb`
  - Username: `sa`
  - Password: (vide)

### 2. Frontend (Angular)

**🎯 SOLUTION RECOMMANDÉE (PowerShell) :**
```bash
cd JOB4YOU-frontend
.\start-frontend.ps1
```

**Alternatives (Scripts Batch) :**
```bash
# Si PowerShell ne fonctionne pas
launch-frontend.bat

# Script batch classique  
start-frontend.bat

# Version simple
minimal-start.bat
```

**Scripts disponibles :**
- **`start-frontend.ps1`** ⭐ **RECOMMANDÉ** - Script PowerShell natif (fonctionne parfaitement)
- `launch-frontend.bat` - Lance le script PowerShell depuis un batch
- `start-frontend.bat` - Version batch corrigée
- `minimal-start.bat` - Version ultra-simple
- `debug-simple.bat` - Diagnostic

**URLs d'accès :**
- Frontend principal: http://localhost:4200
- Si port occupé: http://localhost:4201 (option automatique dans certains scripts)

**✅ TESTÉ ET FONCTIONNEL :**
Le script PowerShell `start-frontend.ps1` a été testé avec succès et lance correctement le serveur Angular ! 🚀

## Configuration

### Profils Spring Boot
- **dev** : Base de données H2 en mémoire (pas d'installation requise)
- **prod** : PostgreSQL (configuration dans application.properties)

### Variables d'environnement importantes
- `JAVA_HOME=C:\Program Files\Java\jdk-17`
- `SPRING_PROFILES_ACTIVE=dev`

## Résolution des problèmes

### Erreur "UnsupportedClassVersionError"
- **Cause** : Java 8 utilisé au lieu de Java 17
- **Solution** : Vérifier JAVA_HOME et PATH

### Erreur de compilation Maven
- **Cause** : Maven utilise Java 8
- **Solution** : Configurer JAVA_HOME avant d'exécuter Maven

### Erreurs npm ERESOLVE
- **Solution** : Utiliser `npm install --legacy-peer-deps`

## Structure du projet
```
FindYourJob/
├── JOB4YOU-backend/          # API Spring Boot
│   ├── start-backend.bat     # Script de démarrage
│   ├── target/              # JAR compilé
│   └── src/                 # Code source Java
├── JOB4YOU-frontend/         # Interface Angular
│   ├── start-frontend.bat   # Script de démarrage
│   ├── dist/                # Build Angular
│   └── src/                 # Code source TypeScript
└── README-DEMARRAGE.md      # Ce fichier
```

## État du build
- ✅ Backend : Compilé avec Java 17, prêt à démarrer
- ✅ Frontend : Compilé avec Angular 20, prêt à démarrer
- ✅ Base de données : H2 en mémoire configurée
- ✅ Scripts de démarrage : Créés pour Windows
