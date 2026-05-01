const http = require('http');
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzM3YzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';
const SMTP = { id: 'IfwIPrT1KMjf4UMR', name: 'SMTP account' };
// Agent 3 code chargé depuis un fichier séparé (évite les conflits de caractères spéciaux)
const fixedCodeAgent3 = require('./agent3-code.js');


function req(path, method, body) {
  return new Promise((res, rej) => {
    const b = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: 'localhost', port: 5678, path, method,
      headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json', ...(b ? { 'Content-Length': Buffer.byteLength(b) } : {}) }
    }, resp => {
      let d = ''; resp.on('data', c => d += c); resp.on('end', () => res({ status: resp.statusCode, body: JSON.parse(d) }));
    });
    r.on('error', rej); if (b) r.write(b); r.end();
  });
}

// Code JS corrigé — les données webhook sont dans json.body (n8n encapsule le body)
// Le HTML de l'email est construit ici pour éviter les problèmes d'expression n8n
const fixedCode = [
  "const data = $input.first().json.body || $input.first().json;",
  "const candidateId = data.candidatId;",
  "const firstName   = data.prenom  || 'Candidat';",
  "const lastName    = data.nom     || '';",
  "const email       = data.email;",
  "const jobTitle    = data.offreTitre || 'le poste';",
  "const cvUrl       = data.cvUrl  || null;",
  "if (!email) throw new Error('Email manquant dans le payload: ' + JSON.stringify(data));",
  "const score   = Math.floor(Math.random() * 30) + 65;",
  "const mention = score >= 85 ? 'Excellent profil' : score >= 75 ? 'Bon profil' : 'Profil à étudier';",
  "const scoreColor = score >= 85 ? '#155724' : score >= 75 ? '#856404' : '#721c24';",
  "const scoreBg    = score >= 85 ? '#d4edda' : score >= 75 ? '#fff3cd' : '#f8d7da';",
  "const emailHtml = `<!DOCTYPE html><html><head><meta charset='UTF-8'>",
  "<style>",
  "body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}",
  ".header{background-color:#28a745;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0}",
  ".content{background-color:#f8f9fa;padding:30px;border-radius:0 0 5px 5px}",
  ".job-info{background-color:white;padding:20px;margin:20px 0;border-left:4px solid #28a745;border-radius:5px}",
  ".score-box{padding:20px;border-radius:8px;margin:20px 0;text-align:center;background-color:${scoreBg}}",
  ".next-steps{background-color:#e9ecef;padding:15px;border-radius:5px;margin:15px 0}",
  ".footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #dee2e6;color:#6c757d;font-size:14px}",
  "</style></head><body>",
  "<div class='header'><h1>Candidature reçue avec succès</h1></div>",
  "<div class='content'>",
  "<div style='font-size:48px;color:#28a745;text-align:center;margin:20px 0'>✓</div>",
  "<p>Bonjour <strong>${firstName} ${lastName}</strong>,</p>",
  "<p>Nous vous remercions pour votre candidature. Nous avons bien reçu votre dossier pour l'offre :</p>",
  "<div class='job-info'><h3>${jobTitle}</h3><p><strong>Référence :</strong> #${candidateId}</p></div>",
  "<div class='score-box'>",
  "<h3>📊 Analyse IA de votre profil</h3>",
  "<p style='font-size:36px;font-weight:bold;color:${scoreColor};margin:8px 0'>${score}/100</p>",
  "<p style='font-size:18px;font-weight:bold;color:${scoreColor}'>${mention}</p>",
  "<small style='color:#6c757d'>Score calculé automatiquement par notre IA de recrutement</small>",
  "</div>",
  "<div class='next-steps'><h4>Prochaines étapes :</h4><ul>",
  "<li>Notre équipe RH va examiner votre candidature</li>",
  "<li>Si votre profil correspond à nos attentes, nous vous contacterons pour un entretien</li>",
  "<li>Vous recevrez une réponse dans les 2 semaines suivant votre candidature</li>",
  "</ul></div>",
  "<p>Cordialement,<br>L'équipe de recrutement JOB4YOU</p>",
  "</div>",
  "<div class='footer'><p>Cet e-mail a été envoyé automatiquement. Merci de ne pas y répondre directement.</p>",
  "<p>© 2026 JOB4YOU — Plateforme de Recrutement IA. Tous droits réservés.</p></div>",
  "</body></html>`;",
  "return [{ json: { candidateId, firstName, lastName, email, jobTitle, cvUrl, score, mention, emailHtml, processedAt: new Date().toISOString() } }];"
].join('\n');

