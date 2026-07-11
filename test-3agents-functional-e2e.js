const http = require('http');
const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));

const BASE = 'http://localhost:8080';
const DB_PATH = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');

const WF = {
  agent1: 'abHc50O9XFYNXIa8',
  agent2: 'aDlMEwef9SLGf0Xd',
  agent3: 'vuIc7XWE1gcN4hBG',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(url, options = {}, rawBody) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: Number(u.port || 80),
      path: u.pathname + (u.search || ''),
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (rawBody) req.write(rawBody);
    req.end();
  });
}

function postJSON(url, body, token) {
  const payload = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
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

function getExecCounts() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.all(
      'SELECT workflowId, status, COUNT(*) AS c FROM execution_entity WHERE workflowId IN (?,?,?) GROUP BY workflowId, status',
      [WF.agent1, WF.agent2, WF.agent3],
      (err, rows) => {
        db.close();
        if (err) return reject(err);
        const out = {
          agent1: { success: 0, error: 0 },
          agent2: { success: 0, error: 0 },
          agent3: { success: 0, error: 0 },
        };
        for (const r of rows) {
          const k = r.workflowId === WF.agent1 ? 'agent1' : (r.workflowId === WF.agent2 ? 'agent2' : 'agent3');
          out[k][r.status] = Number(r.c);
        }
        resolve(out);
      }
    );
  });
}

function diffCounts(before, after) {
  const out = {};
  for (const k of ['agent1', 'agent2', 'agent3']) {
    out[k] = {
      success: (after[k].success || 0) - (before[k].success || 0),
      error: (after[k].error || 0) - (before[k].error || 0),
    };
  }
  return out;
}

async function main() {
  console.log('=== TEST E2E FONCTIONNEL DES 3 AGENTS ===');

  const before = await getExecCounts();
  console.log('Exec before:', before);

  const login = await postJSON(`${BASE}/api/auth/signin`, { username: 'admin', password: 'Admin2026!' });
  if (login.status !== 200 || !login.body.token) {
    throw new Error(`Login admin failed: ${login.status}`);
  }
  const token = login.body.token;

  let offersRes = await get(`${BASE}/api/job-offers/public?page=0&size=5`);
  let offers = offersRes.body && offersRes.body.content ? offersRes.body.content : [];
  if (!offers.length) {
    offersRes = await get(`${BASE}/api/job-offers?page=0&size=5`, token);
    offers = offersRes.body && offersRes.body.content ? offersRes.body.content : (Array.isArray(offersRes.body) ? offersRes.body : []);
  }
  if (!offers.length) throw new Error('No job offer available');
  const offer = offers[0];
  console.log(`Using offer #${offer.id}: ${offer.title}`);

  const cLogin = await postJSON(`${BASE}/api/auth/signin`, { username: 'candidat1', password: 'Test2026!' });
  if (cLogin.status !== 200 || !cLogin.body.token) {
    throw new Error(`Login candidat1 failed: ${cLogin.status}`);
  }

  // 1) Agent 1 via candidature
  const boundary = '----FormBoundary' + Date.now();
  const uniqueEmail = `qa.e2e.${Date.now()}@test.com`;
  const appJson = JSON.stringify({
    firstName: 'QA',
    lastName: 'E2E',
    email: uniqueEmail,
    phone: '0600000000',
    address: 'Paris',
    coverLetter: 'Profil test automatique pour validation agent1/2/3.',
    jobOfferId: offer.id,
  });

  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n192\n%%EOF');

  const part1 = `--${boundary}\r\nContent-Disposition: form-data; name="application"\r\n\r\n${appJson}\r\n`;
  const part2h = `--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="cv-test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(part1), Buffer.from(part2h), pdfContent, Buffer.from(end)]);

  const apply = await request(`${BASE}/api/candidates/apply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cLogin.body.token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
  }, body);

  if (![200, 201].includes(apply.status)) {
    throw new Error(`Apply failed ${apply.status}: ${JSON.stringify(apply.body).slice(0, 200)}`);
  }

  const candidateId = apply.body.id;
  console.log(`Candidate created: #${candidateId}`);

  await sleep(14000);
  const cAfterA1 = await get(`${BASE}/api/candidates/${candidateId}`, token);
  const hasScore = cAfterA1.status === 200 && cAfterA1.body && cAfterA1.body.aiScore !== null && cAfterA1.body.aiScore !== undefined;
  console.log('Agent1 result aiScore:', cAfterA1.body.aiScore, '| status:', cAfterA1.body.status);

  // 2) Agent 2 + Agent 3 dossier validation via CV_REVIEWED
  const toReviewed = await patchNoBody(`${BASE}/api/candidates/${candidateId}/status?status=CV_REVIEWED`, token);
  console.log('Patch CV_REVIEWED status:', toReviewed.status);
  await sleep(4000);

  // 3) Agent 2 entretien via creation interview
  const interviewers = await get(`${BASE}/api/users/interviewers`, token);
  const interviewerId = Array.isArray(interviewers.body) && interviewers.body.length ? interviewers.body[0].id : login.body.id;
  const interviewDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, '');
  const createInterview = await postJSON(`${BASE}/api/interviews`, {
    interviewDate,
    type: 'TECHNICAL',
    status: 'SCHEDULED',
    notes: 'Entretien technique E2E',
    durationMinutes: 45,
    location: 'Salle A',
    candidateId,
    interviewerId,
  }, token);
  console.log('Create interview status:', createInterview.status, '| interviewId:', createInterview.body && createInterview.body.id);
  await sleep(4000);

  // 4) Agent 3 decision finale reject then accept
  const toRejected = await patchNoBody(`${BASE}/api/candidates/${candidateId}/status?status=REJECTED`, token);
  console.log('Patch REJECTED status:', toRejected.status);
  await sleep(3500);

  const backReviewed = await patchNoBody(`${BASE}/api/candidates/${candidateId}/status?status=CV_REVIEWED`, token);
  console.log('Patch back CV_REVIEWED status:', backReviewed.status);
  await sleep(2000);

  const toAccepted = await patchNoBody(`${BASE}/api/candidates/${candidateId}/status?status=ACCEPTED`, token);
  console.log('Patch ACCEPTED status:', toAccepted.status);
  await sleep(3500);

  const finalCandidate = await get(`${BASE}/api/candidates/${candidateId}`, token);
  console.log('Final candidate status:', finalCandidate.body && finalCandidate.body.status);

  const after = await getExecCounts();
  const delta = diffCounts(before, after);

  console.log('\n=== DELTA EXECUTIONS ===');
  console.log(JSON.stringify(delta, null, 2));

  console.log('\n=== VERDICT ===');
  console.log(`Agent 1 triggered: ${delta.agent1.success + delta.agent1.error > 0 ? 'YES' : 'NO'}`);
  console.log(`Agent 2 triggered: ${delta.agent2.success + delta.agent2.error > 0 ? 'YES' : 'NO'}`);
  console.log(`Agent 3 triggered: ${delta.agent3.success + delta.agent3.error > 0 ? 'YES' : 'NO'}`);
  console.log(`Agent 1 scoring applied: ${hasScore ? 'YES' : 'NO'}`);
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});
