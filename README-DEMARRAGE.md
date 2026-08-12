# JOB4YOU — Guide de démarrage local

## Prérequis

Le projet utilise **Java 17**, Maven 3.8 ou supérieur, Node.js 18 ou supérieur, npm et PostgreSQL. n8n est optionnel : il est nécessaire uniquement pour activer les workflows de notifications et de callbacks.

## Préparation de la configuration

Copier `.env.example` vers un fichier local non suivi par Git ou définir les variables dans l’environnement du système. Ne jamais publier les valeurs réelles de `APP_JWT_SECRET`, `SPRING_DATASOURCE_PASSWORD`, `COHERE_API_KEY`, `N8N_API_KEY` ou `SPRING_MAIL_PASSWORD`.

Créer la base PostgreSQL :

```bash
createdb job4you_db
```

Puis définir au minimum :

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/job4you_db
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<mot-de-passe-local>
APP_JWT_SECRET=<secret-long-et-aléatoire>
```

Pour activer les emails, ajouter `APP_EMAIL_ENABLED=true`, `SPRING_MAIL_USERNAME` et `SPRING_MAIL_PASSWORD`. Pour activer Cohere, définir `COHERE_API_KEY`. Pour activer n8n, définir les trois URLs `N8N_WEBHOOK_AGENT1`, `N8N_WEBHOOK_AGENT2` et `N8N_WEBHOOK_AGENT3`.

## Démarrer le backend

```bash
cd JOB4YOU-backend
mvn clean install -DskipTests
mvn spring-boot:run
```

Le backend est disponible par défaut sur `http://localhost:8080`. La documentation Swagger est disponible sur `http://localhost:8080/swagger-ui.html`.

Le profil de test utilise H2 en mémoire et se trouve dans `src/test/resources/application-test.properties`. H2 est destiné aux tests automatisés ; le démarrage local normal utilise PostgreSQL.

## Démarrer le frontend

```bash
cd JOB4YOU-frontend
npm install --legacy-peer-deps
npm start
```

Le frontend est disponible sur `http://localhost:4200`.

Sous Windows, les scripts de démarrage présents dans le dossier frontend peuvent être utilisés après vérification de leurs variables locales. Ils ne doivent pas contenir de secrets ou de mots de passe.

## Démarrer n8n, optionnel

```bash
npx n8n start
```

Importer ensuite les fichiers suivants :

```text
n8n-workflows/agent1-cv-parser.json
n8n-workflows/agent2-entretien.json
n8n-workflows/agent3-rh-manager.json
```

Les workflows actuels orchestrent les notifications. Le backend conserve la responsabilité du scoring Cohere, de l’extraction du CV, de la persistance et des transitions métier. L’intégration authentifiée Google Calendar/Google Meet n’est pas encore disponible.

## Initialisation de comptes de développement

L’initialisation automatique est désactivée par défaut. Pour l’activer temporairement, définir `APP_INIT_CREATE_DEFAULT_USERS=true` et fournir des variables `APP_DEFAULT_*` complètes. Les mots de passe ne doivent jamais être écrits dans le code ou dans le dépôt.

## Vérifications utiles

| Élément | Adresse ou commande |
|---|---|
| Frontend | `http://localhost:4200` |
| Backend | `http://localhost:8080` |
| Swagger | `http://localhost:8080/swagger-ui.html` |
| n8n | `http://localhost:5678` |
| Tests backend | `mvn test` |
| Tests frontend | `npm test` |

## Résolution des problèmes

Si Maven utilise une version Java incorrecte, vérifier `java -version` et `mvn -version`, puis configurer `JAVA_HOME` vers un JDK 17. En cas d’erreur npm `ERESOLVE`, utiliser `npm install --legacy-peer-deps`.

Si PostgreSQL refuse la connexion, vérifier l’URL, l’utilisateur, le mot de passe, le port 5432 et l’existence de la base `job4you_db`. Si Cohere est indisponible, le backend peut utiliser son mode dégradé ; cette situation doit néanmoins être signalée avant une évaluation de production.

## Statut

Ce guide décrit un démarrage de développement ou de démonstration. Avant une mise en production, il faut encore mettre en place les migrations versionnées, le HTTPS, la gestion sécurisée des secrets, la protection fine des CV, la signature des webhooks, la configuration CORS restrictive et les tests d’intégration.