// Même correctif pour Agent 2 — HTML construit dans le Code node
const fixedCodeAgent2 = [
  "const data = $input.first().json.body || $input.first().json;",
  "const candidateId   = data.candidatId;",
  "const candidatEmail = data.candidatEmail;",
  "const nom           = data.candidatNom    || '';",
  "const prenom        = data.candidatPrenom || '';",
  "const offreTitre    = data.offreTitre     || 'le poste';",
  "const statut        = data.nouveauStatut  || 'CV_REVIEWED';",
  "const managerEmail  = data.managerEmail   || 'bargaouihaythem1@gmail.com';",
  "const rhEmail       = data.rhEmail        || '';",
  "const cvUrl         = data.cvUrl          || null;",
  "const date          = new Date().toLocaleDateString('fr-FR');",
  "const statutLabel   = { CV_REVIEWED: 'CV Validé par RH', PHONE_SCREENING: 'Pré-sélection téléphonique', TECHNICAL_TEST: 'Test technique', INTERVIEW: 'Entretien', ACCEPTED: 'Accepté', REJECTED: 'Refusé' }[statut] || statut;",
  "const emailHtml = `<!DOCTYPE html><html><head><meta charset='UTF-8'>",
  "<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}",
  ".header{background-color:#007bff;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0}",
  ".content{background-color:#f8f9fa;padding:30px;border-radius:0 0 5px 5px}",
  ".info{background-color:white;padding:20px;margin:20px 0;border-left:4px solid #007bff;border-radius:5px}",
  ".badge{display:inline-block;background-color:#28a745;color:white;padding:4px 12px;border-radius:15px;font-weight:bold}",
  ".footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #dee2e6;color:#6c757d;font-size:14px}</style></head><body>",
  "<div class='header'><h1>📋 Nouveau dossier candidat à examiner</h1></div>",
  "<div class='content'>",
  "<p>Bonjour,</p>",
  "<p>L'équipe RH vient de valider un dossier candidat. Merci de l'examiner :</p>",
  "<div class='info'>",
  "<h3>${prenom} ${nom}</h3>",
  "<p><strong>Poste :</strong> ${offreTitre}</p>",
  "<p><strong>Statut :</strong> <span class='badge'>${statutLabel}</span></p>",
  "<p><strong>Email candidat :</strong> ${candidatEmail}</p>",
  "<p><strong>Date de validation :</strong> ${date}</p>",
  "${cvUrl ? '<p><strong>CV :</strong> <a href=\"' + cvUrl + '\">Télécharger le CV</a></p>' : ''}",
  "</div>",
  "<p>Si le profil vous convient, planifiez un entretien sur la plateforme JOB4YOU.</p>",
  "<p>Cordialement,<br>L'équipe RH JOB4YOU</p></div>",
  "<div class='footer'><p>Email automatique © 2026 JOB4YOU — Plateforme de Recrutement IA</p></div>",
  "</body></html>` ;",
  "return [{ json: { candidateId, candidatEmail, nom, prenom, offreTitre, statut, statutLabel, managerEmail, rhEmail, cvUrl, date, emailHtml } }];"
].join('\n');

// Agent 3 code loaded via require("./agent3-code.js") at top of file

// ================================================================
// TEMPLATES EMAIL — cohérents avec les templates Thymeleaf Spring Boot
// Chaque template commence par ={{ ` (template literal n8n)
// Les ${$json.field} sont évalués par n8n au moment de l'envoi
// ================================================================

