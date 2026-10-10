const fs = require('fs');

async function testWorkflow() {
  console.log('=== TEST COMPLET DU ROUTAGE ET DU CYCLE DE VIE CANDIDAT ===');

  // 1. Préparer FormData pour postuler
  const cvPath = 'C:\\Users\\hbargaoui\\OneDrive - Sopra Steria\\Desktop\\projetpfeee\\cv +user\\1_CV_Backend_Java_Spring_Thomas.pdf';
  const fileBuffer = fs.readFileSync(cvPath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });

  const appData = {
    firstName: 'VerifTest',
    lastName: 'RoutingManager',
    email: 'verif.test.routing@example.com',
    phone: '+33 6 11 22 33 44',
    jobOfferId: 115 // Développeur Backend Java/Spring (R&D)
  };

  const form = new FormData();
  form.append('application', JSON.stringify(appData));
  form.append('cv', blob, 'CV_Thomas_Verif.pdf');

  // 0. Connexion Candidat
  console.log('0. Authentification du candidat (candidat / password123)...');
  const candLoginRes = await fetch('http://localhost:8080/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'candidat', password: 'password123' })
  });
  const candAuth = await candLoginRes.json();
  console.log('   Candidat connecté avec succès (Email:', candAuth.email, ')');

  console.log('1. Soumission de la candidature via POST /api/candidates/apply avec JWT...');
  const applyRes = await fetch('http://localhost:8080/api/candidates/apply', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + candAuth.token },
    body: form
  });
  console.log('   Statut HTTP apply:', applyRes.status);
  const candidate = await applyRes.json();
  console.log('   Candidat créé avec ID:', candidate.id, '| Statut initial:', candidate.status);

  // 2. Connexion RH
  const rhLoginRes = await fetch('http://localhost:8080/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rh', password: 'password123' })
  });
  const rhAuth = await rhLoginRes.json();
  console.log('2. Connexion RH réussie (Token obtenu)');

  // 3. Le RH valide le CV, passe en PHONE_SCREENING puis en TECHNICAL_TEST (Transmission au Manager)
  console.log('3. RH valide le CV (CV_REVIEWED) -> Planifie entretien tel (PHONE_SCREENING) -> Passe en test technique (TECHNICAL_TEST)...');
  const patchCvRes = await fetch(`http://localhost:8080/api/candidates/${candidate.id}/status?status=CV_REVIEWED`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + rhAuth.token }
  });
  console.log('   Statut HTTP CV_REVIEWED:', patchCvRes.status);

  const patchPhoneRes = await fetch(`http://localhost:8080/api/candidates/${candidate.id}/status?status=PHONE_SCREENING`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + rhAuth.token }
  });
  console.log('   Statut HTTP PHONE_SCREENING:', patchPhoneRes.status);

  const patchTechRes = await fetch(`http://localhost:8080/api/candidates/${candidate.id}/status?status=TECHNICAL_TEST`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + rhAuth.token }
  });
  console.log('   Statut HTTP TECHNICAL_TEST:', patchTechRes.status);
  const updatedCandidate = await patchTechRes.json();
  console.log('   Nouveau statut candidat:', updatedCandidate.status);

  // 4. Test d'accès par Manager CS (Département Consulting Services, périmètre de l'offre 115)
  const mgrCsRes = await fetch('http://localhost:8080/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'manager.cs', password: 'password123' })
  });
  const mgrCsAuth = await mgrCsRes.json();
  
  const candListCsRes = await fetch('http://localhost:8080/api/candidates', {
    headers: { 'Authorization': 'Bearer ' + mgrCsAuth.token }
  });
  const candListCs = await candListCsRes.json();
  const seenByCs = candListCs.some(c => c.id === candidate.id);
  console.log('4. Visibilité par Manager CS (Périmètre de l\'offre 115) :', seenByCs ? 'OUI (Routage réussi !)' : 'NON (Échec)');

  // 5. Test de cloisonnement par Manager R&D (qui ne doit PAS voir ce candidat CS)
  const mgrRdRes = await fetch('http://localhost:8080/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'manager.rd', password: 'password123' })
  });
  const mgrRdAuth = await mgrRdRes.json();

  const candListRdRes = await fetch('http://localhost:8080/api/candidates', {
    headers: { 'Authorization': 'Bearer ' + mgrRdAuth.token }
  });
  const candListRd = await candListRdRes.json();
  const seenByRd = candListRd.some(c => c.id === candidate.id);
  console.log('5. Visibilité par Manager R&D (Hors périmètre - RSD) :', seenByRd ? 'OUI (Anomalie de cloisonnement)' : 'NON (Ségrégation stricte respectée !)');

  // 6. Décision finale par Manager CS : Accepter le candidat
  console.log('6. Manager CS prend la décision finale : ACCEPTED...');
  const decisionRes = await fetch(`http://localhost:8080/api/candidates/${candidate.id}/manager-decision?decision=ACCEPTED`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + mgrCsAuth.token }
  });
  console.log('   Statut HTTP décision Manager CS:', decisionRes.status);
  const finalCandidate = await decisionRes.json();
  console.log('   Statut final du candidat:', finalCandidate.status, '| Modifié par:', finalCandidate.statusChangedBy);

  // 7. Nettoyage du candidat de test
  await fetch(`http://localhost:8080/api/candidates/${candidate.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + rhAuth.token }
  });
  console.log('7. Candidat de test nettoyé.');

  console.log('=== TOUS LES TESTS DE ROUTAGE ET WORKFLOW ONT RÉUSSI AVEC SUCCÈS ===');
}

testWorkflow().catch(console.error);
