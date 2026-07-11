// Ajouter continueOnFail=true sur tous les noeuds emailSend du workflow Agent 1
// Ainsi si l'email échoue (adresse invalide), le flux continue et le score est quand même sauvegardé
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WF_ID = 'abHc50O9XFYNXIa8';
const inputPath = path.join(process.env.TEMP, 'wf1-emoji-v2.json'); // dernière version corrigée emojis
const outputPath = path.join(process.env.TEMP, 'wf1-final.json');

// Re-exporter pour avoir la version la plus récente
console.log('Export workflow actuel...');
execSync(`n8n export:workflow --id=${WF_ID} --output="${inputPath}" --pretty`, { timeout: 15000 });

const raw = fs.readFileSync(inputPath, 'utf8');
const arr = JSON.parse(raw);
const wf = Array.isArray(arr) ? arr[0] : arr;

let emailFixed = 0;
let httpFixed = 0;

(wf.nodes || []).forEach(node => {
  if (node.type === 'n8n-nodes-base.emailSend') {
    if (!node.onError) {
      node.onError = 'continueRegularOutput'; // n8n v1.x style
    }
    // n8n older style
    if (node.continueOnFail === undefined) {
      node.continueOnFail = true;
    }
    emailFixed++;
    console.log('  Email continueOnFail=true:', node.name);
  }

  // S'assurer que le noeud HTTP Request sauvegarde le score a aussi continueOnFail=false (strict)
  if (node.type === 'n8n-nodes-base.httpRequest' && node.name && node.name.includes('Sauvegarder')) {
    node.continueOnFail = false; // on veut voir les erreurs ici
    httpFixed++;
    console.log('  HTTP Sauvegarder score: continueOnFail=false (strict)');
  }
});

console.log(`\nNoeuds mis a jour: ${emailFixed} emails, ${httpFixed} HTTP`);

// Écrire en conservant la structure tableau si besoin
const output = Array.isArray(arr) ? [wf] : wf;
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log('Fichier ecrit:', outputPath);

// Import
console.log('\nImport dans n8n...');
try {
  const out = execSync(`n8n import:workflow --input="${outputPath}"`, { encoding: 'utf8', timeout: 20000 });
  console.log('Import:', out.trim() || 'OK');
  execSync(`n8n update:workflow --id=${WF_ID} --active=true`, { timeout: 10000 });
  console.log('Workflow reactif (ID=' + WF_ID + ')');
  console.log('\nDone! Maintenant relancez node test-agents.js — aiScore devrait etre renseigne.');
} catch (e) {
  console.error('Erreur import:', e.message.substring(0, 400));
}