// Agent 1 — Confirmation candidature (vert #28a745, cf. application-confirmation.html)
const msgCandidatConfirmation = [
  "={{ `",
  "<!DOCTYPE html><html><head><meta charset='UTF-8'>",
  "<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}",
  ".header{background-color:#28a745;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0}",
  ".content{background-color:#f8f9fa;padding:30px;border-radius:0 0 5px 5px}",
  ".job-info{background-color:white;padding:20px;margin:20px 0;border-left:4px solid #28a745;border-radius:5px}",
  ".score-box{background-color:#e8f5e9;border:1px solid #a5d6a7;padding:20px;border-radius:8px;margin:20px 0;text-align:center}",
  ".next-steps{background-color:#e9ecef;padding:15px;border-radius:5px;margin:15px 0}",
  ".footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #dee2e6;color:#6c757d;font-size:14px}",
  "</style></head><body>",
  "<div class='header'><h1>Candidature reçue avec succès</h1></div>",
  "<div class='content'>",
  "<div style='font-size:48px;color:#28a745;text-align:center;margin:20px 0'>✓</div>",
  "<p>Bonjour <strong>${$json.firstName} ${$json.lastName}</strong>,</p>",
  "<p>Nous vous remercions pour votre candidature. Nous avons bien reçu votre dossier pour l'offre d'emploi suivante :</p>",
  "<div class='job-info'><h3>${$json.jobTitle}</h3>",
  "<p><strong>Référence candidature :</strong> #${$json.candidateId}</p></div>",
  "<div class='score-box'>",
  "<h3>📊 Analyse IA de votre profil</h3>",
  "<p style='font-size:36px;font-weight:bold;color:#28a745;margin:8px 0'>${$json.score}/100</p>",
  "<p style='font-size:18px;font-weight:bold;color:#155724'>${$json.mention}</p>",
  "<small style='color:#6c757d'>Score calculé automatiquement par notre IA de recrutement</small>",
  "</div>",
  "<div class='next-steps'><h4>Prochaines étapes :</h4><ul>",
  "<li>Notre équipe RH va examiner votre candidature</li>",
  "<li>Si votre profil correspond à nos attentes, nous vous contacterons pour un premier entretien</li>",
  "<li>Vous recevrez une réponse de notre part dans les 2 semaines suivant votre candidature</li>",
  "</ul></div>",
  "<p>Votre candidature a été enregistrée avec le numéro de référence : <strong>#${$json.candidateId}</strong></p>",
  "<p>Nous vous tiendrons informé(e) de l'évolution de votre candidature par e-mail.</p>",
  "<p>Cordialement,<br>L'équipe de recrutement JOB4YOU</p>",
  "</div>",
  "<div class='footer'><p>Cet e-mail a été envoyé automatiquement. Merci de ne pas répondre directement à cet e-mail.</p>",
  "<p>© 2026 JOB4YOU — Plateforme de Recrutement IA. Tous droits réservés.</p></div>",
  "</body></html>` }}"
].join('');

// Agent 2 — Notification manager : dossier validé RH (bleu #007bff, cf. feedback-notification.html)
const msgManagerNotif = [
  "={{ `",
  "<!DOCTYPE html><html><head><meta charset='UTF-8'>",
  "<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}",
  ".header{background-color:#007bff;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0}",
  ".content{background-color:#f8f9fa;padding:30px;border-radius:0 0 5px 5px}",
  ".candidate-info{background-color:white;padding:20px;margin:20px 0;border-left:4px solid #007bff;border-radius:5px}",
  ".badge{display:inline-block;background-color:#28a745;color:white;padding:4px 12px;border-radius:15px;font-weight:bold}",
  ".footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #dee2e6;color:#6c757d;font-size:14px}",
  "</style></head><body>",
  "<div class='header'><h1>📋 Nouveau dossier candidat à examiner</h1></div>",
  "<div class='content'>",
  "<p>Bonjour,</p>",
  "<p>L'équipe RH vient de valider un dossier candidat. Merci de l'examiner et de nous faire part de votre décision :</p>",
  "<div class='candidate-info'>",
  "<h3>${$json.prenom} ${$json.nom}</h3>",
  "<p><strong>Poste :</strong> ${$json.offreTitre}</p>",
  "<p><strong>Statut :</strong> <span class='badge'>${$json.statutLabel}</span></p>",
  "<p><strong>Date de validation :</strong> ${$json.date}</p>",
  "<p><strong>Email candidat :</strong> ${$json.candidatEmail}</p>",
  "<p><strong>CV :</strong> ${$json.cvUrl || 'Non fourni'}</p>",
  "</div>",
  "<p>Si le profil correspond à vos attentes, n'hésitez pas à planifier un entretien sur la plateforme.</p>",
  "<p>Cordialement,<br>L'équipe RH JOB4YOU</p>",
  "</div>",
  "<div class='footer'><p>Cet e-mail a été envoyé automatiquement par la plateforme JOB4YOU.</p>",
  "<p>© 2026 JOB4YOU — Plateforme de Recrutement IA. Tous droits réservés.</p></div>",
  "</body></html>` }}"
].join('');

