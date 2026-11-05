import os
import fitz  # PyMuPDF

output_dir = "cv_tests"
os.makedirs(output_dir, exist_ok=True)

def create_cv(filename, name, title, email, phone, location, summary, skills_dict, experiences, education):
    doc = fitz.open()
    page = doc.new_page(width=595, height=842) # A4 format
    
    # Header background banner
    page.draw_rect(fitz.Rect(0, 0, 595, 110), color=(0.12, 0.29, 0.49), fill=(0.12, 0.29, 0.49))
    
    # Header text
    page.insert_text((40, 45), name.upper(), fontsize=20, color=(1, 1, 1), fontname="helv", fontfile=None)
    page.insert_text((40, 70), title, fontsize=13, color=(0.9, 0.95, 1), fontname="helv")
    
    coord_text = f"Email: {email}   |   Tél: {phone}   |   Localisation: {location}"
    page.insert_text((40, 92), coord_text, fontsize=9.5, color=(0.85, 0.9, 0.98), fontname="helv")
    
    y = 140
    
    # Profil / Synthèse
    page.draw_rect(fitz.Rect(40, y-15, 555, y-14), color=(0.12, 0.29, 0.49), fill=(0.12, 0.29, 0.49))
    page.insert_text((40, y-3), "PROFIL PROFESSIONNEL", fontsize=12, color=(0.12, 0.29, 0.49), fontname="helv")
    y += 18
    
    # Split summary into lines
    for line in summary:
        page.insert_text((40, y), line, fontsize=10, color=(0.2, 0.2, 0.2), fontname="helv")
        y += 14
    
    y += 15
    # Compétences
    page.draw_rect(fitz.Rect(40, y-15, 555, y-14), color=(0.12, 0.29, 0.49), fill=(0.12, 0.29, 0.49))
    page.insert_text((40, y-3), "COMPÉTENCES CLÉS", fontsize=12, color=(0.12, 0.29, 0.49), fontname="helv")
    y += 18
    
    for category, skills in skills_dict.items():
        page.insert_text((40, y), f"•  {category} : ", fontsize=10, color=(0.12, 0.29, 0.49), fontname="helv")
        cat_width = fitz.get_text_length(f"•  {category} : ", fontname="helv", fontsize=10)
        page.insert_text((40 + cat_width, y), skills, fontsize=10, color=(0.2, 0.2, 0.2), fontname="helv")
        y += 16
    
    y += 15
    # Expériences
    page.draw_rect(fitz.Rect(40, y-15, 555, y-14), color=(0.12, 0.29, 0.49), fill=(0.12, 0.29, 0.49))
    page.insert_text((40, y-3), "EXPÉRIENCES PROFESSIONNELLES", fontsize=12, color=(0.12, 0.29, 0.49), fontname="helv")
    y += 20
    
    for exp in experiences:
        page.insert_text((40, y), exp["role"] + "  —  " + exp["company"], fontsize=11, color=(0.1, 0.1, 0.1), fontname="helv")
        date_w = fitz.get_text_length(exp["date"], fontname="helv", fontsize=9.5)
        page.insert_text((555 - date_w, y), exp["date"], fontsize=9.5, color=(0.4, 0.4, 0.4), fontname="helv")
        y += 15
        for task in exp["tasks"]:
            page.insert_text((55, y), "–  " + task, fontsize=9.5, color=(0.25, 0.25, 0.25), fontname="helv")
            y += 14
        y += 8
    
    y += 10
    # Formation
    page.draw_rect(fitz.Rect(40, y-15, 555, y-14), color=(0.12, 0.29, 0.49), fill=(0.12, 0.29, 0.49))
    page.insert_text((40, y-3), "FORMATION & DIPLÔMES", fontsize=12, color=(0.12, 0.29, 0.49), fontname="helv")
    y += 20
    
    for edu in education:
        page.insert_text((40, y), edu["degree"] + "  —  " + edu["school"], fontsize=10.5, color=(0.1, 0.1, 0.1), fontname="helv")
        date_w = fitz.get_text_length(edu["date"], fontname="helv", fontsize=9.5)
        page.insert_text((555 - date_w, y), edu["date"], fontsize=9.5, color=(0.4, 0.4, 0.4), fontname="helv")
        y += 18
    
    file_path = os.path.join(output_dir, filename)
    doc.save(file_path)
    doc.close()
    print(f"Généré : {file_path}")

