/**
 * Test complet des 3 agents n8n via l API Spring Boot
 * Flux: Candidature => Agent1 => Validation RH => Agent2 => Entretien => Agent3
 */
const http = require('http');

const BASE = 'http://localhost:8080';
const N8N  = 'http://localhost:5678';

function req(url, options, rawBody) {
  options = options || {};
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var opt = {
      hostname: u.hostname,
      port: parseInt(u.port) || 80,
      path: u.pathname + (u.search || ''),
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    var r = http.request(opt, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var data = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (rawBody) r.write(rawBody);
    r.end();
  });
}

function postJSON(url, body, token) {
  var jsonStr = JSON.stringify(body);
  return req(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(jsonStr) }, token ? { Authorization: 'Bearer ' + token } : {})
  }, jsonStr);
}

function getJSON(url, token) {
  return req(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
}

function patchStatus(candidateId, status, token) {
  var url = BASE + '/api/candidates/' + candidateId + '/status?status=' + status;
  return req(url, {
    method: 'PATCH',
    headers: { 'Content-Length': '0', Authorization: 'Bearer ' + token }
  });
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function testWebhookDirect(webhookPath, body) {
  var bodyStr = JSON.stringify(body);
  var r = await req(N8N + '/webhook/' + webhookPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
  }, bodyStr);
  var label = r.status === 200 ? 'OK' : (r.status === 404 ? 'NON ENREGISTRE' : 'HTTP ' + r.status + ' (exec error)');
  console.log('  Webhook /' + webhookPath + ': HTTP ' + r.status + ' => ' + label);
  return r;
}

async function runBilan() {
  console.log('\n==================================================');
  console.log('  BILAN -- Verification webhooks n8n');
  console.log('==================================================');
  for (var entry of [['Agent 1 -- CV Parser', 'agent1-cv-parser'], ['Agent 2 -- RH Manager', 'agent2-rh-manager'], ['Agent 3 -- Entretien', 'agent3-entretien']]) {
    await testWebhookDirect(entry[1], { event: 'PING', candidatId: 99, email: 'ping@test.com', nom: 'Test', prenom: 'Ping', offreTitre: 'Test', cvUrl: 'http://test.pdf' });
  }
  console.log('\n  Tests termines!');
  console.log('  -> Logs n8n: http://localhost:5678');
  console.log('  -> Interface: http://localhost:4200\n');
}

async function main() {
  console.log('\n==================================================');
  console.log('  TEST COMPLET DES 3 AGENTS N8N');
  console.log('==================================================\n');

  // LOGIN
  console.log('1. Connexion...');
  var adminR = await postJSON(BASE + '/api/auth/signin', { username: 'admin', password: 'Admin2026!' });
  var adminToken = adminR.body.token;
  if (!adminToken) { console.error('  ECHEC login admin:', adminR.body); process.exit(1); }
  var adminId = adminR.body.id;
  console.log('  OK admin (ID=' + adminId + ')');

  var c1R = await postJSON(BASE + '/api/auth/signin', { username: 'candidat1', password: 'Test2026!' });
  var c1Token = c1R.body.token;
  if (!c1Token) { console.error('  ECHEC login candidat1:', c1R.body); process.exit(1); }
  console.log('  OK candidat1 (ID=' + c1R.body.id + ')');

  var rh1R = await postJSON(BASE + '/api/auth/signin', { username: 'rh1', password: 'Test2026!' });
  console.log('  OK rh1');

  // OFFRES
  console.log('\n2. Offres disponibles...');
  var offresR = await getJSON(BASE + '/api/job-offers', adminToken);
  var offres = Array.isArray(offresR.body) ? offresR.body : (offresR.body && offresR.body.content ? offresR.body.content : []);
  if (!offres.length) { console.error('  Aucune offre disponible'); process.exit(1); }
  var offre = offres[0];
  console.log('  Offre: ID=' + offre.id + ' -- ' + offre.title);

  // AGENT 1: Soumettre candidature
  console.log('\n3. TEST AGENT 1 -- Soumission candidature...');

  var pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n192\n%%EOF');

  var boundary = '----FormBoundary' + Date.now();
  var applicationJson = JSON.stringify({
    firstName: 'Test', lastName: 'Candidat',
    email: 'candidat1@test.com', phone: '0600000000',
    address: 'Paris, France',
    coverLetter: 'Je suis passionne par ce poste. Competences: Java 17, Spring Boot 3, Angular 20, PostgreSQL, Docker.',
    jobOfferId: offre.id
  });

  var part1 = '--' + boundary + '\r\nContent-Disposition: form-data; name="application"\r\n\r\n' + applicationJson + '\r\n';
  var part2Header = '--' + boundary + '\r\nContent-Disposition: form-data; name="cv"; filename="cv-test.pdf"\r\nContent-Type: application/pdf\r\n\r\n';
  var part2Footer = '\r\n--' + boundary + '--\r\n';

  var bodyBuf = Buffer.concat([Buffer.from(part1), Buffer.from(part2Header), pdfContent, Buffer.from(part2Footer)]);

  var applyR = await req(BASE + '/api/candidates/apply', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + c1Token,
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': bodyBuf.length
    }
  }, bodyBuf);

  if (applyR.status !== 200 && applyR.status !== 201) {
    console.error('  ECHEC candidature (HTTP ' + applyR.status + '):', JSON.stringify(applyR.body).substring(0, 300));
    console.log('  -> Test direct webhook Agent 1...');
    await testWebhookDirect('agent1-cv-parser', { event: 'CV_SOUMIS', candidatId: 1, email: 'candidat1@test.com', nom: 'Candidat', prenom: 'Test', offreTitre: offre.title, cvUrl: 'http://localhost:8080/api/files/test.pdf' });
    await runBilan();
    return;
  }

  var cand = applyR.body;
  console.log('  Candidature creee! ID=' + cand.id + ' Status=' + cand.status);
  console.log('  Agent 1 declenche par Spring Boot automatiquement');
  console.log('  Attente 6s que Agent 1 traite...');
  await sleep(6000);

  var candR = await getJSON(BASE + '/api/candidates/' + cand.id, adminToken);
  if (candR.body && candR.body.aiScore !== undefined) {
    console.log('  Score IA: ' + candR.body.aiScore + ' | Status: ' + candR.body.status);
    if (candR.body.aiSummary) console.log('  Resume IA: ' + String(candR.body.aiSummary).substring(0, 100) + '...');
  } else {
    console.log('  Score IA pas encore disponible (Agent 1 peut etre asynchrone)');
  }

  var candId = cand.id;

  // AGENT 2: Validation RH
  console.log('\n4. TEST AGENT 2 -- Validation RH (status => CV_REVIEWED)...');
  var validateR = await patchStatus(candId, 'CV_REVIEWED', adminToken);

  if (validateR.status === 200) {
    console.log('  Status change => CV_REVIEWED (Agent 2 declenche)');
    console.log('  Attente 4s...');
    await sleep(4000);
  } else {
    console.log('  ECHEC changement status (HTTP ' + validateR.status + '):', JSON.stringify(validateR.body).substring(0, 150));
    console.log('  -> Test direct webhook Agent 2...');
    await testWebhookDirect('agent2-rh-manager', { event: 'CV_REVIEWED', candidatId: candId, email: 'candidat1@test.com', nom: 'Candidat', prenom: 'Test', offreTitre: offre.title, score: 75 });
  }

  // Recuperer interviewer
  console.log('\n5. TEST AGENT 3 -- Planification entretien...');
  var interviewerId = adminId;
  var intvsR = await getJSON(BASE + '/api/users/interviewers', adminToken);
  if (intvsR.status === 200 && Array.isArray(intvsR.body) && intvsR.body.length > 0) {
    interviewerId = intvsR.body[0].id;
    console.log('  Interviewer: ID=' + interviewerId);
  } else {
    console.log('  Pas interviewer specifique, utilisation admin (ID=' + interviewerId + ')');
  }

  var dateEntretien = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, '');

  var interviewR = await postJSON(BASE + '/api/interviews', {
    interviewDate: dateEntretien,
    type: 'TECHNICAL',
    status: 'SCHEDULED',
    notes: 'Entretien technique - test automatique agents n8n',
    durationMinutes: 60,
    location: 'Salle de reunion A - Paris',
    candidateId: candId,
    interviewerId: interviewerId
  }, adminToken);

  if (interviewR.status === 200 || interviewR.status === 201) {
    console.log('  Entretien planifie! ID=' + interviewR.body.id + ' (Agent 3 declenche)');
    console.log('  Attente 4s...');
    await sleep(4000);
  } else {
    console.log('  ECHEC planification (HTTP ' + interviewR.status + '):', JSON.stringify(interviewR.body).substring(0, 200));
    console.log('  -> Test direct webhook Agent 3...');
    await testWebhookDirect('agent3-entretien', { event: 'ENTRETIEN_PLANIFIE', candidatId: candId, email: 'candidat1@test.com', nom: 'Candidat', prenom: 'Test', offreTitre: offre.title, dateEntretien: dateEntretien, lieu: 'Paris' });
  }

  await runBilan();
}

main().catch(function(e) { console.error('ERREUR:', e.message); process.exit(1); });