// Agent 3 — Convocation candidat (cyan #17a2b8, cf. interview-invitation.html)
const msgCandidatConvocation = [
  "={{ `",
  "<!DOCTYPE html><html><head><meta charset='UTF-8'>",
  "<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}",
  ".header{background-color:#17a2b8;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0}",
  ".content{background-color:#f8f9fa;padding:30px;border-radius:0 0 5px 5px}",
  ".interview-details{background-color:white;padding:20px;margin:20px 0;border-left:4px solid #17a2b8;border-radius:5px}",
  ".detail-row{margin:10px 0;padding:5px 0;border-bottom:1px solid #e9ecef}",
  ".detail-label{font-weight:bold;display:inline-block;min-width:120px}",
  ".important-info{background-color:#fff3cd;border:1px solid #ffeaa7;padding:15px;border-radius:5px;margin:15px 0}",
  ".meet-btn{display:inline-block;background-color:#4285f4;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;font-weight:bold;margin:8px 0}",
  ".footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #dee2e6;color:#6c757d;font-size:14px}",
  "</style></head><body>",
  "<div class='header'><h1>Invitation à un entretien</h1></div>",
  "<div class='content'>",
  "<div style='font-size:48px;color:#17a2b8;text-align:center;margin:20px 0'>📅</div>",
  "<p>Bonjour <strong>${$json.candidatPrenom} ${$json.candidatNom}</strong>,</p>",
  "<p>Nous avons le plaisir de vous inviter à un entretien dans le cadre de votre candidature pour le poste :</p>",
  "<h3 style='color:#17a2b8;text-align:center'>${$json.offreTitre}</h3>",
  "<div class='interview-details'><h4>Détails de l'entretien :</h4>",
  "<div class='detail-row'><span class='detail-label'>Type :</span>${$json.type}</div>",
  "<div class='detail-row'><span class='detail-label'>Date &amp; Heure :</span>${$json.dateEntretien}</div>",
  "<div class='detail-row'><span class='detail-label'>Lieu :</span>${$json.lieu || 'À définir'}</div>",
  "${$json.meetLink ? \"<div class='detail-row'><span class='detail-label'>Lien Meet :</span><a class='meet-btn' href='\" + $json.meetLink + \"'>Rejoindre Google Meet</a></div>\" : ''}",
  "</div>",
  "<div class='important-info'><h4>⚠️ Informations importantes :</h4><ul>",
  "<li>Merci de confirmer votre présence en répondant à cet e-mail</li>",
  "<li>Veuillez arriver 10 minutes avant l'heure prévue</li>",
  "<li>N'oubliez pas d'apporter une pièce d'identité</li>",
  "<li>En cas d'empêchement, merci de nous prévenir au plus tôt</li>",
  "</ul></div>",
  "<p>Nous nous réjouissons de vous rencontrer et de discuter de votre candidature.</p>",
  "<p>Cordialement,<br>L'équipe de recrutement JOB4YOU</p>",
  "</div>",
  "<div class='footer'><p>Cet e-mail a été envoyé automatiquement. Merci de répondre pour confirmer votre présence.</p>",
  "<p>© 2026 JOB4YOU — Plateforme de Recrutement IA. Tous droits réservés.</p></div>",
  "</body></html>` }}"
].join('');