# ==========================================
# 1. CV BACKEND JAVA / SPRING BOOT
# ==========================================
create_cv(
    filename="1_CV_Backend_Java_Spring_Thomas.pdf",
    name="Thomas Lefebvre",
    title="Ingénieur Développeur Backend Java / Spring Boot (3 ans d'expérience)",
    email="thomas.lefebvre.dev@gmail.com",
    phone="+33 6 12 34 56 78",
    location="Paris (75) - Mobilité Hybride",
    summary=[
        "Développeur backend expérimenté, passionné par la conception d'architectures orientées services et",
        "d'API REST performantes et résilientes. Forte maîtrise de Java 17, Spring Boot, Spring Security et de la gestion",
        "des bases relationnelles PostgreSQL. Rompu aux méthodologies Agile Scrum et aux déploiements conteneurisés."
    ],
    skills_dict={
        "Langages": "Java 17 / 21, SQL, Bash",
        "Frameworks Backend": "Spring Boot 3, Spring Data JPA, Hibernate, Spring Security (JWT / OAuth2)",
        "Bases de données": "PostgreSQL, MySQL, Redis (mise en cache), migrations Flyway / Liquibase",
        "DevOps & Outils": "Docker, Kubernetes, Git, Maven, CI/CD Jenkins, SonarQube, Postman, Swagger"
    },
    experiences=[
        {
            "role": "Développeur Backend Spring Boot",
            "company": "Capgemini / Mission Banque & Assurance",
            "date": "2024 - Présent (2 ans)",
            "tasks": [
                "Développement de microservices métier d'instruction de dossiers sous Spring Boot 3 et Java 17.",
                "Sécurisation des flux par jetons JWT asymétriques et mise en place de filtres Spring Security.",
                "Optimisation des requêtes complexes SQL et pagination sous PostgreSQL (réduction des temps de réponse de 40%).",
                "Rédaction des tests unitaires et d'intégration avec JUnit 5 et Mockito (couverture > 85%)."
            ]
        },
        {
            "role": "Développeur Java Junior",
            "company": "FinTech Innov",
            "date": "2023 - 2024 (1 an)",
            "tasks": [
                "Participation à l'évolution d'une plateforme transactionnelle RESTful en Spring Boot et PostgreSQL.",
                "Mise en place de tests d'intégration avec Testcontainers et intégration continue Gitlab CI.",
                "Conteneurisation des composants via Docker et Docker Compose."
            ]
        }
    ],
    education=[
        {
            "degree": "Master Informatique & Génie Logiciel",
            "school": "Université Paris-Saclay",
            "date": "2021 - 2023"
        },
        {
            "degree": "Licence en Informatique",
            "school": "Université Paris-Cité",
            "date": "2018 - 2021"
        }
    ]
)

