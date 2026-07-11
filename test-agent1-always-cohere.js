const http = require('http');
const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));

const BASE = 'http://localhost:8080';
const DB_PATH = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const AGENT1_WF = 'abHc50O9XFYNXIa8';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function request(pathname, options = {}, rawBody) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 8080, path: pathname, method: options.method || 'GET', headers: options.headers || {} }, (res) => {
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
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    r.on('error', (e) => resolve({ status: 0, body: e.message }));
    r.write(body);
    r.end();
  });
}

(async () => {
  console.log('=== TEST : Agent 1 doit toujours utiliser Cohere ===\n');

  const cand = await postJSON('/api/auth/signin', { username: 'candidat1', password: 'Test2026!' });
  const candToken = cand.body.token;
  const admin = await postJSON('/api/auth/signin', { username: 'admin', password: 'Admin2026!' });
  const adminToken = admin.body.token;

  const coverLetter = "Fort de 6 annees d'experience en developpement Java Spring Boot, j'ai dirige des projets " +
    "de microservices. Je maitrise Spring Boot, Hibernate, PostgreSQL, Docker et les architectures REST. " +
    "Ma communication ecrite est structuree et orientee resultats.";

  const ts = Date.now();
  const apply = await applyCandidate(candToken, 123, 'Cohere', 'Test', `bargaouihaythem1+coheretest${ts}@gmail.com`, coverLetter);
  console.log('Candidature soumise:', apply.status, '| candidateId:', apply.body.id);
  const candidateId = apply.body.id;

  console.log('Attente traitement Agent 1 (webhook async + Cohere)...');
  await sleep(9000);

  const check = await get(`/api/candidates/${candidateId}`, adminToken);
  console.log('\n=== Resultat candidat apres Agent 1 ===');
  console.log(JSON.stringify({
    aiScore: check.body.aiScore,
    aiScoreTechnical: check.body.aiScoreTechnical,
    aiScoreCommunication: check.body.aiScoreCommunication,
    aiScoreSeniorityMatch: check.body.aiScoreSeniorityMatch,
    aiScoreSource: check.body.aiScoreSource,
    aiSummary: check.body.aiSummary,
    status: check.body.status,
  }, null, 2));

  if (check.body.aiScoreSource === 'COHERE') {
    console.log('\n✅ SUCCES : Agent 1 a bien utilise Cohere (aiScoreSource=COHERE)');
  } else {
    console.log('\n❌ ECHEC : aiScoreSource =', check.body.aiScoreSource, '(attendu COHERE)');
  }

  // Verifier l'execution n8n
  const db = new sqlite3.Database(DB_PATH);
  db.all('SELECT id, status FROM execution_entity WHERE workflowId=? ORDER BY id DESC LIMIT 2', [AGENT1_WF], (err, rows) => {
    console.log('\nDernieres executions Agent 1:', rows);
    db.close();
  });
})();