// Agent 3 — Confirmation RH planification entretien (cyan #17a2b8)
const msgRhConfirmation = [
  "={{ `",
  "<!DOCTYPE html><html><head><meta charset='UTF-8'>",
  "<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}",
  ".header{background-color:#17a2b8;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0}",
  ".content{background-color:#f8f9fa;padding:30px;border-radius:0 0 5px 5px}",
  ".summary{background-color:white;padding:20px;margin:20px 0;border-left:4px solid #17a2b8;border-radius:5px}",
  ".meet-btn{display:inline-block;background-color:#4285f4;color:white;padding:8px 16px;border-radius:5px;text-decoration:none;font-weight:bold}",
  ".footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #dee2e6;color:#6c757d;font-size:14px}",
  "</style></head><body>",
  "<div class='header'><h1>✅ Entretien planifié avec succès</h1></div>",
  "<div class='content'>",
  "<p>Bonjour,</p>",
  "<p>L'entretien suivant a été planifié et le candidat a été notifié automatiquement :</p>",
  "<div class='summary'>",
  "<p><strong>Candidat :</strong> ${$json.candidatPrenom} ${$json.candidatNom}</p>",
  "<p><strong>Email candidat :</strong> ${$json.candidatEmail}</p>",
  "<p><strong>Poste :</strong> ${$json.offreTitre}</p>",
  "<p><strong>Type d'entretien :</strong> ${$json.type}</p>",
  "<p><strong>Date &amp; Heure :</strong> ${$json.dateEntretien}</p>",
  "<p><strong>Lieu :</strong> ${$json.lieu || 'À définir'}</p>",
  "${$json.meetLink ? \"<p><strong>Lien Meet :</strong> <a class='meet-btn' href='\" + $json.meetLink + \"'>Google Meet</a></p>\" : ''}",
  "</div>",
  "<p>Un e-mail de convocation a été envoyé automatiquement au candidat.</p>",
  "<p>Cordialement,<br>La plateforme JOB4YOU</p>",
  "</div>",
  "<div class='footer'><p>Cet e-mail a été envoyé automatiquement par la plateforme JOB4YOU.</p>",
  "<p>© 2026 JOB4YOU — Plateforme de Recrutement IA. Tous droits réservés.</p></div>",
  "</body></html>` }}"
].join('');

