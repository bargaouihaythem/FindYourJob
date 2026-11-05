# Garde « une personne, un poste » — règles, tests et données

Contrôlé le 05-11-2026 sur la pile locale (backend 8080, base `job4you_db`), par
`node scripts/guards_check.mjs` (transcript brut : `gold_set/guards_check_run.txt`).

## 1. Les trois règles écrites dans l'application

| # | Règle | Point d'entrée | Message affiché |
|---|-------|----------------|-----------------|
| 1 | Une personne n'occupe qu'un seul poste | `CandidateService.assertNotAlreadyHired`, appelé par la validation finale RH (`PATCH /api/candidates/{id}/final-validation`, décision `HIRED`) | « Cette personne est déjà embauchée sur l'offre « … » (dossier #…). Une personne ne peut occuper qu'un seul poste : clôturez d'abord ce dossier, ou validez celui-ci par un refus. » |
| 2 | Une personne en poste ne redépose pas de candidature | `CandidateService.assertNotAlreadyHiredForApplication`, appelé en tête de `submitApplication` (`POST /api/candidates/apply`) | « Vous êtes déjà embauché sur l'offre « … » (dossier #…). Une personne en poste ne dépose pas de nouvelle candidature : contactez le RH si vous souhaitez changer de poste. » |
| 3 | Un entretien n'est posé que sur un manager destinataire du dossier | `InterviewService.assertInterviewerPeutSuivreLeDossier`, appelé à la planification et au changement d'affectation (`POST` / `PUT /api/interviews`) | « … n'est pas destinataire de ce dossier : cet entretien n'apparaîtrait jamais dans son agenda. Intervieweurs possibles : … » |

**Clé d'identité** (règles 1 et 2) : adresse **et** prénom nom, comparés sans tenir compte de la
casse. L'e-mail seul aurait suffi sur une base propre ; ici trois dossiers embauchés portent la
même adresse de test sous trois noms différents, et le refus se serait déclenché sur des
personnes distinctes.

**Règle 3, périmètre exact** : elle ne vise que les comptes *purement* manager
(`AccessControlService.isPureManagerAccount`). Un RH, un Tech Lead ou un développeur senior
restent des intervieweurs possibles, sur n'importe quel dossier. Une affectation **inchangée**
n'est pas recontrôlée : une ligne ancienne posée sur un couple hérité reste reprogrammable et
annulable.

## 2. Ce que la garde 3 corrige

Un entretien affecté à un manager non destinataire était créé (HTTP 201) mais ne s'ouvrait
**jamais** dans son agenda : `getManagerCalendar` filtre sur l'intervieweur *et* sur la visibilité
du dossier. Le RH voyait la planification réussie, le manager voyait un mois vide — c'est
exactement ce que la capture du calendrier de novembre avait montré.

## 3. Résultats de la série

```
dossiers : 101 — embauches : 12
personnes embauchees deux fois (meme e-mail ET meme nom) : 0
boites partageant l adresse avec des noms differents (jeux de test) : 0

Test 1  temoin #155 aligne sur « testbargaoui testbargaoui » (embauche #138)
        embauche croisee refusée           HTTP 400  OK
        statut du temoin inchange          ACCEPTED  OK
        nom du temoin restitue             OK
Test 2  repostulation sur l'offre 136      HTTP 400  OK
        aucun dossier ajouté               12 lus    OK
Test 3  entretien sur manager.cs (non destinataire)  HTTP 400  OK
        entretien sur manager.devops (destinataire)  HTTP 201  OK
        replanification du même couple                HTTP 200  OK
        rollback : entretien supprimé
bilan : 3/3 refus comme attendu
```

Le test 1 fabrique son propre cas (deux dossiers d'une même boîte, un seul en statut
embauchable) : il aligne le nom du témoin sur celui de la personne déjà embauchée, tente
l'embauche, puis restitue le nom et vérifie le statut. Aucune écriture ne survit à la série.

## 4. Décision sur les données de démonstration

`candidat@email.com` portait trois `HIRED` (#138 offre 1, #153 offre 139, #154 offre 142) sous
trois noms différents. Deux lectures étaient possibles : une seule personne embauchée trois
fois, ou trois personnes partageant une boîte de test. Les noms lèvent le doute — ce sont trois
personnes, et `HIRED` est un état terminal : la machine à états interdit d'en sortir, ces
embauches ne pouvaient donc pas être refusées après coup (`#153` et `#154` étaient
imrefermables par l'API).

La correction porte donc sur l'identité, pas sur le statut :

- `#153` → `testsshyatheemmmmmm@example.com`
- `#154` → `testrefushaythem@example.com`
- `#138` reste sur `candidat@email.com`, la boîte du compte `candidat` utilisé pour la
  démonstration.

« Mes candidatures » du compte de test montre désormais **une** embauche. Aucun e-mail envoyé,
aucun statut touché, les entretiens et scores restent rattachés à leur dossier.

- Application : `node scripts/coherence_mailbox.mjs` (fait, instantané écrit)
- Retour en arrière : `node scripts/coherence_mailbox.mjs --rollback`
- `example.com` est le domaine réservé par la RFC 2606 pour les exemples : rien n'y est jamais distribué.

## 5. Exception connue, laissée en place

Entretien **#9** (dossier #9 Hichem Jlassi, offre 123, `2026-04-28`, dossier `WITHDRAWN`) est
affecté à `manager.prodops` alors que l'aiguillage (base `JOB_FAMILY`) désigne
`manager.devops`. Daté d'avril sur un dossier retiré, il n'apparaît dans aucun agenda utile ;
le réaffecter ferait resurgir un événement passé dans le calendrier du DevOps. La garde 3 ne
recontrôle pas une affectation inchangée : cette ligne reste modifiable et annulable.

30 entretiens en base, 20 avec un manager pur comme intervieweur, 1 hors destinataires (celui-ci).

## 6. Écran RH

Le sélecteur d'intervieweur de *Planifier un entretien* se restreint dès qu'un dossier est choisi
(`interviews.component.ts`, `destinatairesEmails` + `eligibleInterviewers`) : les managers hors
destinataires ne sont plus proposés, et une note le dit. Aucun contrôle désactivé sans
explication — la liste est la règle, pas un bouton grisé.

## 7. Portée de la borne de connexion (fait de plateau, pas un défaut de garde)

`POST /api/auth/signin` est limité à **10 connexions par compte et par 15 minutes**
(`AuthController.java:67`, borne anti-brute-force en mémoire). Une série de scripts qui se
reconnecte à chaque passage franchit cette borne et renvoie HTTP 429 « Trop de tentatives » —
un échec sans rapport avec la règle testée. Le jeton JWT étant valable 24 h, les scripts passent
par `scripts/session_cache.mjs` (`signinCached`) : il est relit depuis `%TEMP%
job4you_scripts_tokens.json` et la connexion n'est redemandée que s'il reste moins d'une minute
de validité, ou après un HTTP 401.

Preuve : `JY_PW=cache_sert_seul node scripts/guards_check.mjs` (mot de passe volontairement
faux) termine sur « bilan : 3/3 refus comme attendu » - donc aucune connexion n'a été tentée,
la suite a travaillé uniquement sur le jeton en cache. Trois passes vertes consécutives, une
seule connexion réelle.
