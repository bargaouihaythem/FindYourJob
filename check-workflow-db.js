const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

// 1. Lire l'URL du noeud Sauvegarder dans le workflow stocké
db.all("SELECT id, name, nodes FROM workflow_entity WHERE id='abHc50O9XFYNXIa8'", (e, rows) => {
  if (rows && rows[0]) {
    try {
      const nodes = JSON.parse(rows[0].nodes);
      const n = nodes.find(x => x.name.includes('Sauvegarder'));
      if (n) {
        console.log('=== URL dans workflow_entity ===');
        console.log('URL:', n.parameters.url);
        console.log('continueOnFail:', n.continueOnFail);
        console.log('queryParams:', JSON.stringify(n.parameters.queryParameters));
      }
    } catch(e2) { console.error('parse error:', e2.message); }
  }
  
  // 2. Lire les données d'exécution pour la plus récente
  db.all("SELECT executionId, data FROM execution_data WHERE executionId IN (SELECT id FROM execution_entity WHERE workflowId='abHc50O9XFYNXIa8' ORDER BY id DESC LIMIT 3)", (e3, execRows) => {
    execRows && execRows.forEach(er => {
      console.log('\n=== Execution', er.executionId, '===');
      try {
        const data = JSON.parse(er.data);
        const rd = data.resultData && data.resultData.runData;
        if (rd) {
          Object.keys(rd).forEach(nodeName => {
            const nodeData = rd[nodeName];
            if (nodeData && nodeData[0]) {
              const nd = nodeData[0];
              if (nd.error) {
                console.log(`  ERROR [${nodeName}]: ${nd.error.message || nd.error.description || ''}`);
                if (nd.error.cause) {
                  console.log('    cause:', JSON.stringify(nd.error.cause).substring(0, 200));
                }
              } else {
                // Chercher l'URL dans les metadata d'exécution
                if (nodeName.includes('Sauvegarder') && nd.data) {
                  console.log(`  OK [${nodeName}]`);
                }
              }
            }
          });
        }
      } catch(parseErr) {
        // Data might be stored differently (gzip?)
        console.log('Parse error (might be binary):', er.data ? er.data.substring(0, 50) : 'null');
      }
    });
    db.close();
  });
});
