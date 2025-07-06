package com.recrutement.app.service;

import com.recrutement.app.dto.JobOfferRequest;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.JobOfferRepository;
import com.recrutement.app.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class JobOfferInitializationService implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(JobOfferInitializationService.class);

    @Autowired
    private JobOfferRepository jobOfferRepository;

    @Autowired
    private JobOfferService jobOfferService;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.init.create-job-offers:true}")
    private boolean createJobOffersEnabled;

    @Value("${app.init.force-create-job-offers:false}")
    private boolean forceCreateJobOffers;

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        logger.info("🚀 Vérification de l'initialisation des offres d'emploi...");

        // Vérifier si la création d'offres est activée
        if (!createJobOffersEnabled) {
            logger.info("⚠️ Création automatique des offres d'emploi désactivée (app.init.create-job-offers=false)");
            return;
        }

        // Vérifier si des offres existent déjà
        long existingJobOffers = jobOfferRepository.count();
        if (existingJobOffers > 0 && !forceCreateJobOffers) {
            logger.info("✅ {} offres d'emploi déjà présentes, initialisation ignorée.", existingJobOffers);
            logger.info("💡 Pour forcer la création de nouvelles offres, définissez app.init.force-create-job-offers=true");
            return;
        }

        if (existingJobOffers > 0 && forceCreateJobOffers) {
            logger.info("🔄 {} offres existantes trouvées, mais création forcée activée. Ajout de nouvelles offres...", existingJobOffers);
        }

        // Vérifier qu'un utilisateur HR existe
        Optional<User> hrUser = userRepository.findByUsername("hrUser");
        if (hrUser.isEmpty()) {
            // Fallback: chercher n'importe quel utilisateur pour créer les offres
            logger.warn("⚠️ Aucun utilisateur 'hrUser' trouvé, recherche d'un autre utilisateur...");
            List<User> allUsers = userRepository.findAll();
            if (!allUsers.isEmpty()) {
                hrUser = Optional.of(allUsers.get(0));
                logger.info("📋 Utilisation de l'utilisateur '{}' pour créer les offres", hrUser.get().getUsername());
            } else {
                logger.warn("⚠️ Aucun utilisateur trouvé, création des offres d'emploi ignorée.");
                logger.info("💡 Conseil: Créez d'abord un utilisateur pour activer l'initialisation automatique.");
                return;
            }
        }

        logger.info("📝 Création des offres d'emploi par défaut...");
        createDefaultJobOffers(hrUser.get().getUsername());
        logger.info("✅ Offres d'emploi créées avec succès!");
    }

    private void createDefaultJobOffers(String hrUsername) {
        // Offre 1 - Développeur Frontend
        createJobOffer(
            "Développeur Frontend React/Angular",
            "Nous recherchons un développeur frontend passionné pour rejoindre notre équipe dynamique.\n\n" +
            "Missions principales :\n" +
            "• Développer des interfaces utilisateur modernes et responsives\n" +
            "• Collaborer avec l'équipe UX/UI pour implémenter des designs innovants\n" +
            "• Optimiser les performances des applications web\n" +
            "• Maintenir et améliorer le code existant\n" +
            "• Participer aux code reviews et aux méthodologies Agile\n\n" +
            "Environnement technique :\n" +
            "• React 18+ ou Angular 15+\n" +
            "• TypeScript, HTML5, CSS3, SCSS\n" +
            "• State management (Redux, NgRx)\n" +
            "• Tests unitaires (Jest, Cypress)\n" +
            "• Git, CI/CD\n\n" +
            "Avantages :\n" +
            "• Télétravail partiel (2-3 jours/semaine)\n" +
            "• Formation continue et certifications\n" +
            "• Tickets restaurant et mutuelle d'entreprise\n" +
            "• Équipe jeune et bienveillante",
            "React, Angular, TypeScript, JavaScript, HTML5, CSS3, SCSS, Redux, NgRx, Jest, Cypress, Git",
            "3-5 ans",
            "CDI",
            "Paris (75) - Hybride",
            "45 000 - 55 000 €",
            hrUsername
        );

        // Offre 2 - Développeur Backend (CDD)
        createJobOffer(
            "Développeur Backend Java/Spring - Mission 12 mois",
            "Rejoignez notre équipe backend pour développer des APIs robustes et scalables dans le cadre d'un projet innovant.\n\n" +
            "Responsabilités :\n" +
            "• Concevoir et développer des microservices avec Spring Boot\n" +
            "• Implémenter des APIs RESTful performantes\n" +
            "• Gérer les bases de données (PostgreSQL, MongoDB)\n" +
            "• Assurer la sécurité et l'authentification (JWT, OAuth)\n" +
            "• Optimiser les performances et la scalabilité\n" +
            "• Documenter les APIs avec Swagger/OpenAPI\n\n" +
            "Stack technique :\n" +
            "• Java 17+, Spring Boot, Spring Security\n" +
            "• PostgreSQL, MongoDB, Redis\n" +
            "• Docker, Kubernetes\n" +
            "• Maven/Gradle, Jenkins\n" +
            "• AWS/GCP\n\n" +
            "Mission de 12 mois avec possibilité de prolongation :\n" +
            "• Projets techniques challengeants\n" +
            "• Encadrement par des seniors expérimentés\n" +
            "• Budget formation de 2000€/an\n" +
            "• Matériel de qualité (MacBook Pro)",
            "Java, Spring Boot, Spring Security, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, Maven, AWS, GCP",
            "2-4 ans",
            "CDD",
            "Paris (75) - Hybride",
            "45 000 - 55 000 €",
            hrUsername
        );

        // Offre 2 - Développeur Backend
        createJobOffer(
            "Développeur Backend Java/Spring",
            "Rejoignez notre équipe backend pour développer des APIs robustes et scalables.\n\n" +
            "Responsabilités :\n" +
            "• Concevoir et développer des microservices avec Spring Boot\n" +
            "• Implémenter des APIs RESTful performantes\n" +
            "• Gérer les bases de données (PostgreSQL, MongoDB)\n" +
            "• Assurer la sécurité et l'authentification (JWT, OAuth)\n" +
            "• Optimiser les performances et la scalabilité\n" +
            "• Documenter les APIs avec Swagger/OpenAPI\n\n" +
            "Stack technique :\n" +
            "• Java 17+, Spring Boot, Spring Security\n" +
            "• PostgreSQL, MongoDB, Redis\n" +
            "• Docker, Kubernetes\n" +
            "• Maven/Gradle, Jenkins\n" +
            "• AWS/GCP\n\n" +
            "Ce que nous offrons :\n" +
            "• Projets techniques challengeants\n" +
            "• Encadrement par des seniors expérimentés\n" +
            "• Budget formation de 2000€/an\n" +
            "• Matériel de qualité (MacBook Pro)",
            "Java, Spring Boot, Spring Security, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, Maven, AWS, GCP",
            "2-4 ans",
            "CDI",
            "Lyon (69) - Sur site",
            "42 000 - 52 000 €",
            hrUsername
        );

        // Offre 3 - Stage Développeur Mobile
        createJobOffer(
            "Stage Développeur Mobile Flutter - 6 mois",
            "Rejoignez notre équipe mobile pour un stage enrichissant dans le développement d'applications cross-platform.\n\n" +
            "Missions du stage :\n" +
            "• Participer au développement d'applications mobiles avec Flutter\n" +
            "• Apprendre l'intégration d'APIs REST et GraphQL\n" +
            "• Découvrir les fonctionnalités natives (géolocalisation, camera, etc.)\n" +
            "• Contribuer à l'optimisation des performances mobile\n" +
            "• Participer aux tests et débogage\n" +
            "• Collaborer avec les équipes design et backend\n\n" +
            "Compétences recherchées :\n" +
            "• Formation en informatique (Bac+3/4/5)\n" +
            "• Bases en programmation orientée objet\n" +
            "• Intérêt pour le développement mobile\n" +
            "• Première expérience avec Flutter/Dart (projet personnel ou scolaire)\n" +
            "• Motivation et curiosité technique\n\n" +
            "Ce que nous offrons :\n" +
            "• Gratification stage + tickets restaurant\n" +
            "• Encadrement par des développeurs seniors\n" +
            "• Formation aux technologies mobiles\n" +
            "• Ambiance startup dynamique\n" +
            "• Possibilité d'embauche en fin de stage",
            "Flutter, Dart, Mobile, REST API, Git, Bases de données",
            "Étudiant",
            "INTERNSHIP",
            "Toulouse (31) - Hybride",
            "800 - 1200 €",
            hrUsername
        );

        // Offre 4 - Freelance DevOps
        createJobOffer(
            "DevOps Engineer - Mission Freelance",
            "Mission freelance pour accompagner notre transformation cloud et optimiser notre infrastructure.\n\n" +
            "Missions de la mission :\n" +
            "• Automatiser les déploiements avec des pipelines CI/CD\n" +
            "• Migrer et optimiser l'infrastructure cloud (AWS/Azure)\n" +
            "• Implémenter la containerisation avec Docker/Kubernetes\n" +
            "• Mettre en place le monitoring des applications\n" +
            "• Assurer la sécurité et la conformité\n" +
            "• Former les équipes aux bonnes pratiques DevOps\n\n" +
            "Expertise requise :\n" +
            "• 5+ ans d'expérience en DevOps/SRE\n" +
            "• Maîtrise des cloud providers (AWS, Azure, GCP)\n" +
            "• Expertise Containers (Docker, Kubernetes, OpenShift)\n" +
            "• CI/CD (Jenkins, GitLab CI, GitHub Actions)\n" +
            "• Infrastructure as Code (Terraform, Ansible)\n" +
            "• Monitoring (Prometheus, Grafana, ELK)\n" +
            "• Scripting (Bash, Python, PowerShell)\n\n" +
            "Conditions freelance :\n" +
            "• Mission 6-12 mois renouvelable\n" +
            "• Télétravail possible à 80%\n" +
            "• Tarif compétitif selon profil\n" +
            "• Démarrage immédiat possible",
            "AWS, Azure, Docker, Kubernetes, Jenkins, Terraform, Ansible, Prometheus, Grafana, Python, Bash",
            "5+ ans",
            "FREELANCE",
            "Marseille (13) - Hybride",
            "600 - 800 €/jour",
            hrUsername
        );

        // Offre 5 - Data Scientist (Temps partiel)
        createJobOffer(
            "Data Scientist - Temps Partiel 3 jours/semaine",
            "Poste idéal pour un équilibre vie pro/vie perso - Transformez les données en insights business avec l'IA et le Machine Learning.\n\n" +
            "Vos missions (3 jours/semaine) :\n" +
            "• Analyser de gros volumes de données (Big Data)\n" +
            "• Développer des modèles de Machine Learning\n" +
            "• Créer des dashboards et visualisations\n" +
            "• Collaborer avec les équipes métier\n" +
            "• Optimiser les algorithmes pour la production\n" +
            "• Assurer la qualité et la gouvernance des données\n\n" +
            "Compétences clés :\n" +
            "• Python (Pandas, NumPy, Scikit-learn, TensorFlow)\n" +
            "• SQL avancé, NoSQL (MongoDB, Cassandra)\n" +
            "• Outils de visualisation (Tableau, Power BI, Plotly)\n" +
            "• Statistiques et mathématiques appliquées\n" +
            "• Cloud ML (AWS SageMaker, Azure ML)\n" +
            "• Spark, Hadoop pour le Big Data\n\n" +
            "Avantages temps partiel :\n" +
            "• Excellent équilibre vie pro/perso\n" +
            "• Projets d'innovation avec impact business\n" +
            "• Accès aux dernières technologies IA\n" +
            "• Formation continue (Coursera, Udacity)\n" +
            "• Équipe data science bienveillante",
            "Python, Pandas, NumPy, Scikit-learn, TensorFlow, SQL, MongoDB, Tableau, Power BI, AWS SageMaker, Spark",
            "3-5 ans",
            "PART_TIME",
            "Nantes (44) - Hybride",
            "48 000 - 60 000 €",
            hrUsername
        );

        // Offre 6 - Chef de Projet
        createJobOffer(
            "Chef de Projet Digital",
            "Pilotez des projets digitaux innovants dans un environnement Agile.\n\n" +
            "Responsabilités :\n" +
            "• Gérer des projets web et mobile de A à Z\n" +
            "• Coordonner les équipes techniques et fonctionnelles\n" +
            "• Assurer le respect des délais, budgets et qualité\n" +
            "• Animer les cérémonies Agile (Sprint, Daily, Retro)\n" +
            "• Communiquer avec les clients et stakeholders\n" +
            "• Gérer les risques et les changements\n\n" +
            "Profil recherché :\n" +
            "• Formation en management de projet ou école d'ingénieur\n" +
            "• Certification PMP, Prince2 ou PSM (apprécié)\n" +
            "• Expérience en méthodologies Agile/Scrum\n" +
            "• Maîtrise des outils de gestion de projet (Jira, Trello)\n" +
            "• Excellentes capacités de communication\n" +
            "• Anglais courant\n\n" +
            "Package attractif :\n" +
            "• Salaire fixe + variable sur objectifs\n" +
            "• Voiture de fonction ou budget mobilité\n" +
            "• Formation en management et leadership\n" +
            "• Évolution vers des postes de direction",
            "Gestion de projet, Agile, Scrum, Jira, Trello, PMP, Prince2, Leadership, Communication",
            "4-7 ans",
            "CDI",
            "Bordeaux (33) - Hybride",
            "45 000 - 58 000 €",
            hrUsername
        );

        // Offre 7 - UI/UX Designer
        createJobOffer(
            "UI/UX Designer",
            "Créez des expériences utilisateur exceptionnelles pour nos produits digitaux.\n\n" +
            "Missions créatives :\n" +
            "• Concevoir des interfaces utilisateur intuitives\n" +
            "• Réaliser des wireframes et prototypes interactifs\n" +
            "• Conduire des tests utilisateurs et recherches UX\n" +
            "• Créer et maintenir le design system\n" +
            "• Collaborer étroitement avec les développeurs\n" +
            "• Veiller à l'accessibilité et l'inclusive design\n\n" +
            "Outils maîtrisés :\n" +
            "• Figma, Sketch, Adobe Creative Suite\n" +
            "• Prototyping (InVision, Principle, Framer)\n" +
            "• User testing (Hotjar, Maze, UsabilityHub)\n" +
            "• Design systems et atomic design\n" +
            "• HTML/CSS pour la communication avec les devs\n\n" +
            "Environnement stimulant :\n" +
            "• Studio design de 6 personnes\n" +
            "• Matériel haut de gamme (iMac, Wacom)\n" +
            "• Budget conférences et formations design\n" +
            "• Liberté créative et projets variés\n" +
            "• Participation à la stratégie produit",
            "Figma, Sketch, Adobe Creative Suite, UX Research, Prototyping, Design System, HTML, CSS",
            "2-4 ans",
            "CDI",
            "Lille (59) - Hybride",
            "35 000 - 45 000 €",
            hrUsername
        );

        // Offre 8 - Tech Lead
        createJobOffer(
            "Tech Lead Full Stack",
            "Dirigez une équipe de développeurs dans la création de solutions innovantes.\n\n" +
            "Responsabilités leadership :\n" +
            "• Encadrer une équipe de 4-6 développeurs\n" +
            "• Définir l'architecture technique des projets\n" +
            "• Faire des choix technologiques stratégiques\n" +
            "• Assurer la qualité du code et les bonnes pratiques\n" +
            "• Participer au recrutement technique\n" +
            "• Planifier et estimer les développements\n\n" +
            "Stack technique maîtrisée :\n" +
            "• Frontend : React, Vue.js, Angular\n" +
            "• Backend : Node.js, Python, Java\n" +
            "• Databases : PostgreSQL, MongoDB, Redis\n" +
            "• Cloud : AWS, Azure, GCP\n" +
            "• DevOps : Docker, Kubernetes, CI/CD\n\n" +
            "Qualités requises :\n" +
            "• Leadership technique et humain\n" +
            "• Capacité de mentoring\n" +
            "• Vision produit et architecture\n" +
            "• Communication avec les non-techniques\n" +
            "• Veille technologique active\n\n" +
            "Évolution de carrière :\n" +
            "• Poste clé dans l'organisation\n" +
            "• Formation management et leadership\n" +
            "• Participation aux décisions stratégiques\n" +
            "• Évolution vers CTO possible",
            "Leadership, React, Vue.js, Angular, Node.js, Python, Java, PostgreSQL, AWS, Docker, Architecture",
            "5-8 ans",
            "CDI",
            "Nice (06) - Hybride",
            "55 000 - 70 000 €",
            hrUsername
        );

        // Offre 9 - CDD Business Analyst
        createJobOffer(
            "Business Analyst - CDD 18 mois",
            "Accompagnez notre transformation digitale en tant que Business Analyst pour un projet stratégique.\n\n" +
            "Missions du projet :\n" +
            "• Analyser les besoins métier et fonctionnels\n" +
            "• Rédiger les spécifications fonctionnelles détaillées\n" +
            "• Faire le lien entre les équipes métier et techniques\n" +
            "• Animer des ateliers de co-conception\n" +
            "• Participer à la recette fonctionnelle\n" +
            "• Accompagner le changement et la formation utilisateurs\n\n" +
            "Profil recherché :\n" +
            "• Formation Bac+5 (école de commerce/ingénieur)\n" +
            "• 3-5 ans d'expérience en analyse fonctionnelle\n" +
            "• Maîtrise des méthodologies Agile\n" +
            "• Outils : Jira, Confluence, MS Office\n" +
            "• Excellente communication orale et écrite\n" +
            "• Anglais professionnel\n\n" +
            "Mission 18 mois :\n" +
            "• Projet high-tech innovant\n" +
            "• Équipe internationale\n" +
            "• Formation aux nouvelles méthodologies\n" +
            "• Possibilité de prolongation/CDI",
            "Analyse fonctionnelle, Agile, Scrum, Jira, Confluence, Business Analysis, UML",
            "3-5 ans",
            "CDD",
            "Lyon (69) - Hybride",
            "45 000 - 55 000 €",
            hrUsername
        );

        // Offre 10 - Stage Marketing Digital
        createJobOffer(
            "Stage Marketing Digital & Communication - 6 mois",
            "Rejoignez notre équipe marketing pour développer la visibilité de nos produits tech.\n\n" +
            "Missions du stage :\n" +
            "• Créer du contenu pour nos réseaux sociaux (LinkedIn, Twitter)\n" +
            "• Rédiger des articles de blog techniques\n" +
            "• Participer aux campagnes emailing et newsletter\n" +
            "• Analyser les performances avec Google Analytics\n" +
            "• Organiser des événements et webinaires\n" +
            "• Assister aux salons et conférences tech\n\n" +
            "Profil étudiant recherché :\n" +
            "• Formation Marketing/Communication Bac+3/4/5\n" +
            "• Passion pour le secteur tech/numérique\n" +
            "• Maîtrise des réseaux sociaux professionnels\n" +
            "• Bases en Google Analytics et SEO\n" +
            "• Créativité et aisance rédactionnelle\n" +
            "• Anglais courant (contenu international)\n\n" +
            "Environnement stimulant :\n" +
            "• Secteur tech en forte croissance\n" +
            "• Autonomie et responsabilisation\n" +
            "• Outils modernes (Slack, Notion, Figma)\n" +
            "• Équipe jeune et dynamique\n" +
            "• Possibilité d'embauche",
            "Marketing digital, Réseaux sociaux, Content marketing, Google Analytics, SEO, Communication",
            "Étudiant",
            "INTERNSHIP",
            "Paris (75) - Hybride",
            "800 - 1000 €",
            hrUsername
        );
    }

    private void createJobOffer(String title, String description, String requiredSkills,
                              String experienceLevel, String contractType, String location,
                              String salaryRange, String hrUsername) {
        try {
            JobOfferRequest request = new JobOfferRequest();
            request.setTitle(title);
            request.setDescription(description);
            request.setRequiredSkills(requiredSkills);
            request.setExperienceLevel(experienceLevel);
            request.setContractType(contractType);
            request.setLocation(location);
            request.setSalaryRange(salaryRange);
            request.setStatus(JobOffer.JobStatus.ACTIVE);
            request.setDeadline(LocalDateTime.now().plusMonths(2)); // 2 mois de validité

            jobOfferService.createJobOffer(request, hrUsername);
            logger.info("✅ Offre créée: {}", title);
        } catch (Exception e) {
            logger.error("❌ Erreur lors de la création de l'offre: {}", title, e);
        }
    }
}
