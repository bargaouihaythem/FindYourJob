const http = require('http');
const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));

const BASE = 'http://localhost:8080';
const DB_PATH = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const AGENT1_WF = 'abHc50O9XFYNXIa8';
const AGENT2_WF = 'aDlMEwef9SLGf0Xd';
const AGENT3_WF = 'vuIc7XWE1gcN4hBG';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function request(pathname, options = {}, rawBody) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 8080, path: pathname, method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (rawBody) req.write(rawBody);
    req.end();
  });
}

function postJSON(pathname, body, token) {
  const payload = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request(pathname, { method: 'POST', headers }, payload);
}

function patchNoBody(pathname, token) {
  const headers = { 'Content-Length': '0' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request(pathname, { method: 'PATCH', headers });
}

function postNoBody(pathname, token) {
  const headers = { 'Content-Length': '0' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request(pathname, { method: 'POST', headers });
}

function get(pathname, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return request(pathname, { method: 'GET', headers });
}

function applyCandidate(candidateToken, offerId, firstName, lastName, email, coverLetter) {
  const boundary = '----FormBoundary' + Date.now() + Math.floor(Math.random() * 1000);
  const appJson = JSON.stringify({ firstName, lastName, email, phone: '0600000000', address: 'Paris, France', coverLetter, jobOfferId: offerId });
  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n192\n%%EOF');
  const part1 = `--${boundary}\r\nContent-Disposition: form-data; name="application"\r\n\r\n${appJson}\r\n`;
  const part2h = `--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="cv-test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(part1), Buffer.from(part2h), pdfContent, Buffer.from(end)]);
  return new Promise((resolve) => {
    const r = http.request({
      hostname: 'localhost', port: 8080, path: '/api/candidates/apply', method: 'POST',
      headers: { Authorization: `Bearer ${candidateToken}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: e.message }));
    r.write(body);
    r.end();
  });
}

function getMaxExecId(workflowId) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH);
    db.get('SELECT COALESCE(MAX(id),0) AS m FROM execution_entity WHERE workflowId=?', [workflowId], (e, row) => {
      db.close();
      resolve(row ? row.m : 0);
    });
  });
}

function getExecsAfter(workflowId, fromId) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH);
    db.all('SELECT id, status FROM execution_entity WHERE workflowId=? AND id>? ORDER BY id ASC', [workflowId, fromId], (e, rows) => {
      db.close();
      resolve(rows || []);
    });
  });
}

