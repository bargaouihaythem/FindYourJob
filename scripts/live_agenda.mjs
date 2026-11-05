/**
 * JOB4YOU — Agenda du manager pour la capture de la figure de realisation.
 *
 * Le calendrier ne charge que le mois affiche : en novembre 2026 il est vide, donc la
 * capture ne montrerait rien. Ce script pose trois entretiens en novembre sur des dossiers
 * deja scores (issue du rejeu du Gold Set), puis les compte pour la figure.
 *
 * Usage :
 *   JY_PW=<mot de passe app> node scripts/live_agenda.mjs            # pose les trois creneaux
 *   JY_PW=<mot de passe app> node scripts/live_agenda.mjs --rollback # les supprime
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
const MANAGER_USER = process.env.DEMO_MANAGER || 'manager.devops';
const AGENDA_JSON = path.join(ROOT, 'gold_set', 'live_agenda.json');
const RUN_JSON = path.join(ROOT, 'gold_set', 'live_run.json');

if (!PW) { console.error('JY_PW absent de l environnement'); process.exit(1); }
const ROLLBACK = process.argv.slice(2).includes('--rollback');

async function signin(username) {
  // Jeton relit depuis le cache commun (borne : 10 connexions par compte et par 15 minutes).
  return signinCached(API, username, PW);
}

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

if (ROLLBACK) {
  const agenda = JSON.parse(fs.readFileSync(AGENDA_JSON, 'utf8'));
  const token = await signin(RH_USER);
  let ok = 0, ko = 0;
  for (const id of agenda.ids) {
    const res = await call('/interviews/' + id, token, { method: 'DELETE' });
    if (res.status >= 200 && res.status < 300) ok++; else { ko++; console.log('  ECHEC ' + id + ' : HTTP ' + res.status + ' ' + res.text.slice(0, 120)); }
  }
  console.log('rollback agenda : ' + ok + ' entretien(s) supprime(s), ' + ko + ' echec(s)');
  process.exit(0);
}

const rh = await signin(RH_USER);
const mgr = await signin(MANAGER_USER);

// L'interviewer doit etre le compte dont on filme l'agenda, sinon la capture reste vide.
// L'entretien porte deja l'identifiant de l'intervieweur : le lire evite de deviner ce compte
// en comparant des nombres de creneaux qui peuvent coincider entre deux utilisateurs.
const mine = await call('/interviews/my-calendar?startDate=2026-10-01T00:00:00&endDate=2026-10-31T23:59:59', mgr);
if (!Array.isArray(mine.json)) { console.error('agenda manager illisible : HTTP ' + mine.status + ' ' + mine.text.slice(0, 150)); process.exit(2); }
let managerId = null, managerEmail = null;
if (mine.json.length > 0) {
  managerId = mine.json[0].interviewerId;
  managerEmail = mine.json[0].interviewerEmail;
  console.log('interviewer = #' + managerId + ' ' + (mine.json[0].interviewerName || 'nom inconnu')
    + ' <' + managerEmail + '> (' + mine.json.length + ' creneaux d octobre sur l agenda de ' + MANAGER_USER + ')');
} else {
  console.error('agenda manager vide en octobre : impossible de resoudre l identifiant interviewer');
  process.exit(2);
}
if (!managerId || !managerEmail) { console.error('compte manager sans identifiant ni e-mail : abandon'); process.exit(2); }

const run = JSON.parse(fs.readFileSync(RUN_JSON, 'utf8'));
const dispo = run.records.filter((r) => r.candidateId && r.status === 'CV_REVIEWED');
console.log('dossiers CV_REVIEWED disponibles : ' + dispo.length);

// Un entretien pose sur un dossier non destine a ce manager est cree (HTTP 201) mais reste
// invisible dans son calendrier : getManagerCalendar filtre par canAccessCandidate.
// On ne retient donc que les dossiers dont l'aiguillage designe reellement ce compte.
const destined = [];
for (const c of dispo) {
  const rp = await call('/candidates/' + c.candidateId + '/routing-preview', rh);
  const managers = (rp.json && rp.json.managers) || [];
  const emails = managers.map((m) => String(m.email || '').toLowerCase());
  const basis = (rp.json && rp.json.basis) || '?';
  const hit = emails.includes(String(managerEmail).toLowerCase());
  console.log('  ' + c.id + ' ' + c.candidateName + ' (offre ' + c.jobOfferId + ') -> '
    + (managers.map((m) => m.fullName).join(', ') || 'aucun') + ' [' + basis + ']'
    + (hit ? '  * destinataire' : ''));
  if (hit) destined.push(c);
}
console.log('dossiers destines a ' + MANAGER_USER + ' : ' + destined.length);

const choisis = destined.slice(0, 3);
if (choisis.length < 3) {
  console.error('moins de 3 dossiers destines a ce compte : relancer avec DEMO_MANAGER=<compte du manager reellement destine>');
  process.exit(2);
}

const creneaux = ['2026-11-10T10:00:00', '2026-11-12T14:30:00', '2026-11-17T09:00:00'];
const ids = [];
for (let i = 0; i < choisis.length; i++) {
  const c = choisis[i];
  const body = {
    candidateId: c.candidateId, interviewerId: managerId,
    interviewDate: creneaux[i], type: 'TECHNICAL', status: 'SCHEDULED',
    durationMinutes: 45, location: 'Google Meet', notes: '',
  };
  const res = await call('/interviews', rh, { method: 'POST', body: JSON.stringify(body) });
  const id = res.json && (res.json.id ?? res.json.interviewId);
  console.log('  ' + c.candidateName + ' -> ' + creneaux[i] + '  HTTP ' + res.status + '  entretien #' + (id ?? '-'));
  if (id) ids.push(id); else console.log('     ' + res.text.slice(0, 180));
}

fs.writeFileSync(AGENDA_JSON, JSON.stringify({ cree_le: new Date().toISOString(), managerId, managerEmail, ids }, null, 2), 'utf8');

// Auto-controle : le calendrier de capture doit relire les creneaux qu'on vient de poser.
// Sans cette ligne, la figure du rapport peut etre tournee sur un mois vide.
const apres = await call('/interviews/my-calendar?startDate=2026-11-01T00:00:00&endDate=2026-11-30T23:59:59', mgr);
const vus = Array.isArray(apres.json) ? apres.json : [];
console.log('controle agenda ' + MANAGER_USER + ' en novembre : ' + vus.length + ' entretien(s) visibles');
for (const it of vus) {
  console.log('   ' + String(it.interviewDate || '').slice(0, 16) + '  '
    + (it.candidateFirstName || '') + ' ' + (it.candidateLastName || '') + '  ' + (it.status || ''));
}

console.log('AGENDA : ' + ids.length + ' creneau(x) pose(s) — rollback : node scripts/live_agenda.mjs --rollback');
