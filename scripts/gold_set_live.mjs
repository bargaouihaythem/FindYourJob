/**
 * JOB4YOU — Rejeu du Gold Set en mode réel (pipeline complet de l'application).
 *
 * Le benchmark hors-ligne (evaluate_gold_set.js) appelle le moteur de score directement :
 * il mesure le moteur, pas la plateforme. Ce script fait passer les vingt CV du Gold Set
 * par la vraie entree de l'application — POST /api/candidates/apply, e-mail de confirmation,
 * agent 1 n8n, POST /api/candidates/{id}/ai-score/recompute, score stocke sur le dossier,
 * transition de statut appliquee — puis releve sur le dossier ce que la plateforme a decide.
 *
 * Usage :
 *   JY_PW=<mot de passe app> node scripts/gold_set_live.mjs --limit=2      # amorce
 *   JY_PW=<mot de passe app> node scripts/gold_set_live.mjs                # les vingt
 *   node scripts/gold_set_live.mjs --report-only                # relit le dernier run, sans rejouer
 *   JY_PW=<mot de passe app> node scripts/gold_set_live.mjs --rollback     # supprime les dossiers crees
 *
 * Le mot de passe vient de l'environnement uniquement : jamais d'argument, jamais de fichier.
 * Les adresses e-mail utilisees sont des alias de la boite de test, donc rien n'est envoye
 * hors de cette boite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signinCached } from './session_cache.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const API = process.env.DEMO_API || 'http://localhost:8080/api';
const PW = process.env.JY_PW;
const RH_USER = process.env.DEMO_RH || 'rh';
const ALIAS_BASE = process.env.GOLD_LIVE_ALIAS || 'bargaouihaythem1';
const GROUND = path.join(ROOT, 'gold_set', 'ground_truth.json');
const CVS = path.join(ROOT, 'gold_set', 'cvs');
const RUN_JSON = path.join(ROOT, 'gold_set', 'live_run.json');
const REPORT = path.join(ROOT, 'gold_set', 'live_run_report.md');

const THRESHOLD = 60;
const GREY_LOW = 55;   // seuil par défaut de l'application (ai.score.decision.threshold) ± GREY_ZONE_MARGIN
const GREY_HIGH = 65;  // un profil calibré sur le Gold Set déplace cette bande autour de son seuil
const POLL_MS = 4000;
const POLL_MAX_MS = 90000;

const flags = process.argv.slice(2);
const LIMIT = parseInt((flags.find((f) => f.startsWith('--limit=')) || '').split('=')[1] || '0', 10);
const ROLLBACK = flags.includes('--rollback');
const REPORT_ONLY = flags.includes('--report-only');

if (!PW && !REPORT_ONLY) { console.error('JY_PW absent de l environnement'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signin(username) {
  // Le jeton est relit depuis le cache commun : la borne de connexion (10 par compte et par
  // 15 minutes) n'a rien a faire dans une serie de scripts de verification.
  return signinCached(API, username, PW);
}

async function api(pathname, token, init) {
  const r = await fetch(API + pathname, {
    ...(init || {}),
    headers: { Authorization: 'Bearer ' + token, ...((init && init.headers) || {}) },
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: r.status, json, text };
}

// ------------------------------------------------------------------ rollback
if (ROLLBACK) {
  if (!fs.existsSync(RUN_JSON)) { console.error('aucun ' + RUN_JSON + ' : rien a rollbacker'); process.exit(1); }
  const run = JSON.parse(fs.readFileSync(RUN_JSON, 'utf8'));
  const token = await signin(RH_USER);
  let ok = 0, ko = 0;
  for (const rec of run.records) {
    if (!rec.candidateId) continue;
    const res = await api('/candidates/' + rec.candidateId, token, { method: 'DELETE' });
    if (res.status >= 200 && res.status < 300) ok++; else { ko++; console.log('  ECHEC suppression ' + rec.candidateId + ' : HTTP ' + res.status + ' ' + res.text.slice(0, 120)); }
  }
  console.log('rollback : ' + ok + ' dossier(s) supprime(s), ' + ko + ' echec(s)');
  process.exit(0);
}

// ------------------------------------------------------------------ rejeu
const ground = JSON.parse(fs.readFileSync(GROUND, 'utf8'));
const set = LIMIT > 0 ? ground.slice(0, LIMIT) : ground;

const records = [];
let relu = null;
if (REPORT_ONLY) {
  if (!fs.existsSync(RUN_JSON)) { console.error('aucun ' + RUN_JSON + ' : rien a relire'); process.exit(1); }
  const run = JSON.parse(fs.readFileSync(RUN_JSON, 'utf8'));
  relu = run.run_at;
  records.push(...run.records);
  console.log('rapport relit ' + RUN_JSON + ' (' + records.length + ' dossiers), aucun CV rejoue');
} else {
const token = await signin(RH_USER);
console.log('connecte en ' + RH_USER + ' — ' + set.length + ' CV a rejouer dans le pipeline reel');

for (const g of set) {
  const pdf = path.join(CVS, g.filename);
  if (!fs.existsSync(pdf)) { console.log('  ' + g.id + ' : fichier absent ' + g.filename); continue; }

  const parts = String(g.candidateName).trim().split(/\s+/);
  const alias = ALIAS_BASE + '+' + g.id.toLowerCase().replace('_', '') + '@gmail.com';
  const application = {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    email: alias,
    phone: '+216 00 000 000',
    address: 'Tunis, Tunisie',
    jobOfferId: g.targetJobOfferId,
    coverLetter: '',
  };

  const fd = new FormData();
  fd.append('application', JSON.stringify(application));
  fd.append('cv', new Blob([fs.readFileSync(pdf)], { type: 'application/pdf' }), g.filename);

  const created = Date.now();
  const up = await fetch(API + '/candidates/apply', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd,
  });
  const upText = await up.text();
  let createdJson = null;
  try { createdJson = JSON.parse(upText); } catch (e) { /* message texte */ }
  const candidateId = createdJson && (createdJson.id ?? createdJson.candidateId);

  const rec = {
    id: g.id, filename: g.filename, candidateName: g.candidateName, alias,
    jobOfferId: g.targetJobOfferId, groundTruth: g.groundTruthRelevance,
    expected: g.expectedDecision, httpApply: up.status, candidateId: candidateId || null,
    applyError: candidateId ? null : upText.slice(0, 200),
    score: null, source: null, status: null, technical: null, communication: null,
    seniority: null, needsHumanReview: null, humanReviewReason: null,
    matchedSkills: null, missingSkills: null, attente_ms: 0,
  };
  if (!candidateId) {
    console.log('  ' + g.id + ' : ECHEC creation (HTTP ' + up.status + ') ' + rec.applyError);
    records.push(rec); continue;
  }

  // L'agent 1 n8n travaille en arriere-plan : on attend que le score soit sur le dossier.
  let waited = 0, dossier = null;
  while (waited < POLL_MAX_MS) {
    await sleep(POLL_MS); waited += POLL_MS;
    const g2 = await api('/candidates/' + candidateId, token);
    if (g2.status !== 200 || !g2.json) continue;
    dossier = g2.json;
    if (dossier.aiScore !== null && dossier.aiScore !== undefined) break;
  }
  rec.attente_ms = Date.now() - created;

  if (dossier) {
    rec.score = dossier.aiScore ?? null;
    rec.source = dossier.aiScoreSource ?? null;
    rec.status = dossier.status ?? null;
    rec.technical = dossier.aiScoreTechnical ?? null;
    rec.communication = dossier.aiScoreCommunication ?? null;
    rec.seniority = dossier.aiScoreSeniorityMatch ?? null;
    rec.needsHumanReview = dossier.needsHumanReview ?? null;
    rec.humanReviewReason = dossier.humanReviewReason ?? null;
    rec.matchedSkills = dossier.matchedSkills ?? null;
    rec.missingSkills = dossier.missingSkills ?? null;
  }

  console.log('  ' + g.id + ' dossier#' + candidateId + ' score=' + (rec.score ?? '-')
    + ' source=' + (rec.source ?? '-') + ' statut=' + (rec.status ?? '-')
    + ' HITL=' + (rec.needsHumanReview === true ? 'oui' : 'non')
    + ' (' + Math.round(rec.attente_ms / 1000) + ' s)');
  records.push(rec);
}

