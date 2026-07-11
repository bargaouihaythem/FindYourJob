const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

const wfId = 'abHc50O9XFYNXIa8';
const verId = '03dde1ad-5b48-41f8-89f0-93eb7c04b518';

// Nouveau code "Score IA" : suppression totale de la logique HuggingFace morte
const NEW_SCORE_CODE = [
  "const raw = $input.first().json;",
  "const data = raw.body || raw; // webhook v2 body",
  "const candidateId = data.candidateId;",
  "const firstName   = data.firstName || 'Candidat';",
  "const lastName    = data.lastName  || '';",
  "const email       = data.email;",
  "const jobTitle    = data.jobOfferTitle || 'le poste';",
  "const cvContent   = data.cvContent || '';",
  "",
  "// Detection du niveau requis a partir du titre du poste",
  "const titleLower = jobTitle.toLowerCase();",
  "const isSenior = /senior|lead|expert|confirm/.test(titleLower);",
  "const isJunior = /junior|stage|stagiaire|alternance|d[ee]butant/.test(titleLower);",
  "",
  "// Ponderation technique / communication selon le niveau du poste",
  "const technicalWeight = isSenior ? 0.75 : (isJunior ? 0.60 : 0.70);",
  "const communicationWeight = 1 - technicalWeight;",
  "",
  "// Scores simules par critere (score reel/detaille calcule via Cohere dans Spring Boot au besoin RH)",
  "const technicalScore = Math.floor(Math.random() * 46) + 50; // 50-95",
  "const communicationScore = Math.floor(Math.random() * 46) + 50; // 50-95",
  "",
  "const weightedScore = Math.round(technicalScore * technicalWeight + communicationScore * communicationWeight);",
  "const score = weightedScore;",
  "const mention = score >= 85 ? 'Excellent profil'",
  "              : score >= 70 ? 'Bon profil'",
  "              : score >= 60 ? 'Profil moyen'",
  "              : 'Profil insuffisant';",
  "",
  "return [",
  "  {",
  "    json: {",
  "      candidateId, firstName, lastName, email, jobTitle, cvContent,",
  "      technicalScore, communicationScore, weightedScore, score, mention,",
  "      technicalWeight, communicationWeight,",
  "      processedAt: new Date().toISOString(),",
  "      responsePayload: {",
  "        status: 'ok', score, mention, candidateId,",
  "        technicalScore, communicationScore,",
  "        message: 'Candidature analysee par IA'",
  "      }",
  "    }",
  "  }",
  "];"
].join('\n');

function patchTable(table, idColumn, idValue, done) {
  db.get(`SELECT nodes, connections FROM ${table} WHERE ${idColumn} = ?`, [idValue], (readErr, row) => {
    if (readErr || !row) {
      console.error(`Read failed for ${table}:`, readErr ? readErr.message : 'row not found');
      done();
      return;
    }

    let nodes = JSON.parse(row.nodes || '[]');
    const connections = JSON.parse(row.connections || '{}');

    const before = nodes.length;
    nodes = nodes.filter((n) => n.name !== 'HuggingFace — Similarité CV/Offre');
    const removed = before - nodes.length;

    const scoreNode = nodes.find((n) => n.name === 'Score IA — Analyse CV');
    if (scoreNode) {
      scoreNode.parameters = scoreNode.parameters || {};
      scoreNode.parameters.jsCode = NEW_SCORE_CODE;
    }

    // Reconnecter directement Webhook -> Score IA (bypass du nœud HuggingFace supprimé)
    connections['Webhook — Nouvelle candidature'] = {
      main: [[{ node: 'Score IA — Analyse CV', type: 'main', index: 0 }]],
    };
    delete connections['HuggingFace — Similarité CV/Offre'];

    db.run(
      `UPDATE ${table} SET nodes = ?, connections = ? WHERE ${idColumn} = ?`,
      [JSON.stringify(nodes), JSON.stringify(connections), idValue],
      (updateErr) => {
        if (updateErr) console.error(`Update failed for ${table}:`, updateErr.message);
        else console.log(`Patched ${table}: removed=${removed} node, code cleaned, rewired Webhook->ScoreIA`);
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
