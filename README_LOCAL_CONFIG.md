# Démarrage local avec les configurations Gmail, n8n et Cohere

Ce fichier décrit la procédure de démarrage local sans publier de secrets. Les identifiants Gmail, la clé Cohere, la clé API n8n, le secret JWT et les mots de passe locaux doivent rester dans un fichier `.env` ignoré par Git ou dans un fichier `application-local.properties` conservé hors du dépôt.

## Après un nouveau clone

```bash
git clone https://github.com/bargaouihaythem/FindYourJob.git
cd FindYourJob
cp .env.example .env
```

Remplacer ensuite uniquement les valeurs vides de `.env` par les configurations locales déjà utilisées pour la démonstration : `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD`, `COHERE_API_KEY`, `N8N_API_KEY`, les trois URLs n8n et un secret `APP_JWT_SECRET` propre à l’environnement. Le fichier `.env` ne doit jamais être ajouté à Git.

## Démarrage backend

```bash
set -a
source .env
set +a
cd JOB4YOU-backend
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
mvn spring-boot:run
```

Le backend utilise alors PostgreSQL, Gmail/SMTP, Cohere et n8n selon les valeurs de `.env`. Les workflows n8n à importer sont ceux du dossier `n8n-workflows/`. La clé `N8N_API_KEY` doit être identique dans n8n et dans le backend.

## Démarrage frontend

Dans un second terminal :

```bash
cd JOB4YOU-frontend
npm install
npm start
```

Le frontend de développement utilise `http://localhost:8080/api`. Le build production utilise la configuration Angular d’environnement et le chemin `/api` same-origin via Nginx.

## Variante avec un fichier de propriétés privé

Si les paramètres existants sont conservés dans un fichier privé `application-local.properties`, ne pas le copier dans Git. Lancer le backend avec :

```bash
mvn spring-boot:run \
  -Dspring-boot.run.arguments="--spring.config.additional-location=file:/chemin/prive/application-local.properties"
```

Pour les réglages Maven privés, utiliser un fichier `settings-local.xml` hors du dépôt :

```bash
mvn -s /chemin/prive/settings-local.xml spring-boot:run
```

## Règle de publication

> Le dépôt public contient uniquement `.env.example` et cette documentation. Les valeurs réelles Gmail, Cohere et n8n restent locales.

Avant toute publication, vérifier `git status --ignored`, `git diff --check` et scanner l’historique Git. Si une clé a déjà été exposée dans un dépôt public, elle doit être révoquée et renouvelée même si elle est ensuite supprimée du dernier commit.
