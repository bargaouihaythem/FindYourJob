// Correction emojis corrompus (mojibake Windows-1252) dans Agent 1 n8n
// Utilise les codepoints Unicode exacts pour les remplacements
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tmpDir = process.env.TEMP || 'C:/Users/hbargaoui/AppData/Local/Temp';
const inputPath = path.join(tmpDir, 'wf1-check.json');
const outputPath = path.join(tmpDir, 'wf1-emoji-v2.json');
const WF_ID = 'abHc50O9XFYNXIa8';

// Sequences mojibake (en codepoints) -> emoji correct
// Mojibake = bytes UTF-8 de l'emoji, lus comme Windows-1252, puis re-encodes UTF-8
// Ex: emoji = F0 9F 93 A7 (UTF-8 de \uD83D\uDCE7)
//     Lu W1252: F0->U+00F0(ð), 9F->U+0178(Ÿ), 93->U+201C(\u201C), A7->U+00A7(§)
//     Mojibake stored: \u00F0\u0178\u201C\u00A7

// Table de correspondance des emojis utilises dans le template:
const REPLACEMENTS = [
  // \uD83D\uDCE7 = 📧 (envelope)  [F0 9F 93 A7]
  ['\u00F0\u0178\u201C\u00A7', '\uD83D\uDCE7'],
  // \uD83C\uDF1F = 🌟 (glowing star)  [F0 9F 8C 9F]  -> 9F=U+0178, 8C=U+0152
  ['\u00F0\u0178\u0152\u0178', '\uD83C\uDF1F'],
  // \u2705 = ✅ (check mark)  [E2 9C 85]  -> E2=U+00E2, 9C=U+0153, 85=U+2026
  ['\u00E2\u0153\u2026', '\u2705'],
  // \u26A0\uFE0F = ⚠️ (warning)  [E2 9A A0 EF B8 8F]
  ['\u00E2\u02DC\u00A0\u00EF\u00B8\u008F', '\u26A0\uFE0F'],
  // \uD83D\uDCCB = 📋 (clipboard)  [F0 9F 93 8B]  -> 8B=U+2039
  ['\u00F0\u0178\u201C\u2039', '\uD83D\uDCCB'],
  // \uD83D\uDCC5 = 📅 (calendar)  [F0 9F 93 85]  -> 85=U+2026
  ['\u00F0\u0178\u201C\u2026', '\uD83D\uDCC5'],
  // \uD83D\uDCDD = 📝 (memo)  [F0 9F 93 9D]  -> 9D=U+017E
  ['\u00F0\u0178\u201C\u017E', '\uD83D\uDCDD'],
  // \uD83D\uDE80 = 🚀 (rocket)  [F0 9F 9A 80]
  ['\u00F0\u0178\u02DC\u0080', '\uD83D\uDE80'],
  // \uD83D\uDD0D = 🔍 (magnifying glass) [F0 9F 94 8D]  -> 94=U+201D, 8D=U+008D
  ['\u00F0\u0178\u201D\u008D', '\uD83D\uDD0D'],
];

console.log('Lecture:', inputPath);
let content = fs.readFileSync(inputPath, 'utf8');
const before = content.length;

let fixCount = 0;
for (const [bad, good] of REPLACEMENTS) {
  if (content.includes(bad)) {
    const occurrences = content.split(bad).length - 1;
    content = content.split(bad).join(good);
    console.log('  Corrige:', occurrences, 'x', JSON.stringify(bad).substring(0, 30), '->', good);
    fixCount += occurrences;
  }
}

console.log('\nTotal remplacements:', fixCount);

// Verifier s'il reste des ð (U+00F0) seuls - signe de mojibake non corrige
const remaining = (content.match(/\u00F0\u0178/g) || []).length;
if (remaining > 0) {
  console.log('ATTENTION: Il reste', remaining, 'sequences non corrigees (ðŸ)');
}

fs.writeFileSync(outputPath, content, 'utf8');
console.log('Fichier ecrit:', outputPath);

// Import dans n8n
console.log('\nImport dans n8n...');
try {
  const out = execSync(`n8n import:workflow --input="${outputPath}"`, { encoding: 'utf8', timeout: 20000 });
  console.log('Import:', out.trim() || 'OK');
  execSync(`n8n update:workflow --id=${WF_ID} --active=true`, { timeout: 10000 });
  console.log('Workflow reactive (ID=' + WF_ID + ')');
  console.log('\nDone! Relancez un test pour verifier les emails.');
} catch (e) {
  console.error('Erreur:', e.message.substring(0, 300));
  console.log('\nImportez manuellement via: n8n import:workflow --input="' + outputPath + '"');
}
