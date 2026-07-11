/**
 * Corrige les emojis corrompus (mojibake) dans le Code node de l'Agent 1 n8n
 * et réimporte le workflow corrigé.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tmpDir = process.env.TEMP || '/tmp';
const inputPath = path.join(tmpDir, 'wf1-check.json');
const outputPath = path.join(tmpDir, 'wf1-emojis-fixed.json');
const WF_ID = 'abHc50O9XFYNXIa8';

// Table de conversion Windows-1252 → Unicode pour les codes 0x80-0x9F
// (différents de Latin-1 pour cette plage)
const WIN1252_MAP = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
  0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
  0x9E: 0x017E, 0x9F: 0x0178,
};

// Convertit un codepoint Unicode (mojibake) en byte Windows-1252 original
function unicodeToWin1252Byte(codepoint) {
  // Latin-1 direct mapping (0x00-0x7F, 0xA0-0xFF)
  if (codepoint <= 0x7F) return codepoint;
  if (codepoint >= 0xA0 && codepoint <= 0xFF) return codepoint;
  // Windows-1252 special range (0x80-0x9F)
  for (const [byte, unicode] of Object.entries(WIN1252_MAP)) {
    if (unicode === codepoint) return parseInt(byte);
  }
  return -1; // pas trouvé
}

// Décode une chaîne mojibake (chars Windows-1252 mal encodés) en UTF-8 correct
function decodeMojibake(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i);
    // Si char > 0xFFFF, c'est déjà un emoji correct (surrogate pair)
    if (code > 0xFFFF) {
      // Déjà correct, passer
      bytes.push(0); // marqueur de "stop"
      return null; // chaîne déjà correcte
    }
    const byte = unicodeToWin1252Byte(code);
    if (byte === -1) return null; // pas convertible
    bytes.push(byte);
    // Gestion des surrogate pairs (chars BMP uniquement ici)
    if (code > 0xFFFF) i++; // skip low surrogate
  }
  // Décoder les bytes comme UTF-8
  const buf = Buffer.from(bytes);
  const decoded = buf.toString('utf8');
  return decoded.includes('\uFFFD') ? null : decoded;
}

function fixMojibakeInString(str) {
  // Chercher les séquences de chars Latin-1/Win1252 étendus (potentiels emojis corrompus)
  // Pattern: séquence commençant par 0xC0-0xFF suivi de chars 0x80-0xFF
  return str.replace(/([\u00C0-\u00FF][\u0080-\u00FF]{1,5})/g, (match) => {
    const fixed = decodeMojibake(match);
    if (fixed && fixed !== match) {
      return fixed;
    }
    return match;
  });
}

console.log('Lecture du workflow:', inputPath);
const content = fs.readFileSync(inputPath, 'utf8');
const wf = JSON.parse(content);

const nodes = wf.nodes || (Array.isArray(wf) ? wf[0].nodes : []);
let totalFixes = 0;

for (const node of nodes) {
  if (node.parameters && node.parameters.jsCode) {
    const original = node.parameters.jsCode;
    const fixed = fixMojibakeInString(original);
    if (fixed !== original) {
      console.log('Node corrige:', node.name);
      // Compter les emojis
      const before = (original.match(/[\uD800-\uDBFF]/g) || []).length;
      const after = (fixed.match(/[\uD800-\uDBFF]/g) || []).length;
      console.log('  Emojis avant:', before, '| après:', after);
      node.parameters.jsCode = fixed;
      totalFixes++;
    }
  }
  // Corriger aussi les templates HTML dans les nœuds email
  if (node.parameters && node.parameters.html) {
    const original = node.parameters.html;
    const fixed = fixMojibakeInString(original);
    if (fixed !== original) {
      console.log('Email HTML corrige:', node.name);
      node.parameters.html = fixed;
      totalFixes++;
    }
  }
  if (node.parameters && node.parameters.message) {
    const original = node.parameters.message;
    const fixed = fixMojibakeInString(original);
    if (fixed !== original) {
      console.log('Message corrige:', node.name);
      node.parameters.message = fixed;
      totalFixes++;
    }
  }
}

console.log('\nTotal noeuds corriges:', totalFixes);

// Écrire le workflow corrigé
const finalContent = JSON.stringify(wf, null, 2);
fs.writeFileSync(outputPath, finalContent, 'utf8');
console.log('Workflow corrige ecrit:', outputPath);

// Vérification rapide
const check = fs.readFileSync(outputPath, 'utf8');
const hasGarbled = /\u00f0\u0178/.test(check);
console.log('Mojibake restants (ðŸ):', hasGarbled ? 'OUI (a verifier)' : 'NON (corrige)');

// Importer dans n8n
console.log('\nImportation dans n8n...');
try {
  const result = execSync(`n8n import:workflow --input="${outputPath}" --separate=false 2>&1`, { encoding: 'utf8' });
  console.log(result);
  console.log('Import OK');
  
  // Réactiver le workflow
  execSync(`n8n update:workflow --id=${WF_ID} --active=true 2>&1`, { encoding: 'utf8' });
  console.log('Workflow reactivé');
} catch (e) {
  console.error('Erreur import:', e.message.substring(0, 200));
}
