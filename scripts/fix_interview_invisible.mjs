/**
 * JOB4YOU — Reaffectation des entretiens poses sur un manager non destinataire.
 *
 * Regle 3 de gold_set/guards_check.md : depuis ce correctif, un entretien ne peut plus etre
 * pose sur un manager qui ne suit pas le dossier. Les lignes anterieures restent en base et
 * sont invisibles dans l'agenda vise ; ce script les remet dans le perimetre, une par une.
 *
 * Usage :
 *   JY_PW=<mot de passe app> node scripts/fix_interview_invisible.mjs            # etat des lieux
 *   JY_PW=<mot de passe app> node scripts/fix_interview_invisible.mjs --apply    # reaffecte
 *   JY_PW=<mot de passe app> node scripts/fix_interview_invisible.mjs --rollback # remet les ids d'origine
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const API = process.env.DEMO_API || 'http://localhost:8080/api';
const PW = process.env.JY_PW;
const RH_USER = process.env.DEMO_RH || 'rh';
const SNAPSHOT = path.join(ROOT, 'gold_set', 'interviews_reaffectees.json');

if (!PW) { console.error('JY_PW absent de l environnement'); process.exit(1); }
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ROLLBACK = args.includes('--rollback');

async function signin(username) {
  const r = await fetch(API + '/auth/signin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PW }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.token) throw new Error('connexion refusee (HTTP ' + r.status + ')');
  return j.token;
}

async function call(pathname, token, init) {
  const r = await fetch(API + pathname, { ...(init || {}),
    headers: { Authorization: 'Bearer ' + token, ...(init && init.headers) } });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { /* texte */ }
  return { status: r.status, json, text };
}

const msg = (res) => (res.json && res.json.message) || res.text.slice(0, 160);
const rh = await signin(RH_USER);

if (ROLLBACK) {
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  for (const a of snap) {
    const i = (await call('/interviews/' + a.id, rh)).json;
    const res = await call('/interviews/' + a.id, rh, { method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId: i.candidateId, interviewerId: a.interviewerIdAvant,
        interviewDate: i.interviewDate, type: i.type, status: i.status,
        durationMinutes: i.durationMinutes, location: i.location, notes: i.notes }) });
    console.log('  #' + a.id + ' -> intervieweur #' + a.interviewerIdAvant + ' : HTTP ' + res.status);
  }
  process.exit(0);
}

const liste = (await call('/interviews?page=0&size=500', rh)).json;
const tous = Array.isArray(liste) ? liste : (liste && liste.content) || [];
const intervieweurs = (await call('/interviews/interviewers', rh)).json || [];
const parEmail = new Map(intervieweurs.map((i) => [String(i.email).toLowerCase(), i]));

const hors = [];
for (const x of tous) {
  const qui = parEmail.get(String(x.interviewerEmail).toLowerCase());
  if (!qui || qui.role !== 'Manager') continue;
  const rp = await call('/candidates/' + x.candidateId + '/routing-preview', rh);
  const destinataires = ((rp.json && rp.json.managers) || [])
    .map((m) => String(m.email || '').toLowerCase());
  if (destinataires.includes(String(x.interviewerEmail).toLowerCase())) continue;
  const bon = intervieweurs.find((i) => destinataires.includes(String(i.email).toLowerCase()));
  hors.push({ id: x.id, interviewerIdAvant: qui.id, interviewerIdApres: bon ? bon.id : null,
    candidateId: x.candidateId, dossier: x.candidateName, intervieweurAvant: x.interviewerEmail,
    attendus: destinataires.join(', ') || 'aucun', date: x.interviewDate, statut: x.status });
}

console.log('entretiens : ' + tous.length + ' — poses hors destinataires : ' + hors.length);
for (const h of hors) {
  console.log('  #' + h.id + ' ' + h.dossier + ' (' + String(h.date).slice(0, 16) + ', '
    + h.statut + ') : ' + h.intervieweurAvant + ' au lieu de ' + h.attendus
    + (h.intervieweurIdApres ? ' -> id #' + h.intervieweurIdApres : ' -> AUCUN destinataire compte'));
}
if (hors.length === 0) { console.log('rien a faire'); process.exit(0); }
if (!APPLY) { console.log('etat des lieux seul : ajouter --apply pour reaffecter'); process.exit(0); }

fs.writeFileSync(SNAPSHOT, JSON.stringify(hors, null, 2), 'utf8');
console.log('instantane : ' + SNAPSHOT);
let ko = 0;
for (const h of hors) {
  if (!h.intervieweurIdApres) { console.log('  #' + h.id + ' ignore : aucun compte manager destinataire'); ko++; continue; }
  const i = (await call('/interviews/' + h.id, rh)).json;
  const res = await call('/interviews/' + h.id, rh, { method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId: i.candidateId, interviewerId: h.intervieweurIdApres,
      interviewDate: i.interviewDate, type: i.type, status: i.status,
      durationMinutes: i.durationMinutes, location: i.location, notes: i.notes }) });
  const relu = (await call('/interviews/' + h.id, rh)).json || {};
  const ok = res.status === 200 && relu.interviewerId === h.intervieweurIdApres;
  if (!ok) ko++;
  console.log('  #' + h.id + ' : HTTP ' + res.status + ' — intervieweur lu '
    + relu.interviewerEmail + (ok ? '' : ' | ' + msg(res)));
}
console.log(ko === 0 ? 'TOUT EST REAFFECTE — rollback : --rollback' : 'ECHEC sur ' + ko + ' ligne(s)');
process.exit(ko === 0 ? 0 : 3);
