/**
 * JOB4YOU — Le Gold Set dans l'application : depot du corpus, rejeu et mesure du seuil.
 *
 * Trois etapes, commandees ici, pilotees depuis l'ecran RH :
 *   1. --seed    : poste les 20 CV de gold_set/cvs avec leur verite terrain (origin=REFERENCE)
 *   2. --run     : rejoue chaque cas dans le circuit de decision (computeScore, sans dossier
 *                  candidat) et balaye l'axe des seuils, globalement puis par profil
 *   3. --apply   : applique le seuil recommande sur un profil, sous le garde de qualite F1
 *
 * Usage :
 *   JY_PW=<mot de passe app> node scripts/gold_set_calibrate.mjs --seed
 *   JY_PW=<mot de passe app> node scripts/gold_set_calibrate.mjs --run
 *   JY_PW=<mot de passe app> node scripts/gold_set_calibrate.mjs --apply CS/MID 65
 *   node scripts/gold_set_calibrate.mjs --report        # relit la mesure sans rappeler l'IA
 *
 * Le mot de passe vient de l'environnement uniquement : jamais d'argument, jamais de fichier.
 * Les seuils appliques sont journalises cote serveur (SCORING_PROFILE) et annulables par
 * DELETE /api/gold-set/profiles/{famille}/{niveau}/threshold.
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
const GROUND = path.join(ROOT, 'gold_set', 'ground_truth.json');
const CVS = path.join(ROOT, 'gold_set', 'cvs');
const OUT_JSON = path.join(ROOT, 'gold_set', 'calibration_report.json');
const OUT_MD = path.join(ROOT, 'gold_set', 'calibration_report.md');

const flags = process.argv.slice(2);
const SEED = flags.includes('--seed');
const RUN = flags.includes('--run');
const REPORT_ONLY = flags.includes('--report');
const APPLY_AT = flags.indexOf('--apply');
const APPLY_TARGET = APPLY_AT >= 0 ? flags[APPLY_AT + 1] : null;
const APPLY_VALUE = APPLY_AT >= 0 ? parseInt(flags[APPLY_AT + 2], 10) : NaN;

if (!PW && !REPORT_ONLY) {
  // Le jeton RH peut venir du cache de session (24 h) : sans JY_PW, un script ne peut que
  // relire une mesure deja prise ou utiliser un jeton encore valide.
  console.warn('JY_PW absent : poursuite avec le jeton en cache, le premier 401 sera la limite.');
}

async function call(pathname, init) {
  const token = await signinCached(API, RH_USER, PW);
  const r = await fetch(API + pathname, {
    ...(init || {}),
    headers: { Authorization: 'Bearer ' + token, ...((init && init.headers) || {}) },
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

function pct(v) { return v === null || v === undefined ? '—' : (v * 100).toFixed(1) + ' %'; }

async function seed() {
  const ground = JSON.parse(fs.readFileSync(GROUND, 'utf8'));
  let ok = 0;
  for (const item of ground) {
    const form = new FormData();
    const bytes = fs.readFileSync(path.join(CVS, item.filename));
    form.append('cv', new Blob([bytes], { type: 'application/pdf' }), item.filename);
    form.append('caseRef', item.id);
    form.append('candidateName', item.candidateName);
    form.append('jobOfferId', String(item.targetJobOfferId));
    form.append('groundTruth', item.groundTruthRelevance);
    form.append('borderline', String(item.filename.includes('Borderline')));
    form.append('origin', 'REFERENCE');
    const r = await call('/gold-set/cases', { method: 'POST', body: form });
    if (r.status >= 400) {
      console.error('  [KO] ' + item.id + ' HTTP ' + r.status + ' ' + (r.body.message || ''));
    } else {
      ok++;
      console.log('  [OK] ' + item.id + ' offre ' + item.targetJobOfferId
        + ' ' + item.groundTruthRelevance + ' texte=' + r.body.extractedTextLength + ' car.');
    }
  }
  console.log('Cas de reference en base : ' + ok + '/' + ground.length);
}

async function run(replay) {
  const r = replay
    ? await call('/gold-set/calibrate?replay=true', { method: 'POST' })
    : await call('/gold-set/report');
  if (r.status >= 400) {
    console.error('Mesure refusee (HTTP ' + r.status + ') : ' + (r.body.message || JSON.stringify(r.body)));
    process.exit(1);
  }
  const report = r.body;
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(OUT_MD, markdown(report), 'utf8');
  console.log(markdown(report));
  console.log('Rapport : ' + OUT_JSON);
  return report;
}

function markdown(report) {
  const lines = [];
  lines.push('# Calibration du Gold Set dans l\'application');
  lines.push('');
  lines.push('- Mesuré le : ' + report.evaluatedAt + ' · source des scores : ' + report.source);
  lines.push('- Lecture : un seuil n\'est proposé que si le noyau de référence du profil contient au moins 4 cas et que le F1 mesuré tient 90 %.');
  lines.push('');
  lines.push('| Profil | Cas (référence) | Pertinents | Frontier | Seuil appliqué | F1 au seuil appliqué | Seuil recommandé | F1 recommandé | Marge | VP/FP/FN/VT |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  const row = (p, label) => '| ' + label
    + ' | ' + p.caseCount + ' (' + p.referenceCount + ')'
    + ' | ' + p.pertinentCount
    + ' | ' + (p.scores.length ? p.scores[0] + '–' + p.scores[p.scores.length - 1] : '—')
    + ' | ' + p.appliedThreshold + (p.appliedIsCalibrated ? ' (calibré)' : ' (défaut)')
    + ' | ' + pct(p.f1AtAppliedThreshold)
    + ' | ' + p.recommendedThreshold
    + ' | ' + pct(p.f1)
    + ' | ' + p.recommendedMargin
    + ' | ' + p.appliedConfusion.truePositive + '/' + p.appliedConfusion.falsePositive
    + '/' + p.appliedConfusion.falseNegative + '/' + p.appliedConfusion.trueNegative + ' |';
  lines.push(row(report.global, 'Tous profils'));
  for (const p of report.byProfile) lines.push(row(p, p.jobFamily + ' / ' + p.seniorityLevel));
  lines.push('');
  lines.push('## Étiquette « Profil Gold » sur le corpus');
  lines.push('');
  lines.push('| Barre | Cas proposés | Dont hors cible | Références |');
  lines.push('| --- | --- | --- | --- |');
  for (const cut of [80, 85, 90]) {
    const g = report.goldTier['seuil_' + cut];
    lines.push('| ≥ ' + cut + ' | ' + g.proposes + ' | ' + g.abusifs + ' | ' + (g.references.join(', ') || '—') + ' |');
  }
  lines.push('');
  lines.push('Barre appliquée en production : ≥ ' + report.goldTier.barre_appliquee
    + ' (ou le seuil calibré du profil s\'il est plus haut), jamais sur un dossier marqué « à arbitrer ».');
  lines.push('');
  lines.push('## Détail par cas');
  lines.push('');
  lines.push('| Cas | Profil | Vérité terrain | Limite | Score | Décision au seuil appliqué |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const p of report.byProfile) {
    for (const c of p.cases) {
      const wrong = (c.score >= p.appliedThreshold) !== c.expected;
      lines.push('| ' + c.caseRef + ' | ' + p.jobFamily + '/' + p.seniorityLevel
        + ' | ' + c.groundTruth + ' | ' + (c.borderline ? 'oui' : 'non')
        + ' | ' + c.score + ' | ' + (c.score >= p.appliedThreshold ? 'retenu' : 'écarté')
        + (wrong ? ' **(erreur)**' : '') + ' |');
    }
  }
  return lines.join('\n');
}

async function apply() {
  if (!APPLY_TARGET || !/^[A-Z]+\/[A-Z]+$/.test(APPLY_TARGET) || Number.isNaN(APPLY_VALUE)) {
    console.error('Syntaxe : --apply CS/MID 65');
    process.exit(1);
  }
  const [famille, niveau] = APPLY_TARGET.split('/');
  const r = await call('/gold-set/profiles/' + famille + '/' + niveau + '/threshold?threshold=' + APPLY_VALUE,
    { method: 'PUT' });
  console.log('HTTP ' + r.status + ' — ' + (r.body.message || JSON.stringify(r.body)));
  if (r.status >= 400) process.exit(1);
}

if (SEED) await seed();
if (RUN) await run(true);
if (APPLY_AT >= 0) await apply();
if (REPORT_ONLY) await run(false);
if (!SEED && !RUN && !REPORT_ONLY && APPLY_AT < 0) {
  console.error('Rien à faire : --seed, --run, --report ou --apply FAMILLE/NIVEAU seuil');
  process.exit(1);
}
