const http = require('http');

const BASE = 'http://localhost:8080';
let adminToken = '', rhToken = '', mgrToken = '', candToken = '';
let results = { ok: 0, fail: 0, warn: 0 };

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function ok(msg)   { console.log(`  ✅  ${msg}`); results.ok++; }
function fail(msg) { console.log(`  ❌  ${msg}`); results.fail++; }
function warn(msg) { console.log(`  ⚠️   ${msg}`); results.warn++; }
function section(name) { console.log(`\n${'═'.repeat(50)}\n  ${name}\n${'═'.repeat(50)}`); }

async function run() {
  // ─── 1. AUTH ───────────────────────────────────────────
  section('1. AUTHENTIFICATION');

  for (const [user, pass, label] of [
    ['admin',    'Admin2026!', 'admin'],
    ['rh1',      'Test2026!',  'rh1'],
    ['manager1', 'Test2026!',  'manager1'],
    ['candidat1','Test2026!',  'candidat1'],
  ]) {
    const r = await req('POST', '/api/auth/signin', { username: user, password: pass });
    if (r.status === 200 && r.body.token) {
      ok(`${label} login -> roles: ${r.body.roles.join(', ')}`);
      if (label === 'admin')    adminToken = r.body.token;
      if (label === 'rh1')      rhToken    = r.body.token;
      if (label === 'manager1') mgrToken   = r.body.token;
      if (label === 'candidat1') candToken = r.body.token;
    } else {
      fail(`${label} login -> status ${r.status}`);
    }
  }

  // Mauvais mot de passe
  const badLogin = await req('POST', '/api/auth/signin', { username: 'admin', password: 'WRONG' });
  if (badLogin.status === 401 || badLogin.status === 400) ok('Mauvais mdp -> bloqué correctement');
  else fail(`Mauvais mdp -> status ${badLogin.status} (devrait être 401)`);

  const aH = { Authorization: `Bearer ${adminToken}` };
  const rH = { Authorization: `Bearer ${rhToken}` };
  const mH = { Authorization: `Bearer ${mgrToken}` };
  const cH = { Authorization: `Bearer ${candToken}` };

  // ─── 2. OFFRES D'EMPLOI ────────────────────────────────
  section('2. OFFRES D\'EMPLOI');

  const pubR = await req('GET', '/api/job-offers/public?page=0&size=10');
  if (pubR.status === 200 && Array.isArray(pubR.body)) {
    ok(`Public offers -> ${pubR.body.length} offres`);
    if (pubR.body.length > 0) console.log(`       Ex: [${pubR.body[0].id}] "${pubR.body[0].title}" - ${pubR.body[0].contractType} - ${pubR.body[0].location}`);
  } else fail(`Public offers -> ${pubR.status}`);

  const offerId = pubR.body?.[0]?.id;

  const adminOfR = await req('GET', '/api/job-offers?page=0&size=10', null, aH);
  if (adminOfR.status === 200) ok(`Admin all offers -> ${adminOfR.body.length} offres (dont brouillons/inactives)`);
  else fail(`Admin all offers -> ${adminOfR.status}`);

  if (offerId) {
    const detailR = await req('GET', `/api/job-offers/public/${offerId}`);
    if (detailR.status === 200) ok(`Détail offre #${offerId} -> "${detailR.body.title}"`);
    else fail(`Détail offre -> ${detailR.status}`);
  }

  // Sans token -> doit bloquer
  const noAuthOffers = await req('GET', '/api/job-offers');
  if (noAuthOffers.status === 401) ok('/api/job-offers sans token -> 401 bloqué');
  else fail(`/api/job-offers sans token -> ${noAuthOffers.status} (devrait être 401)`);

  // ─── 3. CANDIDATURES ───────────────────────────────────
  section('3. CANDIDATURES');

  const candsR = await req('GET', '/api/candidates?page=0&size=10', null, aH);
  if (candsR.status === 200) {
    ok(`Liste candidats (admin) -> ${candsR.body.length} candidats`);
    if (candsR.body.length > 0) {
      const c = candsR.body[0];
      console.log(`       Ex: [${c.id}] ${c.firstName} ${c.lastName} - Status: ${c.status} - Score: ${c.aiScore ?? 'N/A'}`);
    }
  } else fail(`Liste candidats -> ${candsR.status}`);

  // Candidat accède à ses propres candidatures
  const myAppsR = await req('GET', '/api/candidates/my-applications', null, cH);
  if (myAppsR.status === 200) ok(`Mes candidatures (candidat) -> ${myAppsR.body.length}`);
  else warn(`Mes candidatures -> ${myAppsR.status} : ${JSON.stringify(myAppsR.body).substring(0,80)}`);

  // Candidat ne peut PAS voir tous les candidats
  const candAccessAll = await req('GET', '/api/candidates?page=0&size=10', null, cH);
  if (candAccessAll.status === 403 || candAccessAll.status === 401) ok('Candidat bloqué sur /api/candidates (403/401)');
  else warn(`Candidat sur /api/candidates -> ${candAccessAll.status} (attendu 403)`);

  // Accès sans token
  const noAuthCands = await req('GET', '/api/candidates');
  if (noAuthCands.status === 401) ok('/api/candidates sans token -> 401 bloqué');
  else fail(`/api/candidates sans token -> ${noAuthCands.status}`);

  // ─── 4. ENTRETIENS ────────────────────────────────────
  section('4. ENTRETIENS');

  const interR = await req('GET', '/api/interviews?page=0&size=10', null, aH);
  if (interR.status === 200) ok(`Liste entretiens (admin) -> ${interR.body.length} entretiens`);
  else fail(`Liste entretiens -> ${interR.status}`);

  const myInterR = await req('GET', '/api/interviews/my-interviews', null, cH);
  if (myInterR.status === 200) ok(`Mes entretiens (candidat) -> ${myInterR.body.length}`);
  else warn(`Mes entretiens -> ${myInterR.status}`);

  const rhInterR = await req('GET', '/api/interviews', null, rH);
  if (rhInterR.status === 200) ok(`Entretiens (RH) -> ${rhInterR.body.length}`);
  else warn(`Entretiens RH -> ${rhInterR.status}`);

  // ─── 5. NOTIFICATIONS ──────────────────────────────────
  section('5. NOTIFICATIONS');

  const notifsR = await req('GET', '/api/notifications', null, cH);
  if (notifsR.status === 200) ok(`Notifications (candidat) -> ${notifsR.body.length}`);
  else warn(`Notifications -> ${notifsR.status}`);

  const n8nTodayR = await req('GET', '/api/notifications/n8n/candidates-today');
  if (n8nTodayR.status === 200) ok(`n8n /candidates-today -> ${n8nTodayR.body.length} candidats du jour`);
  else warn(`n8n candidates-today -> ${n8nTodayR.status}`);

  // ─── 6. CV ────────────────────────────────────────────
  section('6. CVS & FICHIERS');

  const cvR = await req('GET', '/api/cv', null, cH);
  if (cvR.status === 200) ok(`Mes CVs (candidat) -> ${cvR.body.length}`);
  else warn(`CVs -> ${cvR.status} : ${JSON.stringify(cvR.body).substring(0,60)}`);

  // ─── 7. n8n WEBHOOK ────────────────────────────────────
  section('7. n8n WEBHOOKS');

  const n8nPing = await req('POST', 'http://localhost:5678/webhook/agent1-cv-parser'.replace('http://localhost:8080',''), {
    candidatId: 9999,
    candidatNom: 'TEST User',
    candidatEmail: 'test@test.com',
    offreId: offerId || 1,
    offreTitre: 'Test Offre',
    cvUrl: 'http://test.com/cv.pdf'
  }).catch(() => null);
  // n8n is on port 5678, so use direct HTTP call
  const n8nR = await new Promise(resolve => {
    const body = JSON.stringify({ test: true });
    const r = http.request({ hostname: 'localhost', port: 5678, path: '/webhook/agent1-cv-parser', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', () => resolve({ status: 0, body: 'connection refused' }));
    r.write(body); r.end();
  });
  if (n8nR.status > 0) ok(`n8n Agent1 webhook -> status ${n8nR.status}`);
  else warn(`n8n Agent1 -> non joignable (n8n pas démarré ?)`);

  // ─── RÉSUMÉ ────────────────────────────────────────────
  section('RÉSUMÉ FINAL');
  console.log(`  ✅  OK   : ${results.ok}`);
  console.log(`  ❌  FAIL : ${results.fail}`);
  console.log(`  ⚠️   WARN : ${results.warn}`);
  const total = results.ok + results.fail + results.warn;
  const pct = Math.round((results.ok / total) * 100);
  console.log(`\n  Score global : ${pct}% (${results.ok}/${total} tests passés)`);
  if (results.fail === 0) console.log(`\n  Toutes les fonctionnalités critiques sont opérationnelles !`);
  else console.log(`\n  ${results.fail} fonctionnalité(s) en erreur à corriger.`);
}

run().catch(e => console.error('Erreur globale:', e));
