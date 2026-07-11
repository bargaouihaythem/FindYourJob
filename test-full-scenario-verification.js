const http = require('http');
const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));

const BASE = 'http://localhost:8080';
const DB_PATH = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const AGENT3_WF = 'vuIc7XWE1gcN4hBG';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function request(url, options = {}, rawBody) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname, port: Number(u.port || 80),
      path: u.pathname + (u.search || ''), method: options.method || 'GET',
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
    req.on('error', reject);
    if (rawBody) req.write(rawBody);
    req.end();
  });
}

function postJSON(url, body, token) {
  const payload = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request(url, { method: 'POST', headers }, payload);
}

function patchNoBody(url, token) {
  const headers = { 'Content-Length': '0' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request(url, { method: 'PATCH', headers });
}

function get(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return request(url, { method: 'GET', headers });
}

function applyCandidate(candidateToken, offerId, firstName, lastName, email) {
  const boundary = '----FormBoundary' + Date.now() + Math.floor(Math.random() * 1000);
  const appJson = JSON.stringify({
    firstName, lastName, email, phone: '0600000000', address: 'Paris, France',
    coverLetter: 'Développeur Java Spring Boot 5 ans expérience, React, PostgreSQL, Docker, Agile.',
    jobOfferId: offerId,
  });
  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n192\n%%EOF');
  const part1 = `--${boundary}\r\nContent-Disposition: form-data; name="application"\r\n\r\n${appJson}\r\n`;
  const part2h = `--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="cv-test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(part1), Buffer.from(part2h), pdfContent, Buffer.from(end)]);
  return request(`${BASE}/api/candidates/apply`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${candidateToken}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
  }, body);
}

function getAgent3ExecsAfter(fromId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.all('SELECT id, status FROM execution_entity WHERE workflowId=? AND id>? ORDER BY id ASC', [AGENT3_WF, fromId], (err, rows) => {
      if (err) { db.close(); return reject(err); }
      if (!rows.length) { db.close(); return resolve([]); }
      let pending = rows.length;
      const out = [];
      for (const r of rows) {
        db.get('SELECT data FROM execution_data WHERE executionId=?', [r.id], (e2, row2) => {
          out.push({ id: r.id, status: r.status, text: (row2 && row2.data) || '' });
          pending -= 1;
          if (pending === 0) { db.close(); resolve(out.sort((a, b) => a.id - b.id)); }
        });
      }
    });
  });
}

async function main() {
  console.log('=== TEST COMPLET : LINKEDIN/REMOTIVE + HUGGINGFACE + SCENARIOS ACCEPT/REJECT ===\n');

  const admin = await postJSON(`${BASE}/api/auth/signin`, { username: 'admin', password: 'Admin2026!' });
  const adminToken = admin.body.token;
  const cand = await postJSON(`${BASE}/api/auth/signin`, { username: 'candidat1', password: 'Test2026!' });
  const candToken = cand.body.token;
  console.log('Login admin:', admin.status, '| Login candidat1:', cand.status);

  // --- 1) External offers (Remotive, PAS LinkedIn) ---
  console.log('\n--- 1) Offres externes (Remotive, alternative légale à LinkedIn) ---');
  const remotive = await get(`${BASE}/api/external-offers/remotive?search=java&limit=3`, adminToken);
  console.log('status:', remotive.status, '| nb offres:', Array.isArray(remotive.body) ? remotive.body.length : 'N/A');
  if (Array.isArray(remotive.body)) {
    remotive.body.forEach((o) => console.log(`  - [${o.source}] ${o.title} — ${o.companyName}`));
  }

  // --- 2) HuggingFace scoring integration check ---
  console.log('\n--- 2) Score IA HuggingFace (recompute sur candidat existant #32) ---');
  const recompute = await request(`${BASE}/api/candidates/32/ai-score/recompute`, {
    method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Length': '0' },
  });
  console.log('status:', recompute.status);
  console.log(JSON.stringify({
    aiScore: recompute.body.aiScore,
    aiScoreTechnical: recompute.body.aiScoreTechnical,
    aiScoreCommunication: recompute.body.aiScoreCommunication,
    aiScoreSeniorityMatch: recompute.body.aiScoreSeniorityMatch,
    aiScoreSource: recompute.body.aiScoreSource,
  }, null, 2));

  const offersRes = await get(`${BASE}/api/job-offers/public?page=0&size=3`);
  let offers = offersRes.body && offersRes.body.content ? offersRes.body.content : [];
  if (!offers.length) {
    const allOffers = await get(`${BASE}/api/job-offers?page=0&size=3`, adminToken);
    offers = allOffers.body && allOffers.body.content ? allOffers.body.content : [];
  }
  const offerId = offers.length ? offers[0].id : 123;

  const beforeExecId = await new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH);
    db.get('SELECT COALESCE(MAX(id),0) as m FROM execution_entity WHERE workflowId=?', [AGENT3_WF], (e, row) => { db.close(); resolve(row.m); });
  });

  // --- 3) Scenario ACCEPTED complet ---
  console.log('\n--- 3) Scénario CV ACCEPTÉ (score >= 60) ---');
  const ts = Date.now();
  const acceptEmail = `bargaouihaythem1+accept${ts}@gmail.com`;
  const applyAccept = await applyCandidate(candToken, offerId, 'Marie', 'Dupont', acceptEmail);
  console.log('apply status:', applyAccept.status, '| candidateId:', applyAccept.body.id);
  const acceptId = applyAccept.body.id;

  await sleep(2000);
  const forceScore85 = await patchNoBody(`${BASE}/api/candidates/${acceptId}/ai-score?score=85&summary=Excellent+profil&recommendation=EXCELLENT_MATCH`, null);
  console.log('force score=85 status:', forceScore85.status);
  await sleep(2000);
  const acceptFinal = await patchNoBody(`${BASE}/api/candidates/${acceptId}/status?status=ACCEPTED`, adminToken);
  console.log('final ACCEPTED status:', acceptFinal.status, '| result status:', acceptFinal.body.status);

  // --- 4) Scenario REJECTED complet ---
  console.log('\n--- 4) Scénario CV REJETÉ (score < 60) ---');
  const rejectEmail = `bargaouihaythem1+reject${ts}@gmail.com`;
  const applyReject = await applyCandidate(candToken, offerId, 'Paul', 'Martin', rejectEmail);
  console.log('apply status:', applyReject.status, '| candidateId:', applyReject.body.id);
  const rejectId = applyReject.body.id;

  await sleep(2000);
  const forceScore35 = await patchNoBody(`${BASE}/api/candidates/${rejectId}/ai-score?score=35&summary=Profil+insuffisant&recommendation=WEAK_MATCH`, null);
  console.log('force score=35 status:', forceScore35.status);
  const rejectCheck = await get(`${BASE}/api/candidates/${rejectId}`, adminToken);
  console.log('candidate status après score bas:', rejectCheck.body.status);

  await sleep(8000);

  // --- 5) Vérification exécutions Agent3 + contenu emails ---
  console.log('\n--- 5) Vérification exécutions Agent 3 (emails) ---');
  const execs = await getAgent3ExecsAfter(beforeExecId);
  console.log('Nouvelles exécutions Agent3:', execs.map((x) => `${x.id}:${x.status}`).join(', ') || 'aucune');

  function analyze(execArr, candidateId, label) {
    const related = execArr.filter((x) => x.text.includes(`"candidateId":${candidateId}`));
    if (!related.length) { console.log(`  [${label}] id=${candidateId} : AUCUNE exécution trouvée`); return; }
    const last = related[related.length - 1];
    const hasHtml = last.text.includes('emailManagerHtml') || last.text.includes('emailCandidatHtml');
    const timeout = last.text.includes('ETIMEDOUT');
    const smtpOk = last.text.includes('"response":"250');
    console.log(`  [${label}] id=${candidateId} exec=${last.id} status=${last.status} smtp_ok=${smtpOk} timeout=${timeout}`);
  }

  analyze(execs, acceptId, 'ACCEPTED');
  analyze(execs, rejectId, 'REJECTED');

  console.log('\n=== FIN DU TEST ===');
}

main().catch((e) => { console.error('TEST FAILED:', e.message); process.exit(1); });