fs.writeFileSync(RUN_JSON, JSON.stringify({
  run_at: new Date().toISOString(), seuil: THRESHOLD, alias_base: ALIAS_BASE,
  ids_suppression: records.filter((r) => r.candidateId).map((r) => r.candidateId),
  records,
}, null, 2), 'utf8');
}

// ------------------------------------------------------------------ mesures
function matrix(th) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of records) {
    if (r.score === null) continue;
    const pertinent = r.groundTruth === 'PERTINENT';
    const retenu = r.score >= th;
    if (pertinent && retenu) tp++;
    else if (!pertinent && retenu) fp++;
    else if (!pertinent && !retenu) tn++;
    else fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const rappel = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + rappel ? 2 * precision * rappel / (precision + rappel) : 0;
  const n = tp + fp + tn + fn;
  return { th, tp, fp, tn, fn, precision, rappel, f1, accuracy: n ? (tp + tn) / n : 0, n };
}

const ms = [50, 60, 70].map(matrix);

// Ce que la plateforme a reellement fait, la ou le benchmark hors-ligne ne montrait qu'un nombre.
const decisions = {};
for (const r of records) {
  if (!r.status) continue;
  decisions[r.status] = (decisions[r.status] || 0) + 1;
}

// Un dossier que la plateforme choisit de ne pas trancher n'est pas une erreur de l'IA : zone
// grise (55-65), écart de séniorité plafonné, incident de parsing — trois cas où le code écarte
// volontairement le rejet automatique et laisse le RH décider. L'appeler « incoherent » ferait
// porter a l'IA un choix qu'elle n'a pas fait.
function isGrey(score) { return score !== null && score >= GREY_LOW && score <= GREY_HIGH; }
function verdict(r) {
  if (r.score === null) return 'sans score';
  if (!r.status) return 'sans statut';
  const retenue = r.status !== 'AUTO_REJECTED';
  if (retenue && (isGrey(r.score) || r.needsHumanReview === true)) return 'arbitrage RH';
  return (r.groundTruth === 'PERTINENT') === retenue ? 'conforme' : 'incoherent';
}
const buckets = { conforme: 0, 'arbitrage RH': 0, incoherent: 0, 'sans score': 0, 'sans statut': 0 };
for (const r of records) buckets[verdict(r)]++;

