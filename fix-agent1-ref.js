// Fix: le noeud HTTP "Sauvegarder score" vient apres Email, donc $json = sortie Email (sans candidateId)
// Solution: referencier le noeud "Score IA" directement par son nom
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WF_ID = 'abHc50O9XFYNXIa8';
const CODE_NODE_NAME = 'Score IA \u2014 Analyse CV'; // nom exact du noeud Code (avec tiret long)
const inputPath = path.join(process.env.TEMP, 'wf1-latest.json');
const outputPath = path.join(process.env.TEMP, 'wf1-fixed-ref.json');

console.log('Export workflow...');
execSync(`n8n export:workflow --id=${WF_ID} --output="${inputPath}" --pretty`, { timeout: 15000 });

const raw = fs.readFileSync(inputPath, 'utf8');
const arr = JSON.parse(raw);
const wf = Array.isArray(arr) ? arr[0] : arr;

let fixed = 0;
(wf.nodes || []).forEach(node => {
  if (node.type === 'n8n-nodes-base.httpRequest' && node.name && node.name.includes('Sauvegarder')) {
    const p = node.parameters;
    const oldUrl = p.url;
    
    // Utiliser la reference directe au noeud Code pour recuperer candidateId
    // Syntaxe n8n: $('Nom du noeud').item.json.champ
    const codeRef = `$('${CODE_NODE_NAME}').item.json`;
    
    p.url = `={{ 'http://localhost:8080/api/candidates/' + ${codeRef}.candidateId + '/ai-score' }}`;
    
    // Corriger aussi le parametre query score
    if (p.queryParameters && p.queryParameters.parameters) {
      p.queryParameters.parameters.forEach(param => {
        if (param.name === 'score') {
          param.value = `={{ ${codeRef}.score }}`;
        }
      });
    }
    
    console.log('Avant:', oldUrl);
    console.log('Apres:', p.url);
    fixed++;
  }
});

console.log(`\nNoeuds corriges: ${fixed}`);

const output = Array.isArray(arr) ? [wf] : wf;
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log('Ecrit:', outputPath);

console.log('\nImport dans n8n...');
try {
  const out = execSync(`n8n import:workflow --input="${outputPath}"`, { encoding: 'utf8', timeout: 20000 });
  console.log('Import:', out.trim());
  execSync(`n8n update:workflow --id=${WF_ID} --active=true`, { timeout: 10000 });
  console.log('Workflow reactif');
  console.log('\nDone! Relancez node test-agents.js pour verifier aiScore.');
} catch (e) {
  console.error('Erreur:', e.message.substring(0, 400));
}