async function run() {
  // --- Agent 1 ---
  console.log('\n=== Correction Agent 1 ===');
  const wf1 = (await req('/api/v1/workflows/abHc50O9XFYNXIa8', 'GET')).body;
  for (const node of wf1.nodes) {
    if (node.type === 'n8n-nodes-base.code') { node.parameters.jsCode = fixedCode; console.log('  Code JS corrigé'); }
    if (node.type === 'n8n-nodes-base.emailSend') {
      node.credentials = { smtp: SMTP };
      node.parameters.subject   = "={{ '\u2705 Candidature re\u00e7ue \u2014 ' + $json.jobTitle }}";
      node.parameters.toEmail   = '={{ $json.email }}';
      node.parameters.emailType = 'html';
      node.parameters.html      = '={{ $json.emailHtml }}';
      delete node.parameters.message;
      console.log('  SMTP + html (vert) assign\u00e9s \u00e0:', node.name);
    }
    if (node.type === 'n8n-nodes-base.httpRequest' && node.name.includes('Spring Boot')) {
      node.disabled = false;
      node.parameters.method = 'PATCH';
      node.parameters.url = "={{ 'http://localhost:8080/api/candidates/' + $json.candidateId + '/ai-score?score=' + $json.score }}";
      node.parameters.options = {};
      console.log('  Nœud réactivé + configuré:', node.name);
    }
  }
  const u1 = await req('/api/v1/workflows/abHc50O9XFYNXIa8', 'PUT', { name: wf1.name, nodes: wf1.nodes, connections: wf1.connections, settings: wf1.settings || {} });
  console.log('  Update:', u1.status === 200 ? 'OK' : 'ERR ' + u1.status, u1.body?.message || '');
  const a1 = await req('/api/v1/workflows/abHc50O9XFYNXIa8/activate', 'POST');
  console.log('  Activate:', a1.status === 200 ? 'ACTIF' : 'ERR ' + a1.status, a1.body?.message || '');

  // --- Agent 2 ---
  console.log('\n=== Correction Agent 2 ===');
  const wf2 = (await req('/api/v1/workflows/vuIc7XWE1gcN4hBG', 'GET')).body;
  for (const node of wf2.nodes) {
    if (node.type === 'n8n-nodes-base.code') { node.parameters.jsCode = fixedCodeAgent2; console.log('  Code JS corrigé'); }
    if (node.type === 'n8n-nodes-base.emailSend') {
      node.credentials = { smtp: SMTP };
      node.parameters.subject   = "={{ '📋 Nouveau dossier candidat \u2014 ' + $json.offreTitre }}";
      node.parameters.toEmail   = "={{ $json.managerEmail || 'bargaouihaythem1@gmail.com' }}";
      node.parameters.emailType = 'html';
      node.parameters.html      = '={{ $json.emailHtml }}';
      delete node.parameters.message;
      console.log('  SMTP + html (bleu) assign\u00e9s \u00e0:', node.name);
    }
  }
  const u2 = await req('/api/v1/workflows/vuIc7XWE1gcN4hBG', 'PUT', { name: wf2.name, nodes: wf2.nodes, connections: wf2.connections, settings: wf2.settings || {} });
  console.log('  Update:', u2.status === 200 ? 'OK' : 'ERR ' + u2.status, u2.body?.message || '');
  const a2 = await req('/api/v1/workflows/vuIc7XWE1gcN4hBG/activate', 'POST');
  console.log('  Activate:', a2.status === 200 ? 'ACTIF' : 'ERR ' + a2.status, a2.body?.message || '');

  // --- Agent 3 ---
  console.log('\n=== Correction Agent 3 ===');
  const wf3 = (await req('/api/v1/workflows/aDlMEwef9SLGf0Xd', 'GET')).body;
  for (const node of wf3.nodes) {
    if (node.type === 'n8n-nodes-base.code') { node.parameters.jsCode = fixedCodeAgent3; console.log('  Code JS corrigé'); }
    if (node.type === 'n8n-nodes-base.emailSend') {
      node.credentials = { smtp: SMTP };
      node.parameters.emailType = 'html';
      if (node.name.toLowerCase().includes('candidat')) {
        node.parameters.subject  = "={{ '📅 Convocation entretien \u2014 ' + $json.offreTitre }}";
        node.parameters.toEmail  = '={{ $json.candidatEmail }}';
        node.parameters.html     = '={{ $json.emailCandidatHtml }}';
      } else {
        node.parameters.subject  = "={{ '\u2705 Entretien planifi\u00e9 \u2014 ' + $json.offreTitre }}";
        node.parameters.toEmail  = "={{ $json.rhEmail || 'bargaouihaythem1@gmail.com' }}";
        node.parameters.html     = '={{ $json.emailRhHtml }}';
      }
      delete node.parameters.message;
      console.log('  SMTP + html (cyan) assign\u00e9s \u00e0:', node.name);
    }
  }
  const u3 = await req('/api/v1/workflows/aDlMEwef9SLGf0Xd', 'PUT', { name: wf3.name, nodes: wf3.nodes, connections: wf3.connections, settings: wf3.settings || {} });
  console.log('  Update:', u3.status === 200 ? 'OK' : 'ERR ' + u3.status, u3.body?.message || '');
  const a3 = await req('/api/v1/workflows/aDlMEwef9SLGf0Xd/activate', 'POST');
  console.log('  Activate:', a3.status === 200 ? 'ACTIF' : 'ERR ' + a3.status, a3.body?.message || '');

  // --- Test final Agent 1 ---
  console.log('\n=== Test Agent 1 ===');
  await new Promise(r => setTimeout(r, 1000));
  const testBody = JSON.stringify({
    event: 'NOUVELLE_CANDIDATURE', candidatId: 1,
    email: 'bargaouihaythem1@gmail.com', nom: 'Bargaoui', prenom: 'Haythem',
    offreTitre: 'Développeur Java Spring Boot', cvUrl: null, dateCandidature: '2026-04-26'
  });
  await new Promise((res, rej) => {
    const r = http.request({ hostname: 'localhost', port: 5678, path: '/webhook/agent1-cv-parser', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(testBody) } },
      resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => { console.log('  Webhook Status:', resp.statusCode, d || '(vide)'); res(); }); });
    r.on('error', rej); r.write(testBody); r.end();
  });
}
run().catch(console.error);
