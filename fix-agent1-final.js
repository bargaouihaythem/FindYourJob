// Fix complet et définitif du workflow Agent 1:
// 1. continueOnFail=false sur TOUS les noeuds HTTP (pour voir les vraies erreurs)
// 2. Corriger les URLs de tous les noeuds HTTP avec la syntaxe $json (connexion directe au Code node)
// 3. Supprimer le callback this.helpers dans le Code node (inefficace)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WF_ID = 'abHc50O9XFYNXIa8';
const inputPath = path.join(process.env.TEMP, 'wf1-final-fix.json');
const outputPath = path.join(process.env.TEMP, 'wf1-final-fix-out.json');

console.log('Export workflow...');
execSync(`n8n export:workflow --id=${WF_ID} --output="${inputPath}" --pretty`, { timeout: 15000 });

const raw = fs.readFileSync(inputPath, 'utf8');
const arr = JSON.parse(raw);
const wf = Array.isArray(arr) ? arr[0] : arr;

// Verifier les connexions
const conns = wf.connections || {};
console.log('\n=== Connexions actuelles depuis Code node ===');
const codeConns = conns['Score IA \u2014 Analyse CV'];
if (codeConns) {
  codeConns.main[0].forEach(c => console.log('  ->', c.node));
}

// Corriger tous les noeuds HTTP
let changes = [];
(wf.nodes || []).forEach(node => {
  if (node.type === 'n8n-nodes-base.httpRequest') {
    const name = node.name;
    const p = node.parameters;
    const oldUrl = p.url;
    
    // Forcer continueOnFail=false pour voir les vraies erreurs
    node.continueOnFail = false;
    node.onError = 'stopWorkflow'; // n8n v2 style
    
    if (name.includes('Sauvegarder')) {
      // URL directe (Code node est parent direct)
      p.url = '=http://localhost:8080/api/candidates/{{ $json.candidateId }}/ai-score';
      // S'assurer que score est correct
      if (p.queryParameters && p.queryParameters.parameters) {
        p.queryParameters.parameters.forEach(param => {
          if (param.name === 'score') {
            param.value = '={{ $json.score }}';
          }
        });
      }
      changes.push(`${name}: URL=${p.url}`);
    }
    else if (name.includes('CV_REVIEWED') || name.includes('REJECTED')) {
      // Ces noeuds recoivent l'output du noeud IF (Score suffisant?)
      // Le noeud IF recoit l'output du noeud "Sauvegarder score"
      // -> $json dans ces noeuds = output de "Sauvegarder score" = output HTTP (pas candidateId)
      // Il faut utiliser $('Score IA — Analyse CV').first().json.candidateId
      p.url = `=http://localhost:8080/api/candidates/{{ $('Score IA \u2014 Analyse CV').first().json.candidateId }}/status`;
      changes.push(`${name}: URL corrigee avec reference noeud Code`);
    }
    
    console.log(`  ${name}: continueOnFail=false`);
  }
});

console.log('\nChangements:');
changes.forEach(c => console.log(' ', c));

// Supprimer le callback this.helpers du Code node (inutile et peut causer des erreurs)
const codeNode = wf.nodes.find(n => n.name.includes('Score IA'));
if (codeNode) {
  let code = codeNode.parameters.jsCode || '';
  const cbIdx = code.indexOf('// === Callback direct vers Spring Boot ===');
  if (cbIdx > -1) {
    const returnIdx = code.lastIndexOf('return [');
    // Supprimer tout entre le commentaire et le return
    code = code.substring(0, cbIdx) + code.substring(returnIdx);
    codeNode.parameters.jsCode = code;
    console.log('\nCallback this.helpers retire du Code node');
  }
}

const output = Array.isArray(arr) ? [wf] : wf;
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log('Ecrit:', outputPath);

console.log('\nImport...');
try {
  const out = execSync(`n8n import:workflow --input="${outputPath}"`, { encoding: 'utf8', timeout: 20000 });
  console.log(out.trim());
  execSync(`n8n update:workflow --id=${WF_ID} --active=true`, { timeout: 10000 });
  console.log('Workflow actif');
} catch (e) {
  console.error('Erreur:', e.message.substring(0, 400));
}
