/**
 * Corrige les emojis corrompus (mojibake Windows-1252) dans le Code node de l'Agent 1
 * Remplace chaque emoji corrompu par son texte Unicode correct
 */
const http = require('http');
const fs = require('fs');

const N8N_WF_ID = 'abHc50O9XFYNXIa8';

// Mapping des emojis corrompus → corrects
// Les emojis dans le code JS du workflow ont été encodés en Windows-1252
// puis lus comme Latin-1. On applique le re-encodage latin1→utf8.
function fixMojibake(text) {
  // Tenter la re-encodage latin1→utf8 globalement sur les zones suspectes
  // On travaille caractère par caractère pour les séquences hors ASCII
  let result = '';
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    // Si on est dans la plage Latin-1 étendue (0x80-0xFF), 
    // c'est potentiellement un emoji encodé en mojibake
    if (code >= 0xC0 && code <= 0xFF) {
      // Collecter la séquence de caractères Latin-1 étendue
      let bytes = [];
      let j = i;
      while (j < text.length && text.charCodeAt(j) >= 0x80 && text.charCodeAt(j) <= 0xFF) {
        bytes.push(text.charCodeAt(j));
        j++;
      }
      // Essayer de décoder ces bytes comme UTF-8
      try {
        const buf = Buffer.from(bytes);
        const decoded = buf.toString('utf8');
        // Vérifier que le décodage donne quelque chose de valide (pas de replacement char)
        if (!decoded.includes('\uFFFD')) {
          result += decoded;
          i = j;
          continue;
        }
      } catch(e) {}
      result += text[i];
      i++;
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
}

// Remplacement direct des séquences connues
const EMOJI_FIXES = [
  // 📧 envelope = F0 9F 93 A7
  [/\u00f0\u009f\u0093\u00a7/g, '📧'],
  // 🌟 star = F0 9F 8C 9F
  [/\u00f0\u009f\u008c\u009f/g, '🌟'],
  // ✅ check = E2 9C 85
  [/\u00e2\u009c\u0085/g, '✅'],
  // ⚠️ warning = E2 9A A0 EF B8 8F
  [/\u00e2\u009a\u00a0\u00ef\u00b8\u008f/g, '⚠️'],
  // 📋 clipboard = F0 9F 93 8B
  [/\u00f0\u009f\u0093\u008b/g, '📋'],
  // 📅 calendar = F0 9F 93 85
  [/\u00f0\u009f\u0093\u0085/g, '📅'],
];

function fixEmojis(code) {
  let result = code;
  for (const [pattern, replacement] of EMOJI_FIXES) {
    result = result.replace(pattern, replacement);
  }
  // Fallback: re-encodage latin1→utf8 pour les emojis restants
  // Trouver les séquences de bytes 0xC0-0xFF qui forment des séquences UTF-8 valides
  result = result.replace(/[\xC0-\xFF][\x80-\xBF]+/g, (match) => {
    try {
      const bytes = Buffer.from(match.split('').map(c => c.charCodeAt(0)));
      const decoded = bytes.toString('utf8');
      if (!decoded.includes('\uFFFD') && decoded !== match) return decoded;
    } catch(e) {}
    return match;
  });
  return result;
}

// 1. Exporter le workflow via n8n API REST (n8n local)
function n8nGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 5678,
      path: path, method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

function n8nPatch(path, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 5678,
      path: path, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('Lecture du workflow Agent 1 depuis le fichier exporté...');
  
  // Lire le fichier déjà exporté
  const wfPath = process.env.TEMP + '\\wf1-check.json';
  const wfRaw = fs.readFileSync(wfPath, 'utf8');
  
  // Appliquer le fix d'encodage sur l'intégralité du JSON
  // en traitant le fichier comme du latin1 d'abord
  const wfLatin1 = fs.readFileSync(wfPath);
  const wfFixed = Buffer.from(wfLatin1).toString('latin1');
  
  // Re-encoder les séquences mojibake
  const wf = JSON.parse(wfRaw);
  const nodes = wf.nodes || (Array.isArray(wf) ? wf[0].nodes : []);
  
  let fixedCount = 0;
  for (const node of nodes) {
    if (node.parameters && node.parameters.jsCode) {
      const original = node.parameters.jsCode;
      // Méthode 1: remplacement direct des bytes latin1 mal encodés
      const bytes = Buffer.from(original, 'utf8');
      const reEncoded = Buffer.from(bytes.toString('binary'), 'latin1').toString('utf8');
      
      if (reEncoded !== original) {
        console.log('Node:', node.name);
        // Compter les emojis avant/après
        const emojisBefore = (original.match(/[ðŸ]/g) || []).length;
        const emojisAfter = (reEncoded.match(/[ðŸ]/g) || []).length;
        if (emojisBefore > emojisAfter) {
          console.log('  Emojis corriges:', emojisBefore, '->', emojisAfter);
        }
        node.parameters.jsCode = reEncoded;
        fixedCount++;
      }
    }
  }
  
  if (fixedCount === 0) {
    console.log('Aucun emoji a corriger (peut-etre deja correct ou autre encodage)');
    console.log('Application du fix direct par remplacement...');
    
    // Approche alternative: modifier le JSON string brut
    let jsonStr = wfRaw;
    
    // Remplacer les séquences connues en JSON-escaped form
    const replacements = [
      // ðŸ"§ (📧 envelope)
      ['\\u00f0\\u0178\\u201c\\u00a7', '📧'],  // Possible representation
      ['ðŸ"§', '📧'],
      ['ðŸŒŸ', '🌟'],
      ['ðŸ"', '📋'],
      ['ðŸ"…', '📅'],
      ['âœ…', '✅'],
      ['âš ï¸', '⚠️'],
    ];
    
    for (const [from, to] of replacements) {
      if (jsonStr.includes(from)) {
        console.log('  Remplace:', from, '->', to);
        jsonStr = jsonStr.split(from).join(to);
      }
    }
    
    // Réécrire et ré-importer
    const fixedWfPath = process.env.TEMP + '\\wf1-emoji-fixed.json';
    fs.writeFileSync(fixedWfPath, jsonStr, 'utf8');
    console.log('Fichier corrige écrit:', fixedWfPath);
    console.log('Importez avec: n8n import:workflow --input=' + fixedWfPath);
    return;
  }
  
  // Sauvegarder le workflow corrigé
  const fixedWfPath = process.env.TEMP + '\\wf1-emoji-fixed.json';
  fs.writeFileSync(fixedWfPath, JSON.stringify(wf, null, 2), 'utf8');
  console.log('Workflow corrige sauvegarde:', fixedWfPath);
  console.log('Importez avec: n8n import:workflow --input="' + fixedWfPath + '" --separate=false');
}

main().catch(e => { console.error('ERREUR:', e.message); process.exit(1); });
