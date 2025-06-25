FROM openjdk:17-jdk-slim

# Métadonnées
LABEL maintainer="dev@recrutement.com"
LABEL description="Plateforme de Gestion des Recrutements - Backend API"
LABEL version="1.0.0"

# Variables d'environnement
ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_OPTS="-Xmx512m -Xms256m"

# Créer un utilisateur non-root pour la sécurité
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Répertoire de travail
WORKDIR /app

# Copier le fichier JAR
COPY target/recrutement-app-0.0.1-SNAPSHOT.jar app.jar

# Changer le propriétaire du fichier
RUN chown appuser:appuser app.jar

# Basculer vers l'utilisateur non-root
USER appuser

# Exposer le port
EXPOSE 8080

# Point de santé pour Docker
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

# Commande de démarrage
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

