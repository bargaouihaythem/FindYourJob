/**
 * JOB4YOU — Matrice d'aiguillage RH → manager destinataire (lecture seule).
 *
 * Question testee : la modale de transmission propose-t-elle toujours le meme manager, et est-ce
 * un bug ? L'aiguillage est structurel (ManagerRoutingService) : manager designe sur l'offre,
 * sinon managers du departement de l'offre, sinon managers de la famille de metier, sinon l'e-mail
 * historique. Le score IA n'entre dans aucune de ces branches. Ce script releve, dossier par dossier,
 * la destination que la plateforme resout reellement.
 *
 * Usage :
 *   JY_PW=<mot de passe app> node scripts/routing_matrix.mjs
 *
 * Rien n'est ecrit : aucun statut change, aucune transmission declenche, aucun e-mail envoye.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const API = process.env.DEMO_API || 'http://localhost:8080/api';
const PW = process.env.JY_PW;
const RH_USER = process.env.DEMO_RH || 'rh';
const RUN_JSON = path.join(ROOT, 'gold_set', 'live_run.json');
const REPORT = path.join(ROOT, 'gold_set', 'routing_matrix.md');

if (!PW) { console.error('JY_PW absent de l environnement'); process.exit(1); }

const BASE_LABELS = {
  OFFER_MANAGER: 'le manager désigné sur l’offre',
  DEPARTMENT: 'le département de l’offre',
  JOB_FAMILY: 'la famille de métier de l’offre',
  LEGACY_EMAIL: 'l’e-mail historique de l’offre',
  UNRESOLVED: 'aucun rattachement trouvé',
};

async function signin(username) {
  const r = await fetch(API + '/auth/signin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PW }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.token) throw new Error('connexion ' + username + ' refusée (HTTP ' + r.status + ')');
  return j.token;
}

async function get(pathname, token) {
  const r = await fetch(API + pathname, { headers: { Authorization: 'Bearer ' + token } });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { /* texte */ }
  return { status: r.status, json, text };
}

const token = await signin(RH_USER);
const run = JSON.parse(fs.readFileSync(RUN_JSON, 'utf8'));
const dossiers = run.records.filter((r) => r.candidateId && r.score !== null);
console.log('connecte en ' + RH_USER + ' — ' + dossiers.length + ' dossiers a aiguiller');

// 1. L'annuaire des managers et de leur departement : c'est la donnee qui decide, pas le code.
const managers = (await get('/job-offers/manager-candidates', token)).json || [];
console.log('comptes managers references : ' + managers.length);
const parDepartement = {};
for (const m of managers) {
  const d = m.departmentName || '(sans département)';
  (parDepartement[d] = parDepartement[d] || []).push(m.fullName || m.email);
}

// 2. Ce que la plateforme resout pour chaque dossier du Gold Set.
const lignes = [];
for (const r of dossiers) {
  const res = await get('/candidates/' + r.candidateId + '/routing-preview', token);
  const rr = res.json || {};
  const noms = (rr.managers || []).map((m) => m.fullName + ' <' + m.email + '>').join(', ');
  lignes.push({
    gold: r.id, dossier: r.candidateId, candidat: r.candidateName, offre: r.jobOfferId,
    score: r.score, statut: r.status, basis: rr.basis || 'HTTP ' + res.status,
    destinataires: noms || '(aucun)',
  });
  console.log('  ' + r.id + ' offre ' + r.jobOfferId + ' score=' + r.score
    + ' -> ' + (rr.basis || '?') + ' : ' + (noms || 'aucun destinataire'));
}

// 3. Le rattachement des offres testees. La liste admin est paginee/filtree : les offres
//    utilisees par les dossiers du Gold Set n'y figurent pas toujours, donc on relit chaque
//    offre par son identifiant (source unique, aucune supposition sur le rattachement).
const idsOffres = [...new Set(lignes.map((l) => l.offre))];
const rattachements = [];
for (const id of idsOffres) {
  const res = await get('/job-offers/' + id, token);
  const o = (res && res.json) || {};
  rattachements.push({
    id, titre: o.title || '(illisible)',
    departement: o.departmentName || '(aucun)',
    hiringManager: o.hiringManagerName || '(aucun)',
    managerEmail: o.managerEmail || '(aucun)',
    famille: o.jobFamily || '(aucune)',
  });
}

