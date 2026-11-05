/**
 * JOB4YOU — Controle des gardes de coherence « une personne, un poste ».
 *
 * Trois regles ecrites dans le backend, verifiees ici par la vraie entree de l'application :
 *   1. PATCH /candidates/{id}/final-validation?decision=HIRED  -> refuse si la meme personne
 *      (meme e-mail) est deja embauchee sur une autre offre ;
 *   2. POST /candidates/apply                                  -> refuse si la personne occupe
 *      deja un poste ;
 *   3. POST /interviews                                        -> refuse un manager qui n'est pas
 *      destinataire du dossier (l'entretien serait cree mais invisible dans son agenda), accepte
 *      le manager destinataire, et laisse replanifier un couple deja valide.
 *
 * Aucune ecriture durable sauf le creneau du test 3, supprime a la fin (--keep pour le garder).
 *
 * Usage :
 *   JY_PW=<mot de passe app> node scripts/guards_check.mjs
 *   JY_PW=<mot de passe app> node scripts/guards_check.mjs --keep
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
const CVS = path.join(ROOT, 'gold_set', 'cvs');
const cvTest = () => {
  const dansDossier = fs.existsSync(CVS) && fs.readdirSync(CVS).find((f) => f.toLowerCase().endsWith('.pdf'));
  const fichier = dansDossier ? path.join(CVS, dansDossier) : path.join(ROOT, 'sample_cv_test.pdf');
  return fs.existsSync(fichier) ? fichier : null;
};

if (!PW) { console.error('JY_PW absent de l environnement'); process.exit(1); }
const KEEP = process.argv.slice(2).includes('--keep');

async function signin(username) {
  // Le jeton est relu du cache : la borne de connexion (10 / compte / 15 min) n'a rien a voir
  // avec les regles testees ici et une serie de scripts la franchirait.
  return signinCached(API, username, PW);
}

async function call(pathname, token, init) {
  const headers = { ...(init && init.headers) };
  // Une entree publique (POST /candidates/apply) se presente sans en-tete d'authentification :
  // un "Bearer undefined" ferait echouer le filtre JWT avant meme la regle testee.
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(API + pathname, { ...(init || {}), headers });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { /* reponse non JSON */ }
  return { status: r.status, json, text };
}

// Les fragments compares sont choisis sans accent : la regle est prouvee par le motif du refus,
// pas par un character que l'encodage de la reponse pourrait deformer.
const msg = (res) => (res.json && (res.json.message || res.json.error)) || res.text.slice(0, 200);
const nomComplet = (c) => String((c.firstName || '') + ' ' + (c.lastName || '')).trim().toLowerCase();
const verdict = (nom, attendu, ok, detail) =>
  console.log((ok ? '  OK    ' : '  ECHEC ') + nom + ' — attendu ' + attendu + ' : ' + detail);

const rh = await signin(RH_USER);
const listerDossiers = async () => (await call('/candidates?page=0&size=500', rh)).json || [];

// Une passe interrompue (pipe ferme, arret du terminal) laisse le creneau de controle derriere
// elle : le meme horaire fixe refuserait alors la prochaine passe pour un conflit d agenda, pas
// pour la regle testee. Les creations du script portent une note unique, elles sont donc
// recuperables et supprimees avant de commencer.
const NOTE = 'Controle de la garde intervieweur.';
const orphelins = ((await call('/interviews?page=0&size=400', rh)).json || [])
  .filter((i) => i.notes === NOTE);
for (const i of orphelins) {
  const r = await call('/interviews/' + i.id, rh, { method: 'DELETE' });
  console.log('  nettoyage du creneau #'+i.id+' laisse par une passe interrompue : HTTP ' + r.status);
}

// --- Inventaire : l'identite d'une personne est son e-mail + son nom -------------------------
const tous = await listerDossiers();
const cle = (c) => String(c.email || '').toLowerCase() + '|' + nomComplet(c);
const parEmail = new Map();
for (const c of tous) {
  const e = String(c.email || '').toLowerCase();
  if (!e) continue;
  if (!parEmail.has(e)) parEmail.set(e, []);
  parEmail.get(e).push(c);
}
const embauches = tous.filter((c) => c.status === 'HIRED');
const parPersonne = new Map();
for (const c of embauches) {
  parPersonne.set(cle(c), (parPersonne.get(cle(c)) || []).concat(c));
}
const vraiesDoublons = [...parPersonne.entries()].filter(([, ds]) => ds.length > 1);
const boitesPartagees = [...parEmail.entries()]
  .filter(([, ds]) => ds.filter((d) => d.status === 'HIRED').length > 1)
  .map(([e, ds]) => [e, ds.filter((d) => d.status === 'HIRED')]);

console.log('dossiers : ' + tous.length + ' — embauches : ' + embauches.length);
console.log('personnes embauchees deux fois (meme e-mail ET meme nom) : ' + vraiesDoublons.length);
console.log('boites partageant l adresse avec des noms differents (jeux de test) : '
  + boitesPartagees.length);