# ==========================================
# 2. CV FRONTEND ANGULAR / TYPESCRIPT
# ==========================================
create_cv(
    filename="2_CV_Frontend_Angular_Sarah.pdf",
    name="Sarah Mansour",
    title="Développeuse Frontend Angular / TypeScript (3 ans d'expérience)",
    email="sarah.mansour.tech@gmail.com",
    phone="+33 6 98 76 54 32",
    location="Lyon (69) - Télétravail / Hybride",
    summary=[
        "Développeuse frontend spécialisée sur l'écosystème moderne Angular (v16 à v20). Très attachée à la qualité",
        "du code, à l'accessibilité web et à l'ergonomie utilisateur (UI/UX). Expérimentée dans la mise en œuvre de",
        "composants autonomes (Standalone Components), gestion d'état avec RxJS et intégration soignée de maquettes Figma."
    ],
    skills_dict={
        "Langages & Web": "TypeScript, JavaScript ES6+, HTML5, CSS3, SCSS",
        "Frameworks & Libs": "Angular 18+, Standalone Components, RxJS, NgRx, Angular Material, Bootstrap 5",
        "Tests & Outils": "Jest, Cypress, Karma, Jasmine, Figma, npm, Vite, Angular CLI",
        "Méthodologie": "Agile Scrum, Code Review, Responsive Web Design, Clean Code"
    },
    experiences=[
        {
            "role": "Développeuse Frontend Angular",
            "company": "Sopra Steria",
            "date": "2024 - Présent (2 ans)",
            "tasks": [
                "Refonte d'un portail RH d'entreprise en Angular avec architecture modulaire et Standalone Components.",
                "Intégration d'un tableau Kanban interactif et de formulaires dynamiques validés réactivement.",
                "Consommation des API REST Spring Boot avec intercepteurs HTTP pour l'injection du token JWT.",
                "Optimisation du chargement et du rendu (Lazy Loading, OnPush change detection strategy)."
            ]
        },
        {
            "role": "Développeuse Web Frontend",
            "company": "Agence Digitale Wave",
            "date": "2023 - 2024 (1 an)",
            "tasks": [
                "Création d'interfaces web responsives à partir de maquettes Figma sous Angular et Bootstrap 5.",
                "Maintenance d'applications web monopages (SPA) et développement de composants réutilisables.",
                "Tests unitaires des services et composants sous Jasmine/Karma."
            ]
        }
    ],
    education=[
        {
            "degree": "Diplôme d'Ingénieur en Informatique",
            "school": "INSA Lyon",
            "date": "2021 - 2023"
        },
        {
            "degree": "DUT Informatique",
            "school": "IUT Lyon 1",
            "date": "2019 - 2021"
        }
    ]
)

# ==========================================
# 3. CV DATA SCIENCE / IA / NLP
# ==========================================
create_cv(
    filename="3_CV_Data_Science_IA_Youssef.pdf",
    name="Youssef Trabelsi",
    title="Data Scientist & Ingénieur Intelligence Artificielle (NLP / LLM)",
    email="youssef.trabelsi.ai@gmail.com",
    phone="+33 6 45 67 89 01",
    location="Paris / Marseille - Télétravail accepté",
    summary=[
        "Data Scientist passionné par le traitement automatique du langage naturel (NLP) et les modèles de langage (LLMs).",
        "Solide expérience dans l'analyse de données non structurées (CVs, textes), l'extraction d'entités nommées et",
        "le calcul de similarité sémantique. Maîtrise des API d'IA générative (Cohere, OpenAI) et déploiement de modèles en production."
    ],
    skills_dict={
        "Langages & Data": "Python 3, SQL, Pandas, NumPy, Scikit-learn, PyTorch, TensorFlow",
        "IA & NLP": "Cohere API (Embeddings & Chat), HuggingFace Transformers, LangChain, RAG, SpaCy",
        "Déploiement & Cloud": "FastAPI, Flask, Docker, MLflow, AWS S3, Google Cloud Platform",
        "Bases vectorielles": "Qdrant, Pinecone, ChromaDB, PostgreSQL (pgvector)"
    },
    experiences=[
        {
            "role": "Ingénieur IA & Data Scientist",
            "company": "HR Tech Solutions",
            "date": "2024 - Présent (2 ans)",
            "tasks": [
                "Conception d'un moteur de matching sémantique CV/Offres basé sur les embeddings de Cohere.",
                "Développement d'un pipeline d'extraction de compétences et de scoring multicritère automatisé.",
                "Exposition des modèles d'inférence via des microservices FastAPI conteneurisés sous Docker.",
                "Évaluation de la précision et réduction du biais algorithmique dans les recommandations de recrutement."
            ]
        },
        {
            "role": "Data Analyst / Machine Learning Intern",
            "company": "DataPulse Lab",
            "date": "2023 - 2024 (1 an)",
            "tasks": [
                "Nettoyage et structuration de corpus textuels volumineux sous Python et Pandas.",
                "Entraînement de modèles de classification supervisée pour la catégorisation de profils candidats.",
                "Création de dashboards de visualisation de performance sous Streamlit et Matplotlib."
            ]
        }
    ],
    education=[
        {
            "degree": "Master en Intelligence Artificielle & Data Science",
            "school": "CentraleSupélec",
            "date": "2021 - 2023"
        },
        {
            "degree": "Licence Mathématiques & Informatique",
            "school": "Université Grenoble Alpes",
            "date": "2018 - 2021"
        }
    ]
)

print("\nTous les 3 CVs de test ont été générés avec succès dans le dossier :", os.path.abspath(output_dir))