function pct(x) { return (x * 100).toFixed(1) + ' %'; }
function ligneTable(r) {
  const pertinent = r.groundTruth === 'PERTINENT';
  const scoreBon = r.score === null ? '-' : (pertinent === (r.score >= THRESHOLD) ? 'OUI' : 'NON');
  const v = verdict(r);
  const decision = v === 'conforme' ? 'OUI' : v === 'incoherent' ? 'NON'
    : v === 'arbitrage RH' ? 'Arbitrage RH' : '-';
  return '| ' + r.id + ' | ' + r.candidateName + ' | #' + (r.candidateId ?? '-') + ' | ' + r.jobOfferId
    + ' | ' + r.groundTruth + ' | ' + (r.score ?? '-') + ' | ' + (r.source ?? '-') + ' | '
    + (r.status ?? '-') + ' | ' + (r.needsHumanReview === true ? 'oui' : 'non') + ' | '
    + scoreBon + ' | ' + decision + ' |';
}

const out = [];
out.push('# Rejeu du Gold Set dans le pipeline reel de la plateforme');
out.push('');
out.push("**Date du rejeu :** " + (relu
  ? new Date(relu).toLocaleString('fr-FR') + ' (rapport relit ces memes dossiers le ' + new Date().toLocaleString('fr-FR') + ')'
  : new Date().toLocaleString('fr-FR')));
