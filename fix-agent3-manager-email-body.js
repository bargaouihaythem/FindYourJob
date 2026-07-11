const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

const wfId = 'vuIc7XWE1gcN4hBG';
const verId = '36872f5a-e653-4f60-a0c2-7f9362df1266';

// Nouveau code node : emailManagerHtml complet + champs coherents
const NEW_CODE = [
  "const data = $input.first().json.body || $input.first().json;",
  "const candidateId   = data.candidateId || data.candidatId;",
  "const candidatEmail = data.email || data.candidatEmail || data.candidateEmail || '';",
  "const nom           = data.lastName || data.candidatNom || data.candidateLastName || '';",
  "const prenom        = data.firstName || data.candidatPrenom || data.candidateFirstName || '';",
  "const offreTitre    = data.jobOfferTitle || data.offreTitre || 'le poste';",
  "const statut        = data.status || data.nouveauStatut || 'CV_REVIEWED';",
  "const managerEmail  = data.managerEmail || 'bargaouihaythem1@gmail.com';",
  "const cvUrl         = data.cvUrl || null;",
  "const date          = new Date().toLocaleDateString('fr-FR');",
  "const isRejected    = statut === 'AUTO_REJECTED' || statut === 'MANAGER_REJECTED' || statut === 'REJECTED';",
  "const statutMap = {",
  "  CV_REVIEWED:      'CV Valide - profil retenu',",
  "  AUTO_REJECTED:    'Profil insuffisant (score IA < 60)',",
  "  MANAGER_REJECTED: 'Refuse par le manager',",
  "  REJECTED:         'Candidature refusee',",
  "  ACCEPTED:         'Accepte',",
  "  HIRED:            'Embauche',",
  "};",
  "const statutLabel = statutMap[statut] || statut;",
  "",
  "const emailManagerHtml = '<html><body style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">'",
  "  + '<div style=\"background:#1e40af;color:white;padding:24px;border-radius:8px 8px 0 0;\">'",
  "  + '<h1 style=\"margin:0\">JOB4YOU</h1><p style=\"margin:4px 0 0\">Nouveau dossier candidat a examiner</p></div>'",
  "  + '<div style=\"background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;\">'",
  "  + '<p>Bonjour,</p>'",
  "  + '<p>Un dossier candidat vient d\\'etre valide par le systeme RH.</p>'",
  "  + '<div style=\"background:white;border-left:4px solid #10b981;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;\">'",
  "  + '<h3 style=\"color:#059669;margin-top:0;\">' + prenom + ' ' + nom + '</h3>'",
  "  + '<table style=\"width:100%;border-collapse:collapse;\">'",
  "  + '<tr><td style=\"color:#6b7280;padding:6px 0;width:140px;\">Poste</td><td style=\"font-weight:bold;\">' + offreTitre + '</td></tr>'",
  "  + '<tr><td style=\"color:#6b7280;padding:6px 0;\">Statut</td><td style=\"font-weight:bold;color:#1e40af;\">' + statutLabel + '</td></tr>'",
  "  + '<tr><td style=\"color:#6b7280;padding:6px 0;\">Email candidat</td><td>' + candidatEmail + '</td></tr>'",
  "  + '<tr><td style=\"color:#6b7280;padding:6px 0;\">Date</td><td>' + date + '</td></tr>'",
  "  + (cvUrl ? '<tr><td style=\"color:#6b7280;padding:6px 0;\">CV</td><td><a href=\"' + cvUrl + '\">Telecharger le CV</a></td></tr>' : '')",
  "  + '</table></div>'",
  "  + '<p>Si le profil vous convient, planifiez un entretien sur la plateforme JOB4YOU.</p>'",
  "  + '<p style=\"color:#6b7280;font-size:12px;margin-top:24px;\">Email automatique JOB4YOU Agent 3 — ' + date + '</p>'",
  "  + '</div></body></html>';",
  "",
  "const emailCandidatHtml = '<html><body style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">'",
  "  + '<div style=\"background:#dc2626;color:white;padding:24px;border-radius:8px 8px 0 0;\">'",
  "  + '<h1 style=\"margin:0\">JOB4YOU</h1><p style=\"margin:4px 0 0\">Resultat de votre candidature</p></div>'",
  "  + '<div style=\"background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;\">'",
  "  + '<h2 style=\"color:#1e40af;\">Bonjour ' + prenom + ',</h2>'",
  "  + '<p>Merci pour l\\'interet porte a notre entreprise et pour votre candidature au poste de <b>' + offreTitre + '</b>.</p>'",
  "  + '<div style=\"background:white;border-left:4px solid #dc2626;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;\">'",
  "  + '<p><b>Statut :</b> ' + statutLabel + '</p>'",
  "  + '</div>'",
  "  + '<p>Cette decision ne remet pas en cause vos competences. Nous vous encourageons a postuler pour d\\'autres offres sur JOB4YOU.</p>'",
  "  + '<p>Cordialement,<br><b>L\\'equipe RH JOB4YOU</b></p>'",
  "  + '<p style=\"color:#6b7280;font-size:12px;margin-top:24px;\">Email automatique JOB4YOU Agent 3 — ' + date + '</p>'",
  "  + '</div></body></html>';",
  "",
  "return [{ json: { candidateId, candidatEmail, nom, prenom, offreTitre, statut, statutLabel, managerEmail, cvUrl, date, isRejected, emailManagerHtml, emailCandidatHtml } }];"
].join('\n');

