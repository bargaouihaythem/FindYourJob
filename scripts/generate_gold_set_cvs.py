import os
import json
import fitz  # PyMuPDF

output_dir = os.path.join("gold_set", "cvs")
os.makedirs(output_dir, exist_ok=True)

def create_pdf_cv(filepath, name, title, email, phone, location, summary_lines, skills_dict, experiences, education):
    doc = fitz.open()
    page = doc.new_page(width=595, height=842) # Format standard A4
    
    # En-tête bleu institutionnel (couleur Sopra Steria / JOB4YOU)
    page.draw_rect(fitz.Rect(0, 0, 595, 105), color=(0.08, 0.25, 0.50), fill=(0.08, 0.25, 0.50))
    
    # Textes en-tête
    page.insert_text((40, 42), name.upper(), fontsize=18, color=(1, 1, 1), fontname="helv")
    page.insert_text((40, 66), title, fontsize=12, color=(0.88, 0.94, 1.0), fontname="helv")
    
    coord_text = f"Email : {email}   |   Tél : {phone}   |   Localisation : {location}"
    page.insert_text((40, 88), coord_text, fontsize=9, color=(0.80, 0.88, 0.98), fontname="helv")
    
    y = 130
    
    # 1. PROFIL PROFESSIONNEL
    page.draw_rect(fitz.Rect(40, y-14, 555, y-13), color=(0.08, 0.25, 0.50), fill=(0.08, 0.25, 0.50))
    page.insert_text((40, y-2), "PROFIL PROFESSIONNEL", fontsize=11, color=(0.08, 0.25, 0.50), fontname="helv")
    y += 16
    for line in summary_lines:
        page.insert_text((40, y), line, fontsize=9.5, color=(0.2, 0.2, 0.2), fontname="helv")
        y += 13
    
    y += 12
    # 2. COMPÉTENCES CLÉS
    page.draw_rect(fitz.Rect(40, y-14, 555, y-13), color=(0.08, 0.25, 0.50), fill=(0.08, 0.25, 0.50))
    page.insert_text((40, y-2), "COMPÉTENCES CLÉS & EXPERTISE", fontsize=11, color=(0.08, 0.25, 0.50), fontname="helv")
    y += 16
    for category, skills in skills_dict.items():
        page.insert_text((40, y), f"• {category} : ", fontsize=9.5, color=(0.08, 0.25, 0.50), fontname="helv")
        cat_w = fitz.get_text_length(f"• {category} : ", fontname="helv", fontsize=9.5)
        page.insert_text((40 + cat_w, y), skills, fontsize=9.5, color=(0.2, 0.2, 0.2), fontname="helv")
        y += 15
    
    y += 12
    # 3. EXPÉRIENCES PROFESSIONNELLES
    page.draw_rect(fitz.Rect(40, y-14, 555, y-13), color=(0.08, 0.25, 0.50), fill=(0.08, 0.25, 0.50))
    page.insert_text((40, y-2), "EXPÉRIENCES PROFESSIONNELLES", fontsize=11, color=(0.08, 0.25, 0.50), fontname="helv")
    y += 18
    for exp in experiences:
        page.insert_text((40, y), exp["role"] + "  —  " + exp["company"], fontsize=10.5, color=(0.1, 0.1, 0.1), fontname="helv")
        date_w = fitz.get_text_length(exp["date"], fontname="helv", fontsize=9)
        page.insert_text((555 - date_w, y), exp["date"], fontsize=9, color=(0.4, 0.4, 0.4), fontname="helv")
        y += 14
        for task in exp["tasks"]:
            page.insert_text((52, y), "–  " + task, fontsize=9, color=(0.25, 0.25, 0.25), fontname="helv")
            y += 12.5
        y += 6
    
    y += 6
    # 4. FORMATION
    page.draw_rect(fitz.Rect(40, y-14, 555, y-13), color=(0.08, 0.25, 0.50), fill=(0.08, 0.25, 0.50))
    page.insert_text((40, y-2), "FORMATION & CERTIFICATIONS", fontsize=11, color=(0.08, 0.25, 0.50), fontname="helv")
    y += 16
    for edu in education:
        page.insert_text((40, y), edu["degree"] + "  —  " + edu["school"], fontsize=9.5, color=(0.15, 0.15, 0.15), fontname="helv")
        date_w = fitz.get_text_length(edu["year"], fontname="helv", fontsize=9)
        page.insert_text((555 - date_w, y), edu["year"], fontsize=9, color=(0.4, 0.4, 0.4), fontname="helv")
        y += 14
        
    doc.save(filepath)
    doc.close()
    print(f"[OK] Généré : {filepath}")

# ==================== DÉFINITION DES 12 PROFILS DU GOLD SET ====================