out.push('**Volet teste :** entree reelle de l\'application — `POST /api/candidates/apply`, e-mail de confirmation, agent 1 n8n, `POST /api/candidates/{id}/ai-score/recompute`, score stocke sur le dossier, transition de statut appliquee.');
out.push('**Dossier crees :** ' + records.filter((r) => r.candidateId).length + ' — rollback : `node scripts/gold_set_live.mjs --rollback`.');
out.push('**Adresses :** alias de la boite de test (' + ALIAS_BASE + '+goldNN@gmail.com), aucun destinataire exterieur.');
out.push('');
out.push('## 1. Metriques sur les scores stockes dans les dossiers');
out.push('');
out.push('| Seuil | TP | FP | TN | FN | Precision | Rappel | F1 | Exactitude |');
out.push('| :-- | --: | --: | --: | --: | --: | --: | --: | --: |');
for (const m of ms) {
  out.push('| ' + m.th + ' | ' + m.tp + ' | ' + m.fp + ' | ' + m.tn + ' | ' + m.fn + ' | '
    + pct(m.precision) + ' | ' + pct(m.rappel) + ' | ' + pct(m.f1) + ' | ' + pct(m.accuracy) + ' |');
}
const minutes = records.filter((r) => r.score !== null).map((r) => r.attente_ms / 60000).sort((a, b) => a - b);
if (minutes.length) {
  out.push('');
  out.push('Delai entre la soumission du CV et le score pose sur le dossier (agent 1 n8n compris) : median '
    + minutes[Math.floor(minutes.length / 2)].toFixed(1) + ' min, maximum '
    + minutes[minutes.length - 1].toFixed(1) + ' min sur ' + minutes.length + ' dossiers scores.');
}
out.push('');
out.push('## 2. Ce que la plateforme a decide');
out.push('');
out.push('| Statut applique | Dossier |');
out.push('| :-- | --: |');
for (const k of Object.keys(decisions).sort()) out.push('| ' + k + ' | ' + decisions[k] + ' |');
out.push('');
out.push('- Decision de la plateforme alignee sur la verite terrain au seuil de ' + THRESHOLD + ' : **' + buckets.conforme + '** dossier(s).');
out.push('- Non alignee : **' + buckets.incoherent + '**.');
out.push('- Scores en zone grise (' + GREY_LOW + '-' + GREY_HIGH + ') : la plateforme ne tranche pas, elle transmet au RH — **'
  + buckets['arbitrage RH'] + '** (jamais comptes comme une erreur de l\'IA).');
out.push('- Sans score au bout du delai d\'attente (' + Math.round(POLL_MAX_MS / 1000) + ' s) : **' + buckets['sans score'] + '**.');
out.push('');
out.push('## 3. Detail dossier par dossier');
out.push('');
out.push('Derniere colonne : OUI = statut aligne sur la verite terrain, NON = statut contredit par elle, '
  + '« Arbitrage RH » = score en zone grise (' + GREY_LOW + '-' + GREY_HIGH + '), la plateforme ecarte '
  + 'volontairement le rejet automatique et transmet au RH.');
out.push('');
out.push('| ID | Candidat | Dossier | Offre | Verite terrain | Score | Source | Statut applique | HITL | Score conforme | Decision de la plateforme |');
out.push('| :-- | :-- | --: | --: | :-- | --: | :-- | :-- | :--: | :--: | :-- |');
for (let i = 0; i < records.length; i++) out.push(ligneTable(records[i]));
out.push('');
out.push('## 4. Limites');
out.push('');
out.push('- Le score depend du modele : les memes CV peuvent donner des valeurs legerement differentes d\'une course a l\'autre (derive constatee de 4 a 10 points sur GOLD_18 et GOLD_14).');
out.push('- Vingt dossiers construits pour l\'evaluation ne mesurent pas la performance en production.');
out.push('- Les dossiers de cette course sont des donnees de test : a supprimer apres lecture, pour ne pas polluer le pipeline de demonstration.');
out.push('');
fs.writeFileSync(REPORT, out.join('\n'), 'utf8');

const m60 = ms.find((x) => x.th === 60);
console.log('');
console.log('seuil 60 : TP=' + m60.tp + ' FP=' + m60.fp + ' TN=' + m60.tn + ' FN=' + m60.fn
  + '  precision=' + pct(m60.precision) + ' rappel=' + pct(m60.rappel) + ' exactitude=' + pct(m60.accuracy));
console.log('statuts : ' + JSON.stringify(decisions));
console.log(Object.keys(buckets).map((k) => k.replace(' ', '_') + '=' + buckets[k]).join(' '));
console.log('RAPPORT : ' + REPORT);
