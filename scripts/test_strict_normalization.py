import fitz
import requests
import os

API_URL = "http://localhost:8080/api/matching/evaluate-gold-set"

def make_pdf(filename, text_lines):
    doc = fitz.open()
    page = doc.new_page()
    y = 50
    for line in text_lines:
        page.insert_text((50, y), line, fontsize=11)
        y += 25
    doc.save(filename)
    doc.close()

def test_api(pdf_path, job_offer_id):
    with open(pdf_path, "rb") as f:
        files = {"cv": (os.path.basename(pdf_path), f, "application/pdf")}
        data = {"jobOfferId": str(job_offer_id)}
        res = requests.post(API_URL, files=files, data=data)
        if res.status_code != 200:
            raise Exception(f"HTTP {res.status_code}: {res.text}")
        return res.json()

print("=" * 70)
print("TEST DES REGLES DE NORMALISATION STRICTE (REMARQUE 3)")
print("=" * 70)

# Cas 1 : Spring Cloud vs Spring Boot (Offre 115)
pdf1 = "temp_spring_cloud.pdf"
make_pdf(pdf1, [
    "CV EXPERT SPRING CLOUD ET MICROSERVICES",
    "Competences : Java 17, Spring Cloud, Netflix Eureka, Docker, PostgreSQL, Maven",
    "Experience : 4 ans sur architectures microservices distribuees avec Spring Cloud."
])
r1 = test_api(pdf1, 115)
print("\n[Test 1] Spring Cloud vs Spring Boot (Offre 115) :")
print(f"  - Matched : {r1.get('matchedSkills')}")
print(f"  - Missing : {r1.get('missingSkills')}")
matched1 = r1.get('matchedSkills', '').split(', ')
missing1 = r1.get('missingSkills', '').split(', ')
assert 'Spring Boot' in missing1, "Spring Boot doit etre manquant !"
assert 'Spring Boot' not in matched1, "Spring Boot ne doit pas matcher sur Spring Cloud !"
print("  SUCCES : Spring Cloud n'a PAS ete confondu avec Spring Boot.")

# Cas 2 : AngularJS vs Angular (Offre 121 requérant Angular)
pdf2 = "temp_angularjs.pdf"
make_pdf(pdf2, [
    "CV DEVELOPPEUR WEB ANGULARJS LEGACY",
    "Competences : AngularJS 1.6, JavaScript, HTML5, CSS3, Git",
    "Experience : 3 ans de maintenance sur portail applicatif legacy sous AngularJS."
])
r2 = test_api(pdf2, 121)
print("\n[Test 2] AngularJS vs Angular (Offre 121) :")
print(f"  - Matched : {r2.get('matchedSkills')}")
print(f"  - Missing : {r2.get('missingSkills')}")
matched2 = r2.get('matchedSkills', '').split(', ')
missing2 = r2.get('missingSkills', '').split(', ')
assert 'Angular' in missing2, "Angular doit etre manquant !"
assert 'Angular' not in matched2, "Angular ne doit pas matcher sur AngularJS !"
print("  SUCCES : AngularJS n'a PAS ete confondu avec Angular.")

# Cas 3 : JavaScript vs Java (Offre 115 requérant Java)
pdf3 = "temp_javascript_only.pdf"
make_pdf(pdf3, [
    "CV DEVELOPPEUR FRONTEND JAVASCRIPT",
    "Competences : JavaScript, TypeScript, React, HTML5, CSS3",
    "Experience : 3 ans sur interfaces web interactives."
])
r3 = test_api(pdf3, 115)
print("\n[Test 3] JavaScript vs Java (Offre 115) :")
print(f"  - Matched : {r3.get('matchedSkills')}")
print(f"  - Missing : {r3.get('missingSkills')}")
matched3 = r3.get('matchedSkills', '').split(', ')
missing3 = r3.get('missingSkills', '').split(', ')
assert 'Java' in missing3, "Java doit etre manquant !"
assert 'Java' not in matched3, "Java ne doit pas matcher sur JavaScript !"
print("  SUCCES : JavaScript n'a PAS matche sur Java.")

# Nettoyage
for p in [pdf1, pdf2, pdf3]:
    if os.path.exists(p):
        os.remove(p)

print("\n" + "=" * 70)
print("TOUS LES TESTS DE NORMALISATION STRICTE ONT REUSSI SANS ERREUR !")
print("=" * 70)

