import os
import shutil

target_dir = r"C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\cv +user"
os.makedirs(target_dir, exist_ok=True)

source_cv_dir = "cv_tests"
cv_files = [
    "1_CV_Backend_Java_Spring_Thomas.pdf",
    "2_CV_Frontend_Angular_Sarah.pdf",
    "3_CV_Data_Science_IA_Youssef.pdf"
]

for f in cv_files:
    src = os.path.join(source_cv_dir, f)
    dst = os.path.join(target_dir, f)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"Copié : {f} -> {dst}")

# Fichier récapitulatif des utilisateurs de test
users_info = """================================================================================
           JOB4YOU - COMPTES DE TEST & CVs PROFESSIONNELS
================================================================================

MOT DE PASSE COMMUN POUR TOUS LES COMPTES : password123
URL DE CONNEXION : http://localhost:4200/login
API BACKEND      : http://localhost:8080 (Swagger: http://localhost:8080/swagger-ui.html)
WORKFLOWS n8n    : http://localhost:5678 (Login: bargaouihaythem1@gmail.com / haythem123)

--------------------------------------------------------------------------------
1. LISTE DES UTILISATEURS DE TEST PAR RÔLE & DÉPARTEMENT
--------------------------------------------------------------------------------

1. ADMINISTRATEUR (Supervision globale, gestion rôles, pondérations IA, audit)
   • Username   : admin
   • Email      : admin@job4you.com
   • Rôles      : ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_USER
   • Périmètre  : Global (Tous les départements)

2. RESPONSABLE RH (Gestion des offres, pré-qualification téléphonique, Kanban)
   • Username   : rh
   • Email      : rh@job4you.com
   • Rôle       : ROLE_HR
   • Département: HRAccess

3. CANDIDAT (Recherche d'offres, postuler, Job idéal, chatbot candidat)
   • Username   : candidat
   • Email      : candidat@job4you.com
   • Rôle       : ROLE_USER

4. MANAGER RECHERCHE & DÉVELOPPEMENT (R&D)
   • Username   : manager.rd
   • Email      : manager.rd@job4you.com
   • Rôle       : ROLE_MANAGER
   • Département: Recherche & Développement (Code: R&D)
   • Famille    : RSD

5. MANAGER DEVOPS
   • Username   : manager.devops
   • Email      : manager.devops@job4you.com
   • Rôle       : ROLE_MANAGER
   • Département: DevOps (Code: DEVOPS)
   • Famille    : OTHER

6. MANAGER QUALITY ASSURANCE (QA)
   • Username   : manager.qa
   • Email      : manager.qa@job4you.com
   • Rôle       : ROLE_MANAGER
   • Département: Quality Assurance (Code: QA)
   • Famille    : RSD

7. MANAGER PRODUCT OPERATIONS (ProdOps)
   • Username   : manager.prodops
   • Email      : manager.prodops@job4you.com
   • Rôle       : ROLE_MANAGER
   • Département: ProdOps (Code: PRODOPS)
   • Famille    : PRODOPS

8. MANAGER CONSULTING SERVICES (CS)
   • Username   : manager.cs
   • Email      : manager.cs@job4you.com
   • Rôle       : ROLE_MANAGER
   • Département: Consulting Services (Code: CS)
   • Famille    : CS

--------------------------------------------------------------------------------
2. CVS DE TEST DISPONIBLES DANS CE DOSSIER
--------------------------------------------------------------------------------

• 1_CV_Backend_Java_Spring_Thomas.pdf
  - Candidat : Thomas Lefebvre (3 ans d'expérience)
  - Profil   : Backend Java 17, Spring Boot 3, Spring Security, PostgreSQL, Docker
  - Cibles   : Développeur Backend Java/Spring, DevOps Engineer (Score IA ~85-90%)

• 2_CV_Frontend_Angular_Sarah.pdf
  - Candidat : Sarah Mansour (3 ans d'expérience)
  - Profil   : Frontend Angular 18+, TypeScript, RxJS, SCSS, Standalone Components
  - Cibles   : Développeur Frontend React/Angular, Tech Lead (Score IA ~90%)

• 3_CV_Data_Science_IA_Youssef.pdf
  - Candidat : Youssef Trabelsi (2 ans d'expérience)
  - Profil   : Data Science, NLP, LLM, Python, Cohere API, PyTorch, Pandas
  - Cibles   : Data Scientist, Ingénieur IA (Score IA ~85%)

================================================================================
"""

txt_path = os.path.join(target_dir, "utilisateurs_et_comptes_test.txt")
with open(txt_path, "w", encoding="utf-8") as f:
    f.write(users_info)

print(f"Fichier créé : {txt_path}")

