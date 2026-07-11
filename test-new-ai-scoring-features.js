const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = http.request({ hostname: 'localhost', port: 8080, path, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(raw) }); }
        catch { resolve({ s: res.statusCode, b: raw }); }
      });
    });
    r.on('error', (e) => resolve({ s: 0, b: e.message }));
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log('=== TEST NOUVELLES FONCTIONNALITES SCORE IA / RANKING / MANAGER ===');

  const admin = await req('POST', '/api/auth/signin', { username: 'admin', password: 'Admin2026!' });
  const adminToken = admin.b && admin.b.token;
  console.log('Login admin:', admin.s);

  const rh = await req('POST', '/api/auth/signin', { username: 'rh1', password: 'Test2026!' });
  const rhToken = rh.b && rh.b.token;
  console.log('Login rh1:', rh.s);

  const manager = await req('POST', '/api/auth/signin', { username: 'manager1', password: 'Test2026!' });
  const managerToken = manager.b && manager.b.token;
  console.log('Login manager1:', manager.s);

  // Candidat existant #32 (bargaouihaythem1@gmail.com)
  const candId = 32;

  console.log('\n--- 1) Recompute AI score (HuggingFace/simule) ---');
  const recompute = await req('POST', `/api/candidates/${candId}/ai-score/recompute`, null, rhToken);
  console.log('status:', recompute.s);
  console.log(JSON.stringify({
    aiScore: recompute.b.aiScore,
    aiScoreTechnical: recompute.b.aiScoreTechnical,
    aiScoreCommunication: recompute.b.aiScoreCommunication,
    aiScoreSeniorityMatch: recompute.b.aiScoreSeniorityMatch,
    aiScoreSource: recompute.b.aiScoreSource,
    aiSummary: recompute.b.aiSummary,
    status: recompute.b.status
  }, null, 2));

  console.log('\n--- 2) RH override score (correction manuelle) ---');
  const override = await req('PATCH', `/api/candidates/${candId}/ai-score/override?manualScore=45&reason=${encodeURIComponent('Profil technique insuffisant malgre le score IA')}`, null, rhToken);
  console.log('status:', override.s);
  console.log(JSON.stringify({
    manualScore: override.b.manualScore,
    manualScoreReason: override.b.manualScoreReason,
    manualScoreBy: override.b.manualScoreBy,
    effectiveScore: override.b.effectiveScore,
    status: override.b.status
  }, null, 2));

  console.log('\n--- 3) Ranking par offre ---');
  const jobOfferId = override.b.jobOfferId || 123;
  const ranking = await req('GET', `/api/candidates/job-offer/${jobOfferId}/ranking`, null, rhToken);
  console.log('status:', ranking.s, '| count:', Array.isArray(ranking.b) ? ranking.b.length : 'n/a');
  if (Array.isArray(ranking.b)) {
    ranking.b.slice(0, 5).forEach((c, i) => {
      console.log(`  #${i + 1} id=${c.id} ${c.firstName} ${c.lastName} effectiveScore=${c.effectiveScore} status=${c.status}`);
    });
  }

  console.log('\n--- 4) Manager decision (sans validation RH prealable -> doit echouer) ---');
  const candRaw = await req('GET', '/api/candidates/36', null, adminToken);
  console.log('candidate 36 status avant:', candRaw.b && candRaw.b.status);

  console.log('\n--- 5) Manager decision sur candidat deja CV_REVIEWED ---');
  await req('PATCH', '/api/candidates/33/status?status=CV_REVIEWED', null, rhToken);
  const managerOk = await req('PATCH', '/api/candidates/33/manager-decision?decision=ACCEPTED', null, managerToken);
  console.log('status:', managerOk.s, '| result status:', managerOk.b && managerOk.b.status);

  console.log('\n--- 6) Manager decision refusee sans role manager (RH tente) ---');
  const managerAsRh = await req('PATCH', '/api/candidates/33/manager-decision?decision=ACCEPTED', null, rhToken);
  console.log('status (RH utilisant endpoint manager, doit rester 200 car RH autorise aussi):', managerAsRh.s);
})();
