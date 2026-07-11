const http = require('http');
const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));

const BASE = 'http://localhost:8080';
const DB_PATH = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const AGENT3_WF = 'vuIc7XWE1gcN4hBG';

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

function getMaxExecutionId() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.get('SELECT COALESCE(MAX(id),0) AS maxId FROM execution_entity WHERE workflowId=?', [AGENT3_WF], (err, row) => {
      db.close();
      if (err) return reject(err);
      resolve(row.maxId || 0);
    });
  });
}

function getNewAgent3Executions(fromId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.all(
      'SELECT id, status, startedAt, stoppedAt FROM execution_entity WHERE workflowId=? AND id>? ORDER BY id ASC',
      [AGENT3_WF, fromId],
      (err, rows) => {
        if (err) {
          db.close();
          return reject(err);
        }

        if (!rows.length) {
          db.close();
          resolve([]);
          return;
        }

        const out = [];
        let pending = rows.length;

        for (const r of rows) {
          db.get('SELECT data FROM execution_data WHERE executionId=?', [r.id], (e2, row2) => {
            const text = (row2 && row2.data) || '';
            out.push({
              id: r.id,
              status: r.status,
              startedAt: r.startedAt,
              text,
            });

            pending -= 1;
            if (pending === 0) {
              db.close();
              resolve(out.sort((a, b) => a.id - b.id));
            }
          });
        }
      }
    );
  });
}

async function applyCandidate(candidateToken, offerId, firstName, lastName, email) {
  const boundary = '----FormBoundary' + Date.now() + Math.floor(Math.random() * 1000);
  const appJson = JSON.stringify({
    firstName,
    lastName,
    email,
    phone: '0600000000',
    address: 'Paris, France',
    coverLetter: 'Test email success/reject via Agent3',
    jobOfferId: offerId,
  });

  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n192\n%%EOF');

  const part1 = `--${boundary}\r\nContent-Disposition: form-data; name="application"\r\n\r\n${appJson}\r\n`;
  const part2h = `--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="cv-test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(part1), Buffer.from(part2h), pdfContent, Buffer.from(end)]);

  return request(`${BASE}/api/candidates/apply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${candidateToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
  }, body);
}

function summarizeMailResult(execs, candidateId, expectedStatus) {
  const keyStatus = expectedStatus === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED';
  const byCandidate = execs.filter((x) => x.text.includes(`"candidateId":${candidateId}`) || x.text.includes(`"candidateId":${String(candidateId)}`));
  const byStatus = byCandidate.filter((x) => x.text.includes(keyStatus));
  const target = byStatus.length ? byStatus[byStatus.length - 1] : (byCandidate.length ? byCandidate[byCandidate.length - 1] : null);

  if (!target) {
    return { found: false, executionId: null, transport: 'unknown', note: 'Aucune execution Agent3 liee trouvee' };
  }

  const timeout = target.text.includes('ETIMEDOUT') || target.text.includes('connect ETIMEDOUT');
  const authErr = target.text.includes('EAUTH') || target.text.includes('Invalid login');
  const refused = target.text.includes('ECONNREFUSED');

  let transport = 'sent_or_not_observable';
  if (timeout) transport = 'smtp_timeout';
  else if (authErr) transport = 'smtp_auth_error';
  else if (refused) transport = 'smtp_refused';

  return {
    found: true,
    executionId: target.id,
    status: target.status,
    transport,
    note: `execution ${target.id} (${target.status})`,
  };
}

async function main() {
  console.log('=== TEST EMAIL SUCCESS + REJECT AVEC NOUVEAUX CANDIDATS ===');

  const beforeExecId = await getMaxExecutionId();
  console.log('Agent3 max execution before:', beforeExecId);

  const adminLogin = await postJSON(`${BASE}/api/auth/signin`, { username: 'admin', password: 'Admin2026!' });
  if (adminLogin.status !== 200 || !adminLogin.body.token) throw new Error('Login admin failed');
  const adminToken = adminLogin.body.token;

  const candLogin = await postJSON(`${BASE}/api/auth/signin`, { username: 'candidat1', password: 'Test2026!' });
  if (candLogin.status !== 200 || !candLogin.body.token) throw new Error('Login candidat1 failed');
  const candidateToken = candLogin.body.token;

  const offersRes = await get(`${BASE}/api/job-offers/public?page=0&size=3`);
  let offers = offersRes.body && offersRes.body.content
    ? offersRes.body.content
    : (Array.isArray(offersRes.body) ? offersRes.body : []);
  if (!offers.length) {
    const allOffers = await get(`${BASE}/api/job-offers?page=0&size=3`, adminToken);
    offers = allOffers.body && allOffers.body.content
      ? allOffers.body.content
      : (Array.isArray(allOffers.body) ? allOffers.body : []);
  }
  const offerId = offers.length ? offers[0].id : 123;

  const ts = Date.now();
  const targetEmail = `bargaouihaythem1+success${ts}@gmail.com`;
  const targetEmailReject = `bargaouihaythem1+reject${ts}@gmail.com`;
  const applySuccess = await applyCandidate(candidateToken, offerId, `Success${ts}`, 'Mail', targetEmail);
  if (![200, 201].includes(applySuccess.status)) throw new Error('Apply success candidate failed: ' + applySuccess.status);
  const successCandidateId = applySuccess.body.id;
  console.log('Created success candidate ID:', successCandidateId);

  await sleep(5000);
  await patchNoBody(`${BASE}/api/candidates/${successCandidateId}/status?status=CV_REVIEWED`, adminToken);
  await sleep(2000);
  const acceptRes = await patchNoBody(`${BASE}/api/candidates/${successCandidateId}/status?status=ACCEPTED`, adminToken);
  console.log('ACCEPTED patch status:', acceptRes.status);

  const applyReject = await applyCandidate(candidateToken, offerId, `Reject${ts}`, 'Mail', targetEmailReject);
  if (![200, 201].includes(applyReject.status)) throw new Error('Apply reject candidate failed: ' + applyReject.status);
  const rejectCandidateId = applyReject.body.id;
  console.log('Created reject candidate ID:', rejectCandidateId);

  await sleep(5000);
  await patchNoBody(`${BASE}/api/candidates/${rejectCandidateId}/status?status=CV_REVIEWED`, adminToken);
  await sleep(2000);
  const rejectRes = await patchNoBody(`${BASE}/api/candidates/${rejectCandidateId}/status?status=REJECTED`, adminToken);
  console.log('REJECTED patch status:', rejectRes.status);

  await sleep(7000);

  const newExecs = await getNewAgent3Executions(beforeExecId);
  console.log('New Agent3 executions:', newExecs.map((x) => `${x.id}:${x.status}`).join(', ') || 'none');

  const successMail = summarizeMailResult(newExecs, successCandidateId, 'ACCEPTED');
  const rejectMail = summarizeMailResult(newExecs, rejectCandidateId, 'REJECTED');

  console.log('\n=== RESULTAT ===');
  console.log('Target email success:', targetEmail);
  console.log('Target email reject:', targetEmailReject);
  console.log('SUCCESS case (ACCEPTED):', successMail);
  console.log('REJECT case (REJECTED):', rejectMail);

  if (!successMail.found || !rejectMail.found) {
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});
