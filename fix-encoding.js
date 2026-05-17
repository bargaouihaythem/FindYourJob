const fs = require('fs');
const path = require('path');
const tmpDir = process.env.TEMP || process.env.TMP || 'C:\\Users\\HBARGA~1\\AppData\\Local\\Temp';

// Mapping Windows-1252 mojibake → caractères corrects
// Utilise des codes Unicode explicites pour éviter tout problème d'encodage dans ce fichier source
// Principe: chaque char UTF-8 d'origine a ses bytes lus comme Windows-1252 puis re-encodés UTF-8
const badToGood = [
  // — em dash U+2014 (UTF-8: e2 80 94 → W1252: â + € + \u201D)
  ['\u00E2\u20AC\u201D', '\u2014'],
  // – en dash U+2013 (UTF-8: e2 80 93 → W1252: â + € + \u201C)
  ['\u00E2\u20AC\u201C', '\u2013'],
  // ' right single quote U+2019 (UTF-8: e2 80 99 → W1252: â + € + \u2122 ™)
  ['\u00E2\u20AC\u2122', '\u2019'],
  // ' left single quote U+2018 (UTF-8: e2 80 98 → W1252: â + € + \u02DC ˜)
  ['\u00E2\u20AC\u02DC', '\u2018'],
  // " right double quote U+201D (UTF-8: e2 80 9d → W1252: â + € + \u0153 œ)
  ['\u00E2\u20AC\u0153', '\u201D'],
  // " left double quote U+201C (UTF-8: e2 80 9c → W1252: â + € + \u201C)
  ['\u00E2\u20AC\uFFFD', '\u201C'],
  // • bullet U+2022 (UTF-8: e2 80 a2 → W1252: â + € + ¢)
  ['\u00E2\u20AC\u00A2', '\u2022'],
  // … ellipsis U+2026 (UTF-8: e2 80 a6 → W1252: â + € + ¦)
  ['\u00E2\u20AC\u00A6', '\u2026'],
  // ≥ U+2265 (UTF-8: e2 89 a5 → W1252: â + ‰ + ¥)
  ['\u00E2\u2030\u00A5', '\u2265'],
  // ≤ U+2264 (UTF-8: e2 89 a4 → W1252: â + ‰ + ¤)
  ['\u00E2\u2030\u00A4', '\u2264'],
  // é U+00E9 (UTF-8: c3 a9 → W1252: Ã + ©)
  ['\u00C3\u00A9', '\u00E9'],
  // è U+00E8 (UTF-8: c3 a8 → W1252: Ã + ¨)
  ['\u00C3\u00A8', '\u00E8'],
  // à U+00E0 (UTF-8: c3 a0 → W1252: Ã + \u00A0)
  ['\u00C3\u00A0', '\u00E0'],
  // â U+00E2 (UTF-8: c3 a2 → W1252: Ã + ¢)
  ['\u00C3\u00A2', '\u00E2'],
  // ê U+00EA (UTF-8: c3 aa → W1252: Ã + ª)
  ['\u00C3\u00AA', '\u00EA'],
  // î U+00EE (UTF-8: c3 ae → W1252: Ã + ®)
  ['\u00C3\u00AE', '\u00EE'],
  // ô U+00F4 (UTF-8: c3 b4 → W1252: Ã + ´)
  ['\u00C3\u00B4', '\u00F4'],
  // ù U+00F9 (UTF-8: c3 b9 → W1252: Ã + ¹)
  ['\u00C3\u00B9', '\u00F9'],
  // û U+00FB (UTF-8: c3 bb → W1252: Ã + »)
  ['\u00C3\u00BB', '\u00FB'],
  // ç U+00E7 (UTF-8: c3 a7 → W1252: Ã + §)
  ['\u00C3\u00A7', '\u00E7'],
  // É U+00C9 (UTF-8: c3 89 → W1252: Ã + ‰)
  ['\u00C3\u2030', '\u00C9'],
  // È U+00C8 (UTF-8: c3 88 → W1252: Ã + ˆ)
  ['\u00C3\u02C6', '\u00C8'],
  // À U+00C0 (UTF-8: c3 80 → W1252: Ã + €) — attention: € = U+20AC
  ['\u00C3\u20AC', '\u00C0'],
  // Ç U+00C7 (UTF-8: c3 87 → W1252: Ã + ‡)
  ['\u00C3\u2021', '\u00C7'],
  // ü U+00FC (UTF-8: c3 bc → W1252: Ã + ¼)
  ['\u00C3\u00BC', '\u00FC'],
  // ö U+00F6 (UTF-8: c3 b6 → W1252: Ã + ¶)
  ['\u00C3\u00B6', '\u00F6'],
  // ä U+00E4 (UTF-8: c3 a4 → W1252: Ã + ¤)
  ['\u00C3\u00A4', '\u00E4'],
  // ñ U+00F1 (UTF-8: c3 b1 → W1252: Ã + ±)
  ['\u00C3\u00B1', '\u00F1'],
];

const files = ['wf1.json', 'wf2.json', 'wf3.json'];

files.forEach(f => {
  const inPath = path.join(tmpDir, f);
  const outPath = path.join(tmpDir, f.replace('.json', '-fixed.json'));
  
  if (!fs.existsSync(inPath)) {
    console.log(`SKIP: ${inPath} not found`);
    return;
  }

  // Lire en binaire puis décoder comme Latin-1, re-encoder en UTF-8
  const rawBuffer = fs.readFileSync(inPath);
  
  // Méthode 1: corriger les séquences UTF-8 mal interprétées
  // Les fichiers n8n sont en UTF-8, mais parfois le contenu des champs
  // a été stocké avec double-encodage. On utilise le mapping direct.
  let text = rawBuffer.toString('utf8');
  
  // Vérifier si on a des caractères corrompus
  const hasBadChars = badToGood.some(([bad]) => text.includes(bad));
  
  if (hasBadChars) {
    console.log(`${f}: caractères corrompus détectés, correction...`);
    for (const [bad, good] of badToGood) {
      while (text.includes(bad)) {
        text = text.replaceAll(bad, good);
      }
    }
  } else {
    // Méthode 2: si le fichier a été sauvegardé avec double-encodage UTF-8
    // Essayer de lire les bytes comme Latin-1 puis re-décoder en UTF-8
    let textLatin = rawBuffer.toString('latin1');
    const tryUtf8 = Buffer.from(textLatin, 'latin1').toString('utf8');
    // Vérifier si la conversion latin1→utf8 donne quelque chose de lisible
    if (!tryUtf8.includes('â€') && tryUtf8.includes('—')) {
      text = tryUtf8;
      console.log(`${f}: corrigé via re-encodage latin1→utf8`);
    } else {
      console.log(`${f}: aucun caractère corrompu détecté, copie directe`);
      text = rawBuffer.toString('utf8');
    }
  }

  fs.writeFileSync(outPath, text, 'utf8');
  
  // Afficher les noms de workflow et de nœuds pour vérification
  try {
    const wf = JSON.parse(text);
    const workflow = Array.isArray(wf) ? wf[0] : wf;
    console.log(`  Workflow: "${workflow.name}"`);
    if (workflow.nodes) {
      workflow.nodes.forEach(n => console.log(`    Node: "${n.name}"`));
    }
  } catch(e) {
    console.log(`  (parse error: ${e.message})`);
  }
  
  console.log(`  Sauvegardé: ${outPath}`);
  console.log('');
});
