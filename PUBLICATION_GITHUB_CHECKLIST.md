# Publication GitHub — checklist de sécurité

## État actuel
origin	https://github.com/bargaouihaythem/FindYourJob.git (fetch)
origin	https://github.com/bargaouihaythem/FindYourJob.git (push)

## Fichiers potentiellement sensibles dans l’arbre courant
./JOB4YOU-frontend/node_modules/@fortawesome/fontawesome-free/svgs/solid/user-secret.svg

## Fichiers suivis correspondant aux motifs de credentials
[35mJOB4YOU-backend/DEPLOYMENT_GUIDE.md[m
[35mJOB4YOU-backend/README.md[m
[35mJOB4YOU-backend/src/main/java/com/recrutement/app/dto/LoginRequest.java[m
[35mJOB4YOU-backend/src/main/java/com/recrutement/app/entity/User.java[m
[35mJOB4YOU-backend/src/main/java/com/recrutement/app/security/services/UserPrinciple.java[m
[35mJOB4YOU-frontend/src/app/pages/register/register.ts[m
[35mJOB4YOU-frontend/src/app/pages/reset-password/reset-password.ts[m

## Fichiers historiques correspondant aux motifs de credentials

## Règles obligatoires avant push
1. Révoquer et renouveler tout secret historiquement exposé.
2. Vérifier l’historique Git, pas seulement le working tree.
3. Ne pas publier test-evidence/, logs, CV de test ni emails capturés.
4. Vérifier .gitignore et exécuter un scanner de secrets externe.
5. Faire relire le diff final et obtenir un accord explicite avant push.
