const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));

const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));
const workflowId = 'vuIc7XWE1gcN4hBG';
const versionId = '36872f5a-e653-4f60-a0c2-7f9362df1266';

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
  "const emailManagerHtml = '<h2>Nouveau dossier</h2><p>' + prenom + ' ' + nom + ' - ' + offreTitre + '</p><p>Statut: ' + statutLabel + '</p>';",
  "const emailCandidatHtml = '<h2>Resultat de votre candidature</h2><p>Bonjour ' + prenom + ',</p><p>Votre candidature pour le poste de <b>' + offreTitre + '</b> n\\'a pas ete retenue.</p><p>Statut: ' + statutLabel + '</p><p>Cordialement,<br>L\\'equipe RH JOB4YOU</p>';",
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

    if (!prepareNode) {
      console.error(`Node not found in ${table}`);
      done();
      return;
    }

    prepareNode.parameters = prepareNode.parameters || {};
    prepareNode.parameters.jsCode = NEW_CODE;

    db.run(`UPDATE ${table} SET nodes = ? WHERE ${idColumn} = ?`, [JSON.stringify(nodes), idValue], (updateErr) => {
      if (updateErr) {
        console.error(`Update failed for ${table}:`, updateErr.message);
      } else {
        console.log(`Patched ${table}`);
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

patchTable('workflow_entity', 'id', workflowId, finish);
patchTable('workflow_history', 'versionId', versionId, finish);
