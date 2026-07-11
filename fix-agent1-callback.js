// Ajouter le callback HTTP directement dans le Code node (plus fiable que le noeud HTTP separé)
// Et supprimer le noeud HTTP "Sauvegarder score" ou le garder mais avec une URL plus simple

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WF_ID = 'abHc50O9XFYNXIa8';
const inputPath = path.join(process.env.TEMP, 'wf1-cb.json');
const outputPath = path.join(process.env.TEMP, 'wf1-cb-fixed.json');

console.log('Export workflow...');
execSync(`n8n export:workflow --id=${WF_ID} --output="${inputPath}" --pretty`, { timeout: 15000 });

const raw = fs.readFileSync(inputPath, 'utf8');
const arr = JSON.parse(raw);
const wf = Array.isArray(arr) ? arr[0] : arr;

// Trouver le Code node "Score IA"
const codeNode = wf.nodes.find(n => n.name.includes('Score IA'));
if (!codeNode) { console.error('Code node non trouve!'); process.exit(1); }

// Verifier la fin du code actuel
const oldCode = codeNode.parameters.jsCode;
const returnIdx = oldCode.lastIndexOf('return [');
const returnStatement = oldCode.substring(returnIdx);
console.log('Return actuel:', returnStatement.substring(0, 80));

// Ajouter le callback HTTP avant le return
// En n8n Code node: this.helpers.httpRequest() est disponible
const callbackCode = `

// === Callback direct vers Spring Boot ===
// Plus fiable que le noeud HTTP separé (evite le problème de $json non transmis)
if (candidateId) {
  try {
    await this.helpers.httpRequest({
      method: 'PATCH',
      url: 'http://localhost:8080/api/candidates/' + candidateId + '/ai-score',
      qs: { score: score },
      json: false,
    });
  } catch (cbErr) {
    // On continue meme si le callback echoue (non bloquant)
    console.error('Callback ai-score erreur:', cbErr.message || cbErr);
  }
}

`;

// Inserer avant le return
const newCode = oldCode.substring(0, returnIdx) + callbackCode + oldCode.substring(returnIdx);
codeNode.parameters.jsCode = newCode;
console.log('Code node mis a jour avec callback HTTP interne');

// Optionnel: mettre le noeud HTTP "Sauvegarder score" en mode continueOnFail pour ne pas bloquer
const httpNode = wf.nodes.find(n => n.name.includes('Sauvegarder'));
if (httpNode) {
  httpNode.continueOnFail = true;
  console.log('Noeud HTTP Sauvegarder: continueOnFail=true (backup)');
}

const output = Array.isArray(arr) ? [wf] : wf;
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log('Ecrit:', outputPath);

console.log('\nImport dans n8n...');
try {
  const out = execSync(`n8n import:workflow --input="${outputPath}"`, { encoding: 'utf8', timeout: 20000 });
  console.log('Import:', out.trim());
  execSync(`n8n update:workflow --id=${WF_ID} --active=true`, { timeout: 10000 });
  console.log('Workflow reactif');
  console.log('\nDone! Relancez node test-agents.js');
} catch (e) {
  console.error('Erreur:', e.message.substring(0, 400));
}