for (const [email, ds] of boitesPartagees) {
  console.log('  ' + email + ' : ' + ds.map((d) => '#' + d.id + ' « ' + nomComplet(d) + ' » offre '
    + d.jobOfferId).join(' | '));
}

// --- Test 1 : seconde embauche de la meme personne ------------------------------------------
console.log('\nTest 1 — une personne ne peut occuper qu un seul poste');
let t1 = null;
// La base n'offre plus de cas naturel (les embauches partagent une boite de test mais pas un
// nom) : on fabrique le cas, puis on le defait. Le dossier temoin garde son statut, seul son
// nom est temporairement aligne sur celui de la personne deja embauchee.
const temoinDeTest = embauches
  .map((h) => ({ h, t: parEmail.get(String(h.email).toLowerCase())
      .find((d) => d.id !== h.id && (d.status === 'ACCEPTED' || d.status === 'INTERVIEW_SCHEDULED')) }))
  .find((x) => !!x.t);
if (!temoinDeTest) {
  console.log('  SKIP aucun dossier embauchable sur la boite d une personne deja embauchee');
} else {
  const { h, t } = temoinDeTest;
  const avant = (await call('/candidates/' + t.id, rh)).json || {};
  const requis = (nom, prenom) => JSON.stringify({
    firstName: nom, lastName: prenom, email: avant.email, phone: avant.phone,
    address: avant.address, coverLetter: avant.coverLetter,
    jobOfferId: avant.jobOfferId, status: avant.status,
  });
  const aligne = await call('/candidates/' + t.id, rh, { method: 'PUT',
    headers: { 'Content-Type': 'application/json' }, body: requis(h.firstName, h.lastName) });
  console.log('  temoin #' + t.id + ' aligne sur « ' + nomComplet(h) + ' » <' + h.email
    + '> (dossier embauche #' + h.id + ') : HTTP ' + aligne.status);
  if (aligne.status === 200) {
    const res = await call('/candidates/' + t.id + '/final-validation?decision=HIRED'
      + '&presentationDate=2026-12-01T09:00:00&reason=controle+garde', rh, { method: 'PATCH' });
    t1 = res.status === 400 && /ne peut occuper/u.test(msg(res));
    verdict('embauche croisee sur #' + t.id, '400 « déjà embauchée »', t1,
      'HTTP ' + res.status + ' — ' + msg(res));
    const relu = (await call('/candidates/' + t.id, rh)).json || {};
    verdict('statut de #' + t.id + ' inchange', avant.status, relu.status === avant.status,
      'statut lu : ' + relu.status);
    const rendu = await call('/candidates/' + t.id, rh, { method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, body: requis(avant.firstName, avant.lastName) });
    const apres = (await call('/candidates/' + t.id, rh)).json || {};
    verdict('nom du temoin #' + t.id + ' restitue', nomComplet(avant),
      rendu.status === 200 && nomComplet(apres) === nomComplet(avant) && apres.status === avant.status,
      'lu : ' + nomComplet(apres) + ' / ' + apres.status);
  } else {
    console.log('  ECHEC alignment du temoin refuse : HTTP ' + aligne.status + ' — ' + msg(aligne));
  }
}

// --- Test 2 : repostulation d'une personne en poste -----------------------------------------
console.log('\nTest 2 — une personne en poste ne depose pas une nouvelle candidature');
let t2 = null;
if (embauches.length === 0) {
  console.log('  SKIP aucune embauche dans la base');
} else {
  // Le cas nominal : la personne deja en poste represente sa candidature sur une autre offre.
  // La personne test est prise dans la boite de test partagee : la repostulation d'un vrai
  // compte (celui des e-mails de demonstration) n'a rien a faire dans ce parcours.
  const h = embauches.find((e) => String(e.email).toLowerCase() === 'candidat@email.com')
    || embauches[0];
  const ds = parEmail.get(String(h.email).toLowerCase());
  const offres = (await call('/job-offers?page=0&size=200', rh)).json || [];
  const prises = new Set(ds.map((d) => d.jobOfferId));
  const cibleOffre = offres.find((o) => !prises.has(o.id) && o.status !== 'CLOSED');
  const fichier = cvTest();
  if (!cibleOffre || !fichier) {
    console.log('  SKIP pas d offre libre ou pas de CV de test (sample_cv_test.pdf)');
  } else {
    const fd = new FormData();
    fd.append('application', JSON.stringify({
      firstName: h.firstName, lastName: h.lastName, email: h.email, phone: '+21600000000',
      jobOfferId: cibleOffre.id,
      coverLetter: 'Test de la garde repostulation : aucun dossier ne doit etre cree.',
    }));
    fd.append('cv', new Blob([fs.readFileSync(fichier)], { type: 'application/pdf' }), path.basename(fichier));
    // L'entree est authentifiee (le formulaire candidat poste avec le jeton du compte USER) :
    // le test la franchit avec le jeton RH, comme le rejeu du Gold Set.
    const up = await call('/candidates/apply', rh, { method: 'POST', body: fd });
    t2 = up.status === 400 && /personne en poste/u.test(msg(up));
    verdict('postuler sur l offre ' + cibleOffre.id, '400 « déjà embauché »', t2,
      'HTTP ' + up.status + ' — ' + msg(up));
    const apres = (await listerDossiers()).filter((c) => String(c.email).toLowerCase() === String(h.email).toLowerCase());
    // Si la garde avait laisse passer la candidature, le dossier et l'e-mail de confirmation sont
    // partis : on les retire immediatement pour ne pas laisser de ligne orpheline dans la base.
    const nouveaux = apres.filter((c) => !ds.some((d) => d.id === c.id));
    for (const c of nouveaux) {
      const purge = await call('/candidates/' + c.id, rh, { method: 'DELETE' });
      console.log('  nettoyage : dossier #' + c.id + ' cree par erreur, supprime (HTTP ' + purge.status + ')');
    }
    verdict('dossiers de ' + h.email, ds.length + ' (aucun ajout)', apres.length === ds.length,
      'lus : ' + apres.length);
  }
}

