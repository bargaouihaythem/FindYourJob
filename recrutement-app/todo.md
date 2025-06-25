# Liste des tâches pour le développement du backend de la plateforme de recrutement

## Phase 1: Conception et initialisation du projet Spring Boot Maven
- [x] Créer la structure du projet Spring Boot
- [x] Configurer le fichier pom.xml avec les dépendances nécessaires
- [x] Configurer l'application.properties
- [x] Tester le démarrage de l'application

## Phase 2: Configuration de la base de données PostgreSQL et définition des entités
- [x] Configurer la connexion à PostgreSQL
- [x] Créer les entités (User, Role, JobOffer, Candidate, CV, Interview, Feedback)
- [x] Configurer les relations entre les entités
- [x] Créer les repositories JPA

## Phase 3: Mise en place de la sécurité avec JWT
- [x] Configurer Spring Security
- [x] Implémenter l'authentification JWT
- [x] Définir les rôles et permissions (RH, Manager)
- [x] Créer les endpoints d'authentification (login, register)

## Phase 4: Développement des API pour les offres d'emploi
- [x] Créer le service pour les offres d'emploi
- [x] Développer les endpoints CRUD pour les offres
- [x] Implémenter la recherche et le filtrage des offres
- [x] Tester les API des offres d'emploi

## Phase 5: Développement des API pour les candidats et gestion des CVs avec Cloudinary
- [x] Configurer l'intégration avec Cloudinary
- [x] Créer le service pour les candidats
- [x] Développer les endpoints pour la soumission de CV
- [x] Implémenter le stockage et la récupération des CVs

## Phase 6: Développement des API pour le suivi du recrutement
- [x] Créer les services pour les entretiens et évaluations
- [x] Développer les endpoints pour le processus de recrutement
- [x] Implémenter le workflow de feedback (RH -> Équipe -> RH -> Candidat)
- [x] Tester le flux complet du processus

## Phase 7: Intégration de l'envoi d'e-mails
- [x] Configurer le service d'envoi d'e-mails
- [x] Créer les templates d'e-mails
- [x] Implémenter l'envoi automatique de notifications
- [x] Tester l'envoi d'e-mails

## Phase 8: Tests unitaires et d'intégration
- [x] Écrire des tests unitaires pour les services
- [x] Écrire des tests d'intégration pour les API
- [x] Configurer l'environnement de test
- [x] Tester les fonctionnalités principales

## Phase 9: Finalisation et livraison du code backend
- [x] Documenter les API (Swagger)
- [x] Optimiser les performances
- [x] Préparer le code pour la livraison
- [x] Créer un guide de déploiement

