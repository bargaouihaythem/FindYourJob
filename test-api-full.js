const http = require('http');

function req(m, p, b, h, port) {
  h = h || {};
  port = port || 8080;
  return new Promise(function(res) {
    var d = b ? JSON.stringify(b) : null;
    var headers = Object.assign({ 'Content-Type': 'application/json' }, h);
    if (d) headers['Content-Length'] = Buffer.byteLength(d);
    var opts = { hostname: 'localhost', port: port, path: p, method: m, headers: headers };
    var r = http.request(opts, function(resp) {
      var raw = '';
      resp.on('data', function(c) { raw += c; });
      resp.on('end', function() {
        try { res({ s: resp.statusCode, b: JSON.parse(raw) }); }
        catch(e) { res({ s: resp.statusCode, b: raw }); }
      });
    });
    r.on('error', function(e) { res({ s: 0, b: e.message }); });
    if (d) r.write(d);
    r.end();
  });
}

function reqN8n(m, p, b) {
  return new Promise(function(res) {
    var d = b ? JSON.stringify(b) : null;
    var headers = { 'Content-Type': 'application/json' };
    if (d) headers['Content-Length'] = Buffer.byteLength(d);
    var opts = { hostname: 'localhost', port: 5678, path: p, method: m, headers: headers };
    var r = http.request(opts, function(resp) {
      var raw = '';
      resp.on('data', function(c) { raw += c; });
      resp.on('end', function() { res({ s: resp.statusCode, b: raw }); });
    });
    r.on('error', function() { res({ s: 0, b: 'n8n down' }); });
    if (d) r.write(d);
    r.end();
  });
}

var ok = 0, fail = 0, fails = [];

function chk(label, cond, note) {
  note = note || '';
  if (cond) {
    ok++;
    console.log('  OK  ' + label + (note ? ' -> ' + note : ''));
  } else {
    fail++;
    fails.push(label);
    console.log('  FAIL ' + label + (note ? ' -> ' + note : ''));
  }
}

