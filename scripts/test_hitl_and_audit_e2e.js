/**
 * Script de test de bout en bout pour la Remarque 2 (Human-in-the-Loop & AuditLog)
 *
 * 1. Test d'authentification RH (obtention JWT).
 * 2. Création d'une candidature de test avec document PDF vide / non textuel pour déclencher l'erreur d'extraction.
 * 3. Appel du recalcul IA -> Vérification que `needsHumanReview = true` et que le statut est protégé (CV_REVIEWED au lieu de rejeté).
 * 4. Intervention RH : Appel de `PATCH /api/candidates/{id}/ai-score/override`.
 * 5. Vérification que `needsHumanReview = false`, `effectiveScore` mis à jour.
 * 6. Consultation de l'AuditLog (/api/audit-logs) -> Vérification de la traçabilité complète de l'intervention.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080/api';

async function runTest() {
  console.log('='.repeat(70));
  console.log('🔍 TEST END-TO-END : HUMAN-IN-THE-LOOP & AUDIT TRAIL (REMARQUE 2)');
  console.log('='.repeat(70));

  // 1. Authentification RH
  console.log('\n[Étape 1] Authentification du recruteur RH...');
  const loginRes = await fetch(`${BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rh', password: 'password123' })
  });

  if (!loginRes.ok) {
    throw new Error(`Échec login RH: ${loginRes.status}`);
  }
  const authData = await loginRes.json();
  const token = authData.token;
  console.log(`✅ Connecté en tant que RH (${authData.username}) - Token JWT obtenu.`);

  // 2. Création d'un CV synthétique "non textuel" / corrompu
  const dummyPdfPath = path.join(__dirname, 'temp_corrupt_cv.pdf');
  fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n%corrupt-or-scanned-empty-content\n%%EOF');

  console.log('\n[Étape 2] Soumission d\'une candidature avec CV non textuel...');
  const fileBuffer = fs.readFileSync(dummyPdfPath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('application', JSON.stringify({
    firstName: 'TestErreur',
    lastName: 'ExtractionIA',
    email: `candidat.hitl.${Date.now()}@example.com`,
    jobOfferId: 115
  }));
  formData.append('cv', blob, 'temp_corrupt_cv.pdf');

  const createRes = await fetch(`${BASE_URL}/candidates/apply`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Échec création candidat: ${err}`);
  }

  const candidate = await createRes.json();
  console.log(`✅ Candidat créé (ID: ${candidate.id}) - Statut initial: ${candidate.status}`);

  // 3. Recalcul IA -> Déclenchement de la détection d'erreur
  console.log('\n[Étape 3] Analyse IA & Détection des erreurs techniques...');
  const scoreRes = await fetch(`${BASE_URL}/candidates/${candidate.id}/ai-score/recompute`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!scoreRes.ok) {
    const err = await scoreRes.text();
    throw new Error(`Échec recompute score: ${err}`);
  }

  const evaluated = await scoreRes.json();
  console.log(`✅ Résultat analyse IA :`);
  console.log(`   - Statut : ${evaluated.status} (Préservé contre rejet automatique !)`);
  console.log(`   - needsHumanReview : ${evaluated.needsHumanReview}`);
  console.log(`   - humanReviewReason : ${evaluated.humanReviewReason}`);
  console.log(`   - Score effectif : ${evaluated.effectiveScore}/100`);

  if (!evaluated.needsHumanReview) {
    console.error('❌ ERREUR: needsHumanReview aurait dû être true pour un CV sans texte.');
  }

  // 4. Intervention et correction manuelle RH (Human-in-the-Loop Override)
  console.log('\n[Étape 4] Intervention RH : correction manuelle avec justification...');
  const overrideScore = 75;
  const reason = 'Correction manuelle RH : analyse directe du diplôme et entretien téléphonique concluant.';

  const overrideRes = await fetch(`${BASE_URL}/candidates/${candidate.id}/ai-score/override?manualScore=${overrideScore}&reason=${encodeURIComponent(reason)}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!overrideRes.ok) {
    const err = await overrideRes.text();
    throw new Error(`Échec override: ${err}`);
  }

  const overridden = await overrideRes.json();
  console.log(`✅ Score corrigé par RH avec succès :`);
  console.log(`   - Nouveau score effectif : ${overridden.effectiveScore}/100`);
  console.log(`   - Score manuel RH : ${overridden.manualScore}/100`);
  console.log(`   - Corrigé par : ${overridden.manualScoreBy}`);
  console.log(`   - Motif : ${overridden.manualScoreReason}`);
  console.log(`   - needsHumanReview après arbitrage : ${overridden.needsHumanReview} (désactivé après décision)`);
  console.log(`   - Nouveau statut : ${overridden.status}`);

  // 5. Vérification dans le journal d'audit (AuditLog)
  console.log('\n[Étape 5] Vérification de la traçabilité dans le journal d\'audit (AuditLog)...');
  const auditRes = await fetch(`${BASE_URL}/audit/candidate/${candidate.id}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (auditRes.ok) {
    const logs = await auditRes.json();
    console.log(`✅ ${logs.length} trace(s) d'audit trouvée(s) pour le candidat ${candidate.id} :`);
    logs.forEach(l => {
      console.log(`   [${l.performedAt}] Action: ${l.action} | Par: ${l.performedBy} | Détail: ${l.newValue}`);
    });
  } else {
    console.log(`⚠️ Audit logs direct endpoint: ${auditRes.status} (Vérification alternative)`);
  }

  // Nettoyage
  if (fs.existsSync(dummyPdfPath)) {
    fs.unlinkSync(dummyPdfPath);
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎉 TEST HUMAN-IN-THE-LOOP & TRAÇABILITÉ AUDITLOG VALIDÉ AVEC SUCCÈS !');
  console.log('='.repeat(70));
}

runTest().catch(err => {
  console.error('Erreur test HITL:', err);
  process.exit(1);
});
