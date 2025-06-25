# FindYourJob - Plateforme de Recrutement

## Description
Application web complète de recrutement développée avec Spring Boot (backend) et Angular (frontend).

## Fonctionnalités
- **Gestion des utilisateurs** avec authentification JWT
- **Gestion des offres d'emploi** (création, modification, suppression)
- **Candidatures** avec upload de CV
- **Système d'entretiens** avec planification
- **Notifications** par email
- **Tableau de bord administrateur**
- **Gestion des rôles** (ADMIN, HR, MANAGER, TEAM, CANDIDATE)

## Technologies utilisées

### Backend
- **Spring Boot 3.2.0**
- **Spring Security** avec JWT
- **Spring Data JPA** avec Hibernate
- **PostgreSQL** comme base de données
- **Maven** pour la gestion des dépendances
- **Java 17+**

### Frontend
- **Angular 20**
- **Angular Material** pour l'UI
- **TypeScript**
- **SCSS** pour les styles
- **NGX-Toastr** pour les notifications

## Prérequis
- Java 17 ou supérieur
- Node.js 18 ou supérieur
- PostgreSQL 12 ou supérieur
- Maven 3.6 ou supérieur

## Installation et Configuration

### 1. Base de données
```sql
-- Créer la base de données
CREATE DATABASE recrutement_db;

-- Créer l'utilisateur (optionnel)
CREATE USER recrutement_user WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE recrutement_db TO recrutement_user;
```

### 2. Configuration Backend
```properties
# application.properties
spring.datasource.url=jdbc:postgresql://localhost:5432/recrutement_db
spring.datasource.username=recrutement_user
spring.datasource.password=votre_mot_de_passe
```

### 3. Démarrage

#### Backend
```bash
cd recrutement-app
mvn clean install
mvn spring-boot:run
```
Le backend sera disponible sur http://localhost:8080

#### Frontend
```bash
cd recrutement-frontend
npm install
npm start
```
Le frontend sera disponible sur http://localhost:4200

## Utilisation

### Comptes par défaut
- **Admin**: `haythemadmin` / `admin123`
- **RH**: `rh_user` / `rh123`
- **Candidat**: `candidat_test` / `candidat123`

### API Endpoints principaux
- `POST /api/auth/login` - Connexion
- `GET /api/job-offers` - Liste des offres
- `POST /api/applications` - Créer une candidature
- `GET /api/interviews` - Gestion des entretiens
- `POST /api/cvs/upload` - Upload de CV

## Structure du projet

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