async function main() {
  var adm = await req('POST', '/api/auth/signin', { username: 'admin', password: 'Admin2026!' });
  var rh  = await req('POST', '/api/auth/signin', { username: 'rh1', password: 'Test2026!' });
  var mgr = await req('POST', '/api/auth/signin', { username: 'manager1', password: 'Test2026!' });
  var cnd = await req('POST', '/api/auth/signin', { username: 'candidat1', password: 'Test2026!' });
  var aH = { Authorization: 'Bearer ' + adm.b.token };
  var rH = { Authorization: 'Bearer ' + rh.b.token };
  var mH = { Authorization: 'Bearer ' + mgr.b.token };

  var ts = Date.now();
  var deadline = new Date();
  deadline.setMonth(deadline.getMonth() + 2);
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  var cands = await req('GET', '/api/candidates?page=0&size=10', null, aH);
  var cId = cands.b[0] && cands.b[0].id;
  var offers = await req('GET', '/api/job-offers?page=0&size=5', null, aH);
  var oId = offers.b[0] && offers.b[0].id;
  var interviewers = await req('GET', '/api/interviews/interviewers', null, aH);
  var ivId = interviewers.b[0] && interviewers.b[0].id;
  console.log('Donnees: cId=' + cId + ' oId=' + oId + ' ivId=' + ivId);

  // ── 1. AUTH ──────────────────────────────────────────────
  console.log('\n[1] AUTH & INSCRIPTION');
  chk('Login admin',    adm.s === 200, adm.b.roles ? adm.b.roles.join(', ') : 'no roles');
  chk('Login rh1',      rh.s  === 200, rh.b.roles  ? rh.b.roles.join(', ')  : 'no roles');
  chk('Login manager1', mgr.s === 200, mgr.b.roles ? mgr.b.roles.join(', ') : 'no roles');
  chk('Login candidat1',cnd.s === 200, cnd.b.roles ? cnd.b.roles.join(', ') : 'no roles');
  var bad = await req('POST', '/api/auth/signin', { username: 'admin', password: 'WRONG' });
  chk('Mauvais mdp -> 401', bad.s === 401);
  var newUser = await req('POST', '/api/auth/signup', {
    username: 'qa' + ts, email: 'qa' + ts + '@test.com',
    password: 'Test2026!', firstName: 'QA', lastName: 'Test', roles: ['user']
  });
  chk('REGISTER nouveau utilisateur', newUser.s === 200 || newUser.s === 201, newUser.b && newUser.b.message);

  // ── 2. OFFRES CRUD ───────────────────────────────────────
  console.log('\n[2] OFFRES EMPLOI - CRUD complet');
  var cr = await req('POST', '/api/job-offers', {
    title: 'QA Test ' + ts,
    description: 'Description test QA automatique',
    requiredSkills: 'Java, Spring Boot, Angular',
    experienceLevel: 'JUNIOR',
    contractType: 'CDI',
    location: 'Paris (75)',
    salaryRange: '35000-45000',
    status: 'DRAFT',
    deadline: deadline.toISOString()
  }, rH);
  chk('CREATE offre (RH)', cr.s === 201, 'ID=' + (cr.b && cr.b.id) + ' "' + (cr.b && cr.b.title) + '"');
  var oid = cr.b && cr.b.id;

  if (oid) {
    var rd = await req('GET', '/api/job-offers/' + oid, null, aH);
    chk('READ offre par ID', rd.s === 200, rd.b && rd.b.title);

    var up = await req('PUT', '/api/job-offers/' + oid, {
      title: 'QA MODIFIEE ' + ts,
      description: 'Description mise a jour',
      requiredSkills: 'React, TypeScript',
      experienceLevel: 'MID',
      contractType: 'CDD',
      location: 'Lyon (69)',
      salaryRange: '40000-55000',
      status: 'ACTIVE',
      deadline: deadline.toISOString()
    }, rH);
    chk('UPDATE offre (title+status)', up.s === 200, 'status=' + (up.b && up.b.status));

    var st = await req('PUT', '/api/job-offers/' + oid + '/status?status=CLOSED', null, rH);
    chk('UPDATE status offre -> CLOSED', st.s === 200, 'status=' + (st.b && st.b.status));

    var dl = await req('DELETE', '/api/job-offers/' + oid, null, rH);
    chk('DELETE offre', dl.s === 200 || dl.s === 204, dl.b && dl.b.message);

    var ck = await req('GET', '/api/job-offers/' + oid, null, aH);
    chk('Offre supprimee -> 404', ck.s === 404);
  } else {
    var errMsg = JSON.stringify(cr.b).substring(0, 120);
    console.log('    SKIP offre CRUD: ' + cr.s + ' ' + errMsg);
    fail += 4;
    fails.push('READ offre', 'UPDATE offre', 'UPDATE status offre', 'DELETE offre');
  }

  // ── 3. CANDIDATS ─────────────────────────────────────────
  console.log('\n[3] CANDIDATS - STATUS & SCORE IA');
  chk('GET liste candidats (admin)', cands.s === 200, cands.b.length + ' candidats');

  var ps = await req('PATCH', '/api/candidates/' + cId + '/status?status=CV_REVIEWED', null, rH);
  chk('PATCH status -> CV_REVIEWED (RH)', ps.s === 200, 'status=' + (ps.b && ps.b.status));

  var ai = await req('PATCH', '/api/candidates/' + cId + '/ai-score?score=95&summary=Top+profil&recommendation=HIRE', null, {});
  chk('PATCH ai-score SANS token (n8n public)', ai.s === 200, 'score=' + (ai.b && ai.b.aiScore));

  var val = await req('GET', '/api/candidates/validated', null, mH);
  chk('GET candidats valides (manager)', val.s === 200, val.b.length + ' valides');

  var bySt = await req('GET', '/api/candidates/status/CV_REVIEWED', null, aH);
  chk('GET candidats par status CV_REVIEWED', bySt.s === 200, bySt.b.length + ' candidats');

  // ── 4. ENTRETIENS CRUD ───────────────────────────────────
  console.log('\n[4] ENTRETIENS - CRUD complet');
  var ni = await req('POST', '/api/interviews', {
    candidateId: cId,
    jobOfferId: oId,
    interviewerId: ivId,
    type: 'TECHNICAL',
    interviewDate: tomorrow.toISOString(),
    location: 'Microsoft Teams',
    notes: 'Entretien test QA',
    durationMinutes: 45
  }, rH);
  chk('CREATE entretien (RH)', ni.s === 200 || ni.s === 201, 'ID=' + (ni.b && ni.b.id) + ' type=' + (ni.b && ni.b.type));
  var iid = ni.b && ni.b.id;

  if (iid) {
    var ui = await req('PUT', '/api/interviews/' + iid, {
      candidateId: cId,
      jobOfferId: oId,
      interviewerId: ivId,
      type: 'HR',
      interviewDate: tomorrow.toISOString(),
      location: 'Telephone',
      notes: 'Modifie en HR',
      durationMinutes: 30
    }, rH);
    chk('UPDATE entretien -> HR', ui.s === 200, 'type=' + (ui.b && ui.b.type));

    var si = await req('PATCH', '/api/interviews/' + iid + '/status?status=COMPLETED', null, rH);
    chk('UPDATE status -> COMPLETED', si.s === 200, 'status=' + (si.b && si.b.status));

    var di = await req('DELETE', '/api/interviews/' + iid, null, aH);
    chk('DELETE entretien', di.s === 200 || di.s === 204);
  } else {
    console.log('    SKIP entretien CRUD: ' + ni.s + ' ' + JSON.stringify(ni.b).substring(0, 150));
    fail += 3;
    fails.push('UPDATE entretien', 'UPDATE status entretien', 'DELETE entretien');
  }

  // ── 5. FEEDBACKS CRUD ────────────────────────────────────
  console.log('\n[5] FEEDBACKS - CRUD complet');
  var nf = await req('POST', '/api/feedbacks', {
    candidateId: cId,
    content: 'Excellent candidat, profil tres solide',
    rating: 5,
    type: 'INTERVIEW',
    status: 'PENDING'
  }, mH);
  chk('CREATE feedback (manager)', nf.s === 200 || nf.s === 201, 'ID=' + (nf.b && nf.b.id));
  var fid = nf.b && nf.b.id;

  if (fid) {
    var uf = await req('PUT', '/api/feedbacks/' + fid, {
      candidateId: cId,
      content: 'Tres bon candidat, competences solides',
      rating: 4,
      type: 'GENERAL',
      status: 'APPROVED'
    }, rH);
    chk('UPDATE feedback -> rating=4 APPROVED', uf.s === 200, 'rating=' + (uf.b && uf.b.rating));

    var gf = await req('GET', '/api/feedbacks/candidate/' + cId, null, mH);
    chk('GET feedbacks par candidat', gf.s === 200, gf.b.length + ' feedbacks');

    var sf = await req('PATCH', '/api/feedbacks/' + fid + '/mark-sent', null, rH);
    chk('Marquer feedback envoye', sf.s === 200, sf.b && (sf.b.isSentToCandidate || sf.b.id) ? 'SENT' : JSON.stringify(sf.b).substring(0,60));

    var df = await req('DELETE', '/api/feedbacks/' + fid, null, aH);
    chk('DELETE feedback', df.s === 200 || df.s === 204);
  } else {
    console.log('    SKIP feedback CRUD: ' + nf.s + ' ' + JSON.stringify(nf.b).substring(0, 100));
    fail += 4;
    fails.push('UPDATE feedback', 'GET feedbacks candidat', 'Envoyer feedback', 'DELETE feedback');
  }

  // ── 6. EMAILS ────────────────────────────────────────────
  console.log('\n[6] EMAILS');
  var em = await req('POST', '/api/notifications/custom-email', {
    to: 'test-qa@example.com',
    subject: 'Test QA ' + ts,
    content: '<h1>Test</h1><p>Email de test QA automatique</p>',
    html: true
  }, aH);
  chk('Email custom (admin)', em.s === 200, em.b && em.b.success ? 'ENVOYE' : 'ERR: ' + (em.b && em.b.message));

  var ec = await req('POST', '/api/notifications/application-confirmation/' + cId, null, rH);
  chk('Email confirmation candidature', ec.s === 200, ec.b && ec.b.success ? 'ENVOYE' : JSON.stringify(ec.b).substring(0, 60));

  // ── 7. n8n AGENTS (3 agents IA) ─────────────────────────
  console.log('\n[7] n8n AGENTS (3 agents IA)');
  var n8nKey = { 'X-N8N-API-Key': 'job4you-secret-2026' };
  var nc = await req('GET', '/api/notifications/n8n/candidatures-du-jour', null, n8nKey);
  chk('n8n GET candidatures-du-jour (avec cle)', nc.s === 200, 'total=' + (nc.b && nc.b.total));

  // Agent 1 — CV Parser (déclencheur : nouvelle candidature)
  var wh1 = await reqN8n('POST', '/webhook/agent1-cv-parser', {
    event: 'NOUVELLE_CANDIDATURE',
    candidatId: cId, nom: 'QA', prenom: 'Test',
    email: 'bargaouihaythem1@gmail.com',
    offreTitre: 'Developpeur Java Senior',
    cvUrl: 'http://localhost:8080/cv/test.pdf',
    cvContent: 'Profil Java Spring Boot 5 ans experience',
    dateCandidature: new Date().toISOString()
  });
  chk('Agent1 CV Parser (NOUVELLE_CANDIDATURE)', wh1.s === 200, 'score=' + (wh1.b && wh1.b.score));

  // Agent 2 — RH Manager (déclencheur : dossier validé par RH)
  var wh2 = await reqN8n('POST', '/webhook/agent2-rh-manager', {
    event: 'DOSSIER_VALIDE_RH',
    candidatId: cId,
    candidatEmail: 'bargaouihaythem1@gmail.com',
    candidatNom: 'QA Test',
    offreTitre: 'Developpeur Java Senior',
    cvUrl: 'http://localhost:8080/cv/test.pdf',
    nouveauStatut: 'RH_APPROVED'
  });
  chk('Agent2 RH Manager (DOSSIER_VALIDE_RH)', wh2.s === 200, wh2.b && wh2.b.accepted ? 'email envoye' : 'status ' + wh2.s);

  // Agent 3 — Planificateur entretien (déclencheur : entretien créé)
  var dateEntretien = new Date(); dateEntretien.setDate(dateEntretien.getDate() + 7);
  var wh3 = await reqN8n('POST', '/webhook/agent3-entretien', {
    event: 'ENTRETIEN_PLANIFIE',
    entretienId: 21,
    candidatEmail: 'bargaouihaythem1@gmail.com',
    candidatNom: 'QA Test',
    interviewerEmail: 'bargaouihaythem1@gmail.com',
    interviewerNom: 'Pierre Durand',
    dateEntretien: dateEntretien.toISOString(),
    type: 'TECHNICAL',
    dureeMinutes: 45,
    lieu: 'Microsoft Teams',
    offreTitre: 'Developpeur Java Senior',
    notes: 'Entretien technique QA automatique'
  });
  chk('Agent3 Entretien (ENTRETIEN_PLANIFIE)', wh3.s === 200, wh3.b && wh3.b.accepted ? 'email envoye' : 'status ' + wh3.s);

  // ── 8. SECURITE ──────────────────────────────────────────
  console.log('\n[8] SECURITE - protection endpoints');
  var s1 = await req('GET', '/api/candidates');
  chk('/api/candidates sans token -> 401', s1.s === 401);

  var s2 = await req('GET', '/api/interviews');
  chk('/api/interviews sans token -> 401', s2.s === 401);

  var s3 = await req('GET', '/api/feedbacks');
  chk('/api/feedbacks sans token -> 401', s3.s === 401);

  var s4 = await req('GET', '/api/job-offers/public');
  chk('/api/job-offers/public sans token -> 200', s4.s === 200, s4.b.length + ' offres');

  // ── RAPPORT ──────────────────────────────────────────────
  console.log('\n' + '='.repeat(55));
  console.log('SCORE FINAL : ' + ok + '/' + (ok + fail) + ' (' + Math.round(ok / (ok + fail) * 100) + '%)');
  if (fails.length === 0) {
    console.log('TOUTES les fonctionnalites sont operationnelles !');
  } else {
    console.log('ECHECS (' + fail + ') :');
    fails.forEach(function(f) { console.log('  - ' + f); });
  }
}

main().catch(function(e) { console.error('Erreur globale:', e.message); });
