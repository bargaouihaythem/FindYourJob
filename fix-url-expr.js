// Utiliser la syntaxe expression pure n8n v2: ={{ expression }}
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WF_ID = 'abHc50O9XFYNXIa8';
const inputPath = path.join(process.env.TEMP, 'wf1-final-fix-out.json');
const outputPath = path.join(process.env.TEMP, 'wf1-expr.json');

const raw = fs.readFileSync(inputPath, 'utf8');
const arr = JSON.parse(raw);
const wf = Array.isArray(arr) ? arr[0] : arr;

const hn = wf.nodes.find(n => n.name.includes('Sauvegarder'));
const p = hn.parameters;

// Syntaxe expression pure n8n v2 (pas de mélange texte + {{ }})
p.url = "={{ 'http://localhost:8080/api/candidates/' + $json.candidateId + '/ai-score' }}";

if (p.queryParameters && p.queryParameters.parameters) {
  p.queryParameters.parameters.forEach(qp => {
    if (qp.name === 'score') {
      qp.value = '={{ $json.score }}';
    }
  });
}

hn.continueOnFail = false;
console.log('URL:', p.url);

fs.writeFileSync(outputPath, JSON.stringify(arr, null, 2), 'utf8');

const out = execSync(`n8n import:workflow --input="${outputPath}"`, { encoding: 'utf8', timeout: 15000 });
console.log(out.trim());
execSync(`n8n update:workflow --id=${WF_ID} --active=true`, { timeout: 10000 });
console.log('Done - relancez test-agents.js');