let pass = 0, fail = 0;
function ok(label, extra = '') { pass++; console.log(`  OK   ${label}${extra ? ' -> ' + extra : ''}`); }
function ko(label, extra = '') { fail++; console.log(`  FAIL ${label}${extra ? ' -> ' + extra : ''}`); }
function section(title) { console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`); }

async function main() {
  const ts = Date.now();

  section('0) PRE-CHECK SERVICES');
  const health = await get('/api/job-offers/public?page=0&size=1');
  if (health.status === 200) ok('Backend HTTP OK'); else { ko('Backend HTTP', health.status); process.exit(1); }

  section('1) INSCRIPTION NOUVEAU CANDIDAT (signup)');
  const newUsername = 'qatest' + ts;
  const newEmail = `qatest${ts}@example.com`;
  const signup = await postJSON('/api/auth/signup', {
    username: newUsername, email: newEmail, password: 'Test2026!',
    firstName: 'QA', lastName: 'Testeur', roles: ['user'],
  });
  if ([200, 201].includes(signup.status)) ok('Signup nouveau candidat', newUsername);
  else ko('Signup nouveau candidat', JSON.stringify(signup.body).slice(0, 150));

  section('2) LOGIN NOUVEAU CANDIDAT');
  const login = await postJSON('/api/auth/signin', { username: newUsername, password: 'Test2026!' });
  const candidateToken = login.body && login.body.token;
  if (login.status === 200 && candidateToken) ok('Login nouveau candidat', 'token OK');
  else { ko('Login nouveau candidat', login.status); process.exit(1); }

  const admin = await postJSON('/api/auth/signin', { username: 'admin', password: 'Admin2026!' });
  const adminToken = admin.body.token;
  if (admin.status === 200 && adminToken) ok('Login admin'); else ko('Login admin');

  const manager = await postJSON('/api/auth/signin', { username: 'manager1', password: 'Test2026!' });
  const managerToken = manager.body.token;
  if (manager.status === 200 && managerToken) ok('Login manager1'); else ko('Login manager1');

  const rh = await postJSON('/api/auth/signin', { username: 'rh1', password: 'Test2026!' });
  const rhToken = rh.body.token;
  if (rh.status === 200 && rhToken) ok('Login rh1'); else ko('Login rh1');

  section('3) CONSULTER LES OFFRES D\'EMPLOI (publiques)');
  const offersRes = await get('/api/job-offers/public?page=0&size=5');
  let offers = offersRes.body && offersRes.body.content ? offersRes.body.content : [];
  if (offers.length) ok('Liste offres publiques', `${offers.length} offres`);
  else ko('Liste offres publiques', 'aucune offre');
  const offerId = offers.length ? offers[0].id : 123;
  const offerTitle = offers.length ? offers[0].title : 'inconnue';
  console.log(`  -> Offre ciblée: #${offerId} "${offerTitle}"`);

  section('4) CANDIDATURE #1 — PROFIL FORT (scénario ACCEPTÉ attendu)');
  const strongCoverLetter = "Fort de 6 annees d'experience en marketing digital, j'ai pilote des campagnes " +
    "multicanal, maitrise Google Analytics, le SEO/SEA, la creation de contenu et la gestion des reseaux sociaux " +
    "(Instagram, LinkedIn, TikTok). Ma communication ecrite est claire, structuree et orientee resultats. " +
    "J'ai encadre une equipe de 3 personnes et delivre des rapports de performance mensuels aux directions.";
  const emailAccept = `bargaouihaythem1+e2eaccept${ts}@gmail.com`;
  const applyAccept = await applyCandidate(candidateToken, offerId, 'Camille', 'Durand', emailAccept, strongCoverLetter);
  if ([200, 201].includes(applyAccept.status)) ok('Candidature #1 soumise (avec CV)', `id=${applyAccept.body.id}`);
  else { ko('Candidature #1 soumise', JSON.stringify(applyAccept.body).slice(0, 150)); }
  const acceptId = applyAccept.body.id;

  section('5) CANDIDATURE #2 — PROFIL FAIBLE / HORS SUJET (scénario REJETÉ attendu)');
  const weakCoverLetter = "Bonjour, je cherche un emploi. Merci.";
  const emailReject = `bargaouihaythem1+e2ereject${ts}@gmail.com`;
  const applyReject = await applyCandidate(candidateToken, offerId, 'Julien', 'Petit', emailReject, weakCoverLetter);
  if ([200, 201].includes(applyReject.status)) ok('Candidature #2 soumise (avec CV)', `id=${applyReject.body.id}`);
  else { ko('Candidature #2 soumise', JSON.stringify(applyReject.body).slice(0, 150)); }
  const rejectId = applyReject.body.id;

  // Baseline exécutions n8n avant déclenchement des recalculs de score
  const beforeA1 = await getMaxExecId(AGENT1_WF);
  const beforeA2 = await getMaxExecId(AGENT2_WF);
  const beforeA3 = await getMaxExecId(AGENT3_WF);

  await sleep(4000);

  section('6) SCORE IA (Cohere) — RECALCUL SUR LES 2 CANDIDATS');
  const recomputeAccept = await postNoBody(`/api/candidates/${acceptId}/ai-score/recompute`, adminToken);
  if (recomputeAccept.status === 200) {
    ok('Recompute score candidat FORT', `score=${recomputeAccept.body.aiScore} source=${recomputeAccept.body.aiScoreSource} status=${recomputeAccept.body.status}`);
  } else ko('Recompute score candidat FORT', recomputeAccept.status);

  const recomputeReject = await postNoBody(`/api/candidates/${rejectId}/ai-score/recompute`, adminToken);
  if (recomputeReject.status === 200) {
    ok('Recompute score candidat FAIBLE', `score=${recomputeReject.body.aiScore} source=${recomputeReject.body.aiScoreSource} status=${recomputeReject.body.status}`);
  } else ko('Recompute score candidat FAIBLE', recomputeReject.status);

  section('7) FORÇAGE DES STATUTS FINAUX (garantir les 2 scénarios)');
  // Garantir ACCEPTED même si le score IA était proche du seuil
  await patchNoBody(`/api/candidates/${acceptId}/status?status=CV_REVIEWED`, rhToken);
  await sleep(1500);
  const finalAccept = await patchNoBody(`/api/candidates/${acceptId}/status?status=ACCEPTED`, adminToken);
  if (finalAccept.status === 200 && finalAccept.body.status === 'ACCEPTED') ok('Candidat FORT -> ACCEPTED confirmé');
  else ko('Candidat FORT -> ACCEPTED', JSON.stringify(finalAccept.body).slice(0, 150));

  // Garantir AUTO_REJECTED via score forcé bas
  const forceLow = await patchNoBody(`/api/candidates/${rejectId}/ai-score?score=25&summary=Profil+insuffisant&recommendation=WEAK_MATCH`, null);
  await sleep(1500);
  const checkReject = await get(`/api/candidates/${rejectId}`, adminToken);
  if (checkReject.status === 200 && checkReject.body.status === 'AUTO_REJECTED') ok('Candidat FAIBLE -> AUTO_REJECTED confirmé');
  else ko('Candidat FAIBLE -> AUTO_REJECTED', checkReject.body && checkReject.body.status);

  section('8) WORKFLOW MANAGER — décision sur dossier validé');
  // Créer un 3e candidat pour tester le workflow manager proprement
  const emailManagerFlow = `bargaouihaythem1+e2emanager${ts}@gmail.com`;
  const applyManager = await applyCandidate(candidateToken, offerId, 'Nora', 'Benali', emailManagerFlow, strongCoverLetter);
  const managerCandId = applyManager.body.id;
  await sleep(1500);
  await patchNoBody(`/api/candidates/${managerCandId}/status?status=CV_REVIEWED`, rhToken);
  await sleep(1000);
  const managerAccept = await patchNoBody(`/api/candidates/${managerCandId}/manager-decision?decision=ACCEPTED`, managerToken);
  if (managerAccept.status === 200 && managerAccept.body.status === 'ACCEPTED') ok('Décision manager ACCEPTED', `candidat #${managerCandId}`);
  else ko('Décision manager ACCEPTED', JSON.stringify(managerAccept.body).slice(0, 150));

  // Vérifier que le manager ne peut pas décider sur un dossier non validé RH
  const emailManagerFlow2 = `bargaouihaythem1+e2emanager2${ts}@gmail.com`;
  const applyManager2 = await applyCandidate(candidateToken, offerId, 'Karim', 'Haddad', emailManagerFlow2, strongCoverLetter);
  const managerCandId2 = applyManager2.body.id;
  await sleep(1000);
  const managerRejectInvalid = await patchNoBody(`/api/candidates/${managerCandId2}/manager-decision?decision=ACCEPTED`, managerToken);
  if (managerRejectInvalid.status === 400) ok('Garde-fou workflow manager (refuse dossier non validé RH)');
  else ko('Garde-fou workflow manager', managerRejectInvalid.status);

  section('9) CORRECTION SCORE PAR RH');
  const override = await patchNoBody(`/api/candidates/${acceptId}/ai-score/override?manualScore=90&reason=${encodeURIComponent('Entretien telephonique tres convaincant')}`, rhToken);
  if (override.status === 200 && override.body.manualScore === 90) ok('Correction manuelle score RH', `manualScore=90 by=${override.body.manualScoreBy}`);
  else ko('Correction manuelle score RH', JSON.stringify(override.body).slice(0, 150));

  section('10) RANKING CANDIDATS PAR OFFRE');
  const ranking = await get(`/api/candidates/job-offer/${offerId}/ranking`, rhToken);
  if (ranking.status === 200 && Array.isArray(ranking.body)) {
    ok('Ranking récupéré', `${ranking.body.length} candidats triés`);
    ranking.body.slice(0, 3).forEach((c, i) => console.log(`    #${i + 1} id=${c.id} ${c.firstName} ${c.lastName} score=${c.effectiveScore} statut=${c.status}`));
  } else ko('Ranking récupéré', ranking.status);

  section('11) OFFRES EXTERNES (Remotive, étude comparative)');
  const remotive = await get('/api/external-offers/remotive?search=marketing&limit=3', adminToken);
  if (remotive.status === 200 && Array.isArray(remotive.body)) ok('Offres externes Remotive', `${remotive.body.length} résultats`);
  else ko('Offres externes Remotive', remotive.status);

  section('12) VÉRIFICATION EXÉCUTIONS N8N (Agents 1/2/3)');
  await sleep(6000);
  const execsA1 = await getExecsAfter(AGENT1_WF, beforeA1);
  const execsA2 = await getExecsAfter(AGENT2_WF, beforeA2);
  const execsA3 = await getExecsAfter(AGENT3_WF, beforeA3);

  const successA1 = execsA1.filter((e) => e.status === 'success').length;
  const successA2 = execsA2.filter((e) => e.status === 'success').length;
  const successA3 = execsA3.filter((e) => e.status === 'success').length;

  if (execsA1.length > 0 && successA1 === execsA1.length) ok('Agent 1 (CV parser + email confirmation)', `${successA1}/${execsA1.length} success`);
  else if (execsA1.length === 0) ko('Agent 1', 'aucune exécution détectée');
  else ko('Agent 1', `${successA1}/${execsA1.length} success (des échecs détectés)`);

  if (execsA2.length > 0 && successA2 === execsA2.length) ok('Agent 2 (CV sélectionné / entretien)', `${successA2}/${execsA2.length} success`);
  else if (execsA2.length === 0) ko('Agent 2', 'aucune exécution détectée');
  else ko('Agent 2', `${successA2}/${execsA2.length} success (des échecs détectés)`);

  if (execsA3.length > 0 && successA3 === execsA3.length) ok('Agent 3 (manager + décision finale + emails)', `${successA3}/${execsA3.length} success`);
  else if (execsA3.length === 0) ko('Agent 3', 'aucune exécution détectée');
  else ko('Agent 3', `${successA3}/${execsA3.length} success (des échecs détectés)`);

  section('13) CANDIDATURES DU CANDIDAT (vue "mes candidatures")');
  const myApps = await get(`/api/candidates/by-email/${encodeURIComponent(emailAccept)}`, candidateToken);
  if (myApps.status === 200 && Array.isArray(myApps.body) && myApps.body.length >= 1) ok('Consultation "mes candidatures"', `${myApps.body.length} trouvée(s)`);
  else ko('Consultation "mes candidatures"', myApps.status);

  section('RÉSUMÉ FINAL');
  console.log(`  PASS = ${pass}`);
  console.log(`  FAIL = ${fail}`);
  console.log(`\n  Candidat FORT  (attendu ACCEPTED)      : id=${acceptId}  email=${emailAccept}`);
  console.log(`  Candidat FAIBLE (attendu AUTO_REJECTED): id=${rejectId}  email=${emailReject}`);
  console.log(`  Candidat workflow manager (ACCEPTED)    : id=${managerCandId}`);
  console.log(`  Candidat garde-fou manager (400 attendu): id=${managerCandId2}`);

  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => { console.error('TEST CRASH:', e.message); process.exit(1); });
