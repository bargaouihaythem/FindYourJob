/**
 * JOB4YOU — Repartage des boites de test pour la coherence « une personne, un poste ».
 *
 * Trois dossiers embauches portent la meme adresse (candidat@email.com) mais trois noms
 * differents : ce sont trois personnes differentes qui se partagent la boite du compte de test.
 * « Mes candidatures » — qui rassemble les dossiers par l'e-mail du compte connecte — affichait
 * donc trois « Embauché » pour une seule personne. HIRED est un etat terminal : la machine a
 * etats interdit d'en sortir, ces embauches ne peuvent pas etre refusees apres coup.
 *
 * Le correctif porte donc sur l'identite, pas sur le statut : chaque dossier garde son poste,
 * chacun recoit sa propre boite reservee aux exemples (example.com, jamais distribue).
 * Le dossier #138 reste sur candidat@email.com : c'est la boite du compte `candidat` avec lequel
 * la demonstration parcourt l'application.
 *
 * Usage :
 *   JY_PW=<mot de passe app> node scripts/coherence_mailbox.mjs            # repartition
 *   JY_PW=<mot de passe app> node scripts/coherence_mailbox.mjs --rollback # remet les e-mails d'origine
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const API = process.env.DEMO_API || 'http://localhost:8080/api';
const PW = process.env.JY_PW;
const RH_USER = process.env.DEMO_RH || 'rh';
const SNAPSHOT = path.join(ROOT, 'gold_set', 'mailbox_split.json');
const BOITE_ORIGINE = 'candidat@email.com';

if (!PW) { console.error('JY_PW absent de l environnement'); process.exit(1); }
const ROLLBACK = process.argv.slice(2).includes('--rollback');

async function signin(username) {
  const r = await fetch(API + '/auth/signin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PW }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.token) throw new Error('connexion ' + username + ' refusee (HTTP ' + r.status + ')');
  return j.token;
}

async function call(pathname, token, init) {
  const r = await fetch(API + pathname, { ...(init || {}),
    headers: { Authorization: 'Bearer ' + token, ...(init && init.headers) } });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { /* reponse non JSON */ }
  return { status: r.status, json, text };
}

const msg = (res) => (res.json && (res.json.message || res.json.error)) || res.text.slice(0, 200);
const rh = await signin(RH_USER);
const lire = async (id) => (await call('/candidates/' + id, rh)).json;
const corps = (c) => JSON.stringify({
  firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
  address: c.address, coverLetter: c.coverLetter, jobOfferId: c.jobOfferId, status: c.status,
});

if (ROLLBACK) {
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  for (const avant of snap.dossiers) {
    const res = await call('/candidates/' + avant.id, rh, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corps(avant) });
    const relu = await lire(avant.id);
    console.log('  #' + avant.id + ' -> ' + avant.email + ' : HTTP ' + res.status
      + ' , lu ' + (relu && relu.email));
  }
  console.log('rollback e-mails termine');
  process.exit(0);
}

const tous = (await call('/candidates?page=0&size=500', rh)).json || [];
const partages = tous.filter((c) => String(c.email).toLowerCase() === BOITE_ORIGINE
  && c.status === 'HIRED');
if (partages.length < 2) {
  console.log('rien a faire : ' + partages.length + ' embauche(s) sur ' + BOITE_ORIGINE);
  process.exit(0);
}
// Le plus ancien dossier reste sur la boite du compte de demonstration : c'est celui que la
// capture « Mes candidatures » est censee montrer.
partages.sort((a, b) => a.id - b.id);
const garde = partages[0];
const demenages = partages.slice(1);

fs.writeFileSync(SNAPSHOT, JSON.stringify({
  avant: new Date().toISOString(), boite_origine: BOITE_ORIGINE,
  dossiers: demenages.map((c) => ({ id: c.id, ...c })),
}, null, 2), 'utf8');
console.log('instantane écrit : ' + SNAPSHOT + ' (' + demenages.length + ' dossier(s))');

let ko = 0;
for (const c of demenages) {
  const nouvelle = String(c.firstName).toLowerCase().replace(/[^a-z0-9]/g, '') + '@example.com';
  const demande = { ...c, email: nouvelle };
  const res = await call('/candidates/' + c.id, rh, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corps(demande) });
  const relu = await lire(c.id);
  const ok = res.status === 200 && relu && String(relu.email).toLowerCase() === nouvelle;
  if (!ok) ko++;
  console.log('  #' + c.id + ' « ' + c.firstName + ' ' + c.lastName + ' » : ' + c.email + ' -> '
    + nouvelle + '  HTTP ' + res.status + (ok ? '' : ' — ' + msg(res)));
}
const relu = (await call('/candidates?page=0&size=500', rh)).json || [];
const restants = relu.filter((c) => String(c.email).toLowerCase() === BOITE_ORIGINE && c.status === 'HIRED');
console.log('embauches sur ' + BOITE_ORIGINE + ' desormais : ' + restants.length
  + ' (#' + restants.map((c) => c.id).join(', #') + ') — total dossiers : ' + relu.length);
console.log(ko === 0 ? 'COHERENCE : rollback possible via --rollback' : 'ECHEC : ' + ko + ' mouvement(s) refuse(s)');
process.exit(ko === 0 ? 0 : 3);
