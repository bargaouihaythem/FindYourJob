// Lire les dernières exécutions n8n depuis SQLite
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.log('better-sqlite3 non disponible:', e.message);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// Dernières exécutions
const rows = db.prepare(`
  SELECT id, workflowId, status, startedAt, stoppedAt
  FROM execution_entity
  ORDER BY id DESC
  LIMIT 10
`).all();

console.log('\n=== Dernières exécutions n8n ===');
rows.forEach(r => {
  console.log(`ID=${r.id} | wf=${r.workflowId} | ${r.status} | ${r.startedAt || ''}`);
});

// Chercher les exécutions pour Agent 1 (wf abHc50O9XFYNXIa8)
const wf1Rows = db.prepare(`
  SELECT id, status, data FROM execution_entity
  WHERE workflowId = 'abHc50O9XFYNXIa8'
  ORDER BY id DESC
  LIMIT 3
`).all();

console.log('\n=== Exécutions Agent 1 ===');
wf1Rows.forEach(r => {
  console.log(`ID=${r.id} status=${r.status}`);
  if (r.data) {
    try {
      const d = JSON.parse(r.data);
      const rd = d.resultData && d.resultData.runData;
      if (rd) {
        Object.keys(rd).forEach(nodeName => {
          const nodeData = rd[nodeName];
          if (nodeData && nodeData[0]) {
            const nd = nodeData[0];
            console.log(`  Node: ${nodeName} | error: ${nd.error ? JSON.stringify(nd.error).substring(0, 200) : 'none'}`);
          }
        });
      }
    } catch (e) {
      console.log('  (parse error)');
    }
  }
});

db.close();
