import fitz

doc = fitz.open()
page = doc.new_page()

text = """
HAYTHEM BARGAOUI
Ingénieur Développeur Full Stack Java Angular
Email: haythem.bargaoui@soprahr.com

COMPÉTENCES TECHNIQUES :
- Langages & Frameworks: Java 17, Spring Boot, Spring Security, Hibernate, JPA, Angular 20, TypeScript, HTML5, CSS3, SCSS
- Bases de données: PostgreSQL, MySQL
- Outils & DevOps: Git, Maven, Docker, n8n, Postman, Swagger
- Intelligence Artificielle: Intégration API Cohere, NLP, scoring automatique

EXPÉRIENCES PROFESSIONNELLES :
Stage de Fin d'Études - Sopra HR Software (Février 2026 - Août 2026) :
- Conception et développement de la plateforme de recrutement JOB4YOU
- Implémentation d'une architecture découplée Spring Boot / Angular
- Scoring automatique des candidatures via l'API Cohere
- Intégration de webhooks n8n et synchronisation Google Meet

FORMATION :
Diplôme National d'Ingénieur en Informatique - Université SESAME (2025-2026)
"""

page.insert_text((50, 72), text, fontsize=11)
doc.save("sample_cv_test.pdf")
doc.close()
print("Created sample_cv_test.pdf successfully")