cv_data = [
    # ------------------ OFFRE 115 : DÉVELOPPEUR BACKEND JAVA/SPRING ------------------
    {
        "id": "GOLD_01",
        "filename": "CV_01_Dev_Java_Senior_Pertinent.pdf",
        "name": "Alexandre Mercier",
        "title": "Ingénieur d'Études & Développement Java / Spring Boot Senior",
        "email": "alexandre.mercier.sopratest@example.com",
        "phone": "+33 6 12 34 56 78",
        "location": "Lyon, France",
        "targetJobOfferId": 115,
        "targetJobOfferTitle": "Développeur Backend Java/Spring",
        "groundTruthRelevance": "PERTINENT",
        "summary": [
            "Ingénieur logiciel senior avec 5 ans d'expérience dans la conception d'architectures backend robustes.",
            "Expert de l'écosystème Java 17+, microservices Spring Boot, Spring Security, JPA/Hibernate et PostgreSQL.",
            "Maîtrise éprouvée des architectures distribuées avec Redis, Docker, Kubernetes et des pipelines CI/CD."
        ],
        "skills": {
            "Langages & Frameworks": "Java 17, Spring Boot, Spring Security, Hibernate, JPA, Maven",
            "Bases de données & Caching": "PostgreSQL, MongoDB, Redis, SQL",
            "DevOps & Conteneurisation": "Docker, Kubernetes, AWS, Jenkins, Git",
            "Méthodologie": "Agile Scrum, TDD, Clean Architecture, REST API"
        },
        "experiences": [
            {
                "role": "Lead Développeur Java / Spring Boot",
                "company": "TechSolutions SaaS",
                "date": "2023 - Présent (3 ans)",
                "tasks": [
                    "Conception et développement de microservices haute disponibilité sous Spring Boot 3 et Java 17.",
                    "Sécurisation des endpoints REST avec Spring Security, JWT et OAuth2.",
                    "Optimisation des requêtes PostgreSQL et mise en place d'un cache distribué Redis.",
                    "Conteneurisation des services avec Docker et déploiement sur cluster Kubernetes (EKS)."
                ]
            },
            {
                "role": "Développeur Backend Java",
                "company": "FinanceCore Systems",
                "date": "2021 - 2023 (2 ans)",
                "tasks": [
                    "Développement d'APIs transactionnelles sous Java 11 et Spring Framework.",
                    "Modélisation relationnelle PostgreSQL et persistance avec Hibernate.",
                    "Industrialisation des builds via Maven et pipelines CI/CD Gitlab."
                ]
            }
        ],
        "education": [
            {"degree": "Master Informatique & Génie Logiciel", "school": "INSA Lyon", "year": "2021"},
            {"degree": "Certification Spring Professional", "school": "VMware Pivotal", "year": "2023"}
        ]
    },
    {
        "id": "GOLD_02",
        "filename": "CV_02_Dev_Java_Mid_Pertinent.pdf",
        "name": "Camille Bernard",
        "title": "Développeuse Backend Java / Spring Boot",
        "email": "camille.bernard.sopratest@example.com",
        "phone": "+33 6 23 45 67 89",
        "location": "Paris, France",
        "targetJobOfferId": 115,
        "targetJobOfferTitle": "Développeur Backend Java/Spring",
        "groundTruthRelevance": "PERTINENT",
        "summary": [
            "Développeuse backend avec 3 ans d'expérience sur des applications d'entreprise Java et Spring Boot.",
            "Pratique quotidienne des bases de données relationnelles PostgreSQL, ORM Hibernate, et conteneurs Docker.",
            "Autonome, rigoureuse et attachée aux bonnes pratiques de code (clean code, tests automatisés JUnit/Mockito)."
        ],
        "skills": {
            "Backend": "Java 17, Spring Boot, Spring Data JPA, REST API, Maven",
            "Données": "PostgreSQL, Redis, Liquibase",
            "Outils & Déploiement": "Docker, Git, GitLab CI, Linux",
            "Qualité": "JUnit 5, Mockito, SonarQube"
        },
        "experiences": [
            {
                "role": "Développeuse Backend Java/Spring",
                "company": "LogisWeb Platforms",
                "date": "2023 - Présent (3 ans)",
                "tasks": [
                    "Développement de nouvelles fonctionnalités au sein d'une API REST Spring Boot.",
                    "Intégration de PostgreSQL et mise en place de migrations de schéma avec Liquibase.",
                    "Écriture de tests unitaires et d'intégration couvrant 85% de la logique métier.",
                    "Conteneurisation d'applications avec Docker pour les environnements de staging."
                ]
            }
        ],
        "education": [
            {"degree": "Diplôme d'Ingénieur en Informatique", "school": "EPITA Paris", "year": "2023"}
        ]
    },
    {
        "id": "GOLD_03",
        "filename": "CV_03_Dev_Fullstack_Angular_Java_Pertinent.pdf",
        "name": "Julien Rouve",
        "title": "Ingénieur Full Stack Java / Spring Boot / Angular",
        "email": "julien.rouve.sopratest@example.com",
        "phone": "+33 6 34 56 78 90",
        "location": "Nantes, France",
        "targetJobOfferId": 115,
        "targetJobOfferTitle": "Développeur Backend Java/Spring",
        "groundTruthRelevance": "PERTINENT",
        "summary": [
            "Ingénieur Full Stack avec 4 ans d'expérience combinant backend robuste Java/Spring Boot et frontend Angular.",
            "Compétences solides en conception d'APIs RESTful, persistance PostgreSQL/MongoDB et architectures conteneurisées.",
            "Profil polyvalent très adapté aux projets applicatifs d'envergure (SIRH / ERP)."
        ],
        "skills": {
            "Backend": "Java, Spring Boot, Spring Security, Maven, Hibernate",
            "Frontend": "Angular 16, TypeScript, RxJS, HTML5, SCSS",
            "Bases de données": "PostgreSQL, MongoDB, Redis",
            "Cloud & Outils": "Docker, GCP, Kubernetes basique, Git"
        },
        "experiences": [
            {
                "role": "Développeur Full Stack Java / Angular",
                "company": "CloudWave Systems",
                "date": "2022 - Présent (4 ans)",
                "tasks": [
                    "Développement de microservices Spring Boot alimentant une interface moderne Angular.",
                    "Gestion de la persistance sous PostgreSQL et mise en cache Redis.",
                    "Déploiement conteneurisé sous Docker et orchestration légère.",
                    "Participation active aux cérémonies agiles et revues de code."
                ]
            }
        ],
        "education": [
            {"degree": "Master Informatique et Multimédia", "school": "Université de Nantes", "year": "2022"}
        ]
    },
    {
        "id": "GOLD_04",
        "filename": "CV_04_Dev_PHP_Symfony_Non_Pertinent.pdf",
        "name": "Guillaume Delorme",
        "title": "Développeur Web PHP / Symfony",
        "email": "guillaume.delorme.sopratest@example.com",
        "phone": "+33 6 45 67 89 01",
        "location": "Marseille, France",
        "targetJobOfferId": 115,
        "targetJobOfferTitle": "Développeur Backend Java/Spring",
        "groundTruthRelevance": "NON_PERTINENT",
        "summary": [
            "Développeur Web spécialisé dans l'écosystème PHP 8 et le framework Symfony depuis 4 ans.",
            "Conception de sites vitrines et plateformes e-commerce avec MySQL, Apache et WordPress.",
            "Bonnes compétences en intégration HTML/CSS et templating Twig."
        ],
        "skills": {
            "Langages & Web": "PHP 8, Symfony 6, Twig, JavaScript, HTML5, CSS3",
            "Bases de données": "MySQL, MariaDB",
            "Serveurs & Outils": "Apache, Nginx, Composer, Git, CPanel"
        },
        "experiences": [
            {
                "role": "Développeur Web PHP / Symfony",
                "company": "Agence Web Sud",
                "date": "2022 - Présent (4 ans)",
                "tasks": [
                    "Création d'applications web personnalisées sous Symfony et Twig.",
                    "Administration de bases MySQL et modélisation avec Doctrine ORM.",
                    "Déploiement sur hébergements mutualisés et serveurs dédiés Apache."
                ]
            }
        ],
        "education": [
            {"degree": "Licence Professionnelle Métiers du Web", "school": "IUT Aix-Marseille", "year": "2022"}
        ]
    },

    # ------------------ OFFRE 117 : DEVOPS ENGINEER ------------------
    {
        "id": "GOLD_05",
        "filename": "CV_05_DevOps_Senior_Cloud_Pertinent.pdf",
        "name": "Sébastien Vasseur",
        "title": "Senior DevOps & Cloud Infrastructure Engineer",
        "email": "sebastien.vasseur.sopratest@example.com",
        "phone": "+33 6 56 78 90 12",
        "location": "Paris, France",
        "targetJobOfferId": 117,
        "targetJobOfferTitle": "DevOps Engineer - Mission Freelance",
        "groundTruthRelevance": "PERTINENT",
        "summary": [
            "Ingénieur DevOps Senior avec plus de 6 ans d'expérience dans l'automatisation d'infrastructures Cloud (AWS/Azure).",
            "Expert Kubernetes, Docker, Terraform (IaC), Ansible, et pipelines CI/CD Jenkins / GitLab.",
            "Spécialiste de l'observabilité avec Prometheus, Grafana et ELK stack, scripting avancé Python et Bash."
        ],
        "skills": {
            "Cloud": "AWS (EKS, EC2, S3, IAM, VPC), Azure",
            "Conteneurs & Orchestration": "Kubernetes, Docker, Helm",
            "Infrastructure as Code & Config": "Terraform, Ansible",
            "CI/CD & Automatisation": "Jenkins, GitLab CI, GitHub Actions, Bash, Python",
            "Observabilité": "Prometheus, Grafana, Alertmanager"
        },
        "experiences": [
            {
                "role": "Lead DevOps Engineer",
                "company": "ScaleCloud Services",
                "date": "2021 - Présent (5 ans)",
                "tasks": [
                    "Déploiement et gestion d'infrastructures multi-régions AWS avec Terraform.",
                    "Orchestration de clusters Kubernetes gérant plus de 150 microservices en production.",
                    "Mise en place de chaînes CI/CD automatisées sous Jenkins et GitLab CI.",
                    "Surveillance et alerting temps réel avec Prometheus et dashboards Grafana."
                ]
            },
            {
                "role": "Ingénieur DevOps",
                "company": "Fintech Horizon",
                "date": "2019 - 2021 (2 ans)",
                "tasks": [
                    "Automatisation du provisionnement des serveurs avec Ansible et scripts Bash.",
                    "Migration de services legacy vers des conteneurs Docker.",
                    "Gestion des environnements de staging sous Azure."
                ]
            }
        ],
        "education": [
            {"degree": "Master Systèmes de Réseaux & Sécurité", "school": "Télécom SudParis", "year": "2019"},
            {"degree": "AWS Certified Solutions Architect & CKA (Kubernetes)", "school": "CNCF / AWS", "year": "2022"}
        ]
    },
    {
        "id": "GOLD_06",
        "filename": "CV_06_Ingenieur_Cloud_Azure_Docker_Pertinent.pdf",
        "name": "Nadia Khemir",
        "title": "Ingénieure Cloud & DevOps",
        "email": "nadia.khemir.sopratest@example.com",
        "phone": "+33 6 67 89 01 23",
        "location": "Lille, France",
        "targetJobOfferId": 117,
        "targetJobOfferTitle": "DevOps Engineer - Mission Freelance",
        "groundTruthRelevance": "PERTINENT",
        "summary": [
            "Ingénieure Cloud DevOps avec 5 ans d'expérience dans la transformation et l'automatisation d'environnements Cloud.",
            "Pratique approfondie des conteneurs Docker, orchestrateurs Kubernetes, scripts Terraform et pipelines Jenkins.",
            "Forte culture DevOps favorisant la collaboration entre équipes de développement et opérations."
        ],
        "skills": {
            "Cloud": "Azure, AWS, Linux",
            "Outils DevOps": "Docker, Kubernetes, Terraform, Ansible, Jenkins",
            "Monitoring & Scripting": "Prometheus, Grafana, Python, Bash, Shell"
        },
        "experiences": [
            {
                "role": "Consultante DevOps & Cloud",
                "company": "InfraNext Consulting",
                "date": "2021 - Présent (5 ans)",
                "tasks": [
                    "Conception d'architectures Cloud Azure et déploiement via Terraform.",
                    "Création de pipelines CI/CD sous Jenkins pour la livraison continue de conteneurs Docker.",
                    "Mise en place de métriques Prometheus et dashboards de supervision Grafana.",
                    "Scripting Python et Bash pour automatiser les tâches d'exploitation."
                ]
            }
        ],
        "education": [
            {"degree": "Diplôme d'Ingénieur Télécoms & Réseaux", "school": "Polytech Lille", "year": "2021"}
        ]
    },
    {
        "id": "GOLD_07",
        "filename": "CV_07_Admin_Sys_Linux_Non_Pertinent.pdf",
        "name": "Thierry Gauthier",
        "title": "Technicien / Administrateur Systèmes Réseaux Traditionnel",
        "email": "thierry.gauthier.sopratest@example.com",
        "phone": "+33 6 78 90 12 34",
        "location": "Bordeaux, France",
        "targetJobOfferId": 117,
        "targetJobOfferTitle": "DevOps Engineer - Mission Freelance",
        "groundTruthRelevance": "NON_PERTINENT",
        "summary": [
            "Administrateur systèmes et réseaux avec 5 ans d'expérience dans la maintenance de parcs informatiques locaux.",
            "Gestion des postes de travail, serveurs Windows Server Active Directory et petites passerelles Linux.",
            "Pas d'expérience sur les technologies Cloud publiques (AWS/Azure), ni Docker, Kubernetes ou Terraform."
        ],
        "skills": {
            "Systèmes": "Windows Server 2019, Active Directory, Debian Linux basique",
            "Réseaux": "VLAN, Switch Cisco, Routeurs, VPN, DNS local",
            "Bureautique": "Office 365, Support utilisateurs N1/N2"
        },
        "experiences": [
            {
                "role": "Administrateur Systèmes & Réseaux Local",
                "company": "Entreprise Aquitaine Logistique",
                "date": "2021 - Présent (5 ans)",
                "tasks": [
                    "Maintenance matérielle et logicielle du parc de 150 PC et serveurs sur site.",
                    "Configuration des comptes utilisateurs dans Active Directory.",
                    "Supervision du réseau local et sauvegardes sur bandes magnétiques/NAS."
                ]
            }
        ],
        "education": [
            {"degree": "BTS Systèmes Numériques", "school": "Lycée Gustave Eiffel Bordeaux", "year": "2021"}
        ]
    },
    {
        "id": "GOLD_08",
        "filename": "CV_08_Graphiste_UI_Non_Pertinent.pdf",
        "name": "Éléonore Faure",
        "title": "Designer Graphique & Communication Visuelle",
        "email": "eleonore.faure.sopratest@example.com",
        "phone": "+33 6 89 01 23 45",
        "location": "Toulouse, France",
        "targetJobOfferId": 117,
        "targetJobOfferTitle": "DevOps Engineer - Mission Freelance",
        "groundTruthRelevance": "NON_PERTINENT",
        "summary": [
            "Designer graphique passionnée par la création d'identités visuelles, logos, chartes graphiques et supports print/web.",
            "Excellente maîtrise de la suite Adobe (Photoshop, Illustrator, InDesign) et des outils de prototypage.",
            "Aucune compétence en programmation logicielle, infrastructure cloud ou systèmes informatiques."
        ],
        "skills": {
            "Création visuelle": "Adobe Photoshop, Illustrator, InDesign, Figma, Canva",
            "Communication": "Print, Web design, Typographie, Retouche photo"
        },
        "experiences": [
            {
                "role": "Graphiste & Directrice Artistique Junior",
                "company": "Studio Créatif Horizon",
                "date": "2022 - Présent (4 ans)",
                "tasks": [
                    "Conception d'identités de marque pour divers clients régionaux.",
                    "Réalisation de brochures, affiches et visuels pour réseaux sociaux.",
                    "Préparation des fichiers d'impression pour imprimeurs professionnels."
                ]
            }
        ],
        "education": [
            {"degree": "Bachelor Design Graphique", "school": "École d'Arts Appliqués Toulouse", "year": "2022"}
        ]
    },

    # ------------------ OFFRE 122 : BUSINESS ANALYST / SIRH (CONSULTING SERVICES) ------------------
    {
        "id": "GOLD_09",
        "filename": "CV_09_Consultant_SIRH_Paie_Pertinent.pdf",
        "name": "Marc Lemaire",
        "title": "Consultant Fonctionnel SIRH & Paie Senior",
        "email": "marc.lemaire.sopratest@example.com",
        "phone": "+33 6 90 12 34 56",
        "location": "Paris, France",
        "targetJobOfferId": 122,
        "targetJobOfferTitle": "Business Analyst - CDD 18 mois",
        "groundTruthRelevance": "PERTINENT",
        "summary": [
            "Consultant fonctionnel senior spécialisé en transformation digitale des processus RH, GTA et Paie (5 ans d'expérience).",
            "Expert en analyse fonctionnelle, recueil des besoins métiers, animation d'ateliers et rédaction de cahiers des charges.",
            "Maîtrise des méthodologies Agiles (Scrum, Product Owner proxy), Jira, Confluence, UML et recettes fonctionnelles."
        ],
        "skills": {
            "Domaine Métier": "SIRH, Paie, Gestion des Temps & Activités (GTA), Recrutement",
            "Analyse & Conception": "Analyse fonctionnelle, Business Analysis, Spécifications détaillées, UML",
            "Méthodologie & Outils": "Agile Scrum, Jira, Confluence, Recette applicative, SQL basique"
        },
        "experiences": [
            {
                "role": "Consultant Fonctionnel SIRH & Business Analyst",
                "company": "HR Transformation Advisory",
                "date": "2021 - Présent (5 ans)",
                "tasks": [
                    "Audit et formalisation des processus RH et paie pour des entreprises du CAC 40.",
                    "Rédaction des spécifications fonctionnelles générales et détaillées sous Confluence.",
                    "Gestion du backlog projet et suivi des user stories sous Jira en méthodologie Scrum.",
                    "Coordination et exécution des phases de recette fonctionnelle utilisateur (UAT)."
                ]
            }
        ],
        "education": [
            {"degree": "Master Management des Ressources Humaines & Systèmes d'Information", "school": "Université Paris Dauphine", "year": "2021"}
        ]
    },
    {
        "id": "GOLD_10",
        "filename": "CV_10_Business_Analyst_Agile_Pertinent.pdf",
        "name": "Sophie Moreau",
        "title": "Business Analyst Applicatif & Méthodes Agiles",
        "email": "sophie.moreau.sopratest@example.com",
        "phone": "+33 6 01 23 45 67",
        "location": "Lyon, France",
        "targetJobOfferId": 122,
        "targetJobOfferTitle": "Business Analyst - CDD 18 mois",
        "groundTruthRelevance": "PERTINENT",
        "summary": [
            "Business Analyst avec 4 ans d'expérience dans la conduite de projets informatiques et l'alignement métier/IT.",
            "Pratique éprouvée de l'analyse fonctionnelle, modélisation de processus (UML, BPMN), et documentation des exigences.",
            "Rôle clé dans les équipes Agile Scrum en collaboration directe avec les Product Owners et développeurs."
        ],
        "skills": {
            "Analyse Métier": "Analyse fonctionnelle, Business Analysis, Spécifications, UML, BPMN",
            "Méthodologie": "Agile, Scrum, Recette, Tests d'acceptation",
            "Outils de gestion": "Jira, Confluence, Miro, Excel avancé"
        },
        "experiences": [
            {
                "role": "Business Analyst IT",
                "company": "DigitAll Consulting",
                "date": "2022 - Présent (4 ans)",
                "tasks": [
                    "Interviews des parties prenantes métiers et formalisation des cas d'usage.",
                    "Découpage des besoins en User Stories et critères d'acceptation INVEST sous Jira.",
                    "Modélisation des parcours utilisateurs et diagrammes d'activités UML.",
                    "Pilotage des tests de non-régression et support à la recette fonctionnelle."
                ]
            }
        ],
        "education": [
            {"degree": "Master Sciences du Management & Systèmes d'Information", "school": "EM Lyon", "year": "2022"}
        ]
    },
    {
        "id": "GOLD_11",
        "filename": "CV_11_Comptable_General_Non_Pertinent.pdf",
        "name": "Valérie Dubois",
        "title": "Comptable d'Entreprise Généraliste",
        "email": "valerie.dubois.sopratest@example.com",
        "phone": "+33 6 11 22 33 44",
        "location": "Strasbourg, France",
        "targetJobOfferId": 122,
        "targetJobOfferTitle": "Business Analyst - CDD 18 mois",
        "groundTruthRelevance": "NON_PERTINENT",
        "summary": [
            "Comptable générale confirmée avec 4 ans d'expérience en saisie comptable, déclarations fiscales et TVA.",
            "Gestion des écritures d'achats/ventes, rapprochements bancaires et bilan annuel.",
            "Aucune compétence en analyse fonctionnelle informatique, modélisation logicielle ou gestion de projet Agile/Scrum."
        ],
        "skills": {
            "Comptabilité": "Comptabilité générale, Rapprochement bancaire, Déclarations TVA, Clôture mensuelle",
            "Logiciels comptables": "Sage 100, Ciel Compta, Excel (TCD)",
            "Fiscalité": "Liasses fiscales, Bilan, Compte de résultat"
        },
        "experiences": [
            {
                "role": "Comptable Unique",
                "company": "Alsace Distribution SARL",
                "date": "2022 - Présent (4 ans)",
                "tasks": [
                    "Tenue quotidienne des journaux comptables d'achats et de ventes.",
                    "Établissement des déclarations de TVA et paiements fournisseurs.",
                    "Préparation des documents de synthèse pour l'expert-comptable."
                ]
            }
        ],
        "education": [
            {"degree": "BTS Comptabilité et Gestion", "school": "Lycée Jean Monnet Strasbourg", "year": "2022"}
        ]
    },
    {
        "id": "GOLD_12",
        "filename": "CV_12_Data_Scientist_Python_Non_Pertinent.pdf",
        "name": "Karim Belhadj",
        "title": "Data Scientist & Deep Learning Specialist",
        "email": "karim.belhadj.sopratest@example.com",
        "phone": "+33 6 22 33 44 55",
        "location": "Grenoble, France",
        "targetJobOfferId": 122,
        "targetJobOfferTitle": "Business Analyst - CDD 18 mois",
        "groundTruthRelevance": "NON_PERTINENT",
        "summary": [
            "Data Scientist orienté recherche appliquée, vision par ordinateur et réseaux neuronaux convolutifs (4 ans d'expérience).",
            "Modélisation sous PyTorch, OpenCV et segmentation sémantique d'images médicales.",
            "Profil scientifique sans expérience en Business Analysis, analyse fonctionnelle d'entreprise ou méthodologies de gestion RH."
        ],
        "skills": {
            "Data & IA": "Python, PyTorch, TensorFlow, OpenCV, Scikit-learn, Pandas, NumPy",
            "Mathématiques": "Algèbre linéaire, Optimisation convexe, Statistiques bayésiennes",
            "Outils": "Jupyter, CUDA, Git, Linux"
        },
        "experiences": [
            {
                "role": "Ingénieur R&D Data Science / Vision",
                "company": "BioVision Labs",
                "date": "2022 - Présent (4 ans)",
                "tasks": [
                    "Entraînement de modèles de Deep Learning sous PyTorch sur GPU.",
                    "Prétraitement de volumétries massives d'images biomédicales.",
                    "Publication d'articles scientifiques et benchmarking d'algorithmes de détection."
                ]
            }
        ],
        "education": [
            {"degree": "Master Mathématiques Appliquées & Machine Learning", "school": "Université Grenoble Alpes", "year": "2022"}
        ]
    },

    # ------------------ PROFILS FRONTIÈRES & CAS LIMITES (BORDERLINE) ------------------
    {
        "id": "GOLD_13",
        "filename": "CV_13_Dev_Junior_CPP_Java_Borderline_Non_Pertinent.pdf",
        "name": "Lucas Pires",
        "title": "Développeur Logiciel Junior C++ & Java Débutant",
        "email": "lucas.pires.sopratest@example.com",
        "phone": "+33 6 44 55 66 77",
        "location": "Rennes, France",
        "targetJobOfferId": 115,
        "targetJobOfferTitle": "Développeur Backend Java/Spring",
        "groundTruthRelevance": "NON_PERTINENT",
        "summary": [
            "Jeune diplômé orienté développement bas-niveau C/C++ et algorithmique.",
            "Notions académiques en Java Standard Edition acquises lors de projets d'école.",
            "Aucune expérience pratique avec Spring Boot, Spring Security, microservices ni bases de données SQL avancées."
        ],
        "skills": {
            "Langages": "C++, C, Java SE basique",
            "Outils": "Git, Linux, GCC, Make, Eclipse"
        },
        "experiences": [
            {
                "role": "Stagiaire Développeur Embarqué C++",
                "company": "Systèmes Électroniques Ouest",
                "date": "2023 - 2024 (1 an)",
                "tasks": [
                    "Développement de drivers de périphériques en C++ sous Linux embarqué.",
                    "Débogage et tests unitaires avec GoogleTest."
                ]
            }
        ],
        "education": [
            {"degree": "Licence Informatique Générale", "school": "Université de Rennes 1", "year": "2023"}
        ]
    },
    {
        "id": "GOLD_14",
        "filename": "CV_14_Dev_Java_Junior_Spring_Borderline_Pertinent.pdf",
        "name": "Manon Girard",
        "title": "Développeuse Java / Spring Boot Junior (2 ans)",
        "email": "manon.girard.sopratest@example.com",
        "phone": "+33 6 55 66 77 88",
        "location": "Nantes, France",
        "targetJobOfferId": 115,
        "targetJobOfferTitle": "Développeur Backend Java/Spring",
        "groundTruthRelevance": "PERTINENT",
        "summary": [
            "Développeuse Java avec 2 ans d'expérience en alternance et CDI junior sur microservices Spring Boot.",
            "Bonnes bases en API REST, persistance PostgreSQL et Maven.",
            "N'a pas encore manipulé Kubernetes ni les clouds publics AWS/GCP en environnement de production."
        ],
        "skills": {
            "Backend": "Java 17, Spring Boot, Maven, REST API",
            "Bases de données": "PostgreSQL, SQL",
            "Outils": "Git, Docker (notions), IntelliJ"
        },
        "experiences": [
            {
                "role": "Développeuse Java Junior",
                "company": "Digital Services Ouest",
                "date": "2024 - Présent (2 ans)",
                "tasks": [
                    "Création d'endpoints REST sécurisés avec Spring Boot.",
                    "Requêtage PostgreSQL et modélisation entités JPA.",
                    "Participation aux revues de code et tests unitaires JUnit."
                ]
            }
        ],
        "education": [
            {"degree": "Bachelor Concepteur Développeur d'Applications", "school": "ENI Nantes", "year": "2024"}
        ]
    },
    {
        "id": "GOLD_15",
        "filename": "CV_15_Tech_Support_Linux_Borderline_Non_Pertinent.pdf",
        "name": "Romain Mercier",
        "title": "Technicien Systèmes Linux & Support Utilisateurs",
        "email": "romain.mercier.sopratest@example.com",
        "phone": "+33 6 66 77 88 99",
        "location": "Montpellier, France",
        "targetJobOfferId": 117,
        "targetJobOfferTitle": "DevOps Engineer - Mission Freelance",
        "groundTruthRelevance": "NON_PERTINENT",
        "summary": [
            "Technicien support système et Linux avec 3 ans d'expérience en helpdesk et administration de base.",
            "Bonne connaissance de l'environnement Bash et premières manipulations de conteneurs Docker en local.",
            "Aucune compétence sur Kubernetes, Terraform, Ansible, ni architecture Cloud (AWS/Azure) pour un rôle Senior."
        ],
        "skills": {
            "Systèmes": "Linux Ubuntu, Debian, Bash, Notions Docker",
            "Support": "Gestion des incidents, Helpdesk, Ticketing GLPI, Git basique"
        },
        "experiences": [
            {
                "role": "Technicien Support & Système",
                "company": "InfraMéditerranée",
                "date": "2023 - Présent (3 ans)",
                "tasks": [
                    "Support niveau 2 pour les postes Linux et serveurs internes.",
                    "Écriture de scripts Bash pour sauvegardes régulières.",
                    "Installation de conteneurs Docker simples pour bancs de test."
                ]
            }
        ],
        "education": [
            {"degree": "DUT Informatique", "school": "IUT Montpellier-Sète", "year": "2023"}
        ]
    },
    {
        "id": "GOLD_16",
        "filename": "CV_16_QA_Recette_Agile_Borderline_Pertinent.pdf",
        "name": "Inès Benali",
        "title": "Chargée de Recette Fonctionnelle & Tests QA Agile",
        "email": "ines.benali.sopratest@example.com",
        "phone": "+33 6 77 88 99 00",
        "location": "Lille, France",
        "targetJobOfferId": 122,
        "targetJobOfferTitle": "Business Analyst - CDD 18 mois",
        "groundTruthRelevance": "PERTINENT",
        "summary": [
            "Professionnelle de la qualité logicielle et recette avec 3 ans d'expérience en équipe Agile Scrum.",
            "Maîtrise de Jira, Confluence, rédaction des cas de test et exécution de plans de recette fonctionnelle.",
            "Connaissance pratique des processus métier, mais modélisation UML moins approfondie."
        ],
        "skills": {
            "Gestion & Qualité": "Recette fonctionnelle, Analyse fonctionnelle, Cahier de tests, Agile, Scrum",
            "Outils": "Jira, Confluence, Xray, Trello, SQL basique"
        },
        "experiences": [
            {
                "role": "Chargée de Recette Fonctionnelle & QA",
                "company": "E-Commerce Nord Solutions",
                "date": "2023 - Présent (3 ans)",
                "tasks": [
                    "Rédaction des plans de tests à partir des spécifications fonctionnelles.",
                    "Suivi des anomalies et validation des User Stories sous Jira.",
                    "Collaboration quotidienne avec le Product Owner et les développeurs en sprint Scrum."
                ]
            }
        ],
        "education": [
            {"degree": "Master Management de Projets Web", "school": "Université de Lille", "year": "2023"}
        ]
    }
]

