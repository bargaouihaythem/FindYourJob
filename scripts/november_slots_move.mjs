/**
 * JOB4YOU — Deplacement des trois creneaux de novembre hors des dossiers du rejeu.
 *
 * Les trois entretiens poses pour filmer l'agenda du manager (figure de realisation) portent
 * sur les dossiers #167, #168 et #174, crees par le rejeu du Gold Set et voues a la purge :
 * supprimer les dossiers emporterait l'agenda de novembre. On les re-ancre donc sur trois
 * dossiers stables de la base de demonstration, choisis parce que l'aiguillage du dossier
 * designe bien manager.devops — la garde « un entretien ne se pose que sur un destinataire »
 * refuserait n'importe quelle autre destination.
 *
 * Usage :
 *   node scripts/november_slots_move.mjs            # deplace et verifie
 *   node scripts/november_slots_move.mjs --rollback # remet sur les dossiers d'origine
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
const SNAPSHOT = path.join(ROOT, 'gold_set', 'november_slots.json');
const ROLLBACK = process.argv.slice(2).includes('--rollback');

// entretien -> dossier d'accueil (ACCEPTED, aucun creneau deja pose, aiguille vers manager.devops)
const PLAN = [
  { interviewId: 66, vers: 24 },
  { interviewId: 67, vers: 33 },
  { interviewId: 68, vers: 51 },
];

async function call(pathname, token, init) {
  const r = await fetch(API + pathname, {
    ...(init || {}),
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      ...((init && init.headers) || {}) },
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { /* texte */ }
  return { status: r.status, json, text };
}

const rh = await signinCached(API, RH_USER, PW);

if (ROLLBACK) {
  if (!fs.existsSync(SNAPSHOT)) { console.error('aucun ' + SNAPSHOT + ' : rien a rollbacker'); process.exit(1); }
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  let ok = 0, ko = 0;
  for (const s of snap.mouvements) {
    const dans = await call('/interviews/' + s.interviewId, rh);
    if (!dans.json) { ko++; continue; }
    const corps = { interviewDate: dans.json.interviewDate, type: dans.json.type,
      status: dans.json.status, notes: dans.json.notes, durationMinutes: dans.json.durationMinutes,
      location: dans.json.location, candidateId: s.candidateIdAvant, interviewerId: s.interviewerIdAvant };
    const r = await call('/interviews/' + s.interviewId, rh, { method: 'PUT', body: JSON.stringify(corps) });
    if (r.status === 200) { ok++; console.log('  #' + s.interviewId + ' remis sur le dossier ' + s.candidateIdAvant); }
    else { ko++; console.log('  ECHEC #' + s.interviewId + ' : HTTP ' + r.status + ' ' + r.text.slice(0, 160)); }
  }
  console.log('rollback : ' + ok + ' creneau(s) remis, ' + ko + ' echec(s) — les dossiers d origine'
    + ' doivent exister');
  process.exit(ko === 0 ? 0 : 1);
}

const mouvements = [];
for (const p of PLAN) {
  const dans = await call('/interviews/' + p.interviewId, rh);
  if (!dans.json) { console.error('entretien #' + p.interviewId + ' illisible (HTTP ' + dans.status + ')'); process.exit(1); }
  const avant = dans.json;
  const cible = await call('/candidates/' + p.vers, rh);
  if (!cible.json) { console.error('dossier #' + p.vers + ' illisible'); process.exit(1); }
  if (avant.candidateId === p.vers) {
    console.log('  #' + p.interviewId + ' deja sur le dossier #' + p.vers + ' — rien a faire');
    mouvements.push({ interviewId: p.interviewId, candidateIdAvant: avant.candidateId,
      interviewerIdAvant: avant.interviewerId, vers: p.vers, deja: true });
    continue;
  }
  const corps = { interviewDate: avant.interviewDate, type: avant.type, status: avant.status,
    notes: avant.notes, durationMinutes: avant.durationMinutes, location: avant.location,
    candidateId: p.vers, interviewerId: avant.interviewerId };
  const r = await call('/interviews/' + p.interviewId, rh, { method: 'PUT', body: JSON.stringify(corps) });
  const ok = r.status === 200 && r.json && r.json.candidateId === p.vers;
  console.log('  #' + p.interviewId + ' : ' + avant.candidateName + ' (dossier ' + avant.candidateId
    + ') -> ' + cible.json.firstName + ' ' + cible.json.lastName + ' (dossier ' + p.vers + ') — HTTP '
    + r.status + (ok ? ' OK' : ' ECHEC ' + r.text.slice(0, 200)));
  if (!ok) process.exit(1);
  mouvements.push({ interviewId: p.interviewId, candidateIdAvant: avant.candidateId,
    interviewerIdAvant: avant.interviewerId, vers: p.vers });
}

fs.writeFileSync(SNAPSHOT, JSON.stringify({ fait_le: new Date().toISOString(),
  note: 'creneaux de novembre re-ancre hors des dossiers du rejeu — rollback : --rollback', mouvements },
  null, 2));

// L'agenda du manager se relit par ses yeux : la garde rend visible, une reponse 201 seule ne
// prouverait rien.
const mgr = await signinCached(API, process.env.DEMO_MANAGER || 'manager.devops', PW);
const cal = await call('/interviews/my-calendar?startDate=2026-11-01T00:00:00&endDate=2026-11-30T23:59:59', mgr);
const lignes = Array.isArray(cal.json) ? cal.json : (cal.json && cal.json.content) || [];
console.log('agenda novembre relu avec le compte ' + (process.env.DEMO_MANAGER || 'manager.devops')
  + ' : ' + lignes.length + ' creneau(x)');
for (const l of lignes) console.log('  ' + l.interviewDate + ' — ' + l.candidateName + ' (dossier '
  + l.candidateId + ') — ' + l.status);
if (lignes.length < PLAN.length) {
  console.error('ATTENTION : ' + lignes.length + ' creneau(s) visibles, attendu ' + PLAN.length);
  process.exit(1);
}