// --- Test 3 : intervieweur non destinataire -------------------------------------------------
console.log('\nTest 3 — un entretien ne peut etre pose que sur un manager destinataire');
const interviewers = (await call('/interviews/interviewers', rh)).json || [];
const managers = interviewers.filter((i) => i.role === 'Manager');
console.log('  managers proposes : ' + managers.map((m) => m.name + ' <' + m.email + '>').join(', '));
const examen = ['CV_REVIEWED', 'SCORED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED'];
let t3 = null, t3b = null, t3c = null, pose = null;
for (const c of tous.filter((x) => examen.includes(x.status))) {
  const rp = await call('/candidates/' + c.id + '/routing-preview', rh);
  const destinataires = ((rp.json && rp.json.managers) || [])
    .map((m) => String(m.email || '').toLowerCase());
  if (destinataires.length === 0) continue;
  const hors = managers.find((m) => !destinataires.includes(String(m.email).toLowerCase()));
  const dedans = managers.find((m) => destinataires.includes(String(m.email).toLowerCase()));
  if (!hors) continue;

  const corps = (id, date, notes) => JSON.stringify({
    candidateId: c.id, interviewerId: id, interviewDate: date,
    type: 'TECHNICAL', status: 'SCHEDULED', durationMinutes: 45,
    location: 'Google Meet', notes,
  });

  const mauvais = await call('/interviews', rh, { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: corps(hors.id, '2026-12-05T11:00:00', 'Controle de la garde intervieweur.') });
  t3 = mauvais.status === 400 && /est pas destinataire/u.test(msg(mauvais));
  verdict('entretien sur ' + hors.name + ' (non destinataire)', '400', t3,
    'HTTP ' + mauvais.status + ' — ' + msg(mauvais));

  if (dedans) {
    // L'horaire est cherche, pas impose : un creneau deja occupe dans l'agenda de demonstration
    // n'est pas un echec de la regle. Quatre essaies en pas de trente minutes suffisent.
    let bon = null, horaire = null;
    for (let pas = 0; pas < 4 && (!bon || bon.status !== 201); pas++) {
      horaire = '2026-12-06T' + (11 + Math.floor(pas / 2)) + ':' + (pas % 2 ? '30' : '00') + ':00';
      bon = await call('/interviews', rh, { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corps(dedans.id, horaire, 'Controle de la garde intervieweur.') });
    }
    const id = bon.json && bon.json.id;
    t3b = bon.status === 201 && !!id;
    verdict('entretien sur ' + dedans.name + ' (destinataire)', '201', t3b,
      'HTTP ' + bon.status + ' entretien #' + (id ?? '-') + ' a ' + horaire);
    if (id) {
      pose = id;
      const deplace = await call('/interviews/' + id, rh, { method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: corps(dedans.id, '2026-12-06T15:00:00', 'Replanifie sans changer l intervieweur.') });
      t3c = deplace.status === 200;
      verdict('replanification du meme couple', '200', t3c,
        'HTTP ' + deplace.status + ' — ' + msg(deplace));
      if (KEEP) console.log('  entretien #' + id + ' garde (rollback non demande)');
      else {
        const suppr = await call('/interviews/' + id, rh, { method: 'DELETE' });
        console.log('  rollback : entretien #' + id + ' supprime (HTTP ' + suppr.status + ')');
        pose = null;
      }
    }
  }
  break;
}
if (t3 === null) console.log('  SKIP aucun dossier examinant un manager hors destinataires');

const bilans = [t1, t2, t3].filter((x) => x !== null);
console.log('\nbilan : ' + bilans.filter(Boolean).length + '/' + bilans.length
  + ' refus comme attendu' + (t3b === null ? '' : (t3b ? ', entretien destinataire accepte' : ', entretien destinataire REFUSE')));
if (pose) console.log('ATTENTION : entretien #' + pose + ' laisse en base.');
process.exit(bilans.length > 0 && bilans.every(Boolean) ? 0 : 3);
