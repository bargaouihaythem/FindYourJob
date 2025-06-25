# Guide de Déploiement - Plateforme de Gestion des Recrutements

Ce document fournit les instructions détaillées pour déployer l'application backend de la plateforme de gestion des recrutements.

## Prérequis

Avant de commencer le déploiement, assurez-vous d'avoir installé les éléments suivants :

- Java 17 ou supérieur
- Maven 3.8 ou supérieur
- PostgreSQL 13 ou supérieur
- Un compte Cloudinary (pour le stockage des CVs)
- Un serveur SMTP pour l'envoi d'e-mails

## Étape 1 : Préparation de la Base de Données

1. Créez une base de données PostgreSQL :

```sql
CREATE DATABASE recrutement_db;
CREATE USER recrutement_user WITH ENCRYPTED PASSWORD 'recrutement_password';
GRANT ALL PRIVILEGES ON DATABASE recrutement_db TO recrutement_user;
```

2. Notez les informations de connexion (hôte, port, nom de la base de données, utilisateur, mot de passe) pour la configuration de l'application.

## Étape 2 : Configuration de l'Application

1. Clonez le dépôt Git :

```bash
git clone https://github.com/votre-organisation/recrutement-app.git
cd recrutement-app
```

2. Configurez les propriétés de l'application dans `src/main/resources/application.properties` :

```properties
# Configuration de la base de données PostgreSQL
spring.datasource.url=jdbc:postgresql://localhost:5432/recrutement_db
spring.datasource.username=recrutement_user
spring.datasource.password=recrutement_password
spring.datasource.driver-class-name=org.postgresql.Driver

# Configuration JPA/Hibernate
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect

# Configuration JWT
app.jwtSecret=votre_cle_secrete_jwt
app.jwtExpirationMs=86400000

# Configuration Cloudinary
cloudinary.cloud-name=votre-cloud-name
cloudinary.api-key=votre-api-key
cloudinary.api-secret=votre-api-secret

# Configuration des e-mails
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=votre-email@gmail.com
spring.mail.password=votre-app-password
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
spring.mail.properties.mail.smtp.starttls.required=true

# Configuration de l'application
app.email.enabled=true

# Configuration du serveur
server.port=8080
```

3. Remplacez les valeurs par défaut par vos propres configurations.

## Étape 3 : Compilation et Packaging

1. Compilez et packagez l'application avec Maven :

```bash
mvn clean package -DskipTests
```

2. Le fichier JAR exécutable sera généré dans le répertoire `target/`.

## Étape 4 : Déploiement

### Option 1 : Déploiement Local

1. Exécutez l'application avec Java :

```bash
java -jar target/recrutement-app-0.0.1-SNAPSHOT.jar
```

2. L'application sera accessible à l'adresse : http://localhost:8080

### Option 2 : Déploiement sur un Serveur

1. Transférez le fichier JAR sur votre serveur :

```bash
scp target/recrutement-app-0.0.1-SNAPSHOT.jar utilisateur@serveur:/chemin/vers/application/
```

2. Connectez-vous au serveur et créez un fichier de service systemd pour gérer l'application :

```bash
sudo nano /etc/systemd/system/recrutement-app.service
```

3. Ajoutez la configuration suivante :

```
[Unit]
Description=Plateforme de Gestion des Recrutements
After=network.target

[Service]
User=votre-utilisateur
WorkingDirectory=/chemin/vers/application
ExecStart=/usr/bin/java -jar recrutement-app-0.0.1-SNAPSHOT.jar
SuccessExitStatus=143
TimeoutStopSec=10
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

4. Activez et démarrez le service :

```bash
sudo systemctl enable recrutement-app.service
sudo systemctl start recrutement-app.service
```

5. Vérifiez l'état du service :

```bash
sudo systemctl status recrutement-app.service
```

### Option 3 : Déploiement avec Docker

1. Créez un fichier `Dockerfile` à la racine du projet :

```Dockerfile
FROM openjdk:17-jdk-slim

WORKDIR /app

COPY target/recrutement-app-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

2. Construisez l'image Docker :

```bash
docker build -t recrutement-app:latest .
```

3. Exécutez le conteneur Docker :

```bash
docker run -d -p 8080:8080 --name recrutement-app \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/recrutement_db \
  -e SPRING_DATASOURCE_USERNAME=recrutement_user \
  -e SPRING_DATASOURCE_PASSWORD=recrutement_password \
  -e APP_JWTSECRET=votre_cle_secrete_jwt \
  -e CLOUDINARY_CLOUD_NAME=votre-cloud-name \
  -e CLOUDINARY_API_KEY=votre-api-key \
  -e CLOUDINARY_API_SECRET=votre-api-secret \
  -e SPRING_MAIL_HOST=smtp.gmail.com \
  -e SPRING_MAIL_USERNAME=votre-email@gmail.com \
  -e SPRING_MAIL_PASSWORD=votre-app-password \
  recrutement-app:latest
```

## Étape 5 : Vérification du Déploiement

1. Accédez à la documentation Swagger de l'API : http://votre-serveur:8080/swagger-ui.html

2. Testez l'API d'authentification pour vérifier que tout fonctionne correctement.

## Étape 6 : Initialisation des Données

1. Créez un utilisateur administrateur en utilisant l'API d'inscription :

```
POST /api/auth/signup
{
  "username": "admin",
  "email": "admin@recrutement.com",
  "password": "mot_de_passe_securise",
  "role": ["admin"]
}
```

2. Connectez-vous avec cet utilisateur pour obtenir un token JWT :

```
POST /api/auth/signin
{
  "username": "admin",
  "password": "mot_de_passe_securise"
}
```

## Maintenance et Surveillance

- **Logs** : Les logs de l'application sont disponibles dans le répertoire `/chemin/vers/application/logs/` ou via la commande `journalctl -u recrutement-app.service` si vous utilisez systemd.

- **Sauvegarde** : Configurez des sauvegardes régulières de la base de données PostgreSQL :

```bash
pg_dump -U recrutement_user -d recrutement_db > backup_$(date +%Y%m%d).sql
```

- **Mise à jour** : Pour mettre à jour l'application, remplacez le fichier JAR et redémarrez le service :

```bash
sudo systemctl restart recrutement-app.service
```

## Résolution des Problèmes

- **Problème de connexion à la base de données** : Vérifiez les informations de connexion et assurez-vous que PostgreSQL est en cours d'exécution.

- **Problème d'envoi d'e-mails** : Vérifiez les informations SMTP et assurez-vous que le serveur de messagerie est accessible.

- **Problème de stockage des CVs** : Vérifiez les informations d'identification Cloudinary et assurez-vous que votre compte est actif.

- **Problème d'authentification JWT** : Vérifiez la clé secrète JWT et assurez-vous qu'elle est suffisamment complexe.

## Support

Pour toute question ou problème, contactez l'équipe de développement à l'adresse dev@recrutement.com.

