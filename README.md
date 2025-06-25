# Plateforme de Recrutement FindYourJob

Ce repository contient les deux applications de la plateforme FindYourJob :

## 🚀 Applications

### 📁 Backend (`recrutement-app/`)
- **Technologie** : Spring Boot 3.2.0
- **Base de données** : PostgreSQL
- **Authentification** : JWT
- **API REST** : Documentation Swagger disponible
- **Port** : 8080

### 📁 Frontend (`recrutement-frontend/`)
- **Technologie** : Angular 20
- **UI** : Angular Material
- **Authentification** : JWT avec intercepteurs
- **Port** : 4200

## 🛠 Installation Rapide

### 1. Base de données
```sql
CREATE DATABASE recrutement_db;
```

### 2. Backend
```bash
cd recrutement-app
mvn clean install
mvn spring-boot:run
```

### 3. Frontend
```bash
cd recrutement-frontend
npm install --legacy-peer-deps
npm start
```

## 🔑 Comptes de Test

- **Admin** : `haythemadmin` / `admin123`
- **RH** : `rh_user` / `rh123`
- **Candidat** : `candidat_test` / `candidat123`

## 📋 Fonctionnalités

✅ Gestion des utilisateurs et rôles  
✅ Offres d'emploi avec filtres  
✅ Candidatures avec upload CV  
✅ Système d'entretiens  
✅ Notifications email  
✅ Tableau de bord administrateur  
✅ Gestion des feedbacks  

## 🌐 Accès

- **Frontend** : http://localhost:4200
- **Backend API** : http://localhost:8080
- **Swagger** : http://localhost:8080/swagger-ui.html

## 📁 Structure du projet

```
FindYourJob/
├── recrutement-app/          # Backend Spring Boot
│   ├── src/main/java/
│   │   └── com/recrutement/app/
│   │       ├── controller/   # Contrôleurs REST
│   │       ├── service/      # Services métier
│   │       ├── repository/   # Repositories JPA
│   │       ├── entity/       # Entités JPA
│   │       ├── dto/          # DTOs
│   │       ├── config/       # Configuration
│   │       └── security/     # Sécurité JWT
│   └── src/main/resources/
│       ├── application.properties
│       └── templates/        # Templates email
├── recrutement-frontend/     # Frontend Angular
│   ├── src/app/
│   │   ├── components/       # Composants réutilisables
│   │   ├── pages/           # Pages de l'application
│   │   ├── services/        # Services Angular
│   │   ├── guards/          # Guards de route
│   │   └── models/          # Interfaces TypeScript
│   └── src/assets/          # Assets statiques
└── README.md
```

## Licence
Ce projet est sous licence MIT.

## Contributeurs
- Haythem Bargaoui

## Support
Pour toute question ou problème, veuillez ouvrir une issue sur GitHub.