function patchTable(table, idColumn, idValue, done) {
  db.get(`SELECT nodes FROM ${table} WHERE ${idColumn} = ?`, [idValue], (readErr, row) => {
    if (readErr || !row) {
      console.error(`Read failed for ${table}:`, readErr ? readErr.message : 'row not found');
      done();
      return;
    }

    const nodes = JSON.parse(row.nodes || '[]');

    const prepareNode = nodes.find((node) => node.name === 'Préparer données dossier');
    if (prepareNode) {
      prepareNode.parameters = prepareNode.parameters || {};
      prepareNode.parameters.jsCode = NEW_CODE;
    }

    const managerNode = nodes.find((node) => node.name === 'Email — Manager (dossier validé)');
    if (managerNode) {
      managerNode.parameters = {
        fromEmail: 'bargaouihaythem1@gmail.com',
        toEmail: "={{ $json.managerEmail || 'bargaouihaythem1@gmail.com' }}",
        subject: '=📋 Nouveau dossier à examiner — {{ $json.prenom }} {{ $json.nom }} / {{ $json.offreTitre }}',
        emailType: 'html',
        html: '={{ $json.emailManagerHtml }}',
        options: {}
      };
    }

    const rejectNode = nodes.find((node) => node.name === 'Email — Candidat (refus IA)');
    if (rejectNode) {
      rejectNode.parameters = {
        fromEmail: 'bargaouihaythem1@gmail.com',
        toEmail: '={{ $json.candidatEmail }}',
        subject: '=❌ Résultat de votre candidature — {{ $json.offreTitre }}',
        emailType: 'html',
        html: '={{ $json.emailCandidatHtml }}',
        options: {}
      };
    }

    db.run(`UPDATE ${table} SET nodes = ? WHERE ${idColumn} = ?`, [JSON.stringify(nodes), idValue], (updateErr) => {
      if (updateErr) {
        console.error(`Update failed for ${table}:`, updateErr.message);
      } else {
        console.log(`Patched ${table}: code + manager email body + reject email body`);
      }
      done();
    });
  });
}

let pending = 2;
function finish() {
  pending -= 1;
  if (pending === 0) {
    db.close(() => console.log('Patch complete'));
  }
}

patchTable('workflow_entity', 'id', wfId, finish);
patchTable('workflow_history', 'versionId', verId, finish);
