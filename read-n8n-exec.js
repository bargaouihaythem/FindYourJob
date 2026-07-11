// Utiliser better-sqlite3 de n8n pour lire/modifier le workflow directement dans la DB
const path = require('path');
const n8nRoot = path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'npm', 'node_modules', 'n8n');

// Chercher better-sqlite3 dans les node_modules de n8n
let Database;
const possiblePaths = [
  path.join(n8nRoot, 'node_modules', 'better-sqlite3'),
  path.join(n8nRoot, 'node_modules', '@n8n', 'typeorm', 'node_modules', 'better-sqlite3'),
  path.join(n8nRoot, '..', 'better-sqlite3'),
];

for (const p of possiblePaths) {
  try {
    Database = require(p);
    console.log('better-sqlite3 found at:', p);
    break;
  } catch (e) {
    // continue
  }
}

if (!Database) {
  console.log('Paths tried:', possiblePaths);
  console.log('better-sqlite3 not found. Trying to find via n8n...');
  
  // Try to use n8n's own require
  try {
    const Module = require('module');
    const n8nMainPath = path.join(n8nRoot, 'dist', 'commands', 'start.js');
    Database = Module.createRequire(n8nMainPath)('better-sqlite3');
    console.log('Found via n8n require');
  } catch (e) {
    console.error('Still not found:', e.message);
    process.exit(1);
  }
}

// Ouvrir la DB
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const db = new Database(dbPath);

// Lire les dernières exécutions de Agent 1
const executions = db.prepare(`
  SELECT id, workflowId, status, startedAt, stoppedAt 
  FROM execution_entity 
  WHERE workflowId = 'abHc50O9XFYNXIa8' 
  ORDER BY id DESC 
  LIMIT 3
`).all();

console.log('\n=== Dernières exécutions Agent 1 ===');
executions.forEach(e => {
  console.log(`ID=${e.id} status=${e.status}`);
});

// Lire les détails de la plus récente
const latest = executions[0];
if (latest) {
  // Chercher les données d'exécution
  const execData = db.prepare('SELECT data FROM execution_entity WHERE id = ?').get(latest.id);
  if (execData && execData.data) {
    try {
      const d = JSON.parse(execData.data);
      const rd = d.resultData && d.resultData.runData;
      if (rd) {
        const saveScoreData = rd['Spring Boot \u2014 Sauvegarder score'];
        if (saveScoreData && saveScoreData[0]) {
          const nodeData = saveScoreData[0];
          console.log('\n=== Données nœud Sauvegarder score ===');
          if (nodeData.error) {
            console.log('Erreur:', JSON.stringify(nodeData.error, null, 2).substring(0, 500));
          }
          if (nodeData.data && nodeData.data.main && nodeData.data.main[0]) {
            const items = nodeData.data.main[0];
            if (items && items[0]) {
              console.log('Output:', JSON.stringify(items[0].json, null, 2).substring(0, 300));
            }
          }
        }
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  }
}

db.close();
