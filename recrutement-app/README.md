# Plateforme de Gestion des Recrutements - Backend API

Une application backend complète pour la gestion des recrutements, développée avec Spring Boot, JWT, PostgreSQL et Cloudinary.

## 📋 Fonctionnalités

- **Gestion des utilisateurs et authentification**
  - Inscription et connexion sécurisée avec JWT
  - Gestion des rôles (RH, Manager, Admin)
  - Protection des endpoints par rôle

- **Gestion des offres d'emploi**
  - Création, modification, suppression d'offres
  - Recherche et filtrage des offres
  - Gestion du statut des offres (active, inactive, clôturée)

- **Gestion des candidatures**
  - Soumission de candidatures avec CV
  - Stockage des CVs sur Cloudinary
  - Suivi du statut des candidatures

- **Processus de recrutement**
  - Planification des entretiens
  - Gestion des feedbacks
  - Workflow complet (RH -> Équipe -> RH -> Candidat)

- **Notifications par e-mail**
  - Confirmation de candidature
  - Invitation aux entretiens
  - Envoi de feedbacks aux candidats

## 🛠️ Technologies utilisées

- **Spring Boot** - Framework Java pour le développement d'applications
- **Spring Security** - Sécurité et authentification
- **JWT** - Gestion des tokens d'authentification
- **Spring Data JPA** - Accès aux données et ORM
- **PostgreSQL** - Base de données relationnelle
- **Cloudinary** - Stockage des fichiers (CVs)
- **Spring Mail** - Envoi d'e-mails
- **Thymeleaf** - Templates d'e-mails
- **Swagger/OpenAPI** - Documentation de l'API
- **JUnit & Mockito** - Tests unitaires et d'intégration
- **Docker** - Conteneurisation pour le déploiement

## 🚀 Installation et démarrage

### Prérequis

- Java 17 ou supérieur
- Maven 3.8 ou supérieur
- PostgreSQL 13 ou supérieur
- Un compte Cloudinary (pour le stockage des CVs)

### Installation locale

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/votre-organisation/recrutement-app.git
   cd recrutement-app
   ```

2. Configurez la base de données PostgreSQL :
   ```sql
   CREATE DATABASE recrutement_db;
   CREATE USER recrutement_user WITH ENCRYPTED PASSWORD 'recrutement_password';
   GRANT ALL PRIVILEGES ON DATABASE recrutement_db TO recrutement_user;
   ```

3. Configurez l'application dans `src/main/resources/application.properties` :
   ```properties
   # Remplacez par vos propres valeurs
   spring.datasource.url=jdbc:postgresql://localhost:5432/recrutement_db
   spring.datasource.username=recrutement_user
   spring.datasource.password=recrutement_password
   
   # Configuration Cloudinary
   cloudinary.cloud-name=your-cloud-name
   cloudinary.api-key=your-api-key
   cloudinary.api-secret=your-api-secret
   
   # Configuration des e-mails
   spring.mail.host=smtp.gmail.com
   spring.mail.username=your-email@gmail.com
   spring.mail.password=your-app-password
   ```

4. Compilez et exécutez l'application :
   ```bash
   mvn clean install
   mvn spring-boot:run
   ```

5. L'application sera accessible à l'adresse : http://localhost:8080

### Installation avec Docker

1. Construisez et démarrez les conteneurs avec Docker Compose :
   ```bash
   docker-compose up -d
   ```

2. L'application sera accessible à l'adresse : http://localhost:8080

## 📚 Documentation de l'API

La documentation complète de l'API est disponible via Swagger UI :

- URL : http://localhost:8080/swagger-ui.html

## 🧪 Tests

Pour exécuter les tests unitaires et d'intégration :

```bash
mvn test
```

## 📦 Structure du projet

```
recrutement-app/
├── src/
│   ├── main/
│   │   ├── java/com/recrutement/app/
│   │   │   ├── config/          # Configuration Spring et Swagger
│   │   │   ├── controller/      # Contrôleurs REST
│   │   │   ├── dto/             # Objets de transfert de données
│   │   │   ├── entity/          # Entités JPA
│   │   │   ├── exception/       # Gestion des exceptions
│   │   │   ├── repository/      # Repositories JPA
│   │   │   ├── security/        # Configuration de sécurité et JWT
│   │   │   ├── service/         # Services métier
│   │   │   └── RecrutementAppApplication.java
│   │   └── resources/
│   │       ├── application.properties
│   │       └── templates/       # Templates d'e-mails
│   └── test/                    # Tests unitaires et d'intégration
├── pom.xml                      # Configuration Maven
├── Dockerfile                   # Configuration Docker
├── docker-compose.yml           # Configuration Docker Compose
└── DEPLOYMENT_GUIDE.md          # Guide de déploiement
```

## 🔄 Workflow de recrutement

1. **Création d'une offre d'emploi** (RH)
2. **Soumission de candidature** (Candidat)
   - Envoi automatique d'un e-mail de confirmation
3. **Examen des candidatures** (RH)
4. **Planification des entretiens** (RH)
   - Envoi automatique d'une invitation par e-mail
5. **Réalisation des entretiens** (Équipe)
6. **Soumission des feedbacks** (Équipe)
7. **Validation des feedbacks** (RH)
8. **Envoi du feedback final** (RH)
   - Envoi automatique d'un e-mail au candidat

## 🔒 Sécurité

- Authentification basée sur JWT
- Protection CSRF
- Validation des entrées
- Gestion des rôles et permissions
- Stockage sécurisé des mots de passe (BCrypt)

## 📝 Guide de déploiement

Pour des instructions détaillées sur le déploiement en production, consultez le [Guide de Déploiement](DEPLOYMENT_GUIDE.md).

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou à soumettre une pull request.

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

