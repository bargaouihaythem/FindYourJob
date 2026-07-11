const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

const wfId = 'abHc50O9XFYNXIa8';
const verId = '03dde1ad-5b48-41f8-89f0-93eb7c04b518';

// ── Nouveau node HTTP : appelle Cohere via Spring Boot (recompute + sauvegarde) ──
const COHERE_HTTP_NODE = {
  id: 'cohere-score-via-springboot',
  name: 'Cohere — Score IA (Spring Boot)',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [368, 304],
  parameters: {
    method: 'POST',
    url: "=http://localhost:8080/api/candidates/{{ ($json.body || $json).candidateId }}/ai-score/recompute",
    options: { timeout: 20000 },
  },
  continueOnFail: true,
};

// ── Nouveau Code node : prepare les donnees pour l'email + reponse webhook ──
const PREPARE_EMAIL_CODE = [
  "const webhookData = $('Webhook — Nouvelle candidature').item.json;",
  "const raw = webhookData.body || webhookData;",
  "const candidateId = raw.candidateId;",
  "const firstName   = raw.firstName || 'Candidat';",
  "const lastName    = raw.lastName  || '';",
  "const email       = raw.email;",
  "const jobTitle    = raw.jobOfferTitle || 'le poste';",
  "",
  "let cohereResult = null;",
  "try { cohereResult = $input.first().json; } catch (e) { cohereResult = null; }",
  "",
  "const hasValidScore = cohereResult && typeof cohereResult.aiScore === 'number';",
  "",
  "const score              = hasValidScore ? cohereResult.aiScore : 70;",
  "const technicalScore     = hasValidScore && typeof cohereResult.aiScoreTechnical === 'number' ? cohereResult.aiScoreTechnical : 70;",
  "const communicationScore = hasValidScore && typeof cohereResult.aiScoreCommunication === 'number' ? cohereResult.aiScoreCommunication : 70;",
  "const seniorityScore     = hasValidScore && typeof cohereResult.aiScoreSeniorityMatch === 'number' ? cohereResult.aiScoreSeniorityMatch : 70;",
  "const aiScoreSource      = hasValidScore ? cohereResult.aiScoreSource : 'SIMULATED';",
  "const candidateStatus    = hasValidScore ? cohereResult.status : null;",
  "",
  "const mention = score >= 85 ? 'Excellent profil'",
  "              : score >= 70 ? 'Bon profil'",
  "              : score >= 60 ? 'Profil moyen'",
  "              : 'Profil insuffisant';",
  "",
  "return [{",
  "  json: {",
  "    candidateId, firstName, lastName, email, jobTitle,",
  "    score, mention, technicalScore, communicationScore, seniorityScore,",
  "    aiScoreSource, status: candidateStatus,",
  "    processedAt: new Date().toISOString(),",
  "    responsePayload: {",
  "      status: 'ok', score, mention, candidateId,",
  "      technicalScore, communicationScore, aiScoreSource,",
  "      message: 'Candidature analysee par IA (Cohere)'",
  "    }",
  "  }",
  "}];",
].join('\n');

const PREPARE_EMAIL_NODE = {
  id: 'prepare-email-data',
  name: 'Préparer données email',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [592, 304],
  parameters: { jsCode: PREPARE_EMAIL_CODE },
};

function patchTable(table, idColumn, idValue, done) {
  db.get(`SELECT nodes, connections FROM ${table} WHERE ${idColumn} = ?`, [idValue], (readErr, row) => {
    if (readErr || !row) {
      console.error(`Read failed for ${table}:`, readErr ? readErr.message : 'row not found');
      done();
      return;
    }

    let nodes = JSON.parse(row.nodes || '[]');

    // Retirer l'ancien node de scoring simule et le node de sauvegarde (redondant avec recompute)
    nodes = nodes.filter((n) =>
      n.name !== 'Score IA — Analyse CV' &&
      n.name !== 'Spring Boot — Sauvegarder score'
    );

    // Ajouter les 2 nouveaux nodes s'ils n'existent pas déjà
    if (!nodes.find((n) => n.name === 'Cohere — Score IA (Spring Boot)')) nodes.push(COHERE_HTTP_NODE);
    if (!nodes.find((n) => n.name === 'Préparer données email')) nodes.push(PREPARE_EMAIL_NODE);
    else {
      const existing = nodes.find((n) => n.name === 'Préparer données email');
      existing.parameters.jsCode = PREPARE_EMAIL_CODE;
    }

    const connections = {
      'Webhook — Nouvelle candidature': {
        main: [[{ node: 'Cohere — Score IA (Spring Boot)', type: 'main', index: 0 }]],
      },
      'Cohere — Score IA (Spring Boot)': {
        main: [[{ node: 'Préparer données email', type: 'main', index: 0 }]],
      },
      'Préparer données email': {
        main: [[
          { node: 'Email — Confirmation candidat', type: 'main', index: 0 },
          { node: 'Réponse webhook', type: 'main', index: 0 },
        ]],
      },
    };

    db.run(
      `UPDATE ${table} SET nodes = ?, connections = ? WHERE ${idColumn} = ?`,
      [JSON.stringify(nodes), JSON.stringify(connections), idValue],
      (updateErr) => {
        if (updateErr) console.error(`Update failed for ${table}:`, updateErr.message);
        else console.log(`Patched ${table}: Agent 1 now calls Cohere via Spring Boot for scoring`);
        done();
      }
    );
  });
}

let pending = 2;
function finish() {
  pending -= 1;
  if (pending === 0) db.close(() => console.log('Patch complete'));
}

patchTable('workflow_entity', 'id', wfId, finish);
patchTable('workflow_history', 'versionId', verId, finish);