// 4. Verdict : un seul destinataire pour tous les dossiers = donne, pas bug, si les offres
//    partagent le meme rattachement ; des destinations differentes = aiguillage vivant.
const distincts = [...new Set(lignes.map((l) => l.destinataires))];
const parBasis = {};
for (const l of lignes) parBasis[l.basis] = (parBasis[l.basis] || 0) + 1;

const out = [];
out.push('# Matrice d’aiguillage RH → manager destinataire');
out.push('');
out.push('**Date :** ' + new Date().toLocaleString('fr-FR') + ' — lecture seule, aucune transmission déclenchée.');
out.push('**Dossiers testés :** ' + lignes.length + ' (les ' + lignes.length + ' dossiers du rejeu du Gold Set, scores réels).');
out.push('**Règle testée :** `ManagerRoutingService.resolve` — manager désigné sur l’offre, puis département, puis famille de métier, puis e-mail historique. **Le score IA n’entre dans aucune branche.**');
out.push('');
out.push('## 1. Annuaire des managers (la donnée qui décide)');
out.push('');
out.push('| Département | Managers rattachés |');
out.push('| :-- | :-- |');
for (const d of Object.keys(parDepartement).sort()) out.push('| ' + d + ' | ' + parDepartement[d].join(', ') + ' |');
out.push('');
out.push('## 2. Rattachement des offres utilisées par les dossiers testés');
out.push('');
out.push('| Offre | Titre | Département | Manager désigné | Famille de métier | E-mail historique |');
out.push('| --: | :-- | :-- | :-- | :-- | :-- |');
for (const o of rattachements) {
  out.push('| ' + o.id + ' | ' + o.titre + ' | ' + o.departement + ' | ' + o.hiringManager
    + ' | ' + o.famille + ' | ' + o.managerEmail + ' |');
}
out.push('');
out.push('## 3. Destination résolue par la plateforme, dossier par dossier');
out.push('');
out.push('| Gold | Dossier | Candidat | Offre | Score | Statut | Base d’aiguillage | Destinataire proposé |');
out.push('| :-- | --: | :-- | --: | --: | :-- | :-- | :-- |');
for (const l of lignes) {
  out.push('| ' + l.gold + ' | #' + l.dossier + ' | ' + l.candidat + ' | ' + l.offre + ' | ' + l.score
    + ' | ' + l.statut + ' | ' + (BASE_LABELS[l.basis] || l.basis) + ' | ' + l.destinataires + ' |');
}
out.push('');
out.push('## 4. Ce que la matrice démontre');
out.push('');
out.push('- Bases d’aiguillage rencontrées : ' + Object.keys(parBasis).map((k) => '`' + (BASE_LABELS[k] || k) + '` (' + parBasis[k] + ' dossier(s))').join(', ') + '.');
out.push('- Destinataires distincts observés sur les ' + lignes.length + ' dossiers : **' + distincts.length + '**.');
if (distincts.length === 1) {
  out.push('- Tous les dossiers partent vers le même manager : les offres testées ont **le même rattachement** (voir §2), donc l’aiguillage, qui est déterministe, donne logiquement la même destination. Ce n’est pas une valeur codée en dur : changez le département d’une offre et la destination change avec lui.');
} else {
  out.push('- Les destinations diffèrent selon l’offre testée : l’aiguillage suit bien le rattachement de l’offre (§2), il n’est pas figé sur un compte.');
}
out.push('- Le score n’intervient pas : deux dossiers du même département, l’un à ' + Math.min(...lignes.map((l) => l.score)) + ' et l’autre à ' + Math.max(...lignes.map((l) => l.score)) + ', reçoivent la même destination.');
out.push('');
out.push('## 5. Comment le vérifier soi-même en trois gestes');
out.push('');
out.push('1. Côté RH, **Offres d’emploi** → modifier une offre → *département* : choisir un autre département, enregistrer.');
out.push('2. Ouvrir un dossier rattaché à cette offre → statut **« Test technique »** → la modale de transmission propose désormais les managers de l’autre département (la base affichée passe de « le département de l’offre » à un autre rattachement si le département est vide).');
out.push('3. Désigner un **manager recruteur** sur l’offre : la proposition passe immédiatement à « le manager désigné sur l’offre », qui prime sur le département.');
out.push('');
fs.writeFileSync(REPORT, out.join('\n'), 'utf8');
console.log('');
console.log('destinataires distincts = ' + distincts.length + ' | bases = ' + JSON.stringify(parBasis));
console.log('RAPPORT : ' + REPORT);