print("Génération des fichiers PDF du Gold Set...")
for cv in cv_data:
    pdf_path = os.path.join(output_dir, cv["filename"])
    create_pdf_cv(
        pdf_path,
        cv["name"],
        cv["title"],
        cv["email"],
        cv["phone"],
        cv["location"],
        cv["summary"],
        cv["skills"],
        cv["experiences"],
        cv["education"]
    )

# Sauvegarde du fichier ground_truth.json
gt_path = os.path.join("gold_set", "ground_truth.json")
ground_truth_records = []
for cv in cv_data:
    ground_truth_records.append({
        "id": cv["id"],
        "filename": cv["filename"],
        "candidateName": cv["name"],
        "targetJobOfferId": cv["targetJobOfferId"],
        "targetJobOfferTitle": cv["targetJobOfferTitle"],
        "groundTruthRelevance": cv["groundTruthRelevance"],
        "expectedDecision": (cv["groundTruthRelevance"] == "PERTINENT"),
        "keySkills": cv["skills"],
        "rationale": "Profil directement aligné sur les critères requis de l'offre (compétences techniques et expérience)" if cv["groundTruthRelevance"] == "PERTINENT" else "Profil hors cible par rapport aux exigences du poste (technologies ou compétences métier non correspondantes)"
    })

with open(gt_path, "w", encoding="utf-8") as f:
    json.dump(ground_truth_records, f, indent=2, ensure_ascii=False)

print(f"[OK] Fichier de vérité terrain sauvegardé : {gt_path} ({len(ground_truth_records)} CVs annotés)")

