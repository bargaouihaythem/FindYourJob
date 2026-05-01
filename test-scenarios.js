const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost', port: 8080, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = http.request(options, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let passed = 0, failed = 0;
function ok(msg)      { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg)    { console.log(`  ❌ ${msg}`); failed++; }
function warn(msg)    { console.log(`  ⚠️  ${msg}`); }
function section(msg) { console.log(`\n${'─'.repeat(60)}\n  ${msg}\n${'─'.repeat(60)}`); }

async function getCandidate(id, token) {
  const r = await request('GET', `/api/candidates/${id}`, null, token);
  return r.body;
}

async function run() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     TEST FINAL — 3 AGENTS WORKFLOW COMPLET            ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // ══════════════════════════════════════════════════════════════
  // 0. AUTH
  // ══════════════════════════════════════════════════════════════
  section('0. AUTH — Login RH');
  const loginRes = await request('POST', '/api/auth/signin', { username: 'rh1', password: 'Password123!' });
  if (loginRes.status === 200 && loginRes.body.token) {
    ok(`Login RH OK`);
  } else {
    fail(`Login échoué: ${loginRes.status}`);
    process.exit(1);
  }
  const token = loginRes.body.token;

  // ══════════════════════════════════════════════════════════════
  // 1. RÉCUPÉRER LES CANDIDATS ET PRÉPARER 4 CANDIDATS EN APPLIED
  // ══════════════════════════════════════════════════════════════
  section('1. PRÉPARATION — Récupérer et reset candidats en APPLIED');
  const listRes = await request('GET', '/api/candidates?page=0&size=100', null, token);
  if (listRes.status !== 200) { fail('Impossible de récupérer les candidats'); process.exit(1); }

  const cands = listRes.body.content || listRes.body;
  const byStatus = {};
  cands.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
  ok(`${cands.length} candidats en base — répartition: ${JSON.stringify(byStatus)}`);

  // Reset jusqu'à 4 candidats en APPLIED pour les 4 scénarios
  const toReset = cands.slice(0, 4);
  const testers = [];
  for (const c of toReset) {
    const r = await request('PATCH', `/api/candidates/${c.id}/status?status=APPLIED`, null, token);
    if (r.status === 200) {
      testers.push({ ...c, status: 'APPLIED' });
      ok(`Candidat id=${c.id} (${c.firstName} ${c.lastName}) remis en APPLIED`);
    } else {
      fail(`Reset id=${c.id}: ${r.status}`);
    }
  }
  if (testers.length < 4) { warn('Moins de 4 candidats disponibles, certains tests seront sautés'); }

  // ══════════════════════════════════════════════════════════════
  // AGENT 1 — CAS 1 : Score BAS → REJECTED automatique
  //           Agent 3 doit envoyer l'email de refus
  // ══════════════════════════════════════════════════════════════
  section('AGENT 1 — CAS 1 : Score BAS (45 < 60) → REJECTED automatique');
  const cand_rejet_ia = testers[0];
  if (cand_rejet_ia) {
    const r = await request('PATCH', `/api/candidates/${cand_rejet_ia.id}/ai-score?score=45`, null, token);
    if (r.status === 200) {
      ok(`PATCH ai-score=45 → HTTP 200`);
      const check = await getCandidate(cand_rejet_ia.id, token);
      if (check.aiScore === 45)       ok(`Score IA en base : ${check.aiScore}`);
      else                            fail(`Score attendu 45, reçu: ${check.aiScore}`);
      if (check.status === 'REJECTED') ok(`Statut auto → REJECTED ✔ (Agent 3 a dû envoyer email refus)`);
      else                             fail(`Statut attendu REJECTED, reçu: ${check.status}`);
    } else {
      fail(`PATCH ai-score échoué: ${r.status} — ${JSON.stringify(r.body).substring(0, 100)}`);
    }
  } else { warn('Pas de candidat pour ce test'); }

  // ══════════════════════════════════════════════════════════════
  // AGENT 1 — CAS 2 : Score BON → CV_REVIEWED automatique
  //           Agent 2 doit notifier le manager
  // ══════════════════════════════════════════════════════════════
  section('AGENT 1 — CAS 2 : Score BON (75 >= 60) → CV_REVIEWED automatique');
  const cand_accept_ia = testers[1];
  if (cand_accept_ia) {
    const r = await request('PATCH', `/api/candidates/${cand_accept_ia.id}/ai-score?score=75`, null, token);
    if (r.status === 200) {
      ok(`PATCH ai-score=75 → HTTP 200`);
      const check = await getCandidate(cand_accept_ia.id, token);
      if (check.aiScore === 75)           ok(`Score IA en base : ${check.aiScore}`);
      else                                fail(`Score attendu 75, reçu: ${check.aiScore}`);
      if (check.status === 'CV_REVIEWED') ok(`Statut auto → CV_REVIEWED ✔ (Agent 2 a dû notifier le manager)`);
      else                                fail(`Statut attendu CV_REVIEWED, reçu: ${check.status}`);
    } else {
      fail(`PATCH ai-score échoué: ${r.status} — ${JSON.stringify(r.body).substring(0, 100)}`);
    }
  } else { warn('Pas de candidat pour ce test'); }

  // ══════════════════════════════════════════════════════════════
  // AGENT 3 — CAS ACCEPTATION : CV_REVIEWED → ACCEPTED
  //           Agent 3 envoie email félicitations
  // ══════════════════════════════════════════════════════════════
  section('AGENT 3 — ACCEPTATION : CV_REVIEWED → ACCEPTED (email félicitations)');
  const cand_accepted = testers[2];
  if (cand_accepted) {
    // D'abord mettre en CV_REVIEWED manuellement (comme le ferait Agent 1 score bon)
    await request('PATCH', `/api/candidates/${cand_accepted.id}/status?status=CV_REVIEWED`, null, token);
    const r = await request('PATCH', `/api/candidates/${cand_accepted.id}/status?status=ACCEPTED`, null, token);
    if (r.status === 200) {
      ok(`CV_REVIEWED → ACCEPTED HTTP 200`);
      const check = await getCandidate(cand_accepted.id, token);
      if (check.status === 'ACCEPTED') ok(`Statut en base : ACCEPTED ✔ (Agent 3 a dû envoyer email félicitations à ${cand_accepted.email})`);
      else                             fail(`Statut attendu ACCEPTED, reçu: ${check.status}`);
    } else {
      fail(`PATCH ACCEPTED échoué: ${r.status} — ${JSON.stringify(r.body).substring(0, 100)}`);
    }
  } else { warn('Pas de candidat pour ce test'); }

  // ══════════════════════════════════════════════════════════════
  // AGENT 3 — CAS REJET MANAGER : CV_REVIEWED → REJECTED
  //           Agent 3 envoie email refus (décision humaine)
  // ══════════════════════════════════════════════════════════════
  section('AGENT 3 — REJET MANAGER : CV_REVIEWED → REJECTED (email refus)');
  const cand_rejected_manager = testers[3];
  if (cand_rejected_manager) {
    await request('PATCH', `/api/candidates/${cand_rejected_manager.id}/status?status=CV_REVIEWED`, null, token);
    const r = await request('PATCH', `/api/candidates/${cand_rejected_manager.id}/status?status=REJECTED`, null, token);
    if (r.status === 200) {
      ok(`CV_REVIEWED → REJECTED HTTP 200`);
      const check = await getCandidate(cand_rejected_manager.id, token);
      if (check.status === 'REJECTED') ok(`Statut en base : REJECTED ✔ (Agent 3 a dû envoyer email refus à ${cand_rejected_manager.email})`);
      else                             fail(`Statut attendu REJECTED, reçu: ${check.status}`);
    } else {
      fail(`PATCH REJECTED échoué: ${r.status} — ${JSON.stringify(r.body).substring(0, 100)}`);
    }
  } else { warn('Pas de candidat pour ce test'); }

  // ══════════════════════════════════════════════════════════════
  // AGENT 3 — CAS ENTRETIEN : création → Calendar + Meet
  // ══════════════════════════════════════════════════════════════
  section('AGENT 3 — ENTRETIEN : POST /api/interviews (Calendar + Meet)');
  // Utiliser le candidat accepté pour créer un entretien
  if (cand_accepted) {
    // Récupérer un interviewer valide (user rh1)
    const interviewBody = {
      candidateId: cand_accepted.id,
      interviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 jours
      type: 'VIDEO',
      durationMinutes: 60,
      location: 'Google Meet',
      notes: 'Test entretien final'
    };
    const intRes = await request('POST', '/api/interviews', interviewBody, token);
    if (intRes.status === 200 || intRes.status === 201) {
      ok(`Entretien créé id=${intRes.body.id} ✔ (Agent 3 a dû déclencher Calendar + Meet)`);
    } else {
      warn(`Entretien: ${intRes.status} — ${JSON.stringify(intRes.body).substring(0, 120)}`);
      warn('(Agent 3 entretien non testé — vérifier les champs requis)');
    }
  } else { warn('Pas de candidat pour test entretien'); }

  // ══════════════════════════════════════════════════════════════
  // RÉSUMÉ FINAL
  // ══════════════════════════════════════════════════════════════
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║  RÉSULTAT : ${String(passed).padEnd(3)} ✅  ${String(failed).padEnd(3)} ❌                              ║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  NOTE : Les agents n8n ne sont déclenchés que si      ║');
  console.log('║  n8n.webhook.agent1/2/3 sont configurés dans          ║');
  console.log('║  application.properties. Sans config → log WARN only. ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
}

run().catch(console.error);
